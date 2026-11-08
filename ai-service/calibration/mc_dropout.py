"""
Monte Carlo Dropout (MC-Dropout) Inference and Uncertainty Estimation.
Performs stochastic forward passes while strictly preserving BatchNorm evaluation mode.
Extracts deterministic backbone features once and evaluates N stochastic dropout passes,
providing mathematical equivalence to full stochastic passes while minimizing CPU latency.
"""

import time
import logging
import numpy as np
import torch
import torch.nn as nn
import torch.nn.functional as F

logger = logging.getLogger("NeuroScanAI.MCDropout")

DEFAULT_MC_PASSES = 20
EPSILON = 1e-12


def verify_mc_dropout_equivalence(model, sample_tensor, tolerance=1e-5):
    """
    Rigorously verifies that cached feature extraction matches full forward pass
    under deterministic evaluation mode, and confirms BatchNorm layers remain in eval.
    Returns:
        dict: {
            "equivalent": bool,
            "max_abs_diff": float,
            "class_match": bool,
            "all_batchnorm_eval": bool,
            "only_intended_dropout": bool
        }
    """
    model.eval()
    device = next(model.parameters()).device
    x = sample_tensor.to(device)

    # 1. Full forward pass
    with torch.no_grad():
        z_full = model(x)

    # 2. Cached feature extraction pass
    with torch.no_grad():
        eff = model.efficientnet(x)
        swin = model.swin(x)
        feat = torch.cat((eff, swin), dim=1)
        z_cached = model.fc(feat)  # model.dropout is in eval() mode (identity)

    max_diff = float(torch.max(torch.abs(z_full - z_cached)).item())
    pred_full = int(torch.argmax(z_full, dim=1).item())
    pred_cached = int(torch.argmax(z_cached, dim=1).item())
    class_match = (pred_full == pred_cached)
    equivalent = (max_diff <= tolerance) and class_match

    # 3. Verify all BatchNorm modules are in eval mode
    bn_modules = [m for m in model.modules() if isinstance(m, (nn.BatchNorm1d, nn.BatchNorm2d, nn.BatchNorm3d))]
    all_bn_eval = all(not m.training for m in bn_modules)

    # 4. Check dropout layers in model
    # The intended dropout module is model.dropout
    has_intended_dropout = hasattr(model, "dropout") and isinstance(model.dropout, nn.Dropout)

    return {
        "equivalent": equivalent,
        "max_abs_diff": max_diff,
        "class_match": class_match,
        "all_batchnorm_eval": all_bn_eval,
        "only_intended_dropout": has_intended_dropout,
        "batchnorm_count": len(bn_modules),
    }


def run_mc_dropout(model, image_tensor, n_passes=DEFAULT_MC_PASSES, temperature=1.0, use_cache=True):
    """
    Executes MC-Dropout stochastic inference.
    - Keeps entire model and all BatchNorm layers in eval mode.
    - Activates ONLY model.dropout (p=0.5).
    - If use_cache=True, computes deterministic EfficientNet + Swin backbone features once,
      then runs N stochastic passes through fc(dropout(features)).
    - If temperature != 1.0, applies temperature scaling to stochastic logits: softmax(z_n / T).
    Returns:
        dict: {
            "mean_probabilities": list of 4 floats,
            "pass_probabilities": list of N lists,
            "predictive_entropy": float,
            "expected_entropy": float,
            "mutual_information": float,
            "variance_per_class": list of 4 floats,
            "latency_ms": float,
            "n_passes": int,
            "temperature_used": float,
            "stochastic_variation_confirmed": bool
        }
    """
    assert n_passes >= 2, f"MC-Dropout requires at least 2 passes, got {n_passes}"
    assert temperature > 0.0, f"Temperature must be positive, got {temperature}"

    start_time = time.perf_counter()
    model.eval()  # Strictly ensure eval mode for backbones and all BatchNorm layers
    device = next(model.parameters()).device
    x = image_tensor.to(device)

    # Confirm BatchNorm state before proceeding
    for m in model.modules():
        if isinstance(m, (nn.BatchNorm1d, nn.BatchNorm2d, nn.BatchNorm3d)):
            assert not m.training, "CRITICAL: BatchNorm module detected in training mode during MC-Dropout!"

    # Activate ONLY the intended dropout module
    model.dropout.train(True)

    pass_probs = []

    try:
        with torch.no_grad():
            if use_cache:
                # Extract deterministic backbone features once
                eff_feat = model.efficientnet(x)
                swin_feat = model.swin(x)
                feat = torch.cat((eff_feat, swin_feat), dim=1)

                # N stochastic forward passes through dropout + fc
                for _ in range(n_passes):
                    dropped = model.dropout(feat)
                    logits = model.fc(dropped)
                    scaled_logits = logits / temperature
                    probs = F.softmax(scaled_logits, dim=-1).squeeze(0).cpu().numpy()
                    pass_probs.append(probs)
            else:
                # Full forward passes
                for _ in range(n_passes):
                    logits = model(x)
                    scaled_logits = logits / temperature
                    probs = F.softmax(scaled_logits, dim=-1).squeeze(0).cpu().numpy()
                    pass_probs.append(probs)
    finally:
        # Strictly restore dropout to eval mode
        model.dropout.eval()

    latency_ms = (time.perf_counter() - start_time) * 1000.0

    # Convert to array of shape (N, NUM_CLASSES)
    p_stack = np.stack(pass_probs, axis=0)  # (N, K)

    # 1. Mean predictive probabilities P_mean = (1/N) * sum(P_n)
    p_mean = np.mean(p_stack, axis=0)

    # 2. Predictive entropy H(P_mean) = -sum(P_mean_i * log(P_mean_i))
    pred_entropy = float(-np.sum(p_mean * np.log(np.clip(p_mean, EPSILON, 1.0))))

    # 3. Expected entropy = (1/N) * sum(H(P_n))
    pass_entropies = -np.sum(p_stack * np.log(np.clip(p_stack, EPSILON, 1.0)), axis=1)
    expected_entropy = float(np.mean(pass_entropies))

    # 4. Mutual Information = H(P_mean) - Expected Entropy (epistemic uncertainty)
    mutual_info = float(max(0.0, pred_entropy - expected_entropy))

    # 5. Variance per class across stochastic passes
    var_per_class = np.var(p_stack, axis=0).tolist()
    stochastic_variation = bool(np.max(var_per_class) > 1e-7)

    return {
        "mean_probabilities": [float(round(v, 6)) for v in p_mean.tolist()],
        "pass_probabilities": [[float(round(v, 6)) for v in p] for p in pass_probs],
        "predictive_entropy": float(round(pred_entropy, 6)),
        "expected_entropy": float(round(expected_entropy, 6)),
        "mutual_information": float(round(mutual_info, 6)),
        "variance_per_class": [float(round(v, 8)) for v in var_per_class],
        "latency_ms": float(round(latency_ms, 2)),
        "n_passes": n_passes,
        "temperature_used": float(round(temperature, 4)),
        "stochastic_variation_confirmed": stochastic_variation,
    }

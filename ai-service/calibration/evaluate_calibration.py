"""
Comprehensive Research Calibration, Uncertainty Evaluation, and Reproducibility Engine.
Executes:
1. Canonical stratified splitting (Train: 5120, Val: 640, Test: 640).
2. Validation partition into val_calib (320) and val_policy (320) to prevent threshold overfitting.
3. Fitting separate temperatures T_det and T_mc on val_calib.
4. Deriving selective risk and coverage thresholds on val_policy.
5. Final evaluation on untouched test set across 4 methods:
   - Method A: Original Softmax
   - Method B: Temperature-Scaled Deterministic
   - Method C: MC-Dropout Mean (N=20, uncalibrated)
   - Method D: Temperature-Scaled MC-Dropout Mean (N=20, T_mc)
6. Generates reproducibility manifest, metrics JSON, and reliability curves.
"""

import os
import sys
import json
import time
import hashlib
import numpy as np
import pandas as pd
import torch
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import LabelEncoder
from PIL import Image

# Ensure ai-service root in path
AI_SERVICE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if AI_SERVICE_DIR not in sys.path:
    sys.path.insert(0, AI_SERVICE_DIR)

from model_loader import load_model, NUM_CLASSES
from inference import preprocess_image, CLASS_NAMES
from calibration.temperature_scaling import (
    temperature_scale,
    fit_temperature,
    save_temperature,
    validate_temperature,
)
from calibration.mc_dropout import run_mc_dropout, verify_mc_dropout_equivalence
from calibration.calibration_metrics import (
    compute_ece,
    compute_brier_score,
    compute_nll,
    compute_risk_coverage_curve,
    bootstrap_confidence_intervals,
)

EXPECTED_CHECKPOINT_HASH = "676fefe87d63ab727fe9b3451e94d86b056082651bbe858ca52bb56ae8fcdf06"
DATASET_PATH = os.path.normpath(os.path.join(AI_SERVICE_DIR, "../dataset/OriginalDataset"))
CACHE_DIR = os.path.join(AI_SERVICE_DIR, "calibration", "data_cache")


def compute_file_sha256(filepath):
    h = hashlib.sha256()
    with open(filepath, "rb") as f:
        while chunk := f.read(8192):
            h.update(chunk)
    return h.hexdigest()


def get_dataset_splits(dataset_path=DATASET_PATH):
    """
    Builds canonical dataframe and splits matching training notebook:
    Train: 80% (5120), Temp: 20% (1280) -> Val: 10% (640), Test: 10% (640).
    Further splits Val into val_calib (320) and val_policy (320).
    """
    assert os.path.isdir(dataset_path), f"Dataset directory not found: {dataset_path}"

    records = []
    for label in sorted(os.listdir(dataset_path)):
        class_dir = os.path.join(dataset_path, label)
        if os.path.isdir(class_dir):
            for img_name in sorted(os.listdir(class_dir)):
                if img_name.lower().endswith((".jpg", ".jpeg", ".png")):
                    records.append([os.path.join(class_dir, img_name), label])

    df = pd.DataFrame(records, columns=["filepath", "label"])
    le = LabelEncoder()
    df["label_idx"] = le.fit_transform(df["label"])

    assert len(df) == 6400, f"Expected 6400 images, got {len(df)}"
    assert list(le.classes_) == CLASS_NAMES, f"Class mapping mismatch: {le.classes_} vs {CLASS_NAMES}"

    # Canonical split with random_state=42
    train_df, temp_df = train_test_split(df, test_size=0.20, random_state=42, stratify=df["label_idx"])
    val_df, test_df = train_test_split(temp_df, test_size=0.50, random_state=42, stratify=temp_df["label_idx"])

    # Split validation into calibration-fitting (320) and policy-selection (320) subsets
    val_calib_df, val_policy_df = train_test_split(
        val_df, test_size=0.50, random_state=42, stratify=val_df["label_idx"]
    )

    return {
        "train": train_df,
        "val_full": val_df,
        "val_calib": val_calib_df,
        "val_policy": val_policy_df,
        "test": test_df,
    }


def extract_features_and_mc_logits(model, df_split, split_name, n_passes=20):
    """
    Computes deterministic logits, features, and N stochastic MC-Dropout logits for a split.
    Caches results to disk for fast reproducibility.
    """
    os.makedirs(CACHE_DIR, exist_ok=True)
    cache_path = os.path.join(CACHE_DIR, f"{split_name}_cache.pt")

    if os.path.isfile(cache_path):
        print(f"[Cache] Loading cached logits for '{split_name}' from {cache_path}")
        return torch.load(cache_path, weights_only=False)

    print(f"[Inference] Computing logits and MC-Dropout for '{split_name}' ({len(df_split)} images)...")
    model.eval()
    device = next(model.parameters()).device

    det_logits_list = []
    mc_probs_list = []
    mc_entropies_list = []
    mutual_infos_list = []
    labels_list = []

    start_t = time.perf_counter()

    for idx, (_, row) in enumerate(df_split.iterrows()):
        tensor, _ = preprocess_image(row["filepath"])
        tensor = tensor.to(device)

        with torch.no_grad():
            # 1. Deterministic backbone feature extraction (single Swin + EfficientNet pass)
            eff = model.efficientnet(tensor)
            swin = model.swin(tensor)
            feat = torch.cat((eff, swin), dim=1)

            # Deterministic logit (model.dropout in eval() is identity)
            det_logit = model.fc(feat).squeeze(0).cpu().numpy()

            # 2. MC-Dropout stochastic passes on extracted features
            model.dropout.train(True)
            pass_probs = []
            for _ in range(n_passes):
                dropped = model.dropout(feat)
                logits = model.fc(dropped)
                probs = torch.softmax(logits, dim=-1).squeeze(0).cpu().numpy()
                pass_probs.append(probs)
            model.dropout.eval()

        p_stack = np.stack(pass_probs, axis=0)
        p_mean = np.mean(p_stack, axis=0)
        pred_ent = float(-np.sum(p_mean * np.log(np.clip(p_mean, 1e-12, 1.0))))
        pass_ents = -np.sum(p_stack * np.log(np.clip(p_stack, 1e-12, 1.0)), axis=1)
        exp_ent = float(np.mean(pass_ents))
        mi = float(max(0.0, pred_ent - exp_ent))

        det_logits_list.append(det_logit)
        mc_probs_list.append(p_mean)
        mc_entropies_list.append(pred_ent)
        mutual_infos_list.append(mi)
        labels_list.append(row["label_idx"])

        if (idx + 1) % 50 == 0 or (idx + 1) == len(df_split):
            print(f"  Processed {idx + 1}/{len(df_split)} samples...", flush=True)

    total_time = time.perf_counter() - start_t
    avg_latency_ms = (total_time / len(df_split)) * 1000.0
    print(f"[Inference] Finished '{split_name}' in {total_time:.2f}s ({avg_latency_ms:.1f}ms / image).", flush=True)

    cached_data = {
        "det_logits": np.array(det_logits_list, dtype=np.float32),
        "mc_probs": np.array(mc_probs_list, dtype=np.float32),
        "mc_entropies": np.array(mc_entropies_list, dtype=np.float32),
        "mutual_infos": np.array(mutual_infos_list, dtype=np.float32),
        "labels": np.array(labels_list, dtype=np.int64),
        "avg_latency_ms": avg_latency_ms,
        "n_samples": len(df_split),
    }

    torch.save(cached_data, cache_path)
    return cached_data


def evaluate_method_metrics(probs, labels):
    """Computes full suite of evaluation metrics for a set of predicted probabilities."""
    preds = np.argmax(probs, axis=-1)
    acc = float(np.mean(preds == labels) * 100.0)

    ece_uniform_15 = compute_ece(probs, labels, n_bins=15, adaptive=False)
    ece_uniform_10 = compute_ece(probs, labels, n_bins=10, adaptive=False)
    ece_adaptive_15 = compute_ece(probs, labels, n_bins=15, adaptive=True)
    brier = compute_brier_score(probs, labels)
    nll = compute_nll(probs, labels)

    # 95% Bootstrap Confidence Intervals
    ece_ci = bootstrap_confidence_intervals(
        lambda p, y: compute_ece(p, y, n_bins=15)["ece"], probs, labels
    )
    brier_ci = bootstrap_confidence_intervals(
        lambda p, y: compute_brier_score(p, y)["brier_score"], probs, labels
    )
    nll_ci = bootstrap_confidence_intervals(compute_nll, probs, labels)

    return {
        "accuracy_percent": round(acc, 2),
        "nll": round(nll, 4),
        "nll_ci_95": [nll_ci["ci_lower"], nll_ci["ci_upper"]],
        "brier_score": round(brier["brier_score"], 4),
        "brier_ci_95": [brier_ci["ci_lower"], brier_ci["ci_upper"]],
        "normalized_brier": round(brier["normalized_brier_score"], 4),
        "ece_uniform_15": round(ece_uniform_15["ece"], 4),
        "ece_ci_95": [ece_ci["ci_lower"], ece_ci["ci_upper"]],
        "ece_uniform_10": round(ece_uniform_10["ece"], 4),
        "ece_adaptive_15": round(ece_adaptive_15["ece"], 4),
        "max_calibration_error": round(ece_uniform_15["max_calibration_error"], 4),
        "bin_accuracies": ece_uniform_15["bin_accuracies"],
        "bin_confidences": ece_uniform_15["bin_confidences"],
        "bin_counts": ece_uniform_15["bin_counts"],
    }


def fit_mc_temperature(mc_probs, labels):
    """
    Fits separate temperature parameter T_mc for MC-Dropout probabilities by minimizing NLL.
    Takes pseudo-logits log(mc_probs) and optimizes T_mc.
    """
    pseudo_logits = np.log(np.clip(mc_probs, 1e-12, 1.0))
    res = fit_temperature(pseudo_logits, labels)
    return res


def run_full_calibration_experiment():
    print("=" * 70)
    print("NEUROSCAN AI — FEATURE 1: CALIBRATION & UNCERTAINTY ESTIMATION")
    print("=" * 70)

    # 1. Verify Checkpoint Hash
    ckpt_path = os.path.join(AI_SERVICE_DIR, "models", "best_hybrid_model.pth")
    assert os.path.isfile(ckpt_path), f"Checkpoint missing: {ckpt_path}"
    ckpt_hash = compute_file_sha256(ckpt_path)
    print(f"[1/7] Verifying Checkpoint SHA-256: {ckpt_hash}")
    assert ckpt_hash == EXPECTED_CHECKPOINT_HASH, "CRITICAL: Checkpoint hash mismatch!"
    print("      Checkpoint verified strictly intact.")

    # 2. Load Model & Verify MC-Dropout Equivalence
    print("\n[2/7] Loading Model & Running MC-Dropout Mathematical Equivalence Tests...")
    model = load_model()
    dummy_x = torch.zeros((1, 3, 224, 224))
    equiv_res = verify_mc_dropout_equivalence(model, dummy_x)
    print(f"      Equivalence max abs diff : {equiv_res['max_abs_diff']:.2e}")
    print(f"      Class equality           : {equiv_res['class_match']}")
    print(f"      All BatchNorm eval state : {equiv_res['all_batchnorm_eval']} ({equiv_res['batchnorm_count']} modules)")
    print(f"      Intended dropout present : {equiv_res['only_intended_dropout']}")
    assert equiv_res["equivalent"], "MC-Dropout equivalence test failed!"

    # 3. Load Dataset Splits
    print("\n[3/7] Loading Dataset Splits...")
    splits = get_dataset_splits(DATASET_PATH)
    print(f"      Train set       : {len(splits['train'])} samples")
    print(f"      Val Calib set   : {len(splits['val_calib'])} samples (for temperature fitting)")
    print(f"      Val Policy set  : {len(splits['val_policy'])} samples (for abstention threshold tuning)")
    print(f"      Held-out Test   : {len(splits['test'])} samples (untouched evaluation)")

    # 4. Extract Logits & Predictions
    print("\n[4/7] Extracting Logits & MC-Dropout Passes...")
    val_calib_data = extract_features_and_mc_logits(model, splits["val_calib"], "val_calib")
    val_policy_data = extract_features_and_mc_logits(model, splits["val_policy"], "val_policy")
    test_data = extract_features_and_mc_logits(model, splits["test"], "test")

    # 5. Fit Temperatures strictly on val_calib
    print("\n[5/7] Fitting Temperatures strictly on Validation Calibration split (N=320)...")
    det_fit = fit_temperature(val_calib_data["det_logits"], val_calib_data["labels"])
    t_det = det_fit["temperature"]
    print(f"      Deterministic T*    : {t_det:.4f} (NLL: {det_fit['nll_before']:.4f} -> {det_fit['nll_after']:.4f})")

    mc_fit = fit_mc_temperature(val_calib_data["mc_probs"], val_calib_data["labels"])
    t_mc = mc_fit["temperature"]
    print(f"      MC-Dropout T_mc*    : {t_mc:.4f} (NLL: {mc_fit['nll_before']:.4f} -> {mc_fit['nll_after']:.4f})")

    # Save temperature.json
    temp_json_path = os.path.join(AI_SERVICE_DIR, "calibration", "temperature.json")
    temp_payload = {
        "version": "1.0.0",
        "method": "temperature_scaling",
        "deterministic": {
            "temperature": t_det,
            "nll_before": det_fit["nll_before"],
            "nll_after": det_fit["nll_after"],
            "split": "val_calib",
            "samples": len(splits["val_calib"]),
        },
        "mc_dropout": {
            "temperature": t_mc,
            "nll_before": mc_fit["nll_before"],
            "nll_after": mc_fit["nll_after"],
            "split": "val_calib",
            "samples": len(splits["val_calib"]),
        },
        "checkpoint_sha256": ckpt_hash,
        "fitted_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
    }
    save_temperature(temp_json_path, temp_payload)

    # 6. Tune Abstention Policy strictly on val_policy
    print("\n[6/7] Deriving Statistical Abstention Policy on Validation Policy split (N=320)...")
    # Evaluate calibrated probabilities on val_policy
    p_val_calib = temperature_scale(val_policy_data["det_logits"], temperature=t_det)
    val_confs = np.max(p_val_calib, axis=-1)
    val_preds = np.argmax(p_val_calib, axis=-1)
    val_labels = val_policy_data["labels"]
    val_correct = (val_preds == val_labels)

    # Predictive entropy on val_policy
    val_entropy = -np.sum(p_val_calib * np.log(np.clip(p_val_calib, 1e-12, 1.0)), axis=-1)

    # Statistical Threshold Selection:
    # 1. Target selective risk: We seek a threshold where accepted samples achieve >= 95% precision (error <= 5%)
    # Let's inspect the risk-coverage curve on val_policy
    val_rc = compute_risk_coverage_curve(p_val_calib, val_labels, n_thresholds=100)

    # Find the confidence threshold achieving selective error <= 0.05 on val_policy
    sorted_idx = np.argsort(-val_confs)
    sorted_confs = val_confs[sorted_idx]
    sorted_errors = (val_preds != val_labels)[sorted_idx]

    cum_errors = np.cumsum(sorted_errors)
    cum_samples = np.arange(1, len(val_labels) + 1)
    cum_risk = cum_errors / cum_samples

    # Qualifying index for error <= 5%
    eligible = np.where(cum_risk <= 0.05)[0]
    if len(eligible) > 0:
        cutoff_k = eligible[-1]
        abstain_conf_thresh = float(round(sorted_confs[cutoff_k], 4))
    else:
        # Fallback to 10th percentile of incorrect samples
        abstain_conf_thresh = float(round(np.percentile(val_confs[~val_correct], 50), 4))

    # Low confidence threshold: median confidence of incorrect samples
    low_conf_thresh = float(round(np.median(val_confs[~val_correct]), 4))

    # High uncertainty threshold: 90th percentile of entropy among correct samples
    high_entropy_thresh = float(round(np.percentile(val_entropy[val_correct], 90), 4))

    # Critical entropy abstention threshold: 97.5th percentile
    abstain_entropy_thresh = float(round(np.percentile(val_entropy, 92), 4))

    print(f"      Abstention Confidence Threshold (tau_conf)    : {abstain_conf_thresh}")
    print(f"      Low-Confidence Warning Threshold               : {low_conf_thresh}")
    print(f"      High-Uncertainty Entropy Threshold (tau_ent)  : {high_entropy_thresh}")
    print(f"      Critical Abstention Entropy Threshold          : {abstain_entropy_thresh}")

    policy_payload = {
        "version": "1.0.0",
        "method": "risk_coverage_selective_prediction",
        "target_selective_risk": 0.05,
        "selection_split": "val_policy",
        "selection_samples": len(splits["val_policy"]),
        "thresholds": {
            "abstention_confidence_threshold": abstain_conf_thresh,
            "low_confidence_threshold": low_conf_thresh,
            "high_uncertainty_entropy_threshold": high_entropy_thresh,
            "critical_abstention_entropy_threshold": abstain_entropy_thresh,
        },
        "empirical_derivation": {
            "val_accuracy": float(round(np.mean(val_correct) * 100.0, 2)),
            "val_mean_confidence": float(round(np.mean(val_confs), 4)),
            "incorrect_samples_count": int(np.sum(~val_correct)),
            "selective_risk_at_threshold": float(round(cum_risk[min(cutoff_k if len(eligible) > 0 else 0, len(cum_risk)-1)], 4)),
        },
        "states": [
            "normal",
            "low_confidence",
            "high_uncertainty",
            "abstained",
            "calibration_unavailable"
        ]
    }

    policy_json_path = os.path.join(AI_SERVICE_DIR, "calibration", "uncertainty_policy.json")
    with open(policy_json_path, "w", encoding="utf-8") as f:
        json.dump(policy_payload, f, indent=2)
    print(f"      Saved uncertainty policy to: {policy_json_path}")

    # 7. Final Evaluation on Held-Out Test Set (N=640)
    print("\n[7/7] Evaluating 4 Methods on Held-Out Test Set (N=640)...")
    test_labels = test_data["labels"]

    # Method A: Original Softmax (T = 1.0)
    p_orig = temperature_scale(test_data["det_logits"], temperature=1.0)
    metrics_a = evaluate_method_metrics(p_orig, test_labels)

    # Method B: Temperature-Scaled Deterministic (T = t_det)
    p_calib = temperature_scale(test_data["det_logits"], temperature=t_det)
    metrics_b = evaluate_method_metrics(p_calib, test_labels)

    # Method C: MC-Dropout Mean (N=20, uncalibrated)
    p_mc = test_data["mc_probs"]
    metrics_c = evaluate_method_metrics(p_mc, test_labels)

    # Method D: Combined Temperature-Scaled MC-Dropout (T = t_mc)
    pseudo_mc_logits = np.log(np.clip(p_mc, 1e-12, 1.0))
    p_mc_calib = temperature_scale(pseudo_mc_logits, temperature=t_mc)
    metrics_d = evaluate_method_metrics(p_mc_calib, test_labels)

    # Evaluate Frozen Policy on Test Set
    test_confs = np.max(p_calib, axis=-1)
    test_preds = np.argmax(p_calib, axis=-1)
    test_entropies = -np.sum(p_calib * np.log(np.clip(p_calib, 1e-12, 1.0)), axis=-1)

    # Abstention logic: conf < abstain_conf_thresh OR entropy > abstain_entropy_thresh
    is_abstained = (test_confs < abstain_conf_thresh) | (test_entropies > abstain_entropy_thresh)
    retained = ~is_abstained

    retained_count = int(np.sum(retained))
    rejected_count = int(np.sum(is_abstained))
    coverage = float(round(retained_count / len(test_labels), 4))

    selective_errors = (test_preds[retained] != test_labels[retained])
    selective_risk = float(round(np.mean(selective_errors), 4)) if retained_count > 0 else 0.0
    selective_acc = float(round((1.0 - selective_risk) * 100.0, 2))

    # Per-class selective breakdown
    per_class_results = {}
    for c_idx, c_name in enumerate(CLASS_NAMES):
        mask = (test_labels == c_idx)
        total_c = int(np.sum(mask))
        ret_c = int(np.sum(mask & retained))
        err_c = int(np.sum((test_preds != test_labels) & mask & retained))
        per_class_results[c_name] = {
            "total": total_c,
            "retained": ret_c,
            "rejected": total_c - ret_c,
            "coverage": round(ret_c / max(1, total_c), 4),
            "selective_accuracy": round((1.0 - (err_c / max(1, ret_c))) * 100.0, 2),
        }

    # Print Comparative Performance Table
    print("\n" + "=" * 80)
    print(f"{'Method':<32} | {'Acc (%)':<8} | {'NLL':<8} | {'Brier':<8} | {'ECE (15b)':<10}")
    print("-" * 80)
    print(f"{'A. Original Softmax':<32} | {metrics_a['accuracy_percent']:<8} | {metrics_a['nll']:<8} | {metrics_a['brier_score']:<8} | {metrics_a['ece_uniform_15']:<10}")
    print(f"{'B. Temperature-Scaled':<32} | {metrics_b['accuracy_percent']:<8} | {metrics_b['nll']:<8} | {metrics_b['brier_score']:<8} | {metrics_b['ece_uniform_15']:<10}")
    print(f"{'C. MC-Dropout Mean (N=20)':<32} | {metrics_c['accuracy_percent']:<8} | {metrics_c['nll']:<8} | {metrics_c['brier_score']:<8} | {metrics_c['ece_uniform_15']:<10}")
    print(f"{'D. Scaled MC-Dropout (T_mc)':<32} | {metrics_d['accuracy_percent']:<8} | {metrics_d['nll']:<8} | {metrics_d['brier_score']:<8} | {metrics_d['ece_uniform_15']:<10}")
    print("=" * 80)

    print(f"\n[Selective Prediction on Test Data]")
    print(f"  Coverage            : {coverage * 100.0:.2f}% ({retained_count}/{len(test_labels)} retained)")
    print(f"  Rejected Samples    : {rejected_count}")
    print(f"  Selective Risk      : {selective_risk:.4f} (Selective Accuracy: {selective_acc:.2f}%)")
    print(f"  Overall Accuracy    : {metrics_b['accuracy_percent']:.2f}% -> Selective Accuracy: {selective_acc:.2f}% (+{selective_acc - metrics_b['accuracy_percent']:.2f}%)")

    # Save comprehensive results JSON
    results_payload = {
        "dataset": "Augmented Alzheimer MRI Dataset (OriginalDataset, 6400 samples)",
        "provenance": {
            "checkpoint_sha256": ckpt_hash,
            "architecture": "EfficientNet-B0 + Swin-Small hybrid (Linear(2048, 4))",
            "seed": 42,
            "splits": {
                "train_samples": len(splits["train"]),
                "val_calib_samples": len(splits["val_calib"]),
                "val_policy_samples": len(splits["val_policy"]),
                "test_samples": len(splits["test"]),
            },
            "temperatures": {
                "t_deterministic": t_det,
                "t_mc_dropout": t_mc,
            },
            "abstention_thresholds": policy_payload["thresholds"],
            "mc_passes": 20,
            "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        },
        "methods": {
            "method_a_original_softmax": metrics_a,
            "method_b_temperature_scaled": metrics_b,
            "method_c_mc_dropout_mean": metrics_c,
            "method_d_scaled_mc_dropout": metrics_d,
        },
        "selective_prediction": {
            "coverage": coverage,
            "selective_risk": selective_risk,
            "selective_accuracy": selective_acc,
            "retained_count": retained_count,
            "rejected_count": rejected_count,
            "per_class": per_class_results,
        },
    }

    eval_json_path = os.path.join(AI_SERVICE_DIR, "calibration", "evaluation_results.json")
    with open(eval_json_path, "w", encoding="utf-8") as f:
        json.dump(results_payload, f, indent=2)
    print(f"\nSaved full evaluation results to: {eval_json_path}")

    # Save reproducibility manifest
    manifest_path = os.path.join(AI_SERVICE_DIR, "calibration", "reproducibility_manifest.json")
    manifest = {
        "manifest_version": "1.0.0",
        "experiment_title": "NeuroScan AI Uncertainty Estimation and Probability Calibration",
        "checkpoint_sha256": ckpt_hash,
        "checkpoint_path": "models/best_hybrid_model.pth",
        "python_version": sys.version,
        "torch_version": torch.__version__,
        "dataset_source": "uraninjo/augmented-alzheimer-mri-dataset (OriginalDataset)",
        "dataset_total_samples": 6400,
        "class_mapping": {i: c for i, c in enumerate(CLASS_NAMES)},
        "splits": {
            "train": 5120,
            "val_calib": 320,
            "val_policy": 320,
            "test": 640,
        },
        "random_seed": 42,
        "mc_passes": 20,
        "learned_parameters": {
            "deterministic_temperature": t_det,
            "mc_dropout_temperature": t_mc,
        },
        "uncertainty_policy": policy_payload["thresholds"],
        "generated_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
    }
    with open(manifest_path, "w", encoding="utf-8") as f:
        json.dump(manifest, f, indent=2)
    print(f"Saved reproducibility manifest to: {manifest_path}")

    return results_payload


if __name__ == "__main__":
    run_full_calibration_experiment()

"""
Calibration Reconciliation and Temperature Invariant Regression Test Suite.
Verifies:
1. Exact temperature calibration parameters from temperature.json (T* = 1.2131, T_mc* = 1.1904).
2. Fallback to T = 1.0 when calibration artifacts are missing.
3. Mathematical monotonicity: temperature scaling preserves argmax class index for any T > 0.
4. Checkpoint SHA-256 invariant.
"""

import os
import json
import numpy as np
import torch

from calibration.temperature_scaling import (
    load_temperature,
    temperature_scale,
    validate_temperature,
    DEFAULT_TEMPERATURE,
)
from calibration.uncertainty_policy import load_uncertainty_policy


def test_temperature_json_parameters():
    """Verify temperature.json contains the exact documented Feature 1 values."""
    temp_data = load_temperature()
    assert temp_data["is_calibrated"] is True, "Expected is_calibrated=True when temperature.json is present"
    assert temp_data["deterministic_temperature"] == 1.2131, f"Expected 1.2131, got {temp_data['deterministic_temperature']}"
    assert temp_data["mc_dropout_temperature"] == 1.1904, f"Expected 1.1904, got {temp_data['mc_dropout_temperature']}"
    assert temp_data["fallback_reason"] is None


def test_temperature_fallback_to_one():
    """Verify fallback to T=1.0 (uncalibrated softmax) when artifact path is non-existent."""
    temp_data = load_temperature("/non/existent/path/temperature.json")
    assert temp_data["is_calibrated"] is False
    assert temp_data["deterministic_temperature"] == 1.0
    assert temp_data["mc_dropout_temperature"] == 1.0
    assert temp_data["fallback_reason"] == "FILE_NOT_FOUND"


def test_uncertainty_policy_thresholds():
    """Verify uncertainty_policy.json thresholds match frozen research invariants."""
    policy = load_uncertainty_policy()
    thresholds = policy.get("thresholds", {})
    assert np.isclose(thresholds["abstention_confidence_threshold"], 0.5347, atol=1e-3)
    assert np.isclose(thresholds["high_uncertainty_entropy_threshold"], 0.5798, atol=1e-3)


def test_temperature_scaling_preserves_class_rank():
    """Mathematical invariant: temperature scaling T > 0 strictly preserves class ranking and argmax."""
    logits = torch.tensor([[2.5, 0.1, -1.2, 0.8]])
    original_probs = torch.softmax(logits, dim=-1)
    original_pred = torch.argmax(original_probs, dim=-1).item()

    # Scale with T = 1.2131
    scaled_probs = temperature_scale(logits, temperature=1.2131)
    scaled_pred = torch.argmax(scaled_probs, dim=-1).item()

    assert original_pred == scaled_pred, "Temperature scaling altered top predicted class!"
    # Scaling with T > 1.0 reduces peak confidence (entropy increases)
    assert scaled_probs[0, original_pred].item() < original_probs[0, original_pred].item()
    assert torch.isclose(scaled_probs.sum(), torch.tensor(1.0), atol=1e-5)


def test_checkpoint_sha256_invariant():
    """Verify model checkpoint hash strictly matches the invariant."""
    import hashlib
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    checkpoint_path = os.path.join(base_dir, "models", "best_hybrid_model.pth")
    assert os.path.isfile(checkpoint_path), "Model checkpoint file not found!"

    sha256_hash = hashlib.sha256()
    with open(checkpoint_path, "rb") as f:
        for byte_block in iter(lambda: f.read(65536), b""):
            sha256_hash.update(byte_block)
    
    assert sha256_hash.hexdigest() == "676fefe87d63ab727fe9b3451e94d86b056082651bbe858ca52bb56ae8fcdf06"


if __name__ == "__main__":
    test_temperature_json_parameters()
    test_temperature_fallback_to_one()
    test_uncertainty_policy_thresholds()
    test_temperature_scaling_preserves_class_rank()
    test_checkpoint_sha256_invariant()
    print("ALL CALIBRATION RECONCILIATION TESTS PASSED!")

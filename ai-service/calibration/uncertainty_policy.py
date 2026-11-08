"""
Validation-Derived Confidence and Uncertainty Abstention Policy.
Evaluates research predictions across 5 distinct states:
- 'normal': Normal research prediction within reliable calibration envelope
- 'low_confidence': Top calibrated probability is below the statistical warning threshold
- 'high_uncertainty': Predictive entropy exceeds the 90th percentile of reliable validation predictions
- 'abstained': Sample falls outside the selective risk threshold (low confidence or critical entropy)
- 'calibration_unavailable': Temperature calibration data is missing or invalid
"""

import os
import json
import logging

logger = logging.getLogger("NeuroScanAI.UncertaintyPolicy")

# Fallback default thresholds if uncertainty_policy.json is not yet generated
DEFAULT_POLICY = {
    "version": "1.0.0",
    "method": "risk_coverage_selective_prediction",
    "target_selective_risk": 0.05,
    "thresholds": {
        "abstention_confidence_threshold": 0.65,
        "low_confidence_threshold": 0.80,
        "high_uncertainty_entropy_threshold": 0.55,
        "critical_abstention_entropy_threshold": 0.95,
    },
    "states": [
        "normal",
        "low_confidence",
        "high_uncertainty",
        "abstained",
        "calibration_unavailable",
    ],
}


def load_uncertainty_policy(filepath: str = None) -> dict:
    """
    Safely loads validation-derived uncertainty policy from JSON file.
    Falls back gracefully to default policy with a logged warning if missing.
    """
    if filepath is None:
        base_dir = os.path.dirname(os.path.abspath(__file__))
        filepath = os.path.join(base_dir, "uncertainty_policy.json")

    if not os.path.isfile(filepath):
        logger.warning(
            f"Uncertainty policy file not found at '{filepath}'. Using default conservative research thresholds."
        )
        return DEFAULT_POLICY

    try:
        with open(filepath, "r", encoding="utf-8") as f:
            data = json.load(f)
        if not isinstance(data, dict) or "thresholds" not in data:
            raise ValueError("Invalid schema: 'thresholds' object required.")
        return data
    except Exception as err:
        logger.warning(f"Error loading uncertainty policy '{filepath}': {err}. Using default policy.")
        return DEFAULT_POLICY


def evaluate_uncertainty_policy(
    calibrated_probabilities: dict,
    predictive_entropy: float = None,
    is_calibrated: bool = True,
    policy: dict = None,
) -> dict:
    """
    Evaluates prediction against empirical validation thresholds.
    Distinguishes: normal, low_confidence, high_uncertainty, abstained, calibration_unavailable.
    Returns:
        dict: {
            "uncertainty_status": str,
            "is_abstained": bool,
            "abstention_reason": str or None,
            "applied_thresholds": dict
        }
    """
    if not is_calibrated:
        return {
            "uncertainty_status": "calibration_unavailable",
            "is_abstained": False,
            "abstention_reason": None,
            "applied_thresholds": {},
        }

    if policy is None:
        policy = load_uncertainty_policy()

    thresholds = policy.get("thresholds", DEFAULT_POLICY["thresholds"])
    tau_abstain_conf = float(thresholds.get("abstention_confidence_threshold", 0.65))
    tau_low_conf = float(thresholds.get("low_confidence_threshold", 0.80))
    tau_high_entropy = float(thresholds.get("high_uncertainty_entropy_threshold", 0.55))
    tau_abstain_entropy = float(thresholds.get("critical_abstention_entropy_threshold", 0.95))

    # Determine top calibrated confidence
    probs_vals = list(calibrated_probabilities.values())
    top_conf = max(probs_vals) if probs_vals else 0.0

    entropy_val = predictive_entropy if predictive_entropy is not None else 0.0

    # 1. Check Abstention condition (critical low confidence or critical high entropy)
    conf_below_abstain = top_conf < tau_abstain_conf
    entropy_above_abstain = (predictive_entropy is not None) and (entropy_val > tau_abstain_entropy)

    if conf_below_abstain or entropy_above_abstain:
        reasons = []
        if conf_below_abstain:
            reasons.append(
                f"Calibrated probability ({top_conf * 100:.1f}%) is below the selective risk abstention threshold ({tau_abstain_conf * 100:.1f}%)"
            )
        if entropy_above_abstain:
            reasons.append(
                f"Predictive entropy ({entropy_val:.3f}) exceeds critical limit ({tau_abstain_entropy:.3f})"
            )

        return {
            "uncertainty_status": "abstained",
            "is_abstained": True,
            "abstention_reason": "; ".join(reasons) + ". Model abstains from presenting an accepted research classification.",
            "applied_thresholds": thresholds,
        }

    # 2. Check Low Confidence condition
    if top_conf < tau_low_conf:
        return {
            "uncertainty_status": "low_confidence",
            "is_abstained": False,
            "abstention_reason": None,
            "applied_thresholds": thresholds,
        }

    # 3. Check High Uncertainty (Entropy) condition
    if (predictive_entropy is not None) and (entropy_val > tau_high_entropy):
        return {
            "uncertainty_status": "high_uncertainty",
            "is_abstained": False,
            "abstention_reason": None,
            "applied_thresholds": thresholds,
        }

    # 4. Normal research prediction within reliable calibration envelope
    return {
        "uncertainty_status": "normal",
        "is_abstained": False,
        "abstention_reason": None,
        "applied_thresholds": thresholds,
    }

"""
Post-hoc Temperature Scaling for Multi-class Logit Calibration.
Applies P_i = softmax(z_i / T) where T > 0 is learned on a separate validation split.
Provides strict validation, safe fallback, and independent parameters for
deterministic and MC-Dropout inference modes.
"""

import os
import json
import logging
import numpy as np
import torch
import torch.nn.functional as F

logger = logging.getLogger("NeuroScanAI.Calibration")

DEFAULT_TEMPERATURE = 1.0
MIN_TEMPERATURE = 0.05
MAX_TEMPERATURE = 10.0


def validate_temperature(temperature: float, param_name: str = "temperature") -> float:
    """
    Strictly validates that temperature is a positive, finite, bounded float.
    Raises ValueError on violation.
    """
    if temperature is None:
        raise ValueError(f"{param_name} cannot be None.")
    try:
        t = float(temperature)
    except (TypeError, ValueError) as err:
        raise ValueError(f"{param_name} must be a valid float, got: {temperature}") from err

    if np.isnan(t) or np.isinf(t):
        raise ValueError(f"{param_name} must be a finite float, got: {t}")
    if t <= 0.0:
        raise ValueError(f"{param_name} must be strictly positive (> 0), got: {t}")
    if not (MIN_TEMPERATURE <= t <= MAX_TEMPERATURE):
        raise ValueError(
            f"{param_name} must be within [{MIN_TEMPERATURE}, {MAX_TEMPERATURE}], got: {t}"
        )
    return t


def temperature_scale(logits, temperature: float = DEFAULT_TEMPERATURE):
    """
    Scales logits by positive temperature T and computes softmax probabilities.
    Accepts torch.Tensor or numpy.ndarray.
    Formula: P_i = softmax(z_i / T)
    """
    t = validate_temperature(temperature, "temperature")

    if isinstance(logits, torch.Tensor):
        scaled = logits / t
        return F.softmax(scaled, dim=-1)
    elif isinstance(logits, np.ndarray):
        scaled = logits / t
        # Numerically stable softmax
        shift = scaled - np.max(scaled, axis=-1, keepdims=True)
        exp_vals = np.exp(shift)
        return exp_vals / np.sum(exp_vals, axis=-1, keepdims=True)
    elif isinstance(logits, (list, tuple)):
        arr = np.array(logits, dtype=np.float32)
        return temperature_scale(arr, temperature=t).tolist()
    else:
        raise TypeError(f"Unsupported logits type: {type(logits)}")


def fit_temperature(logits, labels, initial_t: float = 1.5):
    """
    Fits positive temperature parameter T by minimizing cross-entropy (Negative Log-Likelihood)
    over a validation dataset split.
    Guarantees optimization is bounded to [MIN_TEMPERATURE, MAX_TEMPERATURE].
    Returns:
        dict: {
            "temperature": float,
            "nll_before": float,
            "nll_after": float,
            "converged": bool,
            "iterations": int
        }
    """
    if isinstance(logits, torch.Tensor):
        z = logits.detach().cpu().numpy().astype(np.float64)
    else:
        z = np.asarray(logits, dtype=np.float64)

    if isinstance(labels, torch.Tensor):
        y = labels.detach().cpu().numpy().astype(np.int64)
    else:
        y = np.asarray(labels, dtype=np.int64)

    assert len(z) == len(y), f"Logits count ({len(z)}) does not match labels count ({len(y)})"
    assert len(z) > 0, "Cannot fit temperature on empty dataset."

    # Compute uncalibrated NLL (T = 1.0)
    p_uncal = temperature_scale(z, temperature=1.0)
    nll_before = float(-np.mean(np.log(np.clip(p_uncal[np.arange(len(y)), y], 1e-12, 1.0))))

    def nll_objective(t_val):
        if t_val <= 0.0:
            return 1e9
        p = temperature_scale(z, temperature=t_val)
        eps = 1e-12
        picked = np.clip(p[np.arange(len(y)), y], eps, 1.0)
        return float(-np.mean(np.log(picked)))

    # Bounded scalar minimization (Brent's method)
    try:
        from scipy.optimize import minimize_scalar
    except ImportError as err:
        raise ImportError("scipy is required for fitting temperature. Please install scipy.") from err

    res = minimize_scalar(
        nll_objective,
        bounds=(MIN_TEMPERATURE, MAX_TEMPERATURE),
        method="bounded",
        options={"xatol": 1e-5, "maxiter": 100},
    )

    fitted_t = validate_temperature(float(res.x), "fitted_temperature")
    nll_after = float(res.fun)

    return {
        "temperature": round(fitted_t, 4),
        "nll_before": round(nll_before, 6),
        "nll_after": round(nll_after, 6),
        "converged": bool(res.success),
        "iterations": int(res.nfev),
    }


def save_temperature(filepath: str, temperature_data: dict):
    """
    Serializes temperature calibration parameters to JSON with schema validation.
    """
    os.makedirs(os.path.dirname(os.path.abspath(filepath)), exist_ok=True)
    with open(filepath, "w", encoding="utf-8") as f:
        json.dump(temperature_data, f, indent=2)
    logger.info(f"Saved temperature calibration data to: {filepath}")


def load_temperature(filepath: str = None):
    """
    Safely loads temperature parameters from JSON file.
    Validates schema and numeric bounds.
    Falls back gracefully to T=1.0 uncalibrated mode if file is missing or invalid.
    Returns:
        dict: {
            "is_calibrated": bool,
            "deterministic_temperature": float,
            "mc_dropout_temperature": float,
            "metadata": dict,
            "fallback_reason": str or None
        }
    """
    if filepath is None:
        base_dir = os.path.dirname(os.path.abspath(__file__))
        filepath = os.path.join(base_dir, "temperature.json")

    fallback_result = {
        "is_calibrated": False,
        "deterministic_temperature": DEFAULT_TEMPERATURE,
        "mc_dropout_temperature": DEFAULT_TEMPERATURE,
        "metadata": {},
        "fallback_reason": None,
    }

    if not os.path.isfile(filepath):
        msg = f"Temperature calibration file not found at '{filepath}'. Falling back to original uncalibrated inference (T=1.0)."
        logger.warning(msg)
        fallback_result["fallback_reason"] = "FILE_NOT_FOUND"
        return fallback_result

    try:
        with open(filepath, "r", encoding="utf-8") as f:
            data = json.load(f)

        if not isinstance(data, dict):
            raise ValueError(f"Root JSON must be object, got: {type(data)}")

        # Extract deterministic temperature
        det_t_raw = data.get("deterministic", {}).get("temperature")
        if det_t_raw is None:
            # Check legacy root format
            det_t_raw = data.get("temperature")
        det_t = validate_temperature(det_t_raw, "deterministic.temperature")

        # Extract MC-Dropout temperature (may be distinct)
        mc_t_raw = data.get("mc_dropout", {}).get("temperature", det_t)
        mc_t = validate_temperature(mc_t_raw, "mc_dropout.temperature")

        version = data.get("version", "1.0.0")

        return {
            "is_calibrated": True,
            "deterministic_temperature": det_t,
            "mc_dropout_temperature": mc_t,
            "version": version,
            "metadata": data,
            "fallback_reason": None,
        }

    except Exception as err:
        msg = f"Invalid temperature calibration parameter in '{filepath}': {err}. Safely falling back to uncalibrated inference (T=1.0)."
        logger.warning(msg)
        fallback_result["fallback_reason"] = f"INVALID_PARAMETER: {err}"
        return fallback_result

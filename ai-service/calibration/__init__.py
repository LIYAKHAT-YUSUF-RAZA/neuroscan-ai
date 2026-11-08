"""
NeuroScan AI Calibration and Uncertainty Estimation Package.
Provides post-hoc temperature scaling, Monte Carlo Dropout uncertainty estimation,
and validation-derived selective prediction abstention policy.
"""

from .temperature_scaling import (
    temperature_scale,
    fit_temperature,
    load_temperature,
    save_temperature,
    DEFAULT_TEMPERATURE,
)
from .mc_dropout import (
    run_mc_dropout,
    verify_mc_dropout_equivalence,
)
from .calibration_metrics import (
    compute_ece,
    compute_brier_score,
    compute_nll,
    compute_risk_coverage_curve,
    bootstrap_confidence_intervals,
)

__all__ = [
    "temperature_scale",
    "fit_temperature",
    "load_temperature",
    "save_temperature",
    "DEFAULT_TEMPERATURE",
    "run_mc_dropout",
    "verify_mc_dropout_equivalence",
    "compute_ece",
    "compute_brier_score",
    "compute_nll",
    "compute_risk_coverage_curve",
    "bootstrap_confidence_intervals",
]

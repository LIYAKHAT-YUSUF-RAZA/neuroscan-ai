"""
Calibration and Uncertainty Evaluation Metrics.
Implements:
- Expected Calibration Error (ECE) with uniform and adaptive binning
- Multi-class Brier Score (raw and normalized)
- Multi-class Negative Log-Likelihood (NLL)
- Selective Risk and Risk-Coverage Curves
- Non-parametric Percentile Bootstrap Confidence Intervals
"""

import numpy as np


def compute_ece(probabilities, labels, n_bins=15, adaptive=False):
    """
    Computes top-1 Expected Calibration Error (ECE).
    Formula: ECE = sum_{b=1}^B (n_b / N) * |acc(B_b) - conf(B_b)|

    Args:
        probabilities: (N, K) array of predicted probabilities
        labels: (N,) array of true integer class labels
        n_bins: int, number of calibration bins (default 15)
        adaptive: bool, whether to use equal-frequency adaptive quantile binning

    Returns:
        dict: {
            "ece": float,
            "max_calibration_error": float,
            "bin_accuracies": list of float,
            "bin_confidences": list of float,
            "bin_counts": list of int,
            "bin_edges": list of float
        }
    """
    probs = np.asarray(probabilities, dtype=np.float64)
    y_true = np.asarray(labels, dtype=np.int64)
    N = len(y_true)
    assert N > 0, "Cannot compute ECE on empty inputs."

    preds = np.argmax(probs, axis=-1)
    confs = np.max(probs, axis=-1)
    correct = (preds == y_true).astype(np.float64)

    if adaptive:
        # Quantile-based equal-frequency binning
        quantiles = np.linspace(0.0, 1.0, n_bins + 1)
        bin_edges = np.percentile(confs, quantiles * 100)
        bin_edges[0] = 0.0
        bin_edges[-1] = 1.0
        # Ensure monotonically increasing
        bin_edges = np.unique(bin_edges)
        if len(bin_edges) < 2:
            bin_edges = np.linspace(0.0, 1.0, n_bins + 1)
    else:
        # Standard uniform binning [0, 1/B, 2/B, ..., 1]
        bin_edges = np.linspace(0.0, 1.0, n_bins + 1)

    actual_bins = len(bin_edges) - 1
    bin_accs = []
    bin_confs = []
    bin_counts = []
    ece = 0.0
    mce = 0.0

    for i in range(actual_bins):
        low = bin_edges[i]
        high = bin_edges[i + 1]
        if i == actual_bins - 1:
            in_bin = (confs >= low) & (confs <= high)
        else:
            in_bin = (confs >= low) & (confs < high)

        count = int(np.sum(in_bin))
        bin_counts.append(count)

        if count > 0:
            bin_acc = float(np.mean(correct[in_bin]))
            bin_conf = float(np.mean(confs[in_bin]))
            bin_accs.append(bin_acc)
            bin_confs.append(bin_conf)

            gap = abs(bin_acc - bin_conf)
            ece += (count / N) * gap
            mce = max(mce, gap)
        else:
            bin_accs.append(0.0)
            bin_confs.append((low + high) / 2.0)

    return {
        "ece": float(round(ece, 6)),
        "max_calibration_error": float(round(mce, 6)),
        "bin_accuracies": [float(round(v, 4)) for v in bin_accs],
        "bin_confidences": [float(round(v, 4)) for v in bin_confs],
        "bin_counts": bin_counts,
        "bin_edges": [float(round(v, 4)) for v in bin_edges.tolist()],
    }


def compute_brier_score(probabilities, labels):
    """
    Computes multi-class Brier score.
    Formula: BS = (1/N) * sum_{i=1}^N sum_{k=1}^K (p_{ik} - y_{ik})^2
    Range: [0, 2] for multi-class; lower is better.
    Also returns normalized Brier score: BS / 2 in [0, 1].
    """
    probs = np.asarray(probabilities, dtype=np.float64)
    y_true = np.asarray(labels, dtype=np.int64)
    N, K = probs.shape

    # One-hot encode ground truth
    one_hot = np.zeros((N, K), dtype=np.float64)
    one_hot[np.arange(N), y_true] = 1.0

    squared_diffs = np.sum((probs - one_hot) ** 2, axis=1)
    bs = float(np.mean(squared_diffs))

    return {
        "brier_score": float(round(bs, 6)),
        "normalized_brier_score": float(round(bs / 2.0, 6)),
    }


def compute_nll(probabilities, labels, eps=1e-12):
    """
    Computes multi-class Negative Log-Likelihood (cross-entropy loss).
    Formula: NLL = -(1/N) * sum_{i=1}^N log(p_{i, y_i} + eps)
    """
    probs = np.asarray(probabilities, dtype=np.float64)
    y_true = np.asarray(labels, dtype=np.int64)
    N = len(y_true)

    true_class_probs = np.clip(probs[np.arange(N), y_true], eps, 1.0)
    nll = float(-np.mean(np.log(true_class_probs)))

    return float(round(nll, 6))


def compute_risk_coverage_curve(probabilities, labels, n_thresholds=100):
    """
    Computes selective risk (empirical error rate) as a function of coverage percentage
    when rejecting samples with low confidence.

    Args:
        probabilities: (N, K) array of probabilities
        labels: (N,) array of true labels
        n_thresholds: int, resolution of coverage steps

    Returns:
        dict: {
            "coverages": list of float in [0.0, 1.0],
            "selective_risks": list of float,
            "aurc": float (Area Under Risk-Coverage Curve),
            "retained_counts": list of int
        }
    """
    probs = np.asarray(probabilities, dtype=np.float64)
    y_true = np.asarray(labels, dtype=np.int64)
    N = len(y_true)

    preds = np.argmax(probs, axis=-1)
    confs = np.max(probs, axis=-1)
    errors = (preds != y_true).astype(np.float64)

    # Sort descending by confidence
    sort_idx = np.argsort(-confs)
    sorted_errors = errors[sort_idx]

    coverages = []
    selective_risks = []
    retained_counts = []

    # Evaluate at percentiles of coverage from 10% to 100%
    percentiles = np.linspace(0.1, 1.0, n_thresholds)
    for cov in percentiles:
        k = max(1, int(round(cov * N)))
        sub_errors = sorted_errors[:k]
        risk = float(np.mean(sub_errors))

        coverages.append(float(round(cov, 4)))
        selective_risks.append(float(round(risk, 6)))
        retained_counts.append(k)

    # Area Under Risk-Coverage Curve (trapezoidal integration compatible with NumPy 2.x)
    try:
        trapz_fn = getattr(np, "trapezoid", getattr(np, "trapz", None))
        if trapz_fn is None:
            from scipy.integrate import trapezoid as trapz_fn
        aurc = float(trapz_fn(selective_risks, coverages))
    except Exception:
        # Fallback simple trapezoidal sum
        cov_arr = np.array(coverages)
        risk_arr = np.array(selective_risks)
        aurc = float(np.sum(0.5 * (risk_arr[:-1] + risk_arr[1:]) * np.diff(cov_arr)))

    return {
        "coverages": coverages,
        "selective_risks": selective_risks,
        "aurc": float(round(aurc, 6)),
        "retained_counts": retained_counts,
    }


def bootstrap_confidence_intervals(metric_fn, probabilities, labels, n_bootstraps=1000, alpha=0.05, seed=42):
    """
    Calculates non-parametric percentile bootstrap 95% confidence intervals.
    """
    rng = np.random.RandomState(seed)
    N = len(labels)
    values = []

    for _ in range(n_bootstraps):
        idx = rng.randint(0, N, size=N)
        val = metric_fn(probabilities[idx], labels[idx])
        values.append(val)

    low = float(np.percentile(values, 100.0 * (alpha / 2.0)))
    high = float(np.percentile(values, 100.0 * (1.0 - alpha / 2.0)))
    mean_val = float(np.mean(values))

    return {
        "mean": float(round(mean_val, 6)),
        "ci_lower": float(round(low, 6)),
        "ci_upper": float(round(high, 6)),
        "confidence_level": 1.0 - alpha,
    }

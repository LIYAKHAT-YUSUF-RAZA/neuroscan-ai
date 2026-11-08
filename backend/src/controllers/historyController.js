const mongoose = require('mongoose');
const Prediction = require('../models/Prediction');
const MriScan = require('../models/MriScan');
const { getDBStatus } = require('../config/db');
const { getAuthenticatedPatientId } = require('../middlewares/auth');

const CANONICAL_CLASSES = ['MildDemented', 'ModerateDemented', 'NonDemented', 'VeryMildDemented'];

const getHistory = async (req, res, next) => {
  try {
    if (!getDBStatus()) {
      return res.status(200).json({
        data: [],
        count: 0,
        dbConnected: false,
        message: 'Database is in optional/disconnected mode. History persistence is offline.',
      });
    }

    const patientId = getAuthenticatedPatientId(req);
    const query = patientId ? { patientId } : {};

    const limit = Math.min(parseInt(req.query.limit, 10) || 50, 100);
    const records = await Prediction.find(query)
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();

    res.status(200).json({
      data: records,
      count: records.length,
      dbConnected: true,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/history/longitudinal
 * Returns chronological MRI evaluation timeline strictly scoped to the authenticated patient.
 * Excludes Out-of-Distribution (OOD) rejections from valid research charts.
 */
const getLongitudinalHistory = async (req, res, next) => {
  try {
    if (!getDBStatus()) {
      return res.status(200).json({ success: true, evaluations: [], count: 0, dbConnected: false });
    }

    const patientId = getAuthenticatedPatientId(req);
    if (!patientId) {
      return res.status(401).json({ success: false, error: 'Authentication required. No patient context resolved.' });
    }

    // Exclude OOD scans from valid progression and research charts
    const records = await Prediction.find({
      patientId,
      isOod: { $ne: true },
      predictedClass: { $ne: 'Out-of-Distribution' },
    })
      .sort({ createdAt: 1 }) // Chronological ascending for timeline/progression chart
      .lean();

    // Map patient scans to resolve scanId if missing on older predictions or reanalyses
    const patientScans = await MriScan.find({ patientId, scanStatus: 'active' }).lean();
    const scanByPredictionId = new Map();
    for (const s of patientScans) {
      if (s.latestPredictionId) {
        scanByPredictionId.set(String(s.latestPredictionId), s.scanId);
      }
    }

    const evaluations = records.map((rec) => {
      let resolvedScanId = rec.scanId || null;
      if (!resolvedScanId && scanByPredictionId.has(String(rec._id))) {
        resolvedScanId = scanByPredictionId.get(String(rec._id));
      }
      if (!resolvedScanId && rec.previousEvaluationId) {
        const prevRec = records.find((r) => String(r._id) === String(rec.previousEvaluationId));
        if (prevRec && prevRec.scanId) {
          resolvedScanId = prevRec.scanId;
        }
      }

      const topProb = rec.probabilities && rec.predictedClass
        ? Number(rec.probabilities[rec.predictedClass])
        : rec.confidence || null;

      return {
        id: rec._id,
        scanId: resolvedScanId,
        evaluationType: rec.evaluationType || 'original',
        createdAt: rec.createdAt,
        scanDate: rec.scanDate || rec.createdAt,
        predictedClass: rec.predictedClass,
        stageNumber: rec.stageNumber || 1,
        stageLabel: rec.stageLabel,
        displayLabel: rec.displayLabel || rec.stageLabel,
        probabilities: rec.probabilities || null,
        topProbability: topProb,
        uncertainty: rec.uncertainty || { status: 'normal' },
        originalFilename: rec.originalFilename,
        hasHeatmaps: rec.hasHeatmaps,
        previousEvaluationId: rec.previousEvaluationId,
      };
    });

    res.status(200).json({
      success: true,
      evaluations,
      count: evaluations.length,
      patientId,
      disclaimer:
        'These longitudinal research records reflect experimental model evaluations across separate MRI sessions and do not constitute clinical diagnosis or validated disease progression measurements.',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/history/compare?eval1=:id1&eval2=:id2
 * Compares two distinct evaluations belonging to the authenticated patient.
 * Computes probability differences, category shifts, and enforces scientific non-progression notice.
 */
const compareEvaluations = async (req, res, next) => {
  try {
    const { eval1, eval2 } = req.query;
    if (!eval1 || !eval2) {
      return res.status(400).json({ success: false, error: "Missing required query parameters 'eval1' and 'eval2'." });
    }

    if (!mongoose.Types.ObjectId.isValid(eval1) || !mongoose.Types.ObjectId.isValid(eval2)) {
      return res.status(400).json({
        success: false,
        error: "Invalid evaluation ID format. Parameters 'eval1' and 'eval2' must be valid MongoDB ObjectIds.",
      });
    }

    const patientId = getAuthenticatedPatientId(req);
    if (!patientId) {
      return res.status(401).json({ success: false, error: 'Authentication required to compare evaluations.' });
    }

    const [rec1, rec2] = await Promise.all([
      Prediction.findById(eval1).lean(),
      Prediction.findById(eval2).lean(),
    ]);

    if (!rec1 || !rec2) {
      return res.status(404).json({ success: false, error: 'One or both evaluations were not found.' });
    }

    // Strict patient-level isolation: caller must be authorized to access both evaluations
    const isOwner1 = rec1.patientId === patientId;
    const isOwner2 = rec2.patientId === patientId;
    const isPrivileged = req.user && (req.user.role === 'researcher' || req.user.role === 'clinician');

    if ((!isOwner1 || !isOwner2) && !isPrivileged) {
      return res.status(403).json({
        success: false,
        error: 'Access denied: You are not authorized to compare evaluations from other patient records.',
      });
    }

    // If privileged user has an explicit target patient context specified, verify it matches
    const explicitTargetPatientId =
      req.headers['x-target-patient-id'] ||
      req.headers['x-patient-id'] ||
      (req.query && req.query.patientId ? String(req.query.patientId).trim() : null);

    if (explicitTargetPatientId && (rec1.patientId !== explicitTargetPatientId || rec2.patientId !== explicitTargetPatientId)) {
      return res.status(403).json({
        success: false,
        error: 'Access denied: Evaluations do not belong to the selected active patient.',
      });
    }

    // Reject cross-patient comparisons: longitudinal comparison is strictly intra-patient
    if (rec1.patientId !== rec2.patientId) {
      return res.status(400).json({
        success: false,
        error: 'Cross-patient comparison is invalid: Evaluations belong to different patients.',
      });
    }

    // Determine baseline (earlier) vs comparison (later)
    const isRec1Earlier = new Date(rec1.createdAt) <= new Date(rec2.createdAt);
    const baseline = isRec1Earlier ? rec1 : rec2;
    const comparison = isRec1Earlier ? rec2 : rec1;

    // Compute probability deltas across all classes
    const probabilityDeltas = {};
    if (baseline.probabilities && comparison.probabilities) {
      for (const cls of CANONICAL_CLASSES) {
        const pBase = baseline.probabilities[cls] || 0;
        const pComp = comparison.probabilities[cls] || 0;
        probabilityDeltas[cls] = Number((pComp - pBase).toFixed(4));
      }
    }

    // Retrieve corresponding MriScan storage references if available
    let baseScanId = baseline.scanId || null;
    let compScanId = comparison.scanId || null;

    if (!baseScanId) {
      const scanDoc = await MriScan.findOne({ latestPredictionId: baseline._id }).lean();
      if (scanDoc) baseScanId = scanDoc.scanId;
      else if (baseline.previousEvaluationId) {
        const prev = await Prediction.findById(baseline.previousEvaluationId).lean();
        if (prev && prev.scanId) baseScanId = prev.scanId;
      }
    }

    if (!compScanId) {
      const scanDoc = await MriScan.findOne({ latestPredictionId: comparison._id }).lean();
      if (scanDoc) compScanId = scanDoc.scanId;
      else if (comparison.previousEvaluationId) {
        const prev = await Prediction.findById(comparison.previousEvaluationId).lean();
        if (prev && prev.scanId) compScanId = prev.scanId;
      }
    }

    const baselineData = {
      id: baseline._id,
      scanId: baseScanId,
      evaluationType: baseline.evaluationType || 'original',
      createdAt: baseline.createdAt,
      scanDate: baseline.scanDate || baseline.createdAt,
      predictedClass: baseline.predictedClass,
      stageNumber: baseline.stageNumber || 1,
      displayLabel: baseline.displayLabel || baseline.stageLabel,
      probabilities: baseline.probabilities,
      uncertainty: baseline.uncertainty || { status: 'normal' },
      originalFilename: baseline.originalFilename,
      imageUrl: baseScanId ? `/api/scans/${baseScanId}/image` : null,
      heatmaps: baseline.heatmaps || null,
    };

    const comparisonData = {
      id: comparison._id,
      scanId: compScanId,
      evaluationType: comparison.evaluationType || 'original',
      createdAt: comparison.createdAt,
      scanDate: comparison.scanDate || comparison.createdAt,
      predictedClass: comparison.predictedClass,
      stageNumber: comparison.stageNumber || 1,
      displayLabel: comparison.displayLabel || comparison.stageLabel,
      probabilities: comparison.probabilities,
      uncertainty: comparison.uncertainty || { status: 'normal' },
      originalFilename: comparison.originalFilename,
      imageUrl: compScanId ? `/api/scans/${compScanId}/image` : null,
      heatmaps: comparison.heatmaps || null,
    };

    const scientificDisclaimer =
      'These comparisons show differences in research model outputs and are not clinically validated measurements of disease progression.';

    return res.status(200).json({
      success: true,
      comparison: {
        baseline: baselineData,
        comparison: comparisonData,
        evaluationA: baselineData,
        evaluationB: comparisonData,
        probabilityDeltas,
        categoryShift: {
          fromCategory: baseline.displayLabel || baseline.stageLabel,
          toCategory: comparison.displayLabel || comparison.stageLabel,
          isCategoryChanged: baseline.predictedClass !== comparison.predictedClass,
        },
        scientificNotice: scientificDisclaimer,
        scientificDisclaimer,
      },
    });
  } catch (error) {
    next(error);
  }
};

const clearHistory = async (req, res, next) => {
  try {
    if (!getDBStatus()) {
      return res.status(503).json({ success: false, error: 'Database service is currently offline.' });
    }

    const patientId = req.patientId || getAuthenticatedPatientId(req);
    if (!patientId || typeof patientId !== 'string' || patientId.trim().length === 0) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required. An authenticated patient session or token is required to delete history records.',
      });
    }

    const cleanPatientId = patientId.trim();

    // Enforce patient data isolation: ordinary patients cannot delete other patients' history
    if (req.user && req.user.role === 'patient' && req.user.patientId !== cleanPatientId) {
      return res.status(403).json({
        success: false,
        error: 'Access denied: You are not authorized to delete another patient records.',
      });
    }

    // Strictly patient-scoped filter - never empty {}
    const filter = { patientId: cleanPatientId };

    const result = await Prediction.deleteMany(filter);
    return res.status(200).json({
      success: true,
      message: `Prediction history cleared successfully for patient ${cleanPatientId}.`,
      deletedCount: result.deletedCount,
      patientId: cleanPatientId,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getHistory,
  getLongitudinalHistory,
  compareEvaluations,
  clearHistory,
};

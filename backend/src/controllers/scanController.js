const crypto = require('crypto');
const mongoose = require('mongoose');
const MriScan = require('../models/MriScan');
const Prediction = require('../models/Prediction');
const Patient = require('../models/Patient');
const NotificationPreference = require('../models/NotificationPreference');
const { saveScanImage, getScanImage, scanImageExists } = require('../services/storage');
const { forwardPredict } = require('../services/aiService');
const { getDBStatus } = require('../config/db');
const { getAuthenticatedPatientId } = require('../middlewares/auth');

/**
 * Validates that the authenticated user owns or is authorized to access the given scan.
 */
async function verifyScanOwnership(req, scan) {
  if (!scan) return false;

  const authPatientId = getAuthenticatedPatientId(req);
  if (!authPatientId) return false;

  // Patient role: strictly isolated to their own scans
  if (req.user && req.user.role === 'patient') {
    return scan.patientId === authPatientId;
  }

  // Clinician / Researcher role:
  // If target patient context is specified via header/query/body or req.patientId, strictly enforce matching that patient!
  const targetPatientId =
    req.headers['x-target-patient-id'] ||
    req.headers['x-patient-id'] ||
    (req.query && req.query.patientId ? String(req.query.patientId).trim() : null) ||
    (req.body && req.body.patientId ? String(req.body.patientId).trim() : null) ||
    req.patientId;

  if (targetPatientId) {
    return scan.patientId === targetPatientId;
  }

  // If no target patient was specified, clinician / researcher is authorized
  if (req.user && (req.user.role === 'researcher' || req.user.role === 'clinician')) {
    return true;
  }

  return scan.patientId === authPatientId;
}

/**
 * GET /api/scans
 * Lists all active scans for the authenticated patient in chronological order.
 */
const listPatientScans = async (req, res, next) => {
  try {
    if (!getDBStatus()) {
      return res.status(200).json({ success: true, scans: [], count: 0, dbConnected: false });
    }

    const patientId = getAuthenticatedPatientId(req);
    if (!patientId) {
      return res.status(401).json({ success: false, error: 'Authentication required. No patient context resolved.' });
    }

    const scans = await MriScan.find({ patientId, scanStatus: 'active' })
      .populate('latestPredictionId')
      .sort({ scanDate: -1, createdAt: -1 })
      .lean();

    return res.status(200).json({
      success: true,
      scans,
      count: scans.length,
      patientId,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/scans/:scanId
 * Retrieves detailed scan metadata and all linked analyses (original + reanalyses).
 */
const getScanDetails = async (req, res, next) => {
  try {
    const { scanId } = req.params;
    if (!scanId) {
      return res.status(400).json({ success: false, error: 'Missing required scanId parameter.' });
    }

    let scan = await MriScan.findOne({ scanId }).lean();
    if (!scan && mongoose.Types.ObjectId.isValid(scanId)) {
      const pred = await Prediction.findById(scanId).lean();
      if (pred && pred.scanId) {
        scan = await MriScan.findOne({ scanId: pred.scanId }).lean();
      }
    }
    if (!scan) {
      return res.status(404).json({ success: false, error: `Scan '${scanId}' was not found.` });
    }

    const authPatientId = getAuthenticatedPatientId(req);
    if (!authPatientId) {
      return res.status(401).json({ success: false, error: 'Authentication required. No patient context resolved.' });
    }

    const isAuthorized = await verifyScanOwnership(req, scan);
    if (!isAuthorized) {
      return res.status(403).json({ success: false, error: 'Access denied: You are not authorized to view this scan.' });
    }

    // Retrieve all linked predictions for this scan
    const analyses = await Prediction.find({ scanId }).sort({ createdAt: -1 }).lean();

    return res.status(200).json({
      success: true,
      scan: {
        ...scan,
        analyses,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/scans/:scanId/image
 * Streams the authenticated original MRI image binary from persistent storage.
 */
const getScanImageStream = async (req, res, next) => {
  try {
    const { scanId } = req.params;
    if (!scanId) {
      return res.status(400).json({ success: false, error: 'Missing required scanId parameter.' });
    }

    let scan = await MriScan.findOne({ scanId }).lean();
    if (!scan && mongoose.Types.ObjectId.isValid(scanId)) {
      const pred = await Prediction.findById(scanId).lean();
      if (pred && pred.scanId) {
        scan = await MriScan.findOne({ scanId: pred.scanId }).lean();
      }
    }
    if (!scan) {
      return res.status(404).json({ success: false, error: `Scan '${scanId}' not found.` });
    }

    const authPatientId = getAuthenticatedPatientId(req);
    if (!authPatientId) {
      return res.status(401).json({ success: false, error: 'Authentication required. No patient context resolved.' });
    }

    const isAuthorized = await verifyScanOwnership(req, scan);
    if (!isAuthorized) {
      return res.status(403).json({ success: false, error: 'Access denied: You are not authorized to view this image.' });
    }

    const fileData = await getScanImage(scan.storageReference);

    res.setHeader('Content-Type', fileData.mimeType || 'image/png');
    res.setHeader('Content-Length', fileData.fileSize);
    res.setHeader('Cache-Control', 'private, max-age=86400'); // Cache for authorized client session
    return res.status(200).send(fileData.buffer);
  } catch (error) {
    if (error.code === 'ENOENT' || error.status === 404) {
      return res.status(404).json({
        success: false,
        error: 'The original MRI image file is unavailable in persistent storage. Please upload a new scan.',
      });
    }
    next(error);
  }
};

/**
 * POST /api/scans/:scanId/reanalyse
 * Reanalyses an existing stored MRI scan without requiring the patient to re-upload.
 * Preserves the original scan and previous predictions, creating a new linked Prediction.
 */
const reanalyseScan = async (req, res, next) => {
  try {
    const { scanId } = req.params;
    if (!scanId) {
      return res.status(400).json({ success: false, error: 'Missing required scanId parameter.' });
    }

    let scan = await MriScan.findOne({ scanId });
    if (!scan && mongoose.Types.ObjectId.isValid(scanId)) {
      const pred = await Prediction.findById(scanId).lean();
      if (pred && pred.scanId) {
        scan = await MriScan.findOne({ scanId: pred.scanId });
      } else {
        scan = await MriScan.findOne({ latestPredictionId: scanId });
      }
    }
    if (!scan) {
      return res.status(404).json({ success: false, error: `Scan '${scanId}' not found.` });
    }

    const authPatientId = getAuthenticatedPatientId(req);
    if (!authPatientId) {
      return res.status(401).json({ success: false, error: 'Authentication required. No patient context resolved.' });
    }

    const isAuthorized = await verifyScanOwnership(req, scan);
    if (!isAuthorized) {
      return res.status(403).json({ success: false, error: 'Access denied: You are not authorized to reanalyse this scan.' });
    }

    // Retrieve original MRI file binary securely from persistent storage
    let fileData;
    try {
      fileData = await getScanImage(scan.storageReference);
    } catch (storageErr) {
      return res.status(404).json({
        success: false,
        error: 'Original MRI image is unavailable in storage. Please upload a new scan to evaluate.',
      });
    }

    const includeHeatmaps = req.query.include_heatmaps !== 'false';

    // Forward existing stored image to PyTorch AI inference service
    const aiResult = await forwardPredict(
      fileData.buffer,
      scan.originalFilename,
      fileData.mimeType,
      includeHeatmaps
    );

    // Safeguard: OOD rejections must never create normal prediction history
    const isOod = Boolean(
      aiResult.isOOD ||
      aiResult.outOfDistribution ||
      aiResult.status === 'ood_rejected' ||
      aiResult.predictedClass === 'Out-of-Distribution'
    );

    let savedRecordId = null;
    let historySaved = false;
    const previousEvaluationId = scan.latestPredictionId || null;

    if (getDBStatus() && !isOod) {
      try {
        // Create a new Prediction record linked to the original scan
        const newRecord = await Prediction.create({
          patientId: scan.patientId,
          scanId: scan.scanId,
          originalFilename: scan.originalFilename,
          fileSize: fileData.fileSize,
          predictedClass: aiResult.predictedClass,
          stageLabel: aiResult.stageLabel,
          stageNumber: aiResult.stageNumber || 1,
          displayLabel: aiResult.displayLabel || aiResult.stageLabel,
          alertLevel: aiResult.alertLevel || 'info',
          probabilities: aiResult.probabilities,
          rawLogits: aiResult.rawLogits || [],
          hasHeatmaps: Boolean(aiResult.heatmaps),
          evaluationType: 'reanalysis',
          previousEvaluationId,
          scanDate: scan.scanDate,
          isOod: false,
          uncertainty: {
            status: aiResult.uncertainty?.status || 'normal',
            predictiveEntropy: aiResult.uncertainty?.predictiveEntropy || null,
            calibratedConfidence: aiResult.uncertainty?.calibratedConfidence || null,
          },
          heatmaps: {
            gradcam: aiResult.heatmaps?.gradcam || null,
            integratedGradients: aiResult.heatmaps?.integratedGradients || null,
          },
          disclaimerAcknowledged: true,
        });

        historySaved = true;
        savedRecordId = newRecord._id;

        // Update MriScan with latest prediction and increment analysisCount
        scan.latestPredictionId = newRecord._id;
        scan.analysisCount = (scan.analysisCount || 1) + 1;
        await scan.save();

        // Synchronize Patient & NotificationPreference records
        if (scan.patientId) {
          await Patient.findOneAndUpdate(
            { patientId: scan.patientId },
            {
              $set: {
                latestPredictionId: newRecord._id,
                latestScanId: scan.scanId,
                predictedStage: newRecord.stageNumber,
                predictedClass: newRecord.predictedClass,
                stageLabel: newRecord.stageLabel,
              },
            },
            { upsert: false }
          );

          await NotificationPreference.findOneAndUpdate(
            { patientId: scan.patientId },
            {
              $set: {
                hasEligiblePrediction: true,
                predictedStage: newRecord.stageNumber,
                predictedClass: newRecord.predictedClass,
                stageLabel: newRecord.stageLabel,
                lastPredictionDate: newRecord.createdAt,
              },
            },
            { upsert: false }
          );
        }
      } catch (dbErr) {
        console.warn(`[Reanalyse] Could not persist reanalysis record: ${dbErr.message}`);
      }
    }

    return res.status(200).json({
      success: true,
      ...aiResult,
      patientId: scan.patientId,
      scanId: scan.scanId,
      evaluationType: 'reanalysis',
      previousEvaluationId,
      historySaved,
      historyId: savedRecordId,
      _id: savedRecordId,
      id: savedRecordId,
      analysisCount: scan.analysisCount,
      reanalysedAt: new Date(),
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  listPatientScans,
  getScanDetails,
  getScanImageStream,
  reanalyseScan,
  verifyScanOwnership,
};

const crypto = require('crypto');
const { forwardPredict, forwardExplain } = require('../services/aiService');
const Prediction = require('../models/Prediction');
const MriScan = require('../models/MriScan');
const Patient = require('../models/Patient');
const NotificationPreference = require('../models/NotificationPreference');
const { saveScanImage } = require('../services/storage');
const { getDBStatus } = require('../config/db');
const { getAuthenticatedPatientId } = require('../middlewares/auth');

const handlePredict = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "Missing required 'image' file in upload." });
    }

    const includeHeatmaps = req.query.include_heatmaps !== 'false';
    const patientId = getAuthenticatedPatientId(req);
    const scanId = `scan_${crypto.randomBytes(8).toString('hex')}`;
    const evaluationType = req.body.evaluationType === 'follow_up' ? 'follow_up' : 'original';
    const visitDate = req.body.visitDate ? new Date(req.body.visitDate) : null;
    const visitNotes = req.body.visitNotes ? String(req.body.visitNotes).trim() : '';

    // 1. Persistently store the original MRI scan image
    let storageMeta = null;
    try {
      storageMeta = await saveScanImage(
        patientId,
        scanId,
        req.file.originalname,
        req.file.buffer,
        req.file.mimetype
      );
    } catch (storageErr) {
      console.warn(`[Storage] Warning: Persistent storage save encountered: ${storageErr.message}`);
    }

    // 2. Forward to AI inference service
    const aiResult = await forwardPredict(
      req.file.buffer,
      req.file.originalname,
      req.file.mimetype,
      includeHeatmaps
    );

    // 3. Persist to MongoDB if connected (resilient: failures do not block the prediction response)
    let historySaved = false;
    let savedRecordId = null;
    let savedScanId = null;

    // Clinical & Data Integrity Safeguard: OOD rejections must NEVER create normal prediction history
    const isOod = Boolean(
      aiResult.isOOD ||
      aiResult.outOfDistribution ||
      aiResult.status === 'ood_rejected' ||
      aiResult.predictedClass === 'Out-of-Distribution'
    );

    if (getDBStatus() && !isOod) {
      try {
        // Create MriScan record if storage succeeded
        if (storageMeta && patientId) {
          const scanDoc = await MriScan.create({
            scanId,
            patientId,
            originalFilename: req.file.originalname,
            storageReference: storageMeta.storageReference,
            mimeType: storageMeta.mimeType,
            fileSize: storageMeta.fileSize,
            fileHash: storageMeta.fileHash,
            scanDate: visitDate || new Date(),
            visitDate,
            visitNotes,
            scanStatus: 'active',
            analysisCount: 1,
          });
          savedScanId = scanDoc.scanId;
        }

        const record = await Prediction.create({
          patientId: patientId || null, // Never default to 'default-patient'
          scanId: savedScanId || scanId,
          originalFilename: req.file.originalname,
          fileSize: req.file.size,
          predictedClass: aiResult.predictedClass,
          stageLabel: aiResult.stageLabel,
          stageNumber: aiResult.stageNumber || 1,
          displayLabel: aiResult.displayLabel || aiResult.stageLabel,
          alertLevel: aiResult.alertLevel || 'info',
          probabilities: aiResult.probabilities,
          rawLogits: aiResult.rawLogits || [],
          hasHeatmaps: Boolean(aiResult.heatmaps),
          evaluationType,
          scanDate: visitDate || new Date(),
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
        savedRecordId = record._id;

        // Link latest prediction back to MriScan
        if (savedScanId) {
          await MriScan.updateOne({ scanId: savedScanId }, { $set: { latestPredictionId: record._id } });
        }

        // Synchronize stage in NotificationPreference & Patient ONLY after successful prediction save
        if (patientId) {
          await NotificationPreference.findOneAndUpdate(
            { patientId },
            {
              $set: {
                hasEligiblePrediction: true,
                predictedStage: record.stageNumber,
                predictedClass: record.predictedClass,
                stageLabel: record.stageLabel,
                lastPredictionDate: record.createdAt,
              },
            },
            { upsert: false }
          );

          await Patient.findOneAndUpdate(
            { patientId },
            {
              $set: {
                latestPredictionId: record._id,
                latestScanId: savedScanId || scanId,
                predictedStage: record.stageNumber,
                predictedClass: record.predictedClass,
                stageLabel: record.stageLabel,
              },
            },
            { upsert: false }
          );
        }
      } catch (dbErr) {
        console.warn(`[History] Could not save prediction/scan to database: ${dbErr.message}`);
      }
    }

    // Return complete payload to frontend
    res.status(200).json({
      success: true,
      ...aiResult,
      patientId,
      scanId: savedScanId || scanId,
      evaluationType,
      historySaved,
      historyId: savedRecordId,
      _id: savedRecordId,
      id: savedRecordId,
    });
  } catch (error) {
    next(error);
  }
};

const handleExplain = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "Missing required 'image' file in upload." });
    }

    const targetClass = req.body.target_class || req.query.target_class;
    const explainResult = await forwardExplain(
      req.file.buffer,
      req.file.originalname,
      req.file.mimetype,
      targetClass
    );

    res.status(200).json(explainResult);
  } catch (error) {
    next(error);
  }
};

module.exports = {
  handlePredict,
  handleExplain,
};

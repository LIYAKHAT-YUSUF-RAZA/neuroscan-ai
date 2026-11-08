const crypto = require('crypto');
const InferenceJob = require('../models/InferenceJob');
const Prediction = require('../models/Prediction');
const MriScan = require('../models/MriScan');
const Patient = require('../models/Patient');
const NotificationPreference = require('../models/NotificationPreference');
const { forwardPredict } = require('../services/aiService');
const { saveScanImage } = require('../services/storage');
const { getDBStatus } = require('../config/db');
const { getAuthenticatedPatientId } = require('../middlewares/auth');

/**
 * Enqueue a new asynchronous MRI inference job.
 * Returns HTTP 202 Accepted immediately.
 */
const enqueueJob = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "Missing required 'image' file in upload." });
    }

    const patientId = getAuthenticatedPatientId(req);
    const includeHeatmaps = req.query.include_heatmaps !== 'false';
    const jobId = `job_${crypto.randomBytes(12).toString('hex')}`;

    const job = await InferenceJob.create({
      jobId,
      patientId: patientId || null,
      originalFilename: req.file.originalname,
      fileSize: req.file.size,
      status: 'queued',
      progress: 0,
    });

    // Send HTTP 202 Accepted response immediately
    res.status(202).json({
      status: 'queued',
      jobId,
      pollUrl: `/api/jobs/${jobId}`,
      message: 'MRI scan accepted for asynchronous analysis.',
    });

    // Process job asynchronously in background
    const fileBuffer = Buffer.from(req.file.buffer);
    const filename = req.file.originalname;
    const mimetype = req.file.mimetype;

    setImmediate(async () => {
      try {
        await InferenceJob.updateOne(
          { jobId },
          {
            $set: {
              status: 'processing',
              startedAt: new Date(),
              progress: 20,
            },
          }
        );

        // Forward to PyTorch AI inference service
        const aiResult = await forwardPredict(
          fileBuffer,
          filename,
          mimetype,
          includeHeatmaps
        );

        let savedRecordId = null;
        let historySaved = false;

        // Clinical & Data Integrity Safeguard: OOD rejections must NEVER create normal prediction history
        const isOod = Boolean(
          aiResult.isOOD ||
          aiResult.outOfDistribution ||
          aiResult.status === 'ood_rejected' ||
          aiResult.predictedClass === 'Out-of-Distribution'
        );

        if (getDBStatus() && !isOod) {
          try {
            const scanId = `scan_${crypto.randomBytes(8).toString('hex')}`;
            let savedScanId = null;

            try {
              const storageMeta = await saveScanImage(patientId, scanId, filename, fileBuffer, mimetype);
              if (storageMeta && patientId) {
                const scanDoc = await MriScan.create({
                  scanId,
                  patientId,
                  originalFilename: filename,
                  storageReference: storageMeta.storageReference,
                  mimeType: storageMeta.mimeType,
                  fileSize: storageMeta.fileSize,
                  fileHash: storageMeta.fileHash,
                  scanDate: new Date(),
                  scanStatus: 'active',
                  analysisCount: 1,
                });
                savedScanId = scanDoc.scanId;
              }
            } catch (storageErr) {
              console.warn(`[JobStorage] Could not persist scan image: ${storageErr.message}`);
            }

            const record = await Prediction.create({
              patientId: patientId || null,
              scanId: savedScanId || scanId,
              originalFilename: filename,
              fileSize: fileBuffer.length,
              predictedClass: aiResult.predictedClass,
              stageLabel: aiResult.stageLabel,
              stageNumber: aiResult.stageNumber || 1,
              displayLabel: aiResult.displayLabel || aiResult.stageLabel,
              alertLevel: aiResult.alertLevel || 'info',
              probabilities: aiResult.probabilities,
              rawLogits: aiResult.rawLogits || [],
              hasHeatmaps: Boolean(aiResult.heatmaps),
              evaluationType: 'original',
              scanDate: new Date(),
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

            if (savedScanId) {
              await MriScan.updateOne({ scanId: savedScanId }, { $set: { latestPredictionId: record._id } });
            }

            historySaved = true;
            savedRecordId = record._id;

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
            console.warn(`[InferenceJob] Could not persist prediction to database: ${dbErr.message}`);
          }
        }

        const finalResult = {
          ...aiResult,
          historySaved,
          historyId: savedRecordId,
        };

        await InferenceJob.updateOne(
          { jobId },
          {
            $set: {
              status: 'completed',
              progress: 100,
              result: finalResult,
              completedAt: new Date(),
            },
          }
        );
      } catch (err) {
        console.error(`[InferenceJob] Execution failed for ${jobId}: ${err.message}`);
        await InferenceJob.updateOne(
          { jobId },
          {
            $set: {
              status: 'failed',
              progress: 0,
              error: err.message || 'Inference execution failed',
              completedAt: new Date(),
            },
          }
        );
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Retrieve status, progress, and result of an asynchronous MRI inference job.
 */
const getJobStatus = async (req, res, next) => {
  try {
    const { jobId } = req.params;
    const job = await InferenceJob.findOne({ jobId }).lean();

    if (!job) {
      return res.status(404).json({ error: `Inference job '${jobId}' not found.` });
    }

    // RBAC: Verify patient isolation
    const authenticatedPatientId = getAuthenticatedPatientId(req);
    const callerRole = req.user?.role || 'patient';

    if (callerRole !== 'researcher' && callerRole !== 'clinician') {
      if (job.patientId && authenticatedPatientId && job.patientId !== authenticatedPatientId) {
        return res.status(403).json({
          error: 'Forbidden: You do not have permission to view inference results for another patient.',
        });
      }
    }

    res.status(200).json({
      jobId: job.jobId,
      patientId: job.patientId,
      status: job.status,
      progress: job.progress,
      result: job.result,
      error: job.error,
      createdAt: job.createdAt,
      startedAt: job.startedAt,
      });
  } catch (error) {
    next(error);
  }
};

/**
 * Crash Recovery: Cleans up orphaned jobs that were left in 'queued' or 'processing'
 * state when the previous server process was terminated or restarted.
 */
const recoverStuckJobs = async () => {
  try {
    const result = await InferenceJob.updateMany(
      { status: { $in: ['queued', 'processing'] } },
      {
        $set: {
          status: 'failed',
          error: 'Job was interrupted by a server restart or process crash. Please resubmit the MRI scan.',
          completedAt: new Date(),
        },
      }
    );
    if (result.modifiedCount > 0) {
      console.log(`[InferenceJob] Crash recovery: Marked ${result.modifiedCount} interrupted jobs as failed.`);
    }
    return result.modifiedCount;
  } catch (err) {
    console.error(`[InferenceJob] Error recovering stuck jobs: ${err.message}`);
    return 0;
  }
};

module.exports = {
  enqueueJob,
  getJobStatus,
  recoverStuckJobs,
};


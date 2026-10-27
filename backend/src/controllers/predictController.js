const { forwardPredict, forwardExplain } = require('../services/aiService');
const Prediction = require('../models/Prediction');
const { getDBStatus } = require('../config/db');

const handlePredict = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "Missing required 'image' file in upload." });
    }

    const includeHeatmaps = req.query.include_heatmaps !== 'false';

    // 1. Forward to AI inference service
    const aiResult = await forwardPredict(
      req.file.buffer,
      req.file.originalname,
      req.file.mimetype,
      includeHeatmaps
    );

    // 2. Persist to MongoDB if connected (resilient: failures do not block the prediction response)
    let historySaved = false;
    let savedRecordId = null;

    if (getDBStatus()) {
      try {
        const record = await Prediction.create({
          originalFilename: req.file.originalname,
          fileSize: req.file.size,
          predictedClass: aiResult.predictedClass,
          stageLabel: aiResult.stageLabel,
          probabilities: aiResult.probabilities,
          rawLogits: aiResult.rawLogits || [],
          hasHeatmaps: Boolean(aiResult.heatmaps),
          disclaimerAcknowledged: true,
        });
        historySaved = true;
        savedRecordId = record._id;
      } catch (dbErr) {
        console.warn(`[History] Could not save prediction to database: ${dbErr.message}`);
      }
    }

    // Return complete payload to frontend
    res.status(200).json({
      ...aiResult,
      historySaved,
      historyId: savedRecordId,
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

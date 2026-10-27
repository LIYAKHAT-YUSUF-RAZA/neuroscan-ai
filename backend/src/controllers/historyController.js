const Prediction = require('../models/Prediction');
const { getDBStatus } = require('../config/db');

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

    const limit = Math.min(parseInt(req.query.limit, 10) || 20, 100);
    const records = await Prediction.find()
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

const clearHistory = async (req, res, next) => {
  try {
    if (!getDBStatus()) {
      return res.status(400).json({ error: 'Database is not connected.' });
    }

    const result = await Prediction.deleteMany({});
    res.status(200).json({
      message: 'Prediction history cleared successfully.',
      deletedCount: result.deletedCount,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getHistory,
  clearHistory,
};

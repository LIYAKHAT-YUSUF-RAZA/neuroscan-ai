const express = require('express');
const router = express.Router();

const upload = require('../middlewares/upload');
const { getHealth } = require('../controllers/healthController');
const { handlePredict, handleExplain } = require('../controllers/predictController');
const { getHistory, clearHistory } = require('../controllers/historyController');

// Health endpoint
router.get('/health', getHealth);

// AI inference endpoints
router.post('/predict', upload.single('image'), handlePredict);
router.post('/explain', upload.single('image'), handleExplain);

// Prediction history endpoints
router.get('/history', getHistory);
router.delete('/history', clearHistory);

module.exports = router;

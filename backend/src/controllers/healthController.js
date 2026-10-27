const { getDBStatus } = require('../config/db');
const { checkAiHealth } = require('../services/aiService');

const getHealth = async (req, res) => {
  const isDbReady = getDBStatus();
  const aiHealth = await checkAiHealth();

  const isAiHealthy = aiHealth.reachable && aiHealth.data?.status === 'healthy';
  const isHealthy = isAiHealthy;

  // Support ?strict=true for clients demanding 503 on degraded downstream dependencies,
  // while returning 200 by default so cloud platform liveness probes confirm gateway readiness.
  const strict = req.query.strict === 'true';
  const statusCode = strict ? (isHealthy ? 200 : 503) : 200;

  res.status(statusCode).json({
    status: isHealthy ? 'healthy' : 'degraded',
    gateway: 'Express.js Backend',
    database: {
      connected: isDbReady,
      status: isDbReady ? 'connected' : 'disconnected',
    },
    aiService: aiHealth,
    timestamp: new Date().toISOString(),
  });
};

module.exports = { getHealth };

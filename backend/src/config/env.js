require('dotenv').config();

module.exports = {
  port: parseInt(process.env.PORT, 10) || 5000,
  host: process.env.HOST || '0.0.0.0',
  nodeEnv: process.env.NODE_ENV || 'development',
  clientOrigin: process.env.CLIENT_ORIGIN || 'http://localhost:5173',
  flaskAiUrl: (process.env.FLASK_AI_URL || 'http://127.0.0.1:5001').replace(/\/$/, ''),
  mongoUri: process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/alzheimer_db',
};

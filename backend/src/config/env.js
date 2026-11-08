const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });
require('dotenv').config();

module.exports = {
  port: parseInt(process.env.PORT, 10) || 5000,
  host: process.env.HOST || '0.0.0.0',
  nodeEnv: process.env.NODE_ENV || 'development',
  clientOrigin: process.env.CLIENT_ORIGIN || 'http://localhost:5173',
  flaskAiUrl: (process.env.FLASK_AI_URL || 'http://127.0.0.1:5001').replace(/\/$/, ''),
  mongoUri: process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/alzheimer_db',
  aiServiceSecretKey: process.env.AI_SERVICE_SECRET_KEY || '',
  smtpHost: process.env.SMTP_HOST || '',
  smtpPort: parseInt(process.env.SMTP_PORT, 10) || 587,
  smtpUser: process.env.SMTP_USER || '',
  smtpPassword: process.env.SMTP_PASSWORD || '',
  emailFrom: process.env.EMAIL_FROM || 'NeuroScan AI Care <notifications@neuroscan-ai.local>',
  smtpSecure: process.env.SMTP_SECURE === 'true',
  schedulerSecretKey: process.env.SCHEDULER_SECRET_KEY || 'default-dev-scheduler-secret',
  jwtSecret:
    process.env.JWT_SECRET ||
    (process.env.NODE_ENV === 'production'
      ? (() => {
          throw new Error('CRITICAL: JWT_SECRET environment variable is required in production.');
        })()
      : 'neuroscan-dev-jwt-insecure-secret-key-change-in-prod-32bytes'),
  storageDriver: process.env.STORAGE_DRIVER || 'local',
  storageBasePath: process.env.STORAGE_BASE_PATH || path.resolve(__dirname, '../../uploads'),
  s3Bucket: process.env.S3_BUCKET || '',
  s3Region: process.env.S3_REGION || 'us-east-1',
  s3AccessKeyId: process.env.S3_ACCESS_KEY_ID || '',
  s3SecretAccessKey: process.env.S3_SECRET_ACCESS_KEY || '',
  s3Endpoint: process.env.S3_ENDPOINT || '',
};

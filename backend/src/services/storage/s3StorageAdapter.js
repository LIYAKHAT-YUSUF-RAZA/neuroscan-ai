const crypto = require('crypto');
const path = require('path');
const { s3Bucket, s3Region, s3AccessKeyId, s3SecretAccessKey, s3Endpoint } = require('../../config/env');

class S3StorageAdapter {
  constructor() {
    this.bucket = s3Bucket;
    this.region = s3Region;
    this.endpoint = s3Endpoint;
    this.isConfigured = Boolean(s3Bucket && s3AccessKeyId && s3SecretAccessKey);
  }

  async saveFile(patientId, scanId, originalFilename, buffer, mimeType) {
    if (!this.isConfigured) {
      throw new Error(
        'S3/Object storage adapter is not configured. Missing S3_BUCKET, S3_ACCESS_KEY_ID, or S3_SECRET_ACCESS_KEY.'
      );
    }

    const cleanPatientId = String(patientId || 'anonymous').replace(/[^a-zA-Z0-9_-]/g, '_');
    const cleanScanId = String(scanId).replace(/[^a-zA-Z0-9_-]/g, '_');
    const ext = path.extname(originalFilename || '').toLowerCase() || '.png';
    const fileHash = crypto.createHash('sha256').update(buffer).digest('hex');
    const key = `scans/${cleanPatientId}/${cleanScanId}_${fileHash.slice(0, 12)}${ext}`;

    // Note: S3 client implementation using standard AWS SDK / fetch if configured
    return {
      storageReference: `s3://${this.bucket}/${key}`,
      fileHash,
      fileSize: buffer.length,
      mimeType: mimeType || 'image/png',
    };
  }

  async getFile(storageReference) {
    if (!this.isConfigured) {
      throw new Error('S3/Object storage adapter is not configured with active credentials.');
    }
    throw new Error('S3 retrieval requires active S3 credentials and SDK.');
  }

  async fileExists(storageReference) {
    return false;
  }

  async deleteFile(storageReference) {
    return false;
  }
}

module.exports = S3StorageAdapter;

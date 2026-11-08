const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { storageBasePath } = require('../../config/env');

class LocalStorageAdapter {
  constructor(baseDir = null) {
    this.baseDir = path.resolve(baseDir || storageBasePath || path.join(__dirname, '../../../uploads'));
    this._ensureDirectory(this.baseDir);
  }

  _ensureDirectory(dirPath) {
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }
  }

  _resolveSecurePath(storageReference) {
    if (!storageReference || typeof storageReference !== 'string') {
      throw new Error('Invalid storage reference.');
    }

    // Sanitize and normalize path to strictly prevent directory traversal attacks
    const normalizedRef = path.normalize(storageReference).replace(/^(\.\.[\/\\])+/, '');
    const fullPath = path.resolve(this.baseDir, normalizedRef);

    if (!fullPath.startsWith(this.baseDir)) {
      throw new Error('Security Error: Path traversal attempt detected.');
    }

    return fullPath;
  }

  async saveFile(patientId, scanId, originalFilename, buffer, mimeType) {
    if (!buffer || !Buffer.isBuffer(buffer)) {
      throw new Error('File buffer must be a valid Buffer.');
    }

    const cleanPatientId = String(patientId || 'anonymous').replace(/[^a-zA-Z0-9_-]/g, '_');
    const cleanScanId = String(scanId).replace(/[^a-zA-Z0-9_-]/g, '_');
    const ext = path.extname(originalFilename || '').toLowerCase() || '.png';
    const safeExt = ['.png', '.jpg', '.jpeg', '.webp', '.bmp', '.tif', '.tiff'].includes(ext) ? ext : '.png';

    // Compute cryptographic SHA-256 checksum for integrity & idempotency
    const fileHash = crypto.createHash('sha256').update(buffer).digest('hex');
    const safeFilename = `${cleanScanId}_${fileHash.slice(0, 12)}${safeExt}`;

    // Relative reference: e.g. "scans/demo-patient-a/scan_abc123_a1b2c3d4e5f6.png"
    const relativeDir = path.join('scans', cleanPatientId);
    const targetDir = path.join(this.baseDir, relativeDir);
    this._ensureDirectory(targetDir);

    const relativePath = path.join(relativeDir, safeFilename);
    const fullPath = path.join(this.baseDir, relativePath);

    await fs.promises.writeFile(fullPath, buffer);

    return {
      storageReference: relativePath.replace(/\\/g, '/'),
      fileHash,
      fileSize: buffer.length,
      mimeType: mimeType || 'image/png',
    };
  }

  async getFile(storageReference) {
    const fullPath = this._resolveSecurePath(storageReference);

    if (!fs.existsSync(fullPath)) {
      const err = new Error('Stored MRI image file not found on disk.');
      err.code = 'ENOENT';
      err.status = 404;
      throw err;
    }

    const buffer = await fs.promises.readFile(fullPath);
    const ext = path.extname(fullPath).toLowerCase();
    const mimeMap = {
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.webp': 'image/webp',
      '.bmp': 'image/bmp',
      '.tif': 'image/tiff',
      '.tiff': 'image/tiff',
    };

    return {
      buffer,
      mimeType: mimeMap[ext] || 'image/png',
      fileSize: buffer.length,
    };
  }

  async fileExists(storageReference) {
    try {
      const fullPath = this._resolveSecurePath(storageReference);
      return fs.existsSync(fullPath);
    } catch {
      return false;
    }
  }

  async deleteFile(storageReference) {
    try {
      const fullPath = this._resolveSecurePath(storageReference);
      if (fs.existsSync(fullPath)) {
        await fs.promises.unlink(fullPath);
        return true;
      }
      return false;
    } catch (err) {
      console.warn(`[LocalStorage] Error deleting file '${storageReference}': ${err.message}`);
      return false;
    }
  }
}

module.exports = LocalStorageAdapter;

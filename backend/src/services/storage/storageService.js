const LocalStorageAdapter = require('./localStorageAdapter');
const S3StorageAdapter = require('./s3StorageAdapter');
const { storageDriver } = require('../../config/env');

let activeAdapter = null;

function getStorageAdapter() {
  if (activeAdapter) return activeAdapter;

  if (storageDriver === 's3') {
    const s3Adapter = new S3StorageAdapter();
    if (s3Adapter.isConfigured) {
      activeAdapter = s3Adapter;
      console.log('[Storage] Using persistent S3/Object Storage adapter.');
      return activeAdapter;
    }
    console.warn('[Storage] S3 credentials missing. Falling back to persistent local storage adapter.');
  }

  activeAdapter = new LocalStorageAdapter();
  console.log('[Storage] Using persistent Local Filesystem Storage adapter.');
  return activeAdapter;
}

/**
 * Persists an MRI scan image buffer.
 * @param {string} patientId
 * @param {string} scanId
 * @param {string} originalFilename
 * @param {Buffer} buffer
 * @param {string} mimeType
 * @returns {Promise<{ storageReference: string, fileHash: string, fileSize: number, mimeType: string }>}
 */
async function saveScanImage(patientId, scanId, originalFilename, buffer, mimeType) {
  const adapter = getStorageAdapter();
  return adapter.saveFile(patientId, scanId, originalFilename, buffer, mimeType);
}

/**
 * Retrieves an MRI scan image buffer by storage reference.
 * @param {string} storageReference
 * @returns {Promise<{ buffer: Buffer, mimeType: string, fileSize: number }>}
 */
async function getScanImage(storageReference) {
  const adapter = getStorageAdapter();
  return adapter.getFile(storageReference);
}

/**
 * Checks if a scan image exists in storage.
 * @param {string} storageReference
 * @returns {Promise<boolean>}
 */
async function scanImageExists(storageReference) {
  const adapter = getStorageAdapter();
  return adapter.fileExists(storageReference);
}

/**
 * Safely deletes a scan image from storage.
 * @param {string} storageReference
 * @returns {Promise<boolean>}
 */
async function deleteScanImage(storageReference) {
  const adapter = getStorageAdapter();
  return adapter.deleteFile(storageReference);
}

module.exports = {
  getStorageAdapter,
  saveScanImage,
  getScanImage,
  scanImageExists,
  deleteScanImage,
};

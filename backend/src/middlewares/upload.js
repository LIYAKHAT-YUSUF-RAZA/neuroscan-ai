const multer = require('multer');
const path = require('path');

// Store in memory buffer to prevent orphaned temporary files on the filesystem
const storage = multer.memoryStorage();

const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/bmp',
  'image/tiff',
]);

const ALLOWED_EXTENSIONS = new Set([
  '.jpg',
  '.jpeg',
  '.png',
  '.webp',
  '.bmp',
  '.tif',
  '.tiff',
]);

const fileFilter = (req, file, cb) => {
  if (ALLOWED_MIME_TYPES.has(file.mimetype.toLowerCase())) {
    cb(null, true);
  } else {
    const err = new Error(
      `Unsupported file type '${file.mimetype}'. Allowed formats: JPEG, PNG, WEBP, BMP, TIFF.`
    );
    err.status = 400;
    cb(err, false);
  }
};

const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10 MB maximum limit
    files: 1,
  },
  fileFilter,
});

/**
 * Validates actual binary magic bytes against standard image signatures
 */
const validateImageMagicBytes = (buffer) => {
  if (!buffer || !Buffer.isBuffer(buffer) || buffer.length < 8) {
    return false;
  }

  // 1. JPEG: FF D8 FF
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return true;
  }

  // 2. PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return true;
  }

  // 3. WEBP: RIFF .... WEBP
  if (
    buffer.length >= 12 &&
    buffer.subarray(0, 4).toString('ascii') === 'RIFF' &&
    buffer.subarray(8, 12).toString('ascii') === 'WEBP'
  ) {
    return true;
  }

  // 4. BMP: 42 4D ('BM')
  if (buffer[0] === 0x42 && buffer[1] === 0x4d) {
    return true;
  }

  // 5. TIFF: Little-endian (II*. ) or Big-endian (MM.*)
  if (
    (buffer[0] === 0x49 && buffer[1] === 0x49 && buffer[2] === 0x2a && buffer[3] === 0x00) ||
    (buffer[0] === 0x4d && buffer[1] === 0x4d && buffer[2] === 0x00 && buffer[3] === 0x2a)
  ) {
    return true;
  }

  return false;
};

/**
 * Express middleware to strictly inspect uploaded MRI file buffer and signatures
 */
const validateUploadedScan = (req, res, next) => {
  if (!req.file) {
    return next();
  }

  const { originalname, buffer, size } = req.file;

  // 1. Validate file extension
  const ext = path.extname(originalname || '').toLowerCase();
  if (!ALLOWED_EXTENSIONS.has(ext)) {
    return res.status(400).json({
      error: `Unsupported file extension '${ext}'. Allowed types: ${Array.from(ALLOWED_EXTENSIONS).join(', ')}.`,
    });
  }

  // 2. Validate non-empty file
  if (!buffer || buffer.length === 0 || size === 0) {
    return res.status(400).json({
      error: 'Uploaded scan file is empty. Please select a valid MRI image.',
    });
  }

  // 3. Validate binary magic bytes signature
  if (!validateImageMagicBytes(buffer)) {
    return res.status(400).json({
      error: 'Corrupt or invalid image file: binary signature (magic bytes) does not match valid JPEG, PNG, WEBP, BMP, or TIFF image formats.',
    });
  }

  next();
};

upload.validateUploadedScan = validateUploadedScan;
upload.validateImageMagicBytes = validateImageMagicBytes;

module.exports = upload;

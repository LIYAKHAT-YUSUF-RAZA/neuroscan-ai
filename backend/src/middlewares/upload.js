const multer = require('multer');

// Store in memory buffer to prevent orphaned temporary files on the filesystem
const storage = multer.memoryStorage();

const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/bmp',
  'image/tiff',
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
    fileSize: 10 * 1024 * 1024, // 10 MB limit
    files: 1,
  },
  fileFilter,
});

module.exports = upload;

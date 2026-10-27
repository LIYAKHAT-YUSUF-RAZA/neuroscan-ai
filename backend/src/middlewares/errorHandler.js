const { MulterError } = require('multer');
const { nodeEnv } = require('../config/env');

const errorHandler = (err, req, res, next) => {
  console.error('[Error Middleware]', err.message);

  let statusCode = err.status || err.statusCode || 500;
  let message = err.message || 'Internal server error';

  if (err instanceof MulterError) {
    statusCode = 400;
    if (err.code === 'LIMIT_FILE_SIZE') {
      message = 'Uploaded file exceeds the maximum 10 MB size limit.';
    } else if (err.code === 'LIMIT_UNEXPECTED_FILE') {
      message = "Unexpected field name. Please upload using the 'image' field.";
    } else {
      message = `Upload error: ${err.message}`;
    }
  }

  const response = {
    error: message,
  };

  if (nodeEnv !== 'production' && err.stack) {
    response.stack = err.stack;
  }

  res.status(statusCode).json(response);
};

module.exports = errorHandler;

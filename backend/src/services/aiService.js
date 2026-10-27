const axios = require('axios');
const FormData = require('form-data');
const { flaskAiUrl } = require('../config/env');

const checkAiHealth = async () => {
  try {
    const res = await axios.get(`${flaskAiUrl}/health`, { timeout: 3000 });
    return { reachable: true, data: res.data };
  } catch (error) {
    return {
      reachable: false,
      error: `AI service at ${flaskAiUrl} is unreachable: ${error.message}`,
    };
  }
};

const sendImageToFlask = async (endpoint, fileBuffer, filename, mimetype, extraParams = {}) => {
  const form = new FormData();
  form.append('image', fileBuffer, {
    filename: filename || 'mri_scan.png',
    contentType: mimetype || 'image/png',
  });

  // Append any extra form fields
  for (const [key, value] of Object.entries(extraParams)) {
    if (value !== undefined && value !== null) {
      form.append(key, String(value));
    }
  }

  try {
    const response = await axios.post(`${flaskAiUrl}${endpoint}`, form, {
      headers: {
        ...form.getHeaders(),
      },
      maxContentLength: 15 * 1024 * 1024,
      maxBodyLength: 15 * 1024 * 1024,
      timeout: 60000, // 60s timeout for gradient computations
    });
    return response.data;
  } catch (error) {
    if (error.response) {
      // The Flask service responded with an error status code
      const serverError = error.response.data?.error || `Flask error (${error.response.status})`;
      const err = new Error(serverError);
      err.status = error.response.status;
      throw err;
    } else if (error.request) {
      // No response received
      const err = new Error(`AI service is unreachable at ${flaskAiUrl}. Please ensure Flask is running.`);
      err.status = 502; // Bad Gateway
      throw err;
    } else {
      const err = new Error(`Failed to forward request to AI service: ${error.message}`);
      err.status = 500;
      throw err;
    }
  }
};

const forwardPredict = async (fileBuffer, filename, mimetype, includeHeatmaps = true) => {
  const endpoint = `/predict?include_heatmaps=${includeHeatmaps ? 'true' : 'false'}`;
  return sendImageToFlask(endpoint, fileBuffer, filename, mimetype);
};

const forwardExplain = async (fileBuffer, filename, mimetype, targetClass = null) => {
  return sendImageToFlask('/explain', fileBuffer, filename, mimetype, {
    target_class: targetClass,
  });
};

module.exports = {
  checkAiHealth,
  forwardPredict,
  forwardExplain,
};

const rawBaseUrl =
  import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api';
const API_BASE_URL = rawBaseUrl.replace(/\/+$/, '');

/**
 * Checks system health across Gateway, Database, and Python AI Service.
 */
export async function getSystemHealth() {
  try {
    const res = await fetch(`${API_BASE_URL}/health`);
    const data = await res.json();
    return { success: true, data, status: res.status };
  } catch (error) {
    return {
      success: false,
      error: `Could not connect to backend gateway at ${API_BASE_URL}.`,
    };
  }
}

/**
 * Uploads brain MRI scan and receives AI classification + heatmaps.
 * @param {File} file - MRI image file
 * @param {boolean} includeHeatmaps - Whether to request Grad-CAM & IG heatmaps
 */
export async function predictMri(file, includeHeatmaps = true) {
  const formData = new FormData();
  formData.append('image', file);

  try {
    const url = `${API_BASE_URL}/predict?include_heatmaps=${includeHeatmaps ? 'true' : 'false'}`;
    const res = await fetch(url, {
      method: 'POST',
      body: formData,
    });

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.error || `Server responded with HTTP ${res.status}`);
    }

    return { success: true, data };
  } catch (error) {
    return {
      success: false,
      error: error.message || 'An unexpected error occurred during MRI analysis.',
    };
  }
}

/**
 * Fetches recent prediction history from MongoDB.
 */
export async function getPredictionHistory(limit = 20) {
  try {
    const res = await fetch(`${API_BASE_URL}/history?limit=${limit}`);
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Failed to fetch history');
    }
    return { success: true, data: data.data || [], dbConnected: data.dbConnected };
  } catch (error) {
    return {
      success: false,
      error: error.message,
      data: [],
      dbConnected: false,
    };
  }
}

/**
 * Clears prediction history.
 */
export async function clearPredictionHistory() {
  try {
    const res = await fetch(`${API_BASE_URL}/history`, { method: 'DELETE' });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Failed to clear history');
    }
    return { success: true, data };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

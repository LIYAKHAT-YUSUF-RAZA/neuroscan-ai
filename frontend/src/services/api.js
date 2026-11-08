const rawBaseUrl =
  import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api';
const API_BASE_URL = rawBaseUrl.replace(/\/+$/, '');

/**
 * Session Token Storage Keys
 */
export const JWT_STORAGE_KEY = 'neuroscan_jwt_token';
export const ROLE_STORAGE_KEY = 'neuroscan_user_role';
export const PATIENT_STORAGE_KEY = 'neuroscan_active_patient_id';

/**
 * Retrieves the currently active cryptographic JWT from storage.
 */
export function getStoredToken() {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(JWT_STORAGE_KEY);
}

/**
 * Stores the verified cryptographic JWT and associated role in localStorage.
 */
export function setStoredToken(token, role = null, patientId = null) {
  if (typeof window === 'undefined') return;
  if (token) {
    localStorage.setItem(JWT_STORAGE_KEY, token);
  } else {
    localStorage.removeItem(JWT_STORAGE_KEY);
  }
  if (role) {
    localStorage.setItem(ROLE_STORAGE_KEY, role);
  }
  if (patientId) {
    localStorage.setItem(PATIENT_STORAGE_KEY, patientId);
  }
}

/**
 * Clears active session credentials on controlled logout or session expiration.
 */
export function clearStoredToken() {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(JWT_STORAGE_KEY);
}

/**
 * Builds RBAC authentication headers based on caller role, verified JWT, and target patient context.
 */
export function getAuthHeaders(targetPatientId = null, role = null) {
  const headers = {};
  const token = getStoredToken();
  const effectiveRole =
    role ||
    (typeof window !== 'undefined' ? localStorage.getItem(ROLE_STORAGE_KEY) : null) ||
    'researcher';

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  if (effectiveRole === 'researcher' || effectiveRole === 'clinician') {
    if (targetPatientId) {
      headers['x-target-patient-id'] = targetPatientId;
      headers['x-patient-id'] = targetPatientId;
    }
  } else {
    // Ordinary patient role: target is always their own patient identity
    const selfId = targetPatientId || (typeof window !== 'undefined' ? localStorage.getItem(PATIENT_STORAGE_KEY) : null);
    if (selfId) {
      headers['x-patient-id'] = selfId;
    }
  }
  return headers;
}

/**
 * Initializes a verified development session (strictly dev/eval mode)
 */
export async function initializeSessionAuth({ role = 'researcher', patientId = null } = {}) {
  try {
    const res = await fetch(`${API_BASE_URL}/auth/dev-session`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role, patientId }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to initialize session');
    if (data.data?.token) {
      setStoredToken(data.data.token, role, patientId || data.data.patientId);
    }
    return { success: true, data: data.data };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Production Patient Authentication using verified registered email
 */
export async function loginPatientAccount({ email, patientId = null }) {
  try {
    const res = await fetch(`${API_BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, patientId }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Authentication failed');
    if (data.data?.token) {
      setStoredToken(data.data.token, 'patient', data.data.patientId);
    }
    return { success: true, data: data.data };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Verifies the validity of the currently stored JWT session with the backend.
 */
export async function verifyCurrentSession() {
  const token = getStoredToken();
  if (!token) return { success: false, authenticated: false };
  try {
    const res = await fetch(`${API_BASE_URL}/auth/me`, {
      headers: getAuthHeaders(),
    });
    const data = await res.json();
    if (!res.ok) {
      clearStoredToken();
      return { success: false, authenticated: false, error: data.error };
    }
    return { success: true, authenticated: true, user: data.data };
  } catch (error) {
    return { success: false, authenticated: false, error: error.message };
  }
}

/**
 * Checks system health across Gateway, Database, and Python AI Service.
 */
export async function getSystemHealth(options = {}) {
  try {
    const res = await fetch(`${API_BASE_URL}/health`, { signal: options?.signal });
    const data = await res.json();
    return { success: true, data, status: res.status };
  } catch (error) {
    if (error.name === 'AbortError') return { success: false, aborted: true };
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
 * @param {string} patientId - Optional authenticated patient identifier
 * @param {string} role - Caller authorization role
 * @param {object} options - Optional fetch options including signal (AbortController)
 */
export async function predictMri(file, includeHeatmaps = true, patientId = null, role = null, options = {}) {
  const formData = new FormData();
  formData.append('image', file);
  if (options.evaluationType) {
    formData.append('evaluationType', options.evaluationType);
  }
  if (options.visitDate) {
    formData.append('visitDate', options.visitDate);
  }
  if (options.visitNotes) {
    formData.append('visitNotes', options.visitNotes);
  }

  try {
    const url = `${API_BASE_URL}/predict?include_heatmaps=${includeHeatmaps ? 'true' : 'false'}`;
    const headers = getAuthHeaders(patientId, role);

    const res = await fetch(url, {
      method: 'POST',
      headers,
      body: formData,
      signal: options?.signal,
    });

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.error || `Server responded with HTTP ${res.status}`);
    }

    return { success: true, data };
  } catch (error) {
    if (error.name === 'AbortError') return { success: false, aborted: true };
    return {
      success: false,
      error: error.message || 'An unexpected error occurred during MRI analysis.',
    };
  }
}

/**
 * Submits an MRI scan for asynchronous processing (HTTP 202 Accepted).
 * Ideal for high-concurrency traffic to prevent HTTP socket timeouts.
 */
export async function submitAsyncMri(file, includeHeatmaps = true, patientId = null, role = null, options = {}) {
  const formData = new FormData();
  formData.append('image', file);

  try {
    const url = `${API_BASE_URL}/predict/async?include_heatmaps=${includeHeatmaps ? 'true' : 'false'}`;
    const headers = getAuthHeaders(patientId, role);

    const res = await fetch(url, {
      method: 'POST',
      headers,
      body: formData,
      signal: options?.signal,
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || `Server responded with HTTP ${res.status}`);
    }

    return { success: true, ...data };
  } catch (error) {
    if (error.name === 'AbortError') return { success: false, aborted: true };
    return {
      success: false,
      error: error.message || 'Failed to submit MRI scan for asynchronous processing.',
    };
  }
}

/**
 * Retrieves the status and result of an asynchronous inference job.
 */
export async function getInferenceJobStatus(jobId, patientId = null, role = null, options = {}) {
  try {
    const headers = getAuthHeaders(patientId, role);
    const res = await fetch(`${API_BASE_URL}/jobs/${jobId}`, {
      headers,
      signal: options?.signal,
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || `Server responded with HTTP ${res.status}`);
    }

    return { success: true, data };
  } catch (error) {
    if (error.name === 'AbortError') return { success: false, aborted: true };
    return {
      success: false,
      error: error.message || 'Failed to retrieve job status.',
    };
  }
}

/**
 * Polls an asynchronous inference job until completion or timeout.
 */
export async function pollInferenceJob(jobId, { patientId = null, role = null, onProgress = null, intervalMs = 1000, timeoutMs = 60000, signal = null } = {}) {
  const startTime = Date.now();

  while (Date.now() - startTime < timeoutMs) {
    if (signal?.aborted) {
      return { success: false, aborted: true };
    }

    const check = await getInferenceJobStatus(jobId, patientId, role, { signal });
    if (!check.success) {
      return check;
    }

    const job = check.data;
    if (onProgress && typeof onProgress === 'function') {
      onProgress(job);
    }

    if (job.status === 'completed') {
      return { success: true, data: job.result, job };
    }

    if (job.status === 'failed') {
      return { success: false, error: job.error || 'Inference job failed' };
    }

    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }

  return { success: false, error: 'Job timed out while waiting for inference completion.' };
}

/**
 * Retrieves all registered MRI scans for the authenticated patient.
 */
export async function getPatientScans(patientId = null, role = null, options = {}) {
  try {
    const headers = getAuthHeaders(patientId, role);
    const res = await fetch(`${API_BASE_URL}/scans`, {
      headers,
      signal: options?.signal,
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to fetch scans');
    return { success: true, scans: data.scans || [], count: data.count || 0 };
  } catch (error) {
    if (error.name === 'AbortError') return { success: false, aborted: true, scans: [] };
    return { success: false, error: error.message, scans: [] };
  }
}

/**
 * Retrieves full details and linked evaluations for a single scan.
 */
export async function getScanDetails(scanId, patientId = null, role = null, options = {}) {
  try {
    const headers = getAuthHeaders(patientId, role);
    const res = await fetch(`${API_BASE_URL}/scans/${encodeURIComponent(scanId)}`, {
      headers,
      signal: options?.signal,
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to fetch scan details');
    return { success: true, scan: data.scan };
  } catch (error) {
    if (error.name === 'AbortError') return { success: false, aborted: true };
    return { success: false, error: error.message };
  }
}

export function getScanImageUrl(scanId) {
  if (!scanId) return '';
  return `${API_BASE_URL}/scans/${encodeURIComponent(scanId)}/image`;
}

/**
 * Fetches an authenticated MRI scan image binary from the backend and returns a Blob.
 * Validates HTTP status (200 OK) and MIME type.
 * @param {string} scanId - Physical scan identifier
 * @param {string} patientId - Active patient identifier
 * @param {string} role - Active user role ('researcher', 'clinician', 'patient')
 * @param {object} options - Fetch options (e.g. signal for AbortController)
 * @returns {Promise<Blob>}
 */
export async function fetchScanImageBlob(scanId, patientId = null, role = null, options = {}) {
  if (!scanId) {
    throw new Error('Scan ID is required.');
  }

  const headers = getAuthHeaders(patientId, role);
  const url = `${API_BASE_URL}/scans/${encodeURIComponent(scanId)}/image`;

  const res = await fetch(url, {
    method: 'GET',
    headers,
    signal: options?.signal,
  });

  if (!res.ok) {
    let errMsg = `Failed to load MRI scan (HTTP ${res.status})`;
    try {
      const errJson = await res.json();
      if (errJson.error) errMsg = errJson.error;
    } catch {
      // Body not JSON
    }
    const error = new Error(errMsg);
    error.status = res.status;
    throw error;
  }

  const contentType = res.headers.get('content-type') || '';
  const ALLOWED_MIME_PREFIXES = ['image/png', 'image/jpeg', 'image/webp', 'image/tiff', 'image/bmp'];
  const isValidMime = ALLOWED_MIME_PREFIXES.some((m) => contentType.toLowerCase().startsWith(m));

  if (!isValidMime) {
    const error = new Error(`Invalid image content type received: ${contentType || 'unknown'}`);
    error.status = 415;
    throw error;
  }

  const blob = await res.blob();
  if (blob.size === 0) {
    throw new Error('Received empty image binary from server.');
  }

  return blob;
}

/**
 * Reanalyses an existing stored MRI scan without re-uploading.
 */
export async function reanalyseMriScan(scanId, includeHeatmaps = true, patientId = null, role = null, options = {}) {
  try {
    const headers = getAuthHeaders(patientId, role);
    const url = `${API_BASE_URL}/scans/${encodeURIComponent(scanId)}/reanalyse?include_heatmaps=${includeHeatmaps ? 'true' : 'false'}`;
    const res = await fetch(url, {
      method: 'POST',
      headers,
      signal: options?.signal,
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || `Server responded with HTTP ${res.status}`);
    return { success: true, data };
  } catch (error) {
    if (error.name === 'AbortError') return { success: false, aborted: true };
    return { success: false, error: error.message || 'Failed to reanalyse MRI scan.' };
  }
}

/**
 * Fetches chronological longitudinal research evaluation records for patient.
 * Automatically excludes Out-of-Distribution (OOD) rejections from valid research charts.
 */
export async function getLongitudinalHistory(patientId = null, role = null, options = {}) {
  try {
    const headers = getAuthHeaders(patientId, role);
    const res = await fetch(`${API_BASE_URL}/history/longitudinal`, {
      headers,
      signal: options?.signal,
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to fetch longitudinal history');
    return {
      success: true,
      evaluations: data.evaluations || [],
      count: data.count || 0,
      disclaimer: data.disclaimer,
    };
  } catch (error) {
    if (error.name === 'AbortError') return { success: false, aborted: true, evaluations: [] };
    return { success: false, error: error.message, evaluations: [] };
  }
}

/**
 * Compares two distinct evaluations side-by-side with delta analysis and scientific disclaimers.
 */
export async function compareEvaluations(eval1, eval2, patientId = null, role = null, options = {}) {
  try {
    const headers = getAuthHeaders(patientId, role);
    const url = `${API_BASE_URL}/history/compare?eval1=${encodeURIComponent(eval1)}&eval2=${encodeURIComponent(eval2)}`;
    const res = await fetch(url, {
      headers,
      signal: options?.signal,
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to compare evaluations');
    return { success: true, comparison: data.comparison };
  } catch (error) {
    if (error.name === 'AbortError') return { success: false, aborted: true };
    return { success: false, error: error.message };
  }
}

/**
 * Fetches recent prediction history from MongoDB.
 */
export async function getPredictionHistory(limit = 20, patientId = null, role = null, options = {}) {
  try {
    const headers = getAuthHeaders(patientId, role);
    const query = patientId ? `&patientId=${encodeURIComponent(patientId)}` : '';
    const res = await fetch(`${API_BASE_URL}/history?limit=${limit}${query}`, {
      headers,
      signal: options?.signal,
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Failed to fetch history');
    }
    return { success: true, data: data.data || [], dbConnected: data.dbConnected };
  } catch (error) {
    if (error.name === 'AbortError') return { success: false, aborted: true, data: [] };
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
export async function clearPredictionHistory(patientId = null, role = null) {
  try {
    const headers = getAuthHeaders(patientId, role);
    const res = await fetch(`${API_BASE_URL}/history`, { method: 'DELETE', headers });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Failed to clear history');
    }
    return { success: true, data };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// ==================== PATIENT CARE API CALLS ====================

/**
 * Fetch patient medications with scheduled doses
 */
export async function getMedications(patientId = null, role = null) {
  try {
    const headers = getAuthHeaders(patientId, role);
    const query = patientId ? `?patientId=${encodeURIComponent(patientId)}` : '';
    const res = await fetch(`${API_BASE_URL}/care/medications${query}`, {
      headers,
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to load medications');
    return { success: true, data: data.data || [], dbConnected: data.dbConnected, warning: data.warning };
  } catch (error) {
    return { success: false, error: error.message, data: [], dbConnected: false };
  }
}

/**
 * Fetch today's individual scheduled doses with summary metrics
 */
export async function getTodayDoses(patientId = null, timezone, role = null) {
  try {
    const tz = timezone || Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Kolkata';
    const headers = {
      ...getAuthHeaders(patientId, role),
      'x-timezone': tz,
    };
    const query = patientId ? `?patientId=${encodeURIComponent(patientId)}` : '';
    const res = await fetch(`${API_BASE_URL}/care/medications/today${query}`, {
      headers,
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Failed to load today's doses");
    const payload = data.data || data;
    return {
      success: true,
      doses: payload.doses || [],
      summary: payload.summary || { total: 0, taken: 0, upcoming: 0, missed: 0, skipped: 0 },
      date: payload.scheduledDate || payload.date,
      dbConnected: data.dbConnected,
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
      doses: [],
      summary: { total: 0, taken: 0, upcoming: 0, missed: 0, skipped: 0 },
      dbConnected: false,
    };
  }
}

/**
 * Add a new clinician-prescribed medication
 */
export async function addMedication(medData, patientId = null, role = null) {
  try {
    const headers = {
      'Content-Type': 'application/json',
      ...getAuthHeaders(patientId, role),
    };
    const res = await fetch(`${API_BASE_URL}/care/medications`, {
      method: 'POST',
      headers,
      body: JSON.stringify(medData),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to add medication');
    return { success: true, data: data.data, dbConnected: data.dbConnected, warning: data.warning };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Update an existing clinician-prescribed medication schedule
 */
export async function editMedication(medId, medData, patientId = null, role = null) {
  try {
    const headers = {
      'Content-Type': 'application/json',
      ...getAuthHeaders(patientId, role),
    };
    const res = await fetch(`${API_BASE_URL}/care/medications/${medId}`, {
      method: 'PUT',
      headers,
      body: JSON.stringify(medData),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to update medication schedule');
    return { success: true, data: data.data, dbConnected: data.dbConnected };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Update individual dose status ('taken', 'skipped', 'missed', 'pending')
 */
export async function updateIndividualDoseStatus(doseId, status, notes = '', patientId = null, role = null) {
  try {
    const headers = {
      'Content-Type': 'application/json',
      ...getAuthHeaders(patientId, role),
    };
    const res = await fetch(`${API_BASE_URL}/care/medications/doses/${doseId}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ status, notes }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to update dose status');
    return { success: true, data: data.data, dbConnected: data.dbConnected };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Update dose status (legacy endpoint)
 */
export async function updateDoseStatus(medId, doseId, status) {
  try {
    const res = await fetch(`${API_BASE_URL}/care/medications/${medId}/dose`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ doseId, status }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to update dose');
    return { success: true, data: data.data };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Fetch medication history
 */
export async function getMedicationHistory(patientId = null, status = '', limit = 50, role = null) {
  try {
    const headers = getAuthHeaders(patientId, role);
    const patientParam = patientId ? `&patientId=${encodeURIComponent(patientId)}` : '';
    const url = `${API_BASE_URL}/care/medications/history?limit=${limit}${
      status ? `&status=${status}` : ''
    }${patientParam}`;
    const res = await fetch(url, { headers });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to load medication history');
    return { success: true, data: data.data || [], dbConnected: data.dbConnected };
  } catch (error) {
    return { success: false, error: error.message, data: [], dbConnected: false };
  }
}

/**
 * Delete a medication reminder
 */
export async function deleteMedication(medId, patientId = null, role = null) {
  try {
    const headers = getAuthHeaders(patientId, role);
    const res = await fetch(`${API_BASE_URL}/care/medications/${medId}`, {
      method: 'DELETE',
      headers,
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to delete medication');
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Fetch patient appointments
 */
export async function getAppointments(patientId = null, role = null) {
  try {
    const headers = getAuthHeaders(patientId, role);
    const query = patientId ? `?patientId=${encodeURIComponent(patientId)}` : '';
    const res = await fetch(`${API_BASE_URL}/care/appointments${query}`, {
      headers,
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to load appointments');
    return { success: true, data: data.data || [], dbConnected: data.dbConnected, warning: data.warning };
  } catch (error) {
    return { success: false, error: error.message, data: [], dbConnected: false };
  }
}

/**
 * Add a new specialist appointment
 */
export async function addAppointment(apptData, patientId = null, role = null) {
  try {
    const headers = {
      'Content-Type': 'application/json',
      ...getAuthHeaders(patientId, role),
    };
    const res = await fetch(`${API_BASE_URL}/care/appointments`, {
      method: 'POST',
      headers,
      body: JSON.stringify(apptData),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to add appointment');
    return { success: true, data: data.data, dbConnected: data.dbConnected, warning: data.warning };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Toggle appointment prep checklist item
 */
export async function toggleAppointmentChecklist(apptId, itemIndex, patientId = null, role = null) {
  try {
    const headers = {
      'Content-Type': 'application/json',
      ...getAuthHeaders(patientId, role),
    };
    const res = await fetch(`${API_BASE_URL}/care/appointments/${apptId}/checklist`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ itemIndex }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to update checklist item');
    return { success: true, data: data.data };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Delete an appointment
 */
export async function deleteAppointment(apptId, patientId = null, role = null) {
  try {
    const headers = getAuthHeaders(patientId, role);
    const res = await fetch(`${API_BASE_URL}/care/appointments/${apptId}`, {
      method: 'DELETE',
      headers,
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to delete appointment');
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// ==================== EMAIL NOTIFICATION API CALLS ====================

/**
 * Fetch patient notification settings & delivery status
 */
export async function getNotificationSettings(patientId = null, role = null) {
  try {
    const headers = getAuthHeaders(patientId, role);
    const query = patientId ? `?patientId=${encodeURIComponent(patientId)}` : '';
    const res = await fetch(
      `${API_BASE_URL}/care/notifications/settings${query}`,
      { headers }
    );
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to load notification settings');
    return { success: true, data: data.data };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Update notification preferences
 */
export async function updateNotificationSettings(settings, patientId = null, role = null) {
  try {
    const headers = {
      'Content-Type': 'application/json',
      ...getAuthHeaders(patientId, role),
    };
    const res = await fetch(`${API_BASE_URL}/care/notifications/settings`, {
      method: 'PUT',
      headers,
      body: JSON.stringify(settings),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to update notification settings');
    return { success: true, data: data.data, message: data.message };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Send a test email notification
 */
export async function sendTestNotification(target = 'patient', patientId = null, role = null) {
  try {
    const headers = {
      'Content-Type': 'application/json',
      ...getAuthHeaders(patientId, role),
    };
    const res = await fetch(`${API_BASE_URL}/care/notifications/test`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ target }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to send test email');
    return { success: true, message: data.message, delivery: data.delivery };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Fetch delivery audit history
 */
export async function getNotificationHistory(patientId = null, role = null) {
  try {
    const headers = getAuthHeaders(patientId, role);
    const query = patientId ? `?patientId=${encodeURIComponent(patientId)}` : '';
    const res = await fetch(
      `${API_BASE_URL}/care/notifications/history${query}`,
      { headers }
    );
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to load notification history');
    return { success: true, data: data.data || [] };
  } catch (error) {
    return { success: false, error: error.message, data: [] };
  }
}

/**
 * Register a new independent patient profile
 */
export async function registerPatient(patientData, role = null) {
  try {
    const headers = {
      'Content-Type': 'application/json',
      ...getAuthHeaders(null, role),
    };
    const res = await fetch(`${API_BASE_URL}/patients/register`, {
      method: 'POST',
      headers,
      body: JSON.stringify(patientData),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to register patient profile');
    if (data.data?.token) {
      setStoredToken(data.data.token, 'patient', data.data.patientId);
    }
    return { success: true, data: data.data };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Retrieve registered patient profiles
 */
export async function getPatients(patientId = null, role = null) {
  try {
    const headers = getAuthHeaders(patientId, role);
    const res = await fetch(`${API_BASE_URL}/patients`, { headers });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to retrieve patient profiles');
    return {
      success: true,
      data: data.data || [],
      count: data.count !== undefined ? data.count : (data.data ? data.data.length : 0),
    };
  } catch (error) {
    return { success: false, error: error.message, data: [], count: 0 };
  }
}

/**
 * Retrieve authenticated patient's current profile and latest prediction
 */
export async function getCurrentPatient(patientId, role = null) {
  try {
    const headers = getAuthHeaders(patientId, role);
    const res = await fetch(`${API_BASE_URL}/patients/me`, { headers });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to fetch patient profile');
    return { success: true, data: data.data };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Update authenticated patient profile
 */
export async function updatePatientProfile(patientData, patientId, role = null) {
  try {
    const headers = {
      'Content-Type': 'application/json',
      ...getAuthHeaders(patientId, role),
    };
    const res = await fetch(`${API_BASE_URL}/patients/me`, {
      method: 'PUT',
      headers,
      body: JSON.stringify(patientData),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to update patient profile');
    return { success: true, data: data.data };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Seed canonical demo patients (A, B, C, D) in development/evaluation
 */
export async function seedDemoPatients(role = 'researcher') {
  try {
    const headers = {
      'Content-Type': 'application/json',
      ...getAuthHeaders(null, role || 'researcher'),
    };
    const res = await fetch(`${API_BASE_URL}/patients/seed-demo`, {
      method: 'POST',
      headers,
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to seed demo patients');
    return {
      success: true,
      message: data.message,
      createdCount: data.createdCount,
      existingCount: data.existingCount,
      data: data.data,
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
}


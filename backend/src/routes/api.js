const express = require('express');
const router = express.Router();

const upload = require('../middlewares/upload');
const { getHealth } = require('../controllers/healthController');
const { handlePredict, handleExplain } = require('../controllers/predictController');
const { enqueueJob, getJobStatus } = require('../controllers/jobController');
const { getHistory, clearHistory, getLongitudinalHistory, compareEvaluations } = require('../controllers/historyController');
const {
  listPatientScans,
  getScanDetails,
  getScanImageStream,
  reanalyseScan,
} = require('../controllers/scanController');
const {
  getMedications,
  createMedication,
  editMedication,
  deleteMedication,
  getTodayDoses,
  updateIndividualDoseStatus,
  updateDoseStatus,
  getMedicationHistory,
  getAppointments,
  createAppointment,
  toggleChecklistItem,
  deleteAppointment,
} = require('../controllers/careController');
const {
  getNotificationSettings,
  updateNotificationSettings,
  sendTestNotification,
  processScheduled,
  getNotificationHistory,
} = require('../controllers/notificationController');
const {
  registerPatient,
  listPatients,
  getCurrentPatient,
  updatePatientProfile,
  seedDemoPatients,
} = require('../controllers/patientController');
const {
  getAuthMe,
  loginPatient,
  devSessionBootstrap,
} = require('../controllers/authController');
const { resolveUserIdentity, requirePatientAuth } = require('../middlewares/auth');

// Apply identity resolver across care and patient routes
router.use(resolveUserIdentity);

const rateLimit = require('express-rate-limit');

// Specialized rate limiters for expensive/sensitive operations
const predictLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60, // 60 inferences/min per IP
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Prediction rate limit reached. Please wait a moment before analyzing more scans.' },
});

const registerLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30, // 30 registrations per 15 min per IP
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Registration rate limit reached. Please try again later.' },
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 60, // 60 requests per 15 min per IP
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Authentication rate limit reached. Please try again later.' },
});

// Authentication endpoints
router.get('/auth/me', getAuthMe);
router.post('/auth/login', authLimiter, loginPatient);
router.post('/auth/dev-session', authLimiter, devSessionBootstrap);

// Patient Registration and Management endpoints
router.post('/patients/register', registerLimiter, registerPatient);
router.get('/patients', listPatients);
router.get('/patients/me', requirePatientAuth, getCurrentPatient);
router.put('/patients/me', requirePatientAuth, updatePatientProfile);
router.post('/patients/seed-demo', seedDemoPatients);

// Health endpoint
router.get('/health', getHealth);

// AI inference endpoints with binary magic-bytes signature verification
router.post('/predict', predictLimiter, upload.single('image'), upload.validateUploadedScan, handlePredict);
router.post('/predict/async', predictLimiter, upload.single('image'), upload.validateUploadedScan, enqueueJob);
router.get('/jobs/:jobId', getJobStatus);
router.post('/explain', predictLimiter, upload.single('image'), upload.validateUploadedScan, handleExplain);

// Persistent MRI Scans & Reanalysis endpoints
router.get('/scans', listPatientScans);
router.get('/scans/:scanId', getScanDetails);
router.get('/scans/:scanId/image', getScanImageStream);
router.post('/scans/:scanId/reanalyse', predictLimiter, reanalyseScan);

// Prediction history & Longitudinal research endpoints
router.get('/history', getHistory);
router.get('/history/longitudinal', getLongitudinalHistory);
router.get('/history/compare', compareEvaluations);
router.delete('/history', requirePatientAuth, clearHistory);

// Patient Care: Medications endpoints
router.get('/care/medications', getMedications);
router.post('/care/medications', createMedication);
router.get('/care/medications/today', getTodayDoses);
router.get('/care/medications/history', getMedicationHistory);
router.patch('/care/medications/doses/:doseId', updateIndividualDoseStatus);
router.put('/care/medications/:id', editMedication);
router.patch('/care/medications/:id/dose', updateDoseStatus);
router.delete('/care/medications/:id', deleteMedication);

// Patient Care: Appointments endpoints
router.get('/care/appointments', getAppointments);
router.post('/care/appointments', createAppointment);
router.patch('/care/appointments/:id/checklist', toggleChecklistItem);
router.delete('/care/appointments/:id', deleteAppointment);

// Patient Care: Email Notifications & Reminders endpoints
router.get('/care/notifications/settings', getNotificationSettings);
router.put('/care/notifications/settings', updateNotificationSettings);
router.post('/care/notifications/test', sendTestNotification);
router.post('/care/notifications/process-scheduled', processScheduled);
router.get('/care/notifications/history', getNotificationHistory);

module.exports = router;

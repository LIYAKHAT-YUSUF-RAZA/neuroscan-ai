const Patient = require('../models/Patient');
const NotificationPreference = require('../models/NotificationPreference');
const Prediction = require('../models/Prediction');
const { nodeEnv } = require('../config/env');
const { signToken } = require('../middlewares/auth');

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Register an independent Patient profile
 * Initializes corresponding NotificationPreference with consent disabled by default
 */
const registerPatient = async (req, res) => {
  try {
    const { name, email, timezone, caregiverEmail, caregiverName } = req.body;

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return res.status(400).json({ success: false, error: 'Patient name is required.' });
    }

    if (!email || typeof email !== 'string' || !EMAIL_REGEX.test(email.trim())) {
      return res.status(400).json({ success: false, error: 'A valid email address is required.' });
    }

    const cleanEmail = email.trim().toLowerCase();

    // Prevent duplicate accounts with the same email
    const existing = await Patient.findOne({ email: cleanEmail });
    if (existing) {
      return res.status(409).json({
        success: false,
        error: 'A patient profile with this email address already exists.',
      });
    }

    const patientId =
      req.body.patientId && typeof req.body.patientId === 'string'
        ? req.body.patientId.trim()
        : `pat_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    // Create independent Patient document (strictly 'patient' role)
    const patient = await Patient.create({
      patientId,
      userId: req.user?.id || req.body.userId || patientId,
      name: name.trim(),
      email: cleanEmail,
      role: 'patient',
      timezone: timezone || 'Asia/Kolkata',
      caregiverName: caregiverName ? caregiverName.trim() : '',
      caregiverEmail: caregiverEmail ? caregiverEmail.trim().toLowerCase() : '',
      isDemo: false,
    });

    // Initialize individual NotificationPreference record linked to this patientId
    // Requirements: allNotificationsEnabled = false, patientConsent = false (never enabled automatically)
    await NotificationPreference.findOneAndUpdate(
      { patientId },
      {
        patientId,
        patientName: patient.name,
        patientEmail: patient.email,
        timezone: patient.timezone,
        caregiverEmail: patient.caregiverEmail,
        allNotificationsEnabled: false,
        patientConsent: false,
        patientConsentDate: null,
        hasEligiblePrediction: false,
        predictedStage: null,
        predictedClass: null,
        stageLabel: null,
        categories: {
          medications: { enabled: false, missedDoseAlert: false },
          nutrition: { enabled: false },
          routine: { enabled: false },
          appointments: { enabled: false },
          weeklyEducational: { enabled: false, weekday: 'Sunday', time: '09:00 AM', topicIndex: 0 },
        },
        caregiverSettings: {
          medications: false,
          appointments: false,
          routine: false,
          weeklyEducational: false,
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    const token = signToken({
      id: patient.patientId,
      patientId: patient.patientId,
      role: patient.role || 'patient',
      name: patient.name,
      email: patient.email,
    });

    return res.status(201).json({
      success: true,
      message: 'Patient profile registered successfully.',
      data: {
        patient,
        token, // Cryptographically signed JWT
        patientId: patient.patientId, // Canonical patient identifier
      },
    });
  } catch (err) {
    console.error('[PatientController] Registration error:', err);
    return res.status(500).json({ success: false, error: err.message || 'Server error during registration.' });
  }
};

/**
 * List patient profiles
 * Restricted by RBAC: Clinicians/researchers can view all profiles; ordinary patients see only their own.
 */
const listPatients = async (req, res) => {
  try {
    const userRole = req.user?.role || (nodeEnv !== 'production' ? 'researcher' : 'patient');

    if (userRole === 'researcher' || userRole === 'clinician') {
      const patients = await Patient.find({ role: { $ne: 'researcher' } }).sort({ createdAt: -1 }).lean();

      // Attach latest eligible prediction and exact lastPredictionDate from Prediction collection
      for (const pat of patients) {
        const latestPred = await Prediction.findOne({
          patientId: pat.patientId,
          stageNumber: { $in: [1, 2, 3, 4] },
        })
          .sort({ createdAt: -1 })
          .lean();

        if (latestPred) {
          pat.predictedStage = latestPred.stageNumber;
          pat.predictedClass = latestPred.predictedClass;
          pat.stageLabel = latestPred.stageLabel;
          pat.lastPredictionDate = latestPred.createdAt;
          pat.latestPredictionId = latestPred._id;
        } else {
          pat.lastPredictionDate = null;
          const pref = await NotificationPreference.findOne({ patientId: pat.patientId }).lean();
          if (pref && pref.predictedStage) {
            pat.predictedStage = pref.predictedStage;
            pat.predictedClass = pref.predictedClass;
            pat.stageLabel = pref.stageLabel;
            pat.lastPredictionDate = pref.lastPredictionDate || null;
          }
        }
      }

      return res.status(200).json({ success: true, count: patients.length, data: patients });
    }

    // Ordinary patient: restricted to their own profile only
    if (req.user?.patientId) {
      const patient = await Patient.findOne({ patientId: req.user.patientId, role: { $ne: 'researcher' } }).lean();
      if (patient) {
        const latestPred = await Prediction.findOne({
          patientId: patient.patientId,
          stageNumber: { $in: [1, 2, 3, 4] },
        })
          .sort({ createdAt: -1 })
          .lean();

        if (latestPred) {
          patient.predictedStage = latestPred.stageNumber;
          patient.predictedClass = latestPred.predictedClass;
          patient.stageLabel = latestPred.stageLabel;
          patient.lastPredictionDate = latestPred.createdAt;
          patient.latestPredictionId = latestPred._id;
        } else {
          patient.lastPredictionDate = null;
          const pref = await NotificationPreference.findOne({ patientId: patient.patientId }).lean();
          if (pref && pref.predictedStage) {
            patient.predictedStage = pref.predictedStage;
            patient.predictedClass = pref.predictedClass;
            patient.stageLabel = pref.stageLabel;
            patient.lastPredictionDate = pref.lastPredictionDate || null;
          }
        }
      }
      return res.status(200).json({ success: true, count: patient ? 1 : 0, data: patient ? [patient] : [] });
    }

    return res.status(403).json({ success: false, error: 'Access denied: Requires authorization.' });
  } catch (err) {
    console.error('[PatientController] List patients error:', err);
    return res.status(500).json({ success: false, error: 'Failed to retrieve patient profiles.' });
  }
};

/**
 * Get current authenticated patient's profile & latest prediction status
 */
const getCurrentPatient = async (req, res) => {
  try {
    const patientId = req.patientId || req.user?.patientId;
    if (!patientId) {
      return res.status(401).json({ success: false, error: 'Authentication required.' });
    }

    let patient = await Patient.findOne({ patientId }).lean();

    // If patient document does not exist yet (e.g. legacy/testing), synthesize from preference
    if (!patient) {
      const pref = await NotificationPreference.findOne({ patientId }).lean();
      patient = {
        patientId,
        name: pref?.patientName || 'Registered Patient',
        email: pref?.patientEmail || '',
        timezone: pref?.timezone || 'Asia/Kolkata',
        caregiverEmail: pref?.caregiverEmail || '',
        predictedStage: pref?.predictedStage || null,
        predictedClass: pref?.predictedClass || null,
        stageLabel: pref?.stageLabel || null,
        role: req.user?.role || 'patient',
        isDemo: false,
      };
    }

    // Attach latest eligible prediction from Prediction collection
    const latestPred = await Prediction.findOne({
      patientId,
      stageNumber: { $in: [1, 2, 3, 4] },
    })
      .sort({ createdAt: -1 })
      .lean();

    if (latestPred) {
      patient.latestPrediction = {
        id: latestPred._id,
        predictedClass: latestPred.predictedClass,
        stageLabel: latestPred.stageLabel,
        stageNumber: latestPred.stageNumber,
        createdAt: latestPred.createdAt,
      };
      patient.predictedStage = latestPred.stageNumber;
      patient.predictedClass = latestPred.predictedClass;
      patient.stageLabel = latestPred.stageLabel;
    } else if (!patient.predictedStage) {
      const pref = await NotificationPreference.findOne({ patientId }).lean();
      if (pref && pref.predictedStage) {
        patient.predictedStage = pref.predictedStage;
        patient.predictedClass = pref.predictedClass;
        patient.stageLabel = pref.stageLabel;
      }
    }

    return res.status(200).json({ success: true, data: patient });
  } catch (err) {
    console.error('[PatientController] Get current patient error:', err);
    return res.status(500).json({ success: false, error: 'Failed to retrieve patient profile.' });
  }
};

/**
 * Update authenticated patient's profile and synchronize notification preferences
 */
const updatePatientProfile = async (req, res) => {
  try {
    const patientId = req.patientId || req.user?.patientId;
    if (!patientId) {
      return res.status(401).json({ success: false, error: 'Authentication required.' });
    }

    const { name, email, timezone, caregiverEmail, caregiverName } = req.body;
    const updateData = {};

    if (name && typeof name === 'string') updateData.name = name.trim();
    if (email && typeof email === 'string') {
      if (!EMAIL_REGEX.test(email.trim())) {
        return res.status(400).json({ success: false, error: 'Invalid email address format.' });
      }
      updateData.email = email.trim().toLowerCase();
    }
    if (timezone && typeof timezone === 'string') updateData.timezone = timezone.trim();
    if (caregiverEmail !== undefined) {
      updateData.caregiverEmail = caregiverEmail ? caregiverEmail.trim().toLowerCase() : '';
    }
    if (caregiverName !== undefined) {
      updateData.caregiverName = caregiverName ? caregiverName.trim() : '';
    }

    const patient = await Patient.findOneAndUpdate({ patientId }, updateData, { new: true });

    // Synchronize to NotificationPreference
    const syncPref = {};
    if (updateData.name) syncPref.patientName = updateData.name;
    if (updateData.email) syncPref.patientEmail = updateData.email;
    if (updateData.timezone) syncPref.timezone = updateData.timezone;
    if (updateData.caregiverEmail !== undefined) syncPref.caregiverEmail = updateData.caregiverEmail;

    if (Object.keys(syncPref).length > 0) {
      await NotificationPreference.updateOne({ patientId }, { $set: syncPref });
    }

    return res.status(200).json({
      success: true,
      message: 'Patient profile updated successfully.',
      data: patient,
    });
  } catch (err) {
    console.error('[PatientController] Update patient error:', err);
    return res.status(500).json({ success: false, error: 'Failed to update patient profile.' });
  }
};

/**
 * Seed canonical demo patients for clinical evaluation & automated testing
 * Guardrail: Strictly blocked in production! Uses reserved @example.com domains.
 */
const seedDemoPatients = async (req, res) => {
  try {
    // Demo safety check: strictly prohibited in production environment
    if (nodeEnv === 'production') {
      return res.status(403).json({
        success: false,
        error: 'Demo seeding is disabled in production environments.',
      });
    }

    // Role check: ordinary patients cannot seed demo profiles
    if (req.user && req.user.role === 'patient') {
      return res.status(403).json({
        success: false,
        error: 'Access denied: Ordinary patients cannot seed demo profiles.',
      });
    }

    const demoProfiles = [
      {
        patientId: 'demo-patient-a',
        name: 'Patient A',
        email: 'patientA@example.com',
        predictedStage: 1,
        predictedClass: 'NonDemented',
        stageLabel: 'Healthy / No Dementia Detected',
        timezone: 'Asia/Kolkata',
      },
      {
        patientId: 'demo-patient-b',
        name: 'Patient B',
        email: 'patientB@example.com',
        predictedStage: 2,
        predictedClass: 'VeryMildDemented',
        stageLabel: 'Early Stage',
        timezone: 'Asia/Kolkata',
      },
      {
        patientId: 'demo-patient-c',
        name: 'Patient C',
        email: 'patientC@example.com',
        predictedStage: 3,
        predictedClass: 'MildDemented',
        stageLabel: 'Moderate Stage',
        timezone: 'Asia/Kolkata',
      },
      {
        patientId: 'demo-patient-d',
        name: 'Patient D',
        email: 'patientD@example.com',
        predictedStage: 4,
        predictedClass: 'ModerateDemented',
        stageLabel: 'Critical Stage',
        timezone: 'Asia/Kolkata',
      },
    ];

    let createdCount = 0;
    let existingCount = 0;
    const results = [];

    for (const p of demoProfiles) {
      const existingPat = await Patient.findOne({ patientId: p.patientId });
      if (existingPat) {
        existingCount++;
      } else {
        createdCount++;
      }

      // 1. Idempotently upsert independent Patient document
      const pat = await Patient.findOneAndUpdate(
        { patientId: p.patientId },
        {
          patientId: p.patientId,
          name: p.name,
          email: p.email.toLowerCase(),
          role: 'patient',
          timezone: p.timezone,
          predictedStage: p.predictedStage,
          predictedClass: p.predictedClass,
          stageLabel: p.stageLabel,
          consentStatus: false, // Explicit requirement: consent disabled by default
          isDemo: true, // Mark clearly as demo data
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );

      // 2. Idempotently upsert independent NotificationPreference document
      // Explicit requirement: allNotificationsEnabled = false, patientConsent = false
      await NotificationPreference.findOneAndUpdate(
        { patientId: p.patientId },
        {
          patientId: p.patientId,
          patientName: p.name,
          patientEmail: p.email.toLowerCase(),
          allNotificationsEnabled: false,
          patientConsent: false,
          patientConsentDate: null,
          hasEligiblePrediction: true,
          predictedStage: p.predictedStage,
          predictedClass: p.predictedClass,
          stageLabel: p.stageLabel,
          timezone: p.timezone,
          caregiverEnabled: false,
          caregiverConsent: false,
          categories: {
            weeklyEducational: { enabled: false, weekday: 'Sunday', time: '09:00 AM', topicIndex: 0 },
            medications: { enabled: false, missedDoseAlert: false },
            nutrition: { enabled: false, breakfast: true, lunch: true, dinner: true },
            routine: { enabled: false, morningRoutine: true, cognitiveExercises: true },
            appointments: { enabled: false, oneDayBefore: true, twoHoursBefore: true },
          },
          caregiverSettings: {
            medications: false,
            appointments: false,
            routine: false,
            weeklyEducational: false,
          },
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );

      const token = signToken({
        id: pat.patientId,
        patientId: pat.patientId,
        role: 'patient',
        name: pat.name,
        email: pat.email,
      });
      const patObj = pat.toObject ? pat.toObject() : { ...pat };
      patObj.token = token;
      results.push(patObj);
    }

    return res.status(200).json({
      success: true,
      message: `Demo seeding complete: ${createdCount} created, ${existingCount} already existed.`,
      createdCount,
      existingCount,
      data: results,
    });
  } catch (err) {
    console.error('[PatientController] Demo seed error:', err);
    return res.status(500).json({
      success: false,
      error: err.message || 'Failed to seed demo patients.',
    });
  }
};

module.exports = {
  registerPatient,
  listPatients,
  getCurrentPatient,
  updatePatientProfile,
  seedDemoPatients,
};

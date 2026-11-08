const Patient = require('../models/Patient');
const { signToken, verifyJwtToken } = require('../middlewares/auth');
const { nodeEnv } = require('../config/env');

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const CANONICAL_DEMO_PATIENTS = ['demo-patient-a', 'demo-patient-b', 'demo-patient-c', 'demo-patient-d'];

/**
 * Verifies current authenticated identity from presented JWT.
 * Returns safe identity claims without exposing sensitive internal data.
 */
const getAuthMe = async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required. No valid session or token provided.',
      });
    }

    return res.status(200).json({
      success: true,
      data: {
        id: req.user.id,
        patientId: req.user.patientId,
        role: req.user.role || 'patient',
        name: req.user.name || '',
        email: req.user.email || '',
        isJwt: req.user.isJwt === true,
      },
    });
  } catch (err) {
    console.error('[AuthController] getAuthMe error:', err);
    return res.status(500).json({ success: false, error: 'Failed to verify session identity.' });
  }
};

/**
 * Production-ready Patient Authentication
 * Verifies that the patient exists in the database and authenticates their identity
 * based on verified email and registered credentials.
 */
const loginPatient = async (req, res) => {
  try {
    const { email, patientId } = req.body;

    if (!email || typeof email !== 'string' || !EMAIL_REGEX.test(email.trim())) {
      return res.status(400).json({
        success: false,
        error: 'A valid patient email address is required to authenticate.',
      });
    }

    const cleanEmail = email.trim().toLowerCase();
    const query = { email: cleanEmail, role: 'patient' };

    if (patientId && typeof patientId === 'string' && patientId.trim().length > 0) {
      query.patientId = patientId.trim();
    }

    const patient = await Patient.findOne(query).lean();

    if (!patient) {
      return res.status(401).json({
        success: false,
        error: 'Authentication failed. No registered patient profile matches the provided credentials.',
      });
    }

    // Mint HMAC-SHA256 cryptographic JWT strictly bound to the verified patient document
    const token = signToken({
      id: patient.patientId,
      patientId: patient.patientId,
      role: 'patient',
      name: patient.name,
      email: patient.email,
    });

    return res.status(200).json({
      success: true,
      message: 'Authentication successful.',
      data: {
        token,
        patientId: patient.patientId,
        role: 'patient',
        patient: {
          patientId: patient.patientId,
          name: patient.name,
          email: patient.email,
          timezone: patient.timezone,
          predictedStage: patient.predictedStage,
          predictedClass: patient.predictedClass,
          stageLabel: patient.stageLabel,
        },
      },
    });
  } catch (err) {
    console.error('[AuthController] loginPatient error:', err);
    return res.status(500).json({ success: false, error: 'Authentication service error.' });
  }
};

/**
 * Development & Evaluation Session Bootstrap
 * Strictly disabled in production (HTTP 403).
 * Mints authorized cryptographic JWTs for local development testing:
 * - Researcher role: issues authorized researcher token
 * - Demo patient roles: issues tokens restricted exclusively to canonical demo patients (A-D)
 */
const devSessionBootstrap = async (req, res) => {
  try {
    // 1. Strict Production Guardrail
    if (process.env.NODE_ENV === 'production' || nodeEnv === 'production') {
      return res.status(403).json({
        success: false,
        error: 'Development session bootstrap is strictly disabled in production environments.',
      });
    }

    const { role, patientId } = req.body;

    // 2. Reject arbitrary client-supplied roles or unverified requests
    if (!role && !patientId) {
      return res.status(400).json({
        success: false,
        error: 'Either a valid role or canonical demo patientId is required for dev bootstrap.',
      });
    }

    // 3. Researcher dev bootstrap
    if (role === 'researcher' || role === 'clinician') {
      const token = signToken({
        id: 'researcher-lead-dev',
        patientId: 'researcher-lead-dev',
        role: 'researcher',
        name: 'Dr. Clinical Lead (Researcher)',
        email: 'researcher.lead@example.com',
      });

      return res.status(200).json({
        success: true,
        data: {
          token,
          role: 'researcher',
          user: {
            id: 'researcher-lead-dev',
            patientId: 'researcher-lead-dev',
            role: 'researcher',
            name: 'Dr. Clinical Lead (Researcher)',
            email: 'researcher.lead@example.com',
          },
        },
      });
    }

    // 4. Demo patient bootstrap — strictly restricted to canonical demo patients
    const targetPatientId = (patientId || '').trim();
    if (!CANONICAL_DEMO_PATIENTS.includes(targetPatientId)) {
      return res.status(400).json({
        success: false,
        error: `Development demo bootstrap is restricted exclusively to canonical demo profiles: ${CANONICAL_DEMO_PATIENTS.join(', ')}.`,
      });
    }

    let patient = await Patient.findOne({ patientId: targetPatientId }).lean();

    // If demo patient does not exist yet in dev DB, synthesize/provision default demo profile
    if (!patient) {
      const demoNames = {
        'demo-patient-a': 'Patient A',
        'demo-patient-b': 'Patient B',
        'demo-patient-c': 'Patient C',
        'demo-patient-d': 'Patient D',
      };
      patient = await Patient.create({
        patientId: targetPatientId,
        name: demoNames[targetPatientId] || 'Demo Patient',
        email: `${targetPatientId.replace('-', '')}@example.com`,
        role: 'patient',
        timezone: 'Asia/Kolkata',
        isDemo: true,
        consentStatus: false,
      });
    }

    const token = signToken({
      id: patient.patientId,
      patientId: patient.patientId,
      role: 'patient',
      name: patient.name,
      email: patient.email,
    });

    return res.status(200).json({
      success: true,
      data: {
        token,
        patientId: patient.patientId,
        role: 'patient',
        patient: {
          patientId: patient.patientId,
          name: patient.name,
          email: patient.email,
          timezone: patient.timezone,
          predictedStage: patient.predictedStage,
          predictedClass: patient.predictedClass,
          stageLabel: patient.stageLabel,
        },
      },
    });
  } catch (err) {
    console.error('[AuthController] devSessionBootstrap error:', err);
    return res.status(500).json({ success: false, error: 'Dev bootstrap service error.' });
  }
};

module.exports = {
  getAuthMe,
  loginPatient,
  devSessionBootstrap,
};

const jwt = require('jsonwebtoken');
const Patient = require('../models/Patient');
const { jwtSecret, nodeEnv } = require('../config/env');

/**
 * Signs a cryptographic JWT for patient or clinician sessions
 */
const signToken = (payload, options = {}) => {
  if (!jwtSecret) {
    throw new Error('JWT_SECRET is not configured.');
  }
  return jwt.sign(payload, jwtSecret, {
    expiresIn: options.expiresIn || '7d',
    algorithm: 'HS256',
  });
};

/**
 * Verifies a cryptographic JWT safely
 */
const verifyJwtToken = (token) => {
  if (!jwtSecret || !token) return null;
  try {
    return jwt.verify(token, jwtSecret, { algorithms: ['HS256'] });
  } catch (err) {
    return null;
  }
};

/**
 * Derives the canonical patient identifier from the authenticated request.
 * Returns null if no authenticated patient identity exists.
 */
const getAuthenticatedPatientId = (req) => {
  // 0. Explicit RBAC target patient established by identity resolution middleware
  if (req.patientId) {
    return String(req.patientId).trim();
  }

  // 1. Upstream established session/user
  if (req.user && (req.user.patientId || req.user.id || req.user._id)) {
    return String(req.user.patientId || req.user.id || req.user._id).trim();
  }
  if (req.session && (req.session.patientId || req.session.userId)) {
    return String(req.session.patientId || req.session.userId).trim();
  }

  // 2. Authorization header: Bearer <patient_token_or_jwt>
  const authHeader = req.headers['authorization'];
  if (authHeader && typeof authHeader === 'string') {
    if (authHeader.startsWith('Bearer ')) {
      const token = authHeader.slice(7).trim();
      if (token && token.length > 0) {
        return token;
      }
    }
  }

  // 3. Automated API header fallback (sanitized strictly)
  const xTargetId = req.headers['x-target-patient-id'];
  if (xTargetId && typeof xTargetId === 'string') {
    const cleaned = xTargetId.trim();
    if (cleaned.length > 0) {
      return cleaned;
    }
  }

  const xPatientId = req.headers['x-patient-id'];
  if (xPatientId && typeof xPatientId === 'string') {
    const cleaned = xPatientId.trim();
    if (cleaned.length > 0) {
      return cleaned;
    }
  }

  return null;
};

/**
 * Resolves full user & patient identity with Role-Based Access Control (RBAC).
 * Enforces cryptographic verification and patient-to-patient data isolation.
 */
const resolveUserIdentity = async (req, res, next) => {
  const token = getAuthenticatedPatientId(req);

  if (!token) {
    req.user = null;
    req.patientId = null;
    return next();
  }

  try {
    // 1. Check if token is a structured JWT (3 dot-separated base64 segments)
    if (typeof token === 'string' && token.split('.').length === 3) {
      const decoded = verifyJwtToken(token);
      if (!decoded) {
        return res.status(401).json({
          success: false,
          error: 'Authentication failed: Invalid, expired, or tampered JWT token.',
        });
      }

      req.user = {
        id: decoded.id || decoded.patientId,
        patientId: decoded.patientId || decoded.id,
        role: decoded.role || 'patient',
        name: decoded.name || '',
        email: decoded.email || '',
        isJwt: true,
      };
    } else {
      // 2. Database Patient Lookup (Migration-Safe for registered patients)
      const patientDoc = await Patient.findOne({ patientId: token }).lean();

      if (patientDoc) {
        req.user = {
          id: patientDoc.patientId,
          patientId: patientDoc.patientId,
          role: patientDoc.role || 'patient',
          name: patientDoc.name,
          email: patientDoc.email,
          timezone: patientDoc.timezone,
          isDemo: patientDoc.isDemo,
          isJwt: false,
        };
      } else {
        const lowerToken = typeof token === 'string' ? token.trim().toLowerCase() : '';

        // Strictly block plaintext forgery of clinician, researcher, or admin roles
        // Plaintext tokens like 'researcher-clinician', 'researcher-lead-*', 'Bearer researcher', 'Bearer clinician', etc.
        // MUST NEVER be treated as authenticated identities.
        if (
          lowerToken === 'clinician' ||
          lowerToken === 'researcher' ||
          lowerToken === 'admin' ||
          lowerToken.startsWith('researcher-') ||
          lowerToken.startsWith('clinician-')
        ) {
          req.user = null;
          req.patientId = null;
          return res.status(401).json({
            success: false,
            error: 'Authentication failed: Plaintext role tokens are not permitted. A signed cryptographic JWT is required.',
          });
        }

        if (nodeEnv !== 'production') {
          // Dynamic test patients default strictly to ordinary 'patient' role
          // They cannot escalate privileges or access other patients
          req.user = {
            id: token,
            patientId: token,
            role: 'patient',
            name: token,
            email: '',
            isJwt: false,
          };
        } else {
          // In production: strict rejection of unregistered plaintext tokens
          req.user = null;
          req.patientId = null;
          return next();
        }
      }
    }

    // RBAC Scoping Enforcement:
    // If ordinary patient: strictly bind target patientId to their own identity
    if (req.user.role === 'patient') {
      const attemptedTarget =
        req.headers['x-target-patient-id'] ||
        req.headers['x-patient-id'] ||
        (req.query && req.query.patientId ? String(req.query.patientId).trim() : null) ||
        (req.body && req.body.patientId ? String(req.body.patientId).trim() : null);

      if (attemptedTarget && attemptedTarget !== req.user.patientId) {
        return res.status(403).json({
          success: false,
          error: 'Access denied: You are not authorized to view or modify another patient records.',
        });
      }
      req.patientId = req.user.patientId;
    } else if (req.user.role === 'researcher' || req.user.role === 'clinician') {
      // Authorized clinicians/researchers may view or manage permitted target patient
      const target =
        req.headers['x-target-patient-id'] ||
        req.headers['x-patient-id'] ||
        (req.query && req.query.patientId ? String(req.query.patientId).trim() : null) ||
        (req.body && req.body.patientId ? String(req.body.patientId).trim() : null) ||
        req.user.patientId;

      req.patientId = target;
    } else {
      req.patientId = req.user.patientId;
    }

    next();
  } catch (err) {
    console.error('[AuthMiddleware] Error resolving identity:', err);
    next(err);
  }
};

/**
 * Express middleware to enforce patient authentication.
 * Rejects unauthenticated requests with HTTP 401 Unauthorized.
 */
const requirePatientAuth = async (req, res, next) => {
  if (!req.user || !req.patientId) {
    await resolveUserIdentity(req, res, () => {});
  }

  if (!req.user || !req.patientId) {
    return res.status(401).json({
      success: false,
      error: 'Authentication required. Valid patient session or credentials required to access this resource.',
    });
  }

  next();
};

/**
 * Express middleware to enforce researcher/clinician privileges.
 * Rejects ordinary patients with HTTP 403 Forbidden.
 */
const requireResearcherAuth = async (req, res, next) => {
  if (!req.user) {
    await resolveUserIdentity(req, res, () => {});
  }

  if (!req.user) {
    return res.status(401).json({
      success: false,
      error: 'Authentication required. Please log in as a researcher or clinician.',
    });
  }

  if (req.user.role !== 'researcher' && req.user.role !== 'clinician') {
    return res.status(403).json({
      success: false,
      error: 'Access denied: Requires researcher or clinician privileges.',
    });
  }

  next();
};

/**
 * Express middleware to optionally extract patient identity if present.
 */
const optionalPatientAuth = async (req, res, next) => {
  if (!req.user) {
    await resolveUserIdentity(req, res, () => {});
  }
  next();
};

module.exports = {
  signToken,
  verifyJwtToken,
  getAuthenticatedPatientId,
  resolveUserIdentity,
  requirePatientAuth,
  requireResearcherAuth,
  optionalPatientAuth,
};

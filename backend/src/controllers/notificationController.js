const NotificationPreference = require('../models/NotificationPreference');
const NotificationDelivery = require('../models/NotificationDelivery');
const Prediction = require('../models/Prediction');
const Patient = require('../models/Patient');
const { getDBStatus } = require('../config/db');
const { nodeEnv, schedulerSecretKey } = require('../config/env');
const {
  isSmtpConfigured,
  sendTestEmail,
  sendWeeklyEducationalEmail,
  getStageEducationalContent,
} = require('../services/emailService');
const { processScheduledNotifications } = require('../services/notificationScheduler');
const { getAuthenticatedPatientId } = require('../middlewares/auth');

/**
 * Derive patient ID securely from authenticated session or credentials.
 * Never defaults to 'default-patient'.
 */
const getPatientId = (req) => {
  return getAuthenticatedPatientId(req);
};

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * GET /api/care/notifications/settings
 */
const getNotificationSettings = async (req, res, next) => {
  try {
    const patientId = getPatientId(req);

    if (!patientId) {
      return res.status(401).json({
        error: 'Authentication required. Valid patient session or credentials required.',
      });
    }

    if (!getDBStatus()) {
      return res.status(503).json({
        error: 'Database connection is currently offline. Notification preferences unavailable.',
      });
    }

    let pref = await NotificationPreference.findOne({ patientId });
    const patientDoc = await Patient.findOne({ patientId }).lean();

    // Look up latest eligible saved prediction for this patient
    const latestPrediction = await Prediction.findOne({
      patientId,
      stageNumber: { $exists: true },
    }).sort({ createdAt: -1 });

    if (!pref) {
      // Default preferences with consent and alerts disabled by default, reusing registered profile if available
      pref = {
        patientId,
        allNotificationsEnabled: false,
        patientConsent: false,
        patientEmail: patientDoc?.email || '',
        patientName: patientDoc?.name || '',
        caregiverEmail: patientDoc?.caregiverEmail || '',
        caregiverEnabled: false,
        caregiverConsent: false,
        timezone: patientDoc?.timezone || 'Asia/Kolkata',
        hasEligiblePrediction: Boolean(latestPrediction),
        predictedStage: latestPrediction ? latestPrediction.stageNumber : null,
        predictedClass: latestPrediction ? latestPrediction.predictedClass : null,
        stageLabel: latestPrediction ? latestPrediction.stageLabel : null,
        lastPredictionDate: latestPrediction ? latestPrediction.createdAt : null,
        categories: {
          medications: { enabled: true, missedDoseAlert: true },
          nutrition: {
            enabled: true,
            breakfast: true,
            breakfastTime: '08:30 AM',
            lunch: true,
            lunchTime: '01:00 PM',
            snack: false,
            snackTime: '05:00 PM',
            dinner: true,
            dinnerTime: '08:00 PM',
            hydration: false,
          },
          routine: {
            enabled: true,
            morningRoutine: true,
            morningTime: '09:00 AM',
            cognitiveExercises: true,
            cognitiveTime: '11:00 AM',
            physicalActivity: true,
            physicalTime: '04:30 PM',
            sleepRoutine: true,
            sleepTime: '09:30 PM',
          },
          appointments: {
            enabled: true,
            oneDayBefore: true,
            twoHoursBefore: true,
          },
          weeklyEducational: {
            enabled: false,
            weekday: 'Sunday',
            time: '09:00 AM',
            topicIndex: 0,
          },
        },
        caregiverSettings: {
          medications: false,
          appointments: false,
          routine: false,
          weeklyEducational: false,
        },
      };
    } else if (!pref.hasEligiblePrediction && latestPrediction) {
      // Safely sync preference if a prediction was saved earlier
      pref.hasEligiblePrediction = true;
      pref.predictedStage = latestPrediction.stageNumber;
      pref.predictedClass = latestPrediction.predictedClass;
      pref.stageLabel = latestPrediction.stageLabel;
      pref.lastPredictionDate = latestPrediction.createdAt;
      await pref.save();
    }

    const categoriesData = pref.categories?.toObject ? pref.categories.toObject() : pref.categories || {};
    const caregiverData = pref.caregiverSettings?.toObject ? pref.caregiverSettings.toObject() : pref.caregiverSettings || {};

    // Direct, sanitized response with zero OTP or verification fields
    const sanitized = {
      patientId: pref.patientId,
      patientName: pref.patientName || '',
      allNotificationsEnabled: Boolean(pref.allNotificationsEnabled),
      patientConsent: Boolean(pref.patientConsent),
      patientConsentDate: pref.patientConsentDate,
      patientEmail: pref.patientEmail || '',
      caregiverEmail: pref.caregiverEmail || '',
      caregiverEnabled: Boolean(pref.caregiverEnabled),
      caregiverConsent: Boolean(pref.caregiverConsent),
      caregiverConsentDate: pref.caregiverConsentDate,
      timezone: pref.timezone || 'Asia/Kolkata',
      hasEligiblePrediction: Boolean(pref.hasEligiblePrediction),
      predictedStage: pref.predictedStage !== undefined ? pref.predictedStage : null,
      predictedClass: pref.predictedClass || null,
      stageLabel: pref.stageLabel || null,
      lastPredictionDate: pref.lastPredictionDate || null,
      categories: {
        ...categoriesData,
        weeklyEducational: categoriesData.weeklyEducational || {
          enabled: false,
          weekday: 'Sunday',
          time: '09:00 AM',
          topicIndex: 0,
        },
      },
      caregiverSettings: {
        ...caregiverData,
        weeklyEducational: Boolean(caregiverData.weeklyEducational),
      },
      isSmtpConfigured: isSmtpConfigured(),
    };

    res.status(200).json({
      success: true,
      data: sanitized,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * PUT /api/care/notifications/settings
 * Direct update: saves patient/caregiver emails and preferences without OTP.
 */
const updateNotificationSettings = async (req, res, next) => {
  try {
    const patientId = getPatientId(req);
    const {
      patientEmail,
      allNotificationsEnabled,
      patientConsent,
      categories,
      caregiverEmail,
      caregiverEnabled,
      caregiverConsent,
      caregiverSettings,
      timezone,
    } = req.body;

    if (!getDBStatus()) {
      return res.status(503).json({
        error: 'Database connection offline. Preferences cannot be updated while offline.',
      });
    }

    let pref = await NotificationPreference.findOne({ patientId });
    if (!pref) {
      pref = new NotificationPreference({ patientId });
    }

    // 1. Patient Email Validation & Direct Update
    if (patientEmail !== undefined) {
      const cleanPatientEmail = String(patientEmail).trim().toLowerCase();
      if (cleanPatientEmail && !EMAIL_REGEX.test(cleanPatientEmail)) {
        return res.status(400).json({
          error: 'Please enter a valid patient email address.',
        });
      }
      pref.patientEmail = cleanPatientEmail;
    }

    // 2. Patient Notifications & Consent Enforcement
    const effectivePatientEmail = pref.patientEmail || '';
    if (allNotificationsEnabled !== undefined) {
      if (allNotificationsEnabled) {
        if (!effectivePatientEmail) {
          return res.status(400).json({
            error: 'A valid patient email address is required to enable notifications.',
          });
        }
        if (!patientConsent && !pref.patientConsent) {
          return res.status(400).json({
            error: 'Explicit patient consent is required to enable notifications.',
          });
        }
        pref.allNotificationsEnabled = true;
        pref.patientConsent = true;
        pref.patientConsentDate = pref.patientConsentDate || new Date();
      } else {
        pref.allNotificationsEnabled = false;
      }
    }
    if (patientConsent !== undefined) {
      pref.patientConsent = Boolean(patientConsent);
      if (pref.patientConsent && !pref.patientConsentDate) {
        pref.patientConsentDate = new Date();
      }
    }

    // 3. Caregiver Email Validation & Direct Update
    if (caregiverEmail !== undefined) {
      const cleanCaregiverEmail = String(caregiverEmail).trim().toLowerCase();
      if (cleanCaregiverEmail && !EMAIL_REGEX.test(cleanCaregiverEmail)) {
        return res.status(400).json({
          error: 'Please enter a valid caregiver email address.',
        });
      }
      pref.caregiverEmail = cleanCaregiverEmail;
    }

    // 4. Caregiver Authorization Enforcement
    const effectiveCaregiverEmail = pref.caregiverEmail || '';
    if (caregiverEnabled !== undefined) {
      if (caregiverEnabled) {
        if (!effectiveCaregiverEmail) {
          return res.status(400).json({
            error: 'A valid caregiver email address is required to enable caregiver alerts.',
          });
        }
        if (!caregiverConsent && !pref.caregiverConsent) {
          return res.status(400).json({
            error: 'Patient authorization is required to enable caregiver alerts.',
          });
        }
        pref.caregiverEnabled = true;
        pref.caregiverConsent = true;
        pref.caregiverConsentDate = pref.caregiverConsentDate || new Date();
      } else {
        pref.caregiverEnabled = false;
      }
    }
    if (caregiverConsent !== undefined) {
      pref.caregiverConsent = Boolean(caregiverConsent);
      if (pref.caregiverConsent && !pref.caregiverConsentDate) {
        pref.caregiverConsentDate = new Date();
      }
    }

    // 5. Timezone, Patient Profile & Deep Category Merging
    if (timezone) pref.timezone = timezone.trim();
    if (req.body.patientName !== undefined) {
      pref.patientName = String(req.body.patientName).trim();
    }

    if (categories) {
      if (categories.medications) {
        const current = pref.categories?.medications?.toObject ? pref.categories.medications.toObject() : pref.categories?.medications || {};
        pref.categories.medications = { ...current, ...categories.medications };
      }
      if (categories.nutrition) {
        const current = pref.categories?.nutrition?.toObject ? pref.categories.nutrition.toObject() : pref.categories?.nutrition || {};
        pref.categories.nutrition = { ...current, ...categories.nutrition };
      }
      if (categories.routine) {
        const current = pref.categories?.routine?.toObject ? pref.categories.routine.toObject() : pref.categories?.routine || {};
        pref.categories.routine = { ...current, ...categories.routine };
      }
      if (categories.appointments) {
        const current = pref.categories?.appointments?.toObject ? pref.categories.appointments.toObject() : pref.categories?.appointments || {};
        pref.categories.appointments = { ...current, ...categories.appointments };
      }
      if (categories.weeklyEducational) {
        const current = pref.categories?.weeklyEducational?.toObject ? pref.categories.weeklyEducational.toObject() : pref.categories?.weeklyEducational || {};
        pref.categories.weeklyEducational = { ...current, ...categories.weeklyEducational };
      }
    }
    if (caregiverSettings) {
      const current = pref.caregiverSettings?.toObject ? pref.caregiverSettings.toObject() : pref.caregiverSettings || {};
      pref.caregiverSettings = { ...current, ...caregiverSettings };
    }

    await pref.save();

    // Synchronize registered Patient profile with updated email/name
    await Patient.updateOne(
      { patientId },
      {
        $set: {
          name: pref.patientName,
          email: pref.patientEmail,
          timezone: pref.timezone,
          caregiverEmail: pref.caregiverEmail,
        },
      }
    );

    res.status(200).json({
      success: true,
      message: 'Notification preferences updated successfully.',
      data: {
        allNotificationsEnabled: pref.allNotificationsEnabled,
        patientConsent: pref.patientConsent,
        patientEmail: pref.patientEmail,
        patientName: pref.patientName || '',
        caregiverEnabled: pref.caregiverEnabled,
        caregiverEmail: pref.caregiverEmail,
        caregiverConsent: pref.caregiverConsent,
        timezone: pref.timezone,
        hasEligiblePrediction: Boolean(pref.hasEligiblePrediction),
        predictedStage: pref.predictedStage !== undefined ? pref.predictedStage : null,
        predictedClass: pref.predictedClass || null,
        stageLabel: pref.stageLabel || null,
        categories: pref.categories,
        caregiverSettings: pref.caregiverSettings,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/care/notifications/test
 * Sends a test notification to the saved email address with rate limiting.
 */
const sendTestNotification = async (req, res, next) => {
  try {
    const patientId = getPatientId(req);
    const { target = 'patient' } = req.body;

    if (!patientId) {
      return res.status(401).json({ error: 'Authentication required.' });
    }

    if (!getDBStatus()) {
      return res.status(503).json({ error: 'Database unavailable.' });
    }

    const pref = await NotificationPreference.findOne({ patientId });
    if (!pref) {
      return res.status(404).json({ error: 'Notification preferences not found.' });
    }

    // Require explicit patient consent before sending test notification (Safeguard 3)
    if (!pref.patientConsent) {
      return res.status(400).json({
        error: 'Explicit patient consent is required before sending test notifications.',
      });
    }

    const isCaregiver = target === 'caregiver';
    const isEducational = target === 'educational' || target === 'weeklyEducational';

    if (isCaregiver) {
      // Caregiver requires separate authorization and enablement (Safeguard 5)
      if (!pref.caregiverEmail || !pref.caregiverConsent || !pref.caregiverEnabled) {
        return res.status(400).json({
          error: 'Caregiver notifications must be authorized and enabled before sending a caregiver test email.',
        });
      }
    }

    if (isEducational) {
      // Must have an eligible saved prediction for educational profile
      if (!pref.hasEligiblePrediction || !pref.predictedStage) {
        return res.status(400).json({
          error: 'Cannot send weekly educational test email: No MRI prediction has been recorded for this patient profile yet.',
        });
      }
    }

    // Send only to the saved email address (Safeguard 4)
    const recipientEmail = isCaregiver ? pref.caregiverEmail : pref.patientEmail;
    if (!recipientEmail) {
      return res.status(400).json({
        error: `Cannot send test email: Please save a valid ${isCaregiver ? 'caregiver' : 'patient'} email address first.`,
      });
    }

    // Rate limiting: Max 5 test emails per 10-minute window (Safeguard 6)
    const now = new Date();
    const windowMs = 10 * 60 * 1000;
    if (!pref.testEmailWindowStart || (now - new Date(pref.testEmailWindowStart)) > windowMs) {
      pref.testEmailWindowStart = now;
      pref.testEmailCount = 0;
    }

    if (pref.testEmailCount >= 5) {
      const minutesRemaining = Math.max(1, Math.ceil((windowMs - (now - new Date(pref.testEmailWindowStart))) / 60000));
      return res.status(429).json({
        error: `Test email rate limit reached (max 5 per 10 minutes). Please wait ${minutesRemaining} minute(s) before sending another test email.`,
      });
    }

    // Production check: Reject if SMTP is not configured in production
    const smtpReady = isSmtpConfigured();
    if (nodeEnv === 'production' && !smtpReady) {
      return res.status(503).json({
        error: 'Email delivery configuration unavailable. SMTP credentials must be configured in production.',
      });
    }

    // Dispatch test email according to target
    let result;
    let subject;
    let category = target;

    if (isEducational) {
      const topic = getStageEducationalContent(
        pref.predictedStage,
        pref.categories?.weeklyEducational?.topicIndex || 0
      );
      subject = `[NeuroScan AI] Weekly Care & Brain Health: ${topic.topicTitle}`;
      category = 'weeklyEducational';
      result = await sendWeeklyEducationalEmail(recipientEmail, {
        patientName: pref.patientName,
        stageNumber: topic.stageNumber,
        stageLabel: topic.stageLabel,
        topicTitle: topic.topicTitle,
        educationalSummary: topic.educationalSummary,
        practicalTips: topic.practicalTips,
        resourceLinkText: topic.resourceLinkText,
        resourceLinkRoute: topic.resourceLinkRoute,
        isCaregiver: false,
      });
    } else {
      subject = '[NeuroScan AI] Test Notification: Verified Delivery';
      result = await sendTestEmail(recipientEmail, target);
    }

    // Increment rate limit counter and update last test timestamp
    pref.testEmailCount = (pref.testEmailCount || 0) + 1;
    pref.lastTestEmailAt = now;
    await pref.save();

    // Record delivery attempt in audit collection
    await NotificationDelivery.create({
      idempotencyKey: `test_${patientId}_${target}_${Date.now()}`,
      patientId,
      recipient: isCaregiver ? 'caregiver' : 'patient',
      recipientEmail,
      category,
      subject,
      status: result.success ? 'sent' : 'failed',
      sentAt: result.success ? new Date() : null,
      metadata: { target, provider: result.provider, simulated: result.simulated },
    });

    const isSimulated = Boolean(result.simulated);
    const message = isSimulated
      ? `[DEV Simulation] Test ${target} email simulated for ${recipientEmail}. Live delivery requires SMTP configuration.`
      : `Test email successfully sent to ${recipientEmail}.`;

    res.status(200).json({
      success: true,
      message,
      delivery: result,
      simulated: isSimulated,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/care/notifications/process-scheduled
 * Protected by SCHEDULER_SECRET_KEY
 */
const processScheduled = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const bearerSecret = authHeader && authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : null;
    const headerSecret = req.headers['x-scheduler-secret'] || bearerSecret;

    if (!headerSecret || headerSecret !== schedulerSecretKey) {
      return res.status(401).json({
        error: 'Unauthorized scheduler trigger. Valid SCHEDULER_SECRET_KEY required.',
      });
    }

    const result = await processScheduledNotifications(headerSecret);
    res.status(200).json({
      success: true,
      result,
    });
  } catch (error) {
    if (error.status === 401) {
      return res.status(401).json({ error: error.message });
    }
    next(error);
  }
};

/**
 * GET /api/care/notifications/history
 */
const getNotificationHistory = async (req, res, next) => {
  try {
    const patientId = getPatientId(req);

    if (!getDBStatus()) {
      return res.status(503).json({ error: 'Database unavailable.' });
    }

    const history = await NotificationDelivery.find({ patientId })
      .sort({ createdAt: -1 })
      .limit(50);

    res.status(200).json({
      success: true,
      data: history,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getNotificationSettings,
  updateNotificationSettings,
  sendTestNotification,
  processScheduled,
  getNotificationHistory,
};

const mongoose = require('mongoose');
const NotificationPreference = require('../models/NotificationPreference');
const NotificationDelivery = require('../models/NotificationDelivery');
const Prediction = require('../models/Prediction');
const MedicationDose = require('../models/MedicationDose');
const Appointment = require('../models/Appointment');
const { getDBStatus } = require('../config/db');
const { schedulerSecretKey } = require('../config/env');
const {
  sendMedicationReminderEmail,
  sendMissedDoseEmail,
  sendNutritionReminderEmail,
  sendRoutineReminderEmail,
  sendAppointmentReminderEmail,
  sendWeeklyEducationalEmail,
  getStageEducationalContent,
} = require('./emailService');

let isProcessing = false;
let schedulerTimer = null;

/**
 * Format local time strings safely in the patient's timezone with ISO week calculation
 */
const getPatientCurrentDateTime = (timezone = 'Asia/Kolkata', referenceDate = null) => {
  try {
    const now = referenceDate instanceof Date ? referenceDate : (referenceDate ? new Date(referenceDate) : new Date());
    const dtf = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      weekday: 'long',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
    const parts = dtf.formatToParts(now);
    const getPart = (type) => parts.find((p) => p.type === type)?.value;

    const weekday = getPart('weekday'); // e.g. "Sunday", "Monday"
    const year = parseInt(getPart('year'), 10);
    const month = parseInt(getPart('month'), 10);
    const day = parseInt(getPart('day'), 10);
    const hour = getPart('hour');
    const minute = getPart('minute');
    const dayPeriod = getPart('dayPeriod') || '';

    const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const timeStr = `${hour}:${minute} ${dayPeriod}`.trim();

    // Standard ISO 8601 week number calculation handling year boundaries correctly
    const localDate = new Date(Date.UTC(year, month - 1, day));
    const target = new Date(localDate.valueOf());
    const dayNr = (localDate.getUTCDay() + 6) % 7; // Monday = 0, Sunday = 6
    target.setUTCDate(target.getUTCDate() - dayNr + 3); // Nearest Thursday
    const firstThursday = target.valueOf();
    target.setUTCMonth(0, 1);
    if (target.getUTCDay() !== 4) {
      target.setUTCMonth(0, 1 + ((4 - target.getUTCDay() + 7) % 7));
    }
    const isoWeek = 1 + Math.ceil((firstThursday - target) / 604800000);
    const isoYear = new Date(firstThursday).getUTCFullYear();

    return {
      dateStr,
      timeStr,
      weekday,
      isoYear,
      isoWeek,
      now,
    };
  } catch (err) {
    const now = new Date();
    const weekdays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    return {
      dateStr: now.toISOString().slice(0, 10),
      timeStr: now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }),
      weekday: weekdays[now.getDay()],
      isoYear: now.getFullYear(),
      isoWeek: 1,
      now,
    };
  }
};

/**
 * Normalize time strings for robust minute-matching (e.g. "08:00 AM" vs "8:00 AM")
 */
const normalizeTimeStr = (t) => {
  if (!t) return '';
  const match = t.trim().match(/^0?(\d{1,2}):(\d{2})\s*(AM|PM)?$/i);
  if (!match) return t.trim().toUpperCase();
  const hour = parseInt(match[1], 10);
  const min = match[2];
  const mod = match[3] ? match[3].toUpperCase() : '';
  return `${hour}:${min} ${mod}`.trim();
};

/**
 * Atomic reservation and delivery helper to ensure zero duplicates across restarts and concurrent runs
 */
const attemptDispatch = async ({
  idempotencyKey,
  patientId,
  recipient,
  recipientEmail,
  category,
  subject,
  metadata = {},
  sendFn,
}) => {
  let delivery = null;
  try {
    // Atomic insert: fails if idempotencyKey already exists
    delivery = await NotificationDelivery.create({
      idempotencyKey,
      patientId,
      recipient,
      recipientEmail,
      category,
      subject,
      status: 'pending',
      attempts: 1,
      lastAttemptAt: new Date(),
      metadata,
    });
  } catch (err) {
    // E11000 duplicate key error means this notification was already scheduled/delivered
    if (err.code === 11000) {
      return { skipped: true, reason: 'Duplicate: already processed or currently pending.' };
    }
    throw err;
  }

  // Attempt email transmission
  try {
    await sendFn();
    await NotificationDelivery.updateOne(
      { _id: delivery._id },
      { $set: { status: 'sent', sentAt: new Date(), errorMessage: null } }
    );
    return { success: true, idempotencyKey };
  } catch (sendErr) {
    await NotificationDelivery.updateOne(
      { _id: delivery._id },
      { $set: { status: 'failed', errorMessage: sendErr.message || 'Delivery error' } }
    ).catch(() => {});
    return { success: false, error: sendErr.message };
  }
};

/**
 * Main scheduled notification processing runner
 */
const processScheduledNotifications = async (callerSecret = null, options = {}) => {
  // If triggered externally, enforce scheduler secret authentication
  if (callerSecret !== null && callerSecret !== schedulerSecretKey) {
    const error = new Error('Unauthorized scheduler request. Invalid or missing secret key.');
    error.status = 401;
    throw error;
  }

  if (!getDBStatus()) {
    console.warn('[Scheduler] MongoDB offline; scheduled notification processing skipped.');
    return { processed: 0, status: 'db_offline' };
  }

  if (isProcessing) {
    return { skipped: true, reason: 'Scheduler run currently in progress.' };
  }

  isProcessing = true;
  let dispatchedCount = 0;

  try {
    // Load all active preferences with explicit consent and valid email
    const preferences = await NotificationPreference.find({
      allNotificationsEnabled: true,
      patientConsent: true,
      patientEmail: { $exists: true, $ne: '' },
    });

    const tickReferenceDate = options.referenceTime || new Date();

    for (const pref of preferences) {
      const { patientId, timezone } = pref;
      const { dateStr, timeStr, weekday, isoYear, isoWeek, now } = getPatientCurrentDateTime(timezone, tickReferenceDate);
      const normalizedCurrentTime = normalizeTimeStr(timeStr);

      const hasCaregiverAlerts =
        pref.caregiverEnabled &&
        pref.caregiverConsent &&
        pref.caregiverEmail;

      // Ensure latest eligible prediction is synchronized for the patient
      if (!pref.hasEligiblePrediction || !pref.predictedStage) {
        const latestPred = await Prediction.findOne({
          patientId,
          stageNumber: { $in: [1, 2, 3, 4] },
        }).sort({ createdAt: -1 });

        if (latestPred) {
          pref.hasEligiblePrediction = true;
          pref.predictedStage = latestPred.stageNumber;
          pref.predictedClass = latestPred.predictedClass;
          pref.stageLabel = latestPred.stageLabel;
          await pref.save();
        }
      }

      // ================= 0. WEEKLY PERSONALIZED EDUCATIONAL GUIDANCE =================
      if (pref.categories?.weeklyEducational?.enabled) {
        // Enforce Safeguard: Do not send stage-specific weekly educational emails if patient has no eligible prediction
        if (pref.hasEligiblePrediction && pref.predictedStage) {
          const configuredDay = (pref.categories.weeklyEducational.weekday || 'Sunday').trim().toLowerCase();
          const configuredTimeNormalized = normalizeTimeStr(pref.categories.weeklyEducational.time || '09:00 AM');
          const currentWeekdayNormalized = (weekday || '').trim().toLowerCase();

          // Check day-of-week and time in patient's local timezone
          if (
            currentWeekdayNormalized === configuredDay &&
            normalizedCurrentTime === configuredTimeNormalized
          ) {
            const stageNumber = pref.predictedStage;
            const currentTopicIndex = pref.categories.weeklyEducational.topicIndex || 0;
            const topicContent = getStageEducationalContent(stageNumber, currentTopicIndex);
            const weeklyIdempotencyKey = `${patientId}_weekly_edu_${isoYear}_w${isoWeek}`;

            // Patient Weekly Educational Email
            const patientDispatch = await attemptDispatch({
              idempotencyKey: weeklyIdempotencyKey,
              patientId,
              recipient: 'patient',
              recipientEmail: pref.patientEmail,
              category: 'weeklyEducational',
              subject: `[NeuroScan AI] Weekly Care & Brain Health: ${topicContent.topicTitle}`,
              metadata: {
                stageNumber,
                topicIndex: topicContent.topicIndex,
                isoYear,
                isoWeek,
              },
              sendFn: () =>
                sendWeeklyEducationalEmail(pref.patientEmail, {
                  patientName: pref.patientName,
                  stageNumber: topicContent.stageNumber,
                  stageLabel: topicContent.stageLabel,
                  topicTitle: topicContent.topicTitle,
                  educationalSummary: topicContent.educationalSummary,
                  practicalTips: topicContent.practicalTips,
                  resourceLinkText: topicContent.resourceLinkText,
                  resourceLinkRoute: topicContent.resourceLinkRoute,
                  isCaregiver: false,
                }),
            });

            if (patientDispatch.success) {
              dispatchedCount++;
              // Advance topicIndex ONLY upon confirmed delivery success
              pref.categories.weeklyEducational.topicIndex = (currentTopicIndex + 1) % 4;
              pref.lastEducationalEmailSentAt = new Date();
              await pref.save();
            }

            // Caregiver Weekly Educational Email (Separate delivery record & authorization verification)
            const canSendCaregiverEdu =
              pref.caregiverEnabled &&
              pref.caregiverConsent &&
              pref.caregiverEmail &&
              pref.caregiverSettings?.weeklyEducational;

            if (canSendCaregiverEdu) {
              const cgIdempotencyKey = `${patientId}_weekly_edu_${isoYear}_w${isoWeek}_cg`;
              const cgDispatch = await attemptDispatch({
                idempotencyKey: cgIdempotencyKey,
                patientId,
                recipient: 'caregiver',
                recipientEmail: pref.caregiverEmail,
                category: 'weeklyEducational',
                subject: `[NeuroScan AI] Caregiver Weekly Guide: ${topicContent.topicTitle}`,
                metadata: {
                  stageNumber,
                  topicIndex: topicContent.topicIndex,
                  isoYear,
                  isoWeek,
                },
                sendFn: () =>
                  sendWeeklyEducationalEmail(pref.caregiverEmail, {
                    patientName: pref.patientName,
                    stageNumber: topicContent.stageNumber,
                    stageLabel: topicContent.stageLabel,
                    topicTitle: topicContent.topicTitle,
                    educationalSummary: topicContent.educationalSummary,
                    practicalTips: topicContent.practicalTips,
                    resourceLinkText: topicContent.resourceLinkText,
                    resourceLinkRoute: topicContent.resourceLinkRoute,
                    isCaregiver: true,
                  }),
              });

              if (cgDispatch.success) {
                dispatchedCount++;
              }
            }
          }
        }
      }

      // ================= 1. MEDICATION REMINDERS =================
      if (pref.categories?.medications?.enabled) {
        // Find today's doses for this patient
        const todayDoses = await MedicationDose.find({
          patientId,
          scheduledDate: dateStr,
        });

        for (const dose of todayDoses) {
          const doseTimeNormalized = normalizeTimeStr(dose.scheduledTime);

          // A. Scheduled Dose Due Reminder (ONLY if status is pending; NEVER if taken or skipped!)
          if (dose.status === 'pending' && doseTimeNormalized === normalizedCurrentTime) {
            // Patient email
            await attemptDispatch({
              idempotencyKey: `${patientId}_dose_${dose.doseId}_${dateStr}_scheduled`,
              patientId,
              recipient: 'patient',
              recipientEmail: pref.patientEmail,
              category: 'medication',
              subject: `[NeuroScan AI] Medication Reminder: ${dose.medicationName}`,
              metadata: { doseId: dose.doseId, time: dose.scheduledTime },
              sendFn: () =>
                sendMedicationReminderEmail(pref.patientEmail, {
                  medicationName: dose.medicationName,
                  dosage: dose.dosage,
                  scheduledTime: dose.scheduledTime,
                  instructions: dose.instructions,
                  label: dose.label,
                }),
            });
            dispatchedCount++;

            // Caregiver email (if authorized for medications)
            if (hasCaregiverAlerts && pref.caregiverSettings?.medications) {
              await attemptDispatch({
                idempotencyKey: `${patientId}_dose_${dose.doseId}_${dateStr}_scheduled_cg`,
                patientId,
                recipient: 'caregiver',
                recipientEmail: pref.caregiverEmail,
                category: 'medication',
                subject: `[NeuroScan AI] Caregiver Alert: Medication Due for Patient`,
                metadata: { doseId: dose.doseId },
                sendFn: () =>
                  sendMedicationReminderEmail(pref.caregiverEmail, {
                    medicationName: dose.medicationName,
                    dosage: dose.dosage,
                    scheduledTime: dose.scheduledTime,
                    instructions: dose.instructions,
                    label: dose.label,
                  }),
              });
              dispatchedCount++;
            }
          }

          // B. Missed Dose Notice (ONLY if missed, and NEVER if dose was taken or skipped!)
          if (
            pref.categories?.medications?.missedDoseAlert &&
            dose.status === 'missed' &&
            !dose.takenAt
          ) {
            await attemptDispatch({
              idempotencyKey: `${patientId}_dose_${dose.doseId}_${dateStr}_missed`,
              patientId,
              recipient: 'patient',
              recipientEmail: pref.patientEmail,
              category: 'medication',
              subject: `[NeuroScan AI] Missed Dose Notice: ${dose.medicationName}`,
              metadata: { doseId: dose.doseId },
              sendFn: () =>
                sendMissedDoseEmail(pref.patientEmail, {
                  medicationName: dose.medicationName,
                  dosage: dose.dosage,
                  scheduledTime: dose.scheduledTime,
                  label: dose.label,
                }),
            });
            dispatchedCount++;

            if (hasCaregiverAlerts && pref.caregiverSettings?.medications) {
              await attemptDispatch({
                idempotencyKey: `${patientId}_dose_${dose.doseId}_${dateStr}_missed_cg`,
                patientId,
                recipient: 'caregiver',
                recipientEmail: pref.caregiverEmail,
                category: 'medication',
                subject: `[NeuroScan AI] Caregiver Notice: Missed Dose for Patient`,
                metadata: { doseId: dose.doseId },
                sendFn: () =>
                  sendMissedDoseEmail(pref.caregiverEmail, {
                    medicationName: dose.medicationName,
                    dosage: dose.dosage,
                    scheduledTime: dose.scheduledTime,
                    label: dose.label,
                  }),
              });
              dispatchedCount++;
            }
          }
        }
      }

      // ================= 2. DIET & NUTRITION REMINDERS =================
      if (pref.categories?.nutrition?.enabled) {
        const nut = pref.categories.nutrition;
        const mealsToCheck = [
          { key: 'breakfast', enabled: nut.breakfast, time: nut.breakfastTime, name: 'Breakfast' },
          { key: 'lunch', enabled: nut.lunch, time: nut.lunchTime, name: 'Lunch' },
          { key: 'snack', enabled: nut.snack, time: nut.snackTime, name: 'Evening Snack' },
          { key: 'dinner', enabled: nut.dinner, time: nut.dinnerTime, name: 'Dinner' },
          { key: 'hydration', enabled: nut.hydration, time: '11:00 AM', name: 'Hydration & Fluid Wellness' },
        ];

        for (const m of mealsToCheck) {
          if (m.enabled && normalizeTimeStr(m.time) === normalizedCurrentTime) {
            await attemptDispatch({
              idempotencyKey: `${patientId}_nutrition_${m.key}_${dateStr}`,
              patientId,
              recipient: 'patient',
              recipientEmail: pref.patientEmail,
              category: 'nutrition',
              subject: `[NeuroScan AI] Nutrition Reminder: ${m.name}`,
              metadata: { meal: m.key },
              sendFn: () => sendNutritionReminderEmail(pref.patientEmail, { mealType: m.name, time: m.time }),
            });
            dispatchedCount++;
          }
        }
      }

      // ================= 3. DAILY CARE ROUTINE REMINDERS =================
      if (pref.categories?.routine?.enabled) {
        const rout = pref.categories.routine;
        const routinesToCheck = [
          { key: 'morning', enabled: rout.morningRoutine, time: rout.morningTime, name: 'Morning Routine' },
          { key: 'cognitive', enabled: rout.cognitiveExercises, time: rout.cognitiveTime, name: 'Cognitive Engagement Exercises' },
          { key: 'physical', enabled: rout.physicalActivity, time: rout.physicalTime, name: 'Gentle Physical Activity / Walk' },
          { key: 'sleep', enabled: rout.sleepRoutine, time: rout.sleepTime, name: 'Consistent Sleep Preparation' },
        ];

        for (const r of routinesToCheck) {
          if (r.enabled && normalizeTimeStr(r.time) === normalizedCurrentTime) {
            await attemptDispatch({
              idempotencyKey: `${patientId}_routine_${r.key}_${dateStr}`,
              patientId,
              recipient: 'patient',
              recipientEmail: pref.patientEmail,
              category: 'routine',
              subject: `[NeuroScan AI] Daily Routine: ${r.name}`,
              metadata: { routine: r.key },
              sendFn: () => sendRoutineReminderEmail(pref.patientEmail, { activityType: r.name, time: r.time }),
            });
            dispatchedCount++;

            if (hasCaregiverAlerts && pref.caregiverSettings?.routine) {
              await attemptDispatch({
                idempotencyKey: `${patientId}_routine_${r.key}_${dateStr}_cg`,
                patientId,
                recipient: 'caregiver',
                recipientEmail: pref.caregiverEmail,
                category: 'routine',
                subject: `[NeuroScan AI] Caregiver Routine Alert: ${r.name}`,
                metadata: { routine: r.key },
                sendFn: () => sendRoutineReminderEmail(pref.caregiverEmail, { activityType: r.name, time: r.time }),
              });
              dispatchedCount++;
            }
          }
        }
      }

      // ================= 4. SPECIALIST APPOINTMENT REMINDERS =================
      if (pref.categories?.appointments?.enabled) {
        const activeAppts = await Appointment.find({
          patientId,
          status: 'scheduled',
        });

        for (const appt of activeAppts) {
          const apptDate = new Date(appt.appointmentDate);
          if (isNaN(apptDate.getTime())) continue;

          // Parse appointment time into minutes if available
          let apptHours = 10;
          let apptMinutes = 0;
          if (appt.appointmentTime) {
            const tm = appt.appointmentTime.match(/(\d{1,2}):(\d{2})\s*(AM|PM)?/i);
            if (tm) {
              apptHours = parseInt(tm[1], 10);
              apptMinutes = parseInt(tm[2], 10);
              if (tm[3] && tm[3].toUpperCase() === 'PM' && apptHours < 12) apptHours += 12;
              if (tm[3] && tm[3].toUpperCase() === 'AM' && apptHours === 12) apptHours = 0;
            }
          }

          apptDate.setHours(apptHours, apptMinutes, 0, 0);
          const diffMs = apptDate.getTime() - now.getTime();
          const diffHours = diffMs / (1000 * 60 * 60);

          const apptDateFormatted = apptDate.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
          });

          // 24-Hour Reminder (window between 23h and 25h before)
          if (pref.categories.appointments.oneDayBefore && diffHours >= 23 && diffHours <= 25) {
            await attemptDispatch({
              idempotencyKey: `${patientId}_appt_${appt._id}_24h`,
              patientId,
              recipient: 'patient',
              recipientEmail: pref.patientEmail,
              category: 'appointment',
              subject: `[NeuroScan AI] Appointment Reminder: ${appt.specialistName} tomorrow`,
              metadata: { appointmentId: appt._id },
              sendFn: () =>
                sendAppointmentReminderEmail(pref.patientEmail, {
                  specialistName: appt.specialistName,
                  specialty: appt.specialty,
                  facilityName: appt.facilityName,
                  appointmentDate: apptDateFormatted,
                  appointmentTime: appt.appointmentTime || 'Scheduled Time',
                  timingLabel: 'Tomorrow',
                }),
            });
            dispatchedCount++;

            if (hasCaregiverAlerts && pref.caregiverSettings?.appointments) {
              await attemptDispatch({
                idempotencyKey: `${patientId}_appt_${appt._id}_24h_cg`,
                patientId,
                recipient: 'caregiver',
                recipientEmail: pref.caregiverEmail,
                category: 'appointment',
                subject: `[NeuroScan AI] Caregiver Alert: Patient Appointment Tomorrow`,
                metadata: { appointmentId: appt._id },
                sendFn: () =>
                  sendAppointmentReminderEmail(pref.caregiverEmail, {
                    specialistName: appt.specialistName,
                    specialty: appt.specialty,
                    facilityName: appt.facilityName,
                    appointmentDate: apptDateFormatted,
                    appointmentTime: appt.appointmentTime || 'Scheduled Time',
                    timingLabel: 'Tomorrow',
                  }),
              });
              dispatchedCount++;
            }
          }

          // 2-Hour Reminder (window between 1.5h and 2.5h before)
          if (pref.categories.appointments.twoHoursBefore && diffHours >= 1.5 && diffHours <= 2.5) {
            await attemptDispatch({
              idempotencyKey: `${patientId}_appt_${appt._id}_2h`,
              patientId,
              recipient: 'patient',
              recipientEmail: pref.patientEmail,
              category: 'appointment',
              subject: `[NeuroScan AI] Appointment Reminder: ${appt.specialistName} in 2 hours`,
              metadata: { appointmentId: appt._id },
              sendFn: () =>
                sendAppointmentReminderEmail(pref.patientEmail, {
                  specialistName: appt.specialistName,
                  specialty: appt.specialty,
                  facilityName: appt.facilityName,
                  appointmentDate: apptDateFormatted,
                  appointmentTime: appt.appointmentTime || 'Scheduled Time',
                  timingLabel: 'In 2 Hours',
                }),
            });
            dispatchedCount++;

            if (hasCaregiverAlerts && pref.caregiverSettings?.appointments) {
              await attemptDispatch({
                idempotencyKey: `${patientId}_appt_${appt._id}_2h_cg`,
                patientId,
                recipient: 'caregiver',
                recipientEmail: pref.caregiverEmail,
                category: 'appointment',
                subject: `[NeuroScan AI] Caregiver Alert: Patient Appointment in 2 Hours`,
                metadata: { appointmentId: appt._id },
                sendFn: () =>
                  sendAppointmentReminderEmail(pref.caregiverEmail, {
                    specialistName: appt.specialistName,
                    specialty: appt.specialty,
                    facilityName: appt.facilityName,
                    appointmentDate: apptDateFormatted,
                    appointmentTime: appt.appointmentTime || 'Scheduled Time',
                    timingLabel: 'In 2 Hours',
                  }),
              });
              dispatchedCount++;
            }
          }
        }
      }
    }

    return { processed: dispatchedCount, status: 'success' };
  } catch (err) {
    console.error('[NotificationScheduler] Processing error:', err);
    return { error: err.message, status: 'error' };
  } finally {
    isProcessing = false;
  }
};

/**
 * Atomic distributed lease lock to ensure single-instance tick execution
 * when running multiple backend replicas in production.
 */
const acquireDistributedLock = async (lockKey = 'notification_scheduler_tick', leaseMs = 50000) => {
  try {
    if (!mongoose.connection || mongoose.connection.readyState !== 1) {
      return true;
    }
    const now = new Date();
    const expiresAt = new Date(now.getTime() + leaseMs);
    const collection = mongoose.connection.collection('system_scheduler_locks');

    const result = await collection.findOneAndUpdate(
      {
        _id: lockKey,
        $or: [
          { lockedUntil: { $exists: false } },
          { lockedUntil: { $lte: now } },
        ],
      },
      {
        $set: {
          lockedUntil: expiresAt,
          acquiredAt: now,
          instancePid: process.pid,
        },
      },
      {
        upsert: true,
        returnDocument: 'after',
      }
    );

    return !!result;
  } catch (err) {
    return false;
  }
};

/**
 * Start the 60-second in-process notification scheduler ticker
 */
const startNotificationScheduler = () => {
  if (schedulerTimer) clearInterval(schedulerTimer);

  schedulerTimer = setInterval(async () => {
    try {
      const lockAcquired = await acquireDistributedLock('notification_scheduler_tick', 55000);
      if (!lockAcquired) {
        return;
      }
      await processScheduledNotifications();
    } catch (e) {
      // Non-fatal ticker handling
    }
  }, 60000);

  if (schedulerTimer.unref) {
    schedulerTimer.unref();
  }

  console.log('[NotificationScheduler] 60-second reminder scheduler started (distributed lease enabled).');
};

const stopNotificationScheduler = () => {
  if (schedulerTimer) {
    clearInterval(schedulerTimer);
    schedulerTimer = null;
  }
};

module.exports = {
  processScheduledNotifications,
  startNotificationScheduler,
  stopNotificationScheduler,
  getPatientCurrentDateTime,
  normalizeTimeStr,
  acquireDistributedLock,
};

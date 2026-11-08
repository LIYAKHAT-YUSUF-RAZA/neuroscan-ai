const mongoose = require('mongoose');

const NotificationPreferenceSchema = new mongoose.Schema(
  {
    patientId: {
      type: String,
      required: true,
      unique: true,
    },
    allNotificationsEnabled: {
      type: Boolean,
      default: false, // Explicit requirement: disabled by default
    },
    patientConsent: {
      type: Boolean,
      default: false, // Explicit requirement: explicit consent required
    },
    patientConsentDate: {
      type: Date,
      default: null,
    },
    patientEmail: {
      type: String,
      trim: true,
      lowercase: true,
      default: '',
    },
    caregiverEmail: {
      type: String,
      trim: true,
      lowercase: true,
      default: '',
    },
    caregiverEnabled: {
      type: Boolean,
      default: false,
    },
    caregiverConsent: {
      type: Boolean,
      default: false,
    },
    caregiverConsentDate: {
      type: Date,
      default: null,
    },
    timezone: {
      type: String,
      default: 'Asia/Kolkata',
    },
    // Patient Profile & Dynamic Disease-Category Stage Tracking
    patientName: {
      type: String,
      trim: true,
      default: '',
    },
    hasEligiblePrediction: {
      type: Boolean,
      default: false,
    },
    predictedStage: {
      type: Number,
      default: null, // Strictly null until patient receives an eligible saved prediction
    },
    predictedClass: {
      type: String,
      default: null,
    },
    stageLabel: {
      type: String,
      default: null,
    },
    lastPredictionDate: {
      type: Date,
      default: null,
    },
    lastEducationalEmailSentAt: {
      type: Date,
      default: null,
    },
    // Rate-limiting for on-demand test emails (max 5 per 10-minute window)
    lastTestEmailAt: {
      type: Date,
      default: null,
    },
    testEmailCount: {
      type: Number,
      default: 0,
    },
    testEmailWindowStart: {
      type: Date,
      default: null,
    },
    categories: {
      medications: {
        enabled: { type: Boolean, default: true },
        missedDoseAlert: { type: Boolean, default: true },
      },
      nutrition: {
        enabled: { type: Boolean, default: true },
        breakfast: { type: Boolean, default: true },
        breakfastTime: { type: String, default: '08:30 AM' },
        lunch: { type: Boolean, default: true },
        lunchTime: { type: String, default: '01:00 PM' },
        snack: { type: Boolean, default: false },
        snackTime: { type: String, default: '05:00 PM' },
        dinner: { type: Boolean, default: true },
        dinnerTime: { type: String, default: '08:00 PM' },
        hydration: { type: Boolean, default: false },
      },
      routine: {
        enabled: { type: Boolean, default: true },
        morningRoutine: { type: Boolean, default: true },
        morningTime: { type: String, default: '09:00 AM' },
        cognitiveExercises: { type: Boolean, default: true },
        cognitiveTime: { type: String, default: '11:00 AM' },
        physicalActivity: { type: Boolean, default: true },
        physicalTime: { type: String, default: '04:30 PM' },
        sleepRoutine: { type: Boolean, default: true },
        sleepTime: { type: String, default: '09:30 PM' },
      },
      appointments: {
        enabled: { type: Boolean, default: true },
        oneDayBefore: { type: Boolean, default: true },
        twoHoursBefore: { type: Boolean, default: true },
      },
      weeklyEducational: {
        enabled: { type: Boolean, default: false }, // Disabled until explicitly enabled
        weekday: { type: String, default: 'Sunday' },
        time: { type: String, default: '09:00 AM' },
        topicIndex: { type: Number, default: 0 },
      },
    },
    caregiverSettings: {
      medications: { type: Boolean, default: false },
      appointments: { type: Boolean, default: false },
      routine: { type: Boolean, default: false },
      weeklyEducational: { type: Boolean, default: false },
    },
  },
  {
    timestamps: true,
  }
);

// High-performance compound index for 60-second notification scheduler queries
NotificationPreferenceSchema.index({ allNotificationsEnabled: 1, patientConsent: 1 });

module.exports = mongoose.model('NotificationPreference', NotificationPreferenceSchema);

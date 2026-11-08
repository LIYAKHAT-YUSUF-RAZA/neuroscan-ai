const mongoose = require('mongoose');

const PatientSchema = new mongoose.Schema(
  {
    patientId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
      index: true,
    },
    role: {
      type: String,
      enum: ['patient', 'researcher', 'clinician'],
      default: 'patient',
      index: true,
    },
    timezone: {
      type: String,
      default: 'Asia/Kolkata',
    },
    caregiverName: {
      type: String,
      trim: true,
      default: '',
    },
    caregiverEmail: {
      type: String,
      trim: true,
      lowercase: true,
      default: '',
    },
    latestPredictionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Prediction',
      default: null,
    },
    latestScanId: {
      type: String,
      default: null,
    },
    predictedStage: {
      type: Number,
      default: null,
    },
    predictedClass: {
      type: String,
      default: null,
    },
    stageLabel: {
      type: String,
      default: null,
    },
    consentStatus: {
      type: Boolean,
      default: false,
    },
    userId: {
      type: String,
      default: null,
      index: true,
    },
    isDemo: {
      type: Boolean,
      default: false,
      index: true,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Virtual alias for isDemoPatient to maintain backwards compatibility without duplicate database fields
PatientSchema.virtual('isDemoPatient')
  .get(function () {
    return this.isDemo;
  })
  .set(function (val) {
    this.isDemo = val;
  });

// Compound indexes for rapid role and stage-based queries
PatientSchema.index({ role: 1, createdAt: -1 });
PatientSchema.index({ predictedStage: 1 });

module.exports = mongoose.model('Patient', PatientSchema);

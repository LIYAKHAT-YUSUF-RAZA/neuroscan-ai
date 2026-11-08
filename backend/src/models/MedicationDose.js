const mongoose = require('mongoose');

const MedicationDoseSchema = new mongoose.Schema(
  {
    doseId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    medicationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Medication',
      required: true,
      index: true,
    },
    medicationName: {
      type: String,
      required: true,
      trim: true,
    },
    dosage: {
      type: String,
      required: true,
      trim: true,
    },
    instructions: {
      type: String,
      default: '',
      trim: true,
    },
    patientId: {
      type: String,
      required: true,
    },
    scheduledDate: {
      type: String, // 'YYYY-MM-DD'
      required: true,
      index: true,
    },
    scheduledTime: {
      type: String, // e.g. '08:00 AM'
      required: true,
    },
    label: {
      type: String,
      default: 'Scheduled Dose',
    },
    status: {
      type: String,
      enum: ['pending', 'taken', 'missed', 'skipped'],
      default: 'pending',
      index: true,
    },
    takenAt: {
      type: Date,
      default: null,
    },
    notes: {
      type: String,
      default: '',
    },
  },
  {
    timestamps: true,
  }
);

// Compound unique constraint to guarantee individual dose idempotency
MedicationDoseSchema.index(
  { medicationId: 1, scheduledDate: 1, scheduledTime: 1 },
  { unique: true }
);

// Index for high-performance retrieval of patient daily schedules and history
MedicationDoseSchema.index({ patientId: 1, scheduledDate: 1 });
MedicationDoseSchema.index({ patientId: 1, createdAt: -1 });

module.exports = mongoose.model('MedicationDose', MedicationDoseSchema);

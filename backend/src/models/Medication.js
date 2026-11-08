const mongoose = require('mongoose');

const DoseRecordSchema = new mongoose.Schema({
  doseId: {
    type: String,
    required: true,
  },
  time: {
    type: String,
    required: true, // e.g. "08:00 AM" or "20:00"
  },
  label: {
    type: String,
    default: 'Scheduled Dose', // e.g. "Morning", "Afternoon", "Evening", "Night"
  },
  status: {
    type: String,
    enum: ['pending', 'taken', 'missed'],
    default: 'pending',
  },
  takenAt: {
    type: Date,
  },
  notes: {
    type: String,
  },
});

const MedicationSchema = new mongoose.Schema(
  {
    patientId: {
      type: String,
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    dosage: {
      type: String,
      required: true,
      trim: true, // e.g. "5 mg", "10 mg"
    },
    frequency: {
      type: String,
      default: 'Once Daily',
    },
    instructions: {
      type: String,
      trim: true,
    },
    prescribedBy: {
      type: String,
      trim: true,
    },
    startDate: {
      type: Date,
      default: Date.now,
    },
    endDate: {
      type: Date,
    },
    scheduledTimes: [
      {
        time: { type: String, required: true },
        label: { type: String, default: 'Scheduled Dose' },
      },
    ],
    status: {
      type: String,
      enum: ['active', 'discontinued'],
      default: 'active',
      index: true,
    },
    doses: [DoseRecordSchema],
    notes: {
      type: String,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('Medication', MedicationSchema);

const mongoose = require('mongoose');

const AppointmentSchema = new mongoose.Schema(
  {
    patientId: {
      type: String,
      required: true,
    },
    specialistName: {
      type: String,
      required: true,
      trim: true,
    },
    specialty: {
      type: String,
      required: true,
      trim: true,
    },
    facilityName: {
      type: String,
      trim: true,
    },
    location: {
      type: String,
      trim: true,
    },
    appointmentDate: {
      type: Date,
      required: true,
    },
    appointmentTime: {
      type: String,
      trim: true,
    },
    reasonForVisit: {
      type: String,
      trim: true,
    },
    questionsToDiscuss: [
      {
        type: String,
        trim: true,
      },
    ],
    prepChecklist: [
      {
        item: { type: String },
        text: { type: String },
        completed: { type: Boolean, default: false },
      },
    ],
    status: {
      type: String,
      enum: ['scheduled', 'completed', 'rescheduled', 'cancelled'],
      default: 'scheduled',
    },
    notes: {
      type: String,
    },
  },
  {
    timestamps: true,
  }
);

// Compound indexes for patient appointment queries and scheduler lookup
AppointmentSchema.index({ patientId: 1, appointmentDate: 1 });
AppointmentSchema.index({ appointmentDate: 1, status: 1 });

module.exports = mongoose.model('Appointment', AppointmentSchema);

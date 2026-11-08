const mongoose = require('mongoose');

const NotificationDeliverySchema = new mongoose.Schema(
  {
    idempotencyKey: {
      type: String,
      required: true,
      unique: true,
    },
    patientId: {
      type: String,
      required: true,
    },
    recipient: {
      type: String,
      enum: ['patient', 'caregiver', 'both'],
      required: true,
    },
    recipientEmail: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
    },
    category: {
      type: String,
      enum: ['medication', 'nutrition', 'routine', 'appointment', 'weeklyEducational', 'test'],
      required: true,
      index: true,
    },
    subject: {
      type: String,
      required: true,
      trim: true,
    },
    status: {
      type: String,
      enum: ['pending', 'sent', 'failed', 'cancelled'],
      default: 'pending',
      index: true,
    },
    attempts: {
      type: Number,
      default: 1,
    },
    lastAttemptAt: {
      type: Date,
      default: Date.now,
    },
    sentAt: {
      type: Date,
      default: null,
    },
    errorMessage: {
      type: String,
      default: null,
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,
  }
);

// High-performance compound indexes for patient delivery history & scheduler lookups
NotificationDeliverySchema.index({ patientId: 1, createdAt: -1 });
NotificationDeliverySchema.index({ category: 1, status: 1, createdAt: -1 });

/**
 * Retention Policy Documentation:
 * For multi-million user compliance and database size optimization,
 * NotificationDelivery records can optionally configure a 90-day TTL index:
 *   NotificationDeliverySchema.index({ createdAt: 1 }, { expireAfterSeconds: 90 * 86400 });
 * Alternatively, an offload batch worker archives records older than 90 days to cold storage
 * before removal to guarantee HIPAA audit trail compliance without bloating working set memory.
 */

module.exports = mongoose.model('NotificationDelivery', NotificationDeliverySchema);

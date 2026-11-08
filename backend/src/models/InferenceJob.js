const mongoose = require('mongoose');

const InferenceJobSchema = new mongoose.Schema(
  {
    jobId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    patientId: {
      type: String,
      default: null,
      trim: true,
    },
    originalFilename: {
      type: String,
      default: 'uploaded_scan.png',
      trim: true,
    },
    fileSize: {
      type: Number,
      default: 0,
    },
    status: {
      type: String,
      enum: ['queued', 'processing', 'completed', 'failed'],
      default: 'queued',
    },
    progress: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },
    result: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    error: {
      type: String,
      default: null,
    },
    startedAt: {
      type: Date,
      default: null,
    },
    completedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// High-performance compound indexes for job retrieval and polling
InferenceJobSchema.index({ patientId: 1, createdAt: -1 });
InferenceJobSchema.index({ status: 1, createdAt: -1 });

module.exports = mongoose.model('InferenceJob', InferenceJobSchema);

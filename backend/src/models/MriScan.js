const mongoose = require('mongoose');

const MriScanSchema = new mongoose.Schema(
  {
    scanId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true,
    },
    patientId: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    originalFilename: {
      type: String,
      required: true,
      trim: true,
    },
    storageReference: {
      type: String,
      required: true,
      trim: true,
    },
    mimeType: {
      type: String,
      default: 'image/png',
      trim: true,
    },
    fileSize: {
      type: Number,
      required: true,
    },
    fileHash: {
      type: String,
      required: true,
      trim: true,
    },
    scanDate: {
      type: Date,
      default: Date.now,
      index: true,
    },
    visitDate: {
      type: Date,
      default: null,
    },
    visitNotes: {
      type: String,
      default: '',
      trim: true,
    },
    scanStatus: {
      type: String,
      enum: ['active', 'archived'],
      default: 'active',
      index: true,
    },
    latestPredictionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Prediction',
      default: null,
    },
    analysisCount: {
      type: Number,
      default: 1,
    },
  },
  {
    timestamps: true,
  }
);

// High-performance compound indexes for patient scan history and chronological queries
MriScanSchema.index({ patientId: 1, scanDate: -1 });
MriScanSchema.index({ patientId: 1, createdAt: -1 });
MriScanSchema.index({ fileHash: 1, patientId: 1 });

module.exports = mongoose.model('MriScan', MriScanSchema);

const mongoose = require('mongoose');

const PredictionSchema = new mongoose.Schema(
  {
    originalFilename: {
      type: String,
      default: 'uploaded_scan.png',
      trim: true,
    },
    fileSize: {
      type: Number,
      default: 0,
    },
    predictedClass: {
      type: String,
      required: true,
      enum: ['MildDemented', 'ModerateDemented', 'NonDemented', 'VeryMildDemented'],
    },
    stageLabel: {
      type: String,
      required: true,
    },
    probabilities: {
      MildDemented: { type: Number, required: true },
      ModerateDemented: { type: Number, required: true },
      NonDemented: { type: Number, required: true },
      VeryMildDemented: { type: Number, required: true },
    },
    rawLogits: {
      type: [Number],
      default: [],
    },
    hasHeatmaps: {
      type: Boolean,
      default: false,
    },
    disclaimerAcknowledged: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

// Index on createdAt descending for fast history listing
PredictionSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Prediction', PredictionSchema);

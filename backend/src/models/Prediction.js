const mongoose = require('mongoose');

const PredictionSchema = new mongoose.Schema(
  {
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
    predictedClass: {
      type: String,
      required: true,
      enum: ['MildDemented', 'ModerateDemented', 'NonDemented', 'VeryMildDemented', 'Out-of-Distribution'],
    },
    stageLabel: {
      type: String,
      required: true,
    },
    stageNumber: {
      type: Number,
      default: 1,
    },
    displayLabel: {
      type: String,
    },
    alertLevel: {
      type: String,
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
    scanId: {
      type: String,
      default: null,
      trim: true,
      index: true,
    },
    evaluationType: {
      type: String,
      enum: ['original', 'reanalysis', 'follow_up'],
      default: 'original',
      index: true,
    },
    previousEvaluationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Prediction',
      default: null,
    },
    scanDate: {
      type: Date,
      default: null,
    },
    isOod: {
      type: Boolean,
      default: false,
      index: true,
    },
    uncertainty: {
      status: {
        type: String,
        default: 'normal',
      },
      predictiveEntropy: {
        type: Number,
        default: null,
      },
      calibratedConfidence: {
        type: Number,
        default: null,
      },
    },
    heatmaps: {
      gradcam: {
        type: String,
        default: null,
      },
      integratedGradients: {
        type: String,
        default: null,
      },
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for fast history listing, patient-scoped queries, and longitudinal comparisons
PredictionSchema.index({ createdAt: -1 });
PredictionSchema.index({ patientId: 1, createdAt: -1 });
PredictionSchema.index({ scanId: 1, createdAt: -1 });
PredictionSchema.index({ patientId: 1, isOod: 1, createdAt: -1 });

module.exports = mongoose.model('Prediction', PredictionSchema);

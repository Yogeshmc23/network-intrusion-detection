import mongoose, { Document, Schema, Model, Types } from 'mongoose';

export interface IPrediction extends Document {
  userId: Types.ObjectId;
  inputFeatures: Record<string, any>;
  prediction: string;
  confidence: number;
  modelUsed: string;
  threshold: number;
  createdAt: Date;
}

const PredictionSchema = new Schema<IPrediction>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    inputFeatures: {
      type: Schema.Types.Mixed,
      required: true,
    },
    prediction: {
      type: String,
      required: true,
      index: true,
      trim: true,
    },
    confidence: {
      type: Number,
      required: true,
    },
    modelUsed: {
      type: String,
      default: 'LightGBM (optional)',
      trim: true,
    },
    threshold: {
      type: Number,
      required: true,
      default: 0.5,
    },
    createdAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  {
    timestamps: false,
    versionKey: false,
  }
);

// Compound indexes for optimal queries and pagination
PredictionSchema.index({ userId: 1, createdAt: -1 });
PredictionSchema.index({ userId: 1, prediction: 1, createdAt: -1 });
PredictionSchema.index({ createdAt: -1 });

export const Prediction: Model<IPrediction> = mongoose.model<IPrediction>('Prediction', PredictionSchema);
export default Prediction;

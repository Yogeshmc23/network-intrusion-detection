import mongoose, { Document, Schema, Model } from 'mongoose';

export interface IRevokedRefreshToken extends Document {
  tokenHash: string;
  expiresAt: Date;
}

const RevokedRefreshTokenSchema = new Schema<IRevokedRefreshToken>(
  {
    tokenHash: { type: String, required: true, unique: true },
    expiresAt: { type: Date, required: true, expires: 0 },
  },
  { versionKey: false }
);

export const RevokedRefreshToken: Model<IRevokedRefreshToken> =
  mongoose.models.RevokedRefreshToken || mongoose.model<IRevokedRefreshToken>('RevokedRefreshToken', RevokedRefreshTokenSchema);
export default RevokedRefreshToken;

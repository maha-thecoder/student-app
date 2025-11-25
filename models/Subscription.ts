// src/models/Subscription.ts
import mongoose, { Document, Model, Schema } from 'mongoose';

export interface ISubscription {
  endpoint: string;
  keys?: {
    p256dh?: string;
    auth?: string;
  };
  subscription: any;
  userId?: string | null;
  deviceId?: string | null;
  ua?: string | null;
  lastSeenAt?: Date;
  isActive?: boolean;
  createdAt?: Date;
  updatedAt?: Date;
  [k: string]: any;
}

export interface ISubscriptionDocument extends ISubscription, Document {}

const SubscriptionSchema = new Schema<ISubscriptionDocument>(
  {
    endpoint: { type: String, required: true, unique: true },
    keys: {
      p256dh: String,
      auth: String,
    },
    subscription: { type: Schema.Types.Mixed, required: true },
    userId: { type: String, index: true, default: null },
    deviceId: { type: String, index: true, default: null },
    ua: { type: String, default: null },
    lastSeenAt: { type: Date, default: Date.now },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

const Subscription: Model<ISubscriptionDocument> =
  (mongoose.models.Subscription as Model<ISubscriptionDocument>) ||
  mongoose.model<ISubscriptionDocument>('Subscription', SubscriptionSchema);

export default Subscription;

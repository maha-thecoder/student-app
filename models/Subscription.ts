// src/models/Subscription.ts
import mongoose, { Document, Model, Schema } from 'mongoose';

export interface ISubscription {
  endpoint: string;
  keys?: {
    p256dh?: string;
    auth?: string;
  };
  subscription: any;
  userId?: string;
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
    // store the full subscription object so you can call web-push with it
    subscription: { type: Schema.Types.Mixed, required: true },
        userId: { type: String, index: true }, // optional, indexed for fast lookup

  },
  { timestamps: true }
);

const Subscription: Model<ISubscriptionDocument> =
  (mongoose.models.Subscription as Model<ISubscriptionDocument>) ||
  mongoose.model<ISubscriptionDocument>('Subscription', SubscriptionSchema);

export default Subscription;

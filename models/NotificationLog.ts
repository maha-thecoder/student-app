// src/models/NotificationLog.ts
import mongoose, { Document, Model, Schema } from "mongoose";

export interface INotificationLog {
  userId: string;
  bookId: string;
  lastNotifiedAt?: Date | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface INotificationLogDocument extends INotificationLog, Document {}

const NotificationLogSchema = new Schema<INotificationLogDocument>(
  {
    userId: { type: String, required: true, index: true },
    bookId: { type: String, required: true, index: true },
    lastNotifiedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

// ensure unique per user+book
NotificationLogSchema.index({ userId: 1, bookId: 1 }, { unique: true });

const NotificationLog: Model<INotificationLogDocument> =
  (mongoose.models.NotificationLog as Model<INotificationLogDocument>) ||
  mongoose.model<INotificationLogDocument>("NotificationLog", NotificationLogSchema);

export default NotificationLog;

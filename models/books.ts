// models/Book.ts
import mongoose, { Schema } from "mongoose";
import type { HydratedDocument, Model } from "mongoose";

/** Plain data shape (do NOT extend Document) */
export interface BookData {
  title: string;
  author?: string;
  takenDate: Date;
  dueDate: Date;
  borrowerRollno?: string;
  borrowerId: mongoose.Types.ObjectId
  createdAt?: Date;
}

/** Document type */
export interface BookDocument extends mongoose.Document, BookData {}

/** Schema */
const bookSchema = new Schema<BookDocument>({
  title: { type: String, required: true },
  author: { type: String },
  takenDate: { type: Date, required: true },
  dueDate: { type: Date, required: true },
  borrowerRollno: { type: String },
borrowerId: { type: mongoose.Schema.Types.ObjectId, ref: "Student", required: true }, // <-- add this

  createdAt: { type: Date, default: Date.now },
});

/** Model (cached to avoid OverwriteModelError in dev) */
const Book: Model<BookDocument> =
  (mongoose.models.Book as Model<BookDocument>) ||
  mongoose.model<BookDocument>("Book", bookSchema);

export default Book;

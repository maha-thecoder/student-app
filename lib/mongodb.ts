// src/lib/mongodb.ts
import mongoose from "mongoose";

const MONGODB_URI = process.env.API_KEY as string;

if (!MONGODB_URI) {
  throw new Error("❌ Please define MONGODB_URI in your .env.local");
}

// Define an interface for the cached object
interface MongooseCache {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
}

// Extend globalThis type for TS
declare global {
  // eslint-disable-next-line no-var
  var mongooseCache: MongooseCache | undefined;
}

// Initialize cache in global scope
const cached: MongooseCache = global.mongooseCache || {
  conn: null,
  promise: null,
};

global.mongooseCache = cached;

export async function connectDB(): Promise<typeof mongoose> {
  if (cached.conn) {
    return cached.conn;
  }

  if (!cached.promise) {
    cached.promise = mongoose.connect(MONGODB_URI).then((mongooseInstance) => {
      return mongooseInstance;
    });
  }

  cached.conn = await cached.promise;
  return cached.conn;
}

export default connectDB;

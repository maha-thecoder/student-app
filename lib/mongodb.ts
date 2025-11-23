import mongoose from "mongoose";

const MONGODB_URI = process.env.API_KEY as string;

if (!MONGODB_URI) {
  throw new Error("❌ Missing API_KEY in environment variables (.env.local)");
}

let isConnected = false; // track connection status

export async function connectDB(): Promise<void> {
  if (isConnected) {
    // If already connected, reuse connection
    console.log("⚡ Using existing mongoose connection");
    return;
  }

  try {
    await mongoose.connect(MONGODB_URI);
    isConnected = true;
    console.log("✅ Successfully connected to MongoDB");
  } catch (error: any) {
    console.error("❌ Mongoose connection error:", error.message);
    throw new Error("Database connection failed");
  }
}

import mongoose from "mongoose";
import { logger } from "./logger";

mongoose.set("bufferCommands", false);
let pending: Promise<void> | undefined;
let retryAfter = 0;

export async function connectMongo() {
  if (mongoose.connection.readyState === 1) return;
  if (pending) return pending;
  if (Date.now() < retryAfter) throw new Error("Database unavailable");
  pending = (async () => {
    try {
      const uri = process.env.MONGODB_URI;
      if (!uri) throw new Error("Missing database configuration");
      await mongoose.connect(uri, { serverSelectionTimeoutMS: 8000, maxPoolSize: 10 });
      logger.info("MongoDB connected");
    } catch {
      retryAfter = Date.now() + 15000;
      // Never log connection errors: they can contain credentials or hostnames.
      logger.error("MongoDB connection unavailable; check Atlas access and configuration");
      throw new Error("Database unavailable");
    } finally {
      pending = undefined;
    }
  })();
  return pending;
}

export { mongoose };
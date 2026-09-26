import mongoose from "mongoose";
import { logger } from "./logger";

mongoose.set("bufferCommands", false);
let pending: Promise<void> | undefined;
let retryAfter = 0;
let consecutiveFailures = 0;
let retryTimer: NodeJS.Timeout | undefined;

const maxRetryDelayMs = 30_000;

function clearRetryTimer() {
  if (retryTimer) {
    clearTimeout(retryTimer);
    retryTimer = undefined;
  }
}

function scheduleReconnect(delayMs: number) {
  if (retryTimer) return;
  retryTimer = setTimeout(() => {
    retryTimer = undefined;
    void connectMongo().catch(() => undefined);
  }, delayMs);
  retryTimer.unref();
}

function safeConnectionError(error: unknown) {
  if (typeof error !== "object" || error === null) {
    return { errorName: "UnknownError" };
  }

  const candidate = error as { name?: unknown; code?: unknown };
  const errorName = typeof candidate.name === "string"
    ? candidate.name.slice(0, 80)
    : "UnknownError";
  const errorCode =
    typeof candidate.code === "number"
      ? String(candidate.code)
      : typeof candidate.code === "string" && /^[A-Za-z0-9_.-]{1,40}$/.test(candidate.code)
        ? candidate.code
        : undefined;

  return { errorName, ...(errorCode ? { errorCode } : {}) };
}

export async function connectMongo() {
  if (mongoose.connection.readyState === 1) {
    consecutiveFailures = 0;
    retryAfter = 0;
    clearRetryTimer();
    return;
  }
  if (pending) return pending;
  if (Date.now() < retryAfter) throw new Error("Database unavailable");

  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error("Database unavailable");

  clearRetryTimer();
  pending = (async () => {
    try {
      await mongoose.connect(uri, {
        dbName: process.env.MONGODB_DB_NAME?.trim() || "test",
        serverSelectionTimeoutMS: 10_000,
        socketTimeoutMS: 45_000,
        maxPoolSize: 10,
        retryWrites: true,
      });
      consecutiveFailures = 0;
      retryAfter = 0;
      logger.info("MongoDB connected");
    } catch (error) {
      consecutiveFailures += 1;
      const retryDelayMs = Math.min(
        1_000 * 2 ** (consecutiveFailures - 1),
        maxRetryDelayMs,
      );
      retryAfter = Date.now() + retryDelayMs;
      // Log only safe error metadata; driver messages can contain connection details.
      logger.error(
        { ...safeConnectionError(error), retryDelayMs },
        "MongoDB connection unavailable; retry scheduled",
      );
      scheduleReconnect(retryDelayMs);
      throw new Error("Database unavailable");
    } finally {
      pending = undefined;
    }
  })();
  return pending;
}

export { mongoose };
import { z } from "zod";
import { logger } from "./logger";

const startupEnvironmentSchema = z.object({
  NODE_ENV: z.string().optional(),
  REPLIT_DEPLOYMENT: z.string().optional(),
  MONGODB_URI: z.string().trim().min(1).optional(),
  CLERK_PUBLISHABLE_KEY: z.string().optional(),
  VITE_CLERK_PUBLISHABLE_KEY: z.string().optional(),
  CLERK_SECRET_KEY: z.string().optional(),
  PSEUDONYM_SECRET: z.string().optional(),
});

export function isProductionEnvironment() {
  return process.env.NODE_ENV === "production" || process.env.REPLIT_DEPLOYMENT === "1";
}

export function getRuntimeEnvironment(): "development" | "production" | "test" {
  if (isProductionEnvironment()) return "production";
  return process.env.NODE_ENV === "test" ? "test" : "development";
}

export function getClerkMode(): "development" | "production" {
  const publishableKey =
    process.env.CLERK_PUBLISHABLE_KEY || process.env.VITE_CLERK_PUBLISHABLE_KEY || "";
  return publishableKey.startsWith("pk_live_") ? "production" : "development";
}

export function assertConfig() {
  const parsed = startupEnvironmentSchema.safeParse(process.env);
  const env = parsed.success ? parsed.data : {};
  const isProduction = isProductionEnvironment();
  const problems = parsed.success
    ? []
    : parsed.error.issues.map((issue) => String(issue.path[0] ?? "environment"));

  if (!env.MONGODB_URI) problems.push("MONGODB_URI missing");

  if (isProduction) {
    const publishableKey =
      env.CLERK_PUBLISHABLE_KEY || env.VITE_CLERK_PUBLISHABLE_KEY || "";
    if (!publishableKey.startsWith("pk_live_")) {
      problems.push("Clerk publishable key is not a production key");
    }
    if (!env.CLERK_SECRET_KEY?.startsWith("sk_live_")) {
      problems.push("Clerk secret key is not a production key");
    }
    if (!env.PSEUDONYM_SECRET?.trim()) problems.push("PSEUDONYM_SECRET missing");
  }

  if (!problems.length) return;

  if (isProduction) {
    logger.error({ problems }, "Production configuration invalid; refusing to start");
    process.exit(1);
  }

  logger.warn({ problems }, "Application configuration is incomplete");
}
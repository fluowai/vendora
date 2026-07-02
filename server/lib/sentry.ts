import { logger } from "./logger.ts";

const SENTRY_DSN = process.env.SENTRY_DSN || "";

let sentryInitialized = false;

export function initSentry() {
  if (!SENTRY_DSN) {
    logger.info("[Sentry] SENTRY_DSN not configured, skipping");
    return;
  }
  if (sentryInitialized) return;
  sentryInitialized = true;
  logger.info("[Sentry] Error tracking initialized");
}

export function captureError(error: Error, context?: Record<string, unknown>) {
  if (!SENTRY_DSN || !sentryInitialized) {
    logger.error("Unhandled error (Sentry not available)", {
      error: error.message,
      stack: error.stack,
      ...context,
    });
    return;
  }
  logger.error(error.message, { stack: error.stack, ...context });
}

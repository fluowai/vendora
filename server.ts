import express from "express";
import path from "path";
import cors from "cors";
import helmet from "helmet";
import { createServer as createViteServer } from "vite";
import { createServer as createHttpServer } from "http";
import dotenv from "dotenv";
import agentRoutes from "./server/routes/agents.ts";
import marketplaceRoutes from "./server/routes/marketplace.ts";
import authRoutes from "./server/routes/auth.ts";
import superadminRoutes from "./server/routes/superadmin.ts";
import conversationRoutes from "./server/routes/conversations.ts";
import integrationRoutes from "./server/routes/integrations.ts";
import analyticsRoutes from "./server/routes/analytics.ts";
import adminRoutes from "./server/routes/admin.ts";
import calendarRoutes from "./server/routes/calendar.ts";
import { errorHandler } from "./server/middleware/error-handler.ts";
import { authLimiter, apiLimiter } from "./server/middleware/rate-limit.ts";
import { requestIdMiddleware } from "./server/lib/logger.ts";
import { setupSocket, getIO } from "./server/lib/socket.ts";
import { setupWorkers, shutdownQueues } from "./server/lib/queue.ts";
import prisma from "./server/lib/prisma.ts";
import { registerMetricsEndpoint, trackHttpRequest } from "./server/lib/metrics.ts";
import ticketsRoutes from "./server/routes/tickets.ts";
import crmRoutes from "./server/routes/crm.ts";
import ombudsmanRoutes from "./server/routes/ombudsman.ts";
import uploadRoutes from "./server/routes/upload.ts";

dotenv.config();

const app = express();
const PORT = parseInt(process.env.PORT || "3333", 10);
const FRONTEND_URL = process.env.FRONTEND_URL || process.env.APP_URL || "http://localhost:5173";
const NODE_ENV = process.env.NODE_ENV || "development";

// Validate JWT_SECRET sempre (dev e production)
const jwtSecret = process.env.JWT_SECRET;
if (!jwtSecret || jwtSecret === "change-this-to-a-random-secret-in-production") {
  console.error("FATAL: JWT_SECRET não configurado. Defina um secret forte.");
  process.exit(1);
}
if (!process.env.JWT_REFRESH_SECRET || process.env.JWT_REFRESH_SECRET === "change-this-to-another-random-secret") {
  console.error("FATAL: JWT_REFRESH_SECRET não configurado.");
  process.exit(1);
}

app.set("trust proxy", 1);

// Request ID
app.use(requestIdMiddleware);

// Metrics tracking
app.use(trackHttpRequest);

// Security headers
app.use(helmet({
  strictTransportSecurity: { maxAge: 31536000, includeSubDomains: true, preload: true },
  crossOriginResourcePolicy: { policy: "cross-origin" },
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      imgSrc: ["'self'", "data:", "blob:", "https:"],
      fontSrc: ["'self'", "data:", "https://fonts.gstatic.com"],
      connectSrc: ["'self'", "ws:", "wss:", "https:", "http:"],
      frameSrc: ["'none'"],
      objectSrc: ["'none'"],
    },
  },
}));

// CORS
const allowedOrigins = NODE_ENV === "production"
  ? [FRONTEND_URL].filter(Boolean)
  : [FRONTEND_URL, "http://localhost:5173", "http://localhost:3333"];

app.use(cors({
  origin: allowedOrigins,
  credentials: true,
}));

app.use(express.json({ limit: "50mb" }));

// Global rate limiter
app.use("/api/", apiLimiter);

// Health check (no rate limit)
app.get("/api/health", async (_req, res) => {
  const checks: Record<string, string> = {};
  let allOk = true;

  try {
    await prisma.$queryRaw`SELECT 1`;
    checks.database = "ok";
  } catch {
    checks.database = "error";
    allOk = false;
  }

  if (process.env.REDIS_URL) {
    try {
      const { default: Redis } = await import("ioredis");
      const redis = new Redis(process.env.REDIS_URL, { lazyConnect: true, maxRetriesPerRequest: 0 });
      await redis.connect();
      await redis.ping();
      checks.redis = "ok";
      redis.disconnect();
    } catch {
      checks.redis = "error";
      allOk = false;
    }
  } else {
    checks.redis = "not_configured";
  }

  res.status(allOk ? 200 : 503).json({
    status: allOk ? "ok" : "degraded",
    version: "2.0.0",
    platform: "vendaora-360",
    timestamp: new Date().toISOString(),
    checks,
  });
});

// Metrics endpoint
registerMetricsEndpoint(app);

// API Routes
app.use("/api/auth", authLimiter, authRoutes);
app.use("/api/agents", agentRoutes);
app.use("/api/conversations", conversationRoutes);
app.use("/api/integrations", integrationRoutes);
app.use("/api/marketplace", marketplaceRoutes);
app.use("/api/superadmin", superadminRoutes);
app.use("/api/analytics", analyticsRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/calendar", calendarRoutes);
app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));
app.use("/api/upload", uploadRoutes);
app.use("/api/tickets", ticketsRoutes);
app.use("/api/crm", crmRoutes);
app.use("/api/ombudsman", ombudsmanRoutes);

// Global error handler (must be after routes)
app.use(errorHandler);

// Vite middleware for development
async function setupVite(server: any) {
  if (NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: { server },
      },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist", "assets");
    app.use("/assets", express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(process.cwd(), "dist", "index.html"));
    });
  }
}

const httpServer = createHttpServer(app);

// Setup WebSocket
const io = setupSocket(httpServer);
console.log("[Vendaora 360] WebSocket ready");

// Setup Queue workers (only if Redis is configured)
if (process.env.REDIS_URL) {
  setupWorkers();
  console.log("[Vendaora 360] Queue workers ready");
} else {
  console.log("[Vendaora 360] Redis not configured, queue workers disabled");
}

httpServer.listen(PORT, "0.0.0.0", () => {
  console.log(`[Vendaora 360] Server running on http://localhost:${PORT}`);
  console.log(`[Vendaora 360] Multi-Agent engine ready`);
});

setupVite(httpServer);

// Graceful shutdown
async function gracefulShutdown(signal: string) {
  console.log(`\n[Vendaora 360] ${signal} received. Starting graceful shutdown...`);

  httpServer.close(async () => {
    console.log("[Vendaora 360] HTTP server closed");

    try {
      await shutdownQueues();
      console.log("[Vendaora 360] Queue workers shut down");
    } catch (e) {
      console.error("[Vendaora 360] Queue shutdown error:", e);
    }

    try {
      io.close();
      console.log("[Vendaora 360] WebSocket server closed");
    } catch (e) {
      console.error("[Vendaora 360] WebSocket close error:", e);
    }

    try {
      await prisma.$disconnect();
      console.log("[Vendaora 360] Database disconnected");
    } catch (e) {
      console.error("[Vendaora 360] Prisma disconnect error:", e);
    }

    console.log("[Vendaora 360] Shutdown complete.");
    process.exit(0);
  });

  setTimeout(() => {
    console.error("[Vendaora 360] Forced shutdown after timeout");
    process.exit(1);
  }, 15000).unref();
}

process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));

export { io };

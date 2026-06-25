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
import { setupSocket } from "./server/lib/socket.ts";
import { setupWorkers } from "./server/lib/queue.ts";

dotenv.config();

const app = express();
const PORT = parseInt(process.env.PORT || "3333", 10);
const FRONTEND_URL = process.env.FRONTEND_URL || process.env.APP_URL || "http://localhost:5173";
const NODE_ENV = process.env.NODE_ENV || "development";

// Validate JWT_SECRET in production
if (NODE_ENV === "production") {
  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret || jwtSecret === "change-this-to-a-random-secret-in-production") {
    console.error("FATAL: JWT_SECRET não configurado. Defina um secret forte em produção.");
    process.exit(1);
  }
  if (!process.env.JWT_REFRESH_SECRET || process.env.JWT_REFRESH_SECRET === "change-this-to-another-random-secret") {
    console.error("FATAL: JWT_REFRESH_SECRET não configurado.");
    process.exit(1);
  }
}

app.set("trust proxy", 1);

// Request ID
app.use(requestIdMiddleware);

// Security headers
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" },
  contentSecurityPolicy: NODE_ENV === "production" ? undefined : false,
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
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", version: "2.0.0", platform: "vendaora-360" });
});

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

export { io };

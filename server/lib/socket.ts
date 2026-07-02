import { Server as HttpServer } from "http";
import { Server, Socket } from "socket.io";
import { verifyToken } from "../middleware/auth.ts";
import { logger } from "./logger.ts";

let io: Server | null = null;

export function setupSocket(httpServer: HttpServer): Server {
  io = new Server(httpServer, {
    cors: {
      origin: process.env.FRONTEND_URL || "http://localhost:5173",
      credentials: true,
    },
    pingInterval: 10000,
    pingTimeout: 5000,
  });

  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token || socket.handshake.query.token;
      if (!token) {
        return next(new Error("Token não fornecido"));
      }
      const user = verifyToken(token as string);
      socket.data.user = user;
      next();
    } catch {
      next(new Error("Token inválido"));
    }
  });

  io.on("connection", (socket: Socket) => {
    const user = socket.data.user;
    logger.info(`[Socket.IO] User connected: ${user.email}`);

    socket.join(`tenant:${user.tenantId}`);
    socket.join(`user:${user.userId}`);

    socket.on("join:conversation", (conversationId: string) => {
      socket.join(`conv:${conversationId}`);
    });

    socket.on("leave:conversation", (conversationId: string) => {
      socket.leave(`conv:${conversationId}`);
    });

    socket.on("typing:start", (data: { conversationId: string }) => {
      socket.to(`conv:${data.conversationId}`).emit("typing:start", {
        userId: user.userId,
        conversationId: data.conversationId,
      });
    });

    socket.on("typing:stop", (data: { conversationId: string }) => {
      socket.to(`conv:${data.conversationId}`).emit("typing:stop", {
        userId: user.userId,
        conversationId: data.conversationId,
      });
    });

    socket.on("disconnect", () => {
      logger.info(`[Socket.IO] User disconnected: ${user.email}`);
    });
  });

  return io;
}

export function getIO(): Server {
  if (!io) throw new Error("Socket.IO not initialized");
  return io;
}

export function emitToTenant(tenantId: string, event: string, data: unknown) {
  getIO().to(`tenant:${tenantId}`).emit(event, data);
}

export function emitToUser(userId: string, event: string, data: unknown) {
  getIO().to(`user:${userId}`).emit(event, data);
}

export function emitToConversation(conversationId: string, event: string, data: unknown) {
  getIO().to(`conv:${conversationId}`).emit(event, data);
}

import { useCallback, useEffect, useRef, useState } from "react";
import { io, Socket } from "socket.io-client";

const CONFIGURED_SOCKET_URL =
  (typeof import.meta !== "undefined" && (import.meta as any).env?.VITE_API_URL) || "same-origin";

function getSocketUrl(): string | undefined {
  const value = String(CONFIGURED_SOCKET_URL).trim();
  return !value || value === "same-origin" ? undefined : value;
}

export function useSocket() {
  const socketRef = useRef<Socket | null>(null);
  const [socket, setSocket] = useState<Socket | null>(null);
  const [connected, setConnected] = useState(false);
  const [lastMessage, setLastMessage] = useState<any>(null);

  useEffect(() => {
    const token = localStorage.getItem("vendaora_token");
    if (!token) return;

    const socketOptions = {
      auth: { token },
      transports: ["websocket"],
    };
    const socketUrl = getSocketUrl();
    const socket = socketUrl ? io(socketUrl, socketOptions) : io(socketOptions);

    socket.on("connect", () => {
      console.log("[Socket] Connected");
      setConnected(true);
    });

    socket.on("disconnect", () => {
      console.log("[Socket] Disconnected");
      setConnected(false);
    });

    socket.on("message:new", (data: any) => {
      setLastMessage({ type: "message:new", ...data });
    });

    socket.on("conversation:new", (data: any) => {
      setLastMessage({ type: "conversation:new", data });
    });

    socket.on("conversation:updated", (data: any) => {
      setLastMessage({ type: "conversation:updated", data });
    });

    socket.on("conversation:assigned", (data: any) => {
      setLastMessage({ type: "conversation:assigned", data });
    });

    socket.on("error", (error: any) => {
      console.error("[Socket] Error:", error);
    });

    socketRef.current = socket;
    setSocket(socket);

    return () => {
      socket.disconnect();
      socketRef.current = null;
      setSocket(null);
    };
  }, []);

  const joinConversation = useCallback((conversationId: string) => {
    socketRef.current?.emit("join:conversation", conversationId);
  }, []);

  const leaveConversation = useCallback((conversationId: string) => {
    socketRef.current?.emit("leave:conversation", conversationId);
  }, []);

  const startTyping = useCallback((conversationId: string) => {
    socketRef.current?.emit("typing:start", { conversationId });
  }, []);

  const stopTyping = useCallback((conversationId: string) => {
    socketRef.current?.emit("typing:stop", { conversationId });
  }, []);

  return {
    socket,
    connected,
    lastMessage,
    joinConversation,
    leaveConversation,
    startTyping,
    stopTyping,
  };
}

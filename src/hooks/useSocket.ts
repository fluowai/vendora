import { useEffect, useRef, useState } from "react";
import { io, Socket } from "socket.io-client";

const SOCKET_URL = (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_API_URL) || "http://localhost:3333";

export function useSocket() {
  const socketRef = useRef<Socket | null>(null);
  const [connected, setConnected] = useState(false);
  const [lastMessage, setLastMessage] = useState<any>(null);

  useEffect(() => {
    const token = localStorage.getItem("vendaora_token");
    if (!token) return;

    const socket = io(SOCKET_URL, {
      auth: { token },
      transports: ["websocket", "polling"],
    });

    socket.on("connect", () => {
      console.log("[Socket] Connected");
      setConnected(true);
    });

    socket.on("disconnect", () => {
      console.log("[Socket] Disconnected");
      setConnected(false);
    });

    socket.on("message:new", (data: any) => {
      setLastMessage(data);
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

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, []);

  const joinConversation = (conversationId: string) => {
    socketRef.current?.emit("join:conversation", conversationId);
  };

  const leaveConversation = (conversationId: string) => {
    socketRef.current?.emit("leave:conversation", conversationId);
  };

  const startTyping = (conversationId: string) => {
    socketRef.current?.emit("typing:start", { conversationId });
  };

  const stopTyping = (conversationId: string) => {
    socketRef.current?.emit("typing:stop", { conversationId });
  };

  return {
    socket: socketRef.current,
    connected,
    lastMessage,
    joinConversation,
    leaveConversation,
    startTyping,
    stopTyping,
  };
}

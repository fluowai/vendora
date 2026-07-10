import { ReactNode, useState, useCallback, useEffect } from "react";
import { StoreContext, User, Conversation } from "@/src/hooks/useStore";
import { useSocket } from "@/src/hooks/useSocket";

export function StoreProvider({ children }: { children: ReactNode }) {
  const [user, setUserState] = useState<User | null>(null);
  const [conversations, setConversationsState] = useState<Conversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [scope, setScope] = useState<"assigned" | "team" | "all">("assigned");

  const { lastMessage } = useSocket();

  useEffect(() => {
    const stored = localStorage.getItem("vendaora_user");
    if (stored) {
      try {
        setUserState(JSON.parse(stored));
      } catch {}
    }
    const token = localStorage.getItem("vendaora_token");
    if (token) {
      fetch("/api/auth/me", { headers: { Authorization: `Bearer ${token}` } })
        .then((res) => {
          if (res.status === 401 || res.status === 404) {
            localStorage.removeItem("vendaora_token");
            localStorage.removeItem("vendaora_user");
            localStorage.removeItem("vendaora_mega_token");
            localStorage.removeItem("vendaora_mega_user");
            setUserState(null);
            return null;
          }
          return res.ok ? res.json() : null;
        })
        .then((data) => {
          if (!data?.user) return;
          setUserState(data.user);
          localStorage.setItem("vendaora_user", JSON.stringify(data.user));
        })
        .catch(() => {});
    }
  }, []);

  useEffect(() => {
    if (!lastMessage) return;

    if (lastMessage.type === "message:new") {
      const message = lastMessage.message || lastMessage.data?.message;
      if (!message) return;
      setConversationsState((prev) =>
        prev.map((c) =>
          c.id === lastMessage.conversationId
            ? { ...c, lastMessage: message.content, lastMessageAt: message.sentAt, unread: c.unread + 1 }
            : c
        )
      );
    } else if (lastMessage.type === "conversation:new" && lastMessage.data) {
      setConversationsState((prev) =>
        prev.some((item) => item.id === lastMessage.data.id)
          ? prev
          : [lastMessage.data, ...prev]
      );
    } else if (lastMessage.type === "conversation:updated" && lastMessage.data) {
      const update = lastMessage.data.conversation || lastMessage.data;
      setConversationsState((prev) =>
        prev.map((item) =>
          item.id === (update.id || lastMessage.data.conversationId)
            ? {
                ...item,
                ...update,
                lastMessage: update.lastMessage ?? lastMessage.data.lastMessage ?? item.lastMessage,
                lastMessageAt: update.lastMessageAt ?? lastMessage.data.lastMessageAt ?? item.lastMessageAt,
              }
            : item
        )
      );
    }
  }, [lastMessage]);

  const setUser = useCallback((u: User | null) => {
    setUserState(u);
    if (u) {
      localStorage.setItem("vendaora_user", JSON.stringify(u));
    } else {
      localStorage.removeItem("vendaora_user");
    }
  }, []);

  const setConversations = useCallback((items: Conversation[]) => {
    setConversationsState(items);
  }, []);

  const addConversation = useCallback((conversation: Conversation) => {
    setConversationsState((prev) => [conversation, ...prev]);
  }, []);

  const updateConversation = useCallback((id: string, updates: Partial<Conversation>) => {
    setConversationsState((prev) =>
      prev.map((c) => (c.id === id ? { ...c, ...updates } : c))
    );
  }, []);

  return (
    <StoreContext.Provider value={{
      user,
      setUser,
      conversations,
      setConversations,
      addConversation,
      updateConversation,
      activeConversationId,
      setActiveConversationId,
      scope,
      setScope,
    }}>
      {children}
    </StoreContext.Provider>
  );
}

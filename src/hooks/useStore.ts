import { createContext, useContext } from "react";

interface User {
  id: string
  name: string
  email: string
  company: string
  plan: string
  isSuperadmin: boolean
  tenantId: string
  whiteLabelId?: string | null
  platformRole?: "none" | "mega_admin" | string
  roleScope?: "platform" | "whitelabel" | "tenant" | string
  permissions?: string[]
}

interface Conversation {
  id: string
  name: string
  channel: string
  status: string
  lastMessage: string
  lastMessageAt: string
  unread: number
  assignedUser?: { id: string; name: string } | null
}

interface StoreState {
  user: User | null
  setUser: (user: User | null) => void
  conversations: Conversation[]
  setConversations: (conversations: Conversation[]) => void
  addConversation: (conversation: Conversation) => void
  updateConversation: (id: string, updates: Partial<Conversation>) => void
  activeConversationId: string | null
  setActiveConversationId: (id: string | null) => void
  scope: "assigned" | "team" | "all"
  setScope: (scope: "assigned" | "team" | "all") => void
}

export const StoreContext = createContext<StoreState | null>(null);

export function useStore(): StoreState {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useStore must be used within StoreProvider");
  return ctx;
}

export type { User, Conversation, StoreState };

import { useState, useEffect, useCallback } from "react";
import type {
  PabxExtension, PabxQueue, PabxIvrMenu, PabxCallRoute,
  PabxCallLog, PabxStats, PabxQueueMember, PabxIvrOption,
} from "../types/pabx";

const API = "/api/pabx";

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const token = localStorage.getItem("vendaora_token");
  const res = await fetch(`${API}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...options?.headers,
    },
  });
  if (!res.ok) {
    const err = await res.text().catch(() => "request failed");
    throw new Error(err);
  }
  if (res.status === 204) return null as T;
  return res.json();
}

// ===== Extensions =====

export function usePabxExtensions() {
  const [extensions, setExtensions] = useState<PabxExtension[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try { const d = await apiFetch<{ extensions: PabxExtension[] }>("/extensions"); setExtensions(d.extensions); }
    finally { setLoading(false); }
  }, []);

  const create = useCallback(async (data: Partial<PabxExtension>) => {
    const d = await apiFetch<{ extension: PabxExtension }>("/extensions", { method: "POST", body: JSON.stringify(data) });
    setExtensions(p => [...p, d.extension]);
    return d.extension;
  }, []);

  const update = useCallback(async (id: string, data: Partial<PabxExtension>) => {
    const d = await apiFetch<{ extension: PabxExtension }>(`/extensions/${id}`, { method: "PATCH", body: JSON.stringify(data) });
    setExtensions(p => p.map(e => e.id === id ? d.extension : e));
    return d.extension;
  }, []);

  const remove = useCallback(async (id: string) => {
    await apiFetch(`/extensions/${id}`, { method: "DELETE" });
    setExtensions(p => p.filter(e => e.id !== id));
  }, []);

  useEffect(() => { load(); }, [load]);

  return { extensions, loading, load, create, update, remove };
}

// ===== Queues =====

export function usePabxQueues() {
  const [queues, setQueues] = useState<PabxQueue[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try { const d = await apiFetch<{ queues: PabxQueue[] }>("/queues"); setQueues(d.queues); }
    finally { setLoading(false); }
  }, []);

  const create = useCallback(async (data: Partial<PabxQueue>) => {
    const d = await apiFetch<{ queue: PabxQueue }>("/queues", { method: "POST", body: JSON.stringify(data) });
    setQueues(p => [...p, d.queue]);
    return d.queue;
  }, []);

  const update = useCallback(async (id: string, data: Partial<PabxQueue>) => {
    const d = await apiFetch<{ queue: PabxQueue }>(`/queues/${id}`, { method: "PATCH", body: JSON.stringify(data) });
    setQueues(p => p.map(q => q.id === id ? d.queue : q));
    return d.queue;
  }, []);

  const remove = useCallback(async (id: string) => {
    await apiFetch(`/queues/${id}`, { method: "DELETE" });
    setQueues(p => p.filter(q => q.id !== id));
  }, []);

  const addMember = useCallback(async (queueId: string, data: { extensionId: string; priority?: number; timeout?: number }) => {
    const d = await apiFetch<{ member: PabxQueueMember }>(`/queues/${queueId}/members`, { method: "POST", body: JSON.stringify(data) });
    setQueues(p => p.map(q =>
      q.id === queueId ? { ...q, members: [...q.members, d.member] } : q
    ));
    return d.member;
  }, []);

  const removeMember = useCallback(async (queueId: string, memberId: string) => {
    await apiFetch(`/queues/${queueId}/members/${memberId}`, { method: "DELETE" });
    setQueues(p => p.map(q =>
      q.id === queueId ? { ...q, members: q.members.filter(m => m.id !== memberId) } : q
    ));
  }, []);

  useEffect(() => { load(); }, [load]);

  return { queues, loading, load, create, update, remove, addMember, removeMember };
}

// ===== IVR Menus =====

export function usePabxIvr() {
  const [menus, setMenus] = useState<PabxIvrMenu[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try { const d = await apiFetch<{ menus: PabxIvrMenu[] }>("/ivr"); setMenus(d.menus); }
    finally { setLoading(false); }
  }, []);

  const create = useCallback(async (data: Partial<PabxIvrMenu>) => {
    const d = await apiFetch<{ menu: PabxIvrMenu }>("/ivr", { method: "POST", body: JSON.stringify(data) });
    setMenus(p => [...p, d.menu]);
    return d.menu;
  }, []);

  const update = useCallback(async (id: string, data: Partial<PabxIvrMenu>) => {
    const d = await apiFetch<{ menu: PabxIvrMenu }>(`/ivr/${id}`, { method: "PATCH", body: JSON.stringify(data) });
    setMenus(p => p.map(m => m.id === id ? d.menu : m));
    return d.menu;
  }, []);

  const remove = useCallback(async (id: string) => {
    await apiFetch(`/ivr/${id}`, { method: "DELETE" });
    setMenus(p => p.filter(m => m.id !== id));
  }, []);

  const addOption = useCallback(async (menuId: string, data: Partial<PabxIvrOption>) => {
    const d = await apiFetch<{ option: PabxIvrOption }>(`/ivr/${menuId}/options`, { method: "POST", body: JSON.stringify(data) });
    setMenus(p => p.map(m =>
      m.id === menuId ? { ...m, options: [...m.options, d.option] } : m
    ));
    return d.option;
  }, []);

  const removeOption = useCallback(async (menuId: string, optionId: string) => {
    await apiFetch(`/ivr/${menuId}/options/${optionId}`, { method: "DELETE" });
    setMenus(p => p.map(m =>
      m.id === menuId ? { ...m, options: m.options.filter(o => o.id !== optionId) } : m
    ));
  }, []);

  useEffect(() => { load(); }, [load]);

  return { menus, loading, load, create, update, remove, addOption, removeOption };
}

// ===== Routes =====

export function usePabxRoutes() {
  const [routes, setRoutes] = useState<PabxCallRoute[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try { const d = await apiFetch<{ routes: PabxCallRoute[] }>("/routes"); setRoutes(d.routes); }
    finally { setLoading(false); }
  }, []);

  const create = useCallback(async (data: Partial<PabxCallRoute>) => {
    const d = await apiFetch<{ route: PabxCallRoute }>("/routes", { method: "POST", body: JSON.stringify(data) });
    setRoutes(p => [...p, d.route]);
    return d.route;
  }, []);

  const update = useCallback(async (id: string, data: Partial<PabxCallRoute>) => {
    const d = await apiFetch<{ route: PabxCallRoute }>(`/routes/${id}`, { method: "PATCH", body: JSON.stringify(data) });
    setRoutes(p => p.map(r => r.id === id ? d.route : r));
    return d.route;
  }, []);

  const remove = useCallback(async (id: string) => {
    await apiFetch(`/routes/${id}`, { method: "DELETE" });
    setRoutes(p => p.filter(r => r.id !== id));
  }, []);

  useEffect(() => { load(); }, [load]);

  return { routes, loading, load, create, update, remove };
}

// ===== Stats =====

export function usePabxStats() {
  const [stats, setStats] = useState<PabxStats | null>(null);
  const [recentCalls, setRecentCalls] = useState<PabxCallLog[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const d = await apiFetch<{ stats: PabxStats; recentCalls: PabxCallLog[] }>("/stats");
      setStats(d.stats);
      setRecentCalls(d.recentCalls || []);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  return { stats, recentCalls, loading, load };
}

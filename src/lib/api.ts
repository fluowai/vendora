const API_BASE = '/api'

function getAuthHeaders(): Record<string, string> {
  const token = localStorage.getItem('vendaora_token')
  return token ? { 'Authorization': `Bearer ${token}` } : {}
}

async function request<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${endpoint}`, {
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeaders(),
      ...options?.headers,
    },
    ...options,
  })
  if (res.status === 401) {
    localStorage.removeItem('vendaora_token')
    localStorage.removeItem('vendaora_user')
    window.location.href = '/auth'
    throw new Error('Sessão expirada')
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }))
    throw new Error(err.error || `Request failed: ${res.status}`)
  }
  return res.json()
}

export const api = {
  // Agents
  getAgents: () => request<{ agents: any[] }>('/agents'),
  getAgent: (id: string) => request<{ agent: any }>(`/agents/${id}`),
  createAgent: (data: any) => request<{ agent: any }>('/agents', { method: 'POST', body: JSON.stringify(data) }),
  updateAgent: (id: string, data: any) => request<{ agent: any }>(`/agents/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteAgent: (id: string) => request<{ success: boolean }>(`/agents/${id}`, { method: 'DELETE' }),
  chatWithAgent: (id: string, message: string, conversationId?: string, contactName?: string) =>
    request<{ response: string; conversationId: string; metadata: any }>(`/agents/${id}/chat`, {
      method: 'POST',
      body: JSON.stringify({ message, conversationId, contactName }),
    }),
  orchestrate: (primaryAgentId: string, message: string, supportingAgentIds: string[]) =>
    request<{ finalResponse: string; steps: any[] }>('/agents/orchestrate', {
      method: 'POST',
      body: JSON.stringify({ primaryAgentId, message, supportingAgentIds }),
    }),

  // Marketplace
  getMarketplaceAgents: (segment?: string, sort?: string) => {
    const params = new URLSearchParams()
    if (segment && segment !== 'todos') params.set('segment', segment)
    if (sort) params.set('sort', sort)
    return request<{ agents: any[]; stats: any }>(`/marketplace/agents?${params}`)
  },
  getMarketplaceFeatured: () => request<{ agents: any[] }>('/marketplace/featured'),
  getMarketplaceTrending: () => request<{ agents: any[] }>('/marketplace/trending'),
  getMarketplaceSegments: () => request<{ segments: any[] }>('/marketplace/segments'),

  // Knowledge Base
  getKnowledgeBases: () => request<{ knowledgeBases: any[] }>('/agents/knowledge'),
  createKnowledgeBase: (name: string) => request<{ knowledgeBase: any }>('/agents/knowledge', { method: 'POST', body: JSON.stringify({ name }) }),
  getKnowledgeBase: (id: string) => request<{ knowledgeBase: any }>(`/agents/knowledge/${id}`),
  addDocument: (kbId: string, doc: any) => request<{ document: any }>(`/agents/knowledge/${kbId}/documents`, { method: 'POST', body: JSON.stringify(doc) }),
  deleteDocument: (kbId: string, docId: string) => request<{ success: boolean }>(`/agents/knowledge/${kbId}/documents/${docId}`, { method: 'DELETE' }),
  searchKnowledge: (kbId: string, query: string) => request<{ results: string[] }>(`/agents/knowledge/${kbId}/search`, { method: 'POST', body: JSON.stringify({ query }) }),

  // Workflows
  getWorkflows: () => request<{ workflows: any[] }>('/agents/workflows/all'),
  createWorkflow: (data: any) => request<{ workflow: any }>('/agents/workflows', { method: 'POST', body: JSON.stringify(data) }),
  executeWorkflow: (id: string, input: string, context?: any) =>
    request<{ finalResponse: string; steps: any[] }>(`/agents/workflows/${id}/execute`, { method: 'POST', body: JSON.stringify({ input, context }) }),

  // Conversations
  getConversations: (params?: { status?: string; search?: string; channel?: string; scope?: string }) => {
    const qs = new URLSearchParams()
    if (params?.status) qs.set('status', params.status)
    if (params?.search) qs.set('search', params.search)
    if (params?.channel) qs.set('channel', params.channel)
    if (params?.scope) qs.set('scope', params.scope)
    const suffix = qs.toString() ? `?${qs}` : ''
    return request<{ conversations: any[] }>(`/conversations${suffix}`)
  },
  getConversation: (id: string) => request<{ conversation: any }>(`/conversations/${id}`),
  createConversation: (data: any) => request<{ conversation: any }>('/conversations', { method: 'POST', body: JSON.stringify(data) }),
  updateConversation: (id: string, data: any) => request<{ conversation: any }>(`/conversations/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  sendConversationMessage: (id: string, content: string, metadata?: any) =>
    request<{ message: any }>(`/conversations/${id}/messages`, {
      method: 'POST',
      body: JSON.stringify({ content, metadata }),
    }),
  assignConversation: (id: string, userId: string) =>
    request<{ conversation: any }>(`/conversations/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ assignedUserId: userId }),
    }),

  // Calendar / Appointments
  getCalendars: () => request<{ calendars: any[] }>('/calendar/calendars'),
  getAvailableSlots: (params?: { from?: string; days?: number; limit?: number }) => {
    const qs = new URLSearchParams()
    if (params?.from) qs.set('from', params.from)
    if (params?.days) qs.set('days', String(params.days))
    if (params?.limit) qs.set('limit', String(params.limit))
    const suffix = qs.toString() ? `?${qs}` : ''
    return request<{ calendarId: string; slots: string[] }>(`/calendar/slots${suffix}`)
  },
  getAppointments: (params?: { from?: string; to?: string }) => {
    const qs = new URLSearchParams()
    if (params?.from) qs.set('from', params.from)
    if (params?.to) qs.set('to', params.to)
    const suffix = qs.toString() ? `?${qs}` : ''
    return request<{ appointments: any[] }>(`/calendar/appointments${suffix}`)
  },
  createAppointment: (data: any) => request<{ appointment: any }>('/calendar/appointments', {
    method: 'POST',
    body: JSON.stringify(data),
  }),
  updateAppointment: (id: string, data: any) => request<{ appointment: any }>(`/calendar/appointments/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  }),

  // Integrations / Connections
  getIntegrationStatus: () => request<{ integrations: any; channels: any[] }>('/integrations/status'),
  getConnections: () => request<{ connections: any[] }>('/integrations/connections'),
  createConnection: (data: any) => request<{ connection: any }>('/integrations/connections', {
    method: 'POST',
    body: JSON.stringify(data),
  }),
  getWhatsmeowInstanceStatus: (id: string) => request<any>(`/integrations/whatsmeow/instances/${id}/status`),
  getWhatsmeowInstanceQr: (id: string) => request<any>(`/integrations/whatsmeow/instances/${id}/qr`),

  // Analytics
  getAnalyticsOverview: () => request<{ overview: any }>('/analytics/overview'),
  getAnalyticsDaily: (days?: number) => request<{ daily: any[] }>(`/analytics/daily?days=${days || 7}`),
  getAnalyticsAgents: () => request<{ agents: any[] }>('/analytics/agents'),
  getAnalyticsTeam: () => request<{ team: any[] }>('/analytics/team'),
  getConversationsTrend: (hours?: number) => request<{ trend: any[] }>(`/analytics/conversations-trend?hours=${hours || 24}`),

  // Admin
  getTeam: () => request<{ team: any[] }>('/admin/team'),
  inviteTeamMember: (data: any) => request<{ user: any }>('/admin/team/invite', { method: 'POST', body: JSON.stringify(data) }),
  updateTeamMember: (id: string, data: any) => request<{ success: boolean }>(`/admin/team/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteTeamMember: (id: string) => request<{ success: boolean }>(`/admin/team/${id}`, { method: 'DELETE' }),
  getRoles: () => request<{ roles: any[] }>('/admin/roles'),
  getDepartments: () => request<{ departments: any[] }>('/admin/departments'),
  createDepartment: (name: string) => request<{ department: any }>('/admin/departments', { method: 'POST', body: JSON.stringify({ name }) }),
  deleteDepartment: (id: string) => request<{ success: boolean }>(`/admin/departments/${id}`, { method: 'DELETE' }),
  getSettings: () => request<{ settings: any }>('/admin/settings'),
  updateSettings: (data: any) => request<{ success: boolean }>(`/admin/settings`, { method: 'PUT', body: JSON.stringify(data) }),

  // Tickets
  getTickets: (params?: { status?: string; priority?: string; search?: string }) => {
    const qs = new URLSearchParams()
    if (params?.status) qs.set('status', params.status)
    if (params?.priority) qs.set('priority', params.priority)
    if (params?.search) qs.set('search', params.search)
    const suffix = qs.toString() ? `?${qs}` : ''
    return request<{ tickets: any[]; stats: any }>(`/tickets${suffix}`)
  },
  getTicket: (id: string) => request<{ ticket: any }>(`/tickets/${id}`),
  createTicket: (data: any) => request<{ ticket: any }>('/tickets', { method: 'POST', body: JSON.stringify(data) }),
  updateTicket: (id: string, data: any) => request<{ ticket: any }>(`/tickets/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteTicket: (id: string) => request<{ success: boolean }>(`/tickets/${id}`, { method: 'DELETE' }),

  // CRM
  getFunnels: () => request<{ funnels: any[] }>('/crm/funnels'),
  createFunnel: (data: any) => request<{ funnel: any }>('/crm/funnels', { method: 'POST', body: JSON.stringify(data) }),
  getFunnelStages: (funnelId: string) => request<{ funnel: any; stages: any[] }>(`/crm/stages/${funnelId}`),
  getDeals: (params?: { status?: string; funnelId?: string }) => {
    const qs = new URLSearchParams()
    if (params?.status) qs.set('status', params.status)
    if (params?.funnelId) qs.set('funnelId', params.funnelId)
    const suffix = qs.toString() ? `?${qs}` : ''
    return request<{ deals: any[] }>(`/crm/deals${suffix}`)
  },
  createDeal: (data: any) => request<{ deal: any }>('/crm/deals', { method: 'POST', body: JSON.stringify(data) }),
  updateDeal: (id: string, data: any) => request<{ deal: any }>(`/crm/deals/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),

  // Ombudsman
  getOmbudsmanCases: (params?: { status?: string; type?: string; priority?: string; search?: string }) => {
    const qs = new URLSearchParams()
    if (params?.status) qs.set('status', params.status)
    if (params?.type) qs.set('type', params.type)
    if (params?.priority) qs.set('priority', params.priority)
    if (params?.search) qs.set('search', params.search)
    const suffix = qs.toString() ? `?${qs}` : ''
    return request<{ cases: any[]; stats: any }>(`/ombudsman/cases${suffix}`)
  },
  getOmbudsmanCase: (id: string) => request<{ case: any }>(`/ombudsman/cases/${id}`),
  createOmbudsmanCase: (data: any) => request<{ case: any }>('/ombudsman/cases', { method: 'POST', body: JSON.stringify(data) }),
  updateOmbudsmanCase: (id: string, data: any) => request<{ case: any }>(`/ombudsman/cases/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),

  // Upload
  uploadAvatar: (base64: string, mimeType: string) =>
    request<{ url: string }>('/upload/avatar', { method: 'POST', body: JSON.stringify({ base64, mimeType }) }),
}

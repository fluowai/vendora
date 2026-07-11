export type AgentStatus = 'active' | 'paused' | 'draft'
export type AgentSegment = 'vendas' | 'suporte' | 'retencao' | 'saude' | 'juridico' | 'educacao' | 'imobiliario' | 'financeiro' | 'rh' | 'logistica' | 'ecommerce'
export type LLMProvider = 'gemini' | 'openai' | 'anthropic' | 'groq' | 'glm' | 'custom'
export type ChannelType = 'whatsapp' | 'instagram' | 'web' | 'email' | 'telegram' | 'discord' | 'voice'

export interface LLMConfig {
  provider: LLMProvider
  model: string
  apiKey?: string
  temperature?: number
  maxTokens?: number
  systemPrompt?: string
}

export interface KnowledgeBase {
  id: string
  name: string
  documents: Document[]
  createdAt: string
}

export interface Document {
  id: string
  name: string
  type: 'pdf' | 'txt' | 'url' | 'csv'
  content: string
  chunks: string[]
  embeddings?: number[][]
  createdAt: string
}

export interface Agent {
  id: string
  name: string
  description: string
  avatar?: string
  segment: AgentSegment
  status: AgentStatus
  llmConfig: LLMConfig
  channels: ChannelType[]
  knowledgeBaseId?: string
  parentId?: string
  isPublished: boolean
  price?: number
  installs: number
  rating: number
  authorId: string
  authorName: string
  tags: string[]
  createdAt: string
  updatedAt: string
}

export interface AgentTemplate {
  id: string
  name: string
  description: string
  segment: AgentSegment
  icon: string
  promptTemplate: string
  channels: ChannelType[]
  suggestedPrice: number
}

export interface Conversation {
  id: string
  agentId: string
  contactId: string
  contactName: string
  channel: ChannelType
  messages: Message[]
  status: 'active' | 'waiting' | 'closed'
  createdAt: string
}

export interface Message {
  id: string
  role: 'user' | 'agent' | 'orchestrator' | 'system'
  content: string
  agentId?: string
  metadata?: Record<string, any>
  timestamp: string
}

export interface WorkflowStep {
  id: string
  agentId: string
  condition?: string
  actions: WorkflowAction[]
}

export interface WorkflowAction {
  type: 'send_message' | 'create_lead' | 'schedule' | 'transfer' | 'webhook' | 'api_call'
  config: Record<string, any>
}

export interface Workflow {
  id: string
  name: string
  description: string
  trigger: 'new_lead' | 'new_message' | 'scheduled' | 'webhook'
  steps: WorkflowStep[]
  isActive: boolean
}

export interface MarketplaceListing {
  agent: Agent
  totalDownloads: number
  reviews: Review[]
  category: AgentSegment
  featured: boolean
}

export interface Review {
  id: string
  userId: string
  userName: string
  rating: number
  comment: string
  createdAt: string
}

export interface Plan {
  id: string
  name: string
  price: number
  maxAgents: number
  maxConversations: number
  channels: ChannelType[]
  features: string[]
}

export interface AnalyticsMetric {
  agentId: string
  period: 'day' | 'week' | 'month'
  conversations: number
  leads: number
  sales: number
  satisfaction: number
  responseTime: number
  resolutionRate: number
}

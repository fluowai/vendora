export type PabxExtensionStatus = "active" | "paused" | "offline"
export type PabxQueueStrategy = "ringall" | "leastrecent" | "fewestcalls" | "random"
export type PabxQueueStatus = "active" | "paused"
export type IvrGreetingType = "text" | "audio"
export type IvrMenuStatus = "active" | "inactive"
export type DestType = "extension" | "queue" | "ivr" | "voicemail"
export type RouteStatus = "active" | "inactive"
export type CallDirection = "inbound" | "outbound" | "internal"
export type CallLogStatus = "ringing" | "connected" | "ended" | "missed" | "failed"

export interface PabxExtension {
  id: string
  tenantId: string
  extension: string
  name: string
  description?: string | null
  userId?: string | null
  user?: { id: string; name: string; email: string } | null
  departmentId?: string | null
  department?: { id: string; name: string } | null
  status: PabxExtensionStatus
  ringTimeout: number
  callLimit: number
  mobile?: string | null
  email?: string | null
  voicemail: boolean
  createdAt: string
  updatedAt: string
  queueMembers?: PabxQueueMember[]
}

export interface PabxQueue {
  id: string
  tenantId: string
  name: string
  description?: string | null
  strategy: PabxQueueStrategy
  ringTimeout: number
  maxWaitTime: number
  maxCallers: number
  musicOnHold?: string | null
  welcomeMsg?: string | null
  status: PabxQueueStatus
  createdAt: string
  updatedAt: string
  members: PabxQueueMember[]
}

export interface PabxQueueMember {
  id: string
  queueId: string
  extensionId: string
  extension?: { id: string; extension: string; name: string; status?: string }
  priority: number
  timeout: number
}

export interface PabxIvrMenu {
  id: string
  tenantId: string
  name: string
  description?: string | null
  greeting?: string | null
  greetingType: IvrGreetingType
  timeout: number
  timeoutDestType?: DestType | null
  timeoutDestId?: string | null
  invalidDestType?: DestType | null
  invalidDestId?: string | null
  language: string
  status: IvrMenuStatus
  createdAt: string
  updatedAt: string
  options: PabxIvrOption[]
}

export interface PabxIvrOption {
  id: string
  ivrMenuId: string
  digit: string
  description?: string | null
  destinationType: DestType
  destinationId: string
}

export interface PabxCallRoute {
  id: string
  tenantId: string
  name: string
  description?: string | null
  source: string
  destinationType: DestType
  destinationId?: string | null
  ivrMenuId?: string | null
  ivrMenu?: { id: string; name: string } | null
  priority: number
  timeSchedule?: any
  status: RouteStatus
  createdAt: string
  updatedAt: string
}

export interface PabxCallLog {
  id: string
  tenantId: string
  callId: string
  sessionId?: string | null
  callerId: string
  callerName?: string | null
  direction: CallDirection
  destinationType?: string | null
  destinationId?: string | null
  extensionNumber?: string | null
  queueName?: string | null
  ivrName?: string | null
  status: CallLogStatus
  duration?: number | null
  ringDuration?: number | null
  recordingUrl?: string | null
  notes?: string | null
  startedAt?: string | null
  endedAt?: string | null
  createdAt: string
}

export interface PabxStats {
  totalExtensions: number
  activeExtensions: number
  totalQueues: number
  activeIvrMenus: number
  activeRoutes: number
}

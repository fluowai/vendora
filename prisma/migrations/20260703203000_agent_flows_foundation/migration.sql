CREATE TABLE IF NOT EXISTS "AgentFlow" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "status" TEXT NOT NULL DEFAULT 'draft',
  "trigger" TEXT NOT NULL DEFAULT 'manual',
  "channel" TEXT,
  "publicEnabled" BOOLEAN NOT NULL DEFAULT false,
  "publishedVersionId" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AgentFlow_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "FlowVersion" (
  "id" TEXT NOT NULL,
  "flowId" TEXT NOT NULL,
  "version" INTEGER NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'draft',
  "graph" JSONB NOT NULL,
  "createdBy" TEXT,
  "publishedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "FlowVersion_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "FlowRun" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "flowId" TEXT NOT NULL,
  "versionId" TEXT NOT NULL,
  "conversationId" TEXT,
  "contactId" TEXT,
  "status" TEXT NOT NULL DEFAULT 'running',
  "currentNodeId" TEXT,
  "variables" JSONB,
  "lastInput" TEXT,
  "lastError" TEXT,
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completedAt" TIMESTAMP(3),
  CONSTRAINT "FlowRun_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "FlowRunStep" (
  "id" TEXT NOT NULL,
  "runId" TEXT NOT NULL,
  "nodeId" TEXT NOT NULL,
  "nodeType" TEXT NOT NULL,
  "input" JSONB,
  "output" JSONB,
  "status" TEXT NOT NULL DEFAULT 'completed',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "FlowRunStep_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "FlowVersion_flowId_version_key" ON "FlowVersion"("flowId", "version");
CREATE INDEX IF NOT EXISTS "AgentFlow_tenantId_status_idx" ON "AgentFlow"("tenantId", "status");
CREATE INDEX IF NOT EXISTS "AgentFlow_tenantId_trigger_idx" ON "AgentFlow"("tenantId", "trigger");
CREATE INDEX IF NOT EXISTS "FlowVersion_flowId_status_idx" ON "FlowVersion"("flowId", "status");
CREATE INDEX IF NOT EXISTS "FlowRun_tenantId_status_idx" ON "FlowRun"("tenantId", "status");
CREATE INDEX IF NOT EXISTS "FlowRun_flowId_status_idx" ON "FlowRun"("flowId", "status");
CREATE INDEX IF NOT EXISTS "FlowRun_conversationId_status_idx" ON "FlowRun"("conversationId", "status");
CREATE INDEX IF NOT EXISTS "FlowRunStep_runId_createdAt_idx" ON "FlowRunStep"("runId", "createdAt");

DO $$
BEGIN
  ALTER TABLE "AgentFlow" ADD COLUMN IF NOT EXISTS "publicEnabled" BOOLEAN NOT NULL DEFAULT false;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'AgentFlow_tenantId_fkey') THEN
    ALTER TABLE "AgentFlow" ADD CONSTRAINT "AgentFlow_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FlowVersion_flowId_fkey') THEN
    ALTER TABLE "FlowVersion" ADD CONSTRAINT "FlowVersion_flowId_fkey" FOREIGN KEY ("flowId") REFERENCES "AgentFlow"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FlowRun_tenantId_fkey') THEN
    ALTER TABLE "FlowRun" ADD CONSTRAINT "FlowRun_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FlowRun_flowId_fkey') THEN
    ALTER TABLE "FlowRun" ADD CONSTRAINT "FlowRun_flowId_fkey" FOREIGN KEY ("flowId") REFERENCES "AgentFlow"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FlowRun_versionId_fkey') THEN
    ALTER TABLE "FlowRun" ADD CONSTRAINT "FlowRun_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "FlowVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FlowRun_conversationId_fkey') THEN
    ALTER TABLE "FlowRun" ADD CONSTRAINT "FlowRun_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FlowRun_contactId_fkey') THEN
    ALTER TABLE "FlowRun" ADD CONSTRAINT "FlowRun_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FlowRunStep_runId_fkey') THEN
    ALTER TABLE "FlowRunStep" ADD CONSTRAINT "FlowRunStep_runId_fkey" FOREIGN KEY ("runId") REFERENCES "FlowRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

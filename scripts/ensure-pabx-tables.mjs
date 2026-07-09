import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const statements = [
  `CREATE TABLE IF NOT EXISTS "PabxExtension" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "extension" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "userId" TEXT,
    "departmentId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "ringTimeout" INTEGER NOT NULL DEFAULT 30,
    "callLimit" INTEGER NOT NULL DEFAULT 2,
    "mobile" TEXT,
    "email" TEXT,
    "voicemail" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PabxExtension_pkey" PRIMARY KEY ("id")
  )`,
  `CREATE TABLE IF NOT EXISTS "PabxQueue" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "strategy" TEXT NOT NULL DEFAULT 'ringall',
    "ringTimeout" INTEGER NOT NULL DEFAULT 30,
    "maxWaitTime" INTEGER NOT NULL DEFAULT 300,
    "maxCallers" INTEGER NOT NULL DEFAULT 10,
    "musicOnHold" TEXT,
    "welcomeMsg" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PabxQueue_pkey" PRIMARY KEY ("id")
  )`,
  `CREATE TABLE IF NOT EXISTS "PabxQueueMember" (
    "id" TEXT NOT NULL,
    "queueId" TEXT NOT NULL,
    "extensionId" TEXT NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 1,
    "timeout" INTEGER NOT NULL DEFAULT 30,
    CONSTRAINT "PabxQueueMember_pkey" PRIMARY KEY ("id")
  )`,
  `CREATE TABLE IF NOT EXISTS "PabxIvrMenu" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "greeting" TEXT,
    "greetingType" TEXT NOT NULL DEFAULT 'text',
    "timeout" INTEGER NOT NULL DEFAULT 10,
    "timeoutDestType" TEXT,
    "timeoutDestId" TEXT,
    "invalidDestType" TEXT,
    "invalidDestId" TEXT,
    "language" TEXT NOT NULL DEFAULT 'pt-BR',
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PabxIvrMenu_pkey" PRIMARY KEY ("id")
  )`,
  `CREATE TABLE IF NOT EXISTS "PabxIvrOption" (
    "id" TEXT NOT NULL,
    "ivrMenuId" TEXT NOT NULL,
    "digit" TEXT NOT NULL,
    "description" TEXT,
    "destinationType" TEXT NOT NULL,
    "destinationId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PabxIvrOption_pkey" PRIMARY KEY ("id")
  )`,
  `CREATE TABLE IF NOT EXISTS "PabxCallRoute" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "source" TEXT NOT NULL,
    "destinationType" TEXT NOT NULL,
    "destinationId" TEXT,
    "ivrMenuId" TEXT,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "timeSchedule" JSONB,
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PabxCallRoute_pkey" PRIMARY KEY ("id")
  )`,
  `CREATE TABLE IF NOT EXISTS "PabxCallLog" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "callId" TEXT NOT NULL,
    "sessionId" TEXT,
    "callerId" TEXT NOT NULL,
    "callerName" TEXT,
    "direction" TEXT NOT NULL,
    "destinationType" TEXT,
    "destinationId" TEXT,
    "extensionNumber" TEXT,
    "queueName" TEXT,
    "ivrName" TEXT,
    "status" TEXT NOT NULL,
    "duration" INTEGER,
    "ringDuration" INTEGER,
    "recordingUrl" TEXT,
    "tags" JSONB,
    "notes" TEXT,
    "startedAt" TIMESTAMP(3),
    "endedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PabxCallLog_pkey" PRIMARY KEY ("id")
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "PabxExtension_tenantId_extension_key" ON "PabxExtension"("tenantId", "extension")`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "PabxQueueMember_queueId_extensionId_key" ON "PabxQueueMember"("queueId", "extensionId")`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "PabxIvrOption_ivrMenuId_digit_key" ON "PabxIvrOption"("ivrMenuId", "digit")`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "PabxCallLog_callId_key" ON "PabxCallLog"("callId")`,
  `CREATE INDEX IF NOT EXISTS "PabxExtension_tenantId_status_idx" ON "PabxExtension"("tenantId", "status")`,
  `CREATE INDEX IF NOT EXISTS "PabxExtension_userId_idx" ON "PabxExtension"("userId")`,
  `CREATE INDEX IF NOT EXISTS "PabxQueue_tenantId_status_idx" ON "PabxQueue"("tenantId", "status")`,
  `CREATE INDEX IF NOT EXISTS "PabxIvrMenu_tenantId_status_idx" ON "PabxIvrMenu"("tenantId", "status")`,
  `CREATE INDEX IF NOT EXISTS "PabxCallRoute_tenantId_status_idx" ON "PabxCallRoute"("tenantId", "status")`,
  `CREATE INDEX IF NOT EXISTS "PabxCallRoute_source_idx" ON "PabxCallRoute"("source")`,
  `CREATE INDEX IF NOT EXISTS "PabxCallLog_tenantId_startedAt_idx" ON "PabxCallLog"("tenantId", "startedAt")`,
  `CREATE INDEX IF NOT EXISTS "PabxCallLog_callerId_idx" ON "PabxCallLog"("callerId")`,
  `CREATE INDEX IF NOT EXISTS "PabxCallLog_callId_idx" ON "PabxCallLog"("callId")`,
  `CREATE INDEX IF NOT EXISTS "PabxCallLog_status_idx" ON "PabxCallLog"("status")`,
  `DO $$ BEGIN
    ALTER TABLE "PabxExtension" ADD CONSTRAINT "PabxExtension_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
  `DO $$ BEGIN
    ALTER TABLE "PabxExtension" ADD CONSTRAINT "PabxExtension_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
  `DO $$ BEGIN
    ALTER TABLE "PabxExtension" ADD CONSTRAINT "PabxExtension_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
  `DO $$ BEGIN
    ALTER TABLE "PabxQueue" ADD CONSTRAINT "PabxQueue_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
  `DO $$ BEGIN
    ALTER TABLE "PabxQueueMember" ADD CONSTRAINT "PabxQueueMember_queueId_fkey" FOREIGN KEY ("queueId") REFERENCES "PabxQueue"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
  `DO $$ BEGIN
    ALTER TABLE "PabxQueueMember" ADD CONSTRAINT "PabxQueueMember_extensionId_fkey" FOREIGN KEY ("extensionId") REFERENCES "PabxExtension"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
  `DO $$ BEGIN
    ALTER TABLE "PabxIvrMenu" ADD CONSTRAINT "PabxIvrMenu_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
  `DO $$ BEGIN
    ALTER TABLE "PabxIvrOption" ADD CONSTRAINT "PabxIvrOption_ivrMenuId_fkey" FOREIGN KEY ("ivrMenuId") REFERENCES "PabxIvrMenu"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
  `DO $$ BEGIN
    ALTER TABLE "PabxCallRoute" ADD CONSTRAINT "PabxCallRoute_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
  `DO $$ BEGIN
    ALTER TABLE "PabxCallRoute" ADD CONSTRAINT "PabxCallRoute_ivrMenuId_fkey" FOREIGN KEY ("ivrMenuId") REFERENCES "PabxIvrMenu"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
  `DO $$ BEGIN
    ALTER TABLE "PabxCallLog" ADD CONSTRAINT "PabxCallLog_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
];

try {
  for (const statement of statements) {
    await prisma.$executeRawUnsafe(statement);
  }
  console.log("PABX tables ensured.");
} finally {
  await prisma.$disconnect();
}

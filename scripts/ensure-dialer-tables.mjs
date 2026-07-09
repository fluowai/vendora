import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const statements = [
  `CREATE TABLE IF NOT EXISTS "DialingCampaign" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "mode" TEXT NOT NULL DEFAULT 'predictive',
    "scheduleStart" TIMESTAMP(3),
    "scheduleEnd" TIMESTAMP(3),
    "maxAttempts" INTEGER NOT NULL DEFAULT 3,
    "intervalSeconds" INTEGER NOT NULL DEFAULT 60,
    "agentId" TEXT,
    "sessionId" TEXT,
    "callerId" TEXT,
    "dailyLimit" INTEGER,
    "totalContacts" INTEGER NOT NULL DEFAULT 0,
    "calledCount" INTEGER NOT NULL DEFAULT 0,
    "answeredCount" INTEGER NOT NULL DEFAULT 0,
    "successCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DialingCampaign_pkey" PRIMARY KEY ("id")
  )`,
  `CREATE TABLE IF NOT EXISTS "CampaignContact" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "contactId" TEXT,
    "name" TEXT,
    "phone" TEXT NOT NULL,
    "email" TEXT,
    "metadata" JSONB,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CampaignContact_pkey" PRIMARY KEY ("id")
  )`,
  `CREATE TABLE IF NOT EXISTS "CallAttempt" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "sessionId" TEXT,
    "callId" TEXT,
    "attempt" INTEGER NOT NULL DEFAULT 1,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "duration" INTEGER,
    "direction" TEXT NOT NULL DEFAULT 'outbound',
    "result" TEXT,
    "errorMessage" TEXT,
    "startedAt" TIMESTAMP(3),
    "endedAt" TIMESTAMP(3),
    "recordingUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CallAttempt_pkey" PRIMARY KEY ("id")
  )`,
  `DO $$ BEGIN
    ALTER TABLE "DialingCampaign" ADD CONSTRAINT "DialingCampaign_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
  `DO $$ BEGIN
    ALTER TABLE "CampaignContact" ADD CONSTRAINT "CampaignContact_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "DialingCampaign"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
  `DO $$ BEGIN
    ALTER TABLE "CampaignContact" ADD CONSTRAINT "CampaignContact_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
  `DO $$ BEGIN
    ALTER TABLE "CallAttempt" ADD CONSTRAINT "CallAttempt_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "DialingCampaign"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
  `DO $$ BEGIN
    ALTER TABLE "CallAttempt" ADD CONSTRAINT "CallAttempt_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "CampaignContact"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
  `CREATE INDEX IF NOT EXISTS "DialingCampaign_tenantId_status_idx" ON "DialingCampaign"("tenantId", "status")`,
  `CREATE INDEX IF NOT EXISTS "CampaignContact_campaignId_status_idx" ON "CampaignContact"("campaignId", "status")`,
  `CREATE INDEX IF NOT EXISTS "CampaignContact_phone_idx" ON "CampaignContact"("phone")`,
  `CREATE INDEX IF NOT EXISTS "CallAttempt_campaignId_idx" ON "CallAttempt"("campaignId")`,
  `CREATE INDEX IF NOT EXISTS "CallAttempt_status_idx" ON "CallAttempt"("status")`,
  `CREATE INDEX IF NOT EXISTS "CallAttempt_callId_idx" ON "CallAttempt"("callId")`,
];

try {
  for (const statement of statements) {
    await prisma.$executeRawUnsafe(statement);
  }
  console.log("Dialer tables ensured.");
} finally {
  await prisma.$disconnect();
}

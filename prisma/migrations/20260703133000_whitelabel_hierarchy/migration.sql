CREATE TABLE IF NOT EXISTS "WhiteLabel" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "document" TEXT,
  "email" TEXT,
  "phone" TEXT,
  "status" TEXT NOT NULL DEFAULT 'active',
  "customDomain" TEXT,
  "branding" JSONB,
  "limits" JSONB,
  "billingConfig" JSONB,
  "planId" TEXT,
  "ownerUserId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "WhiteLabel_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "whiteLabelId" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "whiteLabelId" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "platformRole" TEXT NOT NULL DEFAULT 'none';
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "roleScope" TEXT NOT NULL DEFAULT 'tenant';

CREATE UNIQUE INDEX IF NOT EXISTS "WhiteLabel_slug_key" ON "WhiteLabel"("slug");
CREATE UNIQUE INDEX IF NOT EXISTS "WhiteLabel_customDomain_key" ON "WhiteLabel"("customDomain");
CREATE INDEX IF NOT EXISTS "WhiteLabel_slug_idx" ON "WhiteLabel"("slug");
CREATE INDEX IF NOT EXISTS "WhiteLabel_status_idx" ON "WhiteLabel"("status");
CREATE INDEX IF NOT EXISTS "WhiteLabel_planId_idx" ON "WhiteLabel"("planId");
CREATE INDEX IF NOT EXISTS "WhiteLabel_ownerUserId_idx" ON "WhiteLabel"("ownerUserId");
CREATE INDEX IF NOT EXISTS "Tenant_whiteLabelId_idx" ON "Tenant"("whiteLabelId");
CREATE INDEX IF NOT EXISTS "User_whiteLabelId_idx" ON "User"("whiteLabelId");
CREATE INDEX IF NOT EXISTS "User_platformRole_idx" ON "User"("platformRole");
CREATE INDEX IF NOT EXISTS "User_roleScope_idx" ON "User"("roleScope");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'WhiteLabel_planId_fkey') THEN
    ALTER TABLE "WhiteLabel" ADD CONSTRAINT "WhiteLabel_planId_fkey" FOREIGN KEY ("planId") REFERENCES "Plan"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'WhiteLabel_ownerUserId_fkey') THEN
    ALTER TABLE "WhiteLabel" ADD CONSTRAINT "WhiteLabel_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Tenant_whiteLabelId_fkey') THEN
    ALTER TABLE "Tenant" ADD CONSTRAINT "Tenant_whiteLabelId_fkey" FOREIGN KEY ("whiteLabelId") REFERENCES "WhiteLabel"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'User_whiteLabelId_fkey') THEN
    ALTER TABLE "User" ADD CONSTRAINT "User_whiteLabelId_fkey" FOREIGN KEY ("whiteLabelId") REFERENCES "WhiteLabel"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

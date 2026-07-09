import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

try {
  const rows = await prisma.$queryRawUnsafe(`
    select tablename
    from pg_tables
    where schemaname = 'public'
      and tablename in ('DialingCampaign', 'CampaignContact', 'CallAttempt')
    order by tablename
  `);
  console.log(JSON.stringify(rows, null, 2));
} finally {
  await prisma.$disconnect();
}

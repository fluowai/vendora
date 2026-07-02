import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
  console.log("=== TENANTS ===");
  const tenants = await prisma.tenant.findMany();
  for (const t of tenants) {
    console.log(`  ${t.id} | ${t.slug} | ${t.name}`);
  }

  console.log("\n=== ALL USERS ===");
  const users = await prisma.user.findMany({ select: { id: true, name: true, email: true, tenantId: true } });
  for (const u of users) {
    console.log(`  ${u.id} | ${u.email} | ${u.name} | tenant: ${u.tenantId}`);
  }

  console.log("\n=== ALL ROLES ===");
  const roles = await prisma.role.findMany({ include: { permissions: true } });
  for (const r of roles) {
    console.log(`  ${r.id} | tenant: ${r.tenantId} | name: ${r.name}`);
    for (const p of r.permissions) {
      console.log(`    ${p.action}:${p.subject}`);
    }
  }

  console.log("\n=== ALL USER-ROLES ===");
  const userRoles = await prisma.userRole.findMany();
  for (const ur of userRoles) {
    console.log(`  user: ${ur.userId} | role: ${ur.roleId}`);
  }

  await prisma.$disconnect();
}
main().catch((e) => { console.error(e); process.exit(1); });

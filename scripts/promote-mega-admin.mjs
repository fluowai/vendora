import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const email = process.argv[2] || process.env.MEGA_ADMIN_EMAIL || "admin@vendaora.com";

try {
  const user = await prisma.user.findUnique({ where: { email }, include: { tenant: true } });
  if (!user) {
    console.error(`User not found: ${email}`);
    process.exitCode = 1;
  } else {
    await prisma.user.update({
      where: { id: user.id },
      data: {
        isSuperadmin: true,
        platformRole: "mega_admin",
        roleScope: "platform",
        whiteLabelId: null,
      },
    });
    await prisma.refreshToken.deleteMany({ where: { userId: user.id } });
    console.log(`Promoted ${email} to Mega Admin.`);
  }
} finally {
  await prisma.$disconnect();
}

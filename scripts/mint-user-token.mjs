import { PrismaClient } from "@prisma/client";
import jwt from "jsonwebtoken";

const prisma = new PrismaClient();
const email = process.argv[2] || "admin@vendaora.com";
const secret = process.env.JWT_SECRET || "insecure-dev-secret";

try {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    console.error(`User not found: ${email}`);
    process.exitCode = 1;
  } else {
    const token = jwt.sign({
      userId: user.id,
      email: user.email,
      tenantId: user.tenantId,
      isSuperadmin: user.isSuperadmin,
      whiteLabelId: user.whiteLabelId,
      platformRole: user.platformRole,
      roleScope: user.roleScope,
    }, secret, { expiresIn: "15m" });
    console.log(token);
  }
} finally {
  await prisma.$disconnect();
}

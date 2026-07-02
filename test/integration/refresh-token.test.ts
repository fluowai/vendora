import { describe, it, expect, beforeAll, afterAll } from "vitest";
import crypto from "crypto";
import jwt from "jsonwebtoken";
import { generateRefreshToken, rotateRefreshToken, revokeAllRefreshTokens } from "../../server/middleware/auth";

let serverPrisma: any;

const TEST_USER_ID = "test-refresh-user-id";
const TEST_TENANT_ID = "test-refresh-tenant";

const mockUser = {
  userId: TEST_USER_ID,
  email: "refresh@test.com",
  tenantId: TEST_TENANT_ID,
  isSuperadmin: false,
};

beforeAll(async () => {
  serverPrisma = (await import("../../server/lib/prisma")).default;
  await serverPrisma.refreshToken.deleteMany({ where: { userId: TEST_USER_ID } });
  await serverPrisma.user.deleteMany({ where: { id: TEST_USER_ID } });
  await serverPrisma.tenant.deleteMany({ where: { id: TEST_TENANT_ID } });

  await serverPrisma.tenant.create({
    data: { id: TEST_TENANT_ID, name: "Refresh Test", slug: "refresh-test" },
  });
  await serverPrisma.user.create({
    data: {
      id: TEST_USER_ID,
      email: mockUser.email,
      name: "Refresh Test",
      passwordHash: "hash",
      tenantId: TEST_TENANT_ID,
    },
  });
});

afterAll(async () => {
  await serverPrisma.refreshToken.deleteMany({ where: { userId: TEST_USER_ID } });
  await serverPrisma.userRole.deleteMany({ where: { userId: TEST_USER_ID } });
  await serverPrisma.user.deleteMany({ where: { id: TEST_USER_ID } });
  await serverPrisma.tenant.deleteMany({ where: { id: TEST_TENANT_ID } });
});

async function hashToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

describe("generateRefreshToken", () => {
  it("should create a token and persist to database", async () => {
    const result = await generateRefreshToken(mockUser);

    expect(result.token).toBeTruthy();
    expect(typeof result.token).toBe("string");
    expect(result.family).toBeTruthy();

    const tokenHash = await hashToken(result.token);
    const stored = await serverPrisma.refreshToken.findUnique({ where: { tokenHash } });
    expect(stored).not.toBeNull();
    expect(stored!.userId).toBe(TEST_USER_ID);
    expect(stored!.family).toBe(result.family);
    expect(stored!.expiresAt.getTime()).toBeGreaterThan(Date.now());
  });
});

describe("rotateRefreshToken", () => {
  it("should rotate a valid refresh token, keeping the same family", async () => {
    const { token: oldToken, family } = await generateRefreshToken(mockUser);

    const result = await rotateRefreshToken(oldToken);

    expect(result).not.toBeNull();
    expect(result!.accessToken).toBeTruthy();
    expect(result!.refreshToken).toBeTruthy();
    expect(result!.refreshToken).not.toBe(oldToken);

    const oldHash = await hashToken(oldToken);
    const oldStored = await serverPrisma.refreshToken.findUnique({ where: { tokenHash: oldHash } });
    expect(oldStored).toBeNull();

    const newHash = await hashToken(result!.refreshToken);
    const newStored = await serverPrisma.refreshToken.findUnique({ where: { tokenHash: newHash } });
    expect(newStored).not.toBeNull();
    expect(newStored!.family).toBe(family);
  });

  it("should return null for invalid token", async () => {
    const result = await rotateRefreshToken("invalid-token");
    expect(result).toBeNull();
  });

  it("should return null for expired token", async () => {
    const expiredPayload = { ...mockUser, jti: crypto.randomUUID(), family: crypto.randomUUID() };
    const expiredToken = jwt.sign(
      expiredPayload,
      (process.env.JWT_SECRET || "") + "-refresh",
      { expiresIn: "0s" },
    );
    await new Promise((r) => setTimeout(r, 100));
    const result = await rotateRefreshToken(expiredToken);
    expect(result).toBeNull();
  });

  it("should detect token theft when old token is reused", async () => {
    const { token } = await generateRefreshToken(mockUser);

    const firstUse = await rotateRefreshToken(token);
    expect(firstUse).not.toBeNull();

    const oldHash = await hashToken(token);
    const oldStored = await serverPrisma.refreshToken.findUnique({ where: { tokenHash: oldHash } });
    expect(oldStored).toBeNull();

    const secondUse = await rotateRefreshToken(token);
    expect(secondUse).toBeNull();
  });

  it("should invalidate entire token family on theft", async () => {
    const { token: oldToken, family } = await generateRefreshToken(mockUser);
    const firstRotation = await rotateRefreshToken(oldToken);
    expect(firstRotation).not.toBeNull();

    const secondFakeRotation = await rotateRefreshToken(oldToken);
    expect(secondFakeRotation).toBeNull();

    const familyTokens = await serverPrisma.refreshToken.findMany({ where: { family } });
    expect(familyTokens.length).toBe(0);
  });
});

describe("revokeAllRefreshTokens", () => {
  it("should revoke all tokens for a user", async () => {
    await generateRefreshToken(mockUser);
    await generateRefreshToken(mockUser);

    await revokeAllRefreshTokens(TEST_USER_ID);

    const remaining = await serverPrisma.refreshToken.findMany({
      where: { userId: TEST_USER_ID },
    });
    expect(remaining.length).toBe(0);
  });
});

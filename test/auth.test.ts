import { describe, it, expect } from "vitest";
import { generateToken, verifyToken } from "../server/middleware/auth";

describe("Auth Middleware", () => {
  const mockPayload = {
    userId: "test-user-id",
    email: "test@test.com",
    tenantId: "test-tenant",
    isSuperadmin: false,
  };

  it("should generate and verify a valid JWT token", () => {
    const token = generateToken(mockPayload);
    expect(token).toBeTruthy();
    expect(typeof token).toBe("string");

    const decoded = verifyToken(token);
    expect(decoded.userId).toBe(mockPayload.userId);
    expect(decoded.email).toBe(mockPayload.email);
    expect(decoded.tenantId).toBe(mockPayload.tenantId);
    expect(decoded.isSuperadmin).toBe(false);
  });

  it("should throw on invalid token", () => {
    expect(() => verifyToken("invalid-token")).toThrow();
  });

  it("should handle superadmin flag", () => {
    const adminPayload = { ...mockPayload, isSuperadmin: true };
    const token = generateToken(adminPayload);
    const decoded = verifyToken(token);
    expect(decoded.isSuperadmin).toBe(true);
  });
});

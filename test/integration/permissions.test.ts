import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { Request, Response, NextFunction } from "express";
import { PrismaClient } from "@prisma/client";
import { requirePermission, clearPermissionCache, scopeFilter } from "../../server/middleware/permissions";

const prisma = new PrismaClient();

const TEST_TENANT_ID = "test-perm-tenant";
const TEST_USER_ID = "test-perm-user";
const TEST_ROLE_ID = "test-perm-role";

beforeAll(async () => {
  await prisma.$transaction([
    prisma.userRole.deleteMany({ where: { userId: TEST_USER_ID } }),
    prisma.permission.deleteMany({ where: { roleId: TEST_ROLE_ID } }),
    prisma.role.deleteMany({ where: { id: TEST_ROLE_ID } }),
    prisma.user.deleteMany({ where: { id: TEST_USER_ID } }),
    prisma.tenant.deleteMany({ where: { id: TEST_TENANT_ID } }),
  ]);

  await prisma.tenant.create({ data: { id: TEST_TENANT_ID, name: "Test Tenant", slug: "test-perm-tenant" } });

  await prisma.role.create({
    data: {
      id: TEST_ROLE_ID,
      tenantId: TEST_TENANT_ID,
      name: "test-role",
      permissions: {
        create: [
          { action: "reports", subject: "read" },
          { action: "tickets", subject: "manage" },
        ],
      },
    },
  });

  await prisma.user.create({
    data: {
      id: TEST_USER_ID,
      email: "perm@test.com",
      name: "Perm Test",
      passwordHash: "hash",
      tenantId: TEST_TENANT_ID,
    },
  });

  await prisma.userRole.create({
    data: { userId: TEST_USER_ID, roleId: TEST_ROLE_ID },
  });
});

afterAll(async () => {
  await prisma.$transaction([
    prisma.userRole.deleteMany({ where: { userId: TEST_USER_ID } }),
    prisma.permission.deleteMany({ where: { roleId: TEST_ROLE_ID } }),
    prisma.role.deleteMany({ where: { id: TEST_ROLE_ID } }),
    prisma.user.deleteMany({ where: { id: TEST_USER_ID } }),
    prisma.tenant.deleteMany({ where: { id: TEST_TENANT_ID } }),
  ]);
  await prisma.$disconnect();
});

beforeEach(() => {
  clearPermissionCache(TEST_USER_ID);
});

describe("requirePermission", () => {
  function mockReqRes(user?: { userId: string; isSuperadmin: boolean }) {
    const req = { user } as Request;
    let statusCode = 0;
    let jsonBody: any;
    const res = {
      status: (code: number) => {
        statusCode = code;
        return res;
      },
      json: (body: any) => { jsonBody = body; },
    } as unknown as Response;
    const next = (() => { statusCode = 200; }) as unknown as NextFunction;
    return { req, res, next, getStatus: () => statusCode, getBody: () => jsonBody };
  }

  it("should allow access when user has the required permission", async () => {
    const { req, res, next, getStatus } = mockReqRes({
      userId: TEST_USER_ID,
      isSuperadmin: false,
    });

    await requirePermission("reports", "read")(req, res, next);
    expect(getStatus()).toBe(200);
  });

  it("should allow write access when the user has manage permission", async () => {
    const { req, res, next, getStatus } = mockReqRes({
      userId: TEST_USER_ID,
      isSuperadmin: false,
    });

    await requirePermission("tickets", "write")(req, res, next);
    expect(getStatus()).toBe(200);
  });

  it("should deny access when user lacks the required permission", async () => {
    const { req, res, next, getStatus, getBody } = mockReqRes({
      userId: TEST_USER_ID,
      isSuperadmin: false,
    });

    await requirePermission("settings", "write")(req, res, next);
    expect(getStatus()).toBe(403);
    expect(getBody()).toEqual({ error: "Acesso negado: permissao necessaria" });
  });

  it("should allow superadmin regardless of permissions", async () => {
    const { req, res, next, getStatus } = mockReqRes({
      userId: "superadmin-user",
      isSuperadmin: true,
    });

    await requirePermission("settings", "write")(req, res, next);
    expect(getStatus()).toBe(200);
  });

  it("should return 401 if user is not authenticated", async () => {
    const { req, res, next, getStatus, getBody } = mockReqRes(undefined);

    await requirePermission("reports", "read")(req, res, next);
    expect(getStatus()).toBe(401);
    expect(getBody()).toEqual({ error: "Autenticacao necessaria" });
  });
});

describe("scopeFilter", () => {
  it("should return empty filter for superadmin", () => {
    const req = { user: { isSuperadmin: true }, query: {} } as unknown as Request;
    expect(scopeFilter(req)).toEqual({});
  });

  it("should return assigned filter for scope=assigned", () => {
    const req = { user: { userId: "user-1", isSuperadmin: false }, query: { scope: "assigned" } } as unknown as Request;
    expect(scopeFilter(req)).toEqual({ assignedUserId: "user-1" });
  });

  it("should return team filter for scope=team", () => {
    const req = { user: { userId: "user-1", isSuperadmin: false }, query: { scope: "team" } } as unknown as Request;
    expect(scopeFilter(req)).toEqual({ assignedUserId: { not: null } });
  });

  it("should return empty filter for unknown scope", () => {
    const req = { user: { userId: "user-1", isSuperadmin: false }, query: { scope: "all" } } as unknown as Request;
    expect(scopeFilter(req)).toEqual({});
  });
});

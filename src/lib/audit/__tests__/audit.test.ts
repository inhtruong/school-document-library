import { beforeEach, describe, expect, test, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: { auditLog: { create: vi.fn() } },
}));

import { prisma } from "@/lib/prisma";
import { actorFromSessionUser, writeAuditLog } from "@/lib/audit/audit";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("writeAuditLog", () => {
  test("writes the actor snapshot, action, entity, and metadata as given", async () => {
    vi.mocked(prisma.auditLog.create).mockResolvedValue({} as never);

    await writeAuditLog({
      actor: { id: "user_1", email: "user@example.com", role: "ADMIN" },
      action: "DOCUMENT_APPROVED",
      entityType: "DOCUMENT",
      entityId: "doc_1",
      metadata: { fromStatus: "PENDING", toStatus: "APPROVED" },
    });

    expect(prisma.auditLog.create).toHaveBeenCalledWith({
      data: {
        actorUserId: "user_1",
        actorEmail: "user@example.com",
        actorRole: "ADMIN",
        action: "DOCUMENT_APPROVED",
        entityType: "DOCUMENT",
        entityId: "doc_1",
        status: "SUCCESS",
        metadata: { fromStatus: "PENDING", toStatus: "APPROVED" },
      },
    });
  });

  test("defaults status to SUCCESS when omitted", async () => {
    vi.mocked(prisma.auditLog.create).mockResolvedValue({} as never);

    await writeAuditLog({ actor: null, action: "USER_LOGIN_FAILED" });

    const call = vi.mocked(prisma.auditLog.create).mock.calls[0][0];
    expect(call.data.status).toBe("SUCCESS");
  });

  test("respects an explicit FAILURE status", async () => {
    vi.mocked(prisma.auditLog.create).mockResolvedValue({} as never);

    await writeAuditLog({ actor: null, action: "USER_LOGIN_FAILED", status: "FAILURE" });

    const call = vi.mocked(prisma.auditLog.create).mock.calls[0][0];
    expect(call.data.status).toBe("FAILURE");
  });

  test("a null actor writes null actorUserId/actorEmail/actorRole — never a fabricated actor", async () => {
    vi.mocked(prisma.auditLog.create).mockResolvedValue({} as never);

    await writeAuditLog({ actor: null, action: "USER_LOGIN_FAILED" });

    expect(prisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ actorUserId: null, actorEmail: null, actorRole: null }),
      })
    );
  });

  test("omits entityType/entityId/metadata as null/undefined when not provided", async () => {
    vi.mocked(prisma.auditLog.create).mockResolvedValue({} as never);

    await writeAuditLog({ actor: { id: "user_1", email: null, role: "STUDENT" }, action: "USER_REGISTERED" });

    expect(prisma.auditLog.create).toHaveBeenCalledWith({
      data: {
        actorUserId: "user_1",
        actorEmail: null,
        actorRole: "STUDENT",
        action: "USER_REGISTERED",
        entityType: null,
        entityId: null,
        status: "SUCCESS",
        metadata: undefined,
      },
    });
  });

  test("accepts an optional transaction client and writes through it instead of the module singleton", async () => {
    const txCreate = vi.fn().mockResolvedValue({});
    const tx = { auditLog: { create: txCreate } } as never;

    await writeAuditLog({ actor: null, action: "USER_LOGIN_FAILED" }, tx);

    expect(txCreate).toHaveBeenCalledTimes(1);
    expect(prisma.auditLog.create).not.toHaveBeenCalled();
  });
});

describe("actorFromSessionUser", () => {
  test("normalizes a missing email to null", () => {
    expect(actorFromSessionUser({ id: "user_1", role: "TEACHER" })).toEqual({
      id: "user_1",
      email: null,
      role: "TEACHER",
    });
  });

  test("passes through a real email unchanged", () => {
    expect(actorFromSessionUser({ id: "user_1", email: "user@example.com", role: "ADMIN" })).toEqual({
      id: "user_1",
      email: "user@example.com",
      role: "ADMIN",
    });
  });

  test("normalizes a null email to null (session.user.email can be explicitly null)", () => {
    expect(actorFromSessionUser({ id: "user_1", email: null, role: "STUDENT" })).toEqual({
      id: "user_1",
      email: null,
      role: "STUDENT",
    });
  });
});

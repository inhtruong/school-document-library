import { beforeEach, describe, expect, test, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    auditLog: { findMany: vi.fn(), count: vi.fn() },
    document: { findMany: vi.fn() },
  },
}));

import { prisma } from "@/lib/prisma";
import { AUDIT_LOG_PAGE_SIZE } from "@/lib/audit/audit-log-config";
import { listAuditLogs } from "@/lib/audit/audit-log-list";

const now = new Date("2026-01-01T00:00:00.000Z");

function row(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: "log_1",
    actorEmail: "admin@example.com",
    actorRole: "ADMIN",
    action: "DOCUMENT_APPROVED",
    entityType: "DOCUMENT",
    entityId: "doc_1",
    status: "SUCCESS",
    metadata: { documentTitle: "Test Document" },
    createdAt: now,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(prisma.document.findMany).mockResolvedValue([]);
});

describe("listAuditLogs — pagination", () => {
  test("orders newest first and caps take at AUDIT_LOG_PAGE_SIZE", async () => {
    vi.mocked(prisma.auditLog.findMany).mockResolvedValue([]);
    vi.mocked(prisma.auditLog.count).mockResolvedValue(0);

    await listAuditLogs({}, 2);

    expect(prisma.auditLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: { createdAt: "desc" },
        skip: AUDIT_LOG_PAGE_SIZE,
        take: AUDIT_LOG_PAGE_SIZE,
      })
    );
  });

  test("total comes from the DB count, not the current page's length", async () => {
    vi.mocked(prisma.auditLog.findMany).mockResolvedValue([row()] as never);
    vi.mocked(prisma.auditLog.count).mockResolvedValue(57);

    const result = await listAuditLogs({}, 1);

    expect(result.logs).toHaveLength(1);
    expect(result.total).toBe(57);
    expect(result.totalPages).toBe(Math.ceil(57 / AUDIT_LOG_PAGE_SIZE));
  });
});

describe("listAuditLogs — filtering", () => {
  test("passes action/entityType/actorEmail through to the where clause", async () => {
    vi.mocked(prisma.auditLog.findMany).mockResolvedValue([]);
    vi.mocked(prisma.auditLog.count).mockResolvedValue(0);

    await listAuditLogs({ action: "DOCUMENT_REJECTED", entityType: "DOCUMENT", actorEmail: "admin" }, 1);

    const call = vi.mocked(prisma.auditLog.findMany).mock.calls[0][0];
    expect(call?.where).toEqual({
      action: "DOCUMENT_REJECTED",
      entityType: "DOCUMENT",
      actorEmail: { contains: "admin", mode: "insensitive" },
    });
  });

  test("an empty filter produces an empty where clause — no accidental over-filtering", async () => {
    vi.mocked(prisma.auditLog.findMany).mockResolvedValue([]);
    vi.mocked(prisma.auditLog.count).mockResolvedValue(0);

    await listAuditLogs({}, 1);

    const call = vi.mocked(prisma.auditLog.findMany).mock.calls[0][0];
    expect(call?.where).toEqual({});
  });
});

describe("listAuditLogs — entity linking (no N+1)", () => {
  test("a DOCUMENT-typed row whose Document still exists gets linkedDocumentExists: true, via one batched query", async () => {
    vi.mocked(prisma.auditLog.findMany).mockResolvedValue([row({ entityId: "doc_1" })] as never);
    vi.mocked(prisma.auditLog.count).mockResolvedValue(1);
    vi.mocked(prisma.document.findMany).mockResolvedValue([{ id: "doc_1" }] as never);

    const result = await listAuditLogs({}, 1);

    expect(result.logs[0].linkedDocumentId).toBe("doc_1");
    expect(result.logs[0].linkedDocumentExists).toBe(true);
    expect(prisma.document.findMany).toHaveBeenCalledTimes(1);
  });

  test("a DOCUMENT_DELETED row's document no longer exists — linkedDocumentExists: false, never a broken mandatory link", async () => {
    vi.mocked(prisma.auditLog.findMany).mockResolvedValue([
      row({ action: "DOCUMENT_DELETED", entityId: "doc_gone", metadata: { documentTitle: "Deleted Doc" } }),
    ] as never);
    vi.mocked(prisma.auditLog.count).mockResolvedValue(1);
    vi.mocked(prisma.document.findMany).mockResolvedValue([]);

    const result = await listAuditLogs({}, 1);

    expect(result.logs[0].linkedDocumentId).toBe("doc_gone");
    expect(result.logs[0].linkedDocumentExists).toBe(false);
  });

  test("a COMMENT row's linked Document id comes from metadata.documentId, not entityId", async () => {
    vi.mocked(prisma.auditLog.findMany).mockResolvedValue([
      row({ action: "COMMENT_CREATED", entityType: "COMMENT", entityId: "comment_1", metadata: { documentId: "doc_9" } }),
    ] as never);
    vi.mocked(prisma.auditLog.count).mockResolvedValue(1);
    vi.mocked(prisma.document.findMany).mockResolvedValue([{ id: "doc_9" }] as never);

    const result = await listAuditLogs({}, 1);

    expect(result.logs[0].linkedDocumentId).toBe("doc_9");
    expect(result.logs[0].linkedDocumentExists).toBe(true);
    expect(vi.mocked(prisma.document.findMany).mock.calls[0][0]).toEqual(
      expect.objectContaining({ where: { id: { in: ["doc_9"] } } })
    );
  });

  test("a USER-typed row (no Document involved) has linkedDocumentId null and skips the existence query entirely", async () => {
    vi.mocked(prisma.auditLog.findMany).mockResolvedValue([
      row({ action: "PASSWORD_CHANGED", entityType: "USER", entityId: "user_1", metadata: { sessionsInvalidated: true } }),
    ] as never);
    vi.mocked(prisma.auditLog.count).mockResolvedValue(1);

    const result = await listAuditLogs({}, 1);

    expect(result.logs[0].linkedDocumentId).toBeNull();
    expect(result.logs[0].linkedDocumentExists).toBe(false);
    expect(prisma.document.findMany).not.toHaveBeenCalled();
  });
});

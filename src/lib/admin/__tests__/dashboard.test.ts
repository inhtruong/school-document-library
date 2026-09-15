import { beforeEach, describe, expect, test, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    document: {
      groupBy: vi.fn(),
      findMany: vi.fn(),
    },
    user: {
      groupBy: vi.fn(),
    },
    documentReport: {
      count: vi.fn(),
    },
    auditLog: {
      findMany: vi.fn(),
    },
  },
}));

import { prisma } from "@/lib/prisma";
import { getAdminDashboardData } from "@/lib/admin/dashboard";

const FIXED_NOW = new Date("2026-03-05T14:30:00.000Z");
const OLDER = new Date("2026-03-04T10:00:00.000Z");

function setup(overrides?: {
  moderationGroups?: unknown[];
  fileTypeGroups?: unknown[];
  roleGroups?: unknown[];
  openReportCount?: number;
  pendingRows?: unknown[];
  activityRows?: unknown[];
}) {
  vi.mocked(prisma.document.groupBy).mockImplementation(((args: { by: string | string[] }) => {
    const groupField = Array.isArray(args.by) ? args.by[0] : args.by;
    if (groupField === "moderationStatus") {
      return Promise.resolve(
        overrides?.moderationGroups ?? [
          { moderationStatus: "APPROVED", _count: 10 },
          { moderationStatus: "PENDING", _count: 3 },
          { moderationStatus: "REJECTED", _count: 1 },
        ]
      ) as never;
    }
    return Promise.resolve(
      overrides?.fileTypeGroups ?? [
        { fileCategory: "PDF", _count: 8 },
        { fileCategory: null, _count: 2 },
      ]
    ) as never;
  }) as never);
  vi.mocked(prisma.user.groupBy).mockResolvedValue(
    (overrides?.roleGroups ?? [
      { role: "STUDENT", _count: 20 },
      { role: "TEACHER", _count: 5 },
      { role: "ADMIN", _count: 1 },
    ]) as never
  );
  vi.mocked(prisma.documentReport.count).mockResolvedValue((overrides?.openReportCount ?? 4) as never);
  vi.mocked(prisma.document.findMany).mockResolvedValue(
    (overrides?.pendingRows ?? [
      {
        id: "doc_new",
        title: "Newest Pending",
        createdAt: FIXED_NOW,
        uploadedBy: { name: "Tara Teacher" },
        grade: { name: "Grade 11" },
        subjectRef: { name: "Mathematics" },
        lesson: { name: "Derivatives" },
      },
      {
        id: "doc_old",
        title: "Older Pending",
        createdAt: OLDER,
        uploadedBy: null,
        grade: null,
        subjectRef: null,
        lesson: null,
      },
    ]) as never
  );
  vi.mocked(prisma.auditLog.findMany).mockResolvedValue(
    (overrides?.activityRows ?? [
      { id: "log_new", action: "DOCUMENT_APPROVED", actorEmail: "admin@example.com", entityType: "DOCUMENT", createdAt: FIXED_NOW },
      { id: "log_old", action: "USER_LOGGED_IN", actorEmail: null, entityType: null, createdAt: OLDER },
    ]) as never
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("getAdminDashboardData — document counts", () => {
  test("sums moderation-status buckets into a total", async () => {
    setup();
    const data = await getAdminDashboardData();
    expect(data.documents.approved).toBe(10);
    expect(data.documents.pending).toBe(3);
    expect(data.documents.rejected).toBe(1);
    expect(data.documents.total).toBe(14);
  });

  test("defaults a missing moderation-status bucket to zero rather than omitting it", async () => {
    setup({ moderationGroups: [{ moderationStatus: "APPROVED", _count: 5 }] });
    const data = await getAdminDashboardData();
    expect(data.documents.approved).toBe(5);
    expect(data.documents.pending).toBe(0);
    expect(data.documents.rejected).toBe(0);
    expect(data.documents.total).toBe(5);
  });
});

describe("getAdminDashboardData — file-type breakdown", () => {
  test("maps a null fileCategory bucket to the youtube count, not a crash", async () => {
    setup();
    const data = await getAdminDashboardData();
    expect(data.documents.byFileType.PDF).toBe(8);
    expect(data.documents.byFileType.youtube).toBe(2);
    expect(data.documents.byFileType.WORD).toBe(0);
    expect(data.documents.byFileType.EXCEL).toBe(0);
    expect(data.documents.byFileType.IMAGE).toBe(0);
    expect(data.documents.byFileType.VIDEO).toBe(0);
    expect(data.documents.byFileType.POWERPOINT).toBe(0);
  });
});

describe("getAdminDashboardData — user role counts", () => {
  test("sums role buckets into a total and defaults missing roles to zero", async () => {
    setup({ roleGroups: [{ role: "STUDENT", _count: 7 }] });
    const data = await getAdminDashboardData();
    expect(data.users.students).toBe(7);
    expect(data.users.teachers).toBe(0);
    expect(data.users.admins).toBe(0);
    expect(data.users.total).toBe(7);
  });
});

describe("getAdminDashboardData — open report count", () => {
  test("passes through the OPEN-status count query result", async () => {
    setup({ openReportCount: 12 });
    const data = await getAdminDashboardData();
    expect(data.openReportCount).toBe(12);
    expect(prisma.documentReport.count).toHaveBeenCalledWith({ where: { status: "OPEN" } });
  });
});

describe("getAdminDashboardData — recent pending documents", () => {
  test("is capped at 5 and ordered newest-first by the query itself", async () => {
    setup();
    await getAdminDashboardData();
    expect(prisma.document.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { moderationStatus: "PENDING" },
        orderBy: { createdAt: "desc" },
        take: 5,
      })
    );
  });

  test("builds a taxonomy summary from grade/subject/lesson, and null when none apply", async () => {
    setup();
    const data = await getAdminDashboardData();
    expect(data.pendingAttention[0].taxonomySummary).toBe("Grade 11 · Mathematics · Derivatives");
    expect(data.pendingAttention[1].taxonomySummary).toBeNull();
    expect(data.pendingAttention[1].uploaderName).toBeNull();
  });

  test("serializes createdAt to an ISO string, not a Date instance", async () => {
    setup();
    const data = await getAdminDashboardData();
    expect(data.pendingAttention[0].createdAt).toBe(FIXED_NOW.toISOString());
  });
});

describe("getAdminDashboardData — recent activity", () => {
  test("is capped at 10 and ordered newest-first by the query itself", async () => {
    setup();
    await getAdminDashboardData();
    expect(prisma.auditLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ orderBy: { createdAt: "desc" }, take: 10 })
    );
  });

  test("passes through action/actor/entity fields and serializes the timestamp", async () => {
    setup();
    const data = await getAdminDashboardData();
    expect(data.recentActivity[0]).toEqual({
      id: "log_new",
      action: "DOCUMENT_APPROVED",
      actorEmail: "admin@example.com",
      entityType: "DOCUMENT",
      createdAt: FIXED_NOW.toISOString(),
    });
  });
});

describe("getAdminDashboardData — empty states", () => {
  test("returns empty arrays and zero counts rather than throwing when nothing exists", async () => {
    setup({
      moderationGroups: [],
      fileTypeGroups: [],
      roleGroups: [],
      openReportCount: 0,
      pendingRows: [],
      activityRows: [],
    });
    const data = await getAdminDashboardData();
    expect(data.documents.total).toBe(0);
    expect(data.users.total).toBe(0);
    expect(data.openReportCount).toBe(0);
    expect(data.pendingAttention).toEqual([]);
    expect(data.recentActivity).toEqual([]);
  });
});

describe("getAdminDashboardData — query efficiency", () => {
  test("runs exactly six Prisma calls total, all in parallel (no N+1)", async () => {
    setup();
    await getAdminDashboardData();
    expect(prisma.document.groupBy).toHaveBeenCalledTimes(2);
    expect(prisma.user.groupBy).toHaveBeenCalledTimes(1);
    expect(prisma.documentReport.count).toHaveBeenCalledTimes(1);
    expect(prisma.document.findMany).toHaveBeenCalledTimes(1);
    expect(prisma.auditLog.findMany).toHaveBeenCalledTimes(1);
  });
});

import { apiError, apiSuccess } from "@/lib/api-response";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const grouped = await prisma.document.groupBy({
      by: ["subject"],
      _count: { _all: true },
      orderBy: { subject: "asc" },
    });

    const subjects = grouped.map((group) => ({
      subject: group.subject,
      count: group._count._all,
    }));

    return apiSuccess(subjects);
  } catch (error) {
    console.error("GET /api/subjects failed", error);
    return apiError("Failed to load subjects", 500);
  }
}

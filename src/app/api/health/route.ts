import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * Production health check (Step 13A) — meant for VPS monitoring and
 * deploy-verification, not the app's own `{ success, data, error }`
 * envelope (a simple flat shape is what infra tooling expects). Verifies
 * the process is up and PostgreSQL is reachable via a trivial query. Never
 * includes DATABASE_URL, filesystem paths, secrets, or stack traces — on
 * failure the database check result is just "error", logged in full only
 * server-side.
 */
export async function GET() {
  const checks: { database: "ok" | "error" } = { database: "ok" };

  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch (error) {
    console.error("GET /api/health — database check failed", error);
    checks.database = "error";
  }

  const healthy = Object.values(checks).every((status) => status === "ok");

  return NextResponse.json({ status: healthy ? "ok" : "error", checks }, { status: healthy ? 200 : 503 });
}

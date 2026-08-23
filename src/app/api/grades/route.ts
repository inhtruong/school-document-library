import { apiError, apiSuccess } from "@/lib/api-response";
import { listGrades } from "@/lib/documents/grades";

/** Public read API — powers the Grade dropdown on /upload. Grades are seed/static data, not user-editable in this step. */
export async function GET() {
  try {
    const grades = await listGrades();
    return apiSuccess(grades);
  } catch (error) {
    console.error("GET /api/grades failed", error);
    return apiError("Failed to load grades", 500);
  }
}

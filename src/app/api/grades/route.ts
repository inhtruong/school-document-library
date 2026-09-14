import { apiErrorCode, apiSuccess } from "@/lib/api-response";
import { listGrades } from "@/lib/documents/grades";

/** Public read API — powers the Grade dropdown on /upload. Grades are seed/static data, not user-editable in this step. */
export async function GET() {
  try {
    const grades = await listGrades();
    return apiSuccess(grades);
  } catch (error) {
    console.error("GET /api/grades failed", error);
    return apiErrorCode("FAILED_LOAD_GRADES", 500);
  }
}

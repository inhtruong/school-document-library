import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Card } from "@/components/ui/card";
import type { GradeWithDocumentCount } from "@/lib/documents/grades";

/** Homepage "browse by grade" card — links via real gradeId, never a hardcoded id. */
export default async function GradeCard({ grade }: { grade: GradeWithDocumentCount }) {
  const tCommon = await getTranslations("common");

  return (
    <Link
      href={`/search?gradeId=${encodeURIComponent(grade.id)}`}
      className="block rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-accent"
    >
      <Card className="flex flex-col items-center gap-1 px-3 py-4 text-center transition-all hover:-translate-y-px hover:border-ink/20 hover:shadow-[0_4px_12px_rgba(28,25,23,0.06)]">
        <span className="font-display text-sm font-semibold text-ink sm:text-base">{grade.name}</span>
        <span className="text-xs text-muted">{tCommon("documentCount", { count: grade.documentCount })}</span>
      </Card>
    </Link>
  );
}

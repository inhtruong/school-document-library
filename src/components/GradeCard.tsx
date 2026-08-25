import Link from "next/link";
import { Card } from "@/components/ui/card";
import type { GradeWithDocumentCount } from "@/lib/documents/grades";

/** Homepage "browse by grade" card — links via real gradeId, never a hardcoded id. */
export default function GradeCard({ grade }: { grade: GradeWithDocumentCount }) {
  return (
    <Link
      href={`/search?gradeId=${encodeURIComponent(grade.id)}`}
      className="block rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-accent"
    >
      <Card className="flex flex-col items-center gap-1 px-3 py-4 text-center transition-all hover:-translate-y-px hover:border-ink/20 hover:shadow-[0_4px_12px_rgba(18,22,31,0.06)]">
        <span className="font-display text-sm font-semibold text-ink sm:text-base">{grade.name}</span>
        <span className="text-xs text-muted">
          {grade.documentCount} {grade.documentCount === 1 ? "document" : "documents"}
        </span>
      </Card>
    </Link>
  );
}

import Link from "next/link";
import { Card } from "@/components/ui/card";
import { subjectAccent } from "@/lib/documents/subject-accent";
import type { SubjectSummary } from "@/types/document";

export default function SubjectCard({ subject }: { subject: SubjectSummary }) {
  return (
    <Link href={`/search?subject=${encodeURIComponent(subject.subject)}`}>
      <Card className="flex items-center gap-3 bg-surface p-4 transition-colors hover:border-ink/25 hover:bg-paper">
        <span
          aria-hidden
          className="h-9 w-1 shrink-0 rounded-full"
          style={{ backgroundColor: subjectAccent(subject.subject) }}
        />
        <span className="min-w-0">
          <span className="block truncate font-display text-sm font-medium sm:text-base">
            {subject.subject}
          </span>
          <span className="block text-sm text-muted">
            {subject.count} {subject.count === 1 ? "document" : "documents"}
          </span>
        </span>
      </Card>
    </Link>
  );
}

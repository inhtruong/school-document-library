import Link from "next/link";
import { BookOpen, FlaskConical, Globe, Landmark, Languages, Music, Palette, Sigma } from "lucide-react";
import { Card } from "@/components/ui/card";
import { subjectAccent, subjectIconName, type SubjectIconName } from "@/lib/documents/subject-accent";
import type { SubjectSummary } from "@/types/document";

// Named imports only (tree-shaken) — mapped from the deterministic string
// name subjectIconName() returns, rather than importing the whole
// lucide-react icon set.
const SUBJECT_ICONS: Record<SubjectIconName, typeof Sigma> = {
  Sigma,
  BookOpen,
  FlaskConical,
  Globe,
  Landmark,
  Palette,
  Music,
  Languages,
};

export default function SubjectCard({ subject }: { subject: SubjectSummary }) {
  const accent = subjectAccent(subject.subject);
  const Icon = SUBJECT_ICONS[subjectIconName(subject.subject)];

  return (
    <Link
      href={`/search?subject=${encodeURIComponent(subject.subject)}`}
      className="block rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-accent"
    >
      <Card className="flex items-center gap-3 p-4 transition-all hover:-translate-y-px hover:border-ink/20 hover:shadow-[0_4px_12px_rgba(18,22,31,0.06)]">
        <span
          aria-hidden
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg"
          style={{ backgroundColor: `${accent}1a`, color: accent }}
        >
          <Icon className="h-5 w-5" aria-hidden />
        </span>
        <span className="min-w-0">
          <span className="block truncate font-display text-sm font-medium text-ink sm:text-base">
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

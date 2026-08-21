import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { subjectAccent } from "@/lib/subjects";
import type { DocumentRecord } from "@/lib/types";

export default function DocumentCard({ doc }: { doc: DocumentRecord }) {
  return (
    <Link href={`/documents/${doc.id}`} className="block">
      <Card className="flex gap-4 p-4 transition-colors hover:border-ink/25 sm:p-5">
        <span
          aria-hidden
          className="w-1 shrink-0 self-stretch rounded-full"
          style={{ backgroundColor: subjectAccent(doc.subject) }}
        />

        <div className="min-w-0 flex-1">
          <h3 className="font-display text-base font-medium leading-snug sm:text-lg">
            {doc.title}
          </h3>

          {doc.description ? (
            <p className="mt-1.5 line-clamp-2 text-sm text-muted">{doc.description}</p>
          ) : null}

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="text-sm text-ink">{doc.subject}</span>
            <Badge>{doc.documentType}</Badge>
            <span className="text-sm text-muted">{doc.academicYear}</span>
          </div>
        </div>
      </Card>
    </Link>
  );
}

import { Badge } from "@/components/ui/badge";
import type { DocumentModerationStatus } from "@prisma/client";

const STATUS_CONFIG: Record<DocumentModerationStatus, { label: string; variant: "warning" | "success" | "destructive" }> = {
  PENDING: { label: "Pending", variant: "warning" },
  APPROVED: { label: "Approved", variant: "success" },
  REJECTED: { label: "Rejected", variant: "destructive" },
};

/** Text label always present — status is never conveyed by color alone. */
export function ModerationStatusBadge({ status }: { status: DocumentModerationStatus }) {
  const config = STATUS_CONFIG[status];
  return <Badge variant={config.variant}>{config.label}</Badge>;
}

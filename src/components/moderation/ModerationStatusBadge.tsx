import { getTranslations } from "next-intl/server";
import { Badge } from "@/components/ui/badge";
import type { DocumentModerationStatus } from "@prisma/client";

const STATUS_VARIANT: Record<DocumentModerationStatus, "warning" | "success" | "destructive"> = {
  PENDING: "warning",
  APPROVED: "success",
  REJECTED: "destructive",
};

const STATUS_MESSAGE_KEY: Record<DocumentModerationStatus, "pending" | "approved" | "rejected"> = {
  PENDING: "pending",
  APPROVED: "approved",
  REJECTED: "rejected",
};

/** Text label always present — status is never conveyed by color alone. */
export async function ModerationStatusBadge({ status }: { status: DocumentModerationStatus }) {
  const t = await getTranslations("moderation.status");
  return <Badge variant={STATUS_VARIANT[status]}>{t(STATUS_MESSAGE_KEY[status])}</Badge>;
}

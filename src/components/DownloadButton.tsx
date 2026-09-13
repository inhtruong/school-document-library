import { getTranslations } from "next-intl/server";
import { Button, buttonVariants } from "@/components/ui/button";
import { resolveDownloadHref } from "@/components/download-href";
import { cn } from "@/lib/utils";

type DownloadButtonProps = {
  documentId: string;
  hasFile: boolean;
  isAuthenticated: boolean;
};

/**
 * Server Component — no client JS needed. Guests get a plain link to
 * `/login?callbackUrl=/documents/{id}` (a normal browser navigation);
 * authenticated users get a plain link straight to the protected download
 * endpoint (the browser handles the `Content-Disposition: attachment`
 * response natively, no fetch/blob juggling required). A document with no
 * file always renders a disabled button regardless of auth state — sending
 * a guest to log in for a document that can't be downloaded anyway would be
 * misleading.
 */
export async function DownloadButton({ documentId, hasFile, isAuthenticated }: DownloadButtonProps) {
  const href = resolveDownloadHref(documentId, hasFile, isAuthenticated);
  const tDocumentActions = await getTranslations("documentActions");

  if (!href) {
    return (
      <Button disabled title={tDocumentActions("noFileAvailable")}>
        {tDocumentActions("download")}
      </Button>
    );
  }

  return (
    <a href={href} className={cn(buttonVariants({ variant: "default" }))}>
      {tDocumentActions("download")}
    </a>
  );
}

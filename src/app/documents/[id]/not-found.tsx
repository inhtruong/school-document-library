import Link from "next/link";
import { getTranslations } from "next-intl/server";

export default async function DocumentNotFound() {
  const [tPreview, tSaved] = await Promise.all([getTranslations("preview"), getTranslations("saved")]);

  return (
    <div className="mx-auto max-w-md px-5 py-24 text-center">
      <h1 className="font-display text-xl font-semibold tracking-tight">{tPreview("documentNotFound")}</h1>
      <p className="mt-3 text-sm text-muted">{tPreview("documentNotFoundDescription")}</p>
      <Link
        href="/search"
        className="mt-6 inline-flex h-10 items-center rounded-xl bg-accent px-4 text-sm font-medium text-paper transition-colors hover:bg-accent-strong"
      >
        {tSaved("browseDocuments")}
      </Link>
    </div>
  );
}

"use client";

import { useTranslations } from "next-intl";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const tErrors = useTranslations("errors");
  const tActions = useTranslations("actions");

  return (
    <div className="mx-auto max-w-md px-5 py-24 text-center">
      <h1 className="font-display text-xl font-semibold tracking-tight">
        {tErrors("title")}
      </h1>
      <p className="mt-3 text-sm text-muted">
        {error.message || tErrors("defaultMessage")}
      </p>
      <button
        type="button"
        onClick={reset}
        className="mt-6 inline-flex h-10 items-center rounded-xl bg-accent px-4 text-sm font-medium text-paper transition-colors hover:bg-accent-strong"
      >
        {tActions("tryAgain")}
      </button>
    </div>
  );
}

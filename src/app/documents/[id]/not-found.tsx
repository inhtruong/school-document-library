import Link from "next/link";

export default function DocumentNotFound() {
  return (
    <div className="mx-auto max-w-md px-5 py-24 text-center">
      <h1 className="font-display text-xl font-semibold tracking-tight">Document not found</h1>
      <p className="mt-3 text-sm text-muted">
        This document doesn&apos;t exist or may have been removed.
      </p>
      <Link
        href="/search"
        className="mt-6 inline-flex h-10 items-center rounded-xl bg-accent px-4 text-sm font-medium text-paper transition-colors hover:bg-accent-strong"
      >
        Browse documents
      </Link>
    </div>
  );
}

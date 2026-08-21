"use client";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="mx-auto max-w-md px-5 py-24 text-center">
      <h1 className="font-display text-xl font-semibold tracking-tight">
        Something went wrong
      </h1>
      <p className="mt-3 text-sm text-muted">
        {error.message || "The document library couldn't be reached. Check that the database is running."}
      </p>
      <button
        type="button"
        onClick={reset}
        className="mt-6 rounded-lg bg-ink px-4 py-2 text-sm font-medium text-paper transition-colors hover:bg-accent"
      >
        Try again
      </button>
    </div>
  );
}

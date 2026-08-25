/**
 * Extracted from the root layout (UI-1) — same reasoning as SiteHeader
 * having its own file. Server Component, no interactivity needed.
 *
 * The previous "Demo build · PostgreSQL backend" line read as an internal
 * prototype signal rather than product copy, so it's no longer part of the
 * production-facing footer. The equivalent info is still useful while
 * developing, so it's kept — gated to development only via a plain
 * `NODE_ENV` check, which Next.js inlines at build time (no runtime cost,
 * no bundle presence in production; this is a presentational change only,
 * nothing about build/deploy config is touched).
 */
export default function SiteFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-line bg-paper">
      <div className="mx-auto flex max-w-5xl flex-col gap-4 px-5 py-10 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <span aria-hidden className="flex h-7 w-7 items-end gap-[3px] rounded-md bg-surface p-[5px]">
            <span className="h-full w-[2.5px] rounded-full bg-accent" />
            <span className="h-2/3 w-[2.5px] rounded-full bg-ink/70" />
            <span className="h-4/5 w-[2.5px] rounded-full bg-ink/30" />
          </span>
          <div className="leading-tight">
            <p className="font-display text-sm font-semibold text-ink">Stacks</p>
            <p className="text-xs text-muted">A document library for students and teachers.</p>
          </div>
        </div>

        <p className="text-xs text-muted">© {year} Stacks</p>
      </div>

      {process.env.NODE_ENV === "development" ? (
        <div className="border-t border-line bg-surface px-5 py-2 text-center font-mono text-[10px] uppercase tracking-[0.18em] text-muted">
          Development build · PostgreSQL backend
        </div>
      ) : null}
    </footer>
  );
}

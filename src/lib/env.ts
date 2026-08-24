import "server-only";

/**
 * Guarded entry point for environment configuration — the `"server-only"`
 * import above means an accidental import from a Client Component fails
 * loudly at build time, rather than silently shipping (or attempting to
 * ship) server config into a browser bundle. Real Next.js app code
 * (Server Components, API routes, other server-only lib modules) should
 * import from here.
 *
 * `next.config.ts` and the CLI scripts under `prisma/` import
 * `env-core.ts` directly (by relative path) instead, since their loading
 * context is incompatible with `server-only` — see the comment at the top
 * of that file for why.
 */
export * from "./env-core";

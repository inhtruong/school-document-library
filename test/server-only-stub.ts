// Stub for the "server-only" package during Vitest runs.
// The real package throws unconditionally outside Next.js's webpack build,
// where it normally relies on bundler-side conditions to enforce the guard.
export {};

// Relative import of env-core (not "@/lib/env", and not the "@/..." alias)
// — next.config.ts imports this file directly, and its lightweight TS
// transpiler doesn't resolve "@/" aliases in files it transitively requires
// (only in next.config.ts's own direct imports), so an aliased import here
// breaks `next build`/`next start`. env-core.ts (unlike env.ts) has no
// "server-only" guard, which next.config.ts's loading context also can't
// tolerate — see env-core.ts.
import { getMaxUploadSizeMB } from "../env-core";

/**
 * Single source of truth for the upload size limit — imported by validation,
 * the upload UI, and tests. Sourced from `MAX_UPLOAD_SIZE_MB` (see
 * `@/lib/env`), defaulting to 10 when unset. Evaluated once when this
 * module first loads (server start), so changing the env var requires a
 * restart to take effect here — and a full `next build` to take effect in
 * `next.config.ts`'s Server Action body-size ceiling, since that one is
 * baked in at build time (see next.config.ts).
 */
export const MAX_UPLOAD_SIZE_MB = getMaxUploadSizeMB();
export const MAX_UPLOAD_SIZE_BYTES = MAX_UPLOAD_SIZE_MB * 1024 * 1024;

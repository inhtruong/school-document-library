import type { NextConfig } from "next";
import { MAX_UPLOAD_SIZE_MB } from "@/lib/documents/upload-config";
// env-core.ts, not "@/lib/env" — the guarded wrapper imports "server-only",
// which this loading context can't tolerate. See env-core.ts's top comment.
import { validateProductionEnv } from "@/lib/env-core";

// Next.js loads this file before anything else, for `next build` and
// `next dev`/`next start` alike — the one reliable place to fail fast on a
// broken production environment instead of a cryptic downstream error.
validateProductionEnv();

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // Next.js defaults Server Action request bodies to 1 MB, which would
      // reject uploads with a raw framework error before the app's own
      // MAX_UPLOAD_SIZE_MB check (and its friendly message) ever runs.
      // Add headroom over the app limit for multipart/form-data overhead.
      bodySizeLimit: `${MAX_UPLOAD_SIZE_MB + 2}mb`,
    },
  },
};

export default nextConfig;

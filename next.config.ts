import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";
import { UPLOAD_BODY_SIZE_LIMIT } from "@/lib/documents/upload-config";
// env-core.ts, not "@/lib/env" — the guarded wrapper imports "server-only",
// which this loading context can't tolerate. See env-core.ts's top comment.
import { validateProductionEnv } from "@/lib/env-core";
// Relative import for the same reason as env-core.ts above — this file is
// transitively loaded by next.config.ts's loading context, which doesn't
// resolve "@/" aliases outside next.config.ts's own direct imports.
import { STATIC_SECURITY_HEADERS } from "./src/lib/security/security-headers";

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
      bodySizeLimit: UPLOAD_BODY_SIZE_LIMIT,
    },
    // SEC-B-03-FIX-02: a SEPARATE limit from serverActions.bodySizeLimit
    // above — Next.js 15.5.25 defaults this to 10485760 bytes (10 MiB)
    // regardless of the Server Action limit, because src/middleware.ts
    // matches nearly every route (including the upload request path).
    // Confirmed in the installed package: any request routed through a
    // matched middleware gets its body wrapped in a size-limited clonable
    // stream (see node_modules/next/dist/esm/server/next-server.js's
    // attachRequestMeta → getCloneableBody, and body-streams.js's
    // cloneBodyStream, which silently truncates once bytesRead exceeds
    // this limit) — independent of whatever serverActions.bodySizeLimit
    // allows. Without this, a FILE upload between ~10MiB and
    // MAX_UPLOAD_SIZE_MB got its multipart body cut off before the
    // Server Action ever saw the complete request, surfacing as a raw
    // "Unexpected end of form" parser error instead of either succeeding
    // or the app's own friendly UPLOAD_FILE_TOO_LARGE message. Same
    // shared headroom constant as bodySizeLimit above (see upload-config.ts)
    // — one source of truth derived from MAX_UPLOAD_SIZE_MB, never
    // duplicated/hardcoded here.
    middlewareClientMaxBodySize: UPLOAD_BODY_SIZE_LIMIT,
  },
  // Content-Security-Policy is applied separately in middleware.ts — it
  // needs a fresh per-request nonce, which a static config here can't
  // generate. Everything else that's genuinely static lives here instead.
  async headers() {
    return [{ source: "/:path*", headers: STATIC_SECURITY_HEADERS }];
  },
};

// FEAT-13: wires next-intl's request config (src/i18n/request.ts) into the
// build. Deliberately NOT next-intl's routing plugin/middleware — this app
// uses cookie-based locale resolution with no locale-prefixed URLs, so the
// plugin's only job here is registering the request-config path.
const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

export default withNextIntl(nextConfig);

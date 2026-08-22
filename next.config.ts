import type { NextConfig } from "next";
import { MAX_UPLOAD_SIZE_MB } from "@/lib/documents/upload-config";

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

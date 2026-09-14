import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@test": path.resolve(__dirname, "./test"),
      "server-only": path.resolve(__dirname, "./test/server-only-stub.ts"),
      // Real `next-intl/server` ultimately calls `next/headers`, which only
      // works inside an actual Next.js request lifecycle — never when a
      // route handler is invoked directly, as every route test here does.
      // Stubbed the same way "server-only" already is, reading the real
      // message catalogs so tests still exercise real translated text
      // (I18N-1).
      "next-intl/server": path.resolve(__dirname, "./test/next-intl-server-stub.ts"),
    },
  },
  test: {
    environment: "node",
  },
});

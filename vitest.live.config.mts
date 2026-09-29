import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Opt-in tests that talk to real vendors (never in CI): `pnpm test:live`.
export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      "server-only": fileURLToPath(new URL("./tests/support/server-only.ts", import.meta.url)),
    },
  },
  test: { environment: "node", include: ["tests/live/**/*.test.ts"], testTimeout: 20_000 },
});

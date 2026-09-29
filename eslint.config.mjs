import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

// The privileged (secret-key, RLS-bypassing) Supabase client may only be used by
// internal hooks/webhooks/jobs. See docs/architecture.md §4.7.
const privilegedImportBan = {
  patterns: [
    {
      group: ["@/server/privileged/*", "**/server/privileged/*"],
      message:
        "The privileged Supabase client bypasses RLS. Only src/app/api/internal/** and src/server/jobs/** may import it.",
    },
  ],
};

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/ban-ts-comment": [
        "error",
        { "ts-ignore": "allow-with-description", "ts-expect-error": "allow-with-description" },
      ],
      "no-restricted-imports": ["error", privilegedImportBan],
    },
  },
  {
    files: ["src/app/api/internal/**", "src/server/jobs/**", "src/server/privileged/**"],
    rules: { "no-restricted-imports": "off" },
  },
  globalIgnores([".next/**", "out/**", "build/**", "next-env.d.ts", "src/server/db/types.ts", "supabase/**"]),
]);

export default eslintConfig;

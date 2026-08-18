import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
  // src/lib/data/admin.ts holds deliberately-unscoped cross-user queries —
  // a stray import outside the admin panel would bypass every other
  // route's per-user data isolation. Making that a lint error, not just a
  // review risk, is cheap insurance for the one file in this app that's
  // allowed to read across users.
  {
    files: ["**/*.{ts,tsx}"],
    ignores: ["src/app/admin/**"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["**/lib/data/admin", "**/lib/data/admin.ts", "@/lib/data/admin"],
              message: "src/lib/data/admin.ts is cross-user by design — only import it from src/app/admin/**.",
            },
          ],
        },
      ],
    },
  },
]);

export default eslintConfig;

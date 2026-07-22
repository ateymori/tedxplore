import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import prettierConfig from "eslint-config-prettier";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  prettierConfig,
  // Templates must stay bespoke and self-contained: a template renders itself
  // and nothing else renders through it. Two templates never share components —
  // the moment one imports another, "premium bespoke templates" collapses into
  // "themes of one template" and a tweak to one silently breaks the other. The
  // only shared surface is the contract (`templates/contract.ts`) + the registry.
  //
  // This rule forbids reaching into any specific template's internals. When a
  // second template genuinely needs the *same* behavior with no visual coupling,
  // lift that one piece into `templates/shared/` — never import across siblings.
  {
    files: ["src/templates/**/*.{ts,tsx}"],
    ignores: [
      // The registry is the one place allowed to know which templates exist.
      "src/templates/registry.ts",
      "src/templates/registry.test.ts",
    ],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              // Forbid absolute imports into any specific template's folder.
              // Within a template, self-reference relatively (`./sections/…`);
              // the only shared surfaces are `@/templates/contract`,
              // `@/templates/registry`, and `@/templates/shared/*`.
              group: ["@/templates/*/**", "!@/templates/shared/**"],
              message:
                "Templates are self-contained: import a template's own files relatively, and never import another template's internals. Share only via templates/contract.ts or templates/shared/. See eslint.config.mjs.",
            },
          ],
        },
      ],
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;

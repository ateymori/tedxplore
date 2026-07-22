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
  // Project-wide relaxation of the strict React Compiler-era lint rules
  // (eslint-plugin-react-hooks v7, enabled by default under Next 16). These flag
  // component-code patterns — synchronous setState in effects, ref writes during
  // render, non-pure render, omitted effect deps — that React Bits' vendored
  // components routinely use. So Tedxplore can drop React Bits components/blocks
  // ANYWHERE (app chrome or inside a template) with no folder convention and no
  // per-file friction, these rules are turned off across the whole project.
  //
  // Deliberately NOT turned off: `react-hooks/rules-of-hooks`. A conditional or
  // out-of-order hook call is a runtime crash, not a style choice, and React
  // Bits never trips it — so keeping it costs nothing and removes a real footgun.
  // (Trade-off accepted knowingly: these rules had caught a few genuine bugs in
  // our own code; see the Phase 3/5 notes in CLAUDE.md.)
  {
    rules: {
      "react-hooks/set-state-in-effect": "off",
      "react-hooks/set-state-in-render": "off",
      "react-hooks/no-deriving-state-in-effects": "off",
      "react-hooks/exhaustive-deps": "off",
      "react-hooks/refs": "off",
      "react-hooks/immutability": "off",
      "react-hooks/purity": "off",
      "react-hooks/preserve-manual-memoization": "off",
      "react-hooks/incompatible-library": "off",
      "react-hooks/static-components": "off",
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_", caughtErrors: "none" },
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

// ESLint flat config (ESLint 9). Lints src/ TypeScript + Svelte.
//
// Baseline is intentionally LENIENT: the recommended rule sets are wired up,
// but the rules that currently fire across the codebase are set to "warn", not
// "error", so `npm run lint` exits 0 today while still surfacing the count.
// Tighten individual rules to "error" as the codebase is cleaned up.
//
// Runner split note (see .claude/CLAUDE.md): this is a static linter only; it
// does not run tests. svelte-check + tsc remain the type gates.

import js from "@eslint/js";
import tseslint from "typescript-eslint";
import svelte from "eslint-plugin-svelte";
import globals from "globals";

export default tseslint.config(
  {
    ignores: [
      "dist/**",
      "node_modules/**",
      "**/*.d.ts",
      // generated / vendored
      "inst/**",
    ],
  },

  js.configs.recommended,
  ...tseslint.configs.recommended,
  ...svelte.configs["flat/recommended"],

  {
    // Don't report (or auto-strip) "unused" eslint-disable directives — several
    // guard `no-console` in debug/bench/script files; that rule isn't enabled
    // here, but the directives are intentional and `--fix` would blank them out.
    linterOptions: {
      reportUnusedDisableDirectives: "off",
    },
    languageOptions: {
      globals: { ...globals.browser, ...globals.node },
    },
  },

  // Svelte files parse <script lang="ts"> with the TS parser.
  {
    files: ["**/*.svelte"],
    languageOptions: {
      parserOptions: { parser: tseslint.parser },
    },
  },

  // Lenient baseline — surface, don't block. These are the rules that fire
  // across the existing code; downgraded to "warn" so the gate is green today.
  {
    rules: {
      // TypeScript itself resolves identifiers; core no-undef false-positives on
      // types and ambient globals, so the typescript-eslint guidance is off.
      "no-undef": "off",

      // ── Enforced (error) — bug-catchers currently at zero violations, locked
      //    in so regressions fail the gate.
      "no-cond-assign": "error",
      "no-fallthrough": "error",
      "no-prototype-builtins": "error",
      "no-control-regex": "error",
      "@typescript-eslint/no-unused-expressions": "error",
      "@typescript-eslint/ban-ts-comment": "error",
      "@typescript-eslint/no-empty-object-type": "error",
      "@typescript-eslint/no-non-null-asserted-optional-chain": "error",

      // ── Backlog (warn) — real violations remain; chip down then promote.
      //    Counts at last paydown: prefer-const 129, no-unused-vars 117,
      //    no-unused-svelte-ignore 22, no-useless-escape 3, no-empty 3,
      //    no-explicit-any 2, no-at-html-tags 1.
      "prefer-const": "warn",
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_", caughtErrorsIgnorePattern: "^_" },
      ],
      "no-empty": "warn",
      "no-useless-escape": "warn",
      "svelte/no-at-html-tags": "warn",
      "svelte/no-unused-svelte-ignore": "warn",
    },
  },

  // Test + harness files: relax further (test ergonomics over strictness).
  {
    files: ["**/*.test.ts", "**/*.runes.ts", "**/*.browser.ts", "tests/**", "scripts/**"],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unused-vars": "off",
    },
  },
);

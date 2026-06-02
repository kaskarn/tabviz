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
      "prefer-const": "warn",
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_", caughtErrorsIgnorePattern: "^_" },
      ],
      "@typescript-eslint/no-unused-expressions": "warn",
      "@typescript-eslint/ban-ts-comment": "warn",
      "@typescript-eslint/no-empty-object-type": "warn",
      "@typescript-eslint/no-non-null-asserted-optional-chain": "warn",
      "no-empty": "warn",
      "no-control-regex": "warn",
      "no-useless-escape": "warn",
      "no-cond-assign": "warn",
      "no-fallthrough": "warn",
      "no-prototype-builtins": "warn",
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

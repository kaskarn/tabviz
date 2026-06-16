// ESLint flat config (ESLint 9). Lints src/ TypeScript + Svelte.
//
// Baseline is ZERO-WARNING: every wired rule is "error" and `npm run lint` is a
// HARD CI gate (js-ci.yaml). The 2026-06-12 paydown drove the count to 0 (see
// the inline notes on the rule block below); keep it there. (prefer-const is
// off for *.svelte/*.svelte.ts — the rule misreads the Svelte 5 runes idiom.)
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

      // ── Paid down to ZERO and promoted (2026-06-12; was a 277-warning
      //    backlog). The paydown deleted real dead code: the legacy
      //    plot-resize trio, getLabelWidth/getLabelFlex (D20 item 7),
      //    a vestigial polarity reflection in buildTheme, dead deriveds
      //    and unused component props. New violations now FAIL the
      //    gate (lint runs in js-ci's ts-suite job).
      "prefer-const": "error",
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_", caughtErrorsIgnorePattern: "^_" },
      ],
      "no-empty": "error",
      "no-useless-escape": "error",
      "svelte/no-at-html-tags": "error",
      "svelte/no-unused-svelte-ignore": "error",
    },
  },

  // Svelte 5 runes idiom: `let { x } = $props()` / `let y = $state()` —
  // prefer-const is WRONG here (const props break bindability; const
  // $state can't be reassigned reactively); all 107 hits were this
  // pattern. plugin v3's svelte/prefer-const knows runes — re-enable
  // through it on upgrade. MUST sit after the baseline block (flat
  // config: last match wins).
  {
    files: ["**/*.svelte", "**/*.svelte.ts"],
    rules: { "prefer-const": "off" },
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

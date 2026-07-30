/**
 * Build-time `import.meta.env` defines shared by EVERY production bundle
 * (widget, split, v8, npm). Import and spread into each config's `define`.
 *
 * WHY THIS EXISTS (paid for once — 2026-07-28, the "brand color bricks the
 * widget" bug): the theme system's failure policy is tiered — under dev it
 * THROWS so CI surfaces resolver bugs at the moment of introduction, and in
 * production it logs + degrades so one bad token can't take down the whole
 * render. Both gates (`resolve-theme.ts::isDev`, `theme-css.ts::_isDevBuild`)
 * decide via `import.meta.env.PROD !== true`.
 *
 * Declaring a SUB-KEY of `import.meta.env` in `define` (we set `SSR` to force
 * client mode) makes Vite substitute the whole `import.meta.env` object with
 * one built from the declared keys only — so `PROD` came back `undefined`,
 * `undefined !== true` folded to `true`, and every shipped bundle believed it
 * was a dev build. Both gates minified to a literal `return !0`. The
 * production degrade path was unreachable code in all four bundles, so ANY
 * resolver throw escaped: in the widget it landed mid-Svelte-effect-flush and
 * killed the reactive graph (figure AND settings panel frozen until reload);
 * in V8 it aborted the whole `save_plot`.
 *
 * So: whenever a config declares any `import.meta.env.*` key, it must declare
 * these too. Source-level test runners (vitest/bun import the TS directly and
 * never see these defines) still get `undefined` → dev → throw, which is
 * exactly where the loud behavior belongs.
 *
 * Gates: `src/lib/theme/prod-degrade.test.ts` (source-level — every config
 * spreads these; no module re-derives the flag) and `npm run
 * check:prod-bundles` (asserts the BUILT bundles fold the check to false).
 * The latter is a post-build script, not a unit test, because `npm test` runs
 * BEFORE `npm run build` in CI and `inst/` bundles are committed — a unit
 * test would assert against the stale committed artifact.
 */
export const PROD_ENV_DEFINES = {
  // Force client-side mode (not SSR).
  "import.meta.env.SSR": "false",
  // Restore what the SSR define above displaces — see the note above.
  "import.meta.env.PROD": "true",
  "import.meta.env.DEV": "false",
} as const;

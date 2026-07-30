/**
 * Build-environment detection — the ONE source for "am I a dev build?".
 *
 * The theme system's failure policy is tiered: dev THROWS (CI surfaces the
 * bug at the moment of introduction), production LOGS + DEGRADES (one bad
 * token must not take down a whole render). Several modules ask that
 * question, and they used to each answer it their own way:
 *
 *   - `resolve-theme.ts::isDev`      — `import.meta.env.PROD !== true`
 *   - `theme-css.ts::_isDevBuild`    — a byte-identical private copy
 *   - `theme-adapter.ts` (contrast)  — `typeof process === "undefined" ||
 *                                       process.env?.NODE_ENV !== "production"`
 *
 * Two costs, both already paid. The duplicated pair meant one root cause (a
 * vite `define` that displaced `import.meta.env.PROD` — see
 * `vite.env-defines.ts`) had to be found and fixed twice. And the third
 * spelling was simply WRONG off Node: `process` is undefined in the browser
 * and in V8, so its "skip in production" gate never engaged in either — the
 * contrast validator (a second half-cascade over every role) ran on every
 * theme commit in the shipped widget and on every `buildTheme` in the R-side
 * export, which is precisely the runtime it was written to skip.
 *
 * Vite inlines `import.meta.env.PROD` to a literal at build time. Under
 * bun/vitest/V8-without-defines the optional chain yields `undefined`, which
 * we treat as "not production" so the dev-throw fires in tests — that is
 * where the loud behavior belongs.
 */

/** True under `vite dev`, vitest, bun:test, and any non-PROD bundle. */
export function isDevBuild(): boolean {
  try {
    return (import.meta as { env?: { PROD?: boolean } }).env?.PROD !== true;
  } catch {
    // `import.meta` is a syntax-level construct; some runtimes (older V8
    // embeddings) throw on access rather than returning undefined.
    return true;
  }
}

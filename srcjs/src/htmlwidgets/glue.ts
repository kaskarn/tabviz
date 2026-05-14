// htmlwidgets/glue: the ONLY module in the codebase that touches
// `window.HTMLWidgets`, `window.Shiny`, or `window.__tabviz*`. Every other
// entry/component/store goes through these helpers.
//
// Refactored under spec §2.5-S10 + Phase 0a-PR3; relocated to
// `src/htmlwidgets/glue.ts` in Phase 2-PR1 (spec §3.10).
//
// See docs/dev/source-tagging.md for the envelope contract these helpers
// honor when forwarding to Shiny.

import type { HTMLWidgetsBinding, ShinyEnvelope } from "$types";

// ────────────────────────────────────────────────────────────────────────
// HTMLWidgets registration
// ────────────────────────────────────────────────────────────────────────

/**
 * Register an htmlwidget binding with `window.HTMLWidgets`. No-op outside
 * a browser (V8 / SSR contexts). Used by both single and split widget
 * entries.
 */
export function registerWidget(binding: HTMLWidgetsBinding): void {
  if (typeof window === "undefined") return;
  if (!window.HTMLWidgets) return;
  window.HTMLWidgets.widget(binding);
}

// ────────────────────────────────────────────────────────────────────────
// Shiny — outbound (setInputValue) and inbound (custom message handlers)
// ────────────────────────────────────────────────────────────────────────

/**
 * True iff `window.Shiny` is present. Use this before constructing or
 * scheduling work that would otherwise be wasted in non-Shiny contexts
 * (knitr embeds, V8, plain HTML).
 */
export function hasShiny(): boolean {
  return typeof window !== "undefined" && Boolean(window.Shiny);
}

/**
 * Emit a `ShinyEnvelope<T>` to `Shiny.setInputValue`. Safe to call
 * unconditionally — silently no-ops outside Shiny contexts. The default
 * priority is `"event"`, which matches every existing widget emission.
 */
export function setShinyInput<T>(
  inputName: string,
  envelope: ShinyEnvelope<T>,
  opts: { priority?: string } = { priority: "event" },
): void {
  if (!hasShiny()) return;
  window.Shiny!.setInputValue(inputName, envelope, opts);
}

/**
 * Register a Shiny custom-message handler. No-op outside Shiny contexts.
 * The single widget uses channel `"tabviz-proxy"`; the split widget uses
 * `"tabviz-split-proxy"`.
 */
export function registerCustomMessageHandler(
  channel: string,
  handler: (msg: unknown) => void,
): void {
  if (!hasShiny()) return;
  window.Shiny!.addCustomMessageHandler(channel, handler);
}

// ────────────────────────────────────────────────────────────────────────
// Dev hooks
// ────────────────────────────────────────────────────────────────────────
//
// Used by puppeteer / playwright scripts in srcjs/scripts/ to inspect
// widget state without going through Shiny. Best-effort: production
// builds may strip these in a future minor. Tests should check for
// presence with `typeof` before use.

/**
 * Expose `value` on `window` under `name`. Typed for the known dev hooks
 * (`__tabvizExports`, `__tabvizStoreRegistry`); unknown names rejected at
 * compile time so dev hooks remain a closed set documented in $types.
 */
export function exposeDevHook<K extends "__tabvizExports" | "__tabvizStoreRegistry">(
  name: K,
  value: NonNullable<Window[K]>,
): void {
  if (typeof window === "undefined") return;
  // K is a literal union, so this assignment is safe by construction.
  // The `unknown` cast is needed because TS can't prove that the
  // intersection-narrowed value satisfies the index signature exactly.
  (window as Window & Record<K, NonNullable<Window[K]>>)[name] = value as unknown as (Window & Record<K, NonNullable<Window[K]>>)[K];
}

/**
 * Unified text-width measurement.
 *
 * The widget needs to measure text widths in three runtime contexts that
 * historically used three different code paths:
 *
 *   1. Browser interactive  — per-cell `ctx.measureText()` calls in
 *      `columns.svelte.ts:doMeasurement`.
 *   2. Browser util         — `width-utils.ts:measureTextWidthCanvas`
 *      (creates a new canvas per call).
 *   3. V8 SVG export        — `width-utils.ts:estimateTextWidth`
 *      character-class arithmetic (no DOM).
 *
 * This module unifies them behind a single API. The lookup is source-agnostic:
 * once a font's character widths are registered (from bundled tables, browser
 * Canvas warm-up, or R systemfonts injection), every call returns the
 * registered value. Unknown fonts transparently fall back to the
 * character-class estimator in `width-utils.ts` — no caller-side branching.
 *
 * Widths are stored in **em units** (proportion of `fontSize`), normalized
 * at registration time, multiplied by the requested size at lookup. One
 * cache entry per (family, weight, italic); size lives at lookup time.
 *
 * The registry is module-level and persists across renders; entries are not
 * evicted because the set of fonts in active use is small and stable.
 */

import { estimateTextWidth } from "./width-utils";

// ─────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────

/**
 * Identity of a font *style* (not a font instance). Size is intentionally
 * absent — widths in em units scale linearly, so one entry serves all sizes.
 */
export interface FontKey {
  /** CSS font-family stack, exactly as it appears in the resolved theme. */
  family: string;
  /** Numeric weight (400, 500, 600, 700). */
  weight: number;
  /** Italic vs. roman. Defaults to false. */
  italic?: boolean;
}

/**
 * Per-character width data for one font style. Widths are em-normalized:
 * the raw measured pixel width divided by the measurement font size.
 * Multiply by the lookup-time `fontSize` to get a pixel width.
 */
export interface FontMetrics {
  charWidths: Map<string, number>;
  /** Width to use for any character not in `charWidths`. Em units. */
  fallbackCharWidth: number;
}

// ─────────────────────────────────────────────────────────────────────────
// Registry
// ─────────────────────────────────────────────────────────────────────────

const _registry: Map<string, FontMetrics> = new Map();

function fontKeyString(font: FontKey): string {
  return `${font.family}|${font.weight}|${font.italic ? "i" : "r"}`;
}

/**
 * Register per-character widths for a font style. Sources include bundled
 * tables (Phase 2.4), browser Canvas warm-up (Phase 2.3), and R-side
 * `systemfonts` injection at V8 startup (Phase 2.5). Calling this overwrites
 * any prior entry for the same key — useful when a more-accurate source
 * (e.g. Canvas after font-load) replaces a coarser one (estimator default).
 */
export function registerFontMetrics(font: FontKey, metrics: FontMetrics): void {
  _registry.set(fontKeyString(font), metrics);
}

/** Returns true iff a metrics table is registered for this font style. */
export function hasFontMetrics(font: FontKey): boolean {
  return _registry.has(fontKeyString(font));
}

/** Diagnostic: list keys currently registered. */
export function listRegisteredFonts(): string[] {
  return Array.from(_registry.keys());
}

/** Test/dev helper: clear all registered metrics. Not for production. */
export function _resetFontMetricsRegistry(): void {
  _registry.clear();
}

// ─────────────────────────────────────────────────────────────────────────
// Measurement
// ─────────────────────────────────────────────────────────────────────────

/**
 * Width of a single character in pixels at the given font size.
 *
 * If a metrics table is registered for the font style, returns the lookup
 * value (in em units) multiplied by `fontSize`. Otherwise falls back to the
 * character-class estimator in `width-utils.ts`. The fallback path matches
 * the historical V8 / SVG-export behavior exactly.
 */
export function getCharWidth(char: string, font: FontKey, fontSize: number): number {
  const m = _registry.get(fontKeyString(font));
  if (m) {
    const em = m.charWidths.get(char) ?? m.fallbackCharWidth;
    return em * fontSize;
  }
  // No registered metrics — fall through to the legacy estimator. Note that
  // `estimateTextWidth` handles a single character correctly (loops over it).
  return estimateTextWidth(char, fontSize, font.weight);
}

/**
 * Width of a full string in pixels at the given font size.
 *
 * When a metrics table is registered, this iterates characters and sums their
 * widths arithmetically — no DOM, no Canvas. When unregistered, falls back
 * to `estimateTextWidth` which is the historical V8 / SVG path.
 *
 * Callers in performance-sensitive loops (e.g. `measureAutoColumns`) should
 * prefer this over creating a Canvas per cell.
 */
export function measureString(text: string, font: FontKey, fontSize: number): number {
  if (!text) return 0;
  const m = _registry.get(fontKeyString(font));
  if (m) {
    let total = 0;
    for (const c of text) {
      total += (m.charWidths.get(c) ?? m.fallbackCharWidth) * fontSize;
    }
    return total;
  }
  // Unknown font — single estimator call avoids the per-char registry probe.
  return estimateTextWidth(text, fontSize, font.weight);
}

// ─────────────────────────────────────────────────────────────────────────
// Browser-side warm-up
// ─────────────────────────────────────────────────────────────────────────

/**
 * Standard character set to measure when warming a font from Canvas. Covers
 * ASCII letters, digits, common punctuation, and the math/typographic glyphs
 * the formatters can emit (×, −, …, ⁰–⁹ superscripts).
 *
 * Other characters fall back to `fallbackCharWidth` (set to the average of
 * the warm set), which the estimator already shows to be acceptable for
 * column-width approximation.
 */
const WARM_CHARSET =
  // Lowercase
  "abcdefghijklmnopqrstuvwxyz" +
  // Uppercase
  "ABCDEFGHIJKLMNOPQRSTUVWXYZ" +
  // Digits
  "0123456789" +
  // Common punctuation and whitespace
  " .,;:!?'\"`()[]{}<>-_+=*/\\|@#$%^&~" +
  // Math/typographic glyphs the formatters emit
  "×−–—… ";

/**
 * Build a `FontMetrics` table by measuring `WARM_CHARSET` against a Canvas
 * context. Returns null when no Canvas is available (V8 environment).
 *
 * The caller should typically register the result with `registerFontMetrics`.
 * This function does NOT register automatically so test harnesses can
 * inspect output before installing it.
 *
 * `measureFontSizePx` controls the size used for the underlying Canvas
 * measurement; 100 gives sub-pixel precision when dividing back to em
 * units. Pure precision optimization — the returned em values are
 * size-independent.
 */
export function measureFontMetricsFromCanvas(
  font: FontKey,
  measureFontSizePx = 100
): FontMetrics | null {
  if (typeof document === "undefined") return null;
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  const italicPrefix = font.italic ? "italic " : "";
  ctx.font = `${italicPrefix}${font.weight} ${measureFontSizePx}px ${font.family}`;

  const charWidths = new Map<string, number>();
  let sum = 0;
  let count = 0;
  for (const c of WARM_CHARSET) {
    const em = ctx.measureText(c).width / measureFontSizePx;
    charWidths.set(c, em);
    sum += em;
    count += 1;
  }
  const fallbackCharWidth = count > 0 ? sum / count : 0.55;
  return { charWidths, fallbackCharWidth };
}

/**
 * Lazy Canvas warm-up: when the requested font has loaded, measure it and
 * register the result. Idempotent — subsequent calls are no-ops if the font
 * is already registered (call `_resetFontMetricsRegistry` to force).
 *
 * Returns a promise that resolves once the measurement is registered (or
 * immediately if no Canvas is available — V8 path).
 */
export async function warmFontFromCanvas(font: FontKey): Promise<void> {
  if (typeof document === "undefined" || !document.fonts) return;
  if (hasFontMetrics(font)) return;

  const italicPrefix = font.italic ? "italic " : "";
  const probe = `${italicPrefix}${font.weight} 16px ${font.family}`;
  try {
    await document.fonts.load(probe);
  } catch {
    // `document.fonts.load` throws on malformed font specifiers; just
    // continue with whatever's loaded (system fallback) and measure that.
  }
  const metrics = measureFontMetricsFromCanvas(font);
  if (metrics) registerFontMetrics(font, metrics);
}

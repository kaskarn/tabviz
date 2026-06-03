/**
 * SVG-CSS extractor.
 *
 * Strips browser-only CSS blocks from theme-runtime.css for embedding into
 * exported SVG documents. The browser-only blocks are bracketed by
 * `/* sv-omit-begin *​/` and `/* sv-omit-end *​/` comment markers (the
 * convention settled by Q-P3.3 closure, Stage 1 §17c).
 *
 * The blocks omitted typically contain rules that can't be rendered in
 * the SVG output: pseudo-classes (:hover, :focus-visible), transitions,
 * animations, backdrop-filter, etc. librsvg ignores them or renders
 * incorrectly, so stripping them at build/export time produces a clean
 * SVG-safe CSS subset.
 *
 * Implementation: a single regex sweep. No AST parsing; no PostCSS
 * dependency. Mechanically simple per Stage 1 §18d.
 *
 * Used by:
 *   - srcjs/src/export/svg-generator.ts (consumes the extracted CSS and
 *     embeds it as a `<style>` block in the SVG root).
 */

/**
 * Strip `/* sv-omit-begin *​/` ... `/* sv-omit-end *​/` blocks from the
 * input CSS string. Matched blocks are removed entirely (including the
 * marker comments themselves and any whitespace between them).
 *
 * Multiple blocks are supported in a single source; unmatched markers
 * (an open without a close, or vice versa) pass through unchanged — the
 * regex requires both ends to strip.
 *
 * @param source - raw CSS file contents.
 * @returns the source with all sv-omit blocks removed.
 */
export function extractSvgCss(source: string): string {
  // Match `/* sv-omit-begin */` through `/* sv-omit-end */` with non-greedy
  // body. The `[\s\S]` (any character including newline) avoids needing the
  // `s` (dotall) regex flag for cross-platform Node/bun compatibility.
  return source.replace(
    /\/\*\s*sv-omit-begin\s*\*\/[\s\S]*?\/\*\s*sv-omit-end\s*\*\//g,
    "",
  );
}

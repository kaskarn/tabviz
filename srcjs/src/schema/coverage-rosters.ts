// Capability rosters — ONE declaration per coverage concern, consumed by
// every gate that needs it (2026-06-11, harness-principles arc).
//
// The boot-split bug class taught the rule: capability coverage must be
// DERIVABLE from a single registry, never re-asserted per harness. A
// column type's posture toward each runtime concern is declared here
// once; boot-coverage.test.ts (V8 boot) and render-coverage.runes.ts
// (full dual-target sweep) both read these rosters, so a new type that
// fails to declare its posture fails BOTH gates with the same vocabulary.
//
// Adding a type to a roster is a DECISION with user-visible meaning —
// each roster documents what membership claims. Don't add entries to
// silence a gate; check what the DOM actually does first.

/** Types whose SVG export IS plain formatted text by design — the
 *  dispatch's text fallback is their correct export renderer. Membership
 *  claims: "headless export showing only text for this type is WYSIWYG,
 *  not degradation." */
export const SVG_TEXT_IS_CORRECT = new Set([
  "text", "numeric", "n", "currency", "percent", "date",
  "interval",   // text-composition renderer chain
  "events",     // composed text (n / N (%))
  "label",      // the label column is text
  "custom",     // user-registered: their responsibility, both targets
]);

/** Forest/viz columns draw through the dedicated plot-overlay path in
 *  BOTH targets (svg-generator's viz sections; the DOM's
 *  <svg class="plot-overlay"> layers). Their grid CELLS are intentionally
 *  empty — no per-cell renderer exists or should, in either target. */
export const OVERLAY_RENDERED = new Set([
  "viz_forest", "viz_bar", "viz_boxplot", "viz_violin",
]);

/** Types whose DOM cell content NEVER exceeds one text line-height —
 *  exempt from the "declare a naturalHeight behavior" rule. Membership
 *  claims: "this cell cannot grow a row beyond the text baseline" (the
 *  nejm-pill lesson: decorations must neutralize their own box, e.g.
 *  margin-block canceling padding, to stay on this roster). */
export const SINGLE_LINE_HEIGHT = new Set([
  "text", "numeric", "n", "currency", "percent", "date", "label",
  "interval", "events", "reference", "range", "custom",
  "pvalue",     // stars/pill neutralize their boxes (CellPvalue CSS)
  "badge",      // inline pill, line-box bound
  "bar",        // fixed BAR.HEIGHT < line-height, vertically centered
  "heatmap",    // inset rect fills the row; never grows it
  "progress",   // same shape class as bar
]);

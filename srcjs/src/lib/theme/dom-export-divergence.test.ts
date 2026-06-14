// DOM↔EXPORT DIVERGENCE LEDGER GATE (hunt #3, 2026-06-13).
//
// A component token consumed ONLY by the DOM renderer
// (`consumedBy === ["svelte/TabvizPlot.svelte"]`) is a WYSIWYG-divergence
// CANDIDATE: the live widget paints something the SVG export may not. The
// Bug-B class (boxed verticals, the first-col divider) all lived exactly
// here. This gate turns that class from reactive to RATCHETED: every
// DOM-only token must carry a justification in the ledger below, and the
// ledger can only SHRINK — wire a token into the export and it must leave
// the ledger. A NEW unjustified DOM-only token fails the gate, forcing the
// author to decide: draw it in the export too, or document WHY it's
// DOM-only.
//
// Three justification categories:
//   browser-only — no static equivalent (interactive state / CSS-only effect)
//   parallel     — the export reaches the SAME visual via a different source
//                  (resolveBorders / activeHeaderVariant / a direct var), so
//                  they agree by construction; the token is just not the
//                  export's input.
//   PENDING      — a genuine export GAP; the export does not draw this yet.
//                  Each names the hunt item tracking the fix.

import { test, expect } from "bun:test";
import { COMPONENT_TOKENS } from "./component-tokens";

const DOM_ONLY = "svelte/TabvizPlot.svelte";

const DOM_ONLY_LEDGER: Record<string, string> = {
  // ── browser-only ──────────────────────────────────────────────────────
  "--tv-row-hover-bg": "browser-only: pointer-hover state; the export is static.",
  "--tv-row-selected-bg": "browser-only: selection state; the export is static.",
  "--tv-shadow-emphasis": "browser-only: box-shadow emphasis (glow); declared browser-only.",
  "--tv-text-numeric-figures": "browser-only: font-feature-settings (CSS); export numerals come from the font.",
  // ── parallel (agree by construction) ─────────────────────────────────
  "--tv-border-table-color": "parallel: export draws the frame from resolveBorders(...).table.color.",
  "--tv-table-border-width": "parallel: export uses resolveBorders(...).table.thickness.",
  "--tv-table-border-style": "parallel: export derives the table style from resolveBorders.",
  "--tv-border-col-style": "parallel: export gates internal verticals on resolveBorders(...).layout (grid).",
  "--tv-container-border": "parallel: export draws the container border from the --tv-container-border var directly.",
  "--tv-container-border-radius": "parallel: export reads the radius via resolveContainerBorder.",
  "--tv-header-fg": "parallel: export uses activeHeaderVariant(theme) for header text (RISK: no parity gate — hunt #12).",
  "--tv-header-rule": "parallel: export uses activeHeaderVariant(theme) for the header rule (RISK: hunt #12).",
  // ── PENDING export work ──────────────────────────────────────────────
  "--tv-row-group-rule": "PENDING: export draws the group rule from borders.major; COLOR differs (neutral[7] vs border role) — hunt #B4.",
  // (hunt #2 RESOLVED 2026-06-13: --tv-first-col-bg/fg/weight are now drawn by
  //  the export too — renderUnifiedTableRow's first-col bold treatment — so they
  //  left this ledger.)
};

function domOnlyTokens(): string[] {
  return COMPONENT_TOKENS.filter(
    (t) => Array.isArray(t.consumedBy) && t.consumedBy.length === 1 && t.consumedBy[0] === DOM_ONLY,
  ).map((t) => t.cssVar);
}

test("every DOM-only token is justified in the divergence ledger", () => {
  const unjustified = domOnlyTokens().filter((v) => !(v in DOM_ONLY_LEDGER));
  expect(
    unjustified,
    `New DOM-only token(s) with no export consumer and no ledger justification.\n` +
      `Either draw it in src/export/svg-generator.ts too, or add a reason to\n` +
      `DOM_ONLY_LEDGER (browser-only / parallel / PENDING):\n  ${unjustified.join("\n  ")}`,
  ).toEqual([]);
});

test("the divergence ledger only shrinks (no stale entries)", () => {
  const domOnly = new Set(domOnlyTokens());
  const stale = Object.keys(DOM_ONLY_LEDGER).filter((v) => !domOnly.has(v));
  expect(
    stale,
    `Ledger entries that are NO LONGER DOM-only (wired into the export, or removed).\n` +
      `Delete these stale entries — the ledger ratchets DOWN:\n  ${stale.join("\n  ")}`,
  ).toEqual([]);
});

test("every ledger reason is a non-empty category-tagged string", () => {
  for (const [cssVar, reason] of Object.entries(DOM_ONLY_LEDGER)) {
    expect(reason.length, cssVar).toBeGreaterThan(0);
    expect(/^(browser-only|parallel|PENDING):/.test(reason), `${cssVar}: "${reason}"`).toBe(true);
  }
});

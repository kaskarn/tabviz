# Table semantics & a11y review (area J) — 2026-06-11

The widget renders one flat CSS grid (`.tabviz-main`); before this pass
it had NO table structure in the accessibility tree (data cells were
literally `role="presentation"`). This doc is the region-tree → ARIA
survey, what landed, and the review-pass findings with triage.

## The semantic map (RegionKind → ARIA)

| Region / element | ARIA | Notes |
|---|---|---|
| `.tabviz-main` grid | `role="table"` + `aria-label` (title) + `aria-rowcount`/`aria-colcount` | `table`, not `grid`: we don't implement arrow-key cell navigation; interactive content stays tab-reachable. |
| Header row(s) | `role="row"` wrapper, `display: contents` | One wrapper per header grid row (column groups make two); `aria-rowindex` = grid row. |
| Leaf column header | `role="columnheader"` (ALWAYS — was sortable-only) | `aria-sort` + `tabindex` + Enter/Space when sortable; viz (plot) headers got full keyboard-sort parity this pass. |
| Column-group header | `role="columnheader"` + `aria-colspan` | |
| `data` row | `role="row"` wrapper (`display: contents`), `aria-rowindex` | Cells `role="cell"` (incl. the empty viz placeholder cells, so child count = `aria-colcount`). |
| `group_header` row | wrapper carries `aria-expanded` (collapse-tracked) | `row` supports aria-expanded (treegrid vocabulary); the `cell` role does not — that's why it lives on the wrapper. Primary cell is the focusable toggle. |
| `panel` row (details/notes) | wrapper `role="row"`; panel div `role="cell"` + `aria-colspan` | Markdown content is plain DOM → readable. |
| `spacer` row | plain `role="row"` with empty cells | Announced as blank — see F4. |
| Axis strip | `aria-hidden` | Drawing chrome; not counted in `aria-rowcount`. |
| Viz overlays (forest/bar/box/violin SVGs) | `aria-hidden` | Drawing layers — see F1. |
| Watermark, shell strip, glass backdrop | `aria-hidden` | Already were. |
| Legend | `role="list"`/`listitem` | Pre-existing. |
| Pager | `role="navigation"` | Pre-existing. |

**Why `display: contents` wrappers are safe here:** every cell is
explicitly placed (`grid-row`/`grid-column` styles), so contents
children join the grandparent grid identically; no JS iterates direct
children (measurement queries `[data-row-id]`, descendant-based); no
child-combinator CSS exists. Verified empirically: the WYSIWYG gate
passed with zero geometry deltas after the change.

**Gate:** `interaction-qa.browser.ts` → `tableSemantics` scenario
(role=table, rowcount/colcount agreement, row-child validity,
aria-expanded flips with a REAL collapse click, overlays hidden).

## Review-pass findings (triaged)

- **F1 — viz marks have no text alternative.** The overlays are
  aria-hidden drawing layers. Triage: ACCEPTED with guidance — the
  semantic data belongs in paired text/numeric/interval columns (the
  universal pattern in clinical forest plots; R `tabviz()` defaults
  include them). Per-mark aria would be noise without a navigation
  model. Revisit only if a screen-reader user asks for in-plot reading.
- **F2 — paint mode flips the primary cell to `role="button"`**
  (aria-pressed needs it), breaking row containment WHILE the paint
  tool is active. Triage: ACCEPTED — transient authoring mode,
  reader-mode tree is always valid.
- **F3 — inline edit has no keyboard path.** dblclick or the
  right-click context menu only; neither is keyboard-reachable.
  Triage: BACKLOG (area F polish) — candidates: F2/Enter on a focused
  primary cell when `enableEdit`, or a context-menu key binding. Not
  floor-blocking: editing is an author-grade, default-OFF flag.
- **F4 — spacer rows announce as blank rows.** Minor verbosity.
  Triage: ACCEPTED (a hidden spacer would desync aria-rowcount from
  visible structure for marginal gain).
- **F5 — landed floor (for the record):** focus-visible ring on
  `--tv-focus-ring`; global prefers-reduced-motion kill-switch;
  keyboard sort (all headers incl. viz); keyboard paint parity (C54);
  keyboard group toggle; details toggle `aria-expanded`; HC contrast
  ratchet at the theme tier; no native dialogs.

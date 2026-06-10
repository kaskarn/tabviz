# Interactivity UX plan — zoom, row & column resize (normal widget)

Status: **decisions locked 2026-06-10** (user Q&A). Phases 0–2 in execution.
Scope: the normal widget, NOT the studio.

## Why this arc

A three-lens audit of the widget's interactivity (zoom/fit, row heights,
column resize/reorder) found five structural problems:

1. **No single manipulation grammar.** Five idioms coexist: zoom in a
   hover-dropdown, aspect in the same dropdown, row heights in settings-panel
   sliders, spacing on invisible canvas seams (`EdgeResize`), column widths on
   a 4px header edge. Different feedback, different commit semantics,
   different reset affordances.
2. **Incoherent persistence matrix.** Zoom → localStorage (survives
   everything); column widths → session, *destroyed by any Shiny data
   update* (`hydrateForSpec` wipes); row-kind pins → session, survive data
   updates; spacing drags → written into the theme, travel with it. Four
   lifetimes, none communicated.
3. **Two unrelated "zooms".** Widget scale zoom vs forest-column domain zoom.
   Domain zoom captured unmodified wheel (scroll hijacking for document
   readers). Widget zoom showed two numbers (trigger = actualScale, slider =
   zoom) with the auto-fit relation unexplained.
4. **Discoverability ≈ 0.** Everything opacity-0-until-hover; the flagship
   direct-manipulation feature (`RowEdgeHandles`) shipped `enabled={false}`.
5. **No keyboard/touch/ARIA story.** 4px hit targets, three stacked
   invisible affordances in 28px of header edge, no `aria-sort`.

The framing fact: report **readers** outnumber **authors** ~100:1, and every
affordance is paid by all readers but used by few authors. The author's real
need is not the gesture — it's **getting the found value back out** into a
reproducible artifact.

## Locked decisions

1. **Provenance: authoring surface, wire-first.** Interactive layout edits
   (column widths/order/hidden, row-kind pins, aspect) serialize into the
   spec wire as a **figure-layout block**; the portable artifact is JSON
   (parallel to the theme wire envelope). Per-language snippets (R today) are
   thin wrapper features generated FROM the wire. **R is not canonical** —
   tabviz is a TS framework; Python wrappers may come.
2. **Gestures live in an "arrange" tool** — a toolbar mode (paint-tool
   precedent). Arming it lights up ALL seams (column edges, row-kind edges,
   gap seams) with visible handles and live px readouts. Disarmed = clean
   reading surface. Plain column-edge resize stays always-on (the one
   universal table idiom).
3. **Defaults: conservative everywhere** (all runtimes), with two override
   channels and explicit precedence:
   `global default < theme opinion < explicit web_interaction() on the spec`.
   Themes may carry opinionated interaction defaults (e.g. a presentation
   theme enabling zoom affordances).
4. **Row resize: per-kind only.** Canvas drag handles ship inside the arrange
   tool with **ghost-highlight of all affected rows** during drag (the
   per-kind model must be visible or it reads as a bug). The figure-band
   sliders must be able to CREATE a first pin (today they only edit existing
   pins). Per-row pins explicitly **deferred**: the measure loop already
   handles per-row content overflow; overall tightness is density's job.
5. **Forest domain zoom: off by default; Ctrl/Cmd+wheel when enabled.**
   Plain wheel never hijacks page scroll.
6. **Widget zoom: keep the slider, one honest readout** ("63% · auto-fit"),
   Cmd/Ctrl+wheel added. Simplify, don't cut (don't-pre-bake-defaults: no
   usage data says presenters don't need per-figure zoom).
7. **A11y cheap tier now**: table role semantics, `aria-sort`, keyboard sort;
   arrow-key resize folded into the seam-grammar work. Keyboard column
   reorder deferred (documented gap).

### Persistence tiers (the contract)

| Tier | Carries | Lifetime | Reset |
|---|---|---|---|
| **View state** | zoom, auto-fit, contrast override | per-reader, localStorage | zoom dropdown reset |
| **Figure state** | column widths/order/hidden, row-kind pins, aspect | rides the spec wire (figure-layout block); survives data updates by id-reconcile; exportable | figure band "Reset figure" |
| **Theme state** | spacing (header/row/gap drags) | travels with the theme envelope | theme reset |

## Phases

**Phase 0 — hygiene (independent fixes)**
- `hydrateForSpec` reconciles column overrides by column id instead of wiping
  (Shiny data updates stop destroying user resizes).
- Zoom localStorage key collision: keyed by element id only; ids collide
  across documents. Scope the key by document.
- Figure-band row-pins: list all kinds present in the figure; sliders create
  pins, not just edit them.
- Domain zoom: modifier-gated wheel, conservative default off.
- Zoom display: one readout; Cmd/Ctrl+wheel widget zoom.

**Phase 1 — the contract**
- Figure-layout wire block on WebSpec (minor wire bump), hydrate + serialize
  both ways, TS-first.
- Interaction-defaults precedence chain (global / theme / spec). Theme wire is
  untrusted → validate interaction opinions at both ingresses.
- R-side serialize + export path; parity tests.

**Phase 2 — seam grammar + arrange tool**
- One resize idiom everywhere: preview during drag → commit on release,
  Escape cancels (restores), double-click resets to auto, live px readout.
  `RowEdgeHandles` migrates off commit-per-pointermove.
- Column polish: ~12–16px hit zone (thin visual), double-click autosize,
  per-column reset to auto.
- Arrange tool mode in the toolbar; row handles enabled inside it
  (geometry fix + ghost highlight).
- Arrow-key resize on focused handles (Shift = 10px).

**Phase 3 — a11y + harnesses (follow-up arc)**
- Table ARIA / `aria-sort` / keyboard sort.
- Extend `panel-liveness` / `interaction-qa` browser harnesses to walk the
  arrange tool (so it can't silently go dead like RowEdgeHandles did).

## Key code map (pre-arc)

- Zoom/fit state: `srcjs/src/stores/slices/layout-zoom.svelte.ts`
  (zoom/autoFit/aspect/contrastOverride; `actualScale = zoom × fitScale`;
  localStorage persist; also hosts `rowKindHeights` pins + `flexWidths`).
- Zoom UI: `srcjs/src/components/ui/ZoomControls.svelte`; keyboard shortcuts
  in `TabvizPlot.svelte`; domain zoom: `srcjs/src/lib/zoom-interactions.ts`.
- Row heights: `srcjs/src/lib/layout/row-kind-heights.ts` (5-layer cascade),
  `components/controls/RowEdgeHandles.svelte` (was `enabled={false}`),
  `components/ui/settings/FigureBand.svelte` (pin sliders).
- Columns: `components/table/ColumnHeaders.svelte` (resize handle),
  `components/controls/ColumnDragHandle.svelte` (reorder),
  `stores/slices/columns.svelte.ts` (`columnWidths`, `userResizedIds`,
  `columnOrderOverrides`, `hydrateForSpec`).
- Spacing seams: `components/ui/EdgeResize.svelte` (the preview/commit
  pattern to generalize).

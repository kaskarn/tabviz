# Handoff — row-kind height cascade → theme/cascade agent (2026-06-02)

A long geometry session just closed. This hands the **one remaining geometry
element** — the per-row-kind height *cascade + interactive affordance* — to the
theme/cascade agent, because its unbuilt layers (theme-level defaults +
inheritance) are theme-cascade territory and intersect the parallel cascade
rework (`dev/cascade-rework-note-to-row-kind-agent.md`).

## Lay of the land — what shipped this session (all on `main`, pushed)

The geometry subsystem is now very complete:

- **Forest scale** — per-context resolver (`lib/layout/forest-scale.ts`), global
  `xScale` retired; forest + viz scale construction converged (DOM↔export WYSIWYG,
  guarded by `forest-marks.browser.ts`). Multi-flex arc A–E **complete**
  (per-column `flex: boolean | number` weight; `docs/dev/multi-flex-columns.md`).
- **Region tree** (`lib/layout/region-tree.ts`) — rows are a flattened tree; the
  foundation features attach to (`docs/dev/region-tree.md`).
- **Details/disclosure rows** + **annotation/notes** — full feature across DOM /
  R / SVG, built on one `panel` primitive (`lib/markdown.ts`, `add_note()`,
  `details=`; Shiny sync for `expanded_rows`).
- **Density** — continuous `densityFactor` (theme input, `scaleSpacing`) + real
  per-density `rowGroupPadding` (8/12/16).
- **Row-kind height pin mechanism** — the load-bearing core of *this* handoff.

## The element to build

A per-row-kind height **cascade** + the interactive **affordance** to drive it.

### Already built — DO NOT rebuild (the pin layer)
- `computeRowLayout` (`lib/layout/table-metrics.ts`) honors a per-`RowKind`
  `rowKindHeights` map: sets the *base* height per kind; content/wrap still grows
  above it; independent of the density `rowHeight` so pins survive density+factor.
- `layout-zoom.svelte.ts` holds the map (`$state.raw`) + `setRowKindHeight(kind,
  h|null)` / `resetRowKindHeights()`; store-exposed (`store.setRowKindHeight`,
  `store.rowKindHeights`). Tested: `table-metrics.test.ts` (per-kind base,
  content-grows-above floor, density-independence).

### To build — DESIGNED, not built (`docs/dev/sizing-model.md` §8 + §8a)
The full per-kind height resolution beneath the pin, low → high precedence:
1. **Intrinsic kind ratio** of the density `rowHeight` (data 1.0, group_header
   1.0, summary 1.0, section-header 1.0, spacer 0.5) — ratios so they scale with
   density + factor for free.
2. **Inheritance** — `summary → data`, `section-header → group_header`. Shallow,
   fixed graph.
3. **Theme-level default** — a theme sets a kind's ratio (theme territory).
4. **Constructor override** — authored per-kind (`row_heights`), a ratio.
5. **Interactive pin** (BUILT) — absolute px, bypasses ratios, survives density.

`resolvedHeight = pin ?? (rowHeight × resolveRatio(kind))`, `resolveRatio` walks
constructor → theme → inherited-parent → intrinsic. "Reset" clears the pin →
re-enters the cascade.

The **affordance** (decided: build **both**): a settings-panel per-kind height
control (clean; no DOM wrinkle; add a "reset to default") **and** a drag handle
on a row's bottom edge.

## Open build-time questions (flagged, not decided)
- **Drag-UI DOM wrinkle:** rows have **no wrapper element** (cells are individual
  CSS-grid children), so drag handles need an absolutely-positioned **overlay
  layer** at row boundaries + pointer capture + commit fallbacks (mirror
  `ColumnHeaders.svelte::startResize`). Needs its own browser harness.
- **Ratio vs absolute:** layers 1–4 are ratios (scale with density); the pin is
  absolute (the §8 decision — the user dragged to *that* pixel). Keep that split.
- **Default ratio values:** picking them is a `feedback_dont_pre_bake_defaults`
  trap — don't bake speculative numbers; default everything to 1.0 (spacer 0.5)
  and let real use drive deviations.

## Forward-compat with the cascade rework (`region-tree.md` §8b, the architect note)
- Route per-kind theme reads through **one getter**, not deep field paths.
- Kind discriminators are kebab-able later (`group_header` enum is snake today —
  reconcile when `data-row-kind` stamping lands; not now).
- Don't widen the consumed vocabulary beyond what an affordance/theme actually
  reads.

## State
Everything above is shipped to `main` and pushed; `svelte-check` 0/0, full TS
suite + R suite green, docs + auto-memories current. `feat`-branch workflow:
branch off `main`, mirror the per-arc commit rhythm, validate with the harness
battery (see `CLAUDE.md` → Testing Instrumentation + Workflow).

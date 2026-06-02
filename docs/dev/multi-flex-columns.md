# Multi-flex columns — weighted width distribution

Status: **design, approved direction (2026-06).** Companion to `sizing-model.md`
and `r-ts-parity-notes.md`. Captures the model + phased plan for replacing the
single-flex-column layout with a weighted, reversible width-distribution engine.

## Context — why

Today the layout models "expand-to-fill" as a single scalar `forestWidth`
(a.k.a. `layout.plotWidth`): exactly ONE column (the forest, by default) absorbs
leftover width; every auto-width flex/viz column falls back to that same scalar,
so two would overlap. The code admits it (`svg-generator.ts`: *"the renderer
threads a single per-flex-column width … tabviz today renders at most one flex
column per spec"*). That blocks legitimate layouts — two forest plots side by
side, forest + bar, multiple viz columns — and it's an arbitrary cap.

The scoping investigation found the render layers are **already per-column**
(per-column d3 scales in a `Map<columnId,…>` on both DOM + export; absolutely-
positioned overlays measuring each grid cell's `offsetLeft`; per-column grid px;
per-column `vizX`/`forestX` threading; a per-column `flex` flag already in the
wire). The only thing assuming "one" is the **width derivation** — the
`forestWidth` scalar that everything falls back to.

## The model — weighted distribution (CSS flex-grow/shrink, per column)

Every column carries a **flex weight** `w ≥ 0`. Extra (or deficit) width relative
to the natural content widths is distributed across columns *proportional to
weight*, respecting per-column min/max. There is no privileged "the flex column"
— forest is just a high-weight column; a pinned (explicit-width) column is
weight 0.

**Base rule — effective weight = `typeFlex × natural`** (decided 2026-06,
"inverse-stretch / proportional"). The engine distributes the *delta* (not the
total) by effective weight:

```
base   = Σ naturalᵢ
delta  = targetTotal − base
wᵢ     = typeFlexᵢ × naturalᵢ                  ← the weight POLICY (proportional)
widthᵢ = naturalᵢ + delta × wᵢ / Σw    (then clamp to [minᵢ, maxᵢ];
                                         redistribute any clamped overflow)
```

Why the delta-form with `w = flex×natural` (not the `width ∝ flex×natural`
equilibrium): the equilibrium reading does NOT preserve naturals at base width (a
high-flex column sits pre-stretched even with no extra space) — unintuitive. The
delta-form gives the right base case **and** the desired character:
- `delta = 0` → naturals preserved.
- `flex = 1` everywhere → `widthᵢ = naturalᵢ × (target/Σnatural)` = **uniform
  proportional scale**, no tuning needed.
- small columns auto-penalized (small natural → small share) — the pvalue / ring
  / icon "penalty" mostly falls out for free; type weights are refinements.

**The engine is policy-free.** "Model B" is just this weight policy fed to the
generic `distributeFlexWidths` (which distributes a delta by any given weight).
Swapping the policy (e.g. to a `sqrt(nat² + 2·flex·nat·t)` within-pour falloff —
the literal "appetite drops as the column stretches", needs a 1-D root-find) is a
**Tier-2** option if linear + bounds ever allows a column to run away.

**Reversible by construction:** the result is a pure function of
`(naturals, weights, mins, maxes, targetTotal)` — no stored mutation. Going
`natural → T → natural` returns identically; `T → T'` is independent of history.
This replaces the stateful single-scalar override and is what makes the behavior
predictable to tune.

**Weight is type-defaulted, circumstance-adjusted, user-overridable** — a tiered
calculation:

- **Tier 1 — static type weights** (ship first). A registry maps column type →
  base weight. Shape (values are starters, tunable from usage, NOT pre-baked
  truth — see [[feedback_dont_pre_bake_defaults]]):
  - high: `forest`, `viz_bar`, `viz_boxplot`, `viz_violin` (the plots want width)
  - medium: `sparkline`, `bar`, `progress`, `heatmap`
  - default `1`: `text`, `label`, `numeric`, `interval`, `range`, `date`, …
  - penalized (fixed-ish glyph content): `pvalue`, `ring`, `stars`, `icon`,
    `badge`, vertical-layout `pictogram`
  - `0` (immovable): columns with an explicit numeric `width`

  **Viz/forest natural width** (decided: *designed per-type default*). Plot
  columns have no content-natural width — today forest's is literally
  `0.25 × container` (circular). For the proportional base rule to mean anything,
  each viz/forest type gets a designed default natural (e.g. a target plot width),
  in the same registry as the weights and tunable from usage.

  > ⚠️ **Caveat — viz natural isn't a constant.** As viz layouts grow their own
  > text (value labels beside bars, in-plot annotations, axis tick text), that
  > content *widens* the column's natural width, and the measurement becomes
  > viz-layout-specific (a bar with trailing value labels needs more natural width
  > than a bare bar). The designed default is a starting baseline; the natural-width
  > calc for viz must eventually fold in that intrinsic content, which is nontrivial
  > per viz type. Keep the viz-natural source pluggable so this can be refined
  > without touching the distribution engine.
- **Tier 2 — circumstantial adjustment** (later). Layout-time boosts/penalties:
  wrapped text earns a boost (more width = fewer lines); a `pictogram` shrunk by
  width pressure earns a boost; etc. Computed from content + measured state.

User override: `flex` becomes `boolean | number` (`true`→1, `false`→0, number =
explicit weight) — additive wire change; existing boolean specs keep working.

## How it subsumes the aspect ladder

The aspect reshape's two width levers (1A forest absorption + 1B non-flex scale)
**collapse into one call** to the distribution engine with the aspect target as
`targetTotal`. The `FLEX_CAP` becomes per-column bounds (`min = natural/cap`,
`max = natural×cap`) for weighted columns. The committed aspect work
(`lib/layout/aspect-ladder.ts` P0/P1/P3a) stays: `computeAspectLadder`'s height
ladder is unchanged; its width levers delegate to the new engine in Phase C.

## Phased plan

| Phase | Work | Behavior change | Est. |
|---|---|---|---|
| **A. Distribution engine** | Pure `distributeFlexWidths(items, target)` in `lib/layout/flex-distribute.ts` + tests (clamp/redistribute/reversibility). Policy-free (takes weights as input). | none (nothing wired yet) | ~1 day |
| **B. Wire engine into layout** | `computeLayout` (export) + `layout` slice (DOM): replace `forestWidth` scalar with per-column resolved widths via the engine; `ComputedLayout.forestWidth → flexWidths: Record<id,number>` (**clean break**, no shim). Render reads per-column (already capable). Type-weight registry (Tier 1, `lib/layout/flex-weights.ts`). | **YES** — extra width now distributes across all columns by weight, not just forest. Every table's fill behavior shifts. Visual re-baseline. | ~3–4 days |
| **C. Aspect on the engine** | Aspect width levers delegate to `distributeFlexWidths`; resume the DOM aspect adoption on per-column widths; parity test. | folds in the aspect flex-model change | ~2–3 days |
| **D. Weights through wire/R** | `flex: boolean\|number` through R serialize + R/TS authoring + `update_column`; honor user weights. | additive | ~1–2 days |
| **E. Tier 2 + cleanup** | Circumstantial weight adjustment (wrapped text, shrunk pictogram); retire the legacy global `xScale`; docs + parity. | additive + tuning | ~2–3 days |

**~2–3 weeks.** The risky step is **B** (default fill behavior changes) — isolated
to its own commit with a visual checkpoint, like the aspect flex-flag change.

## Key change surface (from scoping)

- Export: `computeLayout` forestWidth derivation (`svg-generator.ts` ~785–846),
  `getColWidth` (~3962), `ComputedLayout.forestWidth` (~898), aspect apply
  (`layout.plotWidth` override).
- DOM: `layout` slice forestWidth (`layout-zoom.svelte.ts` ~251, `tableWidth`
  ~399), `gridTemplateColumns` + `effectiveVizWidth`/`effectiveColumnWidth`/
  `getColWidth` (`TabvizPlot.svelte` ~695–772, ~900–942), the legacy global
  `xScale` (`axis.svelte.ts` ~125 — per-column overlays already bypass it).
- Spec/R: per-column `flex` (`authoring/columns.ts:124`, `types/index.ts:540`,
  `R/classes-components.R:65`) boolean→number; `plotWidth` scalar retired
  (`types/index.ts:781`, `R/utils-serialize.R:39`).
- Already per-column (no change): viz/forest d3 scales, SVG overlays, viz axes,
  grid px emission, column x-positioning.

## Verification

`bun test src/lib/layout/flex-distribute.test.ts` (engine: clamp, redistribute,
reversibility round-trip) · aspect parity tests · `npm run build` + behavior
gates · `tabviz::render_visual_tests()` + browser harness for the Phase-B fill
change (re-baseline) · R `save-plot` + parity tests · full `quarto render`.

## Status — `forestWidth` scalar fully retired (2026-06-02)

Phase B's clean break is **complete**: `ComputedLayout.forestWidth` (and the
co-dead `tableWidth` field + the unused `aspectNonForestScale`) are gone from the
type and both layout producers (`svg-generator.ts::computeLayout`,
`layout-zoom.svelte.ts`). Forest is now *just another high-weight plot column* —
its width comes only from the per-column `flexWidths` distribution. Changes:

- **Type** (`types/index.ts`): `ComputedLayout` lost `forestWidth` / `tableWidth`
  / `aspectNonForestScale`; `flexWidths` is the single source of truth.
- **Overlay components** (`EffectAxis` / `RowInterval` / `SummaryDiamond`): take an
  explicit `plotWidth: number` prop instead of reading `layout.forestWidth`.
- **Readers repointed** to `flexWidths[colId]`: `TabvizPlot` (`effectiveVizWidth`
  now drives *every* plot column incl. forest — the grid-template + overlay forest
  branches that duplicated explicit-first width logic were collapsed, since
  `flexWidths` already encodes `col.width` / `options.forest.width` pins), the
  export `colWidth`/`getColWidth` helpers + `LayoutMetrics`, `tabvizStore` export
  loop, and the cross-slice axis getter (renamed `getLayoutForestWidth` →
  `getForestPlotWidth`, now returns `flexWidths[firstForestId]`).
- **Aspect ladder** (`generateSVGForAspectTarget`): `naturalForestWidth` is now the
  Σ of *all* flex columns' natural widths (forest is one of them), not a scalar.

### FLAGGED follow-up — converge the forest "pin plot width" feature

Still forest-special (deliberately **not** removed here — it's a working,
public-surface feature, not the dead scalar): the dedicated path for *pinning the
forest plot column's width* —

- interactive drag-resize via `setPlotWidth` / `plotWidthOverride`
  (`layout-zoom.svelte.ts`, `TabvizPlot.svelte:1132`),
- the Shiny `plot_width` event round-trip (`spec/events.ts`, `R/shiny.R`),
- the wire scalar `theme.layout.plotWidth` (R `plot_width`, default `"auto"`).

Every *other* plot column (viz_bar / sparkline / …) resizes through the generic
`userResizedIds` + `columnWidths` mechanism. These pins currently flow correctly
into the distribution (the DOM `flexSpecs` `forestPin` honors `plotWidthOverride
?? theme.layout.plotWidth ?? options.forest.width`), so nothing is broken — but to
make forest *fully* generic this should converge onto the per-column resize path.
That touches the public wire, the R `plot_width` property/`set_*` API, and the
Shiny Tier-2 event contract, so it's its own arc.

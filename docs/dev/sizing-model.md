# The Sizing Model — a theory of everything for tabviz layout dimensions

Status: **design assessment, in progress.** This is the living record of an
ongoing design thread about how tabviz determines, computes, and applies every
size in a table — row/column dimensions, padding, borders, gaps, density, and
the aspect-ratio reshape. It exists because this work spans long, disjointed
sessions; read it before touching `layout-zoom.svelte.ts`, `columns.svelte.ts`,
`width-utils.ts`, `rendering-constants.ts`, `export/svg-generator.ts`, or the
`SpacingTokens` schema.

> Companion docs: `architecture-map.md`, `column-schema-system.md`,
> `r-ts-parity-notes.md`. The theme **resolution** rework (T1 inputs / role
> unification) is tracked separately and was in flight when this was written —
> this doc is about *consuming* `theme.spacing`, downstream of resolution.

---

## 0. The thesis

Every sizing quantity should be **one token, resolved through one cascade,
consumed by one metrics pass, and rendered identically by both backends (DOM +
V8/SVG).** Today none of those four "ones" hold:

- tokens are defined in 2–3 places and some never reach the renderer;
- there is no single resolution cascade for spacing (density is a destructive
  pre-mutation, not a tier);
- the metrics computation is duplicated between `layout-zoom.svelte.ts` (DOM)
  and `export/svg-generator.ts` (SVG);
- row height is *predicted from text*, not measured, and only for text.

The target pipeline:

```
density profile  ⊕  theme.spacing  ⊕  per-column/row-type override  ⊕  interactive pin
        │  (resolve — NA fills downstream, pins survive; idempotent, like the theme cascade)
        ▼
   resolved sizing tokens
        │  ⊕ content measurement (text wrap + per-cell naturalHeight)
        ▼
   per-row heights / per-column widths / chrome dims     ← computeTableMetrics (SHARED DOM/SVG)
        │
        ▼
   rowPositions / markerCenters / geometry
        │  (aspect reshape — reads REAL heights + density-derived floors; fixpoint if it reflows)
        ▼
   final layout
```

---

## 1. Current reality (evidence)

### 1.1 The `SpacingTokens` schema (`srcjs/src/types/theme-v2.ts:142`)

```
rowHeight, headerHeight, cellPaddingX, cellPaddingY, padding,
groupPadding, rowGroupPadding, axisGap, headerGap,
titleSubtitleGap?, footerGap?, spacerRowHeight?, indentPerLevel?
```
Defaults: `srcjs/src/lib/theme-resolve.ts:86-100` (rowHeight 28, headerHeight 36,
cellPaddingX 10, cellPaddingY 0, padding 16, groupPadding 8, rowGroupPadding 0,
axisGap 12, headerGap 12, indentPerLevel 16, spacerRowHeight 20, …).

### 1.2 Smoking guns (tokens that don't arrive / are multiply-sourced)

- **`spacerRowHeight` is inert.** Schema default 20; **not** in any density
  preset; renderer hardcodes `rowHeight / 2` (`layout-zoom.svelte.ts:358`; SVG
  `svg-generator.ts:794`). Setting it does nothing.
  **Fix:** `h = spec.theme.spacing.spacerRowHeight ?? rowHeight / 2` in *both*
  backends, and add it to the density presets.
- **`cellPaddingY` is inert.** Schema default 0; **not** in any density preset;
  renderer never adds it to row height — vertical breathing is faked by a magic
  `+6` in the wrap formula (`layout-zoom.svelte.ts:363`). theme-css also emits
  `--tv-cell-padding-y: 0px`. This is the token to revive if rows are to breathe
  per density.
- **`indent_per_level` is dropped.** Density sets it (14/16/20) and the schema
  carries it, but the renderer uses hardcoded `SPACING.INDENT_PER_LEVEL = 12`
  (`rendering-constants.ts:181`) — triple-sourced (theme / constant / rowGroup).
- **`indentPerLevel` is triple-sourced:** theme `spacing.indentPerLevel` (16),
  the hardcoded `SPACING.INDENT_PER_LEVEL` (12, `rendering-constants.ts:181`),
  and a `rowGroup.indentPerLevel`. Different measurement paths read different ones.
- **Hardcoded band heights that should be tokens:** summary/overall row =
  `rowHeight * 1.5` (`layout-zoom.svelte.ts:390`); group-header row = `rowHeight`
  (no own token); header min = `ceil(bodyFont * 1.05 * 1.5) + 6`.

### 1.3 Density IS already a cascade tier (the proposed model already exists)

`density` is a Tier-1 input (`R/classes-theme.R:89`, default "comfortable",
validated to compact/comfortable/spacious; `set_density` sets `inputs@density`,
`R/themes-api.R:225`). It resolves to Tier-2 spacing numerics via a preset table
(canonical: `srcjs/src/lib/theme-v2-adapter.ts::DENSITY_SPACING` — the in-flight
adapter; mirrored for parity tests in `R/utils-theme-resolve.R:7-26`, guarded by
`test-theme-roster-sync.R`). The mirror's exact values:

| token | compact | comfortable | spacious | renderer status |
|---|---|---|---|---|
| row_height | 20 | 24 | 30 | ✅ honored |
| header_height | 26 | 32 | 40 | ✅ honored |
| padding | 8 | 12 | 16 | ✅ honored |
| axis_gap | 8 | 12 | 16 | ✅ honored |
| cell_padding_x | 8 | 10 | 14 | ⚠️ honored in *measure*; SVG *render* inset hardcodes 10 (§1.5) |
| column_group_padding | 6 | 8 | 12 | ✅ honored |
| row_group_padding | **0** | **0** | **0** | ✅ honored, but density never varies it → all presets identical |
| indent_per_level | 14 | 16 | 20 | ❌ renderer uses hardcoded `SPACING.INDENT_PER_LEVEL=12` |
| footer_gap / title_subtitle_gap / header_gap / bottom_margin | … | … | … | (chrome gaps) |

**Two distinct breakage classes — both illustrate the thesis:**

1. **Density sets it, renderer drops it:** `indent_per_level` (14/16/20 →
   renderer ignores, uses 12). `cell_padding_x` partially (SVG render inset).
2. **In the schema but density never sets it AND renderer ignores it:**
   `cellPaddingY` (schema default 0; faked by hardcoded `+6`) and
   `spacerRowHeight` (schema default 20; faked by `rowHeight/2`). These two are
   the requested "easy settings" candidates and are currently *fully inert*.

Also note `row_group_padding` is in the preset but **0 across all three
densities** — so "group-row vertical padding" exists end-to-end yet is invisible
because no preset ever sets it nonzero. That's the cheapest possible win: give it
real per-density values.

So the architecture the §0 thesis wants (density → spacing via an idempotent
cascade) **is in place on the input/resolution side.** The gaps are downstream:
some density tokens are dropped by the renderer, two useful tokens are inert, and
there is no *interactive* layer to depart a preset and pin individual tokens (§8).

### 1.4 Row-height adaptation is narrow (opt-in, capped, predicted, text-only)

`layout-zoom.svelte.ts:354-369`, wrap counting `columns.svelte.ts:792-846`:

- **opt-in:** only columns with `wrap: true|N` inflate height; otherwise one
  line, ellipsis-truncated.
- **capped:** `wrap:true` → 2 lines, `wrap:N` → N+1.
- **predicted, not measured:** line count = `ceil(estimateTextWidth(seg) /
  contentWidth)` — the character-class estimator, never the real rendered box.
- **text only:** tall pictograms, multi-line badges, `col_img` heights,
  sparklines, and **multi-effect forest rows** (stacked at `EFFECT.SPACING=6`)
  do **not** contribute to row height → they clip/overflow.

`rowHeight` is effectively a global scalar with three local deviations: spacer
(½), wrap (taller, text-only), group-padding (taller).

The symmetric fix already half-exists: cell schemas dispatch `naturalWidth`
(`width-utils.ts:172`). Add **`naturalHeight(col, row)`** on the same dispatch;
then `rowHeight_i = max(themeRowHeight, max-cell naturalHeight, wrapHeight) +
paddingY`. Browser path may additionally measure-then-commit (offsetHeight); V8
path keeps estimator + naturalHeight.

### 1.5 The box model is all global scalars (no granularity)

No per-side horizontal padding (left == right), no per-column padding, no
per-row-type padding, no vertical padding. Padding `cellPaddingX` is consumed in
**three** places that must agree — width budget (`width-utils.ts:238`), wrap
`contentWidth` (`columns.svelte.ts:815`), and render inset — and the SVG render
inset currently reads a **hardcoded `SPACING.TEXT_PADDING=10`** instead of the
theme value, so any non-default `cellPaddingX` (and any future granular padding)
silently fails to apply in exports.

### 1.6 The aspect ladder (`layout-zoom.svelte.ts:198-321`)

Pins `width/height == targetAspect` via three coupled levers (forest flex →
non-forest column scale → row+chrome height) with magic caps (`FLEX_CAP=2`,
floors `0.25`/`0.4`, `CHROME_SHARE=0.35`, `8×` width cap). Three structural
problems:

1. **Solved on a fiction:** `approxRowsHeight = effectiveRowSlots *
   naturalRowHeight` (`:217`) assumes every row is the natural height — ignores
   wrap inflation, spacer ½-rows, group padding. Target ≠ rendered whenever any
   row deviates.
2. **Width-scaling induces the wrap it ignores:** shrinking columns
   (`aspectNonForestScale`, `:277`) narrows `contentWidth` → more wrap → taller
   rows → height changes → the just-solved aspect is wrong. **Width and height
   are circularly dependent but solved in one forward pass.**
3. **Duplicated:** reimplemented in `svg-generator.ts`
   (`generateSVGForAspectTarget`) — two copies of a ~110-line algorithm.
4. The `MIN_ROW_HEIGHT` floor (`:288`) ignores density.

**Open fork:** is aspect a *reflow* target (change geometry) or a *scale-to-fit*
target (CSS transform into a frame)? It currently reflows, which is what makes
it fight content. If scale-to-fit, most of the ladder deletes. If reflow, it
must read real post-wrap heights and iterate to a fixpoint.

---

## 2. Token taxonomy

| Class | Tokens | Status / gap |
|---|---|---|
| Band heights | `rowHeight`, `headerHeight`, `spacerRowHeight`, group-header, summary/overall | spacerRowHeight **dead**; summary `*1.5` hardcoded; group-header no token |
| Inter-band gaps | `rowGroupPadding`, `headerGap`, `axisGap`, `titleSubtitleGap`, `footerGap` | wired ✓ (rowGroupPadding default 0) |
| Intra-cell padding | `cellPaddingX`, `cellPaddingY` | cellPaddingY **set by density but ignored by renderer**; single scalar; no per-side/per-column |
| Indent | `indentPerLevel` | **triple-sourced** (16 / 12 / rowGroup) |
| Container | `padding` | wired ✓ |
| Content-driven | wrap height, per-cell `naturalHeight`, multi-effect stack | wrap text-only/opt-in; naturalHeight **missing**; multi-effect doesn't drive height |

---

## 3. Density cascade — exists; what's left

The cascade is already:
```
density preset (compact|comfortable|spacious)  →  theme.spacing  →  (column/row-type override — MISSING)  →  interactive pin (MISSING)
```
The first two arrows exist (§1.3). The remaining work:

- **Make the renderer honor the tokens density already sets** (`indent_per_level`,
  SVG `cell_padding_x`) and **add the two inert tokens** (`cellPaddingY`,
  `spacerRowHeight`) to both the renderer and the presets (§1.2).
- **Give `row_group_padding` real per-density values** (currently 0/0/0).
- **Per-column / per-row-type override tier** — does not exist yet; the cascade
  jumps straight from theme to render.
- **Interactive pins** — a settings-panel slider or drag edit should pin that
  token so density stops controlling it (pin-survives rule, mirroring the
  `userResizedIds` precedent for column widths). See §8.
- **Per-token density behaviour is already encoded by omission** (horizontal
  padding isn't in the preset). If granular padding lands (§1.5), each new token
  must decide its density membership the same way.

The two requested "easy settings":
- **group-row vertical padding** = `rowGroupPadding` — fully wired end-to-end but
  the presets set it to 0 everywhere. Win = nonzero per-density values + a
  settings-panel slider. Cheapest possible (no renderer change).
- **spacer row height** = `spacerRowHeight` — revive the inert renderer read
  (§1.2) + add to presets, then it's a real density-aware knob.

---

## 4. The connection web

```
density profile ─┐
theme.spacing ───┼─► resolved tokens ─► cellPaddingX ─► colWidth measure ─► wrap contentWidth ─┐
overrides/pins ──┘            │                                                                  │
                             ├─► rowHeight, spacerRowHeight, rowGroupPadding ──────────┐         │
                             └─► headerHeight, axisGap, padding ─► chrome dims         ▼         ▼
per-cell naturalHeight ───────────────────────────────────────► rowHeights ◄──── wrap line count
                                                                     │
                                                  rowPositions / markerCenters / forest+viz geometry
                                                                     │
                          sum(rowHeights)+chrome ─► natural height ─► ASPECT LADDER ─┐
                                                                     ▲               │ mutates rowHeight
                                                                     └───────────────┘ + column scale → re-wraps (CYCLE)

interactive:  resize → contentWidth → wrap → rowHeights ;  spacing slider → tokens → all ;  density → tokens → all
```

The only cycle is aspect ↔ (column scale → wrap → rowHeight). Everything else is
a clean DAG once density is a tier and tokens stop leaking.

---

## 5. Implications to keep tracked

1. **Parity is the gate.** Any new/revived token must arrive in BOTH DOM and
   SVG. `spacerRowHeight` is the cautionary tale → land a shared
   `computeTableMetrics` *before* expanding the token set, or new knobs won't
   export. Add a parity test per token.
2. **One spacing vocabulary.** Retire the hardcoded twins in
   `rendering-constants.ts` that shadow `theme.spacing` defaults
   (`TEXT_PADDING`=cellPaddingX, `INDENT_PER_LEVEL`, `COLUMN_GROUP.PADDING`,
   axis-height/gap). SVG render must read theme padding, not the constant.
3. **Order of operations is load-bearing:** resolve(density) → content(wrap +
   naturalHeight) → aspect(reshape, density-aware floor). Aspect last, on real
   heights.
4. **Granular padding feeds wrap, not just render.** Per-side/per-column padding
   must reach `contentWidth` in the wrap counter, or wrap drifts.
5. **Reintroducing vertical padding** retires the magic `+6` and lets rows
   breathe instead of faking it; it's the token that makes density visually real.

---

## 5b. Group-header band height — decided 2026-05-29

Direction (confirmed with author):

- **Decouple from `rowHeight`** — the current `h = rowHeight` for group headers
  (`layout-zoom.svelte.ts:360`) is incidental. A group header is a labeled
  structural separator, ontologically closer to the column-header strip.
- **Band height is derived from the group label's own typography** (font role +
  padding), like `minHeaderRowHeight` does for the column header — with an
  optional tier value as override/floor. Content (`naturalHeight`, label wrap)
  still floors it.
- **Uniform across depth — NOT per-depth height.** Depth hierarchy is signaled
  by typography (font size), background tint, and indent, which already exist
  (`rowGroup.L1/L2/L3`). Height does not carry hierarchy → no per-depth height
  tier. (This rejects the per-depth half of the earlier "C" option.)
- **Separation is the primary group lever, not band height.** Rework
  `rowGroupPadding` from its current "trailing pad on the previous data row,
  top-level groups only" model (`layout-zoom.svelte.ts:341-352`) into a proper
  depth-aware leading/trailing **group margin** that works at every nesting level
  and on the first group. Most "make groups stand out" intent is separation, not
  a taller bar.
- **Drag** on a group header edits the group-band height token (table-wide) and
  pins it — per §8.

## 6. Open decisions (carry forward)

- [ ] **Aspect: reflow or scale-to-fit?** Determines whether the ladder is
  rebuilt around fixpoint iteration or mostly deleted. (§1.6)
- [ ] **Row height: predict-only, or measure-then-commit on the browser path?**
  i.e. are we willing to take a DOM measurement pass (browser only; estimator +
  `naturalHeight` stays for V8 parity)? (§1.4)
- [ ] **Density: keep the continuous `factor` alongside named profiles, or fold
  it in?** (§3)
- [x] **`computeTableMetrics` (shared DOM/SVG)** — BUILT 2026-06 as
  `srcjs/src/lib/table-metrics.ts`. Both backends (layout-zoom `$derived`,
  svg-generator `computeLayout`) now call shared pure helpers for the formulas
  they used to hand-mirror: `computeRowLayout` (heights/positions/marker-centers/
  rowPaddedAfter), `computeHeaderHeight`, `computeAxisHeight`,
  `computeScalableChromeHeight` + named constants (`HEADER_FONT_SCALE`,
  `LINE_HEIGHT`, `HEADER_ROW_PADDING`, `DEFAULT_AXIS_GAP`). **Two divergences
  converged on the more-correct SVG formula** (axisHeight gate: pure tables now
  reserve 0 axis, forest tables get density-scaled axis not flat 32 — also fixed
  the stale `ComputedLayout.axisHeight = LAYOUT.AXIS_HEIGHT` bug; chrome-scale
  denominator: precise conditional sum, fixing DOM aspect over-scaling). **One
  divergence deliberately kept** (`forestWidth`: container-responsive DOM vs
  fixed-canvas SVG — correct context-dependence, documented on both sides).
  Gated by the snapshot harness + 16 table-metrics unit tests + R export tests.

---

## 6b. Verification harness (built — the numeric half of "debug-shapes")

The regression substrate the RowKind + `computeTableMetrics` refactors are
validated against.

- **`computeLayoutMetrics(spec, opts?)`** (`srcjs/src/export/svg-generator.ts`)
  — pure, no render. Flat `LayoutMetrics`: per-row `{kind, depth, height, top,
  markerCenter}`, per-column `{id, type, width}`, chrome dims, and a
  **spacing-token echo** (records WHICH token value was consumed → catches
  dead-token / density-not-applied regressions, not only geometry drift). Runs
  the real `computeLayout`, so it captures the actual SVG/V8 path.
- **`sizing-fixtures.ts`** — deterministic matrix (density / overall / wrap /
  indent / spacers / groups / mixed columns). **Stub themes with explicit
  spacing** (mirrors `DENSITY_PRESETS`), not the resolver — runs under bun,
  immune to in-flight theme-resolution churn. density→spacing fidelity stays the
  R `DENSITY_PRESETS` parity mirror's job (deliberate separation).
- **`layout-metrics.test.ts`** — snapshot per fixture + box-model invariants
  (density monotonicity, spacer<data, wrap inflation, monotonic positions,
  positive widths). 31 tests.

- **`debug-shapes.ts`** (the **visual half**, built) — `renderDebugShapes(spec)`
  emits an SVG that draws each cell's allocated box, horizontal padding regions
  (pink), text-anchor inset (red dot), row marker-center (blue dash), per-row
  indent inset (amber), and row-kind (fill) — content stripped so the box model
  itself is visible. A *pure function of `computeLayoutMetrics`* (the column `x`
  / `mainY` it needs were added to the metrics), so the visual and numeric views
  agree by construction. Drive it from R via `render_debug_shapes(spec, "out.png")`
  (V8 + rsvg) for eyeball review; `debug-shapes.test.ts` guards the SVG contract.
  Per-backend rendering of the same metrics is the future DOM↔SVG parity view.

Still TODO: the DOM `debug-layout.ts` (predicted-vs-actual overlay, URL-flag
gated) could draw from `LayoutMetrics` too, giving a live in-widget version.

## 7. Cheap wins available independent of the big refactor

- Honor `spacerRowHeight` (one line per backend) — §1.2.
- Honor `cellPaddingY` from density instead of the hardcoded `+6` — §1.2.
- Expose `rowGroupPadding` in the settings panel (already wired) — §3.
- Collapse the `indentPerLevel` triple-source to the theme token — §1.2.
- Make SVG text inset read `theme.spacing.cellPaddingX` not `SPACING.TEXT_PADDING`
  — §1.5 (also fixes a theme-dependent export drift bug).

---

## 8. Ontology of interactive row-height drag-resize

**Question:** when a user drags a row's bottom edge, what are they editing?

**The column precedent (why rows are different).** Column drag-resize writes a
**per-column** width pin (`columnWidths[col.id]` + `userResizedIds`,
`columns.svelte.ts`). That's correct *because columns are heterogeneous by
nature* — each has its own width, stable identity, and independent meaning.
Rows are the opposite: **homogeneous by design** (uniform row height is what
makes the grid read as a grid and keeps forest marker-centers aligned) and
**data-lifecycle-transient** (rows appear/vanish under sort/filter/paginate).

**Therefore the per-row interpretation is the tempting-but-wrong default.**
Pinning "row #5 = 40px" raises two problems: (a) it breaks the homogeneity
invariant and the marker-center alignment that assumes a single `rowHeight`;
(b) after a sort/filter the pin either follows `row.id` into a now-arbitrary
position or is orphaned — neither is what the user meant by "make rows taller."

**Ontologically correct: drag edits the band-type's height TOKEN, table-wide,
and pins it.** The unit of resize should match the unit of natural variation —
columns vary per-column, rows vary per *band type*:

| dragging a… | edits token | effect |
|---|---|---|
| data row | `rowHeight` | all data rows |
| spacer row | `spacerRowHeight` | all spacers |
| group-header row | (new) group-header height token | all group headers |
| header | `headerHeight` | the header strip |

This makes drag a **direct-manipulation editor for a spacing token**, which
composes cleanly with everything else:

- **Density:** dragging pins the token → density stops controlling it (departs
  the preset into "custom"), exactly the `userResizedIds` pin-survives rule.
  Changing density afterward leaves the pinned token alone.
- **Content-driven height (§1.4):** the token is a **floor**
  (`max(rowHeight, contentHeight)`). Drag-up always works; drag-down clamps at
  the per-row content minimum (with feedback), since you can't shrink below
  content without clipping.
- **Aspect ladder (§1.6):** an explicit drag is a stronger signal than the
  aspect target. The dragged height token becomes user-pinned and is **excluded
  from the aspect row-height ladder** — same precedent as `aspectNonForestScale`
  skipping user-resized columns. Aspect then absorbs via forest/chrome only, or
  releases.
- **Parity:** because drag mutates a token (not per-row data), both DOM and SVG
  consume it through the same path — no per-row special case to keep in sync.

**Escape hatch for the genuine per-row case** (a deliberate "hero" row): that's
better expressed as authored content (a taller cell / `naturalHeight`) or an
explicit `row.style.height`, not interactive drag. If per-row drag is ever
wanted, it must answer the sort/filter-identity question first.

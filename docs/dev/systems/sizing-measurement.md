# System map — sizing & measurement

**What this is.** A *code map* of how tabviz decides how wide every column is and
how tall every row is, on both runtimes. It answers "what measures what, when,
and where does the state live". It is deliberately **not** a re-statement of
`docs/dev/sizing-model.md`, which is the *design* record (thesis, token
taxonomy, open decisions, the aspect fork, the B2 postmortem). Read this to
navigate the code; read `sizing-model.md` to learn why the code is shaped this
way. Cross-references below are to `sizing-model.md §N`.

Audited 2026-07-27. Findings from that audit are at the bottom under
`## Findings`.

---

## 0. The two paths, at a glance

There are exactly two runtimes that compute geometry, and they are **not** a
fork — they share the pure math and differ only in the *measurement primitive*
and the *reactive plumbing*.

| | DOM (browser widget) | Export (V8 / `save_plot` / download) |
|---|---|---|
| entry | `stores/slices/layout-zoom.svelte.ts:300` (`layout` `$derived`) | `export/svg-generator.ts:719` (`computeLayout`) |
| column widths | `stores/slices/columns.svelte.ts:608` `doMeasurement` | `export/svg-generator.ts:356` `calculateSvgAutoWidths` |
| text metric | Canvas `measureText` (`lib/width-utils.ts:238`), estimator fallback | pure-JS estimator only (`lib/width-utils.ts:170`) |
| row heights | `lib/layout/table-metrics.ts:126` `computeRowLayout` | same function |
| flex distribution | `lib/layout/flex-distribute.ts:141` `resolveFlexWidths` | same function |
| aspect ladder | **inline copy** at `layout-zoom.svelte.ts:414–465` | `lib/layout/aspect-ladder.ts:110` `computeAspectLadder` |
| content height | estimator (`computeContentHeights`) **plus** a DOM measure-then-commit loop | estimator only |

Shared pure modules (no runes, no DOM, V8-safe):
`lib/layout/table-metrics.ts`, `lib/layout/row-kind-heights.ts`,
`lib/layout/row-kind.ts`, `lib/layout/flex-distribute.ts`,
`lib/layout/flex-weights.ts`, `lib/layout/aspect-ladder.ts`,
`lib/width-utils.ts`, `lib/typography-layout.ts`,
`schema/measure-composed.ts`, `lib/theme/density-presets.ts`,
`lib/theme/shell-paper.ts`, `lib/theme/spacing-tokens.ts`.

---

## 1. Width

### 1.1 What gets measured, and when

`measureAutoColumns()` (`columns.svelte.ts:567`) is the DOM entry point. It
resolves the body font (rem→px against `document.documentElement`, `:575–579`),
runs `doMeasurement` once synchronously, then **re-runs it twice more** off
`document.fonts.ready` and every `loadingdone` event for 15 s (`:586–605`) —
because `fonts.ready` settles the loading set at call time and can resolve
before the theme's webfont `<link>` is injected.

Callers (each of these is a re-measure trigger):

- `setSpec` — `tabvizStore.svelte.ts:488`
- `resetState` — `tabvizStore.svelte.ts:623`
- theme mutations (5 sites) — `slices/theme.svelte.ts:255,336,509,601,709`
- `insertColumn` — `columns.svelte.ts:401` (added by `6fda600f`)
- `updateColumn` — `columns.svelte.ts:438`
- `hydrateForSpec` tail — `columns.svelte.ts:541`

`hideColumn` (`columns.svelte.ts:404`) deliberately does **not** re-measure.

### 1.2 `doMeasurement` — the leaf pass

`columns.svelte.ts:608–1040`. Writes **in place** into `columnWidths`
(`$state`, not `.raw`, precisely because this function mutates keys —
see the note at `:169–173`).

Order of operations:

1. **Iterate the EFFECTIVE tree**, `effectiveColumnDefs`, not `spec.columns`
   (`:817–820`). This is the `6fda600f` fix: a runtime-inserted column is absent
   from the wire, so iterating the wire left it with no width entry and a 0px
   grid track on a width-saturated table. The label slot is skipped here and
   measured by its own richer pass.
2. `measureLeafColumn` (`:701`):
   - user-resized → skip entirely (`:702`);
   - explicit numeric `width` → **delete** any stale auto entry and return
     (`:717–720`) — `width = N` is a hard pin, not a floor (GH #6), kept in
     lockstep with `calculateSvgAutoWidths`;
   - header measured at the bold key, 1.05× body (`:728–730`);
   - cells → `measureComposedColumnWidth` first; `null` means "plain column",
     fall back to the flat rank+top-K path with bold rows split onto the bold
     key (`:748–763`);
   - `max` with `glyphNaturalWidth` (fixed-pixel artwork), then
     `clamp(typeMin … AUTO_WIDTH.MAX)` after adding `cellPadding + RENDERING_BUFFER`
     (`:765–772`).
3. **Group-header expansion** (`processColumn`, `:775–796`): if a group's header
   is wider than its children's total, the surplus is spread evenly over the
   non-user-resized leaves.
4. **Primary/label column** (`:823–976`): a separate pass because its content is
   label + indent + badge + group-header chrome. Ranks synthetic
   "label+indent+badge" candidates, exact-measures the top-K.
5. **Wrap line counts** (`:978–1040`): per row, `ceil(estimate / contentWidth)`
   capped at `wrap+1` (or 2 for `wrap: true`), written into the cells slice.
   This is the ONLY producer of `wrapLineCounts`.

`rankTopK` / `measureExact` live in `lib/width-measure.ts`; `DEFAULT_TOP_K` is 3
for flat strings, `COMPOSED_TOP_K` is 10 for trees.

### 1.3 The text estimator

`lib/width-utils.ts`.

- `estimateTextWidth(text, size, weight, family)` (`:170`) sums **real measured
  per-glyph advances** from `font-metrics.generated.ts`, interpolating each
  glyph across the 400↔700 weight axis. Family resolution is memoized
  (`resolveFamilyMetrics`, `:139`). Never hand-edit the constants; regenerate
  with `scripts/measure-font-metrics.mjs`.
- `offlineFallbackFamily(family)` (`:111`) collapses a stack to
  `serif | sans-serif | monospace`. **The export must measure with this, not the
  webfont name**: librsvg ignores `@font-face` and substitutes the next
  installed face, whose bold can be ~15 % wider. Used at
  `svg-generator.ts:388` (`measureFamily`).
- `tabularizeDigits(text)` (`:166`) replaces digits with `"0"` before flat
  measurement, because cells paint `font-variant-numeric: tabular-nums` while
  Canvas/the metric table measure proportional digits. Applied at exactly two
  sites: `columns.svelte.ts:631` and `svg-generator.ts:538` — **the flat paths
  only**.
- `glyphNaturalWidth` / `glyphNaturalHeight` / `computeContentHeights`
  (`:277,293,313`) dispatch through the column schema
  (`schema/dispatch.ts::dispatchForColumn`).

### 1.4 Composed cells

`schema/measure-composed.ts:112` `measureComposedColumnWidth` is the single
source for both runtimes. It ranks rows by the cheap flat estimate, then runs
the real `renderCell` → `renderNodeToSvg` with a **width-only `StyleResolver`**
over the top-K trees. Returns `null` for a column whose probed cells are all
single un-styled text runs (caller keeps the flat path) and for
`kind: "component"` trees (`:150` — `renderNodeToSvg` can't size a DOM
component; its width comes from the flat display text).

The two callers inject different measures:

- DOM (`columns.svelte.ts:677–686`): Canvas-exact, then
  `÷ scaleComp` (the live `actualScale`, so the result lands in the grid's
  **natural pre-transform space**) then `+ COMPOSED_SPAN_BEARING (1.5)` then
  `ceil` per span — each leaf is an independent inline box the browser rounds up
  and cannot kern across.
- Export (`svg-generator.ts:513–521`): the bare estimator, family/weight-aware
  (`BOLD_CELL_WEIGHT` + `measureFamily` for bold rows). No scale, no bearing —
  the export draws at scale 1 with fractional x, and `renderNodeToSvg` is the
  same code that paints, so measure == render.

### 1.5 Flex distribution — one engine, two targets

`lib/layout/flex-distribute.ts`. `distributeFlexWidths` (`:45`) is CSS-flex-style
water-filling: every column starts at its bounded natural, the delta is handed
out proportional to `weight`, columns that hit a bound freeze and their share is
redistributed. `resolveFlexWidths` (`:141`) applies the column policy —
`weight = flexWeight × natural`, explicit width ⇒ weight 0 and pinned, `cap` ⇒
symmetric `[natural/cap, natural×cap]` bounds.

Both runtimes call it. They differ in the **target total**:

- DOM (`layout-zoom.svelte.ts:506–519`): target = `layoutWidth − 2×padding`,
  i.e. the container. And it is **skipped entirely** when there is no flex
  column and no pinned aspect (`hasFlexColumns`, `:502`) — a plain table then
  renders `max-content` tracks and hugs its content (D19). Shell/paper padding is
  deliberately *not* subtracted from the budget (`:286–294`).
- Export (`svg-generator.ts:1004–1064`): target = `totalWidth − 2×padding`,
  where `totalWidth = max(widthFloor, neededWidth)` and
  `neededWidth = 2×padding + labelWidth + Σ naturals`. The primary column is
  `unshift`ed as an ordinary flex item with `minWidth = labelWidth` (D20 item 4).

D32 (decision register) budgets the residual divergence: past container
saturation the export can grow a high-weight column that the DOM keeps even.
Production WYSIWYG is unaffected because the browser download **pins** the
on-screen widths (`getExportDimensions`, `tabvizStore.svelte.ts:1110`, →
`options.columnWidths`, consumed at `svg-generator.ts:876`).

### 1.6 R-side pixel-exact pins

`R/save_plot.R:490` `.inject_systemfonts_widths` stamps numeric `@width` onto
columns so V8 skips measurement entirely. Contract:

- Requires `systemfonts`; silently returns the spec unchanged otherwise.
- **Metric-class guard** (`:507–524`): if the theme asks for a mono family but
  the resolver hands back proportional metrics (`"iiii"` ≠ `"MMMM"`), skip
  injection — the rasterizer would fall back to a real mono and the pins would
  under-budget.
- Constants MUST equal the TS source (D33): `RENDERING_BUFFER = 4`,
  `AUTO_WIDTH.MIN = 60`, `MAX = 600`, `LABEL_MAX = 400` (`:543–546`). Gate:
  `tests/testthat/test-systemfonts-injection.R`.
- `skip_types` (`:559–565`) excludes every type whose **rendered** string is not
  the raw value: `pvalue`, all glyph/visual cells, and all composed types. Only
  `text` and `numeric` are systemfonts-pinned; everything else is sized by V8's
  display-text-aware `calculateSvgAutoWidths`.
- Top-K by `nchar` (`:583–589`) mirrors the TS rank-then-exact contract.

---

## 2. Height

### 2.1 The row-kind height cascade (5 layers)

`lib/layout/row-kind-heights.ts`. Resolution is
`pin ?? (rowHeight × resolveRatio(kind))`:

| layer | source | shape | code |
|---|---|---|---|
| 5 | interactive pin (drag / settings / `figureLayout.rowKindHeights`) | absolute px | `resolveRowKindHeight:180` |
| 4 | constructor `spec.rowHeights` | ratio | `resolveRowKindRatio:133` |
| 3 | theme `inputs.row_kinds.<kind>.heightRatio` | ratio | `:137` |
| 2 | inheritance (`summary → data`) | — | `KIND_INHERITANCE:57` |
| 1 | intrinsic (`spacer 0.5`, everything else `1.0`) | ratio | `INTRINSIC_KIND_RATIOS:41` |

Ratios are only honored when finite and > 0 (`isValidRatio`, `:130`) — a garbage
value falls through to the next layer rather than producing a NaN track.
`sanitizeRowKindPins` (`:159`) is the shared untrusted-wire gate: keys must be
real `RowKind`s (`panel` excluded — content-driven), values finite positive,
clamped `[8, 2000]`. Both the store hydration (`layout-zoom.svelte.ts:760`) and
the export (`svg-generator.ts:984`) run it, so both runtimes accept exactly the
same pins.

### 2.2 `computeRowLayout` — the one height function

`lib/layout/table-metrics.ts:126`. Called by both backends. Per row:

```
spacer        →  kindBase("spacer")
group_header  →  kindBase("group_header")
data/summary  →  max( wrapH, contentHeights[row.id], dataLineHeightPx )
                 where wrapH = lines > 1 ? max(base, lineH*lines + 6) : base
panel         →  max( rowHeight, markdown-line estimate, contentHeights[panel:id] )
+ rowGroupPadding on rows flagged by computeRowPaddedAfter
```

Two floors worth knowing:

- `dataLineHeightPx` (`:166`) — a WYSIWYG parity floor. When density × factor
  drops the base below the body line-height, the DOM's measure loop grows every
  row anyway; without the same floor the estimator rendered visibly tighter rows.
- `computeRowPaddedAfter` (`:94`) flags the last **data** row before a
  `depth === 0` `group_header`; that row's track carries the trailing
  `rowGroupPadding`, and `rowMarkerCenters` (`:189–193`) subtracts the pad again
  so forest markers stay centred on the *data* portion, not the inflated track.

Chrome helpers in the same file: `computeHeaderHeight:220`
(`max(themeHeaderHeight, (ceil(bodyPx×1.05×1.5)+6) × headerDepth)`),
`computeAxisHeight:292` (reserved only when a column actually renders an axis
strip), `computeScalableChromeHeight:269` (the aspect ladder's denominator).

### 2.3 The DOM measure-then-commit loop

`svelte/TabvizPlot.svelte:565–668`. One `$effect` → one `requestAnimationFrame`
→ one `store.setMeasuredRowHeights(measured, shrinkable)`.

**Dependencies** (`:568–574`): `displayRows.length`, `layout.rowHeights.length`
(reading it subscribes to the whole `layout` derived, so *any* layout change
re-arms the loop), `--tv-text-body-size`, `store.columnWidths`,
`store.expandedRows`, and `spec` itself.

**Grow metric** (`:638–641`): commit a row only when
`cell.scrollHeight > cell.clientHeight + 1` — content genuinely overflows the
pinned track. This is the **B2 fix**: for a non-overflowing cell `scrollHeight`
just echoes the track back, and for `.row-padded-after` rows the track includes
`rowGroupPadding`, so committing it re-added the pad every frame (~12 px/frame
unbounded ratchet). See `sizing-model.md §6c`.

**Shrink metric** (added 2026-07-27, `80917348`, `:593–614` + `:656–665`).
Because the grow report omits settled rows, growth was permanent: a row that
stopped needing to wrap simply went absent and kept its tall value forever.
The shrink path needs a height that does **not** depend on the pinned track:

- `naturalOf(cell)` (`:593`) = `max` over the cell's non-absolutely-positioned
  element children of `child.scrollHeight`, plus the cell's own vertical padding.
  This is track-independent **only because `.grid-cell` is
  `display:flex; align-items:center`** (`:3179`) — a centred flex item does not
  stretch to the track. A child that *did* stretch would measure ≈ the track,
  fail the margin test, and never be offered, so the failure mode is "row stays
  tall", never "row collapses".
- A row is offered for shrinking when it did **not** overflow this pass and
  `natural + SHRINK_SLACK(2) < track` (`:658–664`).
- `.row-padded-after` rows are excluded outright (`:625–628`): their track
  includes the trailing pad *and* `naturalOf` picks up the same pad from
  `.grid-cell.row-padded-after { padding-bottom: … }` (`:3514`), while
  `computeRowLayout` adds `rowGroupPadding` again — committing it would settle
  the row a whole `rowGroupPadding` too tall.
- Details panels are measured under `panelContentKey(rowId)` (`:645–655`) with
  the overflow-only rule and **no** shrink path.

**Commit semantics** — `growMergeHeights`, `layout-zoom.svelte.ts:108–143`
(pure, exported, unit-tested in `slices/grow-merge-heights.test.ts`):

```
cur = merged[k] ?? 0
committed = base.hasOwnProperty(k)
if (cur < v || (shrinkable.has(k) && committed && v < cur)) merged[k] = v
```

Returns the **same reference** when nothing changed — that identity is what
settles the measure→commit→re-measure loop (`setMeasuredRowHeights:729–731`).

**Merge into layout** — `mergeMeasuredHeights` (`layout-zoom.svelte.ts:83`)
`Math.max`-es the committed map over the estimator's `computeContentHeights`,
and the result goes in as `contentHeights` (`:532–537`). So a committed value
can only ever *raise* a row above its cascade base; it can never lower it below
`max(wrapH, dataLineHeightPx)`.

### 2.4 Aspect ladder

Pure math: `lib/layout/aspect-ladder.ts` (`resolveAspectTargets:31`,
`computeAspectLadder:110`, `minRowHeightFor:21`). The export calls it
(`svg-generator.ts:4306`). The DOM **re-implements the height half inline**
(`layout-zoom.svelte.ts:414–465`) — algebraically identical today (the DOM's
`naturalRowHeight + rowDelta/effectiveRowSlots` equals the shared
`rowHeightScale × naturalRowHeight` given `naturalPlotHeight = slots × rowHeight`),
but it is a copy, not a call. The DOM's *width* half is intentionally different:
it grows `layoutWidth` and lets `resolveFlexWidths` with `ASPECT.FLEX_CAP` absorb
the delta, rather than running Levers 1A/1B.

The ladder solves on the estimate `slots × naturalRowHeight`, not on real
post-wrap heights — see `sizing-model.md §1.6`/`§6`.

---

## 3. Units and scale conversions

Three distinct scale factors; mixing them is the classic bug here.

| factor | what it is | where |
|---|---|---|
| **rem → px** | theme sizes are rem; the browser paints at `rem × document root font-size` | `columns.svelte.ts:575–579` (rank font) and `:659–666` (`remToPx`, composed-tree sizes). Must use the **root-aware** conversion, never raw cssVars |
| **`actualScale`** | `.tabviz-scalable`'s CSS `transform: scale(…)` (zoom × fit) | `layout-zoom.svelte.ts:674`. The DOM composed-cell measure divides by it (`scaleComp`, `columns.svelte.ts:626`) so widths land in the grid's natural pre-transform space |
| **`elementScale(el)`** | measured rendered-rect ÷ layout size, composes with host-page transforms | `lib/scale-factor.ts:19`. **Every** drag delta divides by it — gestures happen inside the CSS-scaled subtree |

`scrollHeight` / `clientHeight` / `offsetHeight` are *layout* values and are
unaffected by the transform, which is why the measure loop needs no scale
compensation while the width measure does.

---

## 4. Spacing tokens, density, shell/paper

- `lib/theme/density-presets.ts:22` `DENSITY_PX` is the single source for the 15
  spacing concepts across compact/comfortable/spacious. Two projections derive
  the camelCase `SpacingTokens` shape and the `--tv-spacing-*` cssVar shape.
- `density_factor` (clamped `[0.5, 2]`) multiplies the preset in
  `theme-adapter.ts::scaleSpacing`.
- **D42 per-token overrides**: `inputs.spacing_overrides` (absolute px, sparse)
  are applied *after* `preset × factor` at the single assembly point
  `theme-adapter.ts:271–274`, so both `theme.spacing.*` object reads and the
  cssVar emitters see the same numbers. Roster + bounds + ingress guard live in
  `lib/theme/spacing-tokens.ts` (`SPACING_TOKEN_KEYS:23`,
  `SPACING_TOKEN_BOUNDS:49`, `clampSpacing:80`), R↔TS sync-gated by
  `tests/testthat/test-spacing-roster-sync.R`.
- **Shell/paper pads are deliberately NOT in `DENSITY_PX`** (`shell-paper.ts:49`,
  `SHELL_PAD_PX` 14/20/26, `PAPER_PAD_PX` 10/14/18): every `DENSITY_PX` entry
  emits its wire token unconditionally, but these are mode-gated (flush must stay
  0 — the flush-inertness contract). See `sizing-model.md §6d`.
- **Auto-fit height formula** — `TabvizPlot.svelte:1569`:
  `scaledHeight + 2×containerPadding + 2×shellPad + bottomMargin`. It matches the
  CSS at `:3031–3034` term for term. The rule (`sizing-model.md §6d`): everything
  that contributes height lives **inside** `.tabviz-scalable` and is covered by
  the ResizeObserver (`:453–460`); the shell's own padding is the only
  out-of-band term. **If you add chrome, put it inside the scalable — do not
  extend this formula.**

---

## 5. Gates

| gate | what it locks | run |
|---|---|---|
| `src/export/layout-metrics.test.ts` + `sizing-fixtures.ts` | snapshot of `computeLayoutMetrics()` (per-row height/top/marker/kind, per-column width+x, chrome dims, **spacing-token echo**) over a density/wrap/indent/spacer/group matrix + box-model invariants | `bun test src/export/layout-metrics.test.ts` |
| `src/lib/layout/table-metrics.test.ts` | the shared row/header/axis/chrome formulas | bun |
| `src/lib/layout/aspect-ladder.test.ts` | ladder fixture snapshots + floors | vitest |
| `src/stores/slices/grow-merge-heights.test.ts` | commit semantics incl. the opt-in shrink cases | bun |
| `tests/browser/measure-rows.browser.ts` | B2 ratchet (container-height stability over 2 s, max-track bound) **and** the shrink-back leg (row returns AND holds) | CI `browser-gates` |
| `tests/browser/hero-width-repro.browser.ts` | rendered TRACK + measured width on a saturated table, incl. the runtime-insert leg. **Asserts geometry, not header-cell counts** — counting is what let `6fda600f` ship | CI |
| `tests/browser/wysiwyg-diff.browser.ts --gate` | DOM-at-scale-1 vs `generateSVG` numeric geometry + typography | CI |
| `tests/browser/column-config-remeasure.browser.ts` | config edits re-measure | CI |
| `tests/testthat/test-systemfonts-injection.R` | R constants pinned to the TS source; skip_types contract | `devtools::test()` |
| `src/lib/width-utils.test.ts`, `src/schema/measure-composed.test.ts` | `offlineFallbackFamily`, bold widening, composed tree widths | bun |

Every browser gate must be listed in `.github/workflows/js-ci.yaml`'s
`browser-gates` job (lines 126–169) or it never runs.

---

## 6. Traps (pointers; full text in CLAUDE.md's ledger)

- **Measurement inputs must come from the EFFECTIVE column set, never
  `spec.columns`.** Runtime inserts / hides / spec overrides live only in
  `effectiveColumnDefs`. (`6fda600f`; and see Finding a4 below for a survivor.)
- **Counting is not measuring.** Assert rendered geometry.
- **`spec` is `$state.raw`** — every mutation goes through `setSpec`.
- **Export MEASURE ≠ export RENDER**: budget the offline fallback face
  (`offlineFallbackFamily`), and fold weight into the injected `measure` or a
  bare resolver lays out at 400 while the `<g>` paints 600.
- **Composed width = measure the render TREE**, at the size the surface paints,
  with `÷ scaleComp` + per-span bearing on the DOM only.
- **`.grid-cell` has `overflow: hidden`** — affordances overhanging a cell edge
  are clipped out of hit-testing.
- **`computeRowLayout` floors data rows at one body line-height** (estimator
  parity with the DOM measure loop).
- **Never hand-count chrome** in the auto-fit height formula.

---

## Findings

Audit of 2026-07-27. Labels are honest: CONFIRMED means reproduced or read
end-to-end in the code; SUSPECTED means the mechanism is verified but the
user-visible magnitude is not.

### (a) Possible issues / bugs

---

**a1. CONFIRMED — wrap line counts ignore an explicit column width, so
explicit-width `wrap` columns always inflate rows to the wrap cap (DOM only).**

`srcjs/src/stores/slices/columns.svelte.ts:717–725` and `:1000`.

`measureLeafColumn` **deletes** `target[col.id]` for any column with an explicit
`width` (correctly — the pin must win over a stale auto entry). The wrap-line
loop then reads

```ts
const colWidth = target[col.id] ?? AUTO_WIDTH.MIN;   // :1000
```

so an explicit-width column falls back to **60 px**, not its real width. The
export's equivalent (`svg-generator.ts:918–921`) falls through
`getEffectiveWidth` to `col.width`, so the two runtimes disagree.

*Failure scenario.* `col_text("notes", width = 400, wrap = TRUE)`:
`contentWidth = 60 − 2×cellPaddingX = 40 px`, so essentially every non-empty
cell computes ≥ 2 lines and is capped at `wrap+1`. Every row renders at the wrap
cap regardless of how wide the column actually is; `wrap = 4` produces 5-line
rows. The exported SVG renders them at one line.

*Verification.* Ran the columns-slice harness (`columns.test-harness.svelte.ts`)
with `{ width: 2000, wrap: true }` and text that measures 484 px:
`columnWidths = { label: 60 }` (no `notes` entry) and
`wrapLineCounts = { r1: 2 }`. Control with `width: "auto"`: measured 508 px and
`wrapLineCounts = {}`. Same spec through `computeLayoutMetrics`:
`rows = [24, 24]` — one line. So DOM = 2 lines, export = 1 line, at any explicit
width.

*Note.* The 2026-07-27 shrink-back fix does **not** rescue this: shrinking edits
`measuredRowHeights`, and `computeRowLayout` takes `max(wrapH, contentHeights…)`
— a wrap-driven track can never be lowered by a measured content height.

---

**a2. CONFIRMED — `growMergeHeights`' "only undo growth" guard does not hold; the
grow branch pins every never-grown row at its natural height.**

`srcjs/src/stores/slices/layout-zoom.svelte.ts:127–141`.

```ts
const cur = merged[k] ?? 0;                      // 0 for an uncommitted row
const committed = hasOwnProperty(base, k);
if (cur < v || (shrinkable?.has(k) && committed && v < cur)) { … }
```

The `committed` gate only guards the *shrink* disjunct. But the caller puts
shrink offers into the **same `measured` report** the grow branch reads
(`TabvizPlot.svelte:662`), and for a row with no prior entry `cur` defaults to
`0`, so `cur < v` fires and the natural height is committed as "growth".

*Verification.* `growMergeHeights(null, { r1: 21 }, new Set(["r1"]))` returns
`{ r1: 21 }` (run under bun against the real export). The second pass returns the
same reference, so it settles.

*Consequence.* The documented invariant in the commit message and the parameter
doc — *"A row that never grew has no business being pinned to a measured height
at all… pins the DOM to a number the export never sees and opens a DOM↔export
divergence"* — is not enforced. On the first measure pass **every** non-padded
data row whose content child is shorter than its track (i.e. essentially all of
them) acquires a `measuredRowHeights` entry.

*Practical impact today is bounded*: `computeRowLayout` takes
`max(wrapH, contentHeights[id], dataLineHeightPx)`, and a natural height that is
below the track is by construction below the base, so nothing moves. I could not
construct a case where it changes rendered geometry. The costs that are real:
the guard gives false comfort, and `measuredRowHeights` becomes an O(rows) map
rebuilt by spread on the first pass (10 k rows ⇒ a 10 k-key object).

*Fix shape.* Either gate the whole condition on `committed` for keys that arrive
via `shrinkable`, or keep the shrink offers in a separate report the grow branch
does not read.

---

**a3. CONFIRMED — the last data row of every top-level group can never shrink
back.**

`srcjs/src/svelte/TabvizPlot.svelte:625–628`.

```ts
const padded = cell.classList.contains("row-padded-after");
const nat = padded ? 0 : naturalOf(cell);
…
if (padded) delete natural[id];
```

The exclusion itself is **correct** and should not simply be removed: for a
padded row, `.grid-cell.row-padded-after` puts `rowGroupPadding` into the cell's
`padding-bottom` (`:3514`), `naturalOf` adds the cell's vertical padding
(`:608–609`), and `computeRowLayout` adds `rowGroupPadding` to the track *again*
(`table-metrics.ts:178`) — committing `naturalOf` would settle the row one whole
`rowGroupPadding` too tall (the "dwarven Δ9px" the commit message cites).

But the consequence is that these rows keep the *pre-fix* behaviour: once a
padded row grows to fit wrapped text it stays tall forever, even after the
column is widened.

*Failure scenario.* Grouped table; the last row of group A has a long note that
wraps; the user widens the notes column. Every other row returns to base height;
that one row stays tall — a visible per-group asymmetry, and the fix's own
regression gate (`measure-rows.browser.ts`) uses an ungrouped fixture for the
shrink leg so it cannot see this.

*Fix shape.* Report `naturalOf(cell) − parseFloat(paddingBottom)` for padded
rows (the pad is re-added by `computeRowLayout`), rather than excluding them.

---

**a4. CONFIRMED — header-band height is computed from the WIRE column list while
the header is *rendered* from the effective list.**

`srcjs/src/stores/slices/layout-zoom.svelte.ts:332`
(`anyForestColumnGroups(spec.columns) ? 2 : 1`) versus
`srcjs/src/svelte/TabvizPlot.svelte:866–868`
(`headerDepth = 1 + getMaxGroupDepth(allColumnDefs)`).

`6fda600f`'s audit recorded this site as *"Checked and CLEARED: … hide never
removes a group"*. It does: `applyColumnEdits` (`columns.svelte.ts:220–224`)
tests `hiddenColumnIds.has(def.id)` on **group** defs too.

*Verification.* Columns-slice harness: `allColumnDefs` goes from
`["a", "g:group"]` to `["a"]` after `hideColumn("g")`.

*Failure scenario.* `hide_column("group_efficacy")` (Shiny proxy, the column
context menu, or `initialState.hiddenColumns`). `layout.headerHeight` stays at
`max(34, 29×2) = 58`, while `effectiveHeaderDepth` becomes 1, and
`gridTemplateRows` (`TabvizPlot.svelte:1146–1155`) emits
`Array(1).fill(headerHeight / headerDepth)` = one **58 px** header row instead of
34 px. The export (`svg-generator.ts:754–761`) also reads the wire, so it agrees
with the wrong number rather than with the render.

*Related, lower priority.* `getMaxGroupDepth` supports arbitrary nesting, but
both height computations are a binary 1-or-2. R's `col_group` rejects nested
groups (`R/classes-components.R:2160–2166`), so this is currently unreachable
from R; a TS author who nests groups gets three header rows squeezed into a
two-row band.

---

**a5. SUSPECTED — composed cells are measured with proportional digits while the
export paints tabular figures, with no compensation on the export path.**

`srcjs/src/export/svg-generator.ts:4637` emits, for the whole document:

```
text { font-variant-numeric: tabular-nums; }
```

Neither `measure-composed.ts:122` (the rank key) nor either caller's resolver
runs `tabularizeDigits`. `tabularizeDigits` is applied at exactly two sites, both
on the **flat** path (`columns.svelte.ts:631`, `svg-generator.ts:538`).

CLAUDE.md's ledger says composed cells "use `COMPOSED_SPAN_BEARING`" instead —
that holds for the DOM (`columns.svelte.ts:683`, ~1.5 px/span), but the export's
composed resolver (`svg-generator.ts:513–521`) adds **neither** tabularization
nor a bearing, on the argument that `renderNodeToSvg` measures with the same
estimator it paints with. That argument breaks precisely on tnum: the layout is
self-consistent, but the *painted* digits are wider than the advances the layout
used, so spans creep together and the column budget is short.

Interval / CI columns are the most digit-dense cell type in the package, and this
is the same family as the hero overall-summary overlap already fixed along the
family/weight axis. Magnitude unmeasured: ~0.9 px/digit × digits per span,
so a `1.23 (0.98–1.55)` cell is plausibly 8–12 px short. (Whether librsvg honours
`font-variant-numeric` at all is unverified — a browser viewing the exported SVG
certainly does.)

---

**a6. SUSPECTED — the R systemfonts injection measures every cell at normal
weight and with the theme's primary family, then hard-pins the result.**

`R/save_plot.R:626` — `cell_w <- shape_max(vals, bold = FALSE, sz = size_px)`.
Only the *header* is measured bold (`:620–622`).

Both TS paths measure bold rows separately: `columns.svelte.ts:757–762` splits
bold candidates onto the 600-weight key, and `svg-generator.ts:540–545` measures
them at `BOLD_CELL_WEIGHT` **and** with `offlineFallbackFamily`. R does neither —
it measures with `family` = the theme's primary name (`:497`), so if the webfont
is not installed systemfonts silently shapes with the OS default (a sans face)
while the rasterizer substitutes whatever the stack resolves to.

Because the injected value becomes `col@width` — a **hard pin** that
`calculateSvgAutoWidths` explicitly refuses to grow — there is no downstream
rescue. A `row_bold` / summary row in a `text` or `numeric` column
(the only two types still injected after the `skip_types` fix) would be
under-budgeted by roughly the bold widening (~15 % on Georgia-class faces) and
clip in `save_plot()` output while looking fine in the widget.

The same function also never tabularizes digits, and `numeric` is exactly the
column type that paints tabular figures — see a5.

`tests/testthat/test-systemfonts-injection.R` pins the four constants and the
skip-type contract; it does not exercise a bold row.

### (b) Brittle or problematic logic

**b1. The shrink metric's correctness is load-bearing on one CSS declaration.**
`naturalOf` is only track-independent because `.grid-cell` is
`display:flex; align-items:center` (`TabvizPlot.svelte:3178–3179`). Change that
to `stretch` (or add `align-self: stretch` on the content child) and every
content child measures ≈ the track — reviving the B2 metric, this time in a
merge that is allowed to *lower* heights. Nothing asserts the invariant: the
unit tests exercise `growMergeHeights` in isolation and the browser gate only
checks the end-to-end outcome on one fixture. Worth an explicit comment at the
CSS site and/or a browser assertion that a cell's content child is shorter than
its track on a non-wrapping row.

**b2. `getComputedStyle` in the per-cell measure loop.** `naturalOf`
(`TabvizPlot.svelte:596–609`) calls `getComputedStyle` once per element child
*and* once per cell, for every `[data-row-id]` cell, inside a `requestAnimation
Frame` that re-arms on `store.columnWidths`. `previewColumnWidth` mutates
`columnWidths` on every `pointermove`, so a column drag on a 500-row × 8-column
table performs ~8 000 style-declaration constructions per frame. The padding
term it computes is identical for every `.grid-cell` and is `0` today (see c2),
so it could be hoisted out of the loop entirely.

**b3. The DOM aspect ladder is an inline copy.**
`layout-zoom.svelte.ts:414–465` re-implements the height branch of
`computeAspectLadder` and the `minRowHeightFor` formula, while
`lib/layout/aspect-ladder.ts` exists specifically to be the shared version and
the export calls it (`svg-generator.ts:4306`). The two agree algebraically today
(I checked the grow and shrink branches term by term), but this is the exact
duplication `sizing-model.md §6`'s acceptance criterion forbids: *"changing
aspect behavior must touch only the post-pass"*.

**b4. `hideColumn` does not re-measure.** `columns.svelte.ts:404–412` is the only
column mutator that skips `measureAutoColumns()` (insert `:401`, update `:438`,
hydrate `:541` all call it). Hiding a leaf inside a column group leaves the
group-header width expansion (`processColumn:781–795`) computed against the old
child set, so the surviving children keep surplus width they no longer need. It
also leaves stale entries in `columnWidths` for hidden ids (harmless — every
consumer iterates `allColumns`).

**b5. Details panels are grow-only.** The panel measure
(`TabvizPlot.svelte:645–655`) uses the overflow-only rule with no shrink
counterpart, so a panel that grew to fit wrapped markdown at a narrow width keeps
that height after the widget is widened — the pre-`80917348` bug, still live for
`panel` rows.

**b6. `.plot-cell` carries `row-padded-after` but no `data-row-id`**
(`TabvizPlot.svelte:2087–2101`), so viz cells are invisible to the measure loop.
That is correct today (they are empty and the SVG overlays them), but it means
the `padded` classification the loop reads comes only from the primary and
regular cells. If a future row type renders content into the plot cell, its
height will not be measured.

### (c) Poorly-written or redundant code

**c1. `mergeMeasuredHeights`' doc contradicts its code.**
`layout-zoom.svelte.ts:78–94`: the docstring says *"Measured wins when present"*,
but the body is `out[id] = Math.max(out[id] ?? 0, m)` — the estimator wins
whenever it is larger. That distinction matters (it is why a shrink can never
drop a row below its predicted content height) and the doc actively misleads.

**c2. The shrink metric's cell-padding term is a no-op on every row it runs on.**
`naturalOf` adds `paddingTop + paddingBottom` (`TabvizPlot.svelte:608–609`) and
the commit message calls this "guard 2". `.grid-cell` declares
`padding: 0 var(--tv-spacing-cell-padding-x)` (`:3173`) — vertical padding is
zero — and the one selector that adds vertical padding
(`.grid-cell.row-padded-after`, `:3514`) is excluded from `naturalOf` entirely.
So the term costs a `getComputedStyle` per cell and can never be non-zero as the
code stands. (It becomes load-bearing if a3 is fixed by subtracting the pad.)

**c3. Redundant lookup in the export's wrap loop.** `svg-generator.ts:920`:
`autoWidths.get(col.id) ?? getEffectiveWidth(col, autoWidths)` — and
`getEffectiveWidth` (`:678–685`) begins with `autoWidths.get(col.id)`. The chain
is just `autoWidths.get(id) ?? col.width ?? AUTO_WIDTH.MIN`.

**c4. Two `getEffectiveWidth` functions in one file** with identical bodies:
`svg-generator.ts:601` (closure inside `expandColumnGroupWidths`, closes over
`widths`) and `:678` (module-level, takes the map). One should call the other.

**c5. `indentPerLevel` is read two ways in the export.** `svg-generator.ts:403`,
`:1861`, `:4070` read `--tv-spacing-indent-per-level`; `:3269` reads
`theme.rowGroup?.indentPerLevel`. They are the same number today only because
`theme-adapter.ts:299` assigns `rowGroup.indentPerLevel = spacing.indentPerLevel`.
`sizing-model.md §1.2` records this token as historically triple-sourced; two
sources survive.

**c6. `--tv-spacing-cell-padding-y` is emitted but effectively unconsumed.**
Pinned at `consumer-bridge.ts:224`, always `0` in `DENSITY_PX`, and read by
exactly one renderer — `schema/columns/heatmap-svg-renderer.ts:113`, with a
fallback of `2` that can never fire because the token is always emitted. The DOM
`.grid-cell` applies no vertical padding at all, so the export's heatmap inset
has no DOM twin. It is also in `SPACING_TOKEN_KEYS`, i.e. exposed as a user-
editable override that changes nothing in the DOM.

**c7. `void userResizedIds;` at `layout-zoom.svelte.ts:578`** with a comment
explaining that the layout does not use it and the read exists to keep a
dependency edge live. `flexSpecs` already reads `userResizedIds.has(c.id)` at
`:479`, so the edge is live regardless — this is dead.

**c8. `AUTO_WIDTH.PADDING: 32`** (`rendering-constants.ts:319`) is documented in
place as "Legacy padding constant — only used for VISUAL_MIN defaults", i.e. it
is a comment-only input to hand-written constants below it, not a value anything
reads.

**c9. R and TS rank width candidates by different keys.** `save_plot.R:583–589`
ranks by `nchar` with `TOP_K = 16`; TS ranks by `estimateTextWidth` with
`DEFAULT_TOP_K = 3`. The R comment acknowledges `nchar` is "an imperfect proxy
for a proportional font" and compensates with a larger K. It works, but the two
implementations of "rank then exact-measure the top-K" have drifted in both the
key and the constant.

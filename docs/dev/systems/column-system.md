# The column system

Audit + reference, 2026-07-27. Written for an agent who has never opened this
code. Everything below was read at the cited line; nothing is inferred from a
name. Sibling docs: `docs/dev/multi-flex-columns.md` (the width distribution
math), `docs/dev/column-ontology-review.md`, `docs/dev/sizing-model.md`,
`docs/dev/r-ts-parity-notes.md`, `srcjs/src/schema/ARCHITECTURE.md`.

---

## 1. The one thing to know first

There are **two column lists**, and confusing them is this subsystem's entire
bug history:

| | what it is | where |
|---|---|---|
| **wire list** | `spec.columns` + the separate `spec.labelColumn` slot. What the author (R or TS) serialized. Immutable during a session. | `WebSpec` |
| **effective list** | wire list, **plus** the label column materialized into position 0, **plus** runtime inserts, **minus** runtime hides, **with** runtime configure-overrides substituted and runtime reorder applied. | `columns.svelte.ts:238` `effectiveColumnDefs` → `:275` `allColumns` |

Anything that answers *"which columns does the user see right now?"* must read
the effective list. Three sites read the wire list when they needed the
effective one and shipped three separate user-visible bugs on 2026-07-27
(commits `6624fb9e`, `6fda600f`): the width-measure loop (inserted column
rendered 0px wide), `columnSummaries` (inserted bar/heatmap columns painted
every bar at 100%), and the sort-key lookup (inserted columns lost their
type's `sortKey`). §Findings (a) lists the sites that are *still* on the wrong
list.

The wire list is the correct read in exactly three situations: (1) you are the
export pipeline operating on a spec that already had runtime state baked into
it (`exportSpec`), (2) you are reconciling incoming spec state against
surviving session state (`hydrateForSpec`), (3) you are emitting authoring
source, where ops replay the edits separately (`SourceModal`).

---

## 2. Data model

### 2.1 Wire shapes

```ts
ColumnDef = ColumnSpec | ColumnGroup            // types/index.ts:552, :588
ColumnSpec { id, field, type, width?: number|"auto"|null, align?, headerAlign?,
             header?, showHeader?, wrap?, sortable?, flex?: boolean|number,
             options?: { [bucket]: {...} }, styleMapping?, ... }
ColumnGroup { id, header, isGroup: true, columns: ColumnDef[] }   // may nest
```

- **`options` is namespaced by the column's own type key**: a `pvalue` column's
  knobs live at `options.pvalue.*`. `column-defaults.ts:128` and
  `compileColumn` both depend on that.
- **`spec.labelColumn`** is a *separate top-level slot*, not a member of
  `spec.columns` (`R/utils-serialize.R:27`, `authoring/tabviz.ts:331-394`).
  Runtime contract: always a leaf `ColumnSpec` or null, never a group
  (`lib/source-emit.ts:161-168`). Legacy wires (< 0.34.2) instead put a column
  with `id === "label"` at `columns[0]`; both shapes render identically
  (`columns.svelte.ts:241-247`).
- **Nested groups** are an authoring-supported shape on the TS side
  (`authoring/columns.ts:731` — *"Child columns or nested groups"*) and are
  **not** authorable from R (`R/classes-components.R:2160-2163` rejects
  non-`ColumnSpec` children). The renderer recurses (`TabvizPlot.svelte:896`);
  the runtime edit layer does **not** (§Findings b1).
- **Reserved ids**: `__root__`, `__start__` — the DnD root-scope key and the
  insert-at-front anchor. Enforced R-side by the `ColumnSpec`/`ColumnGroup`
  validators (`R/classes-components.R:178-183`) and mirrored TS-side at
  `columns.svelte.ts:77`. **This pair is not covered by an automated R↔TS
  sync gate** (unlike the glyph / interaction-flag rosters).

### 2.2 Schemas (the type registry)

`srcjs/src/schema/columns/` is the per-type metadata registry. One file per
type; all wired into `SCHEMA_REGISTRY` (`schema/columns/index.ts:61`).

- A schema declares `key`, `inherits` (string **or** string[] — a DAG, walked
  as a stack at `column-defaults.ts:63-77`), `type`, `bucket`, `category`,
  `slots`, `options[]`, `variants?`, `flexWeight?`, `naturalWidthPx?`.
- Every `OptionSpec` carries `kind: "core" | "styling" | "presentation"` and
  `consumedBy: string[]`. **The drift gate** (`schema/columns/drift.test.ts`)
  fails any option with an empty/missing `consumedBy`, against a frozen
  behavior vocabulary. The grandfather list is **empty** (D11) — new options
  must annotate.
- Behaviors (`emitSource`, `sortKey`, `estimateWidth`, `formatValue`,
  `renderCell`, `naturalHeight`, `contributeBanks`, `contributeConditions`,
  `aggregate`) are registered separately in `*-behaviors.ts` /
  `*-renderer.ts` modules. **Registration is split across two boots**:
  `schema/init.ts` (pure, V8-safe) and `init-dom.ts` (+Svelte). A renderer
  registered only from the Svelte boot silently text-degrades every headless
  export — gate: `schema/boot-coverage.test.ts`.
- `NUMERIC_COLUMN_TYPES` (`schema/columns/index.ts:55`) is a hand-maintained
  Set that currently matches exactly the eight schemas declaring
  `category: "numeric"`; nothing enforces that (§Findings c2). It drives the
  `.numeric-cell` class → `--tv-text-numeric-family` /
  `--tv-text-numeric-figures` (`TabvizPlot.svelte:2114, :3338-3341`) and the
  filter-kind predicate (`sort-filter.svelte.ts:211`).

### 2.3 Theme house-style: `theme.column_defaults`

`lib/theme/column-defaults.ts`. A theme declares per-column-**type** default
options; they merge **under** each column's own options at spec ingest.
Three hard rules, all enforced in `applyThemeColumnDefaults:113-183`:

1. **author wins** — applies only when the column is still at the *schema*
   default (`:151`);
2. **kind gate** — only `styling` / `presentation` options; undeclared kind is
   treated as `core` and dropped (`:133`);
3. **XSS grammar** — every string leaf must pass `isValidPinValue`, because a
   theme wire is untrusted and several styling options reach `fill=` raw
   (`:88-96`, `:143`).

Variant *selection* is merged specially (`:169-179`) because `variant` is not a
declared `OptionSpec`. A theme **switch** first re-bases the outgoing theme's
bake (`rebaseThemeColumnDefaults:205`) so the old house style doesn't stick.

Two structural gaps: it does not recurse into `ColumnGroup`s and it never sees
`spec.labelColumn` (§Findings a3).

---

## 3. Lifecycle: spec → rendered track

```
  R  serialize_spec()            TS  tabviz()/colX()
  R/utils-serialize.R:490            authoring/columns.ts
            \                        /
             \                      /
              v                    v
        ┌──────────── WebSpec wire ────────────┐
        │  columns[]  +  labelColumn  +  theme │
        └───────────────────┬──────────────────┘
                            │
        ┌───────────────────┴─────────────────────────────┐
        │  DOM path                       Export path      │
        │  store.setSpec()                generateSVG()    │
        │  tabvizStore:397                svg-generator:4505│
        │                                                  │
        │  rebaseSpecForThemeSwitch  ..    validateSpec     │
        │  applyThemeColumnDefaults  ..    normalizeLabelColumn  <-- label
        │  compileVariants           ..    applyThemeColumnDefaults   folded
        │  columns.hydrateForSpec()  ..    compileVariants        into columns[]
        │  columns.measureAutoColumns()..  applyFigureLayoutColumnOrder
        └──────────────────────────────────────────────────┘
                            │
        ┌───────────────────┴────────────────────────────┐
        │ effectiveColumnDefs  (columns.svelte.ts:238)   │
        │   [labelColumn, ...spec.columns]               │
        │     → applyColumnEdits  (hide/insert/configure)│
        │     → applyColumnOrder  (top level)            │
        │     → per-group applyColumnEdits + order       │
        │     → orphan net (anchorless inserts appended) │
        └───────────────────┬────────────────────────────┘
                            │ flattenAllColumns
                            v
                    allColumns : ColumnSpec[]
                            │
        ┌───────────────────┼──────────────────────────────┐
        v                   v                              v
  doMeasurement       resolveFlexWidths              headerCells
  (columnWidths)      (layout.flexWidths)            (TabvizPlot:892)
        └──────────┬────────┘                              │
                   v                                       v
             getColWidth()  ───────────► gridTemplateColumns / grid tracks
             TabvizPlot:988
```

**Note the ordering asymmetry**: the export folds `labelColumn` into `columns`
*first* (`svg-generator.ts:4512`), so the label column receives
`applyThemeColumnDefaults` and `compileVariants`. The DOM applies both to
`spec.columns` only (`tabvizStore.svelte.ts:409` →
`column-defaults.ts:250`, `variant-compile.ts:115`) and materializes the label
column later, inside the store's derived. See §Findings a3.

### 3.1 `applyColumnEdits` (`columns.svelte.ts:206`)

Walks the **original** def list (not a hide-filtered copy) and for each def:
emits the configure-override if any, skips it if hidden, then emits every
insert anchored to it. Walking the original list is load-bearing: **a hidden
anchor still positions its inserts** (`:225-231`) — the pre-`6624fb9e` code
filtered first and silently deleted the user's inserted column when they hid
its anchor. Root-level only, `"__start__"` is emitted first (`:219`). Inserted
columns honor `hiddenColumnIds` themselves (`:213`).

### 3.2 The orphan net (`columns.svelte.ts:262-272`)

An insert whose anchor is nowhere in the tree is appended at the end rather
than dropped. Rationale recorded in the commit: *a column in a surprising
position is recoverable, an invisible one is not.*

---

## 4. Mutable state and its owners

All column state lives in **one** slice: `stores/slices/columns.svelte.ts`.
Nothing else may write it.

| state | rune | written by | survives `setSpec`? |
|---|---|---|---|
| `columnWidths: Record<id, px>` | `$state` (mutated in place — `:169-174` explains why) | `doMeasurement`, `setColumnWidth`, `previewColumnWidth`, `cancelPreviewColumnWidth`, `resetColumnWidth` | only for user-resized ids (`:1058-1066`) |
| `userResizedIds: Set<id>` | `$state.raw` | width setters; also **set by `figureLayout.columnWidths` hydration** (`:1082`) — a wire pin counts as a deliberate resize | yes, filtered by `validIds` |
| `userInsertedColumns: {afterId, def}[]` | `$state.raw` | `insertColumn` | **no** — wiped at `:1110` |
| `hiddenColumnIds: Set<id>` | `$state.raw` | `hideColumn` | yes, filtered by `validIds` |
| `columnSpecOverrides: Record<id, ColumnSpec>` | `$state.raw` | `updateColumn` | **no** — wiped at `:1111` |
| `columnOrderOverrides: {topLevel, byGroup}` | `$state.raw` | `moveColumnItem` | yes, wholesale (`applyColumnOrder` is tolerant) |

Adjacent state owned elsewhere but column-keyed:
`axis.axisZooms` (axis slice), `cells.wrapLineCounts` (written *by*
`doMeasurement` through the `setWrapLineCounts` dep, `:1031`),
`layout.flexWidths` (layout-zoom, derived).

**Persistence tier**: user-resized widths + reorder are FIGURE state — they
serialize into `spec.figureLayout` (`tabvizStore.svelte.ts:635-654`) and ride
the export spec. Auto-measured widths are session-only and never serialized.
Hides and inserts ride **nothing** — they exist only in the live store (and in
the op log for "View source").

---

## 5. Width resolution — the part that breaks

Three layers, in order.

### 5.1 `doMeasurement` (`columns.svelte.ts:608-1033`)

Rank-then-exact: `rankTopK` scores every candidate with the pure-JS estimator,
then `measureExact` Canvas-measures the top K (`:639-652`). In V8 there is no
Canvas, so `measureExact` returns null and the estimator is the answer.

Per leaf (`measureLeafColumn:701`):
- user-resized → return, untouched (`:702`);
- numeric `col.width` → **delete** any measured entry and return (`:717-720`).
  Deleting is essential: the render priority is measured-map > `col.width`, so
  a stale auto entry would shadow a newly-pinned width;
- else max over (header at the header font key) and (cells). Composed cells
  (interval / variant / custom) route through `measureComposedColumnWidth`
  which measures the actual **render tree**, not the flat string (`:748`);
  plain columns take the flat path with bold rows measured at the bold key;
- `+ glyphNaturalWidth` for glyph columns, `+ cellPadding + RENDERING_BUFFER`,
  clamped to `[VISUAL_MIN[type] ?? AUTO_WIDTH.MIN, AUTO_WIDTH.MAX]`.

Group headers get a second pass (`processColumn:775`): if the group header is
wider than the sum of its leaves, the excess is spread evenly over the
*resizable* leaves (`:789-794`).

The **primary column** (`allColumns[0]`) gets a richer pass (`:822-976`) the
generic loop skips: per-row indent (`--tv-spacing-indent-per-level`), badge
width, and every group-header label + chevron + optional `(n)` count
(`showGroupCounts` read through `resolveInteraction`, never raw — `:936`).

The loop that drives all of this iterates `effectiveColumnDefs` and skips
`spec.labelColumn?.id` because the primary pass covers it (`:816-820`). That
skip is index-blind — see §Findings a2.

Finally, wrap-line counts are computed post-width and pushed to the cells
slice, with a shallow-diff short-circuit (`:1023-1031`).

`measureAutoColumns` (`:567`) wraps `doMeasurement` and re-runs it on
`document.fonts.ready` *and* on every `loadingdone` for 15s — because
`fonts.ready` can resolve before the theme's webfont `<link>` is even injected
(`:596-604`).

**Who triggers a measure**: `setSpec` (`tabvizStore:488`), `resetState`
(`:623`), `insertColumn` (`columns:401`), `updateColumn` (`:438`),
`resetColumnWidth` (`:541`), and every theme/density write in the theme slice
(`theme.svelte.ts:254, 335, 508, 600, 708`, each preceded by
`clearAutoWidthsKeepingUserResizes`). **Nobody** re-measures on `hideColumn`,
`moveColumnItem`, or a cell edit.

### 5.2 Flex distribution (`layout-zoom.svelte.ts:475-520`)

`allColumns` → `toColumnWidthSpec` (`lib/layout/flex-weights.ts:50`) →
`resolveFlexWidths` (`lib/layout/flex-distribute.ts:141`).

```
naturalWidth = explicit ?? measured ?? schema naturalWidthPx ?? fallback(100)
minWidth     = measured ?? undefined      // ← undefined becomes a 0 floor
weight       = pinned ? 0 : flexWeight × natural
```

**This is the 0px mechanism.** A column with no entry in `columnWidths` gets
`min = 0` (`flex-distribute.ts:146`), so a width-saturated table can shrink it
to nothing. A column that *is* measured can never be shrunk below its content.
That is why the docs hero collapsed an inserted column while a narrow test
table looked fine.

Growth requires an absorber (D19, `layout-zoom.svelte.ts:494-502`): with no
flex column and no pinned aspect, the distribution is skipped entirely and
only explicit pins land in `flexWidths`; every other column renders
`max-content` via `getColWidth` (`TabvizPlot.svelte:988-995`). So the *same*
missing-measure defect is invisible on a plain table and fatal on a forest
table.

### 5.3 Render

`getColWidth` / `effectiveColumnWidth` / `effectiveVizWidth`
(`TabvizPlot.svelte:951-995`) all use the same priority
`flexWidths > columnWidths > col.width > fallback`. Keep them in step; they
feed `grid-template-columns`, the drag math, and the d3 plot ranges
respectively.

The export has its own measure (`svg-generator.ts:calculateSvgAutoWidths`,
`:394-565`) and its own `expandColumnGroupWidths` (`:562`), deliberately
mirroring §5.1 — but WYSIWYG in production comes from **pinning**: the browser
download passes the live `columnWidths` through `getExportDimensions`
(`tabvizStore.svelte.ts:1113-1131`). The from-scratch export path is only
exercised by `save_plot()` and `wysiwyg-diff.browser.ts`, where the two flex
paths legitimately diverge past the container (D32).

---

## 6. Seams other systems attach to

| consumer | reads | file |
|---|---|---|
| header tree / grid | `allColumnDefs`, `headerDepth = 1 + getMaxGroupDepth` | `TabvizPlot.svelte:866, 892-932` |
| sort | `getAllColumns()` for the type's `sortKey`, wire fallback for hidden columns | `sort-filter.svelte.ts:122-125` |
| filters | `getAllColumns().find(c => c.field === field)` | `sort-filter.svelte.ts:205` |
| bar/heatmap domains | `store.allColumns` | `TabvizPlot.svelte:138-160` |
| axis / forest scale | `forestColumns` / `vizColumns` (both derived off `allColumns`) | `columns.svelte.ts:286-313` |
| banks (footnotes/axes/legends/conditions) | `spec.columns` ← **wire** | `schema/banks.ts:171` |
| forest legend | `spec.columns` ← **wire** | `lib/legend.ts:37` |
| header layout height | `spec.columns` ← **wire** | `layout-zoom.svelte.ts:332` |
| export spec | `effectiveColumnDefs` (+ `figureLayout`) | `tabvizStore.svelte.ts:768` |
| "View source" | `spec.columns` + op log replay (correct by design) | `lib/source-emit.ts:179`, `SourceModal.svelte:117` |
| split shared widths | `leafColumns(spec.columns)` per pane | `splitTabvizStore.svelte.ts:160, 239, 248` |
| Shiny proxy | `insertColumn` / `hideColumn` / `updateColumn` normalizers | `spec/proxy-args.ts:92, 293`, `htmlwidgets/index.svelte.ts:97` |
| initial state | `initialState.hiddenColumns → hideColumn` | `core/createTabviz.ts:180` |

---

## 7. Invariants

1. **One writer.** Only the columns slice mutates column state; everything else
   reads derived getters.
2. **`spec` is `$state.raw`.** Any column mutation must go through `setSpec`
   or a slice assignment; deep mutation of `spec.columns` is invisible.
3. **A hidden anchor still positions its inserts** (`:225`).
4. **An insert is never silently dropped** — orphan net (`:262`).
5. **Numeric `col.width` is a hard pin**, and pinning deletes the measured
   entry (`:717`). Kept in lockstep with `calculateSvgAutoWidths`.
6. **A measured column can never be flex-shrunk below its content**
   (`minWidth = measured`). Corollary: an *unmeasured* column has no floor.
7. **Every `previewColumnWidth` gesture must end in `setColumnWidth` or
   `cancelPreviewColumnWidth`** — preview sets the user-resized pin on tick 1,
   so an abandoned gesture leaks a permanent pin (`:490-496`).
8. **Column ids are unique across the whole tree** — `mintUniqueColumnId`
   (`:368`) unions spec ids + inserts + hides + overrides + width keys + axis
   zooms + resized ids + `RESERVED_COLUMN_IDS`.
9. **`applyColumnOrder` is tolerant** — unknown ids dropped, unlisted columns
   appended in original order (`lib/column-order.ts:22-27`). Stale reorder
   entries are inert, which is why they carry over a data update wholesale.
10. **`options` is namespaced by column type.** A merge or edit that writes
    `options.<k>` outside `options[col.type]` will not be read.

---

## 8. Testing this subsystem

- `srcjs/src/stores/slices/columns.runes.ts` — **vitest** (34 tests). The
  harness for edits, hides, inserts, anchors, orphans. Add here.
- `srcjs/src/schema/columns/drift.test.ts` — `consumedBy` gate (bun).
- `srcjs/src/lib/theme/column-defaults.test.ts`, `lib/layout/flex-*.test.ts`,
  `schema/columns/width-behaviors.test.ts`, `schema/measure-composed` tests.
- `srcjs/src/export/layout-metrics.test.ts` — the box-model snapshot gate
  (per-column width + x).
- Browser: `tests/browser/interaction-qa.browser.ts` (sort/insert/edit with
  real input), `glyph-cell-parity.browser.ts`, `wysiwyg-diff.browser.ts`,
  `hero-width-repro`.
- R: `tests/testthat/test-parity-columns.R`, `test-parity-split-shared.R`,
  `test-systemfonts-injection.R`.

**Runner split**: `*.test.ts` = bun, `*.runes.ts` = vitest, a `.vitest.ts` runs
under neither. bun cannot resolve `@stdlib`, so anything needing a real
resolved theme must be a `.runes.ts` or use a stub.

**Counting is not measuring.** A probe that counted `.header-cell` nodes
reported "insert works" for a week while the column rendered at 0px. Assert
geometry (`getBoundingClientRect`, the grid template, or the SVG `x=`).

---

## Findings

Verification method for each is stated inline. Probes were run with
`bun run` against the real modules (`generateSVG`,
`applyThemeColumnDefaultsToSpec`) from a scratch file outside the repo; no
source was modified. Baseline: `columns.runes.ts` 34/34, `drift.test.ts` +
`column-defaults.test.ts` + `flex-weights.test.ts` 34/34 green.

### (a) Possible issues / bugs

---

**a1 — CONFIRMED — A hidden label column reappears in the SVG/PNG download.**
`tabvizStore.svelte.ts:766-768` + `export/svg-generator.ts:3895-3903, 4512`

`exportSpec` overwrites `columns` with `effectiveColumnDefs` (which already has
the label column materialized at index 0, or *removed* if the user hid it) but
spreads `...spec` first, so **`labelColumn` is still set on the exported
object**. `generateSVG` then runs `normalizeLabelColumn`, which prepends
`spec.labelColumn` to `columns` again.

Failure scenario: right-click the label column's header → Hide (the affordance
exists — every header cell wires `oncontextmenu` to `openHeaderContextMenu`,
`TabvizPlot.svelte:1781, 1835`, and `canHide` only requires
`allColumns.length > 1`, `TabvizOverlays.svelte:83`). Also reachable
non-interactively via `tabviz(initial_hidden_columns = "label")`
(`core/createTabviz.ts:180`) and the Shiny `hideColumn` proxy. The widget drops
the column; SVG/PNG export still draws it, in position 0.

*Verified*: probe against real `generateSVG`.
`{labelColumn: L, columns: [N]}` (the exact shape `exportSpec` emits after a
hide) renders `StudyHDR` at `x=22` — the label column is present and first.
The duplicate case `{labelColumn: L, columns: [L, N]}` (the no-hide shape) is
*accidentally* harmless: `generateSVG:4547` filters by
`c.id !== primaryColFull?.id`, which removes both copies of the id. A reorder
is also fine — `figureLayout.columnOrder` is re-applied at `:4525` and the
dedupe in `applyColumnOrder` collapses the duplicate (probe confirmed:
`StudyHDR x=121`, `NHDR x=22`). Only the hide case escapes.

Fix shape: `exportSpec` should emit `labelColumn: null` alongside
`columns: effectiveColumnDefs` (it has already folded it in), or
`normalizeLabelColumn` should skip when the id is already present.

---

**a2 — CONFIRMED — Reordering the label column away from position 0 leaves it
unmeasured; the primary-column chrome budget follows the wrong column.**
`columns.svelte.ts:816-820` and `:823`

```ts
const labelSlotId = spec.labelColumn?.id;
for (const colDef of effectiveColumnDefs) {
  if (labelSlotId && colDef.id === labelSlotId) continue;   // skip, always
  processColumn(colDef);
}
const primaryCol = allColumns[0];                            // index-based
```

The skip is keyed on **identity**; the compensating pass is keyed on
**index 0**. They agree only while the label column is first. Every header
cell carries a `ColumnDragHandle` when `enableReorderColumns`
(`TabvizPlot.svelte:1851`), which is ON by default under the maximal-defaults
ruling, and `moveColumnItem` operates on `effectiveColumnDefs` — which includes
the label column. So dragging it to position 2 is a two-click gesture.

After that: the label column is skipped by the loop **and** not covered by the
primary pass, so `columnWidths[labelId]` is never written again. It survives
stale until the next `clearAutoWidthsKeepingUserResizes` — i.e. until any
theme, density, font, or spacing edit (`theme.svelte.ts:254, 335, 508, 600,
708`) or a `setSpec` data update. Then it has **no** measured entry, and by §5.2
its flex `minWidth` is `0` while its `naturalWidth` falls back to
`DEFAULT_COLUMN_WIDTH = 100` — the identical mechanism that produced the
`6fda600f` 0px column. Meanwhile whatever column *is* first absorbs the indent
/ badge / group-header-label budget, over-widening it.

Second-order: `moveColumnItem` (`:337-360`) never calls `measureAutoColumns`,
so even the correct half of the budget doesn't move until some other event
triggers a measure.

*Verified*: by inspection of the two cited lines — the control flow is
unconditional and unambiguous. Not reproduced in a browser.

---

**a3 — CONFIRMED — `theme.column_defaults` never reach grouped columns, and
reach the label column in the export but not in the DOM.**
`lib/theme/column-defaults.ts:118-123, 250` and `tabvizStore.svelte.ts:409`
vs `svg-generator.ts:4512-4520`

`applyThemeColumnDefaults` does `columns.map(col => { if (typeof col.type !==
"string") return col; ... })`. A `ColumnGroup` has no `type`, so it is returned
untouched **and its children are never visited** — there is no recursion.
Identical omission in `rebaseThemeColumnDefaults:210-215`, so the theme-switch
re-base is also blind to grouped columns.

Separately, the DOM applies the merge to `spec.columns` only; the export
normalizes `labelColumn` into `columns` *before* the merge. So a theme
declaring `column_defaults.text.wrap = true` (a `presentation` option,
`schema/columns/text.ts:26-33`) wraps the label column in `save_plot()` output
and not in the widget.

*Verified*: probe. Spec with a top-level `pvalue` column and one nested inside
a group, theme `column_defaults.pvalue.stars = true`:

```
top-level pvalue   : {"stars":true}
group-nested pvalue: null
```

The label-column half is verified by the call ordering at the cited lines
(`normalizeLabelColumn` at `4512`, `applyThemeColumnDefaultsToSpec` at `4519`,
vs `tabvizStore:409` operating on `spec.columns`). Same argument applies to
`compileVariants` (`variant-compile.ts:115` reads `spec.columns`) — a
variant-bearing label column is compiled in the export and not in the DOM.

---

**a4 — CONFIRMED — `computeEffectiveBanks` and `resolveForestLegend` walk the
wire list in the DOM; the export walks the effective one.**
`TabvizPlot.svelte:168` (`computeEffectiveBanks(spec)`), `:291`
(`resolveForestLegend(spec, …)`); `schema/banks.ts:171`, `lib/legend.ts:37`;
export at `svg-generator.ts:5253` and `:1701`, where `spec` is the *exportSpec*
whose `columns` is already effective.

Same class as the three fixed sites. Concretely:
- hide a multi-effect forest column → the DOM keeps rendering its legend
  (`legendEntries` never re-derives from the effective list); the export drops
  it. Insert one → the reverse.
- `reference` columns contribute footnotes (`reference-behaviors.ts:33`), and
  `viz_forest`/`viz_bar`/`viz_boxplot`/`viz_violin` contribute axes + legends
  (`viz-behaviors.ts:84-130`) — all keyed off the wire in the DOM.
- `spec.labelColumn` is never walked at all by either, in either runtime.

Severity today is **bounded**: `effectiveBanks.footnotes` has no renderer in
either runtime (only `labels.footnote` reaches the footer,
`TabvizPlot.svelte:2767-2771`), and the live DOM consumers are cell-style
condition lookup (`:1448`) and `ctx.banks` handed to renderers (`:1674`), where
author-supplied `spec.banks.conditions` dominate. It is a latent trap that
becomes user-visible the moment a bank consumer lands.

*Verified*: read all four call sites and every `contributeBanks`
implementation; confirmed the export's `spec` is `exportSpec` via
`DownloadButton.svelte:60/79`.

---

**a5 — CONFIRMED — Inline cell edits never widen their column.**
`stores/slices/cells.svelte.ts:105-113` and `columns.svelte.ts:736-738`

Two independent reasons: (1) `setCellValue` does not call
`measureAutoColumns`; (2) even if it did, `measureLeafColumn` builds its
candidate set from `spec!.data.rows` via `getColumnDisplayText(row, col)` and
never consults `cells.cellEdits`. Double-click a short cell, type a much longer
value, and the column keeps its old width — `.grid-cell` is `overflow: hidden`,
so the text is clipped with no ellipsis affordance.

*Verified*: read both functions; grepped `measureAutoColumns` across the tree
(§5.1 trigger list) — the cells slice is absent.

---

**a6 — SUSPECTED — Header-band height can disagree with the rendered header
after a group is hidden.** `layout-zoom.svelte.ts:332` +
`TabvizPlot.svelte:866`

The layout slice computes `headerDepthForLayout = anyForestColumnGroups(
spec.columns) ? 2 : 1` — the **wire** list. The renderer computes
`headerDepth = 1 + getMaxGroupDepth(allColumnDefs)` — the **effective** list.
Hiding the only `ColumnGroup` (group defs carry ids and `applyColumnEdits:221`
filters by id, so `hideColumn(groupId)` removes it) drops the rendered header
to one row while the layout keeps reserving two, inflating the natural height
and the auto-fit scale.

Marked SUSPECTED because I did not find a UI affordance that passes a *group*
id to `hideColumn` — `openHeaderContextMenu` is wired on leaf header cells
(`TabvizPlot.svelte:1781, 1835`) — but the Shiny proxy `hideColumn` and
`initialState.hiddenColumns` accept any id. Also note the helper's name says
"forest column groups" while its body is `columns.some(c => c.isGroup)`
(`:162-165`) — the name is wrong regardless.

---

**a7 — SUSPECTED (low) — `mintUniqueColumnId` does not include
`spec.labelColumn` in its taken-set.** `columns.svelte.ts:371-384`

`walk(spec.columns)` misses the label column. A same-id insert would produce
two columns with the same id → duplicate key in
`{#each allColumns as column (column.id)}` (`TabvizPlot.svelte:1986`) and a
collided `columnWidths` entry. In practice the editor mints
`col_<base36 timestamp>` ids (`ColumnEditorV2Popover.svelte:103, 230`), and
after the first measure pass `columnWidths` contains the label id — which *is*
in the taken-set (`:381`). The exposure is an author-supplied id via the JS /
Shiny `insertColumn` API before the first measure (V8, or first paint).

---

**a8 — CONFIRMED — R's `split_table(shared_column_widths = TRUE)` never stamps
grouped or label columns.** `R/split_table.R:194-201`

```r
for (col_idx in seq_along(base_spec@columns)) {
  col <- base_spec@columns[[col_idx]]
  w <- widths[[col@id]]
  if (is.null(w) || !is.numeric(w)) next
  for (s_key in names(specs)) specs[[s_key]]@columns[[col_idx]]@width <- as.integer(w)
}
```

The payload sent to TS **is** flattened (`.subset_payload_for_shared` uses
`.flatten_column_specs`, `:238`), so `widths` legitimately contains ids for
columns nested in a `ColumnGroup` — but the stamping loop is top-level and
index-based, so those entries are computed and thrown away. A `ColumnGroup` at
index *i* is skipped only because `widths[[group@id]]` is NULL. The label
column is invisible to both halves (`base_spec@columns` excludes it;
`spec@label_column` is serialized separately, `R/utils-serialize.R:27`) — so
the widest and most alignment-sensitive column in a split view is exactly the
one shared widths never touch. The TS-side toggle has the same blind spot
(`splitTabvizStore.svelte.ts:239, 248` use `leafColumns(spec.columns)`).

*Verified*: read both loops and `.flatten_column_specs`. Not executed.

---

### (b) Brittle or problematic logic

**b1 — The runtime edit layer only handles ONE level of column grouping.**
`columns.svelte.ts:250-260` maps over top-level defs and applies
`applyColumnEdits` + `applyColumnOrder` to `def.columns` — with no recursion.
`findColumnScope` (`:323-329`) likewise scans only top-level groups. Nested
groups are a documented TS authoring shape (`authoring/columns.ts:731`) that
the *renderer* handles (`TabvizPlot.svelte:896` recurses, `flattenAllColumns`
recurses, `getMaxGroupDepth` recurses). Consequence: for a column inside a
nested group, hide / configure / insert-after / drag all silently do nothing
(`moveColumnItem` returns early because `findColumnScope` yields null and the
column isn't at root, `:338`). Either recurse, or reject nested groups at
ingress — the current state is a shape the renderer accepts and the editor
silently ignores.

**b2 — Index-0 is used as a proxy for "the label column" in at least four
places.** `primaryColumnId = allColumns[0]?.id` (`:280`), the measure's primary
pass (`:823`), `cells.setRowLabel`'s field resolution
(`cells.svelte.ts:127`), `getPrimaryColumn` in the export
(`svg-generator.ts:1388`). Meanwhile the *skip* in the measure loop and
`hydrateForSpec`'s `validIds` (`:1056`) key on `spec.labelColumn.id`. Any
future change that lets column 0 be something other than the label column
(reorder already does — a2) breaks a different subset of these each time.
Pick one definition and thread it.

**b3 — `hasFigureEdits` / "Reset figure" exclude every column edit.**
`theme.svelte.ts:116` documents figure-dirty as "watermark drift + banding
override + row-height pins"; `FigureBand.svelte:30-37` resets exactly those.
But user-resized widths and reorder **are** figure state by the project's own
definition — they serialize into `spec.figureLayout`
(`tabvizStore.svelte.ts:635-654`). So resizing or reordering columns leaves
"Reset figure" disabled, and pressing it doesn't undo them. Hides and inserts
have no scoped undo at all. The only escape is the toolbar's global
`ResetButton` → `resetState()` (`tabvizStore.svelte.ts:571`), which also throws
away sort, filters, paint, theme edits, and zoom. `clearColumnEdits` and
`clearColumnReorder` exist on the store and have **zero** UI callers.

**b4 — An unmeasured column has a zero shrink floor.**
`flex-weights.ts:59` (`minWidth: opts.measured ?? undefined`) +
`flex-distribute.ts:146` (`min = c.minWidth ?? 0`). Every "column vanished"
report so far routes through this one line pair. The system currently relies on
*every* column being measured; each new code path that can skip a measure
(a2, a inserted column pre-`6fda600f`, a `col.width` string that isn't `"auto"`
at `columns.svelte.ts:722`) turns into an invisible column rather than a
too-narrow one. A defensive floor (`AUTO_WIDTH.MIN`, or the type's
`VISUAL_MIN`) would convert this whole failure class from "vanishes silently"
to "looks slightly wrong".

**b5 — `columnWidths` is the one non-`raw` `$state` in the slice**
(`:169-174`) because `doMeasurement` writes `target[col.id] = w` in place. Any
refactor that moves the measure off in-place writes must convert it, and any
new code that captures `columnWidths` by reference and mutates it will
silently mutate store state. Documented but unenforced.

**b6 — Preview/commit asymmetry on widths.** `previewColumnWidth` sets the
user-resized pin on the first tick (`:500-504`). A drag surface that forgets
`cancelPreviewColumnWidth` on Escape leaves the column permanently frozen
against measurement and flex. There is no runtime guard, only the doc comment.

**b7 — `applyColumnOrder`'s dedupe-by-id is load-bearing by accident.**
It is what keeps a2/a1's duplicated label column from rendering twice
(`lib/column-order.ts:18-27`, `svg-generator.ts:4547`). Two independent
accidents currently mask a real defect; fixing either one alone could surface
the other.

**b8 — `tabularizeDigits` is applied to every column's flat measure, not just
numeric ones** (`columns.svelte.ts:630-631`, mirrored at
`svg-generator.ts:530-538`). Only `.numeric-cell` gets
`font-feature-settings: tnum` in the DOM (`TabvizPlot.svelte:3338-3341`), so a
`text` or `date` column full of digits is budgeted at the widest-digit advance
it will never render at. Harmless today (DOM and export agree, and the error is
a slight over-width), but it's a divergence waiting to be "fixed" on one side.

---

### (c) Poorly-written or redundant code

**c1 — `processColumn` re-applies an override that `effectiveColumnDefs`
already applied.** `columns.svelte.ts:805` does
`measureLeafColumn(columnSpecOverrides[col.id] ?? col)`, but since `6fda600f`
the loop iterates `effectiveColumnDefs`, where `applyColumnEdits:222` already
substituted the override — for group children too. The lookup is now a no-op
(it re-fetches the same object). Its comment still describes the pre-fix world.

**c2 — Three separate hand-maintained "numeric type" sets.**
`NUMERIC_COLUMN_TYPES` (`schema/columns/index.ts:55`, 8 types, drives the
numeric font role + the filter kind), `editableColumnTypes`
(`TabvizPlot.svelte:1000`, 7 types), and `numTypes` inside
`EditableCell.svelte:52-55` (7 types, a *different* 7 — adds
heatmap/progress/bar, drops n/currency/interval/range/date). The first claims
in its comment to be "sourced from each schema's `category: "numeric"`" — it
currently matches, but nothing gates it, so adding a ninth numeric schema
silently misses the font role. All three should derive from schema metadata.

**c3 — Dead / unreachable width branch.** `columns.svelte.ts:722-725` handles
`col.width != null && col.width !== "auto"` after the numeric case, but the
wire type is `number | "auto" | null` (`types/index.ts:556`) and R's serializer
only ever emits those three (`R/utils-serialize.R:504-510`). It can only fire
on a malformed wire — where it does the *wrong* thing (deletes the measured
entry, leaving the column with a 0 flex floor per b4) rather than falling back
to auto.

**c4 — `hasColumnEdits` (`:315`) omits `columnOrderOverrides`** while
`figureLayoutState` treats order as edit state, and the getter has no consumers
at all (`tabvizStore.svelte.ts:945` is the only reference outside the slice).
Either wire it to a UI or delete it; as written it is a trap for whoever wires
it first.

**c5 — Misleading names.** `anyForestColumnGroups`
(`layout-zoom.svelte.ts:162`) tests `c.isGroup` and has nothing to do with
forest. `allColumnDefs` (`:284`) is a bare alias of `effectiveColumnDefs` —
two public names for one value. `SlotBundle`/`SlotRole` style aliasing is
documented elsewhere; this one isn't.

**c6 — R↔TS group-id asymmetry.** R's `col_group` defaults the id to
`paste0("group_", slug)` (`R/classes-components.R:2168`); TS's `colGroup`
defaults to the bare slug (`authoring/columns.ts:736`). `columnOrderOverrides.
byGroup` and `figureLayout.columnOrder.byGroup` are keyed by group id, so a
figure-layout block captured in one language does not apply to the equivalent
table authored in the other. Belongs in `docs/dev/r-ts-parity-notes.md`.

**c7 — `RESERVED_COLUMN_IDS` is duplicated R-side (`R/classes-components.R:178`)
and TS-side (`columns.svelte.ts:77`) with a "kept in sync" comment and no sync
gate**, unlike the glyph and interaction-flag rosters which have
`test-*-roster-sync.R`. Two entries today; cheap to gate.

**c8 — `computeSharedWidths`'s R caller re-implements the flatten it already
sent.** `R/split_table.R:194` walks `base_spec@columns` top-level while
`.subset_payload_for_shared` flattened the same list two calls earlier. Reusing
`.flatten_column_specs` and stamping by id (rather than by index) would fix a8
and delete the index coupling in one edit.

# The row system — system map

Audit + map of the code as it stands 2026-07-27. This is the **map of the
current implementation**; the *design* record lives in
`docs/dev/region-tree.md` (the tree primitive, the perf contract, the
faceting/details seams) and `docs/dev/row-types.md` (the row-kind ontology and
its open decisions). Read those for *why*; read this for *where* and *what
actually runs*. Sizing math that the row system feeds into is
`docs/dev/sizing-model.md` §1.4/§6b/§8a.

All paths are relative to the repo root. Line numbers are as of the audit date.

---

## 1. The pipeline in one picture

```
spec.data.rows[]            (index-stable, ids are positional "row_<i>")
  │
  ├─ sort-filter.svelte.ts ── visibleIndices : number[]      (filter → sort)
  │      rowAt(i) merges the paint-tool overlay lazily
  │
  ├─ region-tree.ts :: buildRegionTree(groups, visibleRows, rowOrder, notes)
  │      → RegionNode[]   STRUCTURAL ONLY. Collapse/disclosure are NOT inputs.
  │
  ├─ region-tree.ts :: flatten(forest, collapsedGroups, expandedRows)
  │      → DisplayRow[]   collapse + disclosure applied AT EMIT
  │      = rows-groups.svelte.ts :: fullDisplayRows
  │
  ├─ data.svelte.ts :: paginatedRows → displayRows          (page window)
  │
  └─ consumers (all $derived off store.displayRows, none cache):
        layout-zoom.svelte.ts :: layout   → computeRowLayout (heights/positions)
        tabvizStore.svelte.ts :: bandIndexes, rowPaddedAfter
        TabvizPlot.svelte     :: the keyed {#each}
        RowEdgeHandles.svelte :: per-kind drag seams
        tabvizStore.svelte.ts :: exportSpec → svg-generator.ts (its OWN flatten)
```

The load-bearing rule from `region-tree.md` §1 is honored in code: the tree is
the structure layer, `DisplayRow[]` is the layout/render contract, and nothing
downstream walks the tree.

---

## 2. Structural vs applied-at-emit — exactly

### `buildRegionTree` (`srcjs/src/lib/layout/region-tree.ts:80-227`) — STRUCTURAL

Inputs (`RegionTreeInput`, `:56-68`): `groups`, `visibleRows` (already
sorted/filtered), `rowOrder` (per-group row + per-parent group reorder
overrides), `notes`.

What it does, in order:

1. `:87-103` bucket visible rows by `groupId` (`null` → root key `"__root__"`),
   then apply the per-group reorder override. Rows missing from an override sort
   to `+Infinity` (i.e. keep trailing position).
2. `:106-111` index `spec.notes` by their `after` row id; **blank/whitespace
   content is dropped here**, not at render.
3. `:119-126` compute `groupsWithHeaders` = every group that has rows, plus all
   its ancestors. The `!groupsWithHeaders.has(current)` guard both dedups
   shared-ancestor walks **and terminates a malformed `parentId` cycle**.
4. `:132-153` bucket header-bearing groups by `parentId` once (a single pass
   plus one sort per parent — this used to be an O(G) filter re-run per call,
   hence O(G²)); `:158-166` memoize `countDescendantRows` for the header's
   "(N)".
5. `:170-224` `buildLevel(parentId)` emits, per level: child-group subtrees
   first, then the level's own data rows — mirroring the historical
   `outputGroup` recursion so output stayed byte-identical through the swap.
   A data row gains children:
   - `:195-205` a `panel` child when `row.details` is a non-blank string; the
     parent row gets `traits = {"expandable"}`.
   - `:207-219` one `panel` child per note, `body.alwaysVisible = true`.

Node ids: `group:<id>` / `row:<id>` / `panel:<rowId>` / `note:<rowId>:<i>`
(`:174, :186, :198, :212`).

**Not inputs, by design:** collapse state, disclosure state, container size,
measured heights, density.

### `flatten` (`region-tree.ts:236-268`) — APPLIED AT EMIT

Single DFS. Three emit cases and two gates:

| node | emits | gate |
|---|---|---|
| `group_header` (`:244-253`) | `{type:"group_header", group:{...group, collapsed}, rowCount, depth}` | `collapsedGroups.has(group.id)` → header emitted, **subtree skipped** (`return` before recursing) |
| `data` (`:254-255`) | `{type:"data", row, depth}` | none |
| `panel` (`:256-259`) | `{type:"panel", rowId: ownerRowId, content, depth}` | `alwaysVisible` → always; else `expandedRows.has(ownerRowId)` |

`flatten` **projects away the node id** — a `PanelRow` carries only `rowId`, not
the `panel:`/`note:` discriminator. That loss is the root of two defects
(Findings A2, A3).

`axis_strip` (`RegionKind`, `:32`) is declared and never produced. `traits` and
`scope` are threaded but no consumer reads them; `region-tree.md` §8 phase 4
deliberately defers widening them until a consumer exists.

### The store wiring

`srcjs/src/stores/slices/rows-groups.svelte.ts:148-162` is the only production
caller of both. It is a `$derived.by` reading `deps.getVisibleIndices()` +
`deps.getRowAt(i)` (cross-slice) and the slice's own `collapsedGroups` /
`expandedRows` / `rowOrderOverrides`. So `buildRegionTree` re-runs on every
collapse too — the structural/emit split is respected *inside* the module but
the store does not memoize the tree across a collapse toggle. That is a known,
budgeted cost (`region-tree-bench.ts`: build+flatten ≈ 0.013 ms at 200 rows).

---

## 3. RowKind vocabulary

`srcjs/src/lib/layout/row-kind.ts`.

```ts
type RowKind = "data" | "group_header" | "spacer" | "summary" | "header" | "panel"
```

`resolveRowKind(dr)` (`:44-52`) — structural first (`group_header`, `panel`),
then the *authored* `row.style.type` (`spacer` / `summary` / `header`), default
`data`. The `overall` diamond is deliberately **not** a kind (`:19-21`): it is
`spec.data.overall`, rendered as a singleton outside the row loop in both
backends (`TabvizPlot.svelte:2337`, `svg-generator.ts:5085`). `row-types.md`
§5 flags this as the open "unify summary scope" decision.

`ClassifiableRow` (`:34-37`) is deliberately structural-minimal so `DisplayRow`,
`BandingDisplayRow` and svg-generator's local `DisplayRow` all satisfy it.

### The property table (`:59-86`)

| kind | banded | measuresWidth | rendersCells | summaryMarker |
|---|---|---|---|---|
| `data` | ✔ | ✔ | ✔ | — |
| `header` | — | — | ✔ | — |
| `summary` | — | ✔ | ✔ | ✔ |
| `spacer` | — | — | — | — |
| `group_header` | — | — | — | — |
| `panel` | — | — | — | — |

Real consumers, exhaustively:

- `banded` — via `isBanded()` only, at `lib/banding.ts:103-104`.
- `measuresWidth` — `stores/slices/columns.svelte.ts:736` (DOM auto-width) and
  `export/svg-generator.ts:492` (export auto-width).
- `summaryMarker` — `components/forest/RowInterval.svelte:121`,
  `export/svg-generator.ts:2087` and `:5345`.
- `rendersCells` — **no consumer anywhere** (Finding C1).

`resolveRowKind` (without the props table) is additionally consumed by
`table-metrics.ts:103,146`, `layout-zoom.svelte.ts:619`,
`TabvizPlot.svelte:1934,2828`, `RowEdgeHandles.svelte:81`,
`debug-layout.ts:97`, `svg-generator.ts:4044,5293,5344`.

### What each kind implies in practice

- **`data`** — full participant: banded, measured for width, cell-rendered,
  content-growth eligible (wrap + `contentHeights`), floored at one body
  line-height.
- **`group_header`** — full-span label + chevron in the *primary cell only*
  (`TabvizPlot.svelte:2058-2065`); other columns render an empty `.group-row`
  cell. Fixed height (`table-metrics.ts:150-151`), **no content growth and no
  DOM measurement** (it carries no `data-row-id`). Height is themed via
  `rowGroup.L1/L2/L3` and the depth-indexed indent
  (`theme.rowGroup.indentPerLevel`, `TabvizPlot.svelte:2020`).
- **`spacer`** — half-height by intrinsic ratio (`INTRINSIC_KIND_RATIOS.spacer =
  0.5`), skipped as "previous data row" when flagging `rowPaddedAfter`
  (`table-metrics.ts:103`), and **excluded from content growth** (`h =
  kindBase("spacer")`, no `Math.max`). The DOM still renders its cells and hides
  them with `visibility: hidden` (`TabvizPlot.svelte:3541-3549`).
- **`summary`** — the only non-`data` kind that measures width and draws the
  forest diamond instead of point+interval. Inherits `data`'s height ratio via
  `KIND_INHERITANCE` (`row-kind-heights.ts:57-61`).
- **`header`** (authored section header) — a styled data row: bold + muted bg
  (`.row-header`, `TabvizPlot.svelte:3558-3561`;
  `svg-generator.ts:4848-4852`). No theme cluster, no distinct render path — the
  "half-implemented" state `row-types.md` §1 describes is still accurate.
- **`panel`** — full-width free content, `grid-column: 1 / -1`
  (`TabvizPlot.svelte:1894-1904`), markdown→HTML in the DOM
  (`lib/markdown.ts::renderMarkdown`), markdown→wrapped plain text in the export
  (`markdownToPlainText` + `svg-generator.ts:1785-1812`). Content-driven height;
  **excluded from per-kind pins** (`sanitizeRowKindPins`, `row-kind-heights.ts:165`)
  and from `rowKindRoster` (`layout-zoom.svelte.ts:620`) and from
  `RowEdgeHandles` (`:85-87`).

### Height cascade

`row-kind-heights.ts` implements layers 1–4, `table-metrics.ts` applies layer 5:

```
resolvedHeight(kind) = pin[kind]                                   (layer 5, px)
                    ?? rowHeight × ( constructor.row_heights[kind]  (layer 4, ratio)
                                  ?? theme.row_kinds[kind].heightRatio (layer 3)
                                  ?? resolveRatio(parent(kind))     (layer 2)
                                  ?? INTRINSIC_KIND_RATIOS[kind] )  (layer 1)
```

Ratios are validated finite+positive (`:130-131`); pins are sanitized to
`[8, 2000]` and gated on the real kind vocabulary (`:159-171`) by the SAME
function in both runtimes (store hydration `layout-zoom.svelte.ts:760` and
export `svg-generator.ts:978`). **Layer 3 is wired end-to-end except for the two
production call sites** — see Finding A5.

Content growth layers *above* the resolved base, only for `data`/`summary`/
`header` (`table-metrics.ts:152-166`): `max(wrapHeight, contentHeights[id],
dataLineHeightPx)`. Then `+rowGroupPadding` on `rowPaddedAfter` rows
(`:178`), and the marker centre excludes that pad (`:191-192`).

---

## 4. Row identity — what it is and what breaks it

**The id is positional.** `R/utils-serialize.R:410` emits `id = paste0("row_", i)`
where `i` is the 1-based index into `spec@data` **at serialization time**.
There is no author-supplied row key anywhere in the R surface.

Downstream, everything that must survive a re-render keys on that id:

- `spec.notes[].after` (`R/modifiers.R:764` writes `row_<idx>`)
- `initialState.expandedRows` (`R/web_spec.R:631`, `R/modifiers.R:1034`)
- `styleEdits.rows` / `.cells`, `cellEdits`, `labelEdits`, `wrapLineCounts`
- `measuredRowHeights`, `contentHeights`, `panelContentKey(rowId)`
- Shiny `selected` / `hover` / `expanded_rows` payloads

**Index stability inside the widget is real and deliberate.**
`sort-filter.svelte.ts:98-129` never re-allocates `spec.data.rows`; sort and
filter only produce a `visibleIndices: number[]`. `rowAt(i)`
(`:137-154`) allocates a merged Row only when a paint overlay exists. So
per-row banks and condition vectors keyed by original index stay aligned
(the schema-sprint Phase 1 keystone).

**What breaks identity:**

1. **Any R modifier that reassigns `spec@data` before serialization.**
   `sort_rows()` (`R/modifiers.R:788-790`) and `filter_rows()`
   (`R/modifiers.R:830`) replace the data frame; ids are re-derived positionally
   afterwards. `add_note(after = 5)` followed by `filter_rows()` re-points the
   note to a different row. Same for `details_expanded`'s seeded
   `expanded_rows` and for `toggle_row_details(row = <index>)`.
2. **Any spec swap.** New data → same `row_1..row_N` ids for entirely different
   rows. `columns.hydrateForSpec()` and `layoutZoom.hydrateForSpec()` reconcile
   *column* figure-state by id on purpose; there is no equivalent row-side
   reconcile because row ids are not stable identifiers across specs — they are
   positions.
3. **Panel ids are not unique.** `flatten` projects both the details panel and
   every note down to `rowId = <owner row id>` (`region-tree.ts:259`), so one
   row with N panels yields N `DisplayRow`s sharing one identity (Findings A2/A3).

---

## 5. Mutable row state and its lifetime

| state | owner | reset on `setSpec`? | reset on `resetState`? | travels to export? | Shiny |
|---|---|---|---|---|---|
| `collapsedGroups` | rows-groups `:113` | **yes** (`tabvizStore:416`), then re-seeded from `group.collapsed` (`:417-419`) | yes | via `exportSpec` `syncedGroups` (`:690-693`) — but the export ignores it (A4) | `collapsed_groups` in+out |
| `expandedRows` | rows-groups `:116` | **yes, and NOT re-seeded** (A1) | yes | **no** (A6) | `expanded_rows` out; `toggleRowDetails` in |
| `rowOrderOverrides` | rows-groups `:117` | yes | yes | group order does (`exportSpec:700-720`); row order via `orderedRows` | — |
| `hoveredRowId` | rows-groups `:123` | **no** (deliberate, `:321-322`) | no | n/a | `hover` |
| `tooltipRowId` / `tooltipPosition` | rows-groups `:124-125` | yes | yes | n/a | — |
| `sortConfig` / `filters` | sort-filter `:92-93` | **yes, and `initialState.sort`/`.filters` NOT re-applied** | yes | baked into `orderedRows` | `sort`, `filters` |
| `styleEdits` (paint) | semantics | yes | yes | merged in `rowAt` | `row_styles`, `cell_styles` |
| `cellEdits` / `labelEdits` / `wrapLineCounts` | cells | yes (`cells.reset()`) | yes | `exportSpec:669-681` | `cell_edits` |
| `measuredRowHeights` | layout-zoom `:261` | **NO** (A7) | yes (`:886`) | no (export re-estimates) | — |
| `rowKindHeights` (per-kind pins) | layout-zoom `:266` | **no** — merged *under* surviving pins by `hydrateForSpec` (`:759-769`) | yes | yes, via `spec.figureLayout.rowKindHeights` | `row_kind_heights` |
| `bandingOverride` / `bandingStartsWithBandOverride` | data `:96-97` | no (viewer preference) | yes (`:305`) | no (A8) | `banding` |
| `currentPage` | data | yes (`data.hydrateForSpec`) | yes | page window applies to `exportSpec` | — |

Seeding of authored initial state happens **once**, in
`core/createTabviz.ts:167-185`, before mount. `instance.update(spec)`
(`:193-204`) and the htmlwidgets `renderValue` re-render path
(`htmlwidgets/index.svelte.ts:260`) call `store.setSpec` **without** re-running
that block.

---

## 6. Banding

`srcjs/src/lib/banding.ts`. `BandingSpec = {mode: "none"|"row"|"group", level}`;
the `group-N` grammar is parsed identically in R
(`R/utils-banding.R::parse_banding`) and TS (`banding.ts:20-32`).

- `mode: "row"` (`:106-115`) — counter increments per **banded** row
  (`isBanded`), so header/summary/spacer/group-header/panel rows are `null` and
  do not advance the phase.
- `mode: "group"` (`:117-185`) — the counter flips whenever the ancestor group at
  the target depth changes; every member row inherits the same index so a group
  reads as one band. Level is clamped to `[1, maxGroupDepth]`; `null` → deepest.
  No groups → falls back to row mode (`:119-128`).
- Panels are never banded (`:144-148`).
- `startWithBand` defaults to `mode === "group"` (BABA for group, ABAB for row).

Resolution of the effective spec is in `data.svelte.ts:178-195`: figure override
→ `spec.theme.layout.banding` → `{mode:"group"}`; and for the phase, figure
override → `theme.authoringInputs.banding_start` → `mode === "group"`.
`setSpec` coerces `group` → `row` when the data has no groups
(`tabvizStore.svelte.ts:462-476`) so the settings panel and the render agree.

The export calls the same `computeBandIndexes` (`svg-generator.ts:4824-4828`)
but **omits the `startWithBand` argument** — Finding A8.

---

## 7. The row half of `TabvizPlot.svelte`

- `:127` `displayRows = $derived(store.displayRows)` (post-pagination).
- `:1146-1166` `gridTemplateRows` — the ONLY place row track heights reach CSS:
  `[header tracks…, ...layout.rowHeights, axis track]`. Cells stretch to the
  track; the file's own comment (`:3324-3328`) states that setting `height` on a
  cell "would fight the track height and reintroduce the layout-engine vs DOM
  disagreement" — `.spacer-row` violates that rule (Finding C2).
- `:1879` the keyed `{#each displayRows as displayRow, i (getDisplayRowKey(...))}`.
  Six more keyed `{#each}` passes over the same list exist for the overlay
  layers (`:2263, 2288, 2414, 2503, 2592, 2658`), all using the same key fn.
- `:795-802` `getDisplayRowKey` — `group_<id>` / `panel_<rowId>` / `row.id`.
- `:1891-1904` panel branch: `data-panel-row-id`, `grid-column: 1 / -1`,
  `{@html renderMarkdown(content)}` (safe by construction — `markdown.ts`
  escapes first, then re-introduces a fixed tag set).
- `:1906-1981` the cells branch: paint preview, banding class, semantic bundle,
  group tier, effective bg precedence (`row.style.bg > groupBg > semBundle.bg`),
  drag source / just-dropped.
- `:1997-2079` primary cell — drag surface, group header chrome, disclosure
  chevron (`:2067-2074`), depth indent, `data-row-id` (**undefined for group
  headers**, `:2010`).
- `:2337-2346` the `overall` diamond singleton, guarded on all three values
  being finite.
- `:2688-2690` `RowEdgeHandles` gets `displayRows`, `rowPositions`,
  `rowHeights`, and a `trailingPads` array derived from `rowPaddedAfter`.
- `:565-668` the measure-then-commit effect — see below.

### Measure-then-commit (`:565-668`)

Deps: `displayRows.length`, `layout.rowHeights.length`, the body font token,
`store.columnWidths`, `store.expandedRows`, and `spec` (read at `:566`, so any
`setSpec` re-runs it). One `requestAnimationFrame`, then:

1. **Grow** (`:638-641`) — for each `[data-row-id]` cell, commit
   `cell.scrollHeight` only when it exceeds `clientHeight + 1` (the B2 fix: a
   non-overflowing cell just reports its own track back, and for
   `.row-padded-after` rows that track includes the trailing group padding →
   an unbounded ~12px/frame ratchet).
2. **Panels** (`:645-655`) — `[data-panel-row-id]` cells commit under
   `panelContentKey(rowId)`, same overflow-only rule. **Grow-only, no shrink
   path.**
3. **Shrink-back** (`:580-614, 656-664`, landed 80917348) — a row is *offered*
   a smaller height only when its tallest non-absolute cell **child** (a metric
   that does not stretch with the track) plus the cell's own vertical padding is
   `SHRINK_SLACK`-clearly below the track, and the row is not
   `.row-padded-after`, and it did not overflow this pass.
   `growMergeHeights` (`layout-zoom.svelte.ts:108-142`) then accepts the smaller
   value only when the key is **already committed** — shrinking may only undo
   growth, never pin a never-grown row (which would diverge the DOM from the
   export's estimate).

Per-kind participation in that contract:

| kind | in grow report | in shrink offer | notes |
|---|---|---|---|
| `data` / `summary` / `header` | ✔ | ✔ | the intended path |
| `group_header` | ✗ (no `data-row-id`) | ✗ | `.grid-cell` is `nowrap` + ellipsis, so no growth is wanted; but the label is also confined to the primary column's width |
| `spacer` | ✔ (cells are rendered, merely `visibility:hidden`) | ✗ (`naturalOf` finds a child, but the commit is inert) | `computeRowLayout` never `max`es `contentHeights` for `spacer`, so a committed value is stored and unused |
| `panel` | ✔ under `panel:<rowId>` | **✗ — grow-only** | Finding A9 |
| `.row-padded-after` rows | ✔ | ✗ by design (`:625-628`) | the trailing pad makes `natural` look permanently shrinkable |

---

## 8. The export's parallel row system

`srcjs/src/export/svg-generator.ts` does **not** use `region-tree.ts`. It has
its own `DisplayRow` union (`:1176-1195`) and its own
`buildDisplayRows(spec)` (`:1199-1310`) that re-implements the same recursion:

- `:1206-1208` expansion comes from `spec.initialState?.expandedRows` (static
  export decision: honor `initialState`, collapsed by default).
- `:1209-1227` `followers()` — the details panel then the notes, exactly the
  region tree's child order.
- `:1252-1261` the ancestor walk — **without** the region tree's cycle guard.
- `:1264-1266` `getChildGroups` is an O(G) `filter` per call;
  `:1275-1281` `countAllDescendantRows` is un-memoized — both are the O(G²)
  shapes that were fixed on the DOM side (`region-tree.ts:132-166`) and left
  here.
- `group.collapsed` is never read (the only occurrence of "collapsed" in the
  file is a comment at `:1206`).

Everything downstream *is* shared: `computeRowLayout`, `computeRowPaddedAfter`,
`computeBandIndexes`, `resolveRowKind`/`rowKindProps`, `sanitizeRowKindPins`,
`panelContentKey`. So the divergence surface is exactly "which rows exist and
in what order", not "how tall they are".

---

## 9. Seams

- **Faceting** attaches at `RegionKind = "axis_strip"` (`region-tree.ts:32`) as a
  group's last child, plus `forest-scale.ts`'s `ForestScaleContext.groupId`
  (already threaded, `null` = whole column today). Both are in place and unused.
- **Details / disclosure** landed on the `panel` kind + `body.type === "free"`
  + the flatten-time `expandedRows` set. **Notes** reuse the same node with
  `alwaysVisible`. Any new full-width free-content row (annotations, nested
  subtables, "…N more" continuations) should be a `panel` node, not a new kind —
  but see Finding A2 before adding one: the `PanelRow` projection cannot
  currently distinguish siblings.
- **Per-kind theming** (`row-types.md` §4) attaches at `RowKindInputs`
  (`row-kind-heights.ts:70-77`), which is explicitly reserved for Stage 2 paint
  fields. Layer 3 must be plumbed first (Finding A5) or every field added there
  will be born dead.
- **Row-kind drag pins** attach at `layout-zoom.svelte.ts::setRowKindHeight` +
  `RowEdgeHandles.svelte`; they ride `spec.figureLayout.rowKindHeights` and are
  the one row-side state that survives `setSpec`.

### Test surface

- `srcjs/src/lib/layout/region-tree.test.ts` — 20-odd cases: cycle termination,
  reorder, notes, details gating, collapse.
- `srcjs/src/lib/layout/row-kind.test.ts`, `row-kind-heights.test.ts`,
  `table-metrics.test.ts` (incl. a layer-3 case that passes `themeKinds`
  directly — which is why A5 is invisible to it).
- `srcjs/src/export/layout-metrics.test.ts` — the geometry snapshot gate.
- `srcjs/src/stores/slices/grow-merge-heights.test.ts` — the shrink semantics.
- `srcjs/tests/browser/measure-rows.browser.ts` — grow + shrink-back + settle.
- `srcjs/tests/browser/details-panel.browser.ts` — DOM panel render + toggle.
- `srcjs/tests/perf/region-tree-bench.ts` — 200-row budget gate.

---

# Findings

Severity ordering within each section. "CONFIRMED" = verified against the code
(and, where noted, by executing the algorithm in isolation). "SUSPECTED" = the
code reads that way but I did not execute the failing path.

## (a) Possible issues / bugs

### A1 — CONFIRMED · authored `expandedRows` (and `sort`/`filters`/`hiddenColumns`) are dropped by every spec update

`core/createTabviz.ts:167-185` applies `initialState` **only at construction**.
`instance.update(nextSpec)` (`:193-204`) and the htmlwidgets `renderValue`
re-render (`htmlwidgets/index.svelte.ts:260`) and the `updateData` proxy
(`:53-66`) all call `store.setSpec` directly, which runs `rowsGroups.reset()`
(`tabvizStore.svelte.ts:416` → `rows-groups.svelte.ts:315-323`) wiping
`expandedRows`, and `sortFilter.reset()` (`:444`).

Group collapse is re-seeded (`tabvizStore.svelte.ts:417-419` reads
`newSpec.data.groups[].collapsed`); `expandedRows` has no equivalent.

**Failure scenario:** a Shiny app renders
`tabviz(df, details = "notes", details_expanded = TRUE)`. First paint shows the
panels open. Any reactive re-render of the same output (or any
`tabviz_proxy() |> update_data()`) re-runs `renderValue` → `update()` →
`setSpec` → panels closed, and nothing reopens them. Same for
`initialState.sort` / `.filters` / `.hiddenColumns` — an authored default sort
silently disappears on re-render.

**Verified:** traced every caller of `store.setSpec` (`createTabviz.ts:151,203`,
`index.svelte.ts:65`) and every caller of `setExpandedRows`
(`createTabviz.ts:183` only).

**Fix shape:** move the `initialState` block out of `createTabviz` into
`setSpec`, next to the existing `g.collapsed` seeding — one seeding site for all
authored initial state.

### A2 — CONFIRMED · a row with more than one panel produces duplicate Svelte keys and one shared height

`flatten` projects both node kinds down to `rowId = ownerRowId`
(`region-tree.ts:259`), discarding the `panel:<id>` / `note:<id>:<n>` node ids.
`getDisplayRowKey` (`TabvizPlot.svelte:795-802`) therefore returns
`panel_<rowId>` for every panel of a row, and the seven keyed `{#each}` blocks
over `displayRows` (`:1879, 2263, 2288, 2414, 2503, 2592, 2658`) receive
duplicate keys.

Independently, `data-panel-row-id={displayRow.rowId}` (`:1898`) makes the
measure loop collapse all of a row's panels into one
`measured[panelContentKey(rowId)]` (`:652-653`, a `Math.max`), and
`computeRowLayout` (`table-metrics.ts:171`) hands that single height to every
one of them. The export is worse: `svg-generator.ts:965-967` **assigns** rather
than max-es, so the last panel's height wins for all of them.

**Failure scenario:** `tabviz(df) |> add_note(after = 3, "a") |> add_note(after = 3, "b")`,
or any row with both `details` and a note. Two `DisplayRow`s with key
`panel_row_3`. Dev builds throw Svelte's `each_key_duplicate`; production builds
mis-reconcile. Even where the keys survive, a 1-line note and a 12-line note get
identical track heights.

**Verified:** `region-tree.test.ts:203-227` exercises exactly this case and
passes — it asserts on `flatten`'s *content*, never on the projected identity,
so the unit suite is structurally blind to it.

**Fix shape:** carry the node id through the projection
(`PanelRow.panelId`) and key on it; key the measure map on it too.

### A3 — CONFIRMED · details panels and notes vanish entirely under pagination

`data.svelte.ts:119-149` (`paginatedRows`) builds its include mask from
`dr.type === "data"` only (`:130-133`); the group-header pass (`:135-144`) only
propagates from already-included rows. `panel` rows are never marked, so they
are filtered out at `:145-149`.

**Failure scenario:** any table over 200 rows (R auto-paginates at 200 —
`R/web_spec.R:137-143`) with `details =` or `add_note()`. Clicking the
disclosure chevron toggles `expandedRows`, `fullDisplayRows` grows the panel,
and `paginatedRows` deletes it — the chevron appears dead. Notes never render at
all.

**Verified:** replicated `paginatedRows` verbatim in isolation with a fixture of
one group / two rows / one details panel / one note — output was
`group_header, data, data`; both panels dropped.

**Fix shape:** include a `panel` whenever its `ownerRowId` is in
`currentPageRowIds`.

### A4 — CONFIRMED · `Group.collapsed` is honored by the widget and ignored by the SVG export

`setSpec` seeds `collapsedGroups` from `g.collapsed`
(`tabvizStore.svelte.ts:417-419`) and `exportSpec` writes the live collapse
state back onto the groups (`:690-693`). But `svg-generator.ts::buildDisplayRows`
never reads `collapsed` (the string appears once in the whole file, in a comment
at `:1206`).

Two distinct consequences:

1. **`save_plot()` on an authored spec** — `web_group(collapsed = TRUE)` /
   `toggle_group()` produce a widget with the group collapsed and an exported
   SVG with it fully expanded.
2. **"Download SVG" after collapsing in the UI** — `exportSpec`'s `orderedRows`
   (`tabvizStore.svelte.ts:668-686`) already omits the hidden rows, so the group
   has no rows; `buildDisplayRows`'s `groupsWithHeaders` is derived from
   `rowsByGroup.keys()` (`:1253-1261`), so the **group header disappears too**.
   The DOM shows `▶ Subgroup A (12)`; the export shows nothing at all.

**Verified:** grepped `collapsed` across `svg-generator.ts` (1 hit, a comment);
traced `groupsWithHeaders` construction.

### A5 — CONFIRMED · height-cascade layer 3 (`theme.row_kinds[kind].heightRatio`) is dead in both runtimes

The layer is fully built and fully unplumbed:

- R: exported `set_row_kinds()` (`R/themes-api.R:1022-1053`), six S7 slots
  (`R/classes-theme.R:275-280`), wire emit (`R/themes-api.R:148-163`), wire
  import (`R/theme-wire-import.R:297-307`).
- TS: `ThemeInputs.row_kinds` (`types/theme-inputs.ts:271`), the resolution
  (`row-kind-heights.ts:137-139`), the input field (`table-metrics.ts:69-71,137`),
  and a passing unit test (`table-metrics.test.ts:117`).
- **Neither production `computeRowLayout` call passes `themeKinds`**:
  `layout-zoom.svelte.ts:544-553` (the comment there says "Currently undefined")
  and `svg-generator.ts:977-985`. `rowKindRoster` (`layout-zoom.svelte.ts:612`)
  likewise builds `ctx` from `constructorOverride` only.

**Failure scenario:** `web_theme() |> set_row_kinds(spacer = 2, group_header = 1.4)`
changes nothing in the widget, in the export, or in the Spacing tab's readout.
The value round-trips through the wire and `theme.authoringInputs.row_kinds`
correctly and is then never read.

**Verified:** `grep -rn themeKinds src/` returns only the definition sites and
the test; confirmed `theme-adapter.ts:382` stores `authoringInputs: inputs`
verbatim so the data does arrive.

Secondary: `row_kinds` is also absent from `theme-validate.ts`, so it is an
un-sanitized ingress field. Harmless while unconsumed; it must be validated
before the layer is plumbed (the untrusted-ingress rule).

### A6 — CONFIRMED · "Download SVG" exports details panels closed regardless of what is open on screen

`exportSpec` (`tabvizStore.svelte.ts:659-783`) syncs group collapse, row order,
cell edits, label edits, column widths and row-kind pins — but never writes
`initialState.expandedRows` from `rowsGroups.expandedRows`. `initialState`
passes through untouched via `...spec`. The export's only expansion source is
`spec.initialState?.expandedRows` (`svg-generator.ts:1208`).

**Failure scenario:** open three details panels, click Download SVG → the SVG
has none of them. The stated contract of `exportSpec` ("WYSIWYG spec reflecting
the user's current view state") is violated for exactly this one dimension.

### A7 — CONFIRMED · `measuredRowHeights` is the only row state that survives `setSpec`, keyed by positional ids

`layout-zoom.svelte.ts:759-777` (`hydrateForSpec`) merges only `rowKindHeights`.
`measuredRowHeights` (`:261`) is cleared only in `reset()` (`:886`, the
`resetState` path) and by `setMeasuredRowHeights(null)` (`:725-728`) — which
**no caller ever invokes** (`TabvizPlot.svelte:665` always passes an object).

Because row ids are positional, spec B's `row_3` inherits spec A's `row_3`
committed height. The 80917348 shrink-back path recovers the common case on the
next frame, but not where it does not apply: `panel:` keys (grow-only, A9),
`.row-padded-after` rows (excluded by design at `:625-628`), and cells whose
tallest child stretches with the track.

**Failure scenario (most concrete):** spec A has an 8-line note on `row_3`;
`update_data()` swaps in spec B whose `row_3` note is one line. The committed
`panel:row_3` height is never lowered, so the note renders as one line of text
in an 8-line band, permanently — and the export (which re-estimates from
scratch) disagrees.

**Secondary:** the map also never garbage-collects keys for rows that no longer
exist, so it grows monotonically across a long Shiny session.

**Note the asymmetry:** `wrapLineCounts` — the other half of the same
content-height mechanism — *is* reset (`cells.reset()`, `tabvizStore:433`).

### A8 — CONFIRMED · `banding_start` inverts the banding phase between widget and export

The DOM resolves the phase through
`data.svelte.ts:187-195`: figure override → `theme.authoringInputs.banding_start`
(`"band"` → true, `"plain"` → false) → `mode === "group"`. It passes the result
into `computeBandIndexes` (`tabvizStore.svelte.ts:360-367`).

The export calls `computeBandIndexes(displayRows, banding, groups)`
(`svg-generator.ts:4824-4828`) with **three arguments**, so `startWithBand` is
`undefined` and `banding.ts:98` falls back to `mode === "group"`.

**Failure scenario:** a theme with `banding = "row"` and `banding_start = "band"`.
The widget shades rows 1, 3, 5…; `save_plot()` shades rows 2, 4, 6…. Every
banded row is wrong. The numeric WYSIWYG gate is blind to it (geometry is
identical) and `dom-export-divergence.test.ts` does not cover it (it is not a
DOM-only token — both sides emit, with different phase).

The figure-level *override* (settings-panel Banding start) is session state and
legitimately does not export.

### A9 — CONFIRMED · panel heights are grow-only; the 80917348 shrink contract does not cover the `panel` kind

`TabvizPlot.svelte:645-655` reports `[data-panel-row-id]` cells under
`panelContentKey(rowId)` using the overflow-only rule, and the shrink pass at
`:656-664` iterates **only** `natural`, which is populated exclusively from
`[data-row-id]` cells (`:616-629`). No panel key can ever enter `shrinkable`.

`computeRowLayout` (`table-metrics.ts:167-174`) takes
`max(rowHeight, estimate, measured)`, so a stale-tall `measured` is a permanent
floor.

**Failure scenario:** widen the widget (or the browser window) so a details
panel that wrapped to 6 lines now needs 2. The panel band stays 6 lines tall for
the rest of the session — the exact symptom 80917348 fixed for cells,
unaddressed for panels. Combined with A7 it also survives `setSpec`.

### A10 — CONFIRMED · the export's group-ancestor walk hangs on a `parentId` cycle; the DOM's does not

`region-tree.ts:119-126` documents and implements the guard
(`while (current && !groupsWithHeaders.has(current))`).
`svg-generator.ts:1254-1261` is the same loop **without** the
`!has(current)` condition. `banding.ts:59-64` (`ancestorGroupIdAtDepth`) is a
third unguarded walk — it terminates on `depth < targetDepth`, which a cycle of
equal-depth groups does not satisfy.

Nothing validates against cycles: `spec/validate.ts` has no `parentId` check and
`R/classes-core.R::web_group(parent =)` accepts any string.

**Failure scenario:** `web_group("a", parent = "b")` + `web_group("b", parent = "a")`
(a plausible typo in a hand-built hierarchy). `save_plot()` /
`render_visual_tests()` spin forever in V8 with no error. The widget survives —
the guarded walk terminates and, because a cycle member can never be a child of
a null-parent root, `buildLevel` simply never descends into it (the group's rows
silently do not render, which is its own quiet failure).

**Verified:** replicated `svg-generator.ts:1253-1261` verbatim in Node with
`g1.parent = g2, g2.parent = g1` and one row in `g1`; the loop passed 10⁶
iterations with no progress. `region-tree.test.ts:24-41` already covers the DOM
side.

**Fix shape:** the guard is a two-token change on the export side; a
cycle check belongs in `assertValidSpec` so both runtimes fail loudly instead of
one hanging and one silently dropping rows.

### A11 — SUSPECTED · long group labels ellipsize in the DOM and render full-width in the export

The DOM renders `GroupHeader` inside the primary cell only
(`TabvizPlot.svelte:2058-2065`); `.grid-cell` is
`white-space: nowrap; overflow: hidden; text-overflow: ellipsis` (`:3172-3178`),
so the label truncates at the *label column's* width. The export's
`renderGroupHeader` (`svg-generator.ts:1814-1901`) emits a single `<text>` at
`labelX` with no truncation and no clip path.

**Failure scenario:** a group label longer than the label column → widget shows
`Patients with prior cardiovas…`, export shows the full string running across
the forest plot. Not verified visually.

## (b) Brittle or problematic logic

### B1 — two independent implementations of `rowPaddedAfter` in the same runtime

`tabvizStore.svelte.ts:377-393` computes it inline for the CSS class;
`table-metrics.ts:94-110` (`computeRowPaddedAfter`) computes it for the
geometry, called from inside `computeRowLayout`. They agree today but use
*different predicates*: the store writes `prev.row.style?.type !== "spacer"`,
the metrics helper writes `resolveRowKind(prev) !== "spacer"`.

Why it is non-local: the 80917348 shrink-back path keys its exclusion on the
**CSS class** (`cell.classList.contains("row-padded-after")`,
`TabvizPlot.svelte:625`) while the pad itself comes from the **geometry** flag
(`table-metrics.ts:178`). If the two drift by one row, that row's track carries
a `rowGroupPadding` the shrink pass cannot see, so `natural` sits a full pad
below the track every pass, the row is offered for shrinking forever, and the
grow path raises it again — the B2 ratchet in reverse. The commit message calls
this exact trap out as guard #3; nothing enforces that the two derivations stay
identical.

### B2 — `spec.data.summaries` (`GroupSummary`) is fully plumbed in R and read by nothing in TS

`GroupSummary` is an exported R class (`R/classes-core.R:134`, `NAMESPACE:11`), a
`WebSpec` constructor property (`:284`), serialized (`R/utils-serialize.R:454-481`),
filtered by pagination (`R/paginate.R:386-395`) and by `split_table`
(`R/split_table.R:391-414`). On the TS side, `WebData.summaries` (`types/index.ts:170`)
is declared and never read — `grep -rn "\.summaries" src/` finds only the type,
test fixtures, and `authoring/tabviz.ts:278` writing `[]`.

An R author who builds `GroupSummary` objects gets a silently empty result in
both runtimes. `row-types.md` §5 treats "unify group-summary + overall under a
scoped `summary` kind" as an open decision; the R surface has already shipped
ahead of it, so whatever that decision is, it now has a back-compat surface.

### B3 — the export re-implements the flatten instead of importing it

`svg-generator.ts:1176-1310` duplicates the `DisplayRow` union, the group
bucketing, the ancestor walk, the child-group lookup, the descendant count and
the follower ordering. Every fix to the region tree is a fix that must be
manually mirrored: the cycle guard (A10) and the O(G²) fixes
(`region-tree.ts:132-166`) were not. Sort/filter/collapse *are* pre-applied via
`exportSpec` for the browser path, so the export's copy exists mainly to serve
the R/V8 path — but the two now disagree on `collapsed` (A4) and on the notes
ordering guarantee.

The natural consolidation is: export calls `flatten(buildRegionTree(...),
collapsedFromSpec, expandedFromInitialState)` and keeps only its own
`DisplayRow` → render mapping.

### B4 — `rowKindRoster` reads the paginated `displayRows`

`layout-zoom.svelte.ts:617` iterates `deps.getDisplayRows()`. A row kind that
occurs only on page 3 is absent from the Spacing tab's "Row heights" roster
while page 1 is showing, so the control silently appears and disappears as the
user pages. `fullDisplayRows` would be the correct source.

### B5 — `PROPS`/`ClassifiableRow` cannot express `axis_strip`

`RegionKind = RowKind | "axis_strip"` (`region-tree.ts:32`) but `resolveRowKind`
returns `RowKind` and `PROPS` is a `Record<RowKind, …>`. The first faceting node
that reaches `computeRowLayout` will hit `PROPS[kind]` → `undefined` →
`undefined.banded` at `banding.ts:104`. This is fine while unused, but the
faceting sprint's first task must be widening the table, not adding a node.

## (c) Poorly-written or redundant code

### C1 — `RowKindProps.rendersCells` has zero consumers

`row-kind.ts:66-69` declares it; nothing reads it. The DOM renders full cell
content for `spacer` rows and hides them with CSS
(`TabvizPlot.svelte:2065-2077` + `:3541-3545`), and group-header cells are
special-cased inline with `isGroupHeader` (`:1906`) rather than through the flag.
Of the four properties the table was built to consolidate, three have real
consumers and this one is decorative.

### C2 — `.spacer-row { height: calc(var(--tv-spacing-row-height) / 2) }` is a second source of truth for the spacer ratio, and violates the file's own documented rule

`TabvizPlot.svelte:3541-3545`. The authoritative spacer height is
`INTRINSIC_KIND_RATIOS.spacer = 0.5` (`row-kind-heights.ts:45`) resolved through
four more layers and applied via `grid-template-rows` (`:1146-1166`). The CSS
rule:

- hardcodes the 0.5 a second time;
- reads `--tv-spacing-row-height` (the density base) rather than
  `layout.rowHeight` (post aspect-ladder, post-pin), so it disagrees whenever an
  aspect target or a `spacer` pin is active;
- directly contradicts the comment 220 lines above it (`:3324-3328`): "Setting
  `height` here would fight the track height and reintroduce the layout-engine
  vs DOM disagreement that pre-v0.21.x intermittent misalignments came from."

Visually inert for the hidden cells; `.spacer-row.plot-cell` is
`visibility: visible` (`:3547-3549`) and would under-fill its track when a
spacer pin is set. Deleting the rule and keeping `visibility: hidden` is the
straightforward fix.

### C3 — a fourth, un-routed copy of the width-skip predicate

`row-kind.ts:63-64` documents "svg-generator:348, columns.svelte.ts:597,
width-utils.ts:225" as the three width-skip copies it consolidated. Two of those
line references are now stale (the real sites are `svg-generator.ts:492` and
`columns.svelte.ts:736`, both correctly routed through
`rowKindProps().measuresWidth`); `width-utils.ts:225` is now unrelated code.
Meanwhile `lib/split-shared.ts:320` carries an un-routed
`if (st === "header" || st === "spacer") continue;` over the split wire's
parallel `rowStyleTypes` array. Equivalent today; a drift site by construction.

`rowStyleTypes` is itself a third representation of row kind (after
`DisplayRow.type` and `row.style.type`) — worth folding into the same resolver
when the split path is next touched.

### C4 — `RenderTree`'s `"spacer"` node kind collides with `RowKind`'s

`components/RenderTree.svelte:102` handles `node.kind === "spacer"` — an
*inline cell-level* spacing box (`RenderSpacer`, a `<span>` of `size`px). It has
nothing to do with the row kind of the same name. Any grep for "spacer" in the
row system turns it up. Worth a one-line comment at the `RenderSpacer` type, or
a rename to `gap`.

### C5 — `setMeasuredRowHeights(null)` is a dead branch

`layout-zoom.svelte.ts:725-728`. No caller passes `null`
(`TabvizPlot.svelte:665` is the only production call site and always passes an
object). Either wire it into `setSpec` — which is the fix for A7 — or delete it.

### C6 — the panel first-paint estimate counts raw markdown lines

`table-metrics.ts:172-173`: `estLines = dr.content.split("\n").length`.
`renderMarkdown` (`lib/markdown.ts:71`) drops blank lines entirely, so a panel
whose markdown uses blank-line paragraph separators gets a permanent height
floor taller than what the DOM renders (the floor is `max`ed, never replaced by
the measurement). The export's `wrapTextIntoLines` keeps blank lines
(`svg-generator.ts:181`), so both surfaces are equally tall — they just both
carry dead space proportional to the paragraph count. Deriving the estimate from
`markdownToPlainText` would make the two consistent *and* honest.

# Region tree — the row-system foundation

Status: **design doc — proposed (2026-06-02).** The next sprint's deliverable.
Foundation-only and behavior-preserving: this builds the structural primitive
that both **faceting** and **details/disclosure** grow from, but ships *no*
user-facing feature itself. Companion to `row-types.md` (the why + the targets)
and `sizing-model.md` (the geometry core this sits on). Read those first.

Decisions locked going in (see `row-types.md` §6 + the 2026-06-02 planning
session): full tree refactor; foundation only, both targets later; performance
is a first-class constraint; per-context scale lands first as its own PR.

---

## 0. Thesis

Rows become a **tree of regions**. Each region carries `kind` (one-of) +
`traits` (many-of) + `scope`, and its body is *either* column-cells *or* free
content, with content-driven height available everywhere. The renderer
**flattens** the tree to the flat `displayRows` list it already consumes.

This is not a green-field idea — **the flatten already exists.**
`rows-groups.svelte.ts::fullDisplayRows` (line 157) is a recursive walk
(`outputGroup`: header → child groups → direct data rows) that emits a flat
`DisplayRow[]`. The tree is implicit in that recursion today; we make it
**explicit and extensible** so a node can also be a details panel under a data
row, or an axis strip under a group — things the current `GroupHeaderRow |
DataRow` union and flat recursion cannot express.

```
Today (implicit):  groups+rows ──fullDisplayRows recursion──▶ DisplayRow[]
Proposed (explicit): RegionTree ──flatten (1 linear pass)────▶ RenderUnit[]   (== displayRows)
```

## 1. The performance-first principle (load-bearing)

`displayRows` is the hottest structure in the system: rebuilt on any
data/sort/filter/collapse change, iterated by `computeRowLayout` on every layout
change, iterated again by render, and fed back into by the measure-then-commit
ResizeObserver loop. A naive "tree of node objects rebuilt per render" regresses
all of that. The principle that prevents it:

> **The tree is the *structure* layer only. The flat render-unit array stays the
> layout/render contract.** The tree exists *solely to produce* `displayRows`;
> layout's and render's hot loops keep iterating a flat array and do not change.
> Perf impact is therefore bounded to the flatten step.

Concrete rules (each maps to a risk in `row-types.md`/this sprint's planning):

1. **`displayRows` stays a flat array** of render units, each with explicit
   `kind` / `traits` / height-policy. No consumer walks the tree.
2. **Single linear, pre-sized flatten.** Pre-count nodes, allocate the result
   array once, push in one DFS pass. No `concat`/spread/intermediate arrays.
3. **Preserve the existing structural-vs-layout `$derived` split.** `flatten`
   depends on *structural* inputs only — rows, groups, sort/filter, collapse
   state, and the **disclosure-expanded `Set`**. Container resize and measured
   row heights re-run `computeRowLayout` over the *existing* array; they must
   **never** re-flatten. (This split already exists as `fullDisplayRows` vs
   `computeRowLayout`; do not break it.)
4. **Disclosure/expand state is a `Set<rowId>`**, not a field mutated inside
   nodes. Toggling is a set add/remove; a panel's child units are appended after
   their parent only when expanded.
5. **Free-content height reuses the existing content-height contract**
   (`Record<rowId, px>`, the seam `wrapLineCounts` + measure-then-commit already
   use). No parallel measurement path; convergence is already solved.
6. **Per-context scale = one cached `Map<(colId,groupId) → scale>`**, computed
   once per axis-relevant change; forest cells do an O(1) lookup. This *removes*
   work — it retires the redundant global `xScale` (= multi-flex Phase E).
7. **Stable identity.** Nodes/units keyed by stable id so downstream `$derived`
   (banding, scales, metrics) don't recompute on unrelated changes.

The behavior-preserving target makes rule 1–3 enforceable: through the
foundation, the `layout-metrics` snapshot + parity harness must stay
**byte-identical** (same `displayRows` out), exactly like the RowKind Phase-1 and
multi-flex-B clean-but-validated patterns.

## 2. Data model

```ts
// kind: one-of — what a region fundamentally IS (drives default sizing/render)
type RegionKind =
  | "data" | "group_header" | "spacer" | "summary" | "header"   // today's RowKind
  | "panel"        // free-content child (details) — NEW, foundation-only stub
  | "axis_strip";  // per-group axis region (faceting) — NEW, foundation-only stub

// traits: many-of — orthogonal modifiers a region MAY carry
type RegionTrait = "expandable" | "sticky" | "editable" | "computed";

// scope: which level a region describes
type RegionScope = "table" | "group" | "overall";

interface RegionNode {
  id: string;
  kind: RegionKind;
  traits: ReadonlySet<RegionTrait>;   // empty for plain rows
  scope: RegionScope;
  depth: number;
  body:
    | { type: "cells"; row?: Row; group?: Group }   // column-aligned (today's rows)
    | { type: "free" };                              // full-width free content (panels)
  heightPolicy: "token" | "content";  // token = kind's height token; content = measured
  children?: RegionNode[];            // groups own rows; a data row may own a panel
}
```

Today's `DisplayRow = GroupHeaderRow | DataRow` (`types/index.ts:1047`) becomes
the `body.type === "cells"` case; `RowKind` (`lib/layout/row-kind.ts`) is the
`kind` enum, extended with `panel`/`axis_strip` and gaining the `traits`/`scope`
split. The **render unit** the flatten emits is a thin projection — `{ id, kind,
traits, depth, heightPolicy, body }` — NOT the node itself (no `children`), so
the render/layout layers never see the tree.

Foundation-only scope: `panel` and `axis_strip` kinds + the `traits`/`scope`
fields are **defined and threaded** but no authoring surface produces them yet
(no details API, no faceting config). The default tree built from today's
`spec.data.{rows,groups}` contains only the five existing kinds → byte-identical
output.

## 3. The flatten

```
flatten(tree) -> RenderUnit[]:
  n = countNodes(tree, expandedSet)      // pre-size
  out = new Array(n); i = 0
  dfs(node):
    if node is collapsed-group or unexpanded-panel: return  // structural skip
    out[i++] = project(node)             // thin unit, no children
    for child in node.children: dfs(child)
  dfs(root)
  return out
```

One pass, pre-sized, no intermediates. The collapse/expand checks read the
collapsed-groups + disclosure `Set`s (structural deps). `project()` copies the
flat fields only.

## 4. Dependency graph (what recomputes when)

| input changes | flatten? | computeRowLayout? |
|---|---|---|
| rows / sort / filter | ✅ | ✅ (new array) |
| group collapse | ✅ | ✅ |
| disclosure expand (`Set`) | ✅ | ✅ |
| container resize | ❌ | ✅ (same array) |
| measured row height | ❌ | ✅ (same array) |
| density / aspect | ❌ | ✅ |

Keep the two `$derived` boundaries the slices already have: a structural derived
(produces the unit array) and the layout derived (`computeRowLayout` over it).
Crossing them is the regression to guard against.

## 5. Per-context scale — DONE (2026-06-02)

Shipped first, as planned. The forest x-scale now resolves **by context**:

- **`lib/layout/forest-scale.ts`** — the single source of truth.
  `buildForestScale(ctx)` + `forestScaleRange`/`safeLogDomain`/`forestScaleKey`,
  keyed on a `ForestScaleContext { columnId, groupId, scaleType, domain, width }`.
  `groupId === null` = "whole column" today; faceting passes a real group id with
  a per-group domain *without changing call sites*.
- **Axis slice** (`axis.svelte.ts`) — replaced the global `axisComputation` +
  `xScale` (the first forest column's, shared across all) with a per-column
  `forestAxes: Map<colId, ResolvedForestAxis>` resolver + a `primaryForestAxis`
  back-stop. The global `xScale` is **retired**.
- **Both backends** build through the module: DOM via `forestAxes`, export
  (`computeXScaleAndClip`) via the shared range/clamp helpers.

This also fixed a latent **DOM↔export divergence**: the DOM shared the first
forest column's domain across every forest column while the export was already
per-column. Single-forest specs are byte-identical; multi-forest DOM now
converges to the (correct) export. Plus the global `xScale` retirement aligned
plot **annotations** with the marks (both now resolve through the primary
column's per-context scale; previously annotations used `plotRegion` and marks
used `axisLimits`).

Validation: 11 `forest-scale.test.ts` + 10 axis runes tests, full TS suite (923
bun / 201 vitest), R `devtools::test()`, export visuals unchanged, DOM
screenshot verified.

### Known follow-up — unify the mark domain on `plotRegion`

DOM forest marks still build their scale from `axisLimits`; the export builds
from `plotRegion` (= axisLimits + marker margin). Within each backend everything
is self-consistent, but live-DOM marks and the downloaded SVG differ by the
marker margin. Unifying the DOM onto `plotRegion` (the documented render domain,
what the export uses) is a small, isolated change — but it shifts *every* DOM
forest render by the marker margin, so it wants its own commit + browser visual
sign-off (and ideally a DOM mark-position test). Flagged in `axis.svelte.ts`.

## 6. Migration (behavior-preserving)

1. Introduce `RegionNode` + `buildRegionTree(spec, state)` that reproduces
   `fullDisplayRows`' current output, and `flatten()` that emits the unit array.
2. Swap `fullDisplayRows` to `flatten(buildRegionTree(...))`. Snapshot +
   parity harness stay **byte-identical** — the acceptance gate for the swap.
3. Extend `row-kind.ts` to `kind`+`traits`+`scope`; migrate the ~existing call
   sites (already centralized through `resolveRowKind`/`rowKindProps`).
4. Thread `panel`/`axis_strip` kinds + `heightPolicy: "content"` through the
   metrics pass (sum heterogeneous heights) — exercised by tests with synthetic
   panel nodes; no authoring surface yet.

## 7. Benchmark plan (lightweight — 200 rows)

Deliberately small and cheap to run, per the 2026-06-02 call. One fixture:
**200 rows, ~10 groups, one forest + a couple text columns.** Measure, before
and after each PR, checked in alongside the existing benches:

- **flatten cost** (bun, `srcjs/tests/perf/`): time `buildRegionTree` + `flatten`
  over the 200-row fixture; assert no regression vs the pre-refactor
  `fullDisplayRows` baseline.
- **measure-loop settle** (browser harness, `srcjs/tests/browser/`): the existing
  measure-then-commit harness on the 200-row fixture — assert it still settles in
  the same number of commit passes (no thrash from the tree).

No 1k/10k sweep this sprint; 200 rows is representative enough to catch a
constant-factor or extra-pass regression, which is the only perf risk the
structure-layer principle leaves open.

## 8. Phased plan — status (2026-06-02)

1. ✅ **Per-context scale + retire global `xScale`** (multi-flex E) — done
   (`forest-scale.ts`; commits on `feat/per-context-scale`).
2. ✅ **Bench** — `region-tree-bench.ts` (200-row flatten, budget-gated;
   build+flatten ≈ 0.013ms) + the existing `measure-rows.browser.ts` measure loop.
3. ✅ **Region-tree model + flatten** — `region-tree.ts` (`RegionNode` /
   `buildRegionTree` / `flatten`); DOM `fullDisplayRows` swapped; byte-identical;
   `RegionKind = RowKind | "panel" | "axis_strip"` (one kind enum, converged with
   `row-kind.ts`).
4. ⏸ **`kind`+`traits`+`scope`** — the *types* are on `RegionNode` already;
   widening `row-kind.ts`'s consumed vocabulary (traits/scope props, per-kind
   appearance fields) waits for a **consumer**. Per §8b the architect note,
   building this speculatively is explicitly discouraged ("don't widen beyond
   what's consumed today") — so it lands WITH details/faceting, not before.
5. ⏸ **Content-height seam for `panel`/`axis_strip`** — same reasoning: no
   feature produces those nodes yet, so the metrics-pass seam lands with the
   first consumer (details panels) rather than as dead scaffolding.

**The foundation (1–3) is complete.** Phases 4–5 are deliberately deferred to the
feature sprints (**details/disclosure**, then **faceting**) — they are the
consumers that justify the vocabulary, and the region tree's `panel`/`axis_strip`
kinds + `children` already give them a place to attach additively.

## 8b. Forward-compat with the cascade/theming rework (architect note, 2026-06-02)

A theming-cascade rework is being scoped in parallel. It is **not** this sprint's
job and must not change our scope — but the row-kind expansion intersects its
theme-access surface, so honor these cheap disciplines so our output stays
forward-compatible (full note: `dev/cascade-rework-note-to-row-kind-agent.md`):

1. **One getter for theme→kind appearance.** Route every row-kind theme read
   through a single `getRowKindAppearance(theme, kind) → { bg, fg, weight, … }`
   (or a small set). Renderers never reach into `theme.rowKind.X.Y` directly. The
   cascade rework swaps the getter's *insides* without touching renderers — the
   biggest hedge against a half-merged state.
2. **Kebab-case, attribute-safe kind discriminators.** The kind strings will be
   stamped as `data-row-kind="<kind>"` later (CSS attribute selectors drive
   paint; geometry stays JS-side). Use stable kebab-case: `group-header`,
   `section-header`, `summary`, `spacer`, `overall`. **⚠ Reconcile:** today's
   `row-kind.ts` enum is snake_case (`group_header`). The expansion must converge
   on kebab (rename the enum, or map enum→kebab at the stamp site) — decide once,
   no `groupHead`/`group_header`/`group-header` drift.
3. **Deliberate, minimal per-kind appearance vocabulary.** Every appearance field
   becomes a manifested consumed token (a COMPONENT_TOKENS row + drift-gate entry
   + CSS variable) later. Add only fields the renderer actually consumes; one
   canonical name per paint surface; no "for the future" fields.
4. **One-line comment per appearance field** ("summary row background fill",
   "group-header bottom rule color") — makes the eventual manifest mechanical.
5. **Don't pre-migrate** to CSS variables / data attributes, and **don't widen**
   the vocabulary or change scope to align with the rework. It isn't landing
   first; this foundation stands on today's theme shape.
6. **HC-mode glyphs as real elements**, never `::before`/`::after` — pseudo-
   elements don't survive SVG export (geometry/glyph presence is JS-side in both
   the browser and V8 paths).

## 9. Don't-foreclose (deferred sub-decisions)

The foundation must *allow* each without deciding it now:

- **Per-group axis placement** (faceting) — leaning footer-bottom; the model
  allows an `axis_strip` region as a group's last child.
- **Details in static (V8/SVG) export** — render-expanded vs collapse; the
  flatten's expanded-`Set` is the seam (static export can force-expand or skip).
- **Density `factor` vs named profiles** (`sizing-model.md` §6) — orthogonal to
  the tree; the `heightPolicy: "token"` path reads whatever density resolves.
- **Row drag-resize ontology** (`sizing-model.md` §8) — edits the kind's height
  token; orthogonal, not in this sprint.

## 10. Verification

`bun test` (new flatten + region-tree unit tests; byte-identical
`layout-metrics` snapshot through the swap) · `npm run check` · the 200-row
bench (no regression) · R `devtools::test()` + parity tests (per-context scale
PR) · `render_visual_tests()` + browser measure harness · `quarto render`.

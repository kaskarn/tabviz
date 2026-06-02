# Row types — classification, rendering, and theming

Status: **living design record — Phase 1 shipped.** Companion to
`sizing-model.md`. The canonical `resolveRowKind` + `RowKindProps` registry is
built (`srcjs/src/lib/layout/row-kind.ts`, see §2); the open threads are the fuller
renderer/trait registry and per-kind Tier-3 theme clusters. This records the
design thread on tabviz's *row-type* subsystem — the logic that classifies a
row into a kind (data / group-header / section-header / summary / spacer /
overall) and renders, sizes, and themes it differently.

A row type is a **discriminator** that changes data-level rendering, sizing, and
theming — distinct from a style *token* (a value). The two meet (each kind maps
to size tokens + a theme cluster) but are different concepts.

> The theme **resolution** rework (T1 inputs / role unification / Tier-3
> clusters) was in flight when this was written. The per-kind theme clusters
> proposed here (§4) are Tier-3 component clusters and **must be designed with
> that effort**, not retrofitted.

---

## 1. Current reality — four overlapping concepts

| # | concept | where | values |
|---|---|---|---|
| 1 | `DisplayRow.type` (structural, *computed* from grouping) | `types/index.ts:1034` | `group_header` \| `data` |
| 2 | `row.style.type` (authored) | `types/index.ts:8` | `data` \| `header` \| `summary` \| `spacer` |
| 3 | `GroupSummary` (R data structure that *synthesizes* summary rows) | `R/classes-core.R:117` | — |
| 4 | `data.overall` (a summary diamond that is **not a row**) | `types/index.ts:126` | — |

Axes 1 and 2 collide on `"data"` (axis 1: "not a group header"; axis 2: "a real
datum"). The structural-vs-authored split is an implementation artifact: the
renderer dispatches on *both*, via scattered `if` checks across
`layout-zoom.svelte.ts`, `TabvizPlot.svelte`, `export/svg-generator.ts`,
`CellContent.svelte`.

### The structural diagnosis

**This is the row-side analogue of the column system — but columns got a
schema + dispatch + registry + drift-gate (`schema/columns/`, `consumedBy`), and
rows got none of it.** Every row-kind behavior is hand-coded in ~4 places. That
asymmetry is the root of every symptom below.

### Incoherences (factual)

- **`header` is half-implemented:** no theme cluster, no distinct render path, no
  SVG tag — it's just a styled data row. "Section header" doesn't really exist.
- **`spacer` is ad-hoc:** hardcoded `rowHeight/2`, no theme control, `=== "spacer"`
  checks sprinkled across files.
- **`summary` is overloaded** across three contexts (authored row / GroupSummary-
  synthesized / `overall` diamond), never unified.
- **Theming asymmetry:** `group_header` is richly themed (`rowGroup.L1/L2/L3`);
  the authored kinds have no themeable cluster — appearance is faked via per-row
  author styles (an inversion: theme-default work pushed onto the author).
- **Parity by duplication:** DOM and SVG paths diverge per kind.

---

## 2. Proposed model — one `RowKind` + a registry (mirror the column system)

> **Status (Phase 1, built):** `srcjs/src/lib/layout/row-kind.ts` now holds the
> canonical `resolveRowKind(dr)` (replacing svg-generator's inline `rowKindOf`,
> now incl. the `header` kind it had dropped) + a `RowKindProps` table
> {`banded`, `measuresWidth`, `rendersCells`, `summaryMarker`} encoding today's
> scattered predicates. The drift sites are routed through it (banding
> `isStyled`, the 3 width-skip copies, metrics `rowKindOf`); behavior-preserving
> (zero snapshot drift, R+TS green). Remaining: the ~40 render-branch call sites
> still classify inline (incremental, harness-gated); the full *registry* with
> renderers/traits/scope (§ below) is future work.

Collapse the four concepts into a single **resolved `RowKind`** computed per
DisplayRow (merging grouping-derived + authored inputs), dispatched through a
**registry** the way columns have a schema. Each kind declares:

| kind | size policy | render policy | theme cluster | authoring |
|---|---|---|---|---|
| **data** | `rowHeight` (content-floored) | schema cells | `theme.row.*` | default / column-mapped |
| **group-header** (generated) | derived from label typography (sizing-model §5b) | full-span label + chevron, collapsible | `rowGroup.L1/L2/L3` | from grouping |
| **section-header** (authored) | derived | full-span authored label/divider | **new** cluster | `add_section_header()` |
| **summary** (`scope: group\|overall`) | author's choice | schema cells + summary mark | **new** cluster | from `GroupSummary` / `overall` |
| **spacer** | `spacerRowHeight` | empty | minimal | `add_spacer()` |

Key moves:
- **Dispatch on one resolved `kind`, declared once** — kills scattered branches;
  same payoff the column schema gave. Consider a row-kind drift gate.
- **Unify `summary`** as one kind with `scope: group | overall`; the diamond is a
  render policy of summary kinds carrying a forest mark. Folds in concepts 3 & 4.
- **Promote `section-header`** as a real kind, distinct from the *generated*
  `group-header`. Naming generated-vs-authored kills the biggest confusion.
- **One shared DOM+SVG kind-emitter** → parity by construction.

### Connections (why this ties the whole sizing thread together)

- The **"band type"** in the drag-resize ontology (`sizing-model.md` §8) **is
  `RowKind`.** Drag edits the kind's height token.
- **Size policy per kind feeds `computeTableMetrics`** — RowKind is the
  discriminator, the height token is the value (the token-vs-type split).
- One shared emitter kills DOM/SVG duplication — same parity argument as columns.

---

## 3. Boundary: theme vs kind vs author

- **RowKind** owns *structure & behavior* (what elements exist, collapsibility,
  selectability, height *policy*, mark *presence*).
- **Theme** owns *appearance* (bg/fg/rule/banding, typography, mark fill/stroke;
  size/mark *values* via tokens & density).
- **Author/data** owns *classification* (which kind) + per-row overrides.

The policy-vs-value split recurs (sizing, marks): the kind says *which*
token/recipe applies; the theme supplies the *value*. Density is the theme input
that fills per-kind size values.

---

## 4. DECIDED 2026-05-29 — themes get broad, optional appearance control

**Themes may optionally exercise broad, fine-grained control over all
*appearance and decoration* of every row kind — including toggling ornament — so
a theme can be a complete, portable encoding of an organization's house style.
The one hard boundary: a theme may not alter *function or structure*
(collapsibility, selectability, which elements semantically exist) or invent
kinds.** Broad over the visual; bounded at the functional.

Implications (the boundary is what *protects* the decision — it keeps broad theme
power from becoming a parity hazard or breaking interaction):

1. **"Optional" = the existing nullable cascade.** Every appearance/decoration
   aspect is a nullable Tier-3 field: unset → kind default; set → theme wins. No
   separate "advanced mode" needed.
2. **Promotes "kill hardcoded appearance" from cleanup to prerequisite.** Broad
   control is fiction wherever the renderer bakes a value the theme can't reach
   (SVG text inset `10`, `color-mix()` literals, magic `+6`, fallback hex). A
   theme is only as powerful as the least-themeable value in the render path →
   the single resolved appearance model + one shared emitter + no hardcoded
   escapes becomes a **hard requirement**.
3. **Surface explosion absorbed by the cascade** (Tier1→2→3 derivation): orgs set
   a few inputs, most derive, fine knobs sit dormant. Design the clusters *with*
   the theme-rationalization effort.
4. **Broad ≠ overriding the author.** Precedence unchanged: theme cluster
   (default, now rich) → per-row author override → interactive paint.
5. **Portability is a contract:** a theme must self-determine look (serialize
   completely; nothing appearance-related decided outside it). A theme is a
   shippable house-style artifact, identical in browser and V8 export.

**Priority reorder:** the "single appearance source + no hardcoded fallbacks" and
"per-kind Tier-3 clusters" items move from quality cleanups to *enabling work* —
front-load them.

---

## 6. Vision & near-term targets (decided 2026-05-29)

Thinking big *before* building the registry, so its shape is pinned by the
hardest near-term targets rather than retrofitted. Two conceptual moves unlock
the vision:

- **A row has `kind` (one-of) + `traits` (many-of) + `scope` (group/overall/
  table).** "Details" is a *trait* (disclosure), not a kind; "summary" is a
  *scope* (group/overall). Don't collapse all of it into the `kind` enum.
- **The table is a *tree of regions*, not a flat row list.** group → rows, a data
  row → a details panel, a group → an axis strip / footer. The renderer
  *flattens* the tree to `displayRows` for layout. The current
  flat-`displayRows`-with-`group_header`-interleaved is the limiting model.

### Candidate kinds / traits (backlog)

Kinds: group-footer/subtotal (pooled + heterogeneity), **details/disclosure**,
annotation/note (full-width prose), nested subtable, divider/rule, continuation
("…N more" / "continued" / repeated running group-context for print), empty-
state/skeleton. Traits: expandable, sticky/pinned, editable, computed (delta/
pooled), conditional classification (kind/traits assigned by data rule).

### Near-term targets (author priority)

**1. Faceting — per-group forest axes, incl. mixed scale TYPES.**
Same forest column, group 1 linear (LDL β, null 0), group 2 log (MACE HR, null
1). Requires per-group **scale type, domain, null line, tick format, axis
label** — all independent. Consequences:
- forest column stops having "a scale" → **one scale per (column × group)**,
  resolved by *group context*; a forest cell places marks via its group's scale.
- the axis **must repeat per group** (mixed scale types can't share one footer
  axis) → axis moves from a column-footer element to a **per-group axis region**.
- the column header can't name the measure → **effect label moves onto the
  per-group axis** (group region owns axis strip: scale + label + null line).
- groups share the pixel **range**, not the domain (faceted; stack & align).
- inverse of `SplitForest`/`computeSharedAxis` (which *shares* one axis across
  specs); axis computation must become **group-scoped**.
- lands in the row system as: per-context forest config + a **per-group axis
  region**.

**Faceting authoring interface — TABLED 2026-05-29 (delicate, do not pre-build).**
Two candidate surfaces, NOT yet decided:
- **group-level config** — `group(..., forest=list(scale="log", ref=1,
  label="HR"))` overriding the column's forest options.
- **data-mapped / row-wise** — `scale = ~is_log` or a column/condition that
  resolves scale per row (mirrors the existing *style-mapping* pattern,
  `marker_color_col` et al.; arguably more consonant with the codebase).
The knot: **"what scale a row uses" and "where the axis is drawn" must stay
coherent.** An axis describes a *set* of rows; row-wise-arbitrary scale can
produce scale boundaries that don't align with any visual grouping → no coherent
place to draw the axis. Row-wise scale only reads cleanly when the partition is
contiguous (i.e. coincides with groups). Resolve the two surfaces together, later.
**Survives regardless of interface (the only part the build needs now):** forest
scale must **resolve by context, not globally** — the plot/registry foundation
needs a per-context scale lookup, whether the context is "group" or "row-mapped."

**2. Details / disclosure rows (keystone).** A data row owns a child panel:
free content (markdown / chart / nested tabviz / provenance / risk-of-bias),
**fully content-driven height**, disclosure state, full-width (not column-
aligned). Breaks four grid assumptions → see requirements below.

(Deprioritized for now: group-footer / summary kinds.)

### The convergence

Faceting needs *a group region that carries axis config and owns an axis strip*;
details needs *a data row that owns a free-content panel*. **Same primitive: a
region node that (1) carries its own config and (2) can own child regions whose
body may be free content and whose height is its content's.** Build that → both
are additive. Build "row = fixed-height column cells + one global axis" → both
are blocked.

### Foundational requirements (the constraint set for the build)

1. A row-system node is a **region in a tree** that may **own children**;
   `displayRows` is a *flatten* of that tree for layout.
2. Separate **kind / traits / scope**; **disclosure** is a trait owning a child
   region.
3. A region body is **either column-cells or free content**.
4. Height policy admits **fully content-driven** everywhere (no fixed-height
   assumption); the metrics pass sums a tree of heterogeneous region heights
   (panel height, per-group axis-strip height) — ties to [[sizing-model]] §1.4.
5. A **group node carries config** (incl. per-group forest scale/axis) and may
   own an **axis region**; forest-cell scale resolves via **group context**.
6. One shared **DOM+SVG emitter per region type** (parity), with an explicit
   answer for **details-in-static-export**.

### Open sub-questions (non-blocking)

- Details in static (V8/SVG) export — render expanded, or collapse?
- Per-group axis placement — header-top / **footer-bottom (leaning)** / dedicated
  strip per group?

## 5. Open decisions

- [ ] Collapse to one resolved `RowKind` + registry (the column-schema mirror)? §2
- [ ] First-class `section-header` kind, distinct from generated `group-header`? §2
- [ ] Unify group-summary + `overall` under one scoped `summary` kind? §2
  - **Tension noted (deferred to the registry build, 2026-06):** the summary
    diamond renders via TWO independent paths today — group/row summaries go
    through `RowInterval.svelte` (gated by `rowKindProps().summaryMarker`), while
    `spec.data.overall` is a singleton rendered outside the displayRows loop in
    both TabvizPlot and svg-generator. Harmless now (visually identical), but
    once per-kind theming lands (§4) `overall` has no `RowKind` to theme. Fix
    when building the registry: give `summary` a `scope: group | overall`, route
    both through one diamond emitter. Do NOT fix piecemeal before then.
- [x] **DECIDED 2026-05-29 — decoration surface = per-kind nullable fields over a
  restrained default baseline. NO global `chrome: minimal|standard|rich` dial.**
  Rationale: decoration is a *selection* axis ("which 1–2 elements carry the
  weight"), not a *magnitude* axis — a global level can only slide everything
  together and can't express "one loud, the rest quiet," which is what authors
  actually want. The baseline default is deliberately quiet & coherent (pick a
  couple of cues, e.g. subtle banding *or* bottom rules — not both), so:
    - **emphasis is opt-in** — turning a field *on* adds a strong element; nothing
      loud is on by default, so visual overload can't happen by accident;
    - **a theme is "baseline + a few deltas"** — nullable fields over the cascade
      mean an author sets 2–3 fields and the rest derive (little code);
    - **no preset to keep coherent** across kinds (removes the maintenance burden
      a `rich`/`minimal` preset would carry).
  Reconciles with [[don't pre-bake defaults]]: these are aesthetic *baselines*,
  fully overridable, embodying "few strong cues, rest quiet" — not guessed config.
  If usage later shows orgs converging on the same combos, make those *named
  starter themes*, not a magnitude axis.
- [ ] Authoring helpers (`add_section_header()`, `add_spacer()`, `add_summary()`)
  + JS authoring parity, alongside the existing column-mapping path.

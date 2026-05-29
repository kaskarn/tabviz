# Schema architecture

The deep-dive companion to `README.md`. Reading this top-to-bottom is
the fastest way to get a coherent mental model of why each piece
exists and how they fit together.

## Vision

Tabviz columns historically mixed three concerns into one structure:
*what options exist*, *how to render a cell*, and *how the rendering
should look*. The schema architecture pulls them apart.

The deep principle:

> **Renderers commit to structure. Themes commit to style.
> Conditions and ordinals commit to typed row-level state.
> Behaviors commit to type-dispatched value transforms.**

Each layer has one job. They compose via small, well-typed contracts.
The result: adding a new column type, a new theme, or a new behavior
becomes a single self-contained edit instead of an N-file change.

## System map

There are eleven concepts to know. They sound like a lot; in practice
most of them are small contracts and a tiny amount of code.

| # | Concept | What it captures | Where it lives | When it runs |
|---|---|---|---|---|
| 1 | **Schema** | Per-column-type metadata: options, slots, inheritance, bucket | `src/schema/columns/*.ts` | Static |
| 2 | **Option** | A single declarative knob: key, control, default, kind | `OptionSpec[]` on each schema | Editor / spec build |
| 3 | **Behavior** | Type-dispatched value-transform function | Registered via `extend.ts` | Spec build + per-cell |
| 4 | **Renderer** | `(value, opts, ctx, parents) → RenderNode`; structural only | Registered via `extend.ts` | Per-cell render |
| 5 | **Bank** | Cross-cutting widget state (footnotes / axes / legends / conditions) | `WebSpec.banks` | Spec build |
| 6 | **Condition** | Named pre-computed row predicate (boolean vector) | `banks.conditions[]` | Spec build (static after) |
| 7 | **Categorical / Ordinal** | Abstract schemas declaring typed level sets | Schema inheritance | Static + spec build |
| 8 | **Variant** | Curated rendering recipe within a schema | `options.<bucket>.variant` | Render time |
| 9 | **MappedValue** | Discriminated union for style override values | `column.styleMapping.*` | Render time |
| 10 | **Tag** | Semantic structural label on a RenderNode | `RenderNode.tags[]` | Emitted by renderer |
| 11 | **Theme nodeRule** | Style finalization keyed by tag | `WebTheme.nodeRules{}` | After renderer, before paint |

## Concept deep-dives

### 1. Schema

A `ColumnSchema` declares the metadata for a column type — concrete
(appears in the picker) or abstract (structural / inherited only).

```ts
interface ColumnSchema {
  key: string;                  // identifier; used in registry + inheritance
  label: string;                // editor display
  abstract?: boolean;           // true: not in picker; just a parent
  inherits?: string | string[]; // single or multi-parent inheritance
  bucket?: string;              // wire location: column.options[bucket]
  type?: ColumnType;            // wire column.type
  slots?: SlotSpec[];           // field-binding requirements
  options: OptionSpec[];        // editor knobs
  optionOverrides?: ...;        // adjust inherited defaults
  variants?: VariantSpec[];     // curated rendering recipes (proposed)
  suppressedOptions?: string[]; // hide inherited options that don't apply
  mutuallyExclusive?: string[][]; // declared exclusive option groups
  fixed?: Partial<ColumnSpec>;  // non-tweakable column-spec values
}
```

Inheritance is multi-parent and DAG-shaped:

```
   BASE
    │
    ├── TEXT ─── REFERENCE
    │     │
    │     ├── NUMERIC ─── N, CURRENCY, PERCENT, PVALUE,
    │     │             INTERVAL, RANGE, EVENTS, HEATMAP
    │     │
    │     └── DATE
    │
    ├── CATEGORICAL ─── BADGE, ICON
    │       │
    │       └── ORDINAL ─── STARS, PICTOGRAM-rating
    │
    ├── VIZ ─── VIZ_FOREST, VIZ_BAR, VIZ_BOXPLOT, VIZ_VIOLIN
    │
    └── (plus sparkline, ring, img — inherit base directly)
```

The resolver topo-sorts; descendants always render after ancestors.

### 2. Option

An `OptionSpec` is one knob the editor surfaces. It declares its
control kind, default, validation hints, optional visibility, and
the `kind` discriminator that classifies it on two axes simultaneously:
editor grouping AND theme-side policy.

**`kind` is a required contract** (Sprint 1 PR 4). The drift gate
fails on any concrete option that doesn't declare it. Three values:

- **`"core"`** — data shape / behavior. Changes what the column
  *computes* (decimals, scale, format string, slot field, thresholds).
  Spec authors set these. Theme-side surfaces (Sprint 3+
  `theme.column_defaults`) MUST NOT touch `core` options — they
  belong to the author of the spec.
- **`"styling"`** — per-row visual override. MappedValue<T>
  references (bold/italic/color/bg/token), palette/color knobs.
  Themes may set defaults.
- **`"editor"`** — UI-only knob. Header text, visibility toggles,
  layout density, "show value label" checkboxes. Themes may set
  defaults.

The distinction is presentational AND policy. Editor groups core
options in the main flow and styling/editor knobs separately.
Sprint 3 will reject `theme.column_defaults` writes against
`kind: "core"` options at construction time.

Wire location is via `at`:
- `"bucket"` (default) → `column.options[bucket][key]`
- `"top"` → `column.options[key]` (legacy fields like `naText`)
- `"fixed"` → top-level `column[key]` (used by BASE for header/align/width/sortable)

### 3. Behavior

Type-dispatched logic that historically lived in scattered switches
across the codebase. The schema becomes the home; each is a method
on `SchemaBehaviors`:

```ts
interface SchemaBehaviors {
  sortKey?:             (value, opts, ctx, parents) => SortableValue;
  estimateWidth?:       (value, opts, ctx, parents) => number;
  emitSource?:          (spec, parents) => string;
  searchKey?:           (value, opts, ctx, parents) => string;
  tooltipText?:         (value, opts, ctx, parents) => string | null;
  aggregate?:           (values, opts, parents) => unknown;
  contributeBanks?:     (column, spec) => BankContribution;
  contributeConditions?: (column, spec) => ConditionEntry[];
  formatValue?:         (value, opts, ctx, parents) => string;   // NEW: value→string transform
}
```

Each behavior has access to its ancestors via the `parents` proxy.
`PERCENT.formatValue` can call `parents.numeric.formatValue` to
delegate; `INTERVAL.sortKey` can read `options.interval.point` and
return the corresponding raw value.

### 4. Renderer

The renderer's job: produce a **structural** RenderNode tree. It does
NOT commit to colors, weights, sizes — that's the theme's job via
tags + nodeRules.

```ts
type CellFormatter = (
  value: unknown,
  options: ColumnSpec["options"],
  ctx: RenderContext,
  parents: ParentRenderers,
) => RenderNode;
```

A renderer can:
- Call `parents.x.formatValue(...)` to reuse an ancestor's value transform.
- Call `parents.x.render(...)` to delegate rendering to an ancestor.
- Use `compose(...)` to combine multiple child outputs.
- Use `tag(node, "name")` to label parts for theme finalization.

The PERCENT case in full:

```ts
registerRenderer("percent", (val, opts, ctx, parents) => {
  // 1. PERCENT's pre-format contribution
  const scaled = opts.percent?.multiply !== false ? Number(val) * 100 : Number(val);

  // 2. Reuse NUMERIC's formatValue behavior (NOT its renderer)
  const formatted = parents.numeric.formatValue(scaled, opts, ctx);

  // 3. PERCENT's post-format contribution
  const withSuffix = opts.percent?.symbol !== false ? formatted + "%" : formatted;

  // 4. Hand to TEXT to render (handles font / color / align / naText / maxChars)
  return parents.text.render(withSuffix, opts, ctx);
});
```

Each step is explicit. The "render pipeline" lives in the leaf, not
in the inheritance chain. Inheritance provides the toolkit; the leaf
orchestrates.

### 5. Bank

First-class storage for cross-cutting widget state. Four kinds today:

- `footnotes[]` — numbered citations / methods notes
- `axes[]` — plot axes (rich state: position, color, per-group, shared)
- `legends[]` — color/shape keys for viz columns
- `conditions[]` — named row predicates (more below)

Each entry has a stable `id` and optional `producer` tag (column id).
Bank entries can be:

- **Author-supplied** via `tabviz(footnotes = ..., conditions = ..., ...)` — flow through the wire.
- **Schema-contributed** via the `contributeBanks` / `contributeConditions` behaviors — added at spec resolution.

`computeEffectiveBanks(spec)` is the pure dispatcher: walks columns,
calls contribute behaviors, accumulates entries, stamps `producer:
column.id` on derived entries. Removing a column removes its derived
entries on the next dispatch (auto-clean).

### 6. Condition

A `Condition` is a **named, pre-computed row predicate** evaluated
once at spec-construction time over the whole-table view:

```ts
interface ConditionEntry {
  id: string;          // referenced by name
  label?: string;
  kind: "boolean";     // future: numeric, string
  values: boolean[];   // aligned to data.rows order
  ruleText?: string;   // original rule (for display + round-trip)
  category?: string;
  producer?: string;
}
```

Authored R-side:

```r
condition("significant", ~p < 0.05 / nrow(data))
```

Or TS-side:

```ts
condition({ name: "significant", rule: (r, d) => r.p < 0.05 / d.length })
```

The constructor *evaluates the rule against the data immediately*
and stores the resulting boolean vector. The renderer never re-
evaluates: condition values are static for the lifetime of a spec.
Re-evaluation only happens when the spec rebuilds (data changes).

Referenced via `cond("significant")` from style mappings:

```r
col_text("study", bold = cond("significant"))
```

Wire shape:

```ts
column.styleMapping.bold = { kind: "condition", name: "significant" }
```

Schema-contributed conditions are an **available capability**, not
a default behavior. The `contributeConditions` hook on a schema can
emit conditions when its column is present — but *whether a given
schema should auto-emit is a per-schema UX decision* and not always
advisable:

- A pvalue column COULD auto-emit `significant_<col_id>`, but with
  multiple pvalue columns (adjusted vs unadjusted; multi-trial)
  this becomes a cluttered bank with non-obvious naming and
  potentially conflicting thresholds. Better: leave significance
  authoring explicit.
- Ordinal columns are a better fit — the `levels[]` definition
  naturally yields a fixed `is_<level>` / `above_<level>` set with
  no naming ambiguity.

The mechanism lands in Phase 4.5; concrete auto-emit behaviors get
added schema by schema as the UX of each becomes clear.

### 7. Categorical / Ordinal

Abstract schemas that describe **the semantic shape of the data**, in
between `FieldCategory` (wire data type: string / numeric / ...) and
concrete rendering schemas (badge / icon / stars / ...).

```ts
const CATEGORICAL_SCHEMA: ColumnSchema = {
  key: "categorical",
  abstract: true,
  inherits: "base",
  options: [
    { key: "levels", control: "custom", default: [],
      customComponent: "LevelSetEditor",
      hint: "Defined value set" },
  ],
};

const ORDINAL_SCHEMA: ColumnSchema = {
  key: "ordinal",
  abstract: true,
  inherits: "categorical",
  options: [],                  // same `levels`; order is now meaningful
};
```

Inheritance unlocks behavior overrides at the right semantic level:

- ORDINAL.sortKey returns the level INDEX, not lex order
- CATEGORICAL.aggregate returns the mode; ORDINAL.aggregate returns the median
- CATEGORICAL.contributeConditions emits one condition per level
- ORDINAL.contributeConditions emits "above_<level>" / "below_<level>" thresholds

Concrete schemas inherit:

```
badge       inherits [categorical]         → variant/color per level
icon        inherits [categorical]         → glyph per level
stars       inherits [ordinal]             → max_glyphs derives from levels.length
pictogram   inherits [base, ordinal?]      → ordinal mode is optional
ring        inherits [numeric, ordinal?]   → threshold-band coloring
```

Level sets live as a bank entry (`banks.levelSets[]`) so multiple
columns can reference one named set (`severity_levels` used across
three columns).

### 8. Variant

A **curated rendering recipe** declared by a schema. Variants exist
because schemas can't anticipate every formatting permutation; instead
of exposing fine-grained per-member overrides, schemas ship a small
list of well-designed alternatives.

```ts
INTERVAL_SCHEMA.variants = [
  { id: "traditional",   label: "Traditional",
    description: "0.85 (0.72, 0.99) — bounds in parens" },
  { id: "bracket_muted", label: "Bracket, muted bounds",
    description: "0.85 [0.72–0.99] — bounds in brackets, secondary color" },
  { id: "plus_minus",    label: "Plus–minus",
    description: "0.85 ± 0.14 — half-width as offset" },
  { id: "stacked",       label: "Stacked",
    description: "0.85 / (0.72, 0.99) — point on first line, bounds below" },
];
```

Wire: `column.options.interval.variant = "bracket_muted"`. The
renderer dispatches on `opts.variant`:

```ts
registerRenderer("interval", (row, opts, ctx, parents) => {
  const fmt = (key: string) => parents.numeric.formatValue(row[opts.interval[key]], opts, ctx);
  const p = fmt("point"); const l = fmt("lower"); const u = fmt("upper");
  switch (opts.interval?.variant ?? "traditional") {
    case "traditional":
      return compose(text(p), tag(text(`(${l}, ${u})`), ["interval-range"]),
                     { sep: " " });
    case "bracket_muted":
      return compose(text(p), tag(text(`[${l}–${u}]`), ["interval-range", "minor"]),
                     { sep: " " });
    // ...
  }
});
```

Variants inherit through the chain: `viz_forest(variant = "bracket_muted")`
propagates to the text-label component.

### 9. MappedValue (styleMapping tagged union)

Every style-override option goes through a four-mode discriminator:

```ts
type StyleMappingValue<T> =
  | { kind: "theme" }                       // theme cascade decides
  | { kind: "static",    value: T }         // explicit value
  | { kind: "field",     field: string }    // per-row from data column
  | { kind: "condition", name: string };    // per-row from named condition
```

In the editor: a `Theme | Static | Mapped | Condition` segmented
control + the appropriate sub-control below.

Back-compat: today's `bold = "highlight_col"` (bare string) gets
treated as `{ kind: "field", field: "highlight_col" }` by the renderer's
normalize-on-read step. New wires use the tagged union; old wires
still work.

### 10. Tag

A semantic label emitted by the renderer onto a RenderNode. The
renderer commits to *what role this part plays* but not *how it
looks*.

```ts
interface RenderText {
  kind: "text";
  value: string;
  style?: TextStyle;   // explicit overrides (rare; tags preferred)
  tags?: string[];     // ["interval-range", "minor"], etc.
}
interface RenderGroup {
  kind: "group";
  children: RenderNode[];
  layout?: ...;
  tags?: string[];
}
```

Tags are flat strings; multiple per node. Conventions:

- **Structural tags** (renderer-emitted, per-schema): `interval-point`,
  `interval-range`, `forest-point`, `forest-ci`, `pictogram-glyph`,
  `pictogram-label`, `footnote-marker`, `axis-label`, ...
- **Token tags** (universal cross-column states): `emphasis`, `muted`,
  `accent`, `fill`, `bold` — reserved subset; theme rules ship for these.
- **Condition tags** (driven by satisfied conditions): the condition
  name becomes a tag when applied. `tag(text(val), ["significant"])`.
- **Variant-modifier tags** (variant-emitted): `minor`, `bracketed`, etc.

### 11. Theme nodeRule

The theme's reply to a tag. Themes declare:

```ts
interface WebTheme {
  // existing cascade fields
  nodeRules?: Record<string, NodeRule>;
}
interface NodeRule {
  text?: Partial<TextStyle>;
  group?: Partial<GroupStyle>;
  /** Wrap node in extra structure */
  wrap?: "subscript" | "superscript" | "newline" | null;
  /** Hide entirely */
  hidden?: boolean;
  /** Custom transform — escape hatch */
  transform?: (node: RenderNode) => RenderNode;
}
```

A theme's `nodeRules` is the visual contract for tags. Examples:

```ts
// BMJ (default): minimal rules
BMJ_THEME.nodeRules = {
  emphasis: { text: { weight: "bold" } },
  muted:    { text: { color: "muted" } },
};

// Lancet: bounds get muted secondary
LANCET_THEME.nodeRules = {
  ...BMJ_THEME.nodeRules,
  "interval-range": { text: { size: "minor", color: "secondary" } },
};

// Compact: bounds become subscript
COMPACT_THEME.nodeRules = {
  ...BMJ_THEME.nodeRules,
  "interval-range": { wrap: "subscript" },
};
```

The renderer never changes; the look does.

`applyTheme(tree, nodeRules)` is the finalization pass: walks the
RenderNode tree, matches each node's tags against the rules table,
applies (merges styles, wraps structurally, hides, transforms). Last
matching rule per property wins (no CSS specificity).

## The pipeline

```
                ┌────────────────────┐
                │  Author (R or TS)  │
                └──────────┬─────────┘
                           │
       ┌───────────────────▼────────────────────┐
       │  WebSpec wire shape                    │
       │  • data, columns                       │
       │  • banks: footnotes, axes, legends,    │
       │           conditions, levelSets        │
       │  • theme (with nodeRules)              │
       └───────────────────┬────────────────────┘
                           │
       ┌───────────────────▼────────────────────┐
       │  computeEffectiveBanks(spec)            │
       │  • walks columns                        │
       │  • calls contributeBanks /              │
       │    contributeConditions per schema      │
       │  • merges author + derived              │
       │  • numbers footnotes; stamps producer   │
       └───────────────────┬────────────────────┘
                           │
       ┌───────────────────▼────────────────────┐
       │  Per-cell rendering loop                │
       │                                         │
       │  1. resolve schema → (type, bucket)     │
       │  2. renderer = getRenderer(schema.key)  │
       │  3. tree = renderer(value, opts, ctx,   │
       │              parents)                   │
       │     → renderer emits TAGGED RenderNodes │
       │     → can call parents.x.formatValue or │
       │       parents.x.render                  │
       │  4. tree' = applyTheme(tree,            │
       │              theme.nodeRules)           │
       │  5. mount tree' (browser DOM / SVG)     │
       └─────────────────────────────────────────┘
```

The same flow handles widget chrome (footnote bar, axis strips,
legends): the host calls a "chrome renderer" per bank kind, the
renderer produces tagged RenderNodes, theme finalization applies.

## Worked example

A meta-analysis forest plot with significance highlighting:

```r
tabviz(
  data        = meta,
  conditions  = list(
    condition("significant", ~p < 0.05 / nrow(meta))
  ),
  columns     = list(
    col_text("study", bold = cond("significant")),
    col_n("n_total"),
    col_pvalue("p"),
    col_interval("hr", "lo", "hi",
                 header = "HR (95% CI)",
                 variant = "bracket_muted"),
    viz_forest(point = "hr", lower = "lo", upper = "hi", scale = "log")
  ),
  footnotes   = list(
    tv_footnote("methods", "p threshold = 0.05 / n (Bonferroni).")
  ),
  theme       = "lancet"
)
```

What happens, in order:

### Spec build
- R evaluates `~p < 0.05 / nrow(meta)` → boolean vector of length nrow.
- Stored as `banks.conditions[0] = { id: "significant", values: [...] }`.
- Footnote stored as `banks.footnotes[0] = { id: "methods", text: "..." }`.
- Each column is serialized with its options + the tagged-union
  styleMapping (col_text's bold becomes `{ kind: "condition", name: "significant" }`).

### Bank dispatcher
- Walks columns; `viz_forest.contributeBanks` adds an `axes[0]` entry.
- (Schema-side `contributeConditions` is available; whether pvalue
  auto-emits a significance condition is left to the author since
  multi-pvalue cases create naming ambiguity.)
- Numbers footnotes: methods → index 1.
- Final `effectiveBanks` returned for downstream consumers.

### Rendering `col_text` row 3 (a significant study)
- Resolves schema chain: BASE → TEXT.
- TEXT renderer reads `column.styleMapping.bold = { kind: "condition", name: "significant" }`.
- Looks up `effectiveBanks.conditions.find("significant").values[3]` → `true`.
- Emits: `tag(text("Smith 2020"), ["bold"])`.
- Theme finalization: Lancet's `nodeRules.bold = { text: { weight: "bold" } }` applies.
- Final RenderText: bold "Smith 2020".

### Rendering `col_interval` row 3 (variant: bracket_muted)
- Resolves chain: BASE → TEXT → NUMERIC → INTERVAL.
- INTERVAL renderer formats point/lower/upper via `parents.numeric.formatValue`.
- Variant `bracket_muted` branch:
  ```ts
  return compose(
    tag(text("0.65"), ["interval-point"]),
    tag(compose(text("0.45"), text("0.91"), { sep: "–", bracketStart: 1 }),
        ["interval-range", "minor"]),
    { sep: " " }
  );
  ```
- Theme finalization:
  - `nodeRules["interval-range"] = { text: { size: "minor", color: "secondary" } }` → bounds become small + secondary.
  - `nodeRules["minor"]` (cross-cutting) further applies if present.
- Final: "0.65 [0.45–0.91]" with bounds visually smaller + muted.

### Rendering `viz_forest` row 3 (Phase 7)
- VIZ_FOREST renderer reads `effectiveBanks.axes[0]` for the axis range.
- Emits SVG point + CI bar; tags components: `["forest-point"]`, `["forest-ci"]`.
- Theme nodeRules can re-style.

### Widget chrome
- Host renders the footnote bar: lists `effectiveBanks.footnotes`; tags `["footnote", "footnote:methods"]`.
- Lancet's nodeRule for "footnote" positions / sizes them.

### Sort interaction
- User clicks the p-value column header.
- Sort dispatcher walks schema chain → finds `pvalue.behaviors.sortKey ?? numeric.behaviors.sortKey ?? text.behaviors.sortKey`.
- `numeric.sortKey = (v) => Number(v)` returns the scalar.
- Rows re-order; condition values move with their rows (they're indexed by data row, not by sorted position).

### Editor interaction
- Author opens the editor for `col_interval`.
- SchemaForm walks chain → renders accordion sections: BASE / TEXT / NUMERIC / INTERVAL.
- INTERVAL section shows the `variant` segmented control.
- Styling section: `bold`, `color`, `token`, etc. via MappedValue (4-mode picker).
- `bold` is currently `{ kind: "condition", name: "significant" }` — picker shows "Condition" mode active + dropdown set to "significant".

## Extension patterns

### A third-party adds a new column type

```ts
import { defineSchema, registerColumnType, compose, tag, text }
  from "@tabviz/core/extend";

const FANCY_RING = defineSchema({
  key: "fancy_ring",
  label: "Fancy Ring",
  inherits: ["ring", "percent"],   // multi-inheritance
  options: [
    { key: "innerRadius", control: "number", default: 0.5 },
  ],
});

registerColumnType({
  schema: FANCY_RING,
  renderer: (val, opts, ctx, parents) => {
    const ringSvg = parents.ring.render(val, opts, ctx);  // delegate to ring
    const cutout = addInnerCutout(ringSvg, opts.innerRadius);
    const labelString = parents.percent.formatValue(val, opts, ctx);
    return compose(
      tag(cutout, ["fancy-ring-glyph"]),
      tag(text(labelString), ["fancy-ring-label", "minor"]),
      { sep: "" }
    );
  },
  behaviors: {
    sortKey: (val, opts, ctx, parents) => parents.ring.sortKey(val, opts, ctx),
    contributeConditions: (column, spec) => {
      // emit a "high_<col>" condition for values above 0.8
      const above = spec.data.rows.map(r => Number(r.metadata[column.field]) > 0.8);
      return [{ id: `${column.id}:high`, name: `high_${column.id}`,
                kind: "boolean", values: above, producer: column.id }];
    },
  },
});
```

That's it. The schema appears in the picker (since not abstract), the
editor builds its options panel automatically, themes can target
`fancy-ring-glyph` / `fancy-ring-label`, and the auto-condition is
referenceable from any other column's styleMapping.

### A third-party adds a theme

```ts
const ACADEMIC_THEME = defineTheme({
  inputs: { /* ... */ },
  nodeRules: {
    "interval-range":  { text: { size: "minor", color: "muted" } },
    "footnote":        { wrap: "newline", text: { size: "minor" } },
    "fancy-ring-label": { wrap: "subscript" },
    "significant":     { text: { weight: "bold" } },
  },
});
```

The theme's `nodeRules` describes its visual treatment of every tag
it cares about. Tags it doesn't list pass through unchanged.

## Design rules (the principles that resolve tension)

1. **Schemas are conveniences, not contracts to maximum flexibility.**
   When schema options can't express a need, drop to variants. When
   variants can't, drop to a custom formatter or column type. The
   gradient is explicit; users know where to reach.

2. **Renderers commit to structure; themes commit to style.** Tags
   are the contract between them. Renderers should never set
   colors / weights directly when a theme rule could.

3. **Inheritance is a toolkit, not a pipeline.** The schema chain
   gives a child access to ancestor behaviors and renderers as
   building blocks. The child orchestrates explicitly; no auto-run
   ordering.

4. **Behaviors are pure value transforms; renderers are pure tree
   producers; both compose via the parents proxy.** Different return
   types, different jobs. Renderers can call behaviors; behaviors
   never call renderers.

5. **Conditions are static within a spec lifetime.** Re-evaluation
   only happens on spec rebuild. Filters / sorts don't recompute
   conditions — they just attach to row indices.

6. **Wire shape is the source of truth.** R-side and TS-side both
   author the same wire shape. Behaviors / renderers / themes consume
   the wire shape. Round-trip is byte-stable.

7. **Banks are author-supplied OR schema-contributed.** Both flow
   through `computeEffectiveBanks`. Producer-id tagging auto-cleans
   on column removal.

8. **One canonical place per concern.** Sort logic lives on the
   schema, not in `filter-sort-utils.ts`. Width estimation lives on
   the schema, not in `width-utils.ts`. Etc. Phase 7 migrates the
   existing scattered logic to schemas.

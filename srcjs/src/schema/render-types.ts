// Renderer + composition types for the schema system.
//
// These types describe the **extension API** for schemas: how cell
// formatters compose along the inheritance chain, how render output
// is shaped so browser + SVG-export can consume it uniformly, and how
// schemas declare lifecycle hooks for cross-cutting concerns like
// axis space, legends, or zoom/pan handlers.
//
// Implementation: Phase 7. The types here are the contract — handwritten
// renderer code today still lives in `TabvizPlot.svelte` +
// `svg-generator.ts`; Phase 7 extracts those into pure functions that
// match these signatures.

import type { ColumnSchema } from "./types";
import type { ColumnSpec } from "../types";
import type { BankContribution } from "./banks";

// ────────────────────────────────────────────────────────────────────
// Render description tree
// ────────────────────────────────────────────────────────────────────
//
// Formatters return RenderNodes (JSON-like trees). Two consumers:
//
//  - Browser path: a Svelte component walks the tree and mounts DOM
//    via the right element per `kind`.
//  - SVG-export path: `svg-generator.ts` walks the tree and emits SVG
//    markup directly.
//
// Single source of truth for "what does this cell look like"; browser
// vs export divergence is a serialization detail.

export type RenderNode =
  | RenderText
  | RenderGroup
  | RenderSvg
  | RenderSpacer
  | RenderImage
  | RenderComponent;

export interface RenderText {
  kind: "text";
  value: string;
  style?: TextStyle;
  /**
   * Semantic structural tags for theme finalization. Each tag is a
   * flat string; themes apply rules in `WebTheme.nodeRules` to nodes
   * whose tag list contains a matching key. Renderers should prefer
   * tags over inline `style` overrides — tags are theme-controllable.
   */
  tags?: string[];
}

export interface RenderGroup {
  kind: "group";
  children: RenderNode[];
  layout?: "row" | "column" | "stack";
  gap?: number;
  align?: "start" | "center" | "end" | "baseline";
  style?: GroupStyle;
  /** Semantic structural tags for theme finalization. */
  tags?: string[];
}

export interface RenderSvg {
  kind: "svg";
  markup: string;
  width: number;
  height: number;
  /** Optional viewBox; defaults to `0 0 width height`. */
  viewBox?: string;
}

export interface RenderSpacer {
  kind: "spacer";
  /** Pixels of horizontal space (or vertical when in column layout). */
  size: number;
}

export interface RenderImage {
  kind: "image";
  src: string;
  alt?: string;
  width?: number;
  height?: number;
}

/**
 * Browser-only escape hatch: mount a named Svelte component with the
 * given props. The renderer registry's `dom` slot uses this for
 * visual cells (pictogram, ring, sparkline, …) where a Svelte
 * component is the natural target — preserving scoped CSS, reactive
 * props, and transitions that a raw markup string can't.
 *
 * The SVG-export consumer (`render-svg.ts`) MUST NOT receive
 * RenderComponent nodes from its renderer chain; the schema's
 * `svg` slot is expected to produce `RenderSvg` instead. If a
 * component node leaks through, the serializer emits empty markup
 * with zero dimensions and an inline diagnostic comment.
 */
export interface RenderComponent {
  kind: "component";
  /** Name registered in the COMPONENT_REGISTRY (see RenderTree.svelte). */
  name: string;
  /** Props passed to the component. */
  props: Record<string, unknown>;
  /** Optional natural width hint — informs the cell auto-width path
   *  when DOM measurement isn't available. */
  width?: number;
  /** Optional natural height hint. */
  height?: number;
}

/** Theme-relative or literal text styling. */
export interface TextStyle {
  /** Theme font role (mirrors TEXT.fontClass) or raw family. */
  font?: "base" | "display" | "number" | "mono" | string;
  /** "major" / "minor" map to theme cell font sizes; numbers are px. */
  size?: "major" | "base" | "minor" | number;
  weight?: "normal" | "medium" | "semibold" | "bold" | number;
  italic?: boolean;
  /** Theme content role (mirrors row tokens) or raw color. */
  color?: "primary" | "secondary" | "muted" | "accent" | string;
}

export interface GroupStyle {
  /** Theme background role or hex. */
  bg?: "base" | "muted" | "accent" | string;
  padding?: number;
  borderRadius?: number;
}

// ────────────────────────────────────────────────────────────────────
// Cell formatter (renderer)
// ────────────────────────────────────────────────────────────────────

/** Per-cell rendering context. */
export interface RenderContext {
  /** Width budget for this cell in pixels. */
  cellWidth: number;
  /** Row height in pixels. */
  rowHeight: number;
  /** Effective row data (full record) — for renderers that need
   *  cross-field values (e.g. interval reading point/lower/upper). */
  row: Record<string, unknown>;
  /** Render target — informs e.g. font-fallback strategy. */
  target: "browser" | "svg";
  /** Resolved per-cell style (semantic tokens + color/bg/badge/icon
   *  overrides). Visual cells consult this for muted/emphasis/accent
   *  state and per-cell color overrides. Optional — text-composition
   *  cells typically ignore it and let nodeRules + tags handle it. */
  cellStyle?: {
    bold?: boolean;
    italic?: boolean;
    color?: string | null;
    bg?: string | null;
    badge?: string | null;
    icon?: string | null;
    emphasis?: boolean;
    muted?: boolean;
    accent?: boolean;
    fill?: boolean;
    tooltip?: string | null;
  };
  /** Effective per-cell color override (row/cell semantic markerFill
   *  resolved by the caller — slots in below explicit column color
   *  but above theme default for visual cells). */
  colorOverride?: string | null;
  /** Per-cell NA text override; falls back to the column's own
   *  `naText` option when undefined. Carried in ctx so renderers
   *  don't repeat the `column.options?.naText` access. */
  naText?: string | null;
}

/**
 * Parent renderers, keyed by schema key. A child's formatter can call
 * `parents.pictogram(val, opts, ctx)` to delegate to a specific
 * ancestor without re-implementing it. The proxy returns the same
 * RenderNode that the parent would have returned.
 *
 * The proxy entries take 3 args (no trailing `parents`) — the
 * dispatcher injects each ancestor's own `parents` automatically, so
 * callers compose by passing only (value, options, ctx).
 */
export type ParentRenderers = {
  [key: string]: (
    value: unknown,
    options: ColumnSpec["options"],
    ctx: RenderContext,
  ) => RenderNode;
};

/**
 * Cell formatter signature. Returns a RenderNode tree; both browser
 * and SVG-export consume this same shape.
 *
 * The `parents` proxy is keyed by schema key, accepting the same
 * (value, opts, ctx) the child receives. Composition utilities like
 * `compose()` are imported from `./compose` (Phase 7).
 */
export type CellFormatter = (
  value: unknown,
  options: ColumnSpec["options"],
  ctx: RenderContext,
  parents: ParentRenderers,
) => RenderNode;

// ────────────────────────────────────────────────────────────────────
// compose() — layout combinator for child output composition
// ────────────────────────────────────────────────────────────────────
//
// The leaf concrete schema's formatter typically calls 1-N parent
// formatters and combines the resulting RenderNodes. compose() is the
// data-table-friendly templating helper:
//
//   compose(a, b, c)                         → "a b c"
//   compose(a, b, c, { sep: ", " })          → "a, b, c"
//   compose(a, b, c, { bracketStart: 2 })    → "a (b, c)"
//   compose(a, b, { sep: " ± ", minor: 2 })  → "a ± b" with b in
//                                                minor (small, muted)
//
// `minor: N` means nodes from index N onwards are restyled as
// secondary (smaller, muted color). `bracketStart: N` wraps nodes
// from index N onwards in parentheses with the joining separator
// inside. Both can combine.
//
// Implementation: in `./compose.ts` (Phase 7). This is just the type.

export interface ComposeOptions {
  /** Separator between siblings (default " "). */
  sep?: string;
  /**
   * 1-based index at which to start wrapping nodes in parens.
   *   compose(a, b, c, { bracketStart: 2 }) -> a (b, c)
   *   compose(a, b, c, { bracketStart: 1 }) -> (a, b, c)
   *   undefined = no brackets
   */
  bracketStart?: number;
  /**
   * 1-based index at which nodes become "minor" (small, muted).
   *   compose(point, sd, { minor: 2, sep: " ± " })
   *     -> "point ± sd" with sd in smaller secondary-color text
   *   undefined = no minor styling
   */
  minor?: number;
  /** Override layout direction (defaults to "row"). */
  layout?: "row" | "column";
}

// ────────────────────────────────────────────────────────────────────
// Lifecycle hooks
// ────────────────────────────────────────────────────────────────────
//
// Two granularities, two concerns:
//
//  - **Widget-level** hooks fire on first appearance of any column
//    matching a schema (or its descendants) and last removal. Used
//    for shared resources: axis space allocation, legend rendering,
//    shared zoom state.
//
//  - **Column-level** hooks fire per column instance, on create and
//    destroy. Used for per-column resources: event handlers, custom
//    DOM nodes, per-instance zoom/pan state.
//
// Both hooks return an optional cleanup function (mirrors React
// `useEffect`); when present, it's called on destroy / removal.

export interface WidgetContext {
  /** Root element (browser) or output stream (SVG export). */
  root: HTMLElement | SvgStream;
  /** Active columns in the widget. */
  columns: ColumnSpec[];
  /** Mutation channel — `widget.update(spec)` re-renders. */
  update: (next: ColumnSpec[]) => void;
}

/** Stub — typed in Phase 7 alongside the SVG-export consumer. */
export interface SvgStream {
  write: (markup: string) => void;
}

export type Cleanup = () => void;

export interface SchemaLifecycle {
  /**
   * Fires once when the first column matching this schema (or any
   * descendant) appears in the widget. Use for shared resources:
   * allocateAxisSpace, buildLegend, etc.
   */
  onFirstPresent?: (widget: WidgetContext) => Cleanup | void;

  /**
   * Fires when the last matching column is removed. If
   * `onFirstPresent` returned a cleanup, it's called automatically;
   * this hook is for additional teardown.
   */
  onLastRemoved?: (widget: WidgetContext) => void;

  /**
   * Fires per column instance on create. Use for per-column
   * resources: zoom/pan event handlers, per-instance state.
   */
  onColumnCreate?: (column: ColumnSpec, widget: WidgetContext) => Cleanup | void;

  /**
   * Fires per column instance on destroy. The `onColumnCreate`
   * cleanup runs automatically; this hook is for additional teardown.
   */
  onColumnDestroy?: (column: ColumnSpec, widget: WidgetContext) => void;
}

// ────────────────────────────────────────────────────────────────────
// Schema behaviors — type-dispatched logic that belongs on the schema
// ────────────────────────────────────────────────────────────────────
//
// A grep across `srcjs/src/` finds at least 8 sites where per-column
// logic dispatches on `col.type`:
//
//   filter-sort-utils.ts   — sortValueFor() switch per type
//   width-utils.ts         — estimateColumnWidth() branches
//   source-emit.ts         — emitTypeSpecificArgs() switch
//   svg-generator.ts       — cell-render branches per type
//   TabvizPlot.svelte      — cell-render + layout branches
//   ColumnEditorPopover    — editor-UI branches (replaced by SchemaForm)
//   layout-zoom.svelte.ts  — layout-mode dispatch
//   tabvizStore.svelte.ts  — store-side type checks
//
// Each is a candidate for moving onto the schema as a named behavior.
// The schema becomes the central registry of all type-dispatched
// logic, with inheritance: a child schema's behavior overrides its
// parent's, OR delegates back via the `parents` proxy (same pattern
// as renderers / compose).
//
// Phase 7 implements the dispatcher + the migrations; Phase 3 (this
// commit) just locks in the contract.

/** Comparable scalar (or `null` for "missing"). */
export type SortableValue = string | number | boolean | null;

export interface BehaviorContext {
  /** Full row data, in case extraction needs cross-field reads. */
  row: Record<string, unknown>;
}

/** Parents proxy for behaviors — same pattern as renderers. */
export type ParentBehaviors<T> = {
  [key: string]: T;
};

/** Behaviors are functions keyed by behavior name on each schema. */
export interface SchemaBehaviors {
  /**
   * Extract a sortable scalar from a row for sort comparisons. Today
   * lives in `filter-sort-utils.ts::sortValueFor` as a switch on
   * `col.type`. INTERVAL returns the point estimate; VIZ_FOREST
   * returns the first effect's point; PICTOGRAM returns the rating
   * value; etc. Falls back to the parent's sortKey when undefined.
   */
  sortKey?: (
    value: unknown,
    options: ColumnSpec["options"],
    ctx: BehaviorContext,
    parents: ParentBehaviors<NonNullable<SchemaBehaviors["sortKey"]>>,
  ) => SortableValue;

  /**
   * Estimate the column's content width in pixels without DOM
   * measurement. Today lives in `width-utils.ts` with per-type
   * branches. Numeric columns measure formatted text; PICTOGRAM
   * computes glyph-count * glyph-size; RING is fixed-width; etc.
   */
  estimateWidth?: (
    value: unknown,
    options: ColumnSpec["options"],
    ctx: BehaviorContext & { fontSize: number; fontFamily: string },
    parents: ParentBehaviors<NonNullable<SchemaBehaviors["estimateWidth"]>>,
  ) => number;

  /**
   * Natural pixel width of the column's visual content (not text).
   * Distinct from `estimateWidth` — operates at the column granularity
   * over ALL rows because glyph layouts depend on the data extent:
   * pictogram in count-mode scans rows for max value to size the track;
   * stars / icon / ring are data-independent but stay here for
   * uniformity. Returned width is the natural minimum the column needs
   * to render its glyphs without clipping; callers `Math.max` it with
   * their text/header-derived width budget.
   *
   * Returning 0 (or omitting the behavior) means "no glyph budget";
   * callers fall through to text-only measurement.
   */
  naturalWidth?: (
    column: ColumnSpec,
    rows: ReadonlyArray<{ metadata: Record<string, unknown> }>,
    parents: ParentBehaviors<NonNullable<SchemaBehaviors["naturalWidth"]>>,
  ) => number;

  /**
   * Emit the JS builder call that would reproduce this column spec.
   * Today lives in `source-emit.ts` with a switch over column types.
   * Returns `{ name, typeArgs }` — the builder function name (e.g.
   * `"colInterval"`) and the type-specific args. The caller in
   * `source-emit.ts::emitColumn` merges in common args (token,
   * paddingClass, …) and assembles the final string.
   *
   * Schemas describe their own defaults in `optionOverrides` already;
   * `emitSource` strips those via `dropDefaults` so emitted source
   * shows only what diverged from the schema baseline.
   */
  emitSource?: (
    spec: ColumnSpec,
    parents: ParentBehaviors<NonNullable<SchemaBehaviors["emitSource"]>>,
  ) => { name: string; typeArgs: Record<string, unknown> };

  /**
   * Stringify a cell's value for global search / fuzzy-find. Default:
   * the formatter output rendered to plain text. Override when the
   * search key should diverge (e.g. interval columns: searching "0.85"
   * should match the point estimate, not the formatted "(0.72, 0.99)").
   */
  searchKey?: (
    value: unknown,
    options: ColumnSpec["options"],
    ctx: BehaviorContext,
    parents: ParentBehaviors<NonNullable<SchemaBehaviors["searchKey"]>>,
  ) => string;

  /**
   * Hover-tooltip text. Default: the formatted cell text. Override
   * when richer context is useful (e.g. forest: show point, lower,
   * upper as three labeled lines on hover).
   */
  tooltipText?: (
    value: unknown,
    options: ColumnSpec["options"],
    ctx: BehaviorContext,
    parents: ParentBehaviors<NonNullable<SchemaBehaviors["tooltipText"]>>,
  ) => string | null;

  /**
   * Combine multiple row values into a single summary for grouped
   * rows. Numeric: mean/sum/median (configurable). Text: first /
   * concat. Sparkline: concat arrays. Default: undefined (no
   * aggregation; group summary cells are empty for that column).
   */
  aggregate?: (
    values: unknown[],
    options: ColumnSpec["options"],
    parents: ParentBehaviors<NonNullable<SchemaBehaviors["aggregate"]>>,
  ) => unknown;

  /**
   * Contribute widget-bank entries (footnotes / axes / legends /
   * custom) when this column is present. Pure; idempotent; called
   * by `computeEffectiveBanks(spec)`. Returned entries are stamped
   * with `producer: column.id` automatically; cleanup on column
   * removal is automatic (entries simply don't get re-emitted next
   * dispatch pass).
   *
   * Example — reference column populates footnote bank:
   *   contributeBanks: (column, spec) => ({
   *     footnotes: spec.data.rows.map((row, i) => ({
   *       id: derivedId(column.id, row.id),
   *       text: String(row.metadata[column.field]),
   *       href: column.options?.reference?.hrefField
   *         ? String(row.metadata[column.options.reference.hrefField])
   *         : undefined,
   *     })),
   *   })
   */
  contributeBanks?: (
    column: ColumnSpec,
    spec: { columns: ColumnSpec[]; data?: unknown },
  ) => BankContribution | null | void;

  /**
   * Pure value → string transform applied by THIS schema's
   * formatting rules. Distinct from `render()` — does NOT produce a
   * RenderNode; just the display string. Reusable by descendants
   * and by composed columns.
   *
   *   NUMERIC.formatValue(0.85234, { decimals: 2 }) → "0.85"
   *   TEXT.formatValue("abc def", { maxChars: 5 }) → "abc d…"
   *
   * Typical renderer pattern:
   *
   *   registerRenderer("percent", (val, opts, ctx, parents) => {
   *     const scaled = (opts.percent?.multiply !== false ? val * 100 : val);
   *     const fmt    = parents.numeric.formatValue(scaled, opts, ctx);
   *     const suff   = opts.percent?.symbol !== false ? fmt + "%" : fmt;
   *     return parents.text.render(suff, opts, ctx);
   *   });
   *
   * If undefined on a schema, the resolver walks ancestors via
   * `parents` to find a matching ancestor's formatValue.
   */
  formatValue?: (
    value: unknown,
    options: ColumnSpec["options"],
    ctx: BehaviorContext,
    parents: ParentBehaviors<NonNullable<SchemaBehaviors["formatValue"]>>,
  ) => string;
}

// ────────────────────────────────────────────────────────────────────
// Registry shapes (used by extend.ts)
// ────────────────────────────────────────────────────────────────────

/**
 * Per-schema renderer pair — one for each runtime. Both produce
 * `RenderNode` trees; each is free to populate the tree with
 * primitives natural to its target runtime.
 *
 * - `dom` (browser path): typically returns a text-composition tree
 *   OR a `RenderComponent` node that mounts a Svelte cell component.
 *   Consumed by `<RenderTree>`.
 *
 * - `svg` (V8 / export path): typically returns the same
 *   text-composition tree as `dom` (theme `nodeRules` overlay both
 *   identically), OR a `RenderSvg` node carrying SVG markup that
 *   `svg-generator.ts` would have produced. Consumed by
 *   `renderNodeToSvg`.
 *
 * Text-composition schemas typically share one implementation by
 * pointing both slots at the same function. Visual schemas have
 * naturally divergent implementations (component vs markup).
 */
export interface SchemaRenderers {
  dom?: CellFormatter;
  svg?: CellFormatter;
}

/** Bundle a schema with its renderer, lifecycle, and behaviors. */
export interface RegisterSpec {
  schema: ColumnSchema;
  /** Single-renderer shorthand — fills the `dom` slot. Use `renderers`
   *  for the full pair. */
  renderer?: CellFormatter;
  /** Per-runtime renderer pair. */
  renderers?: SchemaRenderers;
  lifecycle?: SchemaLifecycle;
  behaviors?: SchemaBehaviors;
}

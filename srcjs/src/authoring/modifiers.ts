/**
 * Spec modifiers — TS mirror of R's fluent `set_*()` helpers in
 * `R/modifiers.R`. Each function takes a `WebSpec` (returned by
 * `tabviz()`) and returns a new `WebSpec` with the modification applied.
 *
 * Pure / immutable — never mutates the input. Composable via pipeline:
 *
 *   const spec = tabviz({...})
 *     |> setTitle("Updated title")
 *     |> setTheme("lancet")
 *     |> setZoom(1.5);
 *
 * Mirrors the R modifier API (`tabviz(...) |> set_title("...") |> ...`).
 * R-side modifiers also work on Shiny proxies (sending JSON messages to
 * a running widget); the TS modifiers here are static-spec only — for
 * runtime control, use the instance methods (`instance.setTheme(...)` etc.)
 * returned by `createTabviz`.
 */

import type { WebSpec, ColumnDef, PlotLabels } from "../types";
import { resolveThemeRef, type ThemeRef } from "../lib/theme/theme-api";

// ────────────────────────────────────────────────────────────────────
// Label modifiers
// ────────────────────────────────────────────────────────────────────

/** Set or clear (pass `null`) the plot title. Mirrors R::set_title(). */
export function setTitle(spec: WebSpec, title: string | null): WebSpec {
  return { ...spec, labels: withLabel(spec.labels, "title", title) };
}

/** Set or clear the plot subtitle. Mirrors R::set_subtitle(). */
export function setSubtitle(spec: WebSpec, subtitle: string | null): WebSpec {
  return { ...spec, labels: withLabel(spec.labels, "subtitle", subtitle) };
}

/** Set or clear the caption. Mirrors R::set_caption(). */
export function setCaption(spec: WebSpec, caption: string | null): WebSpec {
  return { ...spec, labels: withLabel(spec.labels, "caption", caption) };
}

/** Set or clear the footnote. Mirrors R::set_footnote(). */
export function setFootnote(spec: WebSpec, footnote: string | null): WebSpec {
  return { ...spec, labels: withLabel(spec.labels, "footnote", footnote) };
}

/** Set or clear the tag (the short shell stamp, e.g. "TABLE 2"). Mirrors R::set_tag(). */
export function setTag(spec: WebSpec, tag: string | null): WebSpec {
  return { ...spec, labels: withLabel(spec.labels, "tag", tag) };
}

function withLabel(labels: PlotLabels | undefined, key: keyof PlotLabels, value: string | null): PlotLabels {
  return { ...(labels ?? {}), [key]: value };
}

// ────────────────────────────────────────────────────────────────────
// Theme modifiers
// ────────────────────────────────────────────────────────────────────

/** Replace the theme. Accepts a name string, `{extend, overrides}`, or a resolved WebTheme. */
export function setTheme(spec: WebSpec, theme: ThemeRef): WebSpec {
  const resolved = resolveThemeRef(theme);
  return { ...spec, theme: resolved as unknown as WebSpec["theme"] };
}

// ────────────────────────────────────────────────────────────────────
// Layout modifiers
// ────────────────────────────────────────────────────────────────────

export interface SetZoomArgs {
  /** Plot zoom multiplier (1.0 = natural). Mirrors R::set_zoom()`s `zoom` arg. */
  zoom?: number;
  /** Plot width override (px or "auto"). */
  plotWidth?: number | "auto";
  /** Target export aspect ratio (`width / height`). `null` = natural. */
  targetAspect?: number | null;
}

/**
 * Adjust zoom / plot-width / target aspect-ratio. Mirrors R::set_zoom() —
 * but the R version layers in additional Shiny-proxy semantics this static
 * variant doesn't carry. For runtime control of a mounted widget, use
 * `instance.setZoom(...)` from `createTabviz`'s returned handle.
 */
export function setZoom(spec: WebSpec, args: SetZoomArgs): WebSpec {
  const next: WebSpec = { ...spec };
  if (args.plotWidth !== undefined) {
    next.layout = { ...spec.layout, plotWidth: args.plotWidth };
  }
  if (args.targetAspect !== undefined) {
    next.targetAspect = args.targetAspect;
  }
  // `zoom` itself isn't part of the wire shape; R's set_zoom() routes it
  // through the proxy message channel. For static-spec authoring it's a
  // no-op other than the side-effects above.
  void args.zoom;
  return next;
}

// ────────────────────────────────────────────────────────────────────
// Column modifiers
// ────────────────────────────────────────────────────────────────────

/** Append a column to the spec. Mirrors R::add_column(). */
export function addColumn(spec: WebSpec, column: ColumnDef, after?: string): WebSpec {
  if (after === undefined) {
    return { ...spec, columns: [...spec.columns, column] };
  }
  // Insert after the column whose id (leaf) or header (group) matches `after`.
  const cols = [...spec.columns];
  const idx = cols.findIndex((c) => (c.isGroup ? c.id : c.id) === after);
  if (idx < 0) return { ...spec, columns: [...cols, column] };
  cols.splice(idx + 1, 0, column);
  return { ...spec, columns: cols };
}

/** Remove a column by id. Mirrors R::remove_column(). */
export function removeColumn(spec: WebSpec, columnId: string): WebSpec {
  return { ...spec, columns: spec.columns.filter((c) => c.id !== columnId) };
}

/**
 * Update properties on a column by id. Mirrors R::update_column().
 * Performs a shallow merge — pass nested partials at your own risk.
 */
export function updateColumn(
  spec: WebSpec,
  columnId: string,
  patch: Partial<ColumnDef>,
): WebSpec {
  return {
    ...spec,
    columns: spec.columns.map((c) =>
      c.id === columnId ? ({ ...c, ...patch } as ColumnDef) : c,
    ),
  };
}

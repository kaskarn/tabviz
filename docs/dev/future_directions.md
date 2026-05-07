# Future Directions

::: {.callout-note}
## What this page is

A short, current-state map of where tabviz is, what shipped recently, and what's on the wishlist. The previous version of this file was a long pre-launch design doc — much of it has either shipped or been superseded by the v2 theme rework, the pagination work, and the audit cleanup of late 2026. Rather than maintain a stale roadmap by hand, this page now points at the live signals.
:::

## Where tabviz is today

* **Package**: `tabviz` (formerly `webforest`).
* **Lifecycle**: experimental (`lifecycle::signal_stage("experimental", "tabviz")` fires on load).
* **Version**: `0.29.0` series.
* **CRAN status**: not yet submitted; targeting submission after stabilization.
* **Public API**: `tabviz()` is the canonical entry point; `forest_plot()` is the convenience wrapper. `col_*()` for cell columns, `viz_*()` for axis-backed viz columns, `web_theme_*()` for presets, `set_*()` for fluent modifiers, `save_plot()` / `save_split_table()` for static export.

## Recent landings (mid-2026)

* **v2 theme rework** — three-tier resolved themes (`ThemeInputs` → derived chrome / data roles → component bundles), the seven shipped presets (cochrane / lancet / jama / dark / dwarven / elvish / hobbit), `slot_style` as a Tier 1 input, the `secondary` identity tier, the five-token `RowCluster` semantic surface (`emphasis` / `muted` / `accent` / `bold` / `fill`).
* **Pagination (v0.29.0)** — `paginate` arg on `tabviz()` and `save_plot()`; `paginate_spec()` plus `paginate_letter()` / `paginate_a4()` / `paginate_slide()` presets; multi-page PDF via `qpdf::pdf_combine`; HTML viewer with prev/next + continuous-mode toggle; cascade through `split_by`. See [Export → Pagination](../guide/export.qmd#pagination).
* **`col_pictogram()` and `col_ring()`** — bespoke glyph piles and donut gauges with threshold-driven cascade.
* **Default forest marker shape** — now circle (was square); rotation is `circle, square, diamond, triangle`.
* **Fluent API parity** — `set_row_style(fill = ...)` and `set_theme(<lotr>)` by string name (closing parity gaps surfaced by the audit).
* **Documentation audit** — multi-sprint sweep of guide / concepts / reference / cheatsheet / top-level / gallery for factual drift, fictional themes ("Nature"), and 0.9.0-era rename clutter.
* **`knit_print` for `SplitForest` / `WebSpec`** — chunks ending with one of these now render as live widgets in Quarto / R Markdown rather than dumping S7 structure.

## Wishlist (not actively scheduled)

The items below are *interesting* but not on a near-term plan. Treat them as conversation starters; the live tracker is the GitHub issue tracker.

* **PPTX export.** Deferred from pagination v1 (no current `officer` pipeline, slide rendering, template/master support). Probably worth its own focused PR rather than smuggling through.
* **Pagination v2.** Manual user-marked page breaks; height-based fitting (instead of row-count); column-axis pagination for very wide tables; section divider slides per split.
* **Custom theme registration.** A `register_theme(name, constructor)` hook that adds a preset to the in-widget switcher and `set_theme(name)` resolution without monkey-patching `theme_map`.
* **Annotations completeness.** `forest_annotation()` carries the API but the frontend rendering side is partial — finish the SVG paths and the live-widget paths together.
* **Density viz polish.** `viz_boxplot` / `viz_violin` are functional but lighter on examples and styling sugar than `viz_forest` / `viz_bar`.

## Where to track live work

* **GitHub issues** — bugs, feature requests, in-flight discussion.
* **`NEWS.md`** — what's actually shipped (one entry per release, retained back to 0.27).
* **`R/`** + roxygen — the source of truth on every exported function. The reference docs lag by an audit cycle; the source never does.

If you're considering a contribution, glance at the [Theming Manifesto](../concepts/theming-manifesto.qmd) first — it documents which proposals have already been considered and rejected (e.g. a fourth identity tier, slot-typed Tier 1 anchors), so you can avoid re-litigating those.

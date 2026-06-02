# Note to the agent implementing row-kind

**From:** agent scoping a cascade/theming rework
**Re:** avoiding a collision at our intersection

A substantial theming-cascade rework is being scoped in parallel with your row-kind work. **It is not your job to do it**, and the scope of your refactor should not change. But our work intersects deeply at the row-kind theme-access surface, so this note flags a few small disciplines that will keep your output forward-compatible without costing you anything now.

## What's coming (so you know the shape)

The cascade rework is likely to land:

1. **CSS variables as the resolved-theme wire.** Consumers read `var(--row-summary-bg)` (or similar), not `theme.row.summary.bg` JS field paths. The cascade emits a CSS-variable map alongside the existing value snapshot for the V8/SVG-export path.
2. **A `COMPONENT_TOKENS`-style manifest** — one table listing every Tier 3 paint token, the Tier 2 role it consumes, and the consumer it paints in. This becomes the centralized consumer contract; a drift gate enforces it.
3. **Variant selection via `data-*` attributes** on a scope element (e.g. `data-row-kind="summary"`), with CSS attribute selectors driving paint state. Geometry stays JS-side. SVG export embeds the same CSS in a `<style>` block so the browser path and the V8/rsvg path render identically.

Your row-kind subsystem will naturally become a first-class consumer in that model: each kind declares its appearance-token vocabulary; the renderer stamps `data-row-kind="<kind>"` on output; CSS binds paint tokens to that selector.

## What to do now (cheap, no scope creep)

1. **Route every row-kind theme access through one (or a small set of) getter function(s).** Something like `getRowKindAppearance(theme, kind) → { bg, fg, weight, padding, ... }`. Renderers call this getter and never reach into `theme.rowKind.X.Y` directly. The cascade rework will swap the *inside* of the getter without touching any renderer. This is the single biggest hedge against a halfway-merged state.

2. **Pick kind discriminators that work as DOM/SVG attribute values today.** Lowercase, kebab-case, stable across versions (`group-header`, `section-header`, `summary`, `spacer`, `overall`). These exact strings will be stamped on the rendered element as `data-row-kind=` later. Avoid synonyms drifting in (no `groupHead` vs `group-header` mixing).

3. **Be deliberate about each kind's appearance-field vocabulary.** Every field you add to a kind's appearance bundle will later become a manifested consumed token — i.e., a row in the COMPONENT_TOKENS table, an entry in the drift gate, and a CSS variable. Cost-benefit applies now: avoid fields nothing in the renderer consumes; avoid two fields that name the same paint surface; prefer one canonical name per concept.

4. **Add a one-line comment beside each appearance field describing what it paints.** "summary row background fill," "group header bottom rule color," etc. This makes the eventual manifest pass mechanical rather than archaeological.

## What to avoid

- **Don't migrate to CSS variables or data attributes preemptively.** That's the cascade rework's scope. Doing it now would coordinate two refactors, which is exactly the failure mode we're hedging against.
- **Don't widen the appearance vocabulary beyond what's actually consumed today.** Every field becomes a maintenance surface in the manifest later. If a field is "for the future," leave it out.
- **Don't optimize the renderer for the current deep-path theme shape.** If you find yourself writing `theme.row[kind].state.fg`-style reads inline, route them through the getter instead.
- **Don't change scope to align with the cascade rework.** It's not landing first. Your refactor should stand on its own with today's theme shape.

## SVG WYSIWYG note (already on your radar, restating for completeness)

Forward compatibility with the cascade rework: paint-state per kind (fill, fg, weight, opacity) will be CSS-variable-bindable and translate cleanly to SVG export via embedded `<style>`. Geometry per kind (height, indent, which sub-elements exist, glyph presence for HC-mode encoding) is JS-side in both browser and V8/SVG paths — same as today. If you find yourself wanting `::before`/`::after` for HC fallback glyphs, emit real elements instead; pseudo-elements don't survive SVG export.

## TL;DR

One getter for theme→kind appearance reads. Stable kebab-case kind names. Deliberate, documented per-kind appearance vocabulary. Don't pre-migrate; don't change scope. Everything else is yours.

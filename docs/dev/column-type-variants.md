# Column-type variants & their control within themes

Status: **design** (2026-06-15). Captures the analysis from the column-variants
design session. The agreed CORE is locked; one product fork is **D30**.

## Problem

A column type's *visual variant* (how a `badge` / `interval` / `pvalue` cell
looks) can be crafted two structurally different ways today, and they have
**opposite theme-control properties**:

- **`VariantSpec` recipe** (`src/schema/types.ts`, used by `interval`,
  `badge`): a named recipe `{id, label, description, preview, resolved}` on the
  schema. Author picks one → lands as `options.<bucket>.variant` →
  `compileVariants()` expands `resolved` into `options.<bucket>.__resolved` →
  renderers read only `__resolved`. RICH (one id → many primitives), card+preview
  editor UX — but **author-only**: `variant` is a raw wire key with no `kind`, so
  `theme.column_defaults`' kind-gate treats it as `core` and rejects it.
- **kind-tagged enum option** (`pvalue.significantStyle: none|pill`,
  `kind: "styling"`): a plain `OptionSpec` whose value the renderer branches on.
  No recipe, no compile. **Theme-controllable for free** — it rides the governed
  `column_defaults` pipeline (kind-gate, author-wins, XSS grammar, theme-switch
  re-base). LIVE PROOF: two presets ship `pvalue: {significantStyle: "pill"}`
  (`theme-presets-inputs.ts:143, 287`).

The two existing `VariantSpec` users have OPPOSITE internal shapes — the crux:
- **`badge`** — variant cards over EXPOSED primitive options (`shape`,
  `outline` are real `kind`-tagged options; badge's variants carry NO `resolved`
  block — they're editor sugar that drives the primitives). Primitives are the
  real control; theme reaches them today.
- **`interval`** — variant recipes over HIDDEN primitives (`boundsLayout`,
  `boundsDelimiter`, … live ONLY inside the 4 `resolved` blocks; they are NOT
  author-facing options). The variant is the ONLY control surface; nothing to
  fine-tune.

## Decision (agreed core)

Unify into ONE system with two layers — NOT two parallel mechanisms:

1. **Make the variant SELECTION theme-selectable via `column_defaults`.**
   SHIPPED 2026-06-15 as a SPECIAL-CASE in `applyThemeColumnDefaults`
   (`lib/theme/column-defaults.ts`) — NOT a declared `OptionSpec`. Rationale
   discovered at build: `variant` is the recipe selector handled SPECIALLY
   everywhere (the editor's variant-card picker owns it via `column.options.
   <bucket>.variant`, NOT the options loop; `compileVariants` reads it directly),
   so declaring it as a normal option would **double-render an editor control**.
   The merge instead recognizes `column_defaults.<type>.variant` when the schema
   has `variants`: a DECLARED id only, XSS-gated, AUTHOR-WINS against the
   first-declared variant. Same governance as every other column-default; no
   schema/editor/drift/introspection churn. Gate:
   `column-defaults.test.ts` (6 variant cases incl. end-to-end merge→compile).
   (Discovery gap noted: variant ids aren't yet in `column_schema()`
   introspection — fine for shipping + our presets where the ids are known; a
   future `column_variants(type)` would serve R-user discovery.)
2. **`VariantSpec` stays the recipe DEFINITION.** Each enum value IS a variant
   id; `compileVariants()` still expands the selected one. No change to the
   compile machinery. The pvalue "pill" is the degenerate case: a trivial recipe
   expressed as a plain enum, no `VariantSpec` needed.

**Precedence (clean layering):** theme-variant < author-variant <
author-primitive-override. The ingest order already supports it: export runs
`applyThemeColumnDefaults` BEFORE `compileVariants` (`svg-generator.ts:3916→3917`).
The theme fills the variant id (author-wins, only if unset) → compile resolves
it → any author-set primitive overrides `__resolved`.

## RESOLVED FORK — the "exacting users" tier (D30 = (a), 2026-06-16)

"Still allow `VariantSpec` authoring for very exacting users" split into two
genuinely different asks:

- **(a) Fine-tune within a variant** ("bracket_muted but with `–`") — **SHIPPED.**
  Interval's 7 `bounds*` primitives (`boundsLayout`/`boundsContent`/`boundsOpen`/
  `boundsClose`/`boundsSeparator`/`boundsPrefix`/`boundsMuted`) are now real
  `presentation` options. Each defaults null ⇒ defers to the `variant`; an
  explicit value OVERRIDES it (`recipeFor` overlays author primitives over the
  variant's `__resolved`; precedence theme-variant < author-variant <
  author-primitive). Themeable too (`set_column_default(th,"interval",
  boundsSeparator="/")`). Makes interval consistent with badge. Wired R + TS +
  schema + introspection; 4 TS override tests + R parity + end-to-end render.
- **(b) Define a NEW named recipe** ("my house bounds style") — still OPEN,
  post-1.0, on demand. Requires a variant-AUTHORING API. JS has the substrate
  (`registerSchema`/extend); R has no surface. Overlaps custom-column-type
  extension — a separate arc.

## Implementation sketch (post-D30)

1. Synthesize/declare the `variant` `OptionSpec` (kind: presentation) for
   variant-having schemas. Drift gate: `consumedBy` must be set.
2. Confirm `column_defaults` merges it (kind-gate accepts presentation; XSS gate
   is a no-op on enum ids) and writes to `options.<bucket>.variant`.
3. Confirm `compileVariants` reads the (possibly theme-set) variant. NAIL the
   store-path merge timing (export order is confirmed; store applies via
   `rebaseSpecForThemeSwitch` + `compileVariants` at `tabvizStore:408` — verify
   the base merge runs before compile there too).
4. Introspection: `column_schema()` lists `variant` (free once it's an OptionSpec).
5. R: `set_column_default(theme, "interval", variant = "bracket_muted")` round-trips.
6. If D30 = (a): promote interval's `bounds*` primitives to kind-tagged options.
7. Gates: extend `test-parity-column-defaults.R` + the column_defaults TS tests
   with a variant-selection case; a render proving a theme selects a variant.

## Related

- `theme.column_defaults` (the governed merge): `lib/theme/column-defaults.ts`.
- Introspection: `authoring/schema-introspect.ts` ↔ R `column_schema()`/`list_column_types()`.
- Option `kind` taxonomy + drift gate: `schema/columns/drift.test.ts`.
- D29 (settings-panel coverage) is adjacent — a themed variant would also be a
  candidate panel control once this lands.

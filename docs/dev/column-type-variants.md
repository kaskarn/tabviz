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

1. **Promote the variant SELECTION to a kind-tagged enum `OptionSpec`.** Give
   each variant-having schema a `variant` option (`kind: "presentation"`,
   `control: "segmented"`, `segments` = the schema's variant ids, `default` =
   first variant, `consumedBy: ["renderCell","emitSource","editor"]`). That one
   change makes the variant **theme-selectable** through the existing governed
   `column_defaults` pipeline, and surfaces it in `column_schema()` for free.
   (Open: declare it explicitly per schema vs. SYNTHESIZE it for any schema with
   a `variants` array — the latter is DRYer and can't drift; preferred.)
2. **`VariantSpec` stays the recipe DEFINITION.** Each enum value IS a variant
   id; `compileVariants()` still expands the selected one. No change to the
   compile machinery. The pvalue "pill" is the degenerate case: a trivial recipe
   expressed as a plain enum, no `VariantSpec` needed.

**Precedence (clean layering):** theme-variant < author-variant <
author-primitive-override. The ingest order already supports it: export runs
`applyThemeColumnDefaults` BEFORE `compileVariants` (`svg-generator.ts:3916→3917`).
The theme fills the variant id (author-wins, only if unset) → compile resolves
it → any author-set primitive overrides `__resolved`.

## OPEN FORK — the "exacting users" tier (D30)

"Still allow `VariantSpec` authoring for very exacting users" splits into two
genuinely different asks:

- **(a) Fine-tune within a variant** ("bracket_muted but with `–`"): requires the
  recipe primitives to be EXPOSED as kind-tagged options (the badge model). Then
  authors fine-tune (author-wins) AND themes can set them too. Means promoting
  interval's hidden `bounds*` primitives to real options — makes interval
  consistent with badge. Natural next step, cheap, fully governed.
- **(b) Define a NEW named recipe** ("my house bounds style"): requires a
  variant-AUTHORING API. JS has it (`registerSchema`/extend); R has no surface.
  Bigger arc; overlaps with custom-column-type extension.

→ **D30**, default **(a)** (expose recipe primitives; consistent with badge,
unblocks both author + theme fine-tuning).

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

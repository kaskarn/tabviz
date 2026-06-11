# W4 — v3 resolved-blob slimming + bridge retirement (scoping)

Status: **scoped 2026-06-11**; the LAST open pre-freeze wire item
(`wire-freeze-inventory.md`). Execution lands in arcs; each arc updates
the verdict table below. Joint with the component model
(`component-model.md` — the bridge clusters become component-table
entries; frame-region components go live as the bridges retire).

## Field-by-field verdict (survey 2026-06-11)

Reader counts = non-test `theme.<field>` reads outside
construction/types files. R-side: every field also round-trips through
`deserialize_resolved_theme` / the S7 WebTheme — slimming an emission
means touching blob + TS type + S7 class + (de)serializers together.

| Blob field | TS readers | Verdict |
|---|---|---|
| `marks` (MarksRecipes) | 0 | **DELETE** — nothing reads the cluster anywhere. |
| `cell` (CellCluster) | 0 | **DELETE** — consumers read `--tv-cell-*` tokens. |
| `annotation` (AnnotationCluster) | 0 | **DELETE** — the one grep hit is a forest-annotation object, not the cluster. |
| `lightDarkPair` | 0 | **DELETE** (verified 2026-06-11: no preset declares it, no reader anywhere — D1 precedent). |
| `webFonts` | live (font injection + ThemeSwitcher) | keep |
| `semantic` | 0 (the "1" was a types comment) | **DELETE** |
| `columnGroup` | 1 — the bridge emits `--tv-text-column-group-weight` from it, and THAT var has ZERO consumers | **DELETE** (cluster + bridge row + the var's KNOWN_UNCONSUMED entry, together) |
| `variants` | 6 | shrinking: headerStyle retired (W3); `firstColumnStyle` remains until the firstColumn bridge migrates; `density` mirrors the input — check readers |
| `accent`, `status` | ~14 each | real readers remain — migrate consumers to `--tv-accent` / `--tv-status-*` tokens (already in manifest), then delete |
| `text` | ~27 | the big one: migrate to `--tv-text-{role}-*` reads (typography tokens). Title/footnote fg done earlier; rest per-cluster |
| `series` | ~20 | KEEP — series slots are deliberately separate (component-model ruling); the slot system rides the blob |
| `spacing` | ~41 | KEEP for now — spacing pins are the live per-figure channel (`applySpacingPins`); retiring needs the spacing-system rework, NOT W4 |
| `header`, `rowGroup`, `row`, `firstColumn`, `borders`, `layout` | live | the BRIDGE clusters (#72–74) — see below |
| `axis`, `plot` | ~15/~24 | live config (axis defaults, plot dims) — keep; not v3 paint |

## Bridge retirement (#72–74 → component table)

`computeV3BridgeVars` realizes ~28 tokens from user-pinnable blob config
(`theme.borders/.firstColumn/.layout/.variants/.header/.rowGroup/.row`).
Retirement path per component-model.md: each cluster becomes manifest
tokens with REAL resolver groups + `binding` annotations (frame-region
components go live), user config moves to theme INPUTS (or pins), the
bridge rows delete, and the honesty-filtered roster channels appear
automatically.

Order of attack (smallest blast radius first):
1. `--tv-row-group-rule` + semantic-* emphasis pair (row cluster reads).
2. firstColumn cluster (4 tokens) → `first_column_style` becomes a
   theme INPUT (the header_style/W3 precedent, including killing the
   S7 mirror slot).
3. container (2 tokens) → layout stays spec-side; tokens resolve from
   geometry inputs.
4. borders cluster (9 tokens) → `border_preset` input already expands
   the cluster; the per-edge overrides become pins or a small input
   block. THEN `theme.borders` deletes from the blob.
5. header bg/fg/rule (active-variant trio) → header-cell component
   states already exist; the ACTIVE pick becomes a resolver that reads
   `inputs.header_style` (done for style; the bridge's hexes go).

## Sequencing

- Arc 1 — **LANDED 2026-06-11** (wire 1.7). Also took the fully
  orphaned MarkRecipe class/type both sides + deserialize_mark_recipe +
  five orphaned R S7 cluster classes + the inspect-resolved v3 rows.
  Original scope: delete SIX fields —
  marks, cell, annotation, semantic, columnGroup, lightDarkPair — from
  blob emission + TS WebTheme type (+ orphaned cluster types) +
  theme-adapter stamps + the column-group bridge row (+ its
  KNOWN_UNCONSUMED entry) + R S7 slots + deserialize/serialize +
  `inspect-resolved.R`'s v3 cascade-table rows for column_group/
  semantic (that table documents deleted clusters; rows go with them).
  Wire bump 1.6 → 1.7 (removal, pre-release).
- Arc 2: text-cluster consumer migration → typography tokens, then
  delete `theme.text`. STARTED 2026-06-11: the three trivial reads
  migrated (EffectAxis label.size → readLabelSize; Watermark
  body.family → readBodyFamily; TabvizPlot's measure-loop dep →
  --tv-text-body-size). Header typography LANDED same day:
  three REAL manifest tokens (header family/size/weight — typography
  resolver derives from the BODY recipe, size scaled 1.05; both
  runtimes read the same token, killing the v3-string-vs-v4-token
  divergence mode by construction; full-cssVars snapshots regenerated,
  diff = additions only; wysiwyg gate 0 breaches). Tick-italic dead
  fallback dropped. REMAINING for text-cluster deletion: the bridge
  title-fg row (v4 brand-text role differs from the v3 ink value —
  switching is a VISUAL change across presets, needs the visual
  battery review), the numeric-figures bridge row (figures is a
  designed knob — find its authoring source before constifying), the
  export validation check, then the R S7 text slot + TextRoles type.
- Arc 3+: bridge clusters in the order above; finish with
  accent/status passthrough migration.
- DONE when: `computeV3BridgeVars` is deleted, `v3-bridge` resolverGroup
  has zero manifest rows, and the blob carries only: name, inputs,
  roleOverrides, components, pins, webFonts, series, spacing, axis,
  plot, layout(spec-side keeps), firstColumnStyle-replacement input.

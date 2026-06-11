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
| `variants` | 1 | headerStyle retired (W3); **density DELETED 2026-06-11** (zero readers — spacing resolves from inputs.density); `firstColumnStyle` is the LAST variant, retires with the firstColumn bridge |
| `accent`, `status` | ~14 each | real readers remain — migrate consumers to `--tv-accent` / `--tv-status-*` tokens (already in manifest), then delete |
| `text` | 0 | **DELETED 2026-06-11** (wire 1.8) — all reads migrated to typography tokens |
| `series` | ~20 | KEEP — series slots are deliberately separate (component-model ruling); the slot system rides the blob |
| `spacing` | ~41 | KEEP for now — spacing pins are the live per-figure channel (`applySpacingPins`); retiring needs the spacing-system rework, NOT W4 |
| `header`, `rowGroup`, `row`, `borders`, `layout` | live | header/rowGroup/row: cluster fields still feed deserialize + some internals — slim AFTER the borders arc; `firstColumn` DELETED 2026-06-11; `borders` = the last bridge cluster |
| `axis`, `plot` | ~15/~24 | live config (axis defaults, plot dims) — keep; not v3 paint |

## Bridge retirement (#72–74 → component table)

`computeV3BridgeVars` realizes ~28 tokens from user-pinnable blob config
(`theme.borders/.firstColumn/.layout/.variants/.header/.rowGroup/.row`).
Retirement path per component-model.md: each cluster becomes manifest
tokens with REAL resolver groups + `binding` annotations (frame-region
components go live), user config moves to theme INPUTS (or pins), the
bridge rows delete, and the honesty-filtered roster channels appear
automatically.

**Equivalence sweep (2026-06-11, 9 presets × 10 candidate pairs):**
only `summary-fill ≡ series-1-fill` matches everywhere. Every other
bridge value (summary-border, axis-label/tick fg, the six semantic-*
rows, the header trio) is a DISTINCT v3 derivation — different mix
math, not a role mirror. Consequence (framework decision, delegated
authority): these clusters migrate by PORTING the v3 recipe into named
v4 resolver groups (the elevation/knockout precedent — computed
resolvers reading ctx.roles/ramps), NOT by re-binding to nearest roles
(which would be nine D18-scale visual decisions at once). Pixel-
faithful, kills the blob reads, and each recipe becomes inspectable +
eventually input-driven. Note while porting: the semantic-emphasis
CELL-scope pair needs a DOM↔export consistency look (v3 emits
transparent bg while v4 row-scope uses the highlight wash — possible
existing divergence).

Order of attack (smallest blast radius first):
1. ~~semantic-* (6 rows) + axis-label/tick fg (2 rows)~~ **PORTED
   2026-06-11**: recipes traced to exact reads (muted-fg ≡ role text;
   accent-fg ≡ accent-solid; axis-label ≡ text; emphasis-fg = ink
   ANCHOR; tick-fg = UNWALKED neutral[10] — new `ramp-direct` resolver
   group; three bgs = const transparent). Cell paint states
   (emphasis/muted/accent) are now component-model channels on `cell`;
   anchor + ramp-direct resolvers honor re-routes. `--tv-row-group-rule`
   still pending (rowGroup cluster).
2. ~~firstColumn cluster~~ **PORTED 2026-06-11** (wire 1.9):
   `first_column_style` is a Tier-1 INPUT (validators both sides; rides
   inputs on the wire); new `first-col` resolver group expands it into
   the four tokens (recipes exact: bold = neutral[2]/ink/600/neutral[6]);
   `theme.variants` + `theme.firstColumn` DELETED from the blob (+ S7
   mirror slot + both R cluster classes + dead "tint" enum value).
   first-column is a frame-region component now (bg/col/rule channels).
3. container (2 tokens) → layout stays spec-side; tokens resolve from
   geometry inputs.
4. borders cluster (9 tokens) → `border_preset` input already expands
   the cluster; the per-edge overrides become pins or a small input
   block. THEN `theme.borders` deletes from the blob.
5. ~~header bg/fg/rule (active trio)~~ **PORTED 2026-06-11** — new
   `header-active` resolver group keyed by inputs.header_style, reading
   the SAME role recipes as the per-variant tokens (one source of
   truth; the bridge trio could disagree with the variant tokens inside
   a single render — live double-source bug class). bold.rule mix
   ported pixel-faithfully; deltas elsewhere are subtle (fg ~imperceptible,
   rule one grade) and tint is unshipped. row-group-rule ported via
   ramp-direct neutral[7] (exact). Active trio + group-header rule are
   now component-model channels (header-cell bg/col/rule base,
   group-header rule).

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
  fallback dropped. D18 DECIDED + EXECUTED same day
  (title → role `text`; bridge row gone). numeric-figures promoted to a
  real typography emission (truthful constant "tnum" — NO authoring
  surface exists; Stage-3 figures channel makes it recipe-driven);
  bridge row gone. TEXT CLUSTER DELETION COMPLETE
  (wire 1.8, same day): blob `text` field gone both sides; TextRoles
  class deleted (TextRole survives inside the remaining clusters);
  save_plot's systemfonts injection + the R inspector read cssVars;
  the export's validation check repoints to authoringInputs; the dead
  S7 @text mutation test rewritten against the real authoring surface
  (fonts_numeric input).
- Arc 3+: bridge clusters in the order above; finish with
  accent/status passthrough migration.
- DONE when: `computeV3BridgeVars` is deleted, `v3-bridge` resolverGroup
  has zero manifest rows, and the blob carries only: name, inputs,
  roleOverrides, components, pins, webFonts, series, spacing, axis,
  plot, layout(spec-side keeps), firstColumnStyle-replacement input.

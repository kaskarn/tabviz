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
| `lightDarkPair` | 0 | **DECIDE** — designed-but-unconsumed forward convention (auto light/dark pairing). D1 precedent says kill; check whether any preset declares it first. |
| `webFonts` | live (font injection + ThemeSwitcher) | keep |
| `semantic`, `columnGroup` | 1 each | verify the single reader; likely migrate → delete |
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

- Arc 1 (cheap, immediate): delete marks/cell/annotation emissions +
  types + S7 + serializers; decide lightDarkPair; verify-and-clear
  semantic/columnGroup. Wire bump (removal, pre-release).
- Arc 2: text-cluster consumer migration (~27 reads → typography
  tokens), then delete `theme.text`.
- Arc 3+: bridge clusters in the order above; finish with
  accent/status passthrough migration.
- DONE when: `computeV3BridgeVars` is deleted, `v3-bridge` resolverGroup
  has zero manifest rows, and the blob carries only: name, inputs,
  roleOverrides, components, pins, webFonts, series, spacing, axis,
  plot, layout(spec-side keeps), firstColumnStyle-replacement input.

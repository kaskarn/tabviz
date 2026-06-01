# Theme rationalization arc — status and next steps

The 9-PR theme rationalization arc (Sprint 1 PR A–I) is complete on the
TypeScript side. The new V3 theme system is fully built, tested, and
self-consistent. **The V2 → V3 consumer cutover is the next implementation
sprint**: updating renderers, the settings panel, the R package, and
visual regression baselines to consume the V3 system as canonical.

## What landed (commits 6e39383 → HEAD)

### TS-side V3 system (new, parallel to V2)

| Module | Purpose |
|---|---|
| `srcjs/src/lib/oklch.ts` (extended) | APCA contrast (`apcaContrast`, `apcaLc`), `pickInkOnBg`, 12-step OKLCH-uniform `oklchRamp` + `rampStep` |
| `srcjs/src/types/theme-v3.ts` | `ThemeInputsV3` (T1), `TokenRampsV3` (T0), `TokenNameV3` (T2 vocabulary), `ColorRefV3` (tagged-object refs), `PaintRoleV3` / `ThemeRolesV3` (T3), cluster types (T4), `WebThemeV3` |
| `srcjs/src/lib/theme-resolve-v3.ts` | `buildRamps`, `resolveToken`, `resolveAllTokens`, `resolveRef`, `defaultRoles`, `defaultClusters`, `buildTheme` |
| `srcjs/src/lib/theme-css-v3.ts` | `buildThemeCssV3` — `--tv-*` variable emission from V3 theme |
| `srcjs/src/lib/roles-v3.ts` | Paint-role resolver: `resolveRole`, `activeRole`, `resolveActiveRole`, role precedence, mark opacity |
| `srcjs/src/lib/data-schemes-v3.ts` | Categorical (Okabe-Ito, Tableau, Set1/2, Dark2, Paired, Wong, brand_mono), Sequential (Viridis, Magma, Plasma, Blues/Greens/Greys/Oranges/Reds), Diverging (RdBu, PiYG, Spectral, BrBG). `sampleScheme` interpolator |
| `srcjs/src/lib/theme-wire-v3.ts` | `ThemeWireV3` (inputs + pins + overrides), `pin`/`release`/`isPinned`, `resolveWire`, `inspectLeaf`, provenance map |
| `srcjs/src/lib/theme-presets-v3.ts` | All 18 presets migrated to V3 inputs |
| `srcjs/src/stores/theme-store-v3.svelte.ts` | Svelte 5 runes reactive store wrapping a `ThemeWireV3` |

### R-side V3 (foundation)

| Module | Purpose |
|---|---|
| `R/classes-theme-v3.R` | `ThemeInputsV3` S7 class mirrors the TS shape; `theme_inputs_v3_to_json()` for V8 round-trip |

### Test coverage

- **126+ new bun tests** across 8 test files; all green
- 201 vitest tests; svelte-check 0 errors
- Full R suite green (including the 13 ThemeInputsV3 class tests)

### Verified invariants

- **APCA Lc ≥ 75** (body floor) for `ink` on `paper` across all 18 presets in both light + dark modes
- **APCA Lc ≥ 60** for `ink` on `paper_alt` (banding readability)
- **APCA Lc ≥ 45** for `brand_ink` on `brand` (header/badge floor)
- Two-color editorial themes (Lancet, Bauhaus, Dwarven, Elvish, Hobbit, Newsprint) produce visibly distinct `decorative_chrome` vs `brand`
- Categorical palettes are brand-independent (changing `inputs.brand` does NOT change which Okabe-Ito colors render)
- Mode toggle inverts the neutral ramp direction; T2 token names remain stable
- Wire round-trips via JSON; pin/release semantics are symmetric

## What's NOT yet done — PR J: Deep clean / canonize V3 / remove V1+V2 dead code

The V2 system is still load-bearing for the actual rendering pipeline.
Cutting over + deletion is the next planned PR (PR J in the arc):

### Consumer cutover (V2 → V3)

1. **`srcjs/src/lib/theme-css.ts`** — currently emits CSS vars from V2
   `theme.surface`, `theme.content`, `theme.divider`, `theme.row.*`, etc.
   Cut over to consume `WebThemeV3` and emit V3 vars via
   `buildThemeCssV3`. Update all CSS class selectors that reference the
   old `--tv-*` names (`--tv-surface-base` → `--tv-paper`,
   `--tv-content-primary` → `--tv-ink`, etc.).

2. **`srcjs/src/lib/semantic-styling.ts`** — currently reads from
   `theme.tokens.row[token]` (V2 PR 5 namespace, reverted). Cut over to
   `roles-v3.ts::resolveActiveRole`.

3. **`srcjs/src/svelte/TabvizPlot.svelte`** — currently calls
   `resolveSemanticBundle` (V2). Switch to `resolveActiveRole` (V3).

4. **`srcjs/src/export/svg-generator.ts`** — currently reads
   `theme.surface.muted`, `theme.row.alt.bg`, etc. Update to consume
   V3 token names via `resolveRef` + cluster shorthand vars.

5. **Settings panel** — 8 control files (`ThemeControl.svelte`,
   `TokensControl.svelte`, `MarksControl.svelte`,
   `LayoutControl.svelte`, `TextControl.svelte`, `BandingControl.svelte`,
   `ColorField.svelte`, `swatch-palettes.ts`) currently write to V2
   paths via `setThemeField`. Each migrates to hook into
   `ThemeStoreV3` via `setInput` / `pinPath` / `inspect`.

6. **R-side preset migration** — `R/themes.R`, `R/themes-design.R`,
   `R/themes-lotr.R` currently construct V2 `WebTheme` via deep S7
   structures. Replace each preset with a V3 wire built from a
   `ThemeInputsV3` (sourced from `theme-presets-v3.ts` via V8).

7. **R-side authoring API** — `R/themes-api.R::web_theme()` is the V2
   constructor. Rewrite to take `brand, accent, decorative, mode,
   categorical, ...` arguments and produce a `ThemeWireV3`. Add
   `set_brand()` / `set_decorative()` / `set_mode()` / `set_categorical()` /
   `pin()` / `release()` modifiers.

8. **R deserialize** — `R/utils-deserialize-resolved.R` currently
   reconstructs an S7 `WebTheme` from a V2 resolved blob. Update to
   parse `ThemeWireV3` (or to deserialize the V3 resolved theme that
   V8 returns).

9. **Visual regression baselines** — wholesale theme rebuild means
   every `tests/visual/baselines/*.png` will differ. Re-shoot after
   the consumer cutover lands; review diffs at commit time.

10. **Delete V2** — once cutover is complete:
    - `R/classes-theme.R` V2 classes (`WebTheme`, `Surfaces`,
      `Content`, `Dividers`, `AccentRoles`, `Semantics`, `SlotRole`,
      `TextRoles`, `RowCluster`, `CellCluster`, `FirstColumnCluster`,
      `PlotScaffold`, etc.)
    - `srcjs/src/types/theme-v2.ts` interfaces
    - `srcjs/src/lib/theme-resolve.ts` (V2 resolver)
    - `srcjs/src/lib/theme-presets-v2.json` (V2 preset snapshot)
    - Drop the `-v3` suffix from all new files

11. **Legacy shim cleanup** — V2 shims from earlier Sprint 1 PRs
    (SlotBundle alias, firstColumn.plain fallback) get deleted with V2.

12. **Docs sweep** — update `docs/dev/r-ts-parity-notes.md`,
    `srcjs/src/schema/ARCHITECTURE.md`, NEWS.md with the V3 token
    vocabulary references.

## Concept reference

See `~/.claude/projects/-Users-antoine-dev-r-forest/memory/project_theme_rationalization.md`
for the locked design decisions (16-item matrix; the conceptual contract).

The plan `~/.claude/plans/theme-rationalization.md` was the original
multi-PR roadmap. PRs A–H landed as planned; PR I was scoped down to
docs + status (this file) given that the consumer cutover is a
significant follow-up sprint.

## Why this scoping

Deleting V2 in one PR would require touching ~60 source files, all R
presets, the entire settings panel, and re-shooting every visual
baseline — easily a week of focused work, with major rendering-pipeline
risk if any reader of `theme.surface.muted` or `theme.row.alt.bg` is
missed. Cleanly shipping V3 as a parallel, fully-tested foundation lets
the cutover be incremental: each consumer migrates on its own schedule
with V2 staying functional throughout. The cutover sprint can also
re-shoot baselines in one focused pass once all consumers are on V3.

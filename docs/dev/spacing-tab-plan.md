# Spacing tab — design & implementation plan

Status: **phases 1–4 landed** (2026-07-24). Synthesised from a four-agent design fan-out
(IA · tier/persistence · verb+harness · overlap-reconciliation). Supersedes the
`set_spacing`-only posture of **decision D25** (see decision-register: D25 is
overruled by this arc).

Goal: a new **Spacing** surface in the interactive settings panel giving
well-organised, extensive per-token control over spacing (padding, gaps, row /
header heights) — in accordance with package idioms (sanctioned-verb writes,
seam grammar, consequence/liveness harness coverage, theme-portable travel).

---

## 1. Locked decisions

| # | Decision | Rationale |
|---|---|---|
| S-1 | **Overrides are a Tier-1 authoring input** `spacing_overrides: Partial<Record<SpacingToken, number>>`, applied by the resolver **after** `density × density_factor`, then flowing through the existing `applySpacingPins` overlay. | Routes through the already-blessed `setAuthoringInputs`/`previewAuthoringInputs` channel → tier-gate clean (panel never writes a raw T3 path), dirty-tracked, portable (rides the `inputs` envelope), survives re-resolution. The overlay mechanism already exists. |
| S-2 | **One mechanism.** `R set_spacing()` and the four arrange-tool canvas seams (header-height / group-gap / footer-gap / title-gap) redirect onto `spacing_overrides` too. | Avoids two divergent paths writing the same tokens with different keys/travel. Retires the last DT-11 canvas exemption (net cleanup). |
| S-3 | **Placement:** a `spacing` **inner tab under "Edit theme"** → spine `Identity \| Plots \| Styling \| Spacing`. Not a top-level tab. | Content is overwhelmingly theme-tier editing (reverts under *Reset theme*) → definitionally Edit-theme cluster material; a top-level tab over-promotes an expert concern (D21 demoted spacing L2→L4). |
| S-4 | **`density_factor` moves** Styling → Spacing (consolidate, not mirror). Variations density **preset** stays put (maintainer constraint); its signpost repoints to Spacing. | One canonical home for the coarse dial; anti-redundancy per D21. |
| S-5 | **Row heights: relocate** FigureBand's per-kind height sliders into a **figure-scoped sub-band** inside the Spacing tab (maintainer choice). Theme-tier `rowHeight` (base) and figure-tier per-kind pins coexist; per-kind pin wins at display. | All height control in one place. Requires careful dual reset-scope handling (see §5, §7). |
| S-6 | **Overrides are absolute px, sparse, reset-to-auto by dropping the key.** Resolution order: `preset → density_factor → per-token override`. Changing preset/factor re-bases every non-overridden token live; pinned tokens hold. | Matches `set_pin` overlay semantics and cascade "pins survive re-resolution". A per-token *relative* mode, if ever wanted, is a separate `spacingScale` field — never overload the px field. |

---

## 2. Token verdicts (evidence-based)

Canonical roster = the **15 `DENSITY_PX` keys** (`density-presets.ts`). Verdicts
below from a reader trace (2026-07-24).

**Expose — first cut (11 shipped):** `row_height`, `cell_padding_x`,
`column_group_padding`, `row_group_padding`, `header_height`, `header_gap`,
`title_subtitle_gap`, `axis_gap`, `footer_gap`, `bottom_margin` — plus
`density_factor` as the section's coarse dial. (`padding` is live but not
surfaced in the first cut; see below.)

**CORRECTION — `group_padding` is NOT live (found by the consequence gate,
2026-07-24).** The verdict below was a misread: `columns.svelte:766` and
`svg-generator.ts:630` both use a LOCAL variable named `groupPadding` that
reads `--tv-spacing-column-group-padding` — i.e. `column_group_padding`, a
different token. The `group_padding` token has **no CSS var** (`applySpacingPins`
never pins it) and **no reader** in either runtime; only a stale doc comment in
`rendering-constants.ts` describes it. Its slider measured 0px in
`settings-consequence` and was pulled from the tab — exactly the D28
"reaches the theme, nothing renders it" class the gate exists to catch. It
rejoins the tab when a renderer consumes it. It stays in `SPACING_TOKEN_KEYS`
(the roster is the full 15 `DENSITY_PX` keys).

- `padding` — **live** in auto-fit layout math (`layout-zoom.svelte.ts` ×5,
  `svg-generator.ts`); width-affecting. Not "ambiguous-dead". Label as the
  outer table inset (see §6).
- ~~`group_padding` — live via object-path reads~~ — **WRONG, see the
  correction above.** Those sites read `column_group_padding`. Deferred.
- `bottom_margin` — live (`TabvizPlot.svelte` container `padding-bottom`), but
  its consequence is figure-bottom air that falls **outside** the
  settings-consequence pixel clip → harness exemption + box-model snapshot as
  the consumption proof (§7).

**Defer — needs upstream work before exposing (3):**

| Token | Why deferred | Unblock |
|---|---|---|
| `indent_per_level` | **Triple-sourced.** DOM row indent uses `theme.rowGroup.indentPerLevel` (default 16, `TabvizPlot.svelte:1963`), NOT `--tv-spacing-indent-per-level`. Export mixes both (`svg-generator.ts:403/1861` token vs `:3269` rowGroup). A spacing-token slider wouldn't move the DOM → false-live (D28 class). | Unify indent sources (own arc, sizing-model §1.2), or wire the control to `rowGroup.indentPerLevel`. |
| `cell_padding_y` | Deprecated for body/header cells (`svg-generator.ts:757` "header-cell uses 0 vertical padding now"; schema default 0, historically faked by `+6`, sizing-model §1.2). Only `heatmap-svg-renderer.ts:113` honestly reads it. | Wire honest vertical cell padding for regular rows first. |
| `container_padding` | **Live** (`TabvizPlot.svelte:2964` container padding) but 0 across all presets and overlaps `padding`. Low value, confusing pair. | Expert-only disclosure later, if a real use emerges. |

**Separate system — Phase 2:** shell/paper pads (`shell-paper.ts`, mode-gated,
scale with `density_factor`). Not in the `DENSITY_PX` roster; a conditional
"Page frame" section writing their own inputs. Deferred to keep the first cut to
the 12 core tokens.

---

## 3. Wire & roster gaps to fix

1. **R serialize map** (`R/utils-serialize-resolved.R:102–114`) emits **13**
   tokens — **`cellPaddingY` and `groupPadding` are dropped**. Add both (also
   verify the S7 `SpacingTokens` class at `R/classes-theme.R:606` carries all
   15 fields).
2. **New `SPACING_TOKEN_KEYS` roster** in `srcjs/src/lib/theme/spacing-tokens.ts`
   (single source), sync-gated R↔TS via `test-spacing-roster-sync.R`
   (source-parse gate → keep in the in-tree `R-CMD-check.yaml` filter, it reads
   `../../srcjs` and skips in the tarball).
3. The verb-agent's draft union omitted `groupPadding` — exactly what the sync
   gate exists to catch.

---

## 4. Architecture / injection points

- **Input type:** add `spacing_overrides?: Partial<Record<SpacingToken, number>>`
  to `srcjs/src/types/theme-inputs.ts` (beside `density_factor` :178 /
  `series_overrides` :213).
- **Resolver merge — ONE injection point** (verified 2026-07-24): merge into the
  resolved `theme.spacing` cluster at its source, `theme-adapter.ts:263`
  (`applySpacingOverrides(scaleSpacing(...), inputs.spacing_overrides)`). This is
  sufficient because `applySpacingPins` is the **final cssVars overlay in every
  emitter** — `getCssVars` returns `applySpacingPins({...withBridge}, theme)`
  (widget + export via `svg-generator`'s `getCssVars`) and `theme-css.ts`'s
  `_emitV4CssVarsBody:168` also calls it — and it reads `theme.spacing.*`, so it
  wins over whatever `tokenDensityPx` emitted. Object-path consumers
  (`groupPadding` in `columns.svelte`; `rowGroup.indentPerLevel = spacing.indentPerLevel`)
  read the same cluster. **`tokenDensityPx` / `resolve-theme.ts` need NO change.**
  DONE. Proof: `theme-spacing-overrides.test.ts` (7 cases). NOTE: the test also
  shows `indentPerLevel` → `rowGroup.indentPerLevel` (the DOM indent source) DOES
  respond — the §2 indent-deferral is softer than first thought; revisit after an
  export-path check.
- **Ingress validation:** spacing reaches geometry (SVG coords/sizes) → validate
  at every ingress like `series_overrides` — `parseThemeWire` /
  `validateThemeInputs` (TS) + R `theme_inputs_from_wire`. `clampSpacing(token, v)`:
  finite-guard (`Number.isFinite`, rejects NaN/±Inf — the poison class),
  per-token `[min,max]` bounds. Garbage token keys dropped.

---

## 5. Sanctioned store verbs (theme slice)

All thin wrappers over `setAuthoringInputs` / `previewAuthoringInputs`:

```ts
setSpacingOverride(token: SpacingToken, value: number | null): void  // commit; null = clear
previewSpacingOverride(token: SpacingToken, value: number): void      // per drag tick; no remeasure/contrast
clearSpacingOverride(token: SpacingToken): void                       // = setSpacingOverride(t, null)
resetSpacingOverrides(): void                                         // spacing_overrides = undefined
// getter:
readonly spacingRoster: ReadonlyArray<{ token; px; overridden; widthAffecting }>
```

- `$state.raw` correctness inherited (the authoring channel reassigns via
  `rebuild()` → `setSpec`). Commit flips `authoringEdited`; *Reset theme*
  (`resetThemeEdits`) drops the overrides for free.
- Row-kind height relocation keeps its **own** figure-tier verbs
  (`setRowKindHeight` / `resetRowKindHeights`) — the sub-band calls those, not
  the spacing verbs. Do **not** orphan `resetRowKindHeights` from a Reset
  control (FigureBand's `resetFigure` owns it today; the relocated sub-band must
  keep a *Reset figure* affordance wired to it).

---

## 6. IA — sections, controls, labels

Inner tab, region-grouped outer→in. `data-spt` marker. Every control a
seam-grammar `Slider` (preview `onchange` → one `oncommit`; Escape cancels
restoring value **and** pin state; dblclick → auto; px readout; arrow nudge).

```
SPACING (inner tab)
├ lede: "Coarse density is in Variations. Overrides here are absolute and
│        survive density changes — reset any control to rejoin the preset."
├ strata DENSITY
│   • Overall density  (density_factor, ×0.50–2.00 step .01, "×1.00")   [data-spt]
├ strata ROWS & CELLS            (always open)
│   • Row height        (row_height, theme base)      12–120
│   • Cell side padding (cell_padding_x)               0–40
├ strata GROUPS                  (disclosure, summary "N adjusted")
│   • Group heading padding (column_group_padding)     0–40
│   • Group row padding     (row_group_padding)        0–40
│   • Space between groups  (group_padding)            0–60
├ strata HEADER & FOOTER         (disclosure)
│   • Header row height  (header_height)   16–120
│   • Header-to-body gap (header_gap)       0–60
│   • Title–subtitle gap (title_subtitle_gap) 0–40
│   • Axis gap           (axis_gap)         0–60
│   • Footer gap         (footer_gap)       0–60
│   • Bottom margin      (bottom_margin)    0–80
├ strata ROW HEIGHTS BY TYPE     (figure-scoped sub-band — relocated FigureBand)
│   • per-kind sliders (data / group header / summary / spacer …)  → setRowKindHeight
│   • "Stays with this figure" note + Reset figure ↻ (→ resetRowKindHeights)
└ (foot) Reset spacing ↻  → resetSpacingOverrides (theme-tier only)
```

Labels (sentence-case, each with a one-line hint): Overall density · Row height ·
Cell side padding · Group heading padding · Group row padding · Space between
groups · Header row height · Header-to-body gap · Title–subtitle gap · Axis gap ·
Footer gap · Bottom margin. `padding` (if surfaced) = "Table inset".

**Override state per slider:** not-overridden shows the resolved base (`preset ×
factor`) marked *auto* (no reset arrow); dragging pins an absolute px override
that survives preset/factor changes and shows `Field.onreset` ✕. Disclosure
summaries show an "N adjusted" count.

---

## 7. Harness plan

- **`settings-consequence.browser.ts`**: add a `data-spt` walk block after the
  Styling walk (the `walk(attr)` helper is attribute-parameterised). **Arm the
  fixture**: add a subtitle (`titleSubtitleGap`), a footnote (`footerGap`), and
  a `ColumnGroup` (`columnGroupPadding`) so every gap token has geometry to move.
- **Honest ≥floor** (walk for real): row_height, header_height, padding,
  cell_padding_x, axis_gap, row_group_padding, header_gap, title_subtitle_gap,
  footer_gap, column_group_padding, group_padding.
- **Sub-floor exemptions** (`LIVENESS_VERIFIED`-style, with reason):
  `bottom_margin`, `container_padding` — consequence falls outside the fixed
  pixel clip. Cite `layout-metrics.test.ts` (box-model snapshot records per-row
  top/height + per-column x/width → the *consumption* proof) rather than
  panel-liveness alone (D28: liveness proves reach, not consumption).
- **`panel-liveness.browser.ts`**: extend the walk topology for the new inner
  tab; confirm a renderer reads each token (not just the panel preview).
- **`settings-band-contract.test.ts`**: add `expect(names).toContain("SpacingTab.svelte")`
  sanity assertion; the FORBIDDEN list is unchanged (verbs stay in `$stores`,
  excluded from the scan) — the transitive import walk auto-scans the new tab,
  so any future raw-path write there fails the gate.
- **Unit**: `spacing-tokens.test.ts` (bun — roster completeness vs
  `applySpacingPins`, `clampSpacing` bounds + non-finite rejection,
  widthAffecting vs `SPACING_WIDTH_FIELDS`); `theme-spacing.runes.ts` (vitest —
  set/preview/clear/reset, input-only proof i.e. `themeOverrides` unchanged,
  survives re-resolution, composition order, `previewSpacingOverride` skips
  remeasure while commit remeasures width-affecting tokens); resolver test
  (override applies after `scaleSpacing`); R `test-parity-themes.R` case +
  `test-spacing-roster-sync.R`.

---

## 8. Phased implementation

1. **Substrate — DONE (2026-07-24), validated end-to-end.**
   - TS: `spacing-tokens.ts` (roster + `clampSpacing` + `sanitize` + `applyOverrides`);
     `spacing_overrides` in `theme-inputs.ts`; resolver merge at the SINGLE cluster
     source (`theme-adapter.ts` — `applySpacingPins` overlay propagates it to every
     emitter; `resolve-theme` untouched); `validateThemeInputs` ingress block.
     Tests: `spacing-tokens.test.ts` + `theme-spacing-overrides.test.ts` (17, green);
     `npm run check` clean; 455 theme tests green (no regression).
   - R: S7 `SpacingTokens` class + serialize map fixed (+`cell_padding_y`/`group_padding`,
     the real dropped-token bug); `TABVIZ_SPACING_TOKENS` + `TABVIZ_SPACING_BOUNDS`
     rosters; `spacing_overrides` field + validator on `ThemeInputs`; serialize
     (`theme_inputs_to_json`) + untrusted wire-read (`theme_inputs_from_wire`) +
     `web_theme()` param + roxygen. Gate: `test-spacing-roster-sync.R` (20, green) —
     R↔TS roster sync (camelCase + snake + DENSITY_PX), full wire round-trip,
     untrusted-wire sanitize, validator rejection, AND V8-resolve parity
     (`over@spacing@row_height == 44` end-to-end). Bundles rebuilt.
2. **Verbs — DONE (2026-07-24).** theme-slice `setSpacingOverride` /
   `previewSpacingOverride` / `clearSpacingOverride` / `resetSpacingOverrides` +
   `spacingRoster()` — all thin wrappers over the sanctioned `setAuthoringInputs`
   / `previewAuthoringInputs` channel (input-only, DT-11-clean, clamped,
   non-finite no-op, commit-remeasures-width-affecting / preview-skips). Tests:
   `theme-spacing.runes.ts` (10, green); type-check clean; 27 theme.runes +
   23 band-contract green (no regression, gate still passes).
3. **UI — DONE (2026-07-24).** `SpacingTab.svelte` mounted as the 4th inner tab
   of `EditThemeCluster` (`identity | plots | styling | spacing`);
   `density_factor` MOVED off Styling (not mirrored); row-kind sub-band
   relocated out of `FigureBand` (its disclosure gutter-reset calls
   `resetRowKindHeights`, and FigureBand's *Reset figure* still clears them —
   the pins are never orphaned); FigureBand keeps the scoped reset + a pointer
   note. Variations signpost repointed to Spacing. Arrange seams repointed:
   all four (`headerHeight` / `rowGroupPadding` / `titleSubtitleGap` /
   `footerGap`) now write `spacing_overrides` through the sanctioned verbs —
   **the last DT-11 canvas exemption is retired; no `.svelte` in the repo calls
   `setThemeField`/`previewThemeField` any more.** R `set_spacing()` rewritten
   onto the input (accepts snake or camel names, `NULL` releases, validator
   enforces bounds) — so R, panel and canvas are ONE mechanism.
   - **New seam-grammar plumbing:** committing a seam now CREATES an override,
     so `onpreview(startValue)` was no longer a sufficient Escape — it restores
     the number but leaves an override key on a formerly-auto token. Added
     `EdgeResize.oncancel` + store `cancelPreviewSpacingOverride(token)`
     (snapshots the committed value/absence at the first preview tick).
     Gates: 4 cases in `theme-spacing.runes.ts` + a seam Escape case in
     `arrange-tool.browser.ts`.
   - **Bounds widened** for `rowGroupPadding` (40→60), `footerGap` (60→80),
     `titleSubtitleGap` (40→60) so redirecting the canvas seams didn't shorten
     a drag range users already had. R + TS tables move together (sync-gated).
4. **Harness — DONE (2026-07-24).** `settings-consequence` walks `data-spt`
   (fixture armed with a subtitle, a footnote and a `colGroup`); all 11 tokens
   + the density dial move real pixels (footerGap 40903px, rowHeight 164504px).
   Two harness lessons baked in: (a) the walk now takes an optional
   `beforeEach` and the Spacing tab passes `resetThemeToBaseline` — its
   controls all inflate the SAME geometry, so mid-walk the footer had been
   pushed out of the clip and a live control read 0px (accumulated state
   SUPPRESSING consequence, the mirror of the inflation case); (b)
   `bottomMargin` is `LIVENESS_VERIFIED` — figure-bottom air falls outside the
   clip, consumption proven by `layout-metrics`. `panel-liveness` walks the new
   inner tab; `settings-band-contract` asserts the walk reaches
   `SpacingTab.svelte`.
5. **Docs** — this file kept current; decision-register D25 overruled by D42;
   arc-history dated entry at land.

## 9. Open items

- Shell/paper "Page frame" section — Phase 2.
- Deferred quartet — each needs an upstream unblock before exposing (§2):
  `indent_per_level` (triple-sourced), `cell_padding_y` (deprecated for body
  cells), `container_padding` (0-default, overlaps `padding`), and now
  `group_padding` (no renderer at all).
- `padding` ("table inset") is live and width-affecting but unsurfaced — add
  it when a use case asks; it needs a label that doesn't read as a synonym of
  `container_padding`.

Settled during implementation: the clamp table (§4, bounds widened as above)
and `rowHeight`-vs-per-kind-pin precedence (per-kind still wins at display —
the relocation only moved the control, not the cascade).

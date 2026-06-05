# Wire-audit remediation plan

Draft 2026-06-04 after the rgc_v4 audit landed (`wire-audit.md`). Tracks the
end-to-end fix sequence for B1-B18. Sized by coupling, ordered by leverage.

**Pre-plan landed already (this session):**
- ✓ B1: studio swatches identical — `ThemeSwitcher.lookupTheme()` now falls back to `THEME_PRESETS[name]` when `availableThemes` is undefined
- ✓ Theme registry: synthwave/brutalist/atelier/executive added to `THEME_NAMES`/`THEME_LABELS` (were defined in `PRESETS` but not exposed; user couldn't pick them interactively)
- ✓ Wire-audit doc + memory `project_rgc_design_lab` corrected to point at `dev/rgc_v4.zip`

---

## Sequencing principles

1. **Highest-leverage first.** B14 (shell+paper DOM) closes 4 bugs simultaneously and unblocks ~80% of the visual ceiling per the aesthetic agent. Goes first.
2. **Substrate before presets.** Adding new anchors (B7/B8) before re-pinning presets avoids two rounds of preset edits.
3. **Schema cleanup before refactors.** B10 (declarative `modes`) and B12 (Tier-1 header/title) reduce surface area before the LCH UI work in B9.
4. **Diagnostics decoupled.** B2 (padding runaway) and B3 (studio crash) get their own track — runtime traces, not architectural decisions.
5. **No commits without verification.** Every phase ends with: bun + svelte-check + R suite + visual regression + a specific eyeball check named in the phase.

---

## Pass 1 — Visual ceiling unblock (highest leverage)

Goal: every effects/shell/texture pin in the substrate becomes observable. Synthwave actually glows, Brutalist actually shows its grid texture, the elevation series produces a real raised-paper card.

### 1a. **B14** — shell+paper DOM wrapper + real `theme-runtime.css` import

**The single most important change in the plan.** Per the aesthetic agent: the substrate ships shell/paper/texture/glass tokens, the resolver fills them, but the canonical paint surface is dead-imported. One DOM wrap + one CSS import wires all of it.

Steps:
1. `srcjs/src/svelte/TabvizPlot.svelte` — wrap the existing widget DOM as:
   ```svelte
   <div class="tabviz-shell"
        data-shell-mode={inputs?.shell_mode ?? "flush"}
        data-shell-texture={inputs?.shell_texture ?? "none"}>
     <div class="tabviz-paper"
          data-paper-texture={inputs?.paper_texture ?? inputs?.shell_texture ?? "none"}>
       <!-- existing root -->
     </div>
   </div>
   ```
2. Inject `theme-runtime.css` via `<svelte:head>` (`import runtimeCss from "$lib/theme/theme-runtime.css?raw"`).
3. Verify CSS selectors in `theme-runtime.css` actually match — agent's grep showed nothing emits `.tabviz-shell` today; once we do, selectors should fire.
4. Walk every existing layout dependency: scroll containers, click capture targets, drag handles. Adding a wrapper changes `containerRef` semantics if `containerRef = .tabviz-shell` vs `.tabviz-paper`. **Pick one canonical containerRef and audit measure-row $effect + layoutOverlay paths.**
5. Sizing harness regen — `bun test src/export/layout-metrics.test.ts --update-snapshots` (geometry snapshots will move because shell+paper introduces padding).

Validation:
- Visual regression: synthwave now renders neon glow; brutalist now shows grid; elevation presets show raised paper.
- Browser repro: open studio, switch to Synthwave — frame glows. Switch to Brutalist — grid pattern visible.
- Confirm B2 (padding runaway) doesn't get worse — the DOM wrap could compound it. Run the local repro fixture before/after.

Risk: medium-high. Widget root DOM is the hottest seam in the codebase. Touches every layout test.

### 1b. **B5** — preset status anchor coverage

Per the cross-preset probe, all 22 presets share identical `STATUS_ANCHOR_FALLBACK` semantics. Brutalist should have its vermilion `*` markers; clinical themes should keep clean semantic palettes; LOTR themes get period-appropriate semantics.

Steps:
1. In `srcjs/src/lib/theme/theme-presets-inputs.ts`: add `status: { positive, negative, warning, info }` triples to each preset that wants a distinctive semantic palette. Showcase + LOTR first (highest visual differentiation), journals second.
2. R-side: mirror in `R/themes-*.R` so the wire stays parity-equal.
3. Re-run `tests/testthat/test-parity-themes.R` (KNOWN_DIVERGENCES = empty must hold).

Validation:
- Visual regression: badges in brutalist render vermilion `**`.
- Cross-preset probe: status anchors now distinct across 22 (no more single-value `#16A34A` for all).

Risk: low. Pure-data change. Parity test catches drift.

### 1c. **B15** — brutalist body font

Two-line change. `R/themes-showcase.R`'s `web_theme_brutalist()` pins `fonts.body = "'Inter', ..."`. Lab uses Space Grotesk. Change to Space Grotesk + add to `web_fonts`.

Validation: brutalist preset renders with display-sans body. Parity test must still pass.

Risk: trivial.

### 1d. **(deferred)** Don't auto-pin `density_factor` on any preset

Even after B14, the cross-preset probe will still show only 3 distinct row heights. Fine — `density_factor` is an *author* knob (fine-tune from the preset's base), not a *preset* dial. Don't pre-bake (per memory `feedback_dont_pre_bake_defaults`). Document in `wire-audit.md` and move on.

---

## Pass 2 — Substrate vocabulary extensions

Goal: close the lab's input-surface gap (B7, B8, B12).

### 2a. **B7** — add `anchors.ink2` (rubrication ink)

Steps:
1. `srcjs/src/types/theme-inputs.ts` — add `ink2?: OklchTriple` to `ThemeAnchors`. Optional; defaults absent.
2. `srcjs/src/lib/theme/resolve-theme.ts` — branch the accent ramp seed: `const accentAnchor = inputs.anchors.ink2 ?? inputs.anchors.accent ?? inputs.anchors.brand`. Mirror lab's `engine.jsx:322-326`.
3. R-side: add `anchors_ink2_L/_C/_H` slots to `ThemeInputs` S7 class; `set_anchor(theme, "ink2", ...)` modifier; `theme_inputs_to_json()` emission.
4. Add 1-2 presets that lean on it: `ledger` (oxblood rubrication) as a new editorial preset OR extend `brutalist` to use ink2 for `**`.
5. Document the role: ink2 seeds the accent ramp; `accent` (when also set) is engagement. Reflect in CLAUDE.md "Wire naming convention" section.

Validation:
- Parity test (`test-parity-themes.R`) — KNOWN_DIVERGENCES still empty.
- Existing presets don't change behavior (ink2 defaults absent).
- New ledger preset renders with rubrication.

Risk: medium. Wire-format addition (additive, no break). Touches both runtimes.

### 2b. **B8** — add `inputs.alias_neutral_to_brand`

Steps:
1. `srcjs/src/types/theme-inputs.ts` — add `alias_neutral_to_brand?: boolean` (default false).
2. `srcjs/src/lib/theme/resolve-theme.ts` — `buildRamps` branch: when true, run `lerp(aliasHue.C * 0.18, aliasHue.C * 0.62, t)` on neutrals using brand's H. Per `engine.jsx:82-89`.
3. R: mirror slot + setter.
4. Add a `terminal` preset (phosphor green monochrome) to showcase the toggle.

Validation:
- Terminal preset is monochrome with a single brand-hue control. Substrate verified visually.

Risk: medium. Resolver branch; additive.

### 2c. **B12** — promote header/title styles to Tier-1

Replaces tasks #72/#74's v3-bridge approach. Lab treats these as first-class effects inputs (`engine.jsx:223-224, 555-571`).

Steps:
1. `srcjs/src/types/theme-inputs.ts` — add `effects.header_style ∈ {"normal","tint","fill"}` and `effects.title_style ∈ {"normal","bar","underline"}`.
2. `srcjs/src/lib/theme/component-tokens.ts` — drop the v3-bridge sentinel on `--tv-header-bg/fg/rule`; replace with real `tier: "computed"` entries that the resolver populates from `effects.header_style`.
3. `srcjs/src/lib/theme/resolve-theme.ts` — add `resolveHeaderVariantComputed` / `resolveTitleVariantComputed` mirroring `engine.jsx:555-571`.
4. R: mirror inputs (`effects_header_style`, `effects_title_style`).
5. Migrate presets to use the new inputs (synthwave uses underline title; brutalist uses bar; etc.).
6. Delete v3 bridge for these tokens from `theme-css.ts`.

Validation:
- KNOWN_UNCONSUMED shrinks by ~4-6 entries.
- v3-bridge sentinel count drops.
- Visual regression: header variant changes by switching `effects.header_style`.

Risk: high. Touches manifest + resolver + R + presets + theme-css.ts. But the substrate is currently dishonest here; B12 makes it honest.

---

## Pass 3 — Schema cleanup

Goal: reduce manifest debt the API agent flagged ("the schema over-engineered the schema while still being incomplete").

### 3a. **B10** — declarative `modes:{hc,rt}` consumption

Steps:
1. `srcjs/src/lib/theme/resolve-theme.ts` — replace inline `applyHcGradePush` + `HC_PUSH` with manifest-driven dispatch on `token.modes.hc.swap` / `token.modes.rt.drop`. Per CLAUDE.md "HC mode behavior migration."
2. Delete the inline HC logic.
3. Each manifest entry that should HC-drop or HC-swap gets the right `modes` annotation.

Validation:
- HC mode rendering unchanged on all 22 presets (visual regression).
- No HC-behavior code outside `resolveTokenValue`.

Risk: medium. Touches resolver core. Visual regression test net is the safety.

### 3b. **B11** — density enum naming decision

Choices:
- **(A)** Document the lab-vs-tabviz translation table in CLAUDE.md and `theme-cascade-stage-1-design.md`. Zero code change. Authors comparing screenshots get a Rosetta stone.
- **(B)** Rename `comfortable → cozy` in `DENSITY_VALUES`, presets, R API, theme-css.ts. Wire-bump. High blast radius.
- **(C)** Add `cozy` as an alias (both `comfortable` and `cozy` accepted; cozy preferred going forward). Compat-shim debt.

Recommend (A) unless the user wants the rename. Decision needs user input.

Validation: doc-only.

Risk: trivial / (B) high.

---

## Pass 4 — Authoring surface

### 4a. **B9** — LCH-native studio anchor controls

Steps:
1. `srcjs/src/studio/AnchorControls.svelte` — replace the per-anchor row with `playground.jsx::ColorAnchor`-style 3-slider layout: L/C/H sliders inline + hex sibling control.
2. Existing OklchPicker dialog stays as the deep-dive editor (eyedropper / 2D field).
3. Real-time cascade-re-resolve must hold (no fps regression).

Validation:
- Manual UX walkthrough: open studio, change `anchors.paper.L` via slider, watch table re-paint.

Risk: low-medium. Self-contained studio component.

---

## Pass 5 — Net-new substrate

### 5a. **B17** — caption chip + strip primitives

Largest scope item. Adds:
- `<TabvizCaption>` Svelte component
- Caption cluster in `component-tokens.ts` (chip-bg, chip-fg, chip-border, strip-gradient, strip-height)
- Caption inputs in `theme-inputs.ts`: `effects.caption_style ∈ {"none","chip","stripe"}`
- R API mirror

Defer until Pass 1-4 land. This is "the last 20%" per the aesthetic agent.

---

## Diagnostic track (parallel)

### D1. **B2** — group-padding runaway

Steps:
1. Repro in studio (any color change triggers it per user).
2. Browser DevTools — watch `theme.spacing.rowGroupPadding` across a single change.
3. If accumulates, trace the writer. If not, the symptom is in the layout `$effect` chain → measured row heights → ...

### D2. **B3** — studio color-change crash

Steps:
1. Repro. Capture stack trace.
2. Likely path: `previewThemeField` → `writeThemePath` → cascade re-resolve → some derived state hits a null path.

Both diagnostic items can run in parallel with the architectural passes.

---

## Open decisions

- **Pass 1d**: defer or not? Recommend defer.
- **Pass 3b (B11)**: pick (A), (B), or (C)?
- **B17 timing**: after Pass 4 or after Pass 1? Caption strips are visually load-bearing for editorial themes — could argue earlier.
- **Wire-version bump**: passes 2a, 2b, 2c are additive (no break). Pass 3b option (B) is breaking. Communicate before merging.

---

## Validation gates (every pass must pass)

1. `cd srcjs && npm run check` — 0 errors / 0 warnings
2. `cd srcjs && bun test` — 1231+ pass / 0 fail
3. `Rscript -e 'devtools::test()'` — all green
4. `Rscript -e 'devtools::load_all(); render_visual_tests()` — 60+ visual fixtures green (or intentional diffs reviewed)
5. `cd docs && quarto render index.qmd && quarto render studio.qmd` — both render without errors
6. Eyeball: the specific phase-named manual check (e.g. "open studio, switch to Synthwave, confirm glow")

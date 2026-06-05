# Wire-audit remediation plan

Draft 2026-06-04 after the rgc_v4 audit landed (`wire-audit.md`). Tracks the
end-to-end fix sequence for B1-B18. Sized by coupling, ordered by leverage.

**REVISION 2026-06-04 after three-agent adversarial review** (API / Aesthetic / UX).
The reviewers caught load-bearing errors in the original draft — the most
serious is that the Pass 1a DOM-class names didn't match the actual CSS
selectors in `theme-runtime.css`, which would have shipped Pass 1a as a no-op.
This revision integrates all three reviews, promotes B17 to Pass 1, adds a
Pass 0 (DOM-prework) and a Pass 6 (wire-version bump), splits Pass 2c, and
documents the IA/discoverability constraint that every substrate PR must
ship its surface in the same commit.

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

### Discipline rules added after agent review

6. **Every substrate PR ships its author surface in the same commit** (UX agent). No "add token now, expose later." That pattern produced `theme-runtime.css` as dead code (B13). Concretely: B7 must include `AnchorControls.svelte` 5th row; B8 must include a ThemeControlsStrip toggle; B17 must include an IA placement decision.
7. **R+TS atomic landing for every wire-touching pass** (API agent). Parity tests pin field sets — landing TS without R (or vice versa) breaks parity in the intermediate commit.
8. **CSS selector verification gates Pass 1a.** Before the DOM wrap lands, every selector in `theme-runtime.css` must be proven to match the new DOM (browser console + computed-style check). Pass 0 prework makes this provable.
9. **Atomic decisions are recorded inline.** Every "decision needed" item gets resolved before the relevant pass starts; not after.

---

## Pass 0 — DOM prework (NEW, added after agent review)

Goal: make Pass 1a safe by rewriting fragile selectors and locking the DOM-wrap shape against the actual CSS targets.

**Why this exists**: aesthetic + API agents found that `theme-runtime.css` selects `.tabviz-scope` / `.tv-shell` / `.tv-paper` with `data-shell-*` attributes on the SCOPE. Today tabviz emits `.tabviz-container`. Without reconciliation Pass 1a is a no-op. UX agent found 10 `:global(.tabviz-container > X)` direct-child selectors in `ControlToolbar.svelte` + `AspectLockPill.svelte` that silently break when a wrapper appears.

### 0a. Selector inventory + rewrite

Steps:
1. `grep -rn ":global(.tabviz-container\b" srcjs/src/` and rewrite every direct-child (`>`) selector to either descendant or `.tabviz-paper > X` (anchored under the new wrap). Files known to break: `ControlToolbar.svelte:85-155` (9 selectors), `AspectLockPill.svelte:88`.
2. Run visual regression — these rewrites must be a **no-op** at the current DOM. If anything changes visually, the rewrite is wrong.
3. Land as a refactor commit. Drift gate / svelte-check / bun all green.

### 0b. Naming decision: `.tabviz-container` → `.tabviz-scope`, or nest them?

Two valid options (decision needed before 1a):
- **(A)** Rename `.tabviz-container` → `.tabviz-scope`. Aligns with `theme-runtime.css`. Touches every consumer reading `.tabviz-container` (R `inst/htmlwidgets/tabviz.yaml`, Quarto skins, downstream Shiny CSS).
- **(B)** Keep `.tabviz-container`, add `.tabviz-scope` as either an alias class on the same node OR a new outer wrapper. Backwards-compat for downstream consumers; more DOM.

Recommend (B) with `class="tabviz-container tabviz-scope"` on the existing root (both classes on the same node — no new DOM, no consumer breakage, `theme-runtime.css` selectors work).

### 0c. Containerref + observer audit

Steps:
1. Enumerate every reader of `containerRef` in `TabvizPlot.svelte`: `reportLayoutMeasurements`, `paintLayoutOverlay`, `dispatchLifecycle` (`widget.root`), ResizeObserver, IntersectionObserver, dnd hit-test, `querySelector[data-display-index]`. Per API agent.
2. Decide canonically: does `containerRef` point at the new outer scope (gets shell padding rect) or the inner paper (clean inner content rect)? Layout math depends on this.
3. Document the choice as a comment at `containerRef = …` declaration.
4. Land as comment-only commit if no actual repointing — or as the repointing commit if needed.

Validation: layout-metrics snapshots, browser overlay test, sizing harness all green.

Risk: medium. Pure surface refactor; no semantic change. If visual regression catches a change, the rewrite was wrong, not the DOM.

---

## Pass 1 — Visual ceiling unblock (highest leverage)

Goal: every effects/shell/texture pin in the substrate becomes observable. Synthwave actually glows, Brutalist actually shows its grid texture, the elevation series produces a real raised-paper card.

### 1a. **B14** — shell+paper DOM wrapper + real `theme-runtime.css` import

**The single most important change in the plan.** Per the aesthetic agent: the substrate ships shell/paper/texture/glass tokens, the resolver fills them, but the canonical paint surface is dead-imported. One DOM wrap + one CSS import wires all of it.

**⚠ CORRECTED 2026-06-04 after aesthetic-agent review.** The initial wrap shape used `.tabviz-shell` / `.tabviz-paper`. The actual `theme-runtime.css` selectors gate on `.tabviz-scope` (parent) + `.tv-shell` / `.tv-paper` (children) + `data-*` on the scope. The plan would have shipped zero observable change. Corrected shape below.

Steps:
1. `srcjs/src/svelte/TabvizPlot.svelte` — wrap the existing widget DOM as:
   ```svelte
   <div class="tabviz-scope tv-shell"
        data-shell-mode={inputs?.shell_mode ?? "flush"}
        data-shell-texture={inputs?.shell_texture ?? "none"}
        data-shell-surface={inputs?.shell_surface ?? "opaque"}>
     <!-- shell-strip element for brand-gradient seam (lab `.shell-strip`) -->
     {#if inputs?.effects?.gradient_shell_intensity !== "none"}
       <div class="shell-strip"></div>
     {/if}
     <!-- glow-bearing class for chrome-wide glow (lab `.tv-glow`) -->
     <div class="tv-paper {inputs?.effects?.glow_intensity !== 'none' ? 'tv-glow' : ''}"
          data-paper-texture={inputs?.paper_texture ?? inputs?.shell_texture ?? "none"}>
       <!-- existing widget DOM -->
     </div>
   </div>
   ```
2. Inject `theme-runtime.css` via `<svelte:head>` (`import runtimeCss from "$lib/theme/theme-runtime.css?raw"`).
3. **Verify selector match before declaring victory.** Concretely:
   - `theme-runtime.css:128-141` (texture rules) — selector is `.tabviz-scope[data-shell-texture="grid"] .tv-shell`; **the wrap above satisfies this when `.tabviz-scope` is the parent and `.tv-shell` shares the same node OR is a child.** Audit the rule's structure before committing.
   - `theme-runtime.css:204` (glass blur) — needs `data-shell-surface="glass"` on `.tabviz-scope`.
   - `theme-runtime.css:209` (`.shell-strip`) — needs a child element with class `shell-strip`.
   - `theme-runtime.css:214` (`.tv-glow`) — needs a child element with class `tv-glow`.
4. **Verify resolver emits visible texture color.** Per aesthetic agent: brutalist's `--tv-shell-texture-line` must resolve to a non-transparent color or the grid is invisible. Probe before validating visually.
5. Walk every existing layout dependency: scroll containers, click capture targets, drag handles. Adding a wrapper changes `containerRef` semantics. **Pick one canonical containerRef and audit `measure-row` $effect + `paintLayoutOverlay` + `reportLayoutMeasurements` paths.**
6. Sizing harness regen — `bun test src/export/layout-metrics.test.ts --update-snapshots` (geometry snapshots will move because shell+paper introduces padding).

Validation:
- Visual regression: synthwave's frame glows (gradient seam + glow); brutalist shows grid texture; elevation presets show raised paper shadow.
- Browser repro: open studio, switch to Synthwave — frame glows AND a gradient strip appears between caption and paper. Switch to Brutalist — grid pattern visible AND the table sits in a clean angular shell.
- Confirm B2 (padding runaway) doesn't get worse — the DOM wrap could compound it. Run the local repro fixture before/after.

Risk: medium-high. Widget root DOM is the hottest seam in the codebase. Touches every layout test. **Selector verification is now load-bearing.**

### 1b. **B5** — preset status anchor coverage

Per the cross-preset probe, all 22 presets share identical `STATUS_ANCHOR_FALLBACK` semantics. Brutalist should have its vermilion `*` markers; clinical themes should keep clean semantic palettes; LOTR themes get period-appropriate semantics.

**⚠ CORRECTED 2026-06-04.** Aesthetic agent flagged: pinning status anchors **does not** automatically paint vermilion `**` significance markers in `colPvalue` cells. Today's consumer paths:
- `CellBadge.svelte:62-64` — explicit badge cells with explicit severity
- `CellRing.svelte:65-67` — ring threshold encoding

`**` markers in p-value columns are rendered as plain text by `colText` / `colPvalue` and don't consult the status palette. **B5 alone doesn't close the brutalist screenshot's vermilion.** Need EITHER:
- (a) New `colPvalue` significance-marker convention: when a cell value matches `**` / `***`, paint in `var(--tv-status-negative)`. Add to Pass 1b as a separate sub-task.
- (b) Author-time application: instructions for the user to apply the paint tool with the `negative` token to significant cells.

Recommend (a) — automatic on `colPvalue` rendering. (b) only as a documented workaround.

Steps:
1. In `srcjs/src/lib/theme/theme-presets-inputs.ts`: add `status: { positive, negative, warning, info }` triples to each preset that wants a distinctive semantic palette. Showcase + LOTR first (highest visual differentiation), journals second.
2. R-side: mirror in `R/themes-*.R` so the wire stays parity-equal.
3. **NEW:** Wire `colPvalue` cells to paint significance markers in `var(--tv-status-negative)` when value matches `**` / `***`. Touches `srcjs/src/components/table/CellPvalue.svelte` (or wherever pvalue rendering lives).
4. Re-run `tests/testthat/test-parity-themes.R` (KNOWN_DIVERGENCES = empty must hold).

Validation:
- Visual regression: badges in brutalist render vermilion. **AND p-value `**` markers in brutalist render vermilion.**
- Cross-preset probe: status anchors now distinct across 22 (no more single-value `#16A34A` for all).

Risk: low (data change) + low (one renderer wiring). Parity test catches drift.

### 1c. **B15** — brutalist body font

Two-line change. `R/themes-showcase.R`'s `web_theme_brutalist()` pins `fonts.body = "'Inter', ..."`. Lab uses Space Grotesk. Change to Space Grotesk + add to `web_fonts`.

Validation: brutalist preset renders with display-sans body. Parity test must still pass.

Risk: trivial.

### 1d. **B17 (PROMOTED from Pass 5)** — caption chip + brand-gradient strip primitives

**Promoted to Pass 1 per aesthetic agent review.** Aurora's signature look IS the gradient strip + "TABLE N" boxed chip. Defer this and Aurora paints a milky frosted rectangle without any of its identity. Brutalist's `01-06` also leans on the chip.

This is net-new substrate work but the agent estimates it's small:
- One Svelte component (`<TabvizCaption>` with chip variant + strip variant)
- One cluster in `component-tokens.ts` (`--tv-caption-chip-{bg,fg,border}`, `--tv-caption-strip-{gradient,height}`)
- One input enum: `effects.caption_style ∈ {"none","chip","stripe"}` (mirrors lab's `engine.jsx` caption shape)
- R API mirror

Wire the `.shell-strip` element added in Pass 1a to consume the strip variant; the chip variant places the "TABLE N" label above title.

Validation:
- Aurora preset (once added) renders with gradient strip + chip.
- Brutalist screenshot's chip becomes reachable.

Risk: medium. Net-new component; new manifest entries; new input enum. But scope is contained.

### 1e. **(D7 LOCKED — lands)** Pin `density_factor` on identity-bearing presets

See Pass 1e detailed section below for the steps.

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

**SPLIT after API + aesthetic agent review.** Original draft conflated additive substrate work with breaking-change consumer migration. The two need separate commits. Also, the plan as written missed the `::before` title-bar primitive and continuous-band semantics (header fill connecting to group rows) per aesthetic agent — those are added to 2c-ii below.

Replaces tasks #72/#74's v3-bridge approach. Lab treats these as first-class effects inputs (`engine.jsx:223-224, 555-571`).

#### 2c-i. Add new Tier-1 inputs (additive, no break)

Steps:
1. `srcjs/src/types/theme-inputs.ts` — add `effects.header_style ∈ {"normal","tint","fill"}` and `effects.title_style ∈ {"normal","bar","underline"}`.
2. `srcjs/src/lib/theme/resolve-theme.ts` — add `resolveHeaderVariantComputed` / `resolveTitleVariantComputed` mirroring `engine.jsx:555-571,572-705`. **Including** the continuous-band semantics for `fill` (header bg flows into group rows; tabviz needs to emit a token like `--tv-header-fill-continuous` that group-row selectors can consume).
3. New manifest entries that emit values matching what the v3 bridge produces today (no behavior change yet — Pass 2c-ii migrates consumers).
4. R: mirror inputs (`effects_header_style`, `effects_title_style`) + R `set_effects()` accepts them. **Atomic R+TS commit per discipline rule 7.**
5. UX surface: ThemeControlsStrip's Effects category gets a "Header style" segmented control + "Title style" segmented control. **Same commit per discipline rule 6.**
6. New `::before` title-bar primitive: when `effects.title_style === "bar"`, the title row gets a CSS `::before` accent stripe per `lab.css:278`. Net-new CSS in `theme-runtime.css`; verify it fires after Pass 1a's wrap.

Validation:
- Existing presets emit unchanged `--tv-header-bg/fg/rule` values (no visual regression).
- New `effects.header_style` controls in studio work.
- Title-bar primitive fires when set.

Risk: medium. Additive only; existing field `variants.headerStyle` stays on the wire.

#### 2c-ii. Migrate consumers + retire `variants.headerStyle`

Steps:
1. Audit every consumer of `variants.headerStyle` and `variants.firstColumnStyle`: per API agent, `TabvizPlot.svelte:2708-2709` reads `var(--tv-header-bg/fg)`, `LayoutControl.svelte:232` binds UI, `R/utils-serialize-resolved.R:124` emits the v3 field, `R/classes-theme.R::header_style` slot. Drift gate misses these because CSS fallback chains silently degrade.
2. Migrate each consumer to read `effects.header_style` instead.
3. Drop `variants.headerStyle` and `variants.firstColumnStyle` from wire (`spec/index.ts`) — wire-bump tracked in Pass 6.
4. Delete v3 bridge for `--tv-header-bg/fg/rule` and `--tv-first-col-*` from `theme-css.ts`.
5. Migrate presets to use the new inputs (synthwave underline title; brutalist bar title + fill header; etc.).
6. Re-run `tests/testthat/test-parity-themes.R`. KNOWN_DIVERGENCES = empty must hold.

Validation:
- KNOWN_UNCONSUMED shrinks by ~6-10 entries.
- v3-bridge sentinel count drops.
- All 22 presets visually equivalent or improved.

Risk: HIGH. Breaks wire compat. Coordinated with Pass 6 wire bump.

---

## Pass 3 — Schema cleanup

Goal: reduce manifest debt the API agent flagged ("the schema over-engineered the schema while still being incomplete").

### 3a. **B10** — declarative `modes:{hc,rt}` consumption (LAYER B ONLY)

**SCOPED HONESTLY after API agent review.** Original draft claimed "no HC-behavior code outside `resolveTokenValue`" — that's unreachable. `resolve-theme.ts:248-274` already documents that only Layer B of HC behavior is migratable. Layers A (role-binding +2 grade push), C (HC fidelity tokens with value substitution), D (geometry hcBump) cannot collapse into per-token `modes` declarations because their semantics aren't per-token.

**Honest goal:** migrate Layer B only. Layers A/C/D stay inline with explicit comments documenting why they can't be declarative.

Steps:
1. Audit `resolve-theme.ts:248-274` — confirm Layer B's `applyHcGradePush` and `HC_PUSH` are the only inline-but-migratable logic.
2. Migrate those (and ONLY those) to driven dispatch on `token.modes.hc.{drop,swap}` / `token.modes.rt.{drop,swap}`.
3. Add explicit code comments at Layers A/C/D explaining why they stay inline (per the existing docstring).
4. Verify the existing manifest's `modes` annotations are correct for Layer B tokens (some may need adjustment).

Validation:
- HC mode rendering unchanged on all 22 presets (visual regression).
- Layer B is gone from the inline switch.
- Layers A/C/D inline logic has comments justifying it.

Risk: medium. Resolver core. Visual regression is the safety net.

**Out of scope:** A full HC declarative migration would require rethinking the role-binding cascade (Layer A) and substantial new manifest grammar for value-substitution (Layer C). Not planned in this audit.

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

## Pass 5 — Net-new substrate (revised after agent review)

**Aesthetic agent identified 4 lab visual moves the plan misses entirely.** Adding them here as candidates; B17 was promoted to Pass 1c.

### 5a. **Glass-backdrop blob layer**

`lab.css:151-160` paints a 4-stop radial-gradient blob layer BEHIND the frosted pane that gives glass refraction real structure. Tabviz has no DOM for it, no CSS, no token. **Without it, Aurora and Glass-Light themes render as flat milky rectangles, not aurora.**

Steps:
- Add `<div class="tv-glass-backdrop">` sibling to `.tv-shell` (positioned absolutely behind, blur target)
- Add `--tv-glass-backdrop-blobs` manifest token + resolver path
- Add `effects.glass_backdrop ∈ {"none","aurora","subtle"}` input

Risk: medium. Net-new DOM + CSS + manifest entry.

### 5b. **Diagonal specular sheen on glass**

`lab.css:188-194` paints a `::before` diagonal-sheen on `.glass`. Pure-CSS one-line addition to `theme-runtime.css`. Cheap.

### 5c. **Inset bevel shadow stack on glass**

`lab.css:180-184` paints a 4-layer inset-bevel `box-shadow` on `.glass`. Currently `theme-runtime.css:204` only sets `backdrop-filter`. Without the bevel, glass reads as "blurry rectangle" not "glass pane." CSS-only.

### 5d. **Caption-chip cluster expansion**

B17 promoted to Pass 1c covers the chip + strip primitives. Pass 5d extends them with the variants (lab uses both compact chips and full strips, with optional accent rules between them).

---

**Note (per UX agent):** Pass 5 substrate additions MUST ship surfaces. No "add backdrop blob now, expose later." If we can't budget the studio surface, we don't land the substrate.

---

## Pass 6 — Wire version lock + parity-set bump (NEW, added after API agent review)

Goal: every additive change in Passes 2-3 is reflected in `CURRENT_VERSION` and the parity test field set. Prevents the "supported in practice, undocumented in version contract" anti-pattern.

Steps:
1. **Bump `CURRENT_VERSION`** in `srcjs/src/spec/index.ts` from `"1.2"` to `"1.3"` once Pass 2 lands. Single bump (not per-sub-pass).
2. **Extend parity test field set** in `tests/testthat/test-parity-themes.R` to expect `ink2`, `alias_neutral_to_brand` (or `monochrome`), `effects.header_style`, `effects.title_style`. Tolerance unchanged.
3. **Update `R/wire-version.R`** with the new version + a one-line changelog entry noting the field additions.
4. **Round-trip test**: write a regression test that constructs a theme with all new inputs set, serializes through R → V8 → R, asserts every input round-trips.
5. **Update NEWS.md** (R-side changelog) — per UX agent: downstream Shiny app developers need notice. One paragraph covering: new anchor `ink2`, new boolean (B8), new effects (header/title styles), DOM wrapping change from Pass 0/1a.
6. **Update `srcjs/src/spec/v1.0.json`** if the wire schema doc lives there (verify location).

Validation:
- Parity test passes with new field set.
- Round-trip test passes.
- `R CMD check --as-cran` clean (NEWS.md formatting matters for CRAN).

Risk: low; pure bookkeeping. But high-value — prevents post-merge ambiguity about what V1.3 means.

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

## Locked decisions (2026-06-04)

All 9 decisions answered by user. Locked here for executor reference.

| # | Decision | Locked answer |
|---|---|---|
| **D1** | `.tabviz-container` ↔ `.tabviz-scope` | **Sibling class on same node.** `class="tabviz-container tabviz-scope"` on existing root. Zero new DOM, zero consumer breakage. |
| **D2** | `containerRef` outer or inner | **Inner (`.tv-paper`).** Clean content rect; layout math stays sane. |
| **D3** | Monochrome boolean name | **`monochrome`** (drops rgc parity on the name for discoverability). |
| **D4** | `set_status` override semantics | **Per-slot override (existing) + new `set_status_palette(theme, palette = list(...))` convenience** for atomic clobber. Both verbs available. |
| **D5** | Studio rail | **Move Color to its own tab.** Right rail becomes tabbed (Color / Effects / Typography / ...). More IA work; each tab gets full real estate. |
| **D6** | Status anchor scoping | **Theme-scoped, documented.** Switching themes changes semantic palette (brutalist vermilion vs clinical green is identity-bearing). Document in `?set_status` + ship the significance-marker convention so the user perceives it as identity-driven. |
| **D7** | Pass 1e (`density_factor` on presets) | **Lands.** density_factor is identity-bearing for some presets (per refined `feedback_dont_pre_bake_defaults` memory: "if a knob's value identifies the preset, pin it"). Pin density_factor on the presets where it matters (atelier may want compact-but-not-too-compact; brutalist wants dense). |
| **D8** | Density enum naming | **(A) Document the translation table.** Zero code change. tabviz `comfortable` = lab `cozy` (middle); tabviz `spacious` = lab `comfortable` (relaxed). Document in CLAUDE.md + theme-cascade docs. |
| **D9** | Pass 5 scope | **Land all 4** (5a glass-backdrop + 5b sheen + 5c bevel + 5d caption-chip variants). Aurora becomes truly reproducible. Largest substrate addition in the plan. |

---

## Pass 1e — Pin `density_factor` on identity-bearing presets (NEW per D7)

Per D7: density is part of theme identity for some presets.

Steps:
1. Audit each preset's intent vs the discrete density preset. Cases where `density_factor` would help:
   - `atelier` — compact-but-not-too-compact (currently 18px row; might want 19-20px with density_factor)
   - `brutalist` — wants dense; might want density_factor = 0.85 on top of `compact`
   - `executive` — wants comfortable-but-airy; density_factor = 1.1
2. R-side `web_theme_X()` constructors pin density_factor.
3. TS-side `theme-presets-inputs.ts` mirrors.
4. Cross-preset distinctness probe should show more than 3 distinct row heights after.

Validation:
- Probe shows 5-8 distinct row heights.
- Parity test green.

Risk: low (additive). Visual regression catches anything off.

---

## Validation gates (every pass must pass)

1. `cd srcjs && npm run check` — 0 errors / 0 warnings
2. `cd srcjs && bun test` — 1231+ pass / 0 fail
3. `Rscript -e 'devtools::test()'` — all green
4. `Rscript -e 'devtools::load_all(); render_visual_tests()` — 60+ visual fixtures green (or intentional diffs reviewed)
5. `cd docs && quarto render index.qmd && quarto render studio.qmd` — both render without errors
6. Eyeball: the specific phase-named manual check (e.g. "open studio, switch to Synthwave, confirm glow")

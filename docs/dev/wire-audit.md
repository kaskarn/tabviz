# Wire audit — every theme element, end to end

Opened 2026-06-04 after the v3→v4 cutover landed and several user-visible
bugs (identical theme swatches in studio, group padding runaway, color-
change crash) revealed that "declared in the manifest" ≠ "wired to a
rendered pixel."

The matrix below tracks **every theme element** through its 7-stage pipe.
Each cell is a verifiable claim with a code citation. Bugs get IDs (B1,
B2, …) and stay in the doc until both the fix lands AND the matrix cell
flips to ✓.

## Stages

1. **R user input** — what an R author types (`tests/testthat/test-themes.R` accepts)
2. **R S7 slot** — `R/classes-theme.R` field
3. **R → wire** — `R/themes-api.R::theme_inputs_to_json` emits it
4. **Wire shape** — `srcjs/src/types/theme-inputs.ts` accepts it
5. **TS resolver** — `srcjs/src/lib/theme/resolve-theme.ts` produces real `--tv-*` value (not `<…>` placeholder)
6. **CSS emit** — `srcjs/src/lib/theme/theme-css.ts` adds `--tv-X:` to DOM
7. **Consumer paint** — Svelte/SVG renderer reads & paints with the value

Verdict legend: ✓ verified · ✗ broken (links bug ID) · ? unproven · — N/A

## Known bugs

| ID | Title | Affected rows | Root cause | Status |
|---|---|---|---|---|
| **B1** | Studio theme switcher: all swatches identical pale blue | anchor:* @ stage 7 | Studio's `tabviz()` doesn't set `interaction.enableThemes` → `ThemeSwitcher.lookupTheme()` returns undefined → `themeColors()` falls through to hardcoded `#cbd5e1`/`#94a3b8`/`#ffffff` fallback. Confirmed via probe at `/tmp/probe-swatch.mjs`. | **fixed** — `lookupTheme()` now falls back to `THEME_PRESETS[name]` (the built-in TS registry of full WebThemes with `authoringInputs`). |
| **B2** | Group padding grows huge after any widget change | density / row_kinds @ stage 7 | TBD — needs runtime trace; static analysis hasn't found the loop. Image evidence: huge trailing whitespace below SURPASS-CVOT row. | open |
| **B3** | Studio crashes on color change | anchor:paper / anchor:brand @ stage 5 or 7 | TBD — need stack trace OR repro in audit harness | open |
| ~~B6~~ | ~~"Curves" vocabulary collision~~ | — | **FALSE ALARM** — `srcjs/src/lib/theme/curves.ts:31-42` implements the lab's lightness-curve semantics correctly (file is commented `Per rgc_v4`). Agent confirmed `inputs.curves` is never consumed as a CSS animation easing. The *name* feels animation-coded but the substrate honors it as ramp-shaping. | retracted |
| **B7** | No `ink2` / secondary-ink / rubrication anchor | anchor surface @ stage 1-2 | rgc_v4 has `anchors.ink2` (`engine.jsx:46-47, 316`) used as the accent ramp seed when present (`engine.jsx:322-326`). Tabviz overloads `anchors.accent` for both rubrication AND engagement (hover/selected/highlight), which collides — authors who set accent for editorial emphasis simultaneously tint every interaction state. **High severity** for editorial preset authors. *Fix:* add `anchors.ink2?: OklchTriple`; resolver seeds accent ramp from ink2 when set, leaves `anchors.accent` for engagement. | open |
| **B8** | No `aliasNeutralToBrand` boolean | input surface @ stage 1-2 | rgc_v4 has a single boolean (`engine.jsx:317, 82-89, 687`) that makes the neutral ramp ride the brand hue — gives you Terminal-phosphor monochrome in one toggle. Tabviz requires setting `anchors.paper.H = anchors.ink.H = anchors.brand.H` manually and the chroma shaping `lerp(aliasHue.C * 0.18, ..., 0.62, t)` doesn't kick in. **Monochrome themes are structurally hard to author in tabviz.** *Fix:* add `inputs.alias_neutral_to_brand?: boolean`. | open |
| **B9** | Studio `AnchorControls.svelte` is hex-first; LCH is buried in OklchPicker dialog | studio authoring surface | rgc_v4's `playground.jsx:84-100` shows each anchor as **3 inline sliders** (L, C, H) with hex as a sibling control. Tabviz's `AnchorControls.svelte:29-35` takes hex, converts internally — author never sees L/C/H independently in the strip. The substrate is LCH-native; the surface hides it. *Fix:* mirror `playground.jsx::ColorAnchor` — L/C/H sliders inline, hex demoted to sibling. | open |
| **B10** | Manifest declares `modes: {hc, rt}` per-token but resolver doesn't read them | resolver | Per CLAUDE.md "HC mode behavior migration — `applyHcGradePush` … should migrate to declarative `token.modes.{hc,rt}` on the manifest." The fields exist on `ComponentToken` (`component-tokens.ts`) but resolver dispatches via inline `hcBump` / `HC_PUSH` table. Schema invented complexity that isn't yet load-bearing. *Fix:* migrate inline HC logic to declarative `modes` field consumption, OR delete the field. | open |
| **B11** | `density` enum naming collision with rgc_v4 | input surface | Lab: `compact / cozy / comfortable` (`engine.jsx:151`). Tabviz: `compact / comfortable / spacious` (`theme-inputs.ts:128`). **Tabviz "comfortable" is the middle position; lab "comfortable" is the most relaxed end.** Authors comparing screenshots between substrates will mis-translate. *Fix:* rename or document the translation table; rename risk is high (R API breakage). | open / decision needed |
| **B12** | `effects.header` / `effects.title` are Tier-1 in lab but legacy bridges in tabviz | input/manifest | Lab exposes `effects.header ∈ {normal, tint, fill}` and `effects.title ∈ {normal, bar, underline}` as first-class Tier-1 inputs (`engine.jsx:223-224, 555-571`) that the resolver branches on. Tabviz treats them as `variants.headerStyle` / `variants.firstColumnStyle` that route through the v3 chrome bridge (tasks #72/#74). **The lab is ahead of where the substrate plans to land.** *Fix:* promote to manifest-native; close #72-#74 by doing the real wiring, not the v3-bridge wiring. | open |
| **B13** ★ | `theme-runtime.css` is dead code | shell / texture / glow / elevation | Aesthetic-agent finding. The canonical paint surface for shell+paper+texture+glass+brand-gradient+emphasis-glow is `theme-runtime.css` — but `grep -rn "theme-runtime" srcjs/src/` outside `extract-svg-css.test.ts` + `theme-runtime-css.test.ts` returns zero. **Real runtime never imports it.** The 30+ `--tv-shell-*`, `--tv-paper-*`, `--tv-glass-*`, `--tv-*-texture-*` cssVars in the manifest emit values that no production consumer reads. *Fix: see B14 — same root cause.* | **open / load-bearing** |
| **B14** ★ | No two-layer (shell+paper) DOM | shell_mode / shell_texture | Aesthetic-agent finding. Lab uses `<div class="widget-frame .tex-X"><div class="sci-paper .tex-Y">…</div></div>` so the shell can carry one texture/shadow/border-radius and paper a different one. Tabviz has a single `.tabviz-container`. **No tabviz template emits `.tabviz-shell` / `.tabviz-paper` class names.** Consequence: `synthwave` pins `shell_mode: "float"` and `shell_texture: "grid"` and renders no observable difference. The entire `shell_mode` axis is decorative metadata. *Fix:* per agent's recommended single change — import `theme-runtime.css` for real (`?raw` injection or `<svelte:head>`), wrap the existing widget DOM as `<div class="tabviz-shell" data-shell-mode={…} data-shell-texture={…}><div class="tabviz-paper" data-paper-texture={…}>…existing…</div></div>`. **Closes ~80% of the lab visual gap in one change.** No resolver changes needed. | **open / highest impact** |
| **B15** | `web_theme_brutalist()` uses Inter body font | preset | Aesthetic agent confirmed. Lab brutalist is Space Grotesk; Inter is the opposite. Substrate is fine — `fonts.body` accepts anything. Preset wrong. *Fix:* one-line preset change + add Space Grotesk to `web_fonts`. | preset-only, easy |
| **B16** | Glass material / `backdrop-filter` not wired | input → DOM | `--tv-glass-blur` exists in the manifest but no Svelte selector applies `backdrop-filter`. Aurora-style frosted-glass is unreachable. *Fix:* once B14 lands, `theme-runtime.css:205` does `backdrop-filter: blur(var(--tv-glass-blur, 0))` already — would Just Work. | blocked on B14 |
| **B17** | No caption chip / caption strip primitives | input → DOM | Lab paints a 3px brand-gradient rule between caption and paper, and a "TABLE 2" boxed label chip. Tabviz has no caption-chip role in the manifest; no DOM for a caption strip. *Fix:* net-new substrate work — add a caption cluster to the manifest + a `<TabvizCaption>` Svelte component. Not closeable by B14 alone. | open / scope decision |
| **B18** | Glow only paints on emphasis rows; can't paint frame/chip | consumer | `TabvizPlot.svelte:3074-3077` applies `--tv-glow-*` to `.row-active-emphasis` only. Lab applies it to `.shell-strip` and chips. **Synthwave's `glow_intensity: "neon"` is invisible** on a normal table without emphasis-painted rows. *Fix:* once B14 lands, the agent's recommendation closes this too (the wrapping `.tabviz-shell` would carry the glow via the existing `theme-runtime.css` rules). | blocked on B14 |

---

## Matrix (in progress)

Each element gets a dedicated subsection below. Audit fills bottom-up:
**code review first, then a probe if static read is inconclusive.**

### Element 1: anchor:paper

Drives `--tv-surface-bg` (manifest `tier: "role"`, role `surface` → `ramps.neutral[0]`).

| Stage | Verdict | Citation |
|---|---|---|
| 1. R input | ✓ | `web_theme(anchors_paper = "#FAFAFA")` — `R/themes-api.R::web_theme()` accepts `anchors_paper`; OKLCH triple variants accepted via `anchors_paper_L/C/H` slots |
| 2. R S7 slot | ✓ | `ThemeInputs@anchors_paper_L/C/H` in `R/classes-theme.R` |
| 3. R → wire | ✓ | `theme_inputs_to_json()` emits `anchors.paper = {L, C, H}` — probe @ `/tmp/probe-swatch.mjs` showed `anchors.paper` present with valid LCH numbers |
| 4. Wire shape | ✓ | `srcjs/src/types/theme-inputs.ts:46` — `ThemeAnchors.paper: OklchTriple` required |
| 5. TS resolver | ✓ | `cssVars["--tv-surface-bg"]` = `#F8FBFE` for cochrane (probe output above) |
| 6. CSS emit | ✓ | `_emitV4CssVarsBody` iterates `resolved.cssVars` and emits every non-`<…>` entry |
| 7. Consumer paint | ? | Used by `svelte/TabvizPlot.svelte` + `export/svg-generator.ts` for canvas background. **Studio swatch path is B1**. Main-widget visual: rendered cochrane fixture has light bg — eyeball ✓ but not formally proven. |

---

### Element 2: anchor:ink

Drives `--tv-text` (role `text` → `ramps.neutral[10]`).

| Stage | Verdict | Citation |
|---|---|---|
| 1. R input | ✓ | `set_anchor(theme, "ink", "#101518")` |
| 2. R S7 slot | ✓ | `ThemeInputs@anchors_ink_L/C/H` |
| 3. R → wire | ✓ | Probe: `anchors.ink` present, valid LCH |
| 4. Wire shape | ✓ | `ThemeAnchors.ink: OklchTriple` required |
| 5. TS resolver | ✓ | `cssVars["--tv-text"]` = `#101518` (probe) |
| 6. CSS emit | ✓ | Same iteration path |
| 7. Consumer paint | ? | Body text consumers all read `var(--tv-text)`. Visual fixture shows correct dark ink on light bg. Same caveat as paper. |

---

### Element 3: anchor:brand

Drives ramp `ramps.brand` → 11 grades. Multiple cssVars source from it:
`--tv-header-fill-bg` (grade 7), `--tv-header-fill-fg` (grade 1), bold-mode header rule via `--tv-content-inverse-on-brand`, series slot 0.

| Stage | Verdict | Citation |
|---|---|---|
| 1. R input | ✓ | `web_theme(anchors_brand = "#2563EB")` |
| 2. R S7 slot | ✓ | `ThemeInputs@anchors_brand_L/C/H` |
| 3. R → wire | ✓ | Probe: `anchors.brand = {L: 0.6405, C: 0.1293, H: 231.0822}` for cochrane |
| 4. Wire shape | ✓ | `ThemeAnchors.brand: OklchTriple` required |
| 5. TS resolver | ✓ | Ramp builds; `--tv-header-fill-bg` resolves to actual brand grade |
| 6. CSS emit | ✓ | Same |
| 7. Consumer paint | ? | Same caveat. Visual fixture: cochrane bold-header band has brand-blue fill. **B1 affects studio swatch but not the live chart.** |

---

### Element 4: anchor:accent

Drives `--tv-accent-default`, `--tv-accent-muted`, `--tv-accent-tint-{subtle,medium}`, hover/selected row tints, semantic.fill.

Per [[feedback_accent_layered_emphasis]]: accent should be the engagement layer (hover/highlight/semantic), distinct from brand which is identity.

| Stage | Verdict | Citation |
|---|---|---|
| 1. R input | ✓ | `web_theme(anchors_accent = "#16A34A")` |
| 2. R S7 slot | ✓ | `ThemeInputs@anchors_accent_L/C/H` (optional — defaults to brand) |
| 3. R → wire | ✓ | Probe: `anchors.accent` present for cochrane |
| 4. Wire shape | ✓ | `ThemeAnchors.accent?: OklchTriple` optional |
| 5. TS resolver | ✗ | **PROBE FOUND: `cv["--tv-accent-default"]` = `undefined`** even though `readAccentDefault(cv)` returned `#B6442D` (the right cochrane brand-as-accent). |
| 6. CSS emit | ✗ | If `--tv-accent-default` isn't in `cssVars`, the v4 emit body doesn't emit it. **B4 — manifest declares `--tv-accent-default` but resolver doesn't produce a value.** |
| 7. Consumer paint | ? | `readAccentDefault` has fallback chain — works by accident through other cssVars. Brittle. |

~~**New bug B4 — `--tv-accent-default` declared in manifest but missing from resolved cssVars.**~~ **False alarm.** Probe asked for the wrong key — manifest declares `--tv-accent` (no `-default`). `readAccentDefault()` correctly reads `--tv-accent` despite the legacy name. Manifest coverage probe at `srcjs/scripts/probe-manifest-coverage.mjs` shows **0 undefined entries and 0 unexpected placeholders across all 22 presets**; R round-trip emits cssVars byte-identical to direct-TS path. The v4 resolver itself is sound.

---

## Cross-preset uniformity findings (from probe-manifest-coverage.mjs)

**37 cssVars produce identical values across all 22 presets** — i.e. the preset name changes but the output doesn't. Of those, after filtering expected constants:

- **4 status anchors** (`--tv-status-{positive,negative,warning,info}`) — **B5 — no preset pins status.{positive,negative,warning,info}** so all 22 themes share the same green/red/amber/blue from `STATUS_ANCHOR_FALLBACK`. Cochrane and Synthwave use the same semantic palette. This means 22 "visually-distinct" presets can't actually differentiate semantic colors. **Substrate ✓, presets ✗.**
- **21 v3-bridge sentinels** (`<v3-bridge>`) — expected identical because the v4 emit body skips them and theme-css.ts's tail writes the per-theme values. Not a bug; just noise in the probe.

---

## rgc_v4 lab divergence — confirmed audit (API agent, 2026-06-04)

Full agent report verified against `dev/rgc_v4_unzipped/`. Highlights — see B7-B12 above for the bug-tracked items.

### Wins (where tabviz is ahead of the lab)

1. **Polarity-as-input is more honest than polarity-as-function.** `theme-inputs.ts:68` makes light/dark a serializable wire field; `engine.jsx:42` makes it a destructive transform on the anchors. Tabviz themes round-trip through JSON without losing the author's intent.
2. **`mode` as accessibility axis orthogonal to polarity.** Lab conflates HC/RT with polarity (`engine.jsx:340-341`). Tabviz's separation is the right design for multi-runtime.
3. **R↔TS parity test with `KNOWN_DIVERGENCES = empty`.** The lab is JS-only, so the question doesn't arise. Structural test infrastructure the lab provably can't have.

### Sharp criticism of the manifest layer

> "The manifest didn't over-engineer the schema; the schema over-engineered the schema while still being incomplete."

Three pieces of `component-tokens.ts` are speculative-overhead that the lab proves unnecessary:

- **B10 — `modes: {hc, rt}` per-token declarations exist but resolver doesn't read them.** Inline `applyHcGradePush` + `HC_PUSH` still drive HC behavior.
- **`KNOWN_UNCONSUMED` still has 140 entries.** Lab achieves the same drift-discipline by emitting tokens at the consumer interface, not the substrate.
- **`V3_BRIDGE_NOTE_PREFIX` (added today!) is a workaround the lab doesn't need.** Lab has no v3 tail — `toCssVars` is the only writer.

The manifest itself is justified by tabviz's 5-runtime consumer surface (htmlwidget / V8 SVG / Shiny / studio / Quarto). Lab is browser-only. Don't undo the manifest, but trim the three pieces above.

### Drifts that are fine to keep (per agent)

- **Density naming (B11) — rename risk is high; document the translation table instead.**
- **`float` shell_mode — strictly additive; the lab has 3 enum values, tabviz has 4.** Unused-by-presets is a preset bug, not a substrate bug.
- **Header/first-column legacy bridges (B12) already tracked as #72-#74.** The migration is planned.

---

## rgc_v4 visual ceiling audit — confirmed (aesthetic agent, 2026-06-04)

**The user's claim "shell, texture, glow seem unwired" is structurally confirmed.**

The substrate ships a wide effects vocabulary on the input surface, the resolver emits ~30 `--tv-shell-*` / `--tv-paper-*` / `--tv-*-texture-*` / `--tv-glass-*` / `--tv-shadow-*` cssVars, but the canonical paint surface (`srcjs/src/lib/theme/theme-runtime.css`) is **dead code** — imported by tests only, zero runtime consumers. Verified via `grep -rn "theme-runtime" srcjs/src/`.

### What tabviz can actually paint today

- Shell-wide gradient wash via `--tv-shell-gradient` (`TabvizPlot.svelte:2528`)
- Emphasis-row glow + drop-shadow (`TabvizPlot.svelte:3074-3077`) — only on rows explicitly tagged `emphasis`
- Density + geometry axes (radius / border-width / border-style) → real DOM
- Color cascade through Tier-2 roles → real DOM
- Container border-radius via `--tv-container-border-radius` (line 2524)

### Visual moves declared but unwired

| Token cluster | Sole consumer | Status |
|---|---|---|
| `--tv-shell-{bg,border,shadow,radius,padding}` | `theme-runtime.css:225-237` (dead-imported) | declared-but-unwired |
| `--tv-paper-{bg,border,shadow,radius,padding}` | same | declared-but-unwired |
| `--tv-shell-texture-{line,dot}`, `--tv-paper-texture-{line,dot}` (×4 textures × 2 surfaces) | `theme-runtime.css:127-141` | declared-but-unwired |
| `--tv-shell-text-knockout-bg`, `--tv-paper-text-knockout-bg` | none | declared-but-unwired |
| `--tv-glass-blur`, `--tv-brand-gradient`, `--tv-glow-brand-color` | `theme-runtime.css:205-215` | declared-but-unwired |
| `--tv-shadow-raised-{near,far}`, `--tv-shadow-overlay-{near,far}` | none | declared-but-unwired |

### Visual moves the substrate doesn't even declare

- Two-layer DOM (shell-card around paper-card) — needs structural DOM change, not a token
- `glass-backdrop` blob layer (4-stop radial gradient sitting *behind* a frosted pane)
- Diagonal specular sheen via `::before` on glass
- Caption chip + caption strip primitives (the "TABLE 2" boxed label, the gradient seam between caption and paper) — see B17
- Direct `muted` and `rule` color anchors — see prior section
- `ink-secondary` (rubrication ink) — see B7
- Header style `{normal, tint, fill}` and title style `{normal, bar, underline}` as Tier-1 — see B12

### The smallest fix (per agent)

**One change closes ~80% of the visual gap:**

1. Import `theme-runtime.css` for real (e.g. `import runtimeCss from "./theme-runtime.css?raw";` injected via `<svelte:head>` in `TabvizPlot.svelte`)
2. Wrap the existing widget DOM as:
   ```svelte
   <div class="tabviz-shell"
        data-shell-mode={inputs.shell_mode}
        data-shell-texture={inputs.shell_texture}>
     <div class="tabviz-paper"
          data-paper-texture={…}>
       …existing widget DOM…
     </div>
   </div>
   ```

That single change wires up: all 4 textures, both knockouts, shell+paper bg/border/shadow/radius/padding, glass blur, brand-gradient strip, emphasis glow. **Resolver doesn't change.** All B13/B14/B16/B18 close together.

The remaining 20% (glass-backdrop refraction, caption chip / strip, specular sheen, `muted`/`rule` anchors, `ink-secondary`) is net-new substrate work.

### Preset-vs-substrate reality

- `web_theme_brutalist()`: substrate could ship a real brutalist; preset uses Inter (lab uses Space Grotesk). **B15 — preset bug.**
- `web_theme_synthwave()`: preset reaches well for substrate (pins all 6 effects/shell knobs); substrate doesn't reach for DOM (only 1 of 6 pins observable). Once B14 lands, this preset finally renders as intended.
- All 22: nobody pins status anchors, nobody pins `density_factor`, 4 achromatic themes share `#6F6F6F` accent.

---

### Provisional findings against the WRONG lab (`dev/rgc-design/controls.jsx:190-194`) — kept for reference only:

```jsx
<Section title="Palette" hint="Color cascade: ink → muted, paper → alt-row, accent for emphasis.">
  <Row label="Paper">     <Color value={theme.paper} ... />
  <Row label="Ink">       <Color value={theme.ink} ... />
  <Row label="Muted">     <Color value={theme.muted} ... />
  <Row label="Accent">    <Color value={theme.accent} ... />
  <Row label="Rule">      <Color value={theme.ruleColor} ... />
```

| Concept | rgc_v4 lab | Tabviz V4 | Verdict |
|---|---|---|---|
| Paper anchor | `theme.paper` (hex) | `anchors.paper` (OKLCH triple or hex) | ✓ same intent |
| Ink anchor | `theme.ink` (hex) | `anchors.ink` (OKLCH triple or hex) | ✓ same intent |
| Muted anchor | `theme.muted` (hex, direct input) | **derived** from `ramps.neutral[N]` | ✗ **author cannot tune muted directly** |
| Identity color | `theme.accent` (single concept) | split into `anchors.brand` + `anchors.accent` | drift: tabviz adds a layer |
| Engagement layer | (uses `accent`) | `anchors.accent` | drift: tabviz introduces a separate role |
| Rule color | `theme.ruleColor` (hex, direct input) | **derived** from ramp | ✗ **author cannot tune rule color directly** |
| Paper texture | `theme.paperTexture` (direct enum) | `shell_texture` (input enum, but also drives `shell_mode`) | ✓ same intent, more coupling |
| Rule style/weight | `theme.ruleStyle`, `theme.ruleWeight` (direct) | `borders.major/minor/table.{style,thickness}` (3-way split) | drift: more structure, more friction |
| Color input format | flat hex everywhere | hex OR OKLCH triple | drift: more rope, more curve |

**Substrate verdict:** the lab is **direct** (designer-shaped, CSS-adjacent). Tabviz V4 is **indirect** (substrate-shaped, cascade-derived). Tabviz pushed semantic complexity from the input layer (lab) into the derivation layer (resolver), gaining a clean cascade but **losing two colors authors used to set directly: muted and rule.**

Those two are exactly the pigments that distinguish "soft editorial" (Newsprint, Atelier) from "sharp clinical" (Lancet, JAMA). Likely root cause of why tabviz presets feel more similar than the lab can express — also visible in the cross-preset distinctness probe where `--tv-accent` collapses to identical `#6F6F6F` for jama/swiss/tufte/brutalist (4 achromatic themes that the lab could individuate via muted+rule choices but tabviz can't).

### "Curves" vocabulary collision

**The user's catch.** They thought "curves" meant ramp-shaping (lightness curves, contrast curves) per the lab. In tabviz, `curves.{neutral,brand,accent}` are **CSS easing functions** (e.g. `"ease"`, `"smooth"`) — animation timing. Vocabulary collision with the lab's concept of pigment-cascade curves. **Bug B6 — `curves` semantic collision.** Rename to `animation_curves` or `easings`; reserve `curves` for ramp shaping when/if we add it.

### Cross-preset distinctness (from `probe-preset-distinctness.mjs`)

Substrate-wise, primary cssVars DO differ across the 22 presets:

| cssVar | Distinct values |
|---|---|
| `--tv-surface-bg` | 16 / 22 |
| `--tv-text` | 19 / 22 |
| `--tv-accent` | 19 / 22 |
| `--tv-header-fill-bg` | 20 / 22 |
| `--tv-text-body-family` | 14 / 22 |
| `--tv-spacing-row-height` | **3** / 22 |

But concentration around achromatic themes (jama/swiss/tufte/brutalist share `#6F6F6F`) confirms the muted+rule absence is felt. And **only 3 distinct row heights across 22 presets** means no preset uses `density_factor` to tune density — they all snap to compact/comfortable/spacious.

### Preset-vs-substrate gap

- `web_theme_brutalist()` uses `Inter` body font. **Substrate ✓ (could ship a brutalist mono), preset ✗ (didn't pin one).**
- No preset pins `status.*` anchors — **substrate ✓, preset ✗ across all 22.**
- No preset uses `density_factor` — **substrate ✓, preset ✗.**
- No preset uses `effects.glow / effects.elevation` to lean into a visual target — needs verification (aesthetic agent stalled before reaching this).

---

(Elements 5-20 pending — adding as I audit.)

# Stage 2 design — typography cascade, shell/paper, surface effects, HC fidelity

> **Status:** v0.1 — 2026-06-02. Initial architectural articulation.
> **Builds on:** [`theme-cascade-stage-1-design.md`](theme-cascade-stage-1-design.md) — substrate (manifest, CSS-var wire, override schema, `data-*` variants, resolver capabilities, row-kind cascade).
> **Parent vision:** [`theme-cascade-rework.md`](theme-cascade-rework.md) — §5 Stage 2 scope.

---

## 0. What this document covers

Stage 2 adds typography parity to the color cascade, the shell/paper two-surface model, surface textures with SVG `<pattern>` parity, HC encoding fidelity (real-element glyphs and ring chips), elevation shadows, and graceful-degrade glass/gradient/glow material effects.

The design philosophy is "everything rgc_v4 does, ported to the v4 substrate." The substrate (manifest, wire, variants, modes) is the load-bearing piece; Stage 2 adds new tokens, new roles, new manifest entries, new CSS rules, new SVG generation paths — but no new architectural primitives.

What this doc settles:
- Typography cascade structure (Tier 1 inputs, Tier 2 type roles, Tier 3 type tokens).
- Shell/paper two-surface model and how `data-shell-mode` drives chrome elevation.
- Surface textures (ruled / grid / dotted / grain) with SVG `<pattern>` parity.
- Texture knockouts (background-pad behind text on textured surfaces).
- HC encoding fidelity (caret glyphs as real `<text>` elements, ring chips, bar thickening).
- Elevation shadows via SVG `<filter>` parity.
- Browser-additive effects (glass, brand gradient, glow) and their graceful-degrade SVG fallbacks.

What this doc defers to Stage 3:
- Settings-panel UI for typography editing (font picker with live preview).
- Settings-panel UI for surface effect choices.
- OKLCH picker integration.
- Cascade Inspector.
- Spine UI.

---

## 1. Typography cascade — parallel to color

### 1a. The mirror structure

Typography mirrors the color cascade's three-tier structure exactly:

| Tier | Color | Typography |
|---|---|---|
| **Tier 1 (inputs)** | `brand`, `decorative`, `accent` anchors | `fonts.display`, `fonts.body`, `fonts.mono` (the trio) + `type_base_size`, `type_scale_ratio`, `type_weight_set` |
| **Tier 1 (derived)** | Ramps (11 grades per scale) | Size scale (7 steps generated from base × ratio) |
| **Tier 2 (semantic roles)** | `surface`, `text-muted`, `fill-hover`, `accent-fill`, etc. | `title`, `subtitle`, `heading`, `body`, `numeric`, `label`, `caption`, `footnote`, `cell`, `tick` (the 10 type roles) |
| **Tier 3 (component tokens)** | `--tv-row-base-bg`, `--tv-cell-fg`, etc. | `--tv-text-title-family`, `--tv-text-title-size`, `--tv-text-title-weight`, etc. |

### 1b. Tier 1 typography inputs

Added to `ThemeInputs`:

```typescript
type ThemeInputs = {
  // ... existing
  fonts: {
    display: string;        // CSS font-family stack
    body: string;
    mono: string;
  };
  type_base_size: number;    // px (e.g. 13.5)
  type_scale_ratio: number;  // e.g. 1.2 — multiplier between scale steps
  type_weights: {
    regular: number;         // e.g. 400
    medium: number;          // e.g. 500
    semibold: number;        // e.g. 600
    bold: number;            // e.g. 700
  };
};
```

R modifiers: `set_fonts(theme, display, body, mono)`, `set_type_scale(theme, base, ratio)`, `set_type_weights(theme, regular, medium, semibold, bold)`.

### 1c. Tier 1 derived — the modular size scale

Like color ramps, the size scale is generated at resolve time:

```typescript
function buildSizeScale(base: number, ratio: number): SizeScale {
  const p = (n: number) => round(base * Math.pow(ratio, n), 2);
  return {
    label:    p(-1.2),
    foot:     p(-0.6),
    body:     p(0),
    head:     p(0.6),
    subtitle: p(1.2),
    title:    p(2.1),
    display:  p(3.1),
  };
}
```

7 steps; exponents chosen to match rgc_v4's editorial-quality scale. The size scale is emitted as `--tv-type-scale-{step}` CSS variables for power users; Tier 3 component tokens reference these via Tier 2 roles.

### 1d. Tier 2 — the type roles

Like color roles, type roles compose elemental properties:

```typescript
type TypeRole = {
  family: "display" | "body" | "mono";   // which trio slot
  size: SizeScaleStep;                    // which scale step
  weight: keyof ThemeInputs["type_weights"];  // regular / medium / semibold / bold
  lh: number | null;                      // line-height; null = density-derived
  track: string;                          // letter-spacing CSS value
};

const TYPE_ROLES: Record<TypeRoleName, TypeRole> = {
  title:    { family: "display", size: "title",    weight: "semibold", lh: 1.12, track: "-0.022em" },
  subtitle: { family: "body",    size: "subtitle", weight: "regular",  lh: 1.34, track: "-0.01em" },
  heading:  { family: "body",    size: "head",     weight: "semibold", lh: 1.2,  track: "-0.004em" },
  body:     { family: "body",    size: "body",     weight: "regular",  lh: null, track: "0" },
  numeric:  { family: "mono",    size: "body",     weight: "regular",  lh: null, track: "0" },
  label:    { family: "mono",    size: "label",    weight: "bold",     lh: 1,    track: "0.06em" },
  caption:  { family: "body",    size: "foot",     weight: "regular",  lh: 1.5,  track: "0" },
  // ... cell, tick, footnote
};
```

Defaults mirror rgc_v4's `TYPE_ROLES` table verbatim.

### 1e. Tier 2 → Tier 3 emission

For each type role, the resolver emits five CSS variables:
- `--tv-role-text-{name}-family`
- `--tv-role-text-{name}-size`
- `--tv-role-text-{name}-weight`
- `--tv-role-text-{name}-lh`
- `--tv-role-text-{name}-track`

Plus a `font` shorthand alias for convenience:
- `--tv-role-text-{name}-font` (e.g. `"600 24px/1.12 'EB Garamond', serif"`)

Component tokens then reference these via the existing manifest pattern. `--tv-text-title-family` aliases `--tv-role-text-title-family`; consumers can use either the individual properties or the `font` shorthand.

### 1f. Override surface for typography

Two override paths:
- **Coarse (Tier 1):** `set_fonts(theme, display = "Cinzel, serif")` changes the family for every role that uses the `display` slot. Same v3 ergonomics.
- **Fine (Tier 2 role):** `set_type_role_binding(theme, role = "title", family = "display", size = "title", weight = "semibold")` rebinds an individual role.

The fine-grained override is for power users who want title-specific typography distinct from other display-slot consumers. The friendly `pin_text_role` (parallel to `pin_token_by_name` for color) ships in Stage 2 alongside the rest.

---

## 2. Shell/paper two-surface model

### 2a. The concept

A widget has two nested surfaces:
- **Shell** — the outer chrome (the widget's container, frame, padding around the data).
- **Paper** — the inner data card (the table/plot block proper).

Each can be styled independently. The shell can be transparent (data appears to float on the page); raised (a chromed card under the data); flush (shell and paper read as one surface); or float (shell invisible, paper floats with its own elevation shadow).

### 2b. `data-shell-mode` attribute (reserved in Stage 1)

The scope element carries `data-shell-mode`:
- `flush` — shell and paper share the same fill; no separation.
- `raised` — shell is a card; paper sits on it with a slight elevation.
- `float` — shell is transparent; paper floats with its own shadow on the page.
- `transparent` — shell is transparent; no float shadow (minimal chrome).

The CSS rules under `[data-shell-mode="raised"]` apply the shell's card styling and the paper's inset; `[data-shell-mode="float"]` removes the shell's background and applies the paper's float shadow. Etc.

### 2c. Tier 3 tokens — shell vs paper

The substrate adds shell-specific and paper-specific tokens to the manifest:
- `--tv-shell-bg`, `--tv-shell-border`, `--tv-shell-shadow`, `--tv-shell-radius`, `--tv-shell-padding`
- `--tv-paper-bg`, `--tv-paper-border`, `--tv-paper-shadow`, `--tv-paper-radius`, `--tv-paper-padding`

Each `data-shell-mode` value resolves these tokens differently. The resolver branches in `theme-runtime.css`:

```css
[data-shell-mode="flush"] .tv-shell { background: transparent; box-shadow: none; }
[data-shell-mode="flush"] .tv-paper { background: var(--tv-paper-bg); box-shadow: var(--tv-paper-shadow-frame); }

[data-shell-mode="raised"] .tv-shell { background: var(--tv-shell-bg); box-shadow: var(--tv-shell-shadow-card); }
[data-shell-mode="raised"] .tv-paper { background: var(--tv-paper-bg); box-shadow: var(--tv-paper-shadow-lift); }

[data-shell-mode="float"] .tv-shell { background: transparent; box-shadow: none; }
[data-shell-mode="float"] .tv-paper { background: var(--tv-paper-bg); box-shadow: var(--tv-paper-shadow-frame); }
```

The DOM and SVG output both render `.tv-shell` wrapping `.tv-paper`; the `[data-shell-mode]` selector picks the right styling.

### 2d. Refresh of the gallery presets

The 18 presets pick a `shell_mode` aesthetic each. Most editorial themes default to `flush` or `raised`; modern/synthwave-style themes lean `float`. The 18-preset audit (Stage 1 §28) becomes the 18-preset audit + shell-mode audit at Stage 2.

---

## 3. Surface textures — ruled / grid / dotted / grain

### 3a. The concept

Surface textures are themeable background patterns applied to the shell or paper. Four textures:
- `ruled` — horizontal lines (notebook paper)
- `grid` — orthogonal grid (graph paper)
- `dotted` — dotted grid
- `grain` — pseudo-random noise (subtle paper texture)

### 3b. Browser implementation — CSS backgrounds

```css
.tv-shell[data-shell-texture="ruled"] {
  background-image: repeating-linear-gradient(180deg,
    transparent 0 28px,
    var(--tv-shell-texture-line) 28px 29px);
}
.tv-shell[data-shell-texture="grid"] {
  background-image:
    repeating-linear-gradient(180deg, transparent 0 23px, var(--tv-shell-texture-line) 23px 24px),
    repeating-linear-gradient(90deg,  transparent 0 23px, var(--tv-shell-texture-line) 23px 24px);
}
.tv-shell[data-shell-texture="dotted"] {
  background-image: radial-gradient(var(--tv-shell-texture-dot) 1px, transparent 1.6px);
  background-size: 15px 15px;
}
.tv-shell[data-shell-texture="grain"] {
  background-image: url("data:image/svg+xml,...filter=fractalNoise...");
  background-size: 180px 180px;
}
```

The textures parameterize via two CSS variables emitted by the resolver:
- `--tv-shell-texture-line` — line color (a faint hairline tied to a Tier-2 neutral grade)
- `--tv-shell-texture-dot` — dot color (slightly stronger; tied to a neutral grade)

### 3c. SVG-export — `<pattern>` parity

Textures translate to SVG via `<pattern>` elements emitted at the top of the SVG, referenced by the shell `<g>`:

```xml
<defs>
  <pattern id="tv-pattern-ruled" patternUnits="userSpaceOnUse" width="29" height="29">
    <line x1="0" y1="28" x2="29" y2="28" stroke="var(--tv-shell-texture-line)" stroke-width="1"/>
  </pattern>
</defs>
<g class="tv-shell" data-shell-texture="ruled" fill="url(#tv-pattern-ruled)">
  <!-- ... -->
</g>
```

librsvg supports `<pattern>` since the beginning; the texture system has near-universal compatibility.

### 3d. New `data-shell-texture` attribute

Reserved in Stage 2 (new addition to the `VARIANT_ATTRIBUTES` manifest from Phase 3):
- Values: `none` (default), `ruled`, `grid`, `dotted`, `grain`
- R modifier: `set_shell_texture(theme, "ruled")`

---

## 4. Texture knockouts — background-pad behind text on textured surfaces

### 4a. The problem

When text sits over a `ruled` or `grid` texture, the texture lines pass through the glyphs and reduce legibility. rgc_v4 solves this by applying a `color-mix(in oklch, var(--shell-bg) 78%, transparent)` background pad behind the text, leaving 22% of the texture visible.

### 4b. Browser implementation

```css
[data-shell-texture="ruled"] .tv-shell-text,
[data-shell-texture="grid"] .tv-shell-text,
[data-shell-texture="dotted"] .tv-shell-text {
  background: color-mix(in oklch, var(--tv-shell-bg) 78%, transparent);
  box-decoration-break: clone;
  padding: 1.5px 7px;
  border-radius: 4px;
}
```

(With per-texture margin tuning for ruled/grid/dotted; grain is low-contrast enough that no knockout is needed.)

### 4c. SVG implementation

Since librsvg's `color-mix()` support is version-dependent, the SVG path emits a pre-resolved pad value:

```xml
<rect class="tv-text-knockout"
      x="..." y="..." width="..." height="..."
      fill="var(--tv-shell-text-knockout-bg)"
      rx="4"/>
<text class="tv-shell-text">...</text>
```

The `--tv-shell-text-knockout-bg` is pre-computed by the resolver: it's the shell background at 78% opacity, mixed against the page color, formatted as a hex with alpha. The SVG generator emits one `<rect>` per text-with-knockout pair, behind the corresponding `<text>` element.

---

## 5. HC encoding fidelity — caret glyphs, ring chips, bar thickening

### 5a. The problem

HC mode (Stage 1 §23) drops translucent wash fills. The semantic encoding (which row is highlighted, which chip is positive vs. negative) must survive on non-color channels.

### 5b. Renderer-side fidelity (Stage 2 work)

Three categories of HC-fallback fidelity:

**1. Caret glyph in the arm cell of highlighted rows.**
```html
<!-- Browser DOM under HC -->
<td class="cell-arm">
  <span class="hc-caret" aria-hidden="true">▸</span>
  Compound A, 50 mg
</td>
```

```xml
<!-- SVG under HC -->
<g class="row" data-row-token="emphasis">
  <text class="hc-caret" x="..." y="..." font-weight="bold" fill="var(--tv-row-emphasis-bar)">▸</text>
  <text class="cell-text" x="..." y="...">Compound A, 50 mg</text>
</g>
```

The caret renders **only when** `[data-mode="high-contrast"]` is active. Conditional rendering at the renderer level (not via CSS `::before` — librsvg doesn't support pseudo-elements). The renderer checks `mode === "high-contrast"` and emits the `<span>` / `<text>` accordingly.

**2. Ring chips instead of filled status pills.**

Under standard mode, status pills are filled (`background: var(--tv-status-positive-bg)`). Under HC, the fill drops and an inset ring takes over:

```css
[data-mode="high-contrast"] .status-tag,
[data-mode="high-contrast"] .pval-chip {
  background: transparent;
  box-shadow: inset 0 0 0 1.5px currentColor;
  padding: 1px 8px;
}
```

In SVG, equivalent via `<rect fill="transparent" stroke="currentColor" stroke-width="1.5">` (currentColor resolves to the text color).

**3. Bar thickening on highlighted rows.**

Standard: `box-shadow: inset 3px 0 0 0 var(--tv-row-emphasis-bar)`. HC: `inset 4px 0 0 0 var(--tv-row-emphasis-bar)`. The thicker bar reinforces the highlight encoding once the fill is gone.

### 5c. Where the conditional rendering lives

The renderer checks the current `mode` (passed in via the resolver's output) and emits the appropriate elements:

```typescript
function renderRow(row: Row, mode: Mode): SVGElements {
  const elements = [];
  // ... background rect, cells
  if (row.token === "emphasis" && mode === "high-contrast") {
    elements.push(renderHcCaret(row));   // new conditional emit
  }
  return elements;
}
```

This is straightforward conditional rendering; the small cost is the conditional path needs test coverage for both modes.

---

## 6. Elevation shadows — SVG `<filter>` parity

### 6a. The browser side

Each elevation state (`flat` / `raised` / `overlay`) emits CSS shadow declarations:

```css
[data-shell-mode="raised"] .tv-shell {
  box-shadow:
    0 1px 2px var(--tv-shadow-raised-near),
    0 8px 20px -6px var(--tv-shadow-raised-far);
}
```

The shadow color tokens (`--tv-shadow-raised-near`, `--tv-shadow-raised-far`) come from the resolver, derived from the paper's hue + a black-tint mix. Shadows lean toward paper's hue rather than pure black — matches rgc_v4's elevation philosophy.

### 6b. The SVG side via `<filter>`

```xml
<defs>
  <filter id="tv-shadow-raised" x="-50%" y="-50%" width="200%" height="200%">
    <feGaussianBlur in="SourceAlpha" stdDeviation="6"/>
    <feOffset dx="0" dy="3" result="offsetBlur"/>
    <feFlood flood-color="var(--tv-shadow-raised-far)"/>
    <feComposite in2="offsetBlur" operator="in"/>
    <feMerge>
      <feMergeNode/>
      <feMergeNode in="SourceGraphic"/>
    </feMerge>
  </filter>
</defs>
<g class="tv-shell" filter="url(#tv-shadow-raised)">
  <!-- ... -->
</g>
```

librsvg supports basic `<filter>` primitives reliably (since ~2.40). The Stage 2 substrate adds one `<filter>` definition per elevation × mode combination; the shell/paper references the appropriate one.

---

## 7. Browser-additive effects — glass, gradient, glow

These are aesthetic effects that elevate the browser experience but **degrade gracefully** in SVG export (where they fall back to flat or solid equivalents).

### 7a. Glass material

Browser: `backdrop-filter: blur(...) saturate(...) brightness(...)` on the shell, plus refraction-backdrop blobs behind the pane (rgc_v4 pattern). The glass effect needs a colorful background to refract; the resolver emits a `.tv-glass-backdrop` element with radial gradients.

SVG export: degrades to the underlying solid shell color. The `<style>` block under `[data-shell-surface="glass"]` in `sv-omit-*` markers is stripped at export time.

### 7b. Brand gradient

Browser: a small `<div class="shell-strip">` between the shell and paper acts as a brand gradient strip:

```css
.shell-strip {
  height: 3px;
  background: var(--tv-brand-gradient);
}
```

SVG: emits as a `<linearGradient>` definition + a `<rect>` filled with `url(#tv-brand-gradient)`. Full parity; librsvg supports `<linearGradient>`.

### 7c. Glow

Browser: `box-shadow: 0 0 10px var(--tv-brand-glow-color)` on selected accents.

SVG: emits as an SVG `<filter>` with `feGaussianBlur` for the glow effect; degrades to no-glow if the filter is unavailable. Most rsvg versions handle this fine.

---

## 8. Phase-2 design questions

Same pattern as Stage 1 — each gets a Decisions log entry once resolved.

### Q-S2.1 — Type role default values: inline in TS or in a separate config file?

**RESOLVED 2026-06-02.** Inline TS const in `srcjs/src/lib/theme/type-roles.ts`. Matches the color side pattern. See Decisions log.

### Q-S2.2 — Shell/paper rendering: nested DOM/SVG elements or single element with `data-*`-driven styling?

**RESOLVED 2026-06-02.** Two nested elements (`.tv-shell` wraps `.tv-paper`). Clean separation; each carries its own attributes and styling. Matches rgc_v4 and the user mental model. See Decisions log.

### Q-S2.3 — Surface texture as Tier-1 input or `data-*` variant?

**RESOLVED 2026-06-02.** Tier-1 input `inputs.shell_texture`. Explicit authorial choice; settings-panel exposed; emits `data-shell-texture` on the scope. See Decisions log.

### Q-S2.4 — HC mode caret glyph: which character?

**RESOLVED 2026-06-02.** `▸` (U+25B8 Black Right-Pointing Small Triangle). Per rgc_v4; universal glyph; reliable rendering. See Decisions log.

### Q-S2.5 — Texture knockout for SVG: rect-per-text or pattern-based?

**RESOLVED 2026-06-02.** SVG `<mask>` selectively erasing the texture behind text. More elegant; smaller output for many knockout sites. Requires rsvg version with reliable `<mask>` support (modern versions handle this well; `<mask>` is a more fundamental SVG primitive than CSS `color-mix()`, so the compatibility risk profile is different). See Decisions log.

### Q-S2.6 — Should typography roles also be (ramp, grade)-bindable?

**RESOLVED 2026-06-02.** No. Wholesale role redefinition only — `set_type_role_binding(theme, role, family, size, weight, lh, track)`. Override path matches the input-modifier coarse-grained style. See Decisions log.

### Q-S2.7 — Brand gradient SVG: `<linearGradient>` definition or per-element gradient?

**RESOLVED 2026-06-02.** Single `<linearGradient>` in `<defs>` referenced by id. Standard SVG pattern; matches `<pattern>` and `<filter>` conventions. See Decisions log.

### Q-S2.8 — When does Stage 2 ship — sequenced sprint after Stage 1, or rolling once Stage 1 lands?

**RESOLVED 2026-06-02.** Sequenced sprint after Stage 1 merges. ~2–3 weeks; single coordinated landing. Visual baselines re-shot once per landing; discipline matches Stage 1 model. See Decisions log.

---

## 9. Stage-2 Decisions log

> Populated as Stage-2 questions are resolved.

### 2026-06-02 — Q-S2.1 closed: type role defaults inline in `srcjs/src/lib/theme/type-roles.ts`

**Decision:** the `TYPE_ROLES` const, the default size scale exponents, and the default weight values are defined inline in a TS module at `srcjs/src/lib/theme/type-roles.ts`. **Rationale:** matches the pattern established by the color side (Tier 1 inputs are TS consts; defaults live in code). The schema and the defaults are different artifacts on the JSON side but unified in code; keeping them unified avoids the asymmetric loading pattern. Editorial themes override these per-preset via the existing input modifiers; the inline default is the schema, not a per-theme configuration.

### 2026-06-02 — Q-S2.2 closed: shell/paper renders as two nested elements

**Decision:** the shell renders as `.tv-shell` wrapping `.tv-paper` in both browser DOM and SVG output. Each element carries its own `data-*` attributes; CSS rules under `[data-shell-mode="..."]` apply styling to each independently. **Rationale:** matches rgc_v4's pattern and the user mental model (shell wraps paper). Two-element nesting makes the styling rules read intuitively and supports future Stage-4+ work (animated shell-mode transitions become straightforward). The DOM/SVG size cost (+1 element) is trivial; the reasoning clarity is non-trivial.

### 2026-06-02 — Q-S2.3 closed: surface texture is a Tier-1 input

**Decision:** `inputs.shell_texture: "none" | "ruled" | "grid" | "dotted" | "grain"` is added to `ThemeInputs`. R modifier: `set_shell_texture(theme, "ruled")`. Emits `data-shell-texture` on the scope element. **Rationale:** surface texture is a deliberate aesthetic choice that users set per-theme. Making it an explicit input (vs. derived from another input) preserves authorial control and lets the settings panel expose it as a discrete option. Implicit derivation would couple the texture choice to whatever input drives it; users wanting "grain on a flush shell" would need to set the shell-mode to whatever value implies grain — opaque and surprising.

### 2026-06-02 — Q-S2.4 closed: HC caret glyph is `▸` (U+25B8)

**Decision:** the HC mode highlighted-row arm cell renders a `▸` (U+25B8 Black Right-Pointing Small Triangle) as the encoding marker. **Rationale:** rgc_v4 precedent; universal glyph rendering across font fallbacks; appropriate visual weight (not too heavy, not too light). Alternative options (`►` U+25BA Pointer, `→` U+2192 Arrow) trade off render reliability or semantic clarity for marginal differences in visual weight or feel.

### 2026-06-02 — Q-S2.5 closed: SVG texture knockout via `<mask>`

**Decision:** SVG-side texture knockouts use SVG `<mask>` elements that selectively erase the texture behind text. **Rationale:** more elegant than the per-rect alternative; smaller SVG output when many texture-text intersections exist (multiple cells, headers, captions). The compatibility risk is lower than for CSS `oklch()` / `color-mix()` because `<mask>` is a fundamental SVG primitive — supported reliably in modern librsvg versions. Trade-off accepted: legacy librsvg systems may render incorrectly under textured surfaces; tabviz documents this as a known limitation.

### 2026-06-02 — Q-S2.6 closed: typography roles are wholesale-redefined, not (ramp, grade)-bindable

**Decision:** typography role overrides take the full role definition: `set_type_role_binding(theme, role, family, size, weight, lh, track)`. No hybrid per-property override. **Rationale:** typography roles compose elemental properties (family / size / weight / lh / track) that aren't homogeneous — each is a different kind of value. Family is a slot enum; size is a scale step; weight is from the weight set; lh is a number or null; track is a CSS unit string. A unified (ramp, grade)-style override would require multiple parallel override schemas, complicating the override surface for marginal benefit. Users wanting fine-grained typography use the input modifiers (`set_fonts`, `set_type_scale`); users wanting full redefinition use `set_type_role_binding`.

### 2026-06-02 — Q-S2.7 closed: brand gradient defined as single `<linearGradient>` in `<defs>`

**Decision:** the brand gradient is emitted as one `<linearGradient id="tv-brand-gradient">` in the SVG's `<defs>` block; consumers reference it via `url(#tv-brand-gradient)`. **Rationale:** standard SVG pattern; matches how `<pattern>` (Stage 2 §3) and `<filter>` (Stage 2 §6) are emitted. Reduces SVG size when the gradient has multiple consumers (currently the shell-strip; potentially later the title accent, callout-row bar). DRY by default.

### 2026-06-02 — Q-S2.8 closed: Stage 2 ships as a sequenced sprint after Stage 1 lands

**Decision:** Stage 2 begins after Stage 1's substrate-sprint merge to main; runs as its own ~2–3 week sprint on a `feat/theme-stage-2` branch; lands as a single coordinated PR. **Rationale:** the sprint model worked for Stage 1 (single landing, atomic visual baseline re-shoot, coordinated review). Rolling small PRs to main would trade discipline for perceived agility — but each Stage 2 capability (typography, shell/paper, textures, HC fidelity, surface effects) has cross-cutting visual implications; landing them piecemeal would mean re-shooting visual baselines on every PR and reviewing the cascade-shape impact in fragments. Sequenced sprint keeps the review surface and baseline cost bounded.

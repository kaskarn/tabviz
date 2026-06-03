# Stage 3 design — editor architecture (Spine, Inspector, OKLCH picker, exports)

> **Status:** v1.0 LANDED — 2026-06-03. Editor substrate complete via
> `tabviz_studio()` R gadget per the **studio-mode** philosophy (editor
> lives in an explicit authoring context; embedded widgets ship zero
> editor chrome). Per the 2026-06-03 ideation session with three design-
> critic agents, the original "editor mode opts in via gear on chart"
> framing was rejected in favor of studio-mode. Sections 5 (live docs),
> 6 (delta serialization exports), 7 (schema versioning) and §3d (Spine
> drag-to-rebind) remain as follow-on UI/architecture work.
> **Builds on:** [`theme-cascade-stage-1-design.md`](theme-cascade-stage-1-design.md) — substrate + capabilities. [`theme-cascade-stage-2-design.md`](theme-cascade-stage-2-design.md) — typography + surfaces.
> **Parent vision:** [`theme-cascade-rework.md`](theme-cascade-rework.md) — §5 Stage 3 scope.

---

## 0. What this document covers

Stage 3 is the editor overhaul: the settings-panel redesign, the Cascade Inspector, the Spine UI, the OKLCH picker, hover-wire animation, two-format export with delta serialization, schema-versioned JSON. It assumes the Stage 1 substrate + Stage 2 capabilities have landed.

This is the **largest** stage by surface area but the **lightest** by load-bearing architecture — Stage 1 already locked the data model and APIs the editor consumes. Stage 3's design is mostly about UI composition, interaction patterns, and the conceptual surface for users learning the cascade.

This doc covers **architectural** decisions only (where things live, how they compose, what data they consume). UI-implementation details (specific layouts, animation timings, copy) are deferred to sprint planning. The principle is: settle the bones now; let the implementer iterate on the flesh.

What this doc settles:
- Settings panel architecture (Color · Type · Size · Effects tab decomposition).
- Cascade Inspector architecture (provenance walk, click anywhere → trace).
- Spine UI architecture (draggable role tokens on ramp columns).
- OKLCH picker integration (popover summoned from anchor swatches).
- Hover-wire animation architecture (role hover → consumer highlight).
- Live-themed docs sheets pattern.
- Two-format export (JSON wire + CSS variables) with delta serialization.

---

## 1. Settings panel — tab-organized API

> **SUPERSEDED 2026-06-03 by `tabviz_studio()`.** The original §1 design
> proposed an in-widget settings panel with Color/Type/Size/Effects
> tabs. The 2026-06-03 design-critic ideation session pivoted to
> **studio mode**: editor lives in `tabviz_studio()` (Shiny gadget),
> embedded widgets ship zero editor chrome, and the tab taxonomy is
> reorganized by *decision altitude* — **Identity / Rhythm / Encoding
> / Advanced** — per the Settings critic's "decoder altitude not
> stationery store" framing. See the 2026-06-03 closing entry in
> `theme-cascade-refactor-notes.md` for the locked design.
>
> The original Color/Type/Size/Effects taxonomy below is preserved for
> historical context only; the landed taxonomy and tab content are
> in `srcjs/src/studio/tabs/{Identity,Rhythm,Encoding,Advanced}Tab.svelte`.

### 1a. The four axes (superseded)

The settings panel is reorganized into four tabs matching the system's natural decomposition (per rgc_v4's `Playground`):

- **Color** — anchors (paper, ink, brand, decorative, accent), polarity, mode, curves, status colors.
- **Type** — font trio, base size, scale ratio, weights.
- **Size** — density, radius, border widths, frame pad, paper pad, rules, frame, head-style, title-style, first-col-style.
- **Effects** — surface (solid / glass / textures), elevation, shell-mode, gradient, glow.

Each tab has **common knobs up top** and **Advanced (power user) controls** behind a progressive-disclosure section. Common knobs are the daily-use surface; Advanced is the cascade-deeper customization.

### 1b. Tab composition

Each tab is its own Svelte component:
- `srcjs/src/components/settings/ColorTab.svelte`
- `srcjs/src/components/settings/TypeTab.svelte`
- `srcjs/src/components/settings/SizeTab.svelte`
- `srcjs/src/components/settings/EffectsTab.svelte`

The parent `SettingsPanel.svelte` owns tab selection, applies the selected tab's component, and manages cross-tab state (e.g. "this panel is dirty; show reset").

### 1c. Existing controls refactored

The current v3 settings panel has 8 control files (`ThemeControl.svelte`, `TokensControl.svelte`, `MarksControl.svelte`, `LayoutControl.svelte`, `TextControl.svelte`, `BandingControl.svelte`, `ColorField.svelte`, `swatch-palettes.ts`) plus the row-kind heights control from Stage 1 (`RowKindHeightsControl.svelte`). These get reorganized:

| Control | New home |
|---|---|
| `ThemeControl.svelte` (preset picker, polarity, mode) | ColorTab |
| `TokensControl.svelte` (row tokens) | ColorTab (Advanced) |
| `TextControl.svelte` (typography) | TypeTab |
| `LayoutControl.svelte` | SizeTab |
| `BandingControl.svelte` | SizeTab |
| `MarksControl.svelte` | EffectsTab |
| `ColorField.svelte` | shared utility |
| `RowKindHeightsControl.svelte` | SizeTab |

The reorganization is logical, not load-bearing — the controls themselves are minimally changed. The big addition is the **Spine UI** (under ColorTab's Advanced section) and the **OKLCH picker** (summoned from anchor swatches).

---

## 2. Cascade Inspector

### 2a. The architecture

A docked panel (browser-only) that traces any clicked element through the cascade:

```
Element clicked → Find the closest --tv-* paint reference
  → Look up in COMPONENT_TOKENS manifest
    → Walk source chain (Tier 3 → Tier 2 → Tier 1 → OKLCH)
      → Render trace as a vertical step list
```

The Inspector is **purely consumer-side** — it reads `COMPONENT_TOKENS`, `roleSource` (from the resolver), `ramps`, `anchors`, and renders. No editing happens through it; the Inspector is for *understanding*, not *changing*.

### 2b. Click-targeting

Two click sources:
- **Click any cell/header/element in the widget** → identifies the `--tv-*` variable painting it (via the element's `data-tv-token` attribute — see §2c) → Inspector traces it.
- **Click any swatch in the Spine UI / Color tab / Token sheets** → traces the role or token directly.

### 2c. `data-tv-token` attribute (new)

Every element in the widget that's painted by a specific token gets a `data-tv-token="..."` attribute. E.g.:

```html
<tr data-row-kind="data" data-tv-token="row-base-bg">
  <td data-tv-token="cell-fg">...</td>
</tr>
```

The renderer adds these during element emission. Cost: one attribute per element (small string). Benefit: the Inspector's click-handler immediately knows which token painted what — no DOM-walking required.

### 2d. Trace rendering

The Inspector renders a vertical step list with tier badges (color-coded per rgc_v4's tier coloring):

```
Tier 3: --tv-row-base-bg
  ↓
Tier 2 role: surface
  ↓ (default binding)
Tier 1 ramp: neutral[1]
  ↓
OKLCH: 0.99 0.005 250
```

Each step is clickable to drill further. The pulsing accent outline animation (rgc_v4) lights up the consumer-side element being traced; this is gated behind an "editor learning mode" toggle (not the default; otherwise it's distracting at runtime).

### 2e. Where it lives

- `srcjs/src/components/inspector/CascadeInspector.svelte` — the docked panel.
- `srcjs/src/components/inspector/InspectorStep.svelte` — one trace step.
- `srcjs/src/lib/theme/inspect.ts` — the `inspectToken(token, wire) → InspectionTrace` function (called by both R-side `inspect_token` and the browser Inspector).

The inspection logic is shared with the R-side `inspect_token` helper (Stage 1 §12e); the Inspector is the UI surface on top.

---

## 3. Spine UI

### 3a. The architecture

The Spine renders the three ramps (neutral, brand, accent) as vertical columns, with the 11 grade swatches stacked top-to-bottom. Each role is a draggable token positioned at the grade it currently binds to. Dragging:
- **Up/down** on the same ramp → changes grade.
- **Across ramps** → rebinds which ramp the role draws from.

Both operations commit via `setRoleBinding(wire, role, ramp, grade)` (Stage 1 §9b).

### 3b. Component composition

- `srcjs/src/components/spine/RoleSpine.svelte` — the three-column container with axis labels and the "off-ramp roles" tray.
- `srcjs/src/components/spine/SpineColumn.svelte` — one ramp column (the 11 swatch stack + the role tokens overlaid).
- `srcjs/src/components/spine/RoleToken.svelte` — one draggable role token.
- `srcjs/src/components/spine/OffRampTray.svelte` — read-only display of status + computed roles.

The Spine UI lives under ColorTab's Advanced section (or as a dedicated full-panel mode when the user expands it).

### 3c. Hover-wire animation

When the user hovers a role token in the Spine, the Inspector + widget light up: every element in the widget that the role paints gets the pulsing accent outline. This is the consumer-of-role visualization rgc_v4 showcases.

Mechanism: `RoleToken.svelte`'s hover handler updates a `hoveredRole` store value; `theme-runtime.css` has CSS rules under `[data-hovered-role]` that target the matching elements (lit up via the `data-tv-token` attribute from §2c, looked up against `TOKENS_BY_ROLE`).

### 3d. Drag mechanics

Pointer-based drag (matches rgc_v4):
- Pointerdown on a token captures the pointer.
- Pointermove updates the token's screen position; the underlying ramp/grade is computed from cursor position relative to the three columns.
- Pointerup commits via `setRoleBinding(wire, role, ramp, grade)`.

The pointer-capture pattern is the same as `ColumnDragHandle.svelte` and `RowEdgeHandles.svelte` (Stage 1 §34b).

---

## 4. OKLCH picker

### 4a. The popover

Click an anchor swatch in the ColorTab → an OKLCH picker popover opens. The popover contains:
- A 2D L×C field at the current hue, with out-of-gamut visualization (faint checkerboard).
- A hue rail showing the full hue spectrum at the current L,C.
- A hex input that round-trips OKLCH ↔ hex.
- An eyedropper button (if `window.EyeDropper` is available).
- Preset hex swatches for quick-start.

### 4b. Component composition

- `srcjs/src/components/picker/OklchPicker.svelte` — the popover container.
- `srcjs/src/components/picker/OklchField.svelte` — the 2D L×C canvas with gamut visualization.
- `srcjs/src/components/picker/HueRail.svelte` — the hue slider with live-rendered track.

The picker is a separate component used by the ColorTab; it can also be summoned from the Cascade Inspector (when traced to an anchor).

### 4c. Smart popover placement

Per rgc_v4: prefer placing the popover to the left of the swatch; flip right if no room; clamp to viewport. Implemented via `OklchPicker.svelte`'s mount-time bounding-box computation.

### 4d. Math

The OKLCH ↔ sRGB conversions live in `srcjs/src/lib/oklch.ts` (already exists; extends if needed). The 2D field rendering uses `canvas.getContext("2d")` and `createImageData` to plot per-pixel OKLCH values with gamut detection — same pattern as rgc_v4's `ColorField`.

---

## 5. Live-themed docs sheets

The docs include several "sheets" — themed displays of the cascade's own state. Each sheet is its own Svelte component themed by the same cascade it documents:

- `PrimitivesSheet.svelte` — the three ramps + alpha companions + status anchors.
- `RolesSheet.svelte` — role → primitive grade mapping.
- `ComponentSheet.svelte` — Tier-3 component tokens → role aliases.
- `GeometrySheet.svelte` — radius / border-width / border-style scales.
- `TypeScaleSheet.svelte` — type roles with sample text.
- `EffectsSheet.svelte` — elevation / surface / gradient / glow demos.
- `FallbackTriptych.svelte` — the three-mode side-by-side demo (Stage 1 §29).

Each sheet is clickable: click a swatch / role / token → opens the Cascade Inspector with that target.

These sheets ship as part of the docs site (`docs/cascade/sheets.qmd`) and are also embedded in the dev-tools section of the settings panel (an "Inspect cascade" mode). They are NOT shown by default in user-facing widget mode.

---

## 6. Two-format export with delta serialization

### 6a. Export formats

Users can export their customized theme in two formats:

**JSON (the wire):**
```json
{
  "$schema": "tabviz-theme/v4",
  "inputs": {
    "polarity": "light",
    "mode": "standard",
    "brand": "#005FAE",
    "fonts": { "display": "Cinzel, serif", ... },
    ...
  },
  "roleOverrides": {
    "surface-subtle": { "ramp": "neutral", "grade": 1 }
  }
}
```

The JSON is the full authoring state — re-importable via `import_theme(json_string)` (R) or `importTheme(jsonString)` (JS). It's small (~1–3 KB) and stable.

**CSS (drop-in `:root` block):**
```css
/* tabviz theme — my-theme (standard mode) */
:root {
  /* Tier 1 · primitives */
  --tv-ramp-neutral-1: oklch(0.99 0.005 250);
  ...
  /* Tier 2 · roles */
  --tv-role-surface: var(--tv-ramp-neutral-1);
  ...
  /* Tier 3 · component tokens */
  --tv-row-base-bg: var(--tv-role-surface);
  ...
}
```

The CSS is the drop-in stylesheet — useful for sharing with designers, for hand-tweaking, for use outside tabviz. Includes the full four-layer namespace (anchor / ramp / role / component) with real `var()` references preserved (the architecture is visible in DevTools).

### 6b. Delta serialization for JSON

The JSON export records **only the deltas from the preset base** — fields that differ from the preset's defaults. A user who only changed `brand` gets:

```json
{
  "$schema": "tabviz-theme/v4",
  "base_preset": "lancet",
  "inputs": { "brand": "#3366CC" },
  "roleOverrides": {}
}
```

Three benefits:
- Small payloads (typical export: 500 bytes vs. 3 KB).
- Clean diffs in version control.
- Easy to spot custom theming (the delta reads like a change list).

The full resolved state is reconstructable: `preset_base("lancet") |> apply_deltas(json)`. Tested with parity assertions (the deltas-and-base reconstruction must round-trip identically).

### 6c. Export UI

`srcjs/src/components/export/ExportModal.svelte` — modal with format toggle (JSON / CSS), preview pane, copy / download buttons.

Triggered from a button in the settings panel header. Also accessible via R-side `export_theme(theme, format = "json")` / `export_theme(theme, format = "css")`.

---

## 7. Schema versioning

Every exported wire JSON declares `$schema: "tabviz-theme/v4"`. The import path validates this — wrong schema or missing field rejects with a clear error.

If/when a future Stage adds a Tier-1 input or changes the wire shape, the schema version bumps (`v5`) and the import path handles migration. Stage 3 ships only v4; future migration is deferred until then.

---

## 8. What does NOT ship in Stage 3

Stage 3 is large but not infinite. Defer to later stages or explicit non-scope:

- **AI-assisted theme suggestion.** (Tempting; not the substrate work.)
- **Theme marketplace / sharing service.** (Distribution, not editor.)
- **Per-cell paint override UI.** (Per Stage 1 §9, not in the override schema.)
- **Animated theme transitions.** (Aesthetic flourish; not architectural.)
- **Theme-from-image-extraction.** (Specialty; out of scope.)

---

## 9. Stage-3 design questions

### Q-S3.1 — Inspector dock position: bottom-left fixed (rgc_v4) or floating dockable panel?

**RESOLVED 2026-06-02.** Bottom-left fixed dock per rgc_v4. Always discoverable; doesn't compete with widget content; the Inspector is a learning tool, not a primary workspace. See Decisions log.

### Q-S3.2 — Spine UI accessibility: keyboard nav for the role tokens?

**RESOLVED 2026-06-02.** Full keyboard nav per rgc_v4 pattern. Arrow keys move tokens up/down (grade) and left/right (ramp); Enter inspects. ~1 day of work atop the drag interaction. See Decisions log.

### Q-S3.3 — OKLCH picker presets: hard-coded list or theme-driven?

**RESOLVED 2026-06-02.** Hard-coded universal preset hex list per rgc_v4. Universal starting points; doesn't surprise users when they switch presets. See Decisions log.

### Q-S3.4 — Sheets visibility default: shown in widget mode or only in editor mode?

**RESOLVED 2026-06-02.** Editor / docs mode only. Sheets render in `docs/cascade/sheets.qmd`, in settings panel's "Inspect cascade" mode, and as inline docs widgets. Hidden in user-facing widget mode. See Decisions log.

### Q-S3.5 — Cascade Inspector: drift-tested for completeness?

**RESOLVED 2026-06-02.** Yes — add drift test parallel to `COMPONENT_TOKENS.drift.test.ts`. ~30 lines; asserts every cssVar is traceable. See Decisions log.

### Q-S3.6 — Hover-wire animation: opt-in or opt-out by default?

**RESOLVED 2026-06-02.** Opt-in, off by default. Settings-panel toggle ("Highlight what this token paints") surfaces the feature; distraction-free default. See Decisions log.

### Q-S3.7 — Sprint model for Stage 3?

**RESOLVED 2026-06-02.** Single sequenced sprint; ~4 weeks; lands as one PR. Discipline consistent with Stage 1/2 model. See Decisions log.

---

## 10. Stage-3 Decisions log

> Populated as Stage-3 questions are resolved.

### 2026-06-02 — Q-S3.1 closed: Inspector dock position is bottom-left fixed

**Decision:** the Cascade Inspector renders as a fixed dock at the bottom-left of the widget's containing viewport. Not floating, not user-positionable. **Rationale:** matches rgc_v4 precedent; users learn to look there. The Inspector is a learning/debugging tool, not a primary workspace — a fixed position keeps it discoverable without consuming UI complexity for positioning controls. Float-dock support could come later if a real use case emerges; not justified for the substrate work.

### 2026-06-02 — Q-S3.2 closed: full keyboard navigation for Spine UI role tokens

**Decision:** role tokens in the Spine UI support full keyboard nav — arrow keys move tokens up/down (grade) and left/right (cross-ramp); Enter triggers Cascade Inspector trace. Pointer drag remains the primary input; keyboard is parallel. **Rationale:** the Spine UI is innovative interaction; accessibility matters; rgc_v4 already validates the keyboard pattern works well. ~1 day of work atop the drag interaction; the Spine UI is hidden behind Advanced disclosure but accessibility shouldn't be feature-gated.

### 2026-06-02 — Q-S3.3 closed: OKLCH picker uses a hard-coded universal preset hex list

**Decision:** the picker's quick-start preset swatches are a small fixed hex list per rgc_v4 (`#2A6FDB`, `#1F8A5B`, `#C2410C`, `#7C3AED`, `#0E7490`, `#B91C1C`, `#0F172A`, `#F5F5F4`). Not theme-driven. **Rationale:** universal starting points; predictable; doesn't surprise users when they switch presets. The current theme's actual colors are visible in other UI surfaces (anchor swatches, Spine UI ramps) — the picker is for *selecting new* colors, not for echoing existing ones.

### 2026-06-02 — Q-S3.4 closed: sheets are editor / docs mode only; hidden in widget mode

**Decision:** the live-themed sheets (`PrimitivesSheet`, `RolesSheet`, `ComponentSheet`, `GeometrySheet`, `TypeScaleSheet`, `EffectsSheet`, `FallbackTriptych`) render in `docs/cascade/sheets.qmd`, in the settings panel's "Inspect cascade" mode (an opt-in user-facing surface for learning the cascade), and as inline docs widgets. They are **not** shown in user-facing widget mode. **Rationale:** the widget's primary purpose is presenting data; the theme cascade is meta-information. Inspector + Spine UI + opt-in inspect mode cover the educational surface; embedding sheets under every widget would clutter the visualization and confuse users about what's data vs. what's cascade.

### 2026-06-02 — Q-S3.5 closed: Cascade Inspector has a drift test

**Decision:** add `srcjs/src/components/inspector/inspector.drift.test.ts` parallel to `COMPONENT_TOKENS.drift.test.ts`. The test iterates every entry in `COMPONENT_TOKENS`, calls the Inspector's trace function for each, and asserts the trace renders without error and produces at least one step. **Rationale:** ~30 lines of test code; catches the failure mode where someone adds a new token kind (a `source.tier` variant, a new mode, a new ramp) and forgets to update the Inspector's trace logic. The drift test is the inversion of the Inspector's reactive surface — it forces the Inspector to keep pace with the manifest.

### 2026-06-02 — Q-S3.6 closed: hover-wire animation is opt-in, off by default

**Decision:** the hover-wire animation (Spine UI hover → consumer-of-role elements light up in the widget) is gated behind a settings-panel toggle. Default state: off. **Rationale:** the animation is great for learning the cascade but distracting during routine theme customization. Opt-in default lets daily users work without distraction; learners surface the toggle prominently in Color tab. The docs / Inspect cascade mode can enable the toggle by default since that mode is explicitly for learning.

### 2026-06-02 — Q-S3.7 closed: Stage 3 ships as a single sequenced sprint

**Decision:** Stage 3 begins after Stage 2 merges to main; runs as a single ~4-week sprint on a `feat/theme-stage-3` branch; lands as one coordinated PR. No sub-sprint splitting. **Rationale:** consistent with Stage 1 and Stage 2 sprint discipline. Sub-sprint splitting would trade single-landing atomicity for marginal review-surface reduction; the editor surface is internally coherent (settings panel + Inspector + Spine + picker + export are designed against each other) and benefits from being designed and shipped as one piece. Larger sprint; same discipline; single visual baseline shoot at the end.

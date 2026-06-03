# Theme cascade rework (v4) — vision & staged plan

> **Status:** v0.1 — 2026-06-02. Living document.
> **Framing:** *revolution, not evolution.* v4 is a clean architectural break from v3 — no co-maintenance, no parallel surfaces, no consumer-by-consumer migration.
> **Companion:** [`theme-cascade-refactor-notes.md`](theme-cascade-refactor-notes.md) — running log of rationalization opportunities encountered during planning.
> **Supersedes:** [`theme-rationalization-arc.md`](theme-rationalization-arc.md) — v3 cascade (the starting point we depart from).
> **Inspired by:** `dev/rgc_v4/` — a personal design lab whose token cascade demonstrates the architectural moves catalogued below. *This conversation + rgc_v4 is the canonical source of v4 direction.*

---

## 1. Context

### 1a. Where v3 stands

V3 shipped and is canonical: `srcjs/src/lib/theme/` holds the cascade (`theme-inputs.ts` → `theme-resolve.ts` → `theme-adapter.ts`), wired through `theme-wire.ts` for pins/overrides, with R delegating via V8 in `R/themes-api.R`. APCA contrast invariants are gated by tests; 18 presets live in `theme-presets.ts`; R modifiers (`set_brand`, `set_decorative`, `set_mode`, `set_categorical`) ship.

v3 is the *starting point we depart from*, not a substrate v4 layers on top of. The leaky surfaces v3 retains and that v4 replaces:

- **Consumers reach into a typed resolved theme object** by field path (~13 files read `theme.row.base.bg`, `theme.spacing.cellPaddingX`, etc.). Field-shape changes ripple.
- **Overrides are dotted-path strings** (`"row.fill.bg"`) traversed at runtime by `theme-wire`. No type-check; typos fail silently.
- **Variant selection is JS-side**: header style, rules mode, density, banding, HC, RT are flags read out of the theme object and branched on by renderers / Svelte templates.
- **R↔TS schema sync is manual** — `R/classes-theme.R` mirrors the resolved-theme shape by hand.

### 1b. Parallel work that has shipped (per `handoff.md`, 2026-06-02)

The row-kind agent's geometry sprint closed:
- **Forest scale** — per-context resolver, multi-flex columns arc A–E complete.
- **Region tree** — rows are a flattened tree, foundation for further row-shape features.
- **Details/disclosure rows** + **annotation/notes** — full feature across DOM/R/SVG.
- **Continuous density** (`densityFactor` + `scaleSpacing`) — density is now a continuous Tier 1 lever.
- **Per-row-kind height pin mechanism** — the absolute-px pin (layer 5 of the height cascade) lands; layers 1–4 are *designed* (`docs/dev/sizing-model.md §8 + §8a`) but not yet built.

That handoff hands the per-row-kind **height cascade** (layers 1–4) plus its **affordances** (settings-panel control + drag handle) to this workstream — Stage 1 below.

### 1c. Pre-release status, no users to worry about

The package is pre-release; no published API contracts to preserve, no consumer base whose code we'd break. This removes the constraint that would normally force gradual migration. v4 is built once and replaces v3 in a single coordinated landing. The clean break is the whole point — see §4c and the Decisions log (§9).

---

## 2. Principles imported from rgc_v4

The rgc_v4 lab is a self-contained ~3.6 KLOC React + CSS demonstration of a token cascade. Reading it surfaced these load-bearing principles:

1. **CSS custom properties are the wire format.** The resolved theme is a map of `--var: value` declarations, not a JS object consumers read by path. Renderers reference `var(--tbl-row-alt)`; the cascade emits the variable table; the browser does the indirection. DevTools shows the chain natively.

2. **A central manifest declares every consumer/producer relationship.** rgc_v4's `COMPONENT_TOKENS` is one frozen table: every Tier 3 paint token's Tier 2 role. Inversion is trivial (role → consumers). The Spine UI lights up consumers on hover by reading this; the Cascade Inspector walks it; a drift gate could enforce "every defined role is consumed; every consumed role is defined."

3. **Role bindings are (ramp, grade) pairs, not resolved hex values.** Roles point at ramp indices: `{ramp: "neutral", i: 0}` is "surface"; cross-ramp drag swaps the ramp letter. No path strings, no field-of-fields. The override schema is two fields.

4. **Variants select via `data-*` attributes on a scope element.** The renderer stamps `data-head-style="fill"`, `data-rules="grid"`, `data-mode="high-contrast"` on a container; CSS attribute selectors do the rest. The renderer is the same DOM/SVG for every variant. Combinatorial variants compose freely without JS branching.

5. **Polarity flip is involutive math on anchors.** `paper.L → 1.1 − paper.L` (and ink, brand) gives light↔dark from one input. Re-resolution does the rest. No twin themes.

6. **Modes are runtime resolver transforms.** `high-contrast` pushes border grades by +2/+3 and drops washes; `reduced-transparency` swaps alphas for solids. Three lines in the resolver; no parallel theme tree.

7. **Parallel cascades share one shape.** Color, typography, geometry, effects each have *the same structure*: inputs (Tier 1) → derived primitives (Tier 2) → component bundles (Tier 3). Symmetric.

8. **The authoring API is the system's axis decomposition.** Color · Type · Size · Effects — four tabs, each surfacing common knobs above an Advanced disclosure. The public API surface = the axes themselves.

9. **The system's documentation is its own consumer.** rgc_v4's sheets (PrimitivesSheet, RolesSheet, ComponentSheet, etc.) are themed by the same cascade they document. Live, walkable, clickable. The Cascade Inspector is editor-grade tooling that falls out of the manifest + provenance tags.

---

## 3. Pattern catalog (rgc_v4 → tabviz portability)

Each entry: **name** — what it does — *portability to tabviz (browser + V8/SVG export)* — dependencies.

### Substrate (load-bearing)

| # | Pattern | What | Portability | Depends on |
|---|---|---|---|---|
| S1 | CSS-variable wire | Cascade emits `--var: value` map; consumers reference via `var()` | **Browser: native.** **SVG export: embed `<style>` block in SVG root; librsvg supports CSS variables since ~2.50.** Geometry must still be JS-side (no CSS box model in SVG). | — |
| S2 | `COMPONENT_TOKENS` manifest | One frozen table: every Tier 3 paint token → Tier 2 role + consumer file | **Pure metadata.** Cross-environment trivially. Drift gate: every defined role consumed; every read role defined. | — |
| S3 | Role-binding as `{ramp, i}` pair | Overrides are 2-field records, not path strings | **Cross-environment.** Replaces `theme-wire.ts` dotted-path traversal. Cross-ramp rebinding becomes data-uniform. | S2 |
| S4 | `data-*` attribute variants on scope | Renderer stamps DOM attributes; CSS selectors drive paint | **Browser: native.** **SVG export: embedded `<style>` with attribute selectors works in librsvg.** Paint-only variants translate cleanly; geometry variants (which `<line>` elements to emit) stay JS-side. | S1 |

### Color-system extensions

| # | Pattern | What | Portability | Notes |
|---|---|---|---|---|
| C1 | Polarity = L-reflection | `paper.L → 1.1 − paper.L` on every anchor; light↔dark from one input | **Pure math, cross-environment.** Drops twin-theme bookkeeping. | Today, V3 has `mode: "light" | "dark"` driving ramp direction — refactor to anchor reflection. |
| C2 | Modes-as-resolver-transforms | HC pushes border grades; RT swaps alphas for solids | **Pure math.** | Today, tabviz doesn't have HC or RT modes; would be greenfield additions. |
| C3 | Alpha companion ramps | Every ramp has alpha-progression sibling for washes | **Pure math, cross-environment.** | Solves translucent-wash class of problems with one field (`alpha: true` on a role). |
| C4 | Curve-per-ramp (linear/ease/log/exp) | Easings reshape grade lightness spacing | **Pure math.** | Small Tier 1 lever with big aesthetic effect; useful for editorial themes. |
| C5 | Status ramps independent of brand | Pos/neg/warn/info are their own anchors with fill/solid/text | Already in V3. | Worth verifying full coverage and exposing in the manifest. |
| C6 | "Off-ramp" roles distinction | Status + computed roles (`text-onsolid`) live in a separate tray, not grade-bound | **Data-model distinction.** Removes overloading temptation; the editor UI surfaces it explicitly. |

### Typography cascade (parallel to color)

| # | Pattern | What | Portability | Notes |
|---|---|---|---|---|
| T1 | Font trio (display·body·mono) | Three family slots compose into type roles | Cross-env. V3 has fonts as inputs but no role composition. |
| T2 | Modular type scale | One base size × ratio → ladder (label/foot/body/head/subtitle/title/display) | **Pure math.** Cross-env. |
| T3 | Type roles compose family slot + size step + weight + leading + tracking | Symmetric with color roles | **Cross-env via emitted `font` shorthand vars.** |

### Geometry & surfaces

| # | Pattern | What | Portability | Notes |
|---|---|---|---|---|
| G1 | Radius / border-width / border-style as scale tokens | `sm/md/lg/pill` derived from one knob | Already exists in V3; verify exposure. |
| G2 | Density preset (compact/cozy/comfortable) | Spacing × type-size bundle | V3 has this — just expose as Tier 1 input rather than mode flag. |
| G3 | Shell vs paper as separate nested surfaces | Frame chrome and data paper independently styleable; `shellMode = transparent | flush | raised | float` | **Browser: full.** **SVG export: clean — emit two grouped `<g>`s with their own fills/strokes.** |
| G4 | Rules mode (`horizontal | vertical | grid | none`) | Interior divider geometry | **Geometry-side; JS decides which `<line>`s to emit.** `data-rules` on the scope is documentary, not load-bearing for CSS export. |
| G5 | Frame on/off toggle | Outer container border presence | Same — JS-side geometry. |

### Effects (browser-only or graceful-degrade)

| # | Pattern | What | Portability | Notes |
|---|---|---|---|---|
| E1 | Surface textures (ruled/grid/dotted/grain) | Background patterns themeable via `--tex-line`/`--tex-dot` | **Browser: CSS backgrounds.** **SVG export: emit `<pattern>` elements; rsvg supports them.** Worth doing both. |
| E2 | Texture knockouts for text | `color-mix(in oklch, var(--shell-bg) 78%, transparent)` background-pad behind glyphs over textures | **Browser only.** rsvg `color-mix` support is recent/partial. SVG fallback: emit a `<rect>` pad behind text manually. |
| E3 | Glass material (decomposed tokens) | `tint/blur/sheen/edgeHi/edgeLo/faint/shadow` as named vars | **Browser only.** SVG export degrades to flat (`solid` surface). Additive, never load-bearing. |
| E4 | Refraction backdrop | Radial-gradient blobs behind glass | **Browser only.** Degrades to flat. |
| E5 | Brand gradient + glow | `linear-gradient` + `box-shadow` color glow | **Browser-only for full effect; SVG can do gradient via `<linearGradient>`.** |
| E6 | Elevation (flat/raised/overlay) shadow modes | Per-mode shadow tuple | **Browser: full.** **SVG: SVG `<filter>` with `feGaussianBlur`+`feOffset`.** Worth doing both. |

### Header / title / row presentation

| # | Pattern | What | Portability | Notes |
|---|---|---|---|---|
| P1 | Header style (`normal | tint | fill`) via `[data-head-style]` | Three presentations, one DOM | **Cross-env via attribute selectors.** |
| P2 | Title style (`normal | bar | underline`) via `[data-title-style]` | Accent bar or rule via `::before` / border | **Browser: full.** **SVG: emit the accent bar as a `<rect>` element; can't use `::before`.** |
| P3 | Floating row controls | Checkbox + action absolutely positioned outside data block, opacity 0 → 1 on hover/focus | **Browser-only.** Interaction affordances don't exist in static export. |
| P4 | Highlight encoding survives modes | Standard: brand wash · RT: opaque tint · HC: drop fill + caret glyph + thicker bar | **Mixed.** Paint-state drops are CSS-translatable. HC caret needs to be emitted as a real `<text>` element by the renderer (no `::before` in SVG). |
| P5 | Self-effacing toolbar | Toolbar `max-height: 0; opacity: 0` until widget hover or panel open | **Browser-only**, interactive. |

### Editor / authoring

| # | Pattern | What | Portability | Notes |
|---|---|---|---|---|
| A1 | Tab-organized API (Color · Type · Size · Effects) | Axis decomposition = editing structure | Editor-only. Influences the settings panel design. |
| A2 | Advanced progressive disclosure | One-click reveal of power-user knobs per tab | Editor-only. |
| A3 | OKLCH 2D L×C field picker | Canvas-rendered field with out-of-gamut checkerboard | Editor-only. Honest perceptual editing. |
| A4 | Hue rail with live-themed track | Slider track gradient at current L,C — user sees what each hue would give | Editor-only. |
| A5 | Dual-modality color editing | Inline L/C/H sliders + click-swatch → picker; both edit same anchor | Editor-only. |
| A6 | EyeDropper API integration | Feature-detected; falls back gracefully | Editor-only. |
| A7 | Native font preview in `<select>` | Each option styled with its own font face | Editor-only. Trivial CSS, big UX. |
| A8 | Spine UI | Roles as draggable pins on ramp columns; drag along = grade, drag across = ramp | Editor-only. Falls out of S2 + S3. |
| A9 | Cascade Inspector | Walks Tier 3 → Tier 2 → Tier 1 → OKLCH for any clicked element | Editor-only. Falls out of S2 + resolver provenance tags. |
| A10 | Hover-wire animation | Hover a role in Spine → table cells it paints get a pulsing accent outline | Editor-only. Falls out of S2 inverted. |
| A11 | Fallback Triptych | Three mini tables side-by-side, one per mode, proving HC/RT encoding survives | Editor + docs. Falls out of C2. |
| A12 | Delta serialization for theme overrides | Export only records overrides differing from preset | Cross-env (JSON + CSS). |
| A13 | Two-format theme export | JSON (state) + CSS (drop-in `:root` block) with comments | Editor-only. |
| A14 | Schema versioning on theme JSON | `$schema: 'tabviz-theme/v4'` | Cross-env. Forward-compat. |
| A15 | Dirty-state surfacing + reset | "Reset bindings" button shown only when overrides non-empty | Editor-only. |
| A16 | Live-themed documentation sheets | Token sheets are rendered by the cascade they document | Editor + docs site. |
| A17 | Tier color-coding in inspector | T3=violet, T2=cyan, T1=green, anchor=amber — visual mnemonic | Editor-only. |

---

## 4. Architectural target

### 4a. The substrate (the load-bearing rework)

Four moves, in this conceptual order (sequencing TBD in §5):

**Move 1 — Manifest (S2).** Lift the consumer/producer relationship into a single declarative table — `srcjs/src/lib/theme/consumers.ts` (or similar). For each Tier 3 paint token: producer (Tier 2 role) and consumer files. A drift test enforces completeness. This *is* the centralization-of-consumers conversation, done principally. Standalone: this can land without touching the renderer.

**Move 2 — CSS-variable wire (S1).** The cascade gains a `toCssVars(theme): Record<string, string>` emitter (V3 already has a CSS emit path; reorient it to be the *primary* wire). Renderer consumers refactor to read via `var()` in CSS — driven by Move 1's manifest, one consumer at a time. The resolved JS theme stays for V8/SVG export (which materializes values), but the *primary* path is CSS variables. **WYSIWYG via embedded `<style>` block** in the exported SVG; same selectors work in both environments.

**Move 3 — `(ramp, grade)` role bindings (S3).** Refactor the override schema in `theme-wire.ts` from dotted-path strings to `{role, ramp, grade}` records. Cross-ramp rebinding becomes data-uniform. Removes the runtime dotted-path traversal.

**Move 4 — `data-*` variant attributes (S4).** Renderer scope element gains `data-head-style`, `data-rules`, `data-mode`, `data-row-kind`, `data-banding`, `data-frame`, etc. CSS attribute selectors take over from JS-side branching for **paint** variants. Geometry variants (which lines to emit, where to position rows) stay JS-side; the attribute is documentary.

After these four moves, the renderer is *almost entirely declarative*: JS emits a manifest-driven CSS-variable map, stamps four-to-six attributes, and writes the SVG geometry. CSS does the rest. The exported SVG is self-contained and identical-by-design to the browser-rendered DOM.

### 4b. Additive extensions (post-substrate)

Each unlocks once the substrate lands; can be ordered freely:

- **Polarity flip** (C1) — replace `mode: "light"/"dark"` with L-reflection.
- **HC + RT modes** (C2) — resolver-level transforms.
- **Alpha companion ramps** (C3) — for translucent washes.
- **Type cascade parallel to color** (T1–T3) — `font` shorthand vars, role composition.
- **Shell/paper two-surface model** (G3) — independently styleable chrome and data card.
- **Header / title / rules / frame variants** (P1, P2, G4, G5) — `data-*` driven.
- **Surface textures + glass + gradient + glow** (E1–E6) — additive, graceful degradation in SVG.
- **HC encoding fidelity** (P4) — caret glyphs as real elements; bar thickening; ring-not-fill chip variants.
- **Cascade Inspector** (A9) — falls out of manifest + provenance.
- **Spine UI** (A8) — falls out of manifest + `(ramp, grade)` bindings.
- **OKLCH picker + Advanced disclosure** (A2, A3, A4, A5) — settings panel redesign.
- **Fallback Triptych** (A11) — docs + editor learning aid.
- **Delta + two-format export** (A12, A13) — theme portability.

### 4c. Strategy: long-sprint clean break (no v3+v4 co-maintenance)

The lesson from V1 → V2 → V3 is that **co-maintenance is expensive**. V3's parallel-track migration ran for weeks, doubled the mental load while it was live, required a separate "consumer cutover" sprint after the foundation shipped, and only finished cleanly when the V2 dead code was finally deleted (per `theme-rationalization-arc.md`, "Why this scoping"). The pre-release status is what makes this revolution possible — there are no published API contracts to preserve, no users whose code we'd break, no compatibility shims worth carrying.

v4 takes the opposite approach:

- **No parallel v3 + v4 surfaces.** When v4 lands, v3 is gone — files renamed, types replaced, dead code deleted, R-side mirror slimmed, R modifier API updated, visual baselines re-shot, parity tests rewritten.
- **One long-lived feat branch** (`feat/theme-rework`) regularly synced from main. The internal commit rhythm mirrors the substrate moves (manifest → CSS-var wire → role bindings → data-* variants) for sprint hygiene, but the merge to main is one coordinated landing of the whole substrate.
- **Visual baselines re-shot once**, at the end. No per-PR baseline churn.
- **No consumer-by-consumer migration to main.** Consumers migrate to v4 *inside the branch*; main never sees a half-migrated state.

The cost is calendar time on the branch — multi-week. The benefit is one well-formed result instead of months of "mostly v3 with some v4" rendering bugs. The math works because we have no users.

---

## 5. Stages (sequencing)

Each stage is a **self-contained sprint** that lands to main as one coordinated merge. Within a sprint, internal commit rhythm follows the substrate moves for hygiene; landings are atomic.

### Hard constraints

1. **WYSIWYG SVG export preserved at every landing.** Browser DOM and exported SVG read the same CSS variables, the same `data-*` attributes, the same `<style>` block embedded in the SVG root.
2. **No co-maintenance of v3 + v4 surfaces.** When the substrate sprint lands, v3 is replaced wholesale — files renamed, types replaced, dead code deleted (§4c).
3. **No half-merged states between stages.** Each sprint's branch syncs from main, lands as one merge, then the next sprint's branch starts.

### Stage 0 — Handoff phase (COMPLETE 2026-06-02)

- Row-kind sprint shipped to main (see §1b).
- Vision articulated (this document).
- Refactor-notes log opened ([`theme-cascade-refactor-notes.md`](theme-cascade-refactor-notes.md)).
- Clean-break strategy committed (§4c + Decisions log).
- Row-kind height cascade (layers 1–4 + dual affordance) folded into Stage 1 substrate sprint (Decisions log 2026-06-02).

### Stage 1 — Substrate revolution (LONG, single coordinated landing)

**Scope.** The revolution. Four substrate moves + row-kind height cascade + full color-system capability surface (polarity flip, modes, alpha companions, curves) all land together. v3 is fully replaced; no parallel surfaces remain. **The resolver is rewritten once with its complete v4 capability set present from the start.** This is the load-bearing sprint of the whole arc.

**The substrate moves (delivered together):**
- M1 — `COMPONENT_TOKENS`-style manifest with drift gate.
- M2 — CSS-variable wire as the consumer interface (replaces JS-object field reads).
- M3 — `{role, ramp, grade}` override schema (replaces dotted-path strings).
- M4 — `data-*` variant attributes on scope (replaces JS-side branching for paint variants).

**Folded-in row-kind height cascade (per Decisions log 2026-06-02 — Q10 closed):**
- Layer 1 — intrinsic kind ratios (constant table; `data 1.0`, `group-header 1.0`, `summary 1.0`, `section-header 1.0`, `spacer 0.5`).
- Layer 2 — inheritance graph (constant table; `summary → data`, `section-header → group-header`).
- Layer 3 — theme-level default via `row_kinds.<kind>.heightRatio` on `ThemeInputs` (structured per-kind shape, forward-compatible with future per-kind paint fields).
- Layer 4 — constructor override (ratios, cascade-consistent).
- Settings-panel per-kind height control with "reset to default" — built against the new override API from the start.
- Drag handle on row's bottom edge with absolutely-positioned overlay layer (rows have no wrapper; mirror `ColumnHeaders.svelte::startResize` pattern), pointer-capture, browser harness.
- R modifier API mirroring the new theme input + override.
- Tests: per-kind base, content-grows-above, density-independence, inheritance walk, drag commit, R↔TS parity round-trip.

**Folded-in color-system capabilities (per Decisions log 2026-06-02 — Q11 closed):**
- C1 — Polarity flip via anchor L-reflection (`paper.L → 1.1 − paper.L` etc.) replaces `mode: "light" | "dark"` in the input vocabulary. **18-preset audit** confirms each dark preset reflects cleanly from its light sibling or gets re-anchored.
- C2 — HC mode + RT mode as resolver-level transforms (HC pushes border grades, drops washes; RT swaps alphas for solids).
- C3 — Alpha companion ramps (every ramp has an alpha-progression sibling for washes).
- C4 — Curves-per-ramp (linear/ease/smooth/log/exp) as Tier 1 inputs reshaping grade lightness spacing.
- C5 — Status anchor coverage verification (pos/neg/warn/info ramps independent of brand).
- C6 — Off-ramp roles distinction in the data model (semantic status + computed roles separate from grade-bound roles).
- A11 — Fallback Triptych ships as a docs/editor artifact proving the encoding survives degradation across standard/RT/HC modes.

**Why fold color capabilities in.** The resolver gets rewritten anyway in Stage 1. Touching it twice (substrate first, then color extensions) costs more than one well-formed rewrite that includes the full v4 resolver capability surface. The polarity-flip preset audit and the input-vocabulary change for `mode` are easier to do once during the substrate move than as a follow-up that re-shapes the input schema.

**Why fold the row-kind height cascade in.** Designing its theme-input shape against today's v3 vocabulary, then re-shaping during the substrate move, is exactly the "ship twice" pattern the clean-break commitment rules out. The cost is the pin layer sitting half-functional on main for the duration of the sprint — accepted.

**Other deliverables in scope.**
- Rewrite of `srcjs/src/lib/theme/` to emit the CSS-var wire (`theme-css.ts` becomes primary; `theme-adapter.ts` rewritten or eliminated).
- All ~13 consumers migrated: no JS field-path theme reads remain.
- `theme-wire.ts` overrides refactored to `{role, ramp, grade}` records.
- Settings panel writes refactored to the new override API. The panel itself is not redesigned here (that's Stage 3); the data plumbing changes, including the new per-kind height control.
- Renderer scope stamps `data-*` attributes; paint-state variant CSS migrated to attribute selectors. Geometry variants (which `<line>`s to emit) stay JS-side; attributes are documentary there.
- SVG export embeds `<style>` block with the same selectors + variable bindings — WYSIWYG verified end-to-end.
- **`RowKind` enum renamed to kebab-case** in this sprint (per Q9 closed): `"data" | "group-header" | "section-header" | "summary" | "spacer" | "panel" | "header"`. Stamp site is identity afterward.
- **R-side `R/classes-theme.R` slimmed maximally** (per Q12 closed): all S7 classes that mirrored resolved-theme shape are deleted; only Tier 1 input classes survive. R serializes inputs to JSON; V8 returns a CSS-var map for SVG export.
- R modifier API extended for new override semantics + per-kind heights + polarity flip + HC/RT modes.
- v3 dead code deleted (no `*-v3` files, no V2-style compat shims).
- `theme-rationalization-arc.md` marked superseded.
- Visual baselines re-shot once at end (browser + SVG).
- Tests + parity tests rewritten for new shape.

**Sprint discipline.**
- Long-lived `feat/theme-rework` branch, regularly synced from main.
- Per-arc internal commits (M1 → M2 → M3 → M4 → row-kind cascade → color capabilities) for sprint hygiene; the merge to main is atomic.
- Visual regression run continuously on the branch; final baseline shoot at end.
- Refactor-notes log items addressed in-sprint where they're now-or-never (e.g. R-side mirror slimming, kebab enum rename, dotted-path-overrides removal).

**Estimated:** multi-week sprint, **significantly larger than originally scoped** — absorbs the row-kind height cascade *and* the color extensions. The 18-preset polarity audit alone is non-trivial. Worth the calendar cost (§4c) for a single well-formed result.

### Stage 2 — Typography & surface extensions sprint

**Scope.** Typography cascade parallel to color (T1–T3), shell/paper two-surface (G3), surface textures with SVG `<pattern>` parity (E1), texture knockouts (E2), elevation shadows (E6). Header/title/rules/frame variants (P1, P2, G4, G5) land as `data-*` selectors. HC encoding fidelity (P4 — caret glyphs, ring chips) lands here. Glass material (E3–E4) and brand gradient/glow (E5) land as browser-additive graceful-degrade.

**Estimated:** 2–3 weeks.

### Stage 3 — Editor overhaul sprint

**Scope.** Settings panel redesign + editor-specific tooling.

- Tab-organized API (A1), Advanced disclosure (A2).
- OKLCH picker popover (A3, A4, A5, A6) with 2D L×C field, hue rail, hex, eyedropper.
- Cascade Inspector (A9).
- Spine UI (A8).
- Hover-wire animation (A10) — gated behind an editor toggle (not runtime distraction).
- Delta + two-format export (A12, A13).
- Live-themed docs sheets (A16).
- Tier color-coding in inspector (A17).
- Font preview in `<select>` (A7).
- Dirty-state surfacing (A15).
- Schema versioning on export JSON (A14).

**Estimated:** multi-week. Could split into "panel" + "tooling" sub-sprints if appetite warrants.

### Sequencing of Stages 2–3

Stage 3 should follow Stage 2 (the editor's Inspector benefits from typography roles being in the cascade; the OKLCH picker shows L×C fields whose perceptual interpretation depends on the type roles surrounding them). Within Stage 3, the OKLCH picker and Spine UI can ship independently if the editor sprint is too big to land as one.

### Stage 4 — Preset reimagining sprint

**Scope.** Ground-up authoring of fresh preset themes against the now-complete v4 substrate + capabilities. The v3 presets (18 themes in `R/themes.R`, `R/themes-design.R`, `R/themes-lotr.R`) were *quarantined* during Stages 1–3 (per Decisions log 2026-06-02 — preset deferral); Stage 4 is the explicit opportunity to reimagine them rather than mechanically port.

**What this means in practice:**
- Each new preset starts from a `ThemeInputs` definition authored from scratch, not from translating v3 anchors.
- Curves (`linear`/`ease`/`smooth`/`log`/`exp`) get per-preset deliberate choices instead of being inherited from v3 defaults.
- Polarity (light/dark) audit happens *here*, not during Stage 1 — each preset is designed with both polarities in mind.
- Shell mode, surface texture, head/title-style, rules — each preset picks an aesthetic deliberately, exercising the Stage 2 capability surface.
- Typography is paired with palette intentionally (editorial themes get serifs; technical themes get monospaces; etc.).
- Old preset names may be retained, dropped, or replaced — no obligation to maintain naming continuity.

**Why this sequencing.** Mechanically porting 18 presets during Stages 1–3 would (a) consume disproportionate sprint calendar, (b) constrain the substrate's design with backward-aesthetic compatibility pressure, (c) miss the opportunity to apply every Stage 1–2 capability deliberately. Doing presets last — when the full substrate + capability surface is stable and visible — means each preset is authored with intention against the final palette of possibilities.

**Estimated:** 2–4 weeks. Depends on ambition (12 new presets minimum to maintain "we ship a gallery"; could be more).

---

## 6. WYSIWYG SVG export — the discipline

This deserves its own section because it constrains every stage.

**The rule:** browser DOM and exported SVG are visually identical — pixel-for-pixel where physics permits. They share:

- The same CSS variable map (emitted by the resolver, identically computed in both environments).
- The same `<style>` block (the SVG carries an inline `<style>` with the same selectors + variable bindings the browser uses).
- The same DOM/SVG node structure (the renderer is one function, parameterized by output medium).
- The same `data-*` attributes for variant selection.

**The graceful-degradation policy:** browser-only effects (`backdrop-filter`, animations, `::before`/`::after` content, `:hover` states) **never** carry semantic meaning. The HC mode's caret glyph is a real `<text>` element, not a `::before`. Glass degrades to its `solid` underlying surface. Transitions are absent in SVG; that's fine — SVG is a snapshot.

**The librsvg envelope:**
- ✅ CSS variables + `var()`
- ✅ Attribute selectors `[data-foo="bar"]`
- ✅ Presentation attributes (fill, stroke, font-*, opacity)
- ✅ `<pattern>`, `<linearGradient>`, `<filter>`
- ⚠️  `color-mix()` — version-dependent; prefer pre-resolution
- ⚠️  `oklch()` — version-dependent; emit hex fallbacks alongside
- ❌ `::before`/`::after` — emit real elements
- ❌ `backdrop-filter`, `:hover`, animations — additive only

**A small constraint, a big payoff:** forcing every paint variant to be expressible as static CSS + attribute selectors guarantees the substrate is uniform across environments. Every "but it works in the browser" temptation becomes a structural test for whether the variant belongs in the wire or in interactive layering.

---

## 7. Deferred / explicitly out of scope

- **rgc_v4's lab chrome** (eyebrow tier badges, the `.lab-*` palette) — these are *editor* surfaces, not consumed-by-widget. Inspiration for settings panel only.
- **Demo-only animations** (the wire-pulse keyframe in rgc_v4) — useful in editor mode, distracting at runtime. Gate behind an editor toggle when adopted.
- **Browser-only effects without SVG fallback** — never load-bearing.
- **Heavy refactor of `R/classes-theme.R`** — wait until the TS substrate has stabilized; R-side mirrors update last.

---

## 8. Open questions

Open for discussion. Each gets a Decisions log entry below once resolved.

1. ~~**Does the CSS-variable wire replace the resolved JS theme entirely, or live alongside it?**~~ **RESOLVED 2026-06-02** by the clean-break strategy (§4c + Decisions log). CSS variables are the *consumer interface*; the resolver may keep an in-memory map internally for its own use and for SVG-export value materialization in librsvg-versions lacking `var()` support, but consumers never read a typed JS theme object by field path.

2. ~~**Naming for the manifest file.**~~ **RESOLVED 2026-06-02.** `srcjs/src/lib/theme/component-tokens.ts` — echoes rgc_v4's vocabulary directly. See Decisions log.

3. ~~**Sequencing of M3 (role bindings) vs M4 (`data-*` variants).**~~ **RESOLVED 2026-06-02** by the clean-break strategy: M1–M4 land together inside Stage 1. Internal commit ordering on the branch (manifest → wire → bindings → variants) is for sprint hygiene only; the merge is atomic.

4. ~~**Polarity flip preset audit.**~~ **RESOLVED 2026-06-02** by Q11 closure (preset audit is in scope for Stage 1). *Action carried forward into Stage 1 planning: enumerate the 18 presets, mark which are L-reflectable from a light sibling vs. needing re-anchoring.*

5. ~~**HC + RT modes — are they priority or deferrable?**~~ **RESOLVED 2026-06-02** by Q11 closure: HC + RT modes land in Stage 1 alongside polarity flip. *Note for Stage 1 scope: this covers only the resolver-level transforms (push border grades, swap alphas). HC encoding fidelity (P4 — caret glyphs as real elements, ring-not-fill chip variants) is a renderer-side concern and stays in Stage 2.*

6. ~~**R-side ergonomics.**~~ **RESOLVED 2026-06-02.** `set_role_binding(role = "row-alt", ramp = "neutral", grade = 1)` — follows the existing R modifier convention (`set_brand`, `set_decorative`, `set_mode`, `set_categorical`). See Decisions log.

7. ~~**Settings panel redesign.**~~ **RESOLVED 2026-06-02.** No interim panel redesign in Stage 1. Stage 1's panel work is purely data-plumbing (override-API writes refactored); the visual redesign (tabs, Advanced disclosure, OKLCH picker, Spine, Inspector) waits for Stage 3. **Accepted cost:** the panel is in an "ugly" state between Stage 1 and Stage 3 — old visual chrome on new data plumbing. Rock n roll. See Decisions log.

8. ~~**Theme JSON export format compatibility.**~~ **RESOLVED 2026-06-02.** v4 schema is `tabviz-theme/v4`; **no migrator from v3**. Pre-release license; any v3 JSON in the wild is regenerated from the new authoring API. See Decisions log.

9. ~~**Kebab vs snake_case reconciliation for `RowKind` enum.**~~ **RESOLVED 2026-06-02.** `RowKind` is renamed to kebab during Stage 1: `"data" | "group-header" | "section-header" | "summary" | "spacer" | "panel" | "header"`. Stamp site is identity afterward. See Decisions log.

10. ~~**Row-kind height cascade input shape.**~~ **RESOLVED 2026-06-02.** Structured `row_kinds.<kind>.heightRatio` on `ThemeInputs`. Forward-compatible with Stage 2 per-kind paint fields (bg, fg, weight, border). See Decisions log.

11. ~~**Substrate sprint scope — does Stage 2 (polarity flip + modes) belong inside Stage 1?**~~ **RESOLVED 2026-06-02.** Stage 1 absorbs polarity flip + HC + RT modes + alpha companions + curves + status + off-ramp distinction + Fallback Triptych. The resolver is rewritten once with its complete v4 capability surface present. Former Stage 2 (Color extensions) dissolved; stages renumbered. See Decisions log.

12. ~~**R-side aggression in Stage 1.**~~ **RESOLVED 2026-06-02.** Full revolution: every S7 class mirroring resolved-theme shape is deleted; only Tier 1 input classes survive. R serializes inputs to JSON; V8 returns a CSS-var map for SVG export. See Decisions log.

---

## 9. Decisions log

> Append-only. Each entry: date, question, decision, rationale.

### 2026-06-02 — Row-kind sprint handoff complete; height-cascade layers 1–4 + affordances owed

Row-kind agent shipped the geometry sprint (region tree, multi-flex, details/disclosure, annotations, continuous density, per-row-kind height **pin**). Layers 1–4 of the height cascade (intrinsic ratios, inheritance, theme default, constructor override) plus both affordances (settings-panel control + drag handle) are *designed* (`docs/dev/sizing-model.md §8 + §8a`) but unbuilt — owed to this workstream. Sequencing of when they ship is decided in a subsequent entry below. Handoff doc: [`handoff.md`](../../handoff.md).

### 2026-06-02 — No co-maintenance of v3 + v4. Long-sprint clean break.

**Decision:** v4 substrate ships as a single coordinated landing replacing v3 wholesale, not as a parallel-track migration. **Rationale:** the V1→V2→V3 history demonstrated that co-maintenance is expensive — months of consumer-cutover work, drift risk, doubled mental load, a separate cleanup PR at the end. Pre-release status removes the user-compatibility constraint that would normally justify gradual migration. Long sprint is cheaper than the equivalent migration spread over many landings. **Implementation:** long-lived `feat/theme-rework` branch, regular sync from main, per-arc internal commits, single merge to main with visual baselines re-shot once. **Framing:** *revolution, not evolution.*

### 2026-06-02 — Q1 closed: CSS-var wire REPLACES the resolved JS theme as the consumer interface

**Decision:** consumers stop reading `theme.x.y.z`; they read `var(--…)` in CSS. The resolver may keep an in-memory data structure internally for its own use and for SVG-export value materialization (in librsvg versions lacking `var()` support), but the consumer surface is CSS variables only. **Rationale:** implication of the clean-break strategy — co-maintaining both surfaces would defeat the purpose. Renderer + SVG export consume one wire; manifest enforces what that wire contains.

### 2026-06-02 — Q3 closed: M1–M4 land together inside Stage 1

**Decision:** the four substrate moves (manifest, CSS-var wire, role bindings, data-* variants) are one atomic landing, not four sequential landings. **Rationale:** they form one coherent architectural shape; the move from JS-object reads to CSS-var reads requires the manifest and the data-* variants to land at the same time to keep WYSIWYG SVG export working. Internal commit rhythm on the branch follows M1 → M2 → M3 → M4 for sprint hygiene only.

### 2026-06-02 — Row-kind height cascade (layers 1–4 + dual affordance) folds into Stage 1

**Decision:** layers 1–4 of the per-row-kind height cascade (intrinsic ratios, inheritance graph, theme-level default, constructor override) plus both affordances (settings-panel control + drag handle) ship inside the substrate sprint, not as a standalone pre-substrate landing. **Rationale:** designing the height-cascade's theme-input shape against today's v3 vocabulary, then re-shaping during the substrate move, is exactly the "ship twice" pattern the clean-break commitment rules out. Folding in means: input shape designed against the final vocabulary from the start; settings-panel control built against the new override API; kebab discriminators applied uniformly. **Accepted cost:** the pin layer (already on main) sits half-functional during the multi-week substrate sprint — you can pin but the "reset to default" target is undefined. **Naming/branch:** per the naming decision (`feat/theme-rework` for the substrate branch), no `v4` suffixes appear anywhere in code surfaces.

### 2026-06-02 — Naming: no "v4" suffix anywhere in the codebase

**Decision:** files stay at canonical paths (`srcjs/src/lib/theme/`, rewritten in place); branch is `feat/theme-rework`; no `*-v4*` files, ever. In code, v3 is the previous system and "the theme cascade" is the system. "v4" exists only as planning vocabulary in this document and conversation. **Rationale:** the V1→V2→V3 history showed that versioned identifiers in code surface produce parallel-system anxiety and cleanup PRs. The lesson is to never have two of anything alive at once — and to never put a version suffix in code that would make the "still alive" state visible. Pre-release status removes the migration window that would normally justify a suffix.

### 2026-06-02 — Q9 closed: `RowKind` enum renamed to kebab-case during Stage 1

**Decision:** rename the `RowKind` type from snake_case to kebab during the Stage 1 substrate sprint: `"data" | "group-header" | "section-header" | "summary" | "spacer" | "panel" | "header"`. Stamp site (`data-row-kind="<kind>"`) is then identity. **Rationale:** the enum names *are* the public vocabulary. Two namings (enum vs. DOM/SVG attribute) is the drift risk warned about in `region-tree.md §8b`. One-time churn across ~50 call sites is small compared to the persistent maintenance cost of a stamp-site mapping layer that future readers must remember exists. Consistent with the "no two namings" discipline.

### 2026-06-02 — Q10 closed: row-kind height cascade input shape is `row_kinds.<kind>.heightRatio` (structured)

**Decision:** layer 3 (theme-level default) exposes via `row_kinds: { data: { heightRatio: number }, summary: { heightRatio: number }, ... }` on `ThemeInputs`. **Rationale:** forward-compatible with Stage 2 (P4 HC encoding fidelity, surface effects) which will want per-kind paint fields (bg, fg, weight, border) and benefits from a structured per-kind home. Avoids the long-term two-shape outcome of a separate flat heights input + structured paint input.

### 2026-06-02 — Q11 closed: polarity flip + modes + color capabilities fold into Stage 1

**Decision:** Stage 1 absorbs polarity flip (anchor L-reflection replacing `mode: "light" | "dark"`), HC + RT modes (resolver transforms), alpha companion ramps, curves-per-ramp, status anchor coverage verification, off-ramp roles distinction, the 18-preset polarity audit, and the Fallback Triptych docs artifact. Former Stage 2 (Color extensions) is dissolved into Stage 1; subsequent stages renumber (Stage 3 → 2 Typography/surface, Stage 4 → 3 Editor). **Rationale:** the resolver gets rewritten anyway in Stage 1; touching it twice (substrate, then color extensions) costs more than one well-formed rewrite that includes the full v4 resolver capability surface. Polarity-flip preset audit and the `mode` input-vocabulary change are easier done once during the substrate move than as a follow-up that re-shapes the input schema. Maximal revolution per §4c. **Accepted cost:** Stage 1 grows substantially (now includes substrate moves + row-kind height cascade + full color-system capabilities); multi-week sprint becomes longer; review burden at landing is larger.

### 2026-06-02 — Q12 closed: full revolution on R-side `R/classes-theme.R`

**Decision:** during Stage 1, delete every S7 class that mirrors resolved-theme shape (`WebTheme`, `Surfaces`, `Content`, `Dividers`, `RowCluster`, etc.); keep only Tier 1 input classes. R serializes inputs to JSON; V8 returns a CSS-var map for SVG export. **Rationale:** pre-release license to make a clean break (§4c). Two parallel resolved-theme representations in R (CSS-var map + S7 wrapper) would be a mild version of the co-maintenance pattern explicitly ruled out. The R-side ergonomics question (Q6) about override modifier surface is settled separately.

### 2026-06-02 — Visual change across widgets is accepted; not minimized

**Decision:** the substrate move WILL produce visual differences across most widgets, presets, examples, and tests. **That is OK.** We do not hang onto legacy v3 aesthetic for the sake of preservation. **The bar for "is this change OK?" is not "matches v3" but "is this a principled, deliberate adaptation of the cascade's capabilities?"** **Rationale:** pre-release status removes the user-compatibility constraint. The substrate work is a deliberate reimagining of the cascade — clinging to v3 visuals would force shadow contortion in the new system to reproduce decisions made under different constraints. Visual regression tooling stays useful (it tells us what changed), but the framing shifts from "did anything change → is it intended" to "what changed → is each change principled." **WYSIWYG (browser ↔ SVG) parity remains a hard constraint** (the two renderers must agree); visual-vs-v3 fidelity does not. Reviewer + author judgment on intentionality replaces strict diff thresholds at the v3-comparison gate. The ΔE_2000 > 2.0 threshold from Stage 1 Q-P6.3 still applies for browser ↔ SVG parity checks; it no longer applies as a v3-comparison gate.

### 2026-06-02 — Preset porting deferred to a new Stage 4 — quarantine v3 presets during Stages 1–3

**Decision:** the 18 v3 presets (in `R/themes.R`, `R/themes-design.R`, `R/themes-lotr.R`) are **quarantined** during the Stages 1–3 sprints. They are not migrated mechanically. Visual regression baselines for the 18 presets are *not* maintained during sprint execution. Instead, Stages 1–3 develop against a **minimal testing set** of 1–2 sprint-internal "dev" themes (`dev-light`, `dev-dark`) authored to exercise the cascade's capability surface without preserving any specific v3 aesthetic. **Stage 4** is then a dedicated sprint to reimagine the gallery from scratch — each preset gets a deliberate authoring pass against the now-complete v4 substrate + capabilities, with curves, shell modes, surface textures, typography pairings, and polarity choices made intentionally. **Rationale:** mechanically porting 18 presets across Stages 1–3 would (a) consume disproportionate sprint calendar, (b) constrain the substrate's design with backward-aesthetic compatibility pressure, (c) miss the opportunity to apply every Stage 1–2 capability deliberately, (d) treat preset authoring as a mechanical task when it's actually a design-quality concern. Doing presets last — when the full substrate + capability surface is stable and visible — means each preset is authored with intention against the final palette of possibilities. The minimal testing set is small enough to keep working across the entire substrate sprint without imposing aesthetic constraints on the resolver/manifest decisions.

### 2026-06-02 — Q2 closed: manifest file is `srcjs/src/lib/theme/component-tokens.ts`

**Decision:** the Tier-3 paint-token manifest lives at `srcjs/src/lib/theme/component-tokens.ts` and exports `COMPONENT_TOKENS`. **Rationale:** echoes rgc_v4's vocabulary directly, which is what we've been thinking in throughout this conversation. The drift gate sits next to it: `component-tokens.drift.test.ts`.

### 2026-06-02 — Q6 closed: R-side override modifier is `set_role_binding(role, ramp, grade)`

**Decision:** the R modifier exposing the new `{role, ramp, grade}` override schema is named `set_role_binding(role, ramp, grade)`. **Rationale:** follows the established R modifier naming convention (`set_brand`, `set_decorative`, `set_mode`, `set_categorical`). The S7-class slimming (Q12) means there's nothing else to "set" against — `set_role_binding` is the single override surface. R-side terseness can come later if usage data warrants.

### 2026-06-02 — Q7 closed: no interim settings-panel redesign; ugly state accepted between Stage 1 and Stage 3

**Decision:** Stage 1's settings-panel work is purely data-plumbing (override-API writes refactored to the new `{role, ramp, grade}` shape). The visual redesign (Color/Type/Size/Effects tabs, Advanced disclosure, OKLCH picker, Spine, Inspector) waits for Stage 3. **Rationale:** rock n roll hard — no interim materials. The panel sitting in an "ugly" state (old visual chrome on new data plumbing) for the duration of Stages 1–2 is accepted as the cost of clean-break discipline. Same logic as the pin layer sitting half-functional during Stage 1. Pre-release license; no users to worry about.

### 2026-06-02 — Q8 closed: v4 theme JSON is `tabviz-theme/v4`; no migrator from v3

**Decision:** the v4 theme export JSON declares `$schema: "tabviz-theme/v4"`. No migrator from v3 JSON is written. Any v3 JSON in the wild is regenerated by re-running the authoring API in v4. **Rationale:** pre-release license; v3 themes were never load-bearing artifacts users built workflows around. Skipping the migrator removes a small but real piece of maintenance surface that would carry forward indefinitely.

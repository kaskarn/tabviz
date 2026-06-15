# Settings-panel coverage gaps — theme inputs with no interactive control

Status: **inventory** (2026-06-15). The settings panel is **deliberately
curated, not exhaustive** (D21 layer taxonomy; D25 "expert-grade stays
R-only by default"; the Plots tab is "the once-in-a-blue-moon escape
hatch"). R `web_theme()` + the `set_*` modifiers are the COMPLETE theme
surface; the live panel exposes the common, high-consequence dials. This
doc is the honest map of what the panel does NOT reach, so the gap is
tracked rather than rediscovered.

Method: diff the full `ThemeInputs` / role / token / mechanism surface
against the five live tabs (`VariationsTab` data-vt · `LabelsTab` data-lt ·
`IdentityTab` data-it · `PlotsTab` data-pt · `StylingTab` data-st ·
`FigureBand`) + the sanctioned store verbs (`settings-band-contract.test.ts`).
Absences grep-verified against `src/components/ui/settings/`.

The open product decision on whether to close the Group-A gaps is **D29**.

## A. Genuine missing controls — no interactive path at all

| Theme option | Controls | Author-only API |
|---|---|---|
| `inputs.curves.{neutral,brand,accent}` | ramp lightness shaping (linear/ease/smooth/log/exp) | `set_curves()` |
| `inputs.sequential` | sequential palette (viridis…) — drives heatmap/sequential cells | `set_sequential()` |
| `inputs.diverging` | diverging palette (rdbu…) | `set_diverging()` |
| `inputs.type_weights.{regular,medium,semibold,bold}` | the four numeric font-weight slots | `set_type_weights()` |
| `inputs.first_column_style` | row-identifier column "bold" treatment (sibling of `header_style`, which IS in Variations → "Header"). NOT in the planned Variations scope per settings-redesign.md, so likely conscious, not accidental. | `set_first_column_style()` |
| `inputs.marks.point_shape` | **theme-default** marker glyph. Per-series shape IS settable (Plots). | `web_theme(marks=)` |
| `inputs.marks.interval_weight` | default CI line width | `web_theme(marks=)` |
| `inputs.mode` | high-contrast / **reduced-transparency**. *Partial:* a view-level `ContrastButton` (auto/more) exists, but the theme `mode` input — esp. reduced-transparency — has no panel control. | `set_mode()` |

## B. Whole mechanisms deferred post-1.0 (decision register)

| Mechanism | Status | Author-only API |
|---|---|---|
| Per-token spacing | **D25 default (a)**: density + density_factor cover the common case; per-token is expert-grade, R-only. The arrange tool covers ONLY header-height / group-gaps / footer-gap as figure-state. | `set_spacing()` |
| Token **pin creation** | panel can only *release* existing pins (StylingTab "Carried overrides"), not create them. Needs a sanctioned `setPin`-style verb (D25-adjacent). | `set_pin()` |
| Component channel re-routes | `ComponentsEditor.svelte` exists but is **dormant** (not mounted in the live panel). Needs a sanctioned verb. | `set_component()` |

## C. Author/data-tier — intentionally outside the live theme panel

| Theme option | Author-only API |
|---|---|
| `inputs.interaction_defaults` (capability flags) | `web_theme(interaction_defaults=)` / `options(tabviz.interaction_defaults=)` |
| `inputs.column_defaults` (per-column-type house style) | `set_column_default()` |

## D. Tier mismatch — interactive equivalent exists at a different tier

- `inputs.row_kinds.{kind}.heightRatio` (theme-level ratio): not settable; the
  "This figure" row-height sliders write **figure pins**
  (`setRowKindHeight`, px → `spec.figureLayout`) — a different persistence
  tier (FIGURE state, not THEME state).

## E. Minor

- `inputs.geometry.radius.pill` has no individual slider (only the `corners`
  preset reaches it; sm/md/lg each have sliders).

## Patterns

The gaps cluster into three honest buckets:
1. **Color-science / typographic depth** the curated panel doesn't surface
   (curves, sequential/diverging, type_weights, mode) — Group A, the D29 question.
2. **The D25 "needs-new-sanctioned-verbs" mechanisms** (per-token spacing,
   pin creation, component re-routes) — deliberately post-1.0.
3. **Deliberately author/data-tier** surfaces (interaction_defaults,
   column_defaults) — never intended for the live theme panel.

Closing any Group-A gap is cheap mechanically (the sanctioned
`setAuthoringInputs` verb already exists; a control just needs UI in an
existing tab + a `data-*` marker + a passing `settings-consequence` leg).
The question is product-scope (curation vs completeness), not engineering —
hence D29, not a silent build.

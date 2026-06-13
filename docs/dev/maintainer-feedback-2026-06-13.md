# Maintainer feedback pass — 2026-06-13 (settings / roles / borders)

A live-testing pass surfaced ~11 issues, several pointing at brittle /
hardcoded substrate. This doc records the **diagnosis** (three parallel
investigations, file:line evidence) and the **batch plan**. Newest status
at top of each item.

## Landed

- **B1 — theme-switch crash** (`containerBorder`): `computeLiveConfigVars`
  read `theme.layout.containerBorder` raw while guarding `theme.series?.`
  beside it; a partial theme threw and corrupted every later render. Fixed
  by `lib/theme/layout-defaults.ts::resolveContainerBorder` (one helper for
  DOM emitter + SVG export + buildTheme; kills the triplicated magic `8`).
  Regression-tested. Commit 0b583e2.
- **B1 — D9 reversal → maximal interaction defaults**: author-grade
  affordances default ON (dev-tinker audience). Commit 0b583e2.
- **B2 — geometry sliders live-preview** (IdentityTab radii + rule widths):
  were `oncommit`-only (drag-blind); now `onchange`=preview + `oncommit`=commit
  via one `writeGeometry(write,…)`. Commit 136cd8b.
- **B3 — boxed first-column missing divider (Bug A)**: `--tv-first-col-rule`
  emitted `"transparent"` when not bold, defeating the consumer var() fallback
  → col1/col2 divider vanished under boxed. Resolver now emits the concrete
  minor divider color. Regression-tested; per-preset snapshot regenerated.
  Commit 9810056.
- **B4 — font selectors actually preview**: FontFamily was wired to the native
  `<select>` (option font-family is a no-op in Chrome/Safari); swapped to the
  custom DOM `Dropdown` (prop-compatible). Every font name now previews in its
  own face + selected value too. Commit 7664fd6.
- **B5 — dead cell family/weight controls honesty-filtered**: the text-role
  rebind now shows only the {family,size,weight} channels whose backing
  `--tv-text-<role>-<channel>` token actually paints (NOT KNOWN_UNCONSUMED),
  mirroring the component roster's filter. cell→size only; numeric→family only;
  a hint names the fixed channels. Reset moved to the always-present Role field.
  Test locks the data basis. Commit 10884e3.
- **B6 — hover explanations for theme toggles** (what is glow/glass/ruled):
  `Pill` already rendered `seg.title`; only the copy was missing. Centralized
  `OPTION_DESCRIPTIONS` (option-descriptions.ts) keyed by vocabulary → value,
  wired via `describedSegments()` across the Variations enum toggles. Keying by
  vocabulary disambiguates the overloaded `ruled`. Commit d752e26.
- **B7 — role→element legibility**: the Styling color-role picker shows a hint
  describing what the selected role paints, DERIVED from the manifest token
  descriptions (`TOKENS_BY_ROLE`), jargon stripped, curated overrides + naming-
  pattern fallback for token-less roles. Commit a663508.

- **B8 (LANDED) — remaining release-only sliders preview live**: role grade
  (new `previewThemeRoleOverride` verb), row-kind heights + watermark opacity
  (already history-free → onchange wired to the same verb), banding level
  (`writeBanding` commitNow flag). Slider inconsistency fully closed. Commit
  4a0151e.

## Remaining

- **Bug B — boxed DOM↔export frame divergence** (the last clear fix; SCOPED,
  not yet done — needs careful geometry + a working wysiwyg gate):
  - The DOM "frame" is STRUCTURALLY INCOMPLETE. `--tv-table-border-*` drives
    ONLY the top edge (`.tabviz-main` border-top, TabvizPlot.svelte:3040-3044).
    The right + bottom edges are ACCIDENTAL — they appear only when the cell
    col/row border styles happen to be solid (boxed → right via last-col
    border-right; bottom via last-row border-bottom). There is NO `border-left`
    anywhere → the table's left side is open under boxed/frame (the user's
    "absent border before 1st column").
  - The EXPORT draws a proper 4-side rect OVERLAY (svg-generator.ts:5231-5236),
    no layout impact, AND draws no internal vertical column dividers at all
    (col/table tokens are `consumedBy` DOM-only) → boxed renders a visibly
    different table in DOM vs export.
  - FIX DIRECTION: give the DOM a real 4-side frame that does NOT perturb layout
    (a plain border shifts content + breaks the flush-inertness invariant — must
    be an outline / inset box-shadow / positioned overlay, like the export's
    rect), and draw internal verticals in the export under grid layout so the
    two paths match. MUST be verified by `wysiwyg-diff.browser.ts` (DOM vs
    export parity) + layout-metrics (geometry unchanged). Deferred from this
    pass because that gate was flaking locally (captureScreenshot
    protocolTimeout — a Chrome/env issue, not the code); do it when the gate
    runs clean (CI, or a less-contended local env). (Bug A — the DOM missing
    col1/col2 divider — was already fixed in B3.)
- **DECISIONS (await maintainer):** glow/glass reimagine-or-remove (now
  shell-painted-gating could help; B6 added explanations); horizontal density
  model (needs a gap multiplier that doesn't feed auto-width); border vocabulary
  rename vs doc-clarify (B6 tooltips partially mitigate).

## Diagnosis (evidence) + remaining plan

### Sliders — commit-on-release inconsistency (user: "duplicate component defs?")
NOT duplicate components — ONE `primitives/v2/Slider.svelte` with a leaky
dual contract: `oninput→onchange` (live), release→`oncommit`. Sites that
pass only `oncommit` are drag-blind. No debounce anywhere.
- LIVE already: text size/scaling, gradient angle (VariationsTab),
  density_factor (StylingTab), LCH anchors (AnchorRow).
- RELEASE-ONLY: geometry radii/rules (IdentityTab — **fixed B2**), role
  grade (StylingTab:165), banding level (VariationsTab:151), watermark
  opacity (LabelsTab:86), row-kind heights (FigureBand:62).
- **Remaining fix**: role-grade + row-kind-height need NEW preview verbs
  (no `previewThemeRoleOverride` / `previewRowKindHeight` exist — only the
  recorded verbs); banding level is discrete + tangled with
  `setBandingOverride(null)`; watermark opacity needs a preview path. A
  focused "slider preview verbs" arc. Preview verbs that DO exist:
  previewAuthoringInputs, previewColumnWidth, previewLabel,
  previewThemeField, previewWatermark.

### Borders — boxed first-column anomaly (THREE stacked defects, D20 root)
Shared resolver `lib/theme/borders.ts::resolveBorders` shares **horizontal**
rules only; verticals + frame are DOM-only and uncoordinated with the export.
- **Bug A (DOM dead fallback)**: `--tv-first-col-rule` resolves to the literal
  string `"transparent"` (resolve-theme.ts:581) when `first_column_style !==
  "bold"`; the primary cell's `border-right-color: var(--tv-first-col-rule,
  …fallback)` (TabvizPlot.svelte:3249) never fires the fallback (var is
  DEFINED, just transparent) → col1/col2 divider silently missing under boxed.
  **Likely the main reported symptom.** Fix: emit the divider color (or leave
  unset) instead of `transparent` when not bold.
- **Bug B (frame asymmetry)**: DOM has NO `border-left` anywhere; frame =
  top + last-row-bottom + last-col-right. SVG draws a full 4-side rect incl.
  left edge (svg-generator.ts:5231-5236). → "missing border before col 1" is
  a real DOM↔export divergence. Fix: either DOM draws the left edge or export
  matches DOM; pick one and gate both on the same token.
- **Bug C (polarity)**: `first_column_style="bold"` + boxed → neutral[6]
  heavier divider + inverted bg/fg vs other columns. The first-col recipe
  (designed for hairline) collides with the grid layout.
- **Also**: SVG draws ZERO internal vertical column dividers (only the DOM
  does, via per-cell border-right) — col/table tokens are `consumedBy`
  DOM-only (component-tokens.ts:1340,1373,1389,1405). So `boxed` renders a
  visibly different table in DOM vs export — an undocumented WYSIWYG break.
- **Vocabulary**: `ruled`/`grid`/`boxed` overloaded across `border_preset`
  (layout), `shell_texture` (paper pattern), `set_rules` (width). `ruled` =
  horizontal rows with a thicker 2px major rule. Confusing; consider renaming
  or doc-clarifying.

### Roles — dead controls + zero legibility
- **Dead cell family/weight**: StylingTab text-role rebind defaults to
  `cell` and offers Family/Weight, but `--tv-text-cell-family` /
  `--tv-text-cell-weight` are KNOWN_UNCONSUMED (component-tokens.ts:1553-54);
  only `size` is wired. Changing them does nothing. The *component* roster
  honesty-filters dead channels (component-bindings.ts:114-121); the
  *text-role* surface does NOT. **Fix**: honesty-filter the text-role
  family/weight controls against KNOWN_UNCONSUMED (hide dead channels), OR
  wire cell family/weight (DOM+export together).
- **"cell" role** does do something: the COLOR cell component (`--tv-cell-fg`
  / `--tv-cell-border`) is live + consumed (svg + DOM). Only the TYPOGRAPHY
  cell role is partly dead (above).
- **rebind has no COLOR for text roles** (user): color roles are edited as
  ramp+grade in a *different* StylingTab section under role "text"; text-role
  rebind is family/size/weight only. Asymmetry is real but the color IS
  editable — just elsewhere. Legibility problem, not a missing capability.
- **Legibility = none**: roles shown as opaque names; no tooltip/preview/
  element-mapping in the live panel. Manifest HAS human descriptions
  (component-tokens.ts `description` fields, e.g. "Cell horizontal divider
  color") but they're never surfaced. The one labeled UI (`RoleChipGrid`,
  with a hover readout) is mounted ONLY in the dormant studio. `list_roles()`
  returns name+coordinate+one example token, no description join.
  **Fix (high value, low risk)**: project the manifest `description` onto the
  role/option controls as hover tooltips — surfaces data that already exists.

### glow / glass — wired but ungated
Both ARE wired to DOM rendering (glow: `.tv-shell.tv-glow` box-shadow halo,
theme-runtime.css:380; glass: `backdrop-filter` + sheen, :215-253). DOM-only
by design (stripped from export). "Don't do much" because they paint the
SHELL band, which is empty under the default `flush` shell — and unlike the
gradient control (gated by `shellPainted`, VariationsTab:100-101), glow/glass
are shown unconditionally. **Fix**: gate glow/glass controls by shell-painted
state + hover explanations; "reimagine or remove" is the maintainer's
medium-term call (effects axis). Decision-register candidate.

### Density — vertical-only feel (real, subtle cause)
`density_factor` DOES multiply horizontal tokens (cellPaddingX,
columnGroupPadding, indentPerLevel) in both resolve paths — but
content-driven column auto-width (`width = text + cellPaddingX×2`,
rendering-constants.ts:253) ABSORBS the change: shrink padding → column
shrinks → text rhythm unchanged. Plus `cell_padding_y = 0` in all presets, so
vertical is carried entirely by `row_height` (direct, visible). **Fix
(design call)**: a horizontal-density control needs a multiplier that adds
inter-column gap WITHOUT feeding auto-width (else it self-cancels).
Decision-register candidate.

### Font selectors — no preview
Font family pickers show the name in the default UI font. **Fix**: render
each option label in its own face (`style="font-family: …"`). Low risk;
families are already loaded for the live themes.

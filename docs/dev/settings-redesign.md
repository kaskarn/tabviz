# Settings UX — total redesign (locked 2026-06-12)

Status: **the canonical record.** The shipped settings panel and the
studio are SUPERSEDED — they grew by accretion across four arcs (one
presentation idiom per arc) and failed the maintainer's review on every
axis: unwired/inert controls, internal vocabulary in chrome
("(recipe)"), arbitrary curation (the role-tones foursome), redundancy
without commitment to idioms, no preview in pickers, no legibility
strata, and special-cases (first-column) surfacing as first-class UI.
Nothing in the old presentation layer is load-bearing for this rebuild;
the SUBSTRATE (three verbs, cascade, token manifest, store verbs, wire
envelope, undo) is sound and unchanged.

## The layer model (maintainer-authored)

| Surface | Layer | Contents | Semantics |
|---|---|---|---|
| **Variations** | 1 | polarity · density · banding · header tint/bold · title variants · shell · effects · border style · stroke/fill style · text size + scaling sliders | **Theme-blessed mode selection.** Every flip does what the THEME says should happen in that mode. Nothing freeform. |
| **Labels** | 1b | content + location of title / subtitle / caption / footer (once supported) · watermark | Figure content. Figure travel. |
| **Identity** (Edit theme) | 2 | color identity sliders · typography families · geometry | Tier-1 identity editing; cascade re-resolves. |
| **Plots** (Edit theme) | 3 | per-series marker shape, fill color, stroke color (roster TBD as viz grows) | **Deliberately freeform — users may break the theme's series logic.** The once-in-a-blue-moon escape hatch. |
| **Styling** (Edit theme) | 4 | detailed spacing (moved from L2) · role remapping · token remapping | Expert wiring. Spacing FIRST in section order (more arrivals via the density signpost than role remappers). |

Tab structure: `Variations | Labels | {Edit theme: Identity | Plots | Styling}`.

**The signpost pattern** (kills redundancy structurally): an L1 control
with a deeper sibling carries a caption pointing at it — e.g. the
density segmented control reads *"advanced control in Styling"*. One
control per concern per layer; a pointer instead of a duplicate.

## Decisions (each maintainer-ruled, 2026-06-11/12 discussion)

1. **Layer × surface mapping** as above. Five tabs, two everyday + an
   Edit-theme cluster of three.
2. **L1 semantics**: mode selection within the theme — "do what the
   theme says should happen in that mode."
3. **L3 is uncurated**: per-series overrides may break the
   accent/secondary ornament principle; that is accepted ("can come in
   handy once in a blue moon").
4. **Detailed spacing**: L2 → L4 (Styling), with the L1 density caption
   signposting it.
5. **Polarity is an L1 variation** (amends the manifesto's
   "single-mode theme" stance): derive the flipped mode via the
   existing reflection machinery by default; a theme may PIN a single
   polarity where the flip is aesthetic nonsense (the control then
   hides — consequence-or-absence). Pending: eyeball all 9 presets
   flipped before claiming theme-blessing (register D23).
6. **Borders + stroke/fill (slot_style)** ship in Variations AS-IS
   behind honest labels; each gets its own short design note for a v2
   vocabulary (both APIs ruled ineffective — borders are three
   half-APIs for one concept; slot_style is invisible on most
   fixtures). The panel arc does NOT absorb these redesigns.
7. **Studio: DEAD (dormant).** De-documented (front-page CTA + navbar
   removed; dormancy notice on its page). Reborn after the core UX
   lands, carrying forward the lossless round-trip + validate-matrix
   lessons. Its harness stays passing but is not extended.
8. **A11y POLISH deferred to immediately-before-CRAN** (pragmatic: it
   needs user feedback, which needs a stable design under it). The
   landed ARIA floor (table semantics, keyboard sort, reduced motion)
   stays — this defers further investment, not the floor.
9. **Placeholder title regions** (shaded clickable empty slots on
   key+hover): TABLED — real estate too precious to spend
   unilaterally on settings-open.
10. **View state stays in the toolbar**, out of the panel (zoom / fit /
    reader contrast toggle — localStorage travel, reader-owned). The
    authoring-side "color system → HC" control DIES.
11. **First-column channels in Styling are blocked on D20**: the wiring
    tab faithfully exposes whatever the theme system declares, so the
    label-column ontology discussion gates what appears there.

## First principles (derived from the critique; bind every build PR)

1. **Consequence or absence** — every visible control changes visible
   pixels in the CURRENT figure, now; controls for absent features
   don't render. (Liveness ≠ meaningfulness — the old gate measured
   operability only.)
2. **Preview before commit** — no blind pickers. Swatches, type
   specimens, mini-previews; discrete expressive pickers (e.g. a
   stepped weight slider) over dropdowns.
3. **One idiom per value type** — color → filtered swatch row; weight →
   discrete slider; enum → segmented with specimen. Never two idioms
   for the same type.
4. **No internal vocabulary in chrome** — resolver-group names
   ("recipe"), tier numbers, role coordinates: banned from user-facing
   text.
5. **Curation must be derivable** — anything "featured" comes from a
   stated rule, never an arc's leftover judgment.
6. **Channel pickers filter by kind** — a text channel offers text
   roles only (and then doesn't need to say "this is a text kind").

## Layer × travel matrix (written 2026-06-12, pre-Variations)

| Surface | Writes | Travels with | Reverted by | Notes |
|---|---|---|---|---|
| Variations (L1) | theme INPUTS (the variant fields: polarity, density, banding, header_style, shell, effects, border_preset, slot_style, type size/scale) | the theme artifact (export carries the picks) | **Reset theme** | Storage-wise identical to identity edits today; the SEMANTIC split (variant picks vs identity edits) is visible in the UI strata, not the wire. If dirty-tracking ever needs to distinguish them, a figure-variant store is an additive wire minor — deferred until a real need. |
| Labels (L1b) | spec labels (+ watermark) | the FIGURE (spec / figureLayout) | **Reset figure** | Never rides a theme export. |
| Identity (L2) | theme inputs (anchors, fonts, geometry) | theme artifact | Reset theme | |
| Plots (L3) | theme (series overrides; exact mechanism fixed at Phase 4) | theme artifact | Reset theme | Freeform by D21 ruling 3. |
| Styling (L4) | theme (roleOverrides, pins, spacing detail) — EXCEPT per-row-KIND height pins, which stay FIGURE state | theme artifact / figure respectively | Reset theme / Reset figure | The carried-overrides release affordance lives here when the tab lands. |
| Toolbar (view) | localStorage (zoom, fit, reader contrast) | this browser + document only | toolbar reset | Never in the panel (D21 ruling 10). |

## Open inputs the build needs

- ~~D23 polarity battery~~ — DECIDED 2026-06-12: all 9 presets bless the
  derived flip, no pins (register D23). The Variations polarity control
  shows everywhere.
- **D20 label-column discussion** — gates Styling's component roster.
- Border + slot_style v2 design notes (separate docs).
- **Specimen upgrades (Phase-1 residual)**: Variations satisfies
  preview-before-commit at the no-blind-dropdowns level (every enum is a
  labeled Pill), but Shell / Texture / Borders are visual choices where
  micro-specimens (VariantPicker cards) would dramatically help. Upgrade
  candidates when the idiom kit gains real (non-text) preview slots.

## The plan

**Phase 0 — REMOVAL — EXECUTED 2026-06-12.** Removed: QuickStrip (file +
mount), ComponentsBand (file + mount; ComponentsEditor/RoleChipGrid
files remain for the dormant studio build), RoleTones (file + the
advancedExtra host slot + the "Role tones" section), the Edit-in-studio
button + clipboard/Shiny handoff plumbing, the HC/RT mode control in
Color system (D21 ruling 10), and D16's compact single-scroll jump-link
nav (compact renders a plain section scroll in the interim; the dormant
studio keeps its roomy content tabs so its build stays green). The
"Studio overrides" disclosure became "Carried overrides" (the per-pin/
override RELEASE affordance survives — its home until Styling lands).
Verified: svelte-check 0/0, lint 0 warnings, units green,
settings-band-contract 22/22, interaction-qa 17/17, panel-liveness
shrunk to the surviving shell (62 controls live, 4 allow-listed),
widget + studio builds green. Original spec follows:
(complete before adding a single frontend element).
Delete from the panel: the role-tones band (arbitrary foursome), the
components band (returns redesigned in Styling), "Edit in studio" +
studio-overrides chrome, the color-system HC control, the quick strip
(superseded by Variations), the Advanced-controls disclosure structure,
D16's single-scroll nav. Retire `settings-band-contract` walks that
gate removed structures (keep the tier-write rule itself). The
panel-liveness harness shrinks to the surviving shell until tabs land.
Old sections die in code, not behind flags.

**Phase 1 — VARIATIONS — EXECUTED 2026-06-12.** The panel gained the
real tab spine (`variations | edit theme | this figure`; interim labels
for the not-yet-rebuilt surfaces) with Variations as the landing tab:
Polarity · Density · Banding(+level/start) · Header · Title · Tag ·
Shell · Texture · Borders · Series · Glow(+anchor) · Gradient(+angle) ·
Shadow · Glass · text Size/Scaling — every write a THEME-INPUT write
(travel matrix honored; Reset theme reverts all of it, verified by the
harness). Substrate: `banding` + `banding_start` were promoted to
Tier-1 structural-variant inputs end-to-end (TS types/validate/adapter,
R S7 slots/validator/wire both directions, `web_theme(banding=)`,
fixpoint + round-trip tests); the panel banding handlers CLEAR the
runtime figure override before writing so the theme write is never
masked. Removals (one control per concern): Tier1Sections lost the
Surface section, the Effects disclosure, and the Base/Scale sliders;
FigureBand lost its banding rows and the Contrast row (duplicate of the
toolbar ContrastButton — D21 ruling 10). Consequence gates in the tab:
Title needs a title, Tag's chip needs a tag, Series needs a plot
column, banding's group segment needs groups, Gradient hides at
float/transparent shells (the shell isn't painted there — found by the
harness, every segment 0px at float). The NEW consequence harness
(`tests/browser/settings-consequence.browser.ts`, `npm run
qa:consequence`, CI-gated) walks every `[data-vt]` control with real
input and pixel-diffs the figure region (pixelmatch threshold 0 —
deterministic headless rendering makes raw inequality the honest
measure; several blessed variations are sub-perceptual: nejm banding
Δ≈4/255). Its maiden runs caught the gradient/shell interaction and
proved header/shadow/angle wiring real. panel-liveness walks all three
tabs (67 repaint-verified); interaction-qa's settings leg rewritten for
the tab spine. Deferred to Phase 5: the density "advanced control in
Styling" signpost caption (pointing at a tab that doesn't exist yet
would be a broken signpost).

**Phase 2 — LABELS — EXECUTED 2026-06-12.** The `labels` tab (second in
the spine): text fields for title / subtitle / caption / footnote / tag
(one verb underneath — `setLabel` onto the session label overlay; the
exporter merges into spec.labels; inline canvas dblclick editing stays)
+ the watermark group (text/color/opacity, moved out of the figure
band). Substrate: `tag` became a first-class label slot (LabelField +
op kind `set_tag` + R `set_tag()` modifier + the chip's read now merges
session edits); `hasFigureEdits` includes label edits and the figure
reset clears them (`resetLabelEdits` — labels are figure content per
the matrix). REAL BUG FOUND AND FIXED: the widget proxy dispatch table
had NO `setLabel` handler — R's `set_title(proxy, …)` family was
silently dropped on live Shiny widgets since the proxy surface was
built (handler + normalize entry added; test-label-slots.R covers the
spec path). The consequence harness gained the Labels walk (text-input
operation: real typing + Enter) and the Reset-figure travel check;
ids namespaced per tab (title/tag exist on both). 27 controls + both
reset travels green; liveness 71 repaint-verified across 4 tabs.
Label LOCATION controls await engine support (the maintainer's "(once
supported)").

**Phase 3 — IDENTITY — scoping (written 2026-06-12, pre-build).**
Replaces the interim ThemeBand/Tier1Sections under "edit theme" with
the real Identity tab (L2: who the theme IS): the four anchor rows +
status disclosure (AnchorRow already idiom-conformant — swatch
preview, LCH expand) · typography FAMILIES (body / display / mono /
numeric via FontFamily) · geometry (corner/rule slots + fine stops) ·
data scheme. Per the layer model these LEAVE Identity: type-ROLE
rebinds (role remapping = L4 Styling; interim home: stays on Identity
bottom under a disclosure until Phase 5 — homeless controls are worse
than a marked interim) · carried-overrides release (Styling-bound, same
interim treatment). The "Edit theme" CLUSTER chrome (inner tab row
Identity | Plots | Styling) arrives when a second inner tab exists
(Phase 4) — one inner tab needs no inner chrome. Consequence harness
gains the Identity walk (anchor rows operate via LCH keyboard;
families via the FontFamily picker).

**Phase 3 — IDENTITY — EXECUTED 2026-06-12.** The interim ThemeBand
mount under "edit theme" is replaced by the real `IdentityTab` (L2 —
who the theme IS): the four anchor rows (+ status disclosure; AnchorRow
reused — swatch chip, hex field, LCH expand) · `monochrome` toggle ·
typography FAMILIES (body / display / mono / numeric via FontFamily
native select) · geometry (corner/rule slots + fine stops) · the data
scheme. ThemeBand.svelte DELETED; Tier1Sections.svelte stays as the
DORMANT studio rail's component (D22). Two STYLING-bound groups
(type-role rebinds, carried-overrides release) live under a marked
"advanced — moving to styling" interim disclosure until Phase 5 —
homeless controls beat lost ones. CONSEQUENCE-OR-ABSENCE FINDING: the
categorical scheme colors series slots 1+ only, so it is inert on a
single-series figure — the harness flagged it (0px), and the tab now
gates it on `hasMultiSeries` (a multi-effect forest or any multi-series
viz); the harness fixture gained a 2-effect forest to exercise it.
Harness also gained: select + custom-dropdown operation, anchor hex
typing (triple-click selects — Cmd+A is NOT delivered headless on mac,
the append silently failed the hex validator and the 456px "pass" was
the focus ring — comment guards against re-learning), and QUIESCENT
screenshots (poll until two shots are identical — a fixed delay raced
the theme re-resolve, leaking a repaint into the next op's window). The
caption chip is now BAKED into the fixture theme so the Labels tag
field stays consequential across resets. 39 controls + both reset
travels green; liveness 72 repaints across 4 tabs; band-contract walk
re-pointed at the new tab files. The Edit-theme CLUSTER chrome (inner
Identity | Plots | Styling tab row) lands with Phase 4 — one inner tab
needs no inner chrome.

**Phase 4 — PLOTS — EXECUTED 2026-06-12.** The "edit theme" top-tab
became an inner CLUSTER (`EditThemeCluster`: inner tab row Identity |
Plots — the inner chrome appears now that a SECOND inner tab exists)
and gained `PlotsTab` (L3 — per-series viz control): one row per series
slot the figure actually renders (deepest effect stack across its viz
columns), each with a shape picker + fill + stroke swatch.
DELIBERATELY FREEFORM (D21 ruling 3). NEW SUBSTRATE: `series_overrides`
— a sparse theme-input array indexed by series slot
(`{ fill?, stroke?, shape? }`), overlaid in the adapter AFTER the
slot_style derivation (fill/stroke re-derive dim/hot for coherence;
hex gated defensively). Full parity: TS type + validate (hex grammar +
shape enum, XSS-relevant) + adapter overlay + 3 unit tests; R S7 list
slot + structural validator + verbatim serialize (I()-wrapped) +
sanitizing import (hex/shape filter, slot position preserved) +
`web_theme(series_overrides=)` + round-trip test. REAL RENDERER BUG
the consequence harness surfaced and FIXED: multi-effect forest CI
lines hardcoded `series[0].stroke`, so every series drew slot-0's line
color and the per-series stroke control was inert (stroke-1 = 1px) —
now `series[idx].stroke`, fixed in BOTH the DOM (RowInterval) and the
SVG export (svg-generator) together (WYSIWYG gate + forest-marks green;
single-effect forests unchanged since idx≡0). Consequence harness
gained select/dropdown/Swatch-hex ops, per-slot distinct colors (two
series' lines overlap — same hue showed nothing), and the fixture moved
its point estimates to HR 0.2–0.4 with a pinned [0,1] axis so the
markers fall LEFT of the panel and are observable (they sat behind the
panel at HR≈1.0). 45 controls + both reset travels green; liveness 76
repaints (Plots shape segments included); a Plots inner-tab walk added
to liveness. The Identity scheme-picker's hasMultiSeries gate (Phase 3)
now has live coverage via the fixture's 2-effect forest.

**Phase 5 — STYLING.** The final tab. Exit gate:
- every control passes **consequence** (visible pixel delta in the
  rendered fixture — a NEW harness check, not DOM-fingerprint
  liveness);
- idioms conform to the principle table;
- vocabulary audit clean;
- travel verified against the matrix;
- nothing superfluous (a control without a consequence test does not
  merge).

Validation cadence per tab: screenshot battery across ≥3 presets +
the consequence harness + the standing gates (wysiwyg, interaction-qa).

## What this supersedes

The settings-overhaul plan (two-band panel), D16 single-scroll, the
role-tones curation, the studio's Stage-2/3 component editor surfaces
(the STORE verbs survive), and the panel sections of
`interactivity-ux-plan.md`. Those documents stay as history; this one
is current.

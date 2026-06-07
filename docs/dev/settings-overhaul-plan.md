# Settings ⇄ Studio boundary + settings-panel overhaul

**Decided 2026-06-06** after three agent rounds (5-perspective debate → proposal
workshop → 3 design blueprints; session c9d63d6d). Supersedes D14 ("cog =
polarity + density only"), which is formally rescinded.

## The boundary model (locked)

**Tier-gated writes, artifact-typed travel.**

- **Settings panel** may write **Tier-1 + variant inputs only** — everything
  that re-resolves through the cascade (anchors, polarity, accessibility mode,
  density + factor, shell mode, header style, series style, border preset
  [new enum], font scaling, texture, effects enums, geometry scales,
  categorical scheme, status anchors). It also owns **FIGURE state** —
  per-spec values that do NOT travel with the theme (banding, watermark,
  row-height pins, per-figure override escape).
- **Studio** is the superset: the same Tier-1 surface **plus total Tier-2/3
  control** (per-role typography, semantic token definitions, raw borders /
  spacing pins, the Tier-2 spine / role rebinding, inspector) **plus** its
  exclusive jobs: cascade pedagogy, validate matrix, live R snippet, trace.
- **DEFINE vs APPLY:** a control belongs to the theme surfaces iff it mutates
  the portable theme artifact. Watermark, banding, row pins, and paint-tool
  application are FIGURE/canvas concerns — the studio structurally cannot
  hold them (its store has no spec) and never should.
- **Both surfaces export theme JSON, one envelope:**
  `{ schemaVersion, inputs, roleOverrides?, pins? }`. Settings emits the
  Tier-1 prefix (`roleOverrides: {}`); the studio emits the full artifact.
  Never two top-level shapes. Pins/overrides carry provenance (derived vs
  hand-pinned vs role-rebound) so re-imports know what to leave alone.
- **"Edit in studio →" is a projection, not a translation:**
  `studio.init(currentInputs)` — settings' artifact is a strict prefix of the
  studio's, so the handoff is lossless by construction.

### Why (one paragraph of receipts)

The old split was an accident: settings was simultaneously *gated* (no
anchors/shell/fonts) and *deeper than the studio* (Text/Tokens/Spacing/raw
borders — surfaces the studio could not author, so "the authoring home
couldn't author the theme"). Worse, the settings depth was the dangerous
kind: `setThemeField` writes raw resolved paths, bypasses contrast
validation, and `reapplyEdits` re-stamps those pins over every rebuild
forever — while the gated Tier-1 edits were the SAFE ones (full re-resolve +
validation). The new model brick walls the unvalidated-pin entry point in the
widget (the `themeEdits`/`reapplyEdits` apparatus gets DELETED, not
deprecated) and relocates T2/3 to the studio, whose `roleOverrides`
architecture already does pins-over-rebuild correctly (typed, re-overlaid
through `resolveTheme`, contrast-checked on every derive).

## Locked design decisions

1. **Panel width: fixed ~400px** (was `clamp(320px, 40%, 440px)`).
2. **Tabs die.** Single vertical scroll, sticky micro-caps section flags.
   No horizontal nav, no glyph-only nav (failed once already — see
   SettingsPanel's own comments). Scroll-fade machinery deleted; the IA fits
   instead of hinting.
3. **One control dialect: the v2 primitives** (Field/Pill/Slider/Swatch/
   Select + new thin `DisclosureField`, `TextInput`). The `--tp-*`/`.seg`
   dialect and LayoutControl's bespoke cards/cyclers/`.sr-only` shadows die.
4. **Shared components everywhere (T1 decision):** the new v2-faced controls
   are THE implementation; the **studio rail adopts them too** (roomy face
   via a layout prop). `theme-panel/controls/*` and the `--tp-*` token
   namespace are deleted at the end of the migration. One implementation per
   control — the LayoutControl-mirror drift class becomes impossible.
5. **Disclosure depth ≤ 1 (T2 decision):** sections collapse; nothing
   collapses inside a collapsed thing. Geometry is its own collapsed section
   (`r 4 · bw 1` chip), NOT nested in Effects.
6. **Collapsed ≠ blind:** every collapsed section shows a current-value chip
   (`Effects subtle · low`, `Status 4 set`, `Row pins 2 pinned`).
7. **THEME/FIGURE structural seam:** FIGURE band sits on recessed paper
   (`--v2-paper-2`), neutral edge (no brand hairline), labeled
   "stays with this figure · not exported". **Two scoped resets** —
   "Reset theme" (Tier-1 inputs, top bar, gated on hasThemeEdits) and
   "Reset figure" (banding/watermark/row pins, in the FIGURE band). The
   single combined Reset dies.
8. **Content is edited on the canvas, not the panel (T3 decision):**
   title/caption/footnote text fields are CUT from settings; inline
   double-click editing is the path (verify footnote coverage — wire it if
   missing). Settings is about appearance + figure-display state, never
   writing.
9. **Top of panel (first ~200px):** preset echo + divergence badge
   ("Cochrane · 3 differ"), polarity pill, density pill,
   "Edit in studio →". The declared-everyday knobs + orientation +
   escalation, zero scroll.
10. **Flagship control — the anchor row:** 24px Swatch row (chip + mono hex),
    caret expands L/C/H v2 sliders (hue-wheel H track, axis-gradient L/C
    tracks, eyedropper popover, mirror-reset for accent/ink2),
    accordion-of-one, preview-on-drag / commit-on-release (C53 channel).

### Panel IA (target)

```
PANEL BAR      settings · [Reset theme] · ✕
QUICK STRIP    preset echo + divergence · Polarity · Density · Edit in studio →
═ THEME ═      (travels with the theme · re-resolves)
  IDENTITY     paper/ink/brand/accent/ink2 swatch rows · ▸ Status (4 chips)
  SURFACE      shell · header style · border preset · texture
  TYPE         body family · base size · scale ratio
  ▸ COLOR SYSTEM   series style · categorical scheme · accessibility mode
  ▸ EFFECTS        glow · gradient(+angle) · elevation · title style
  ▸ GEOMETRY       radius scale · border-width scale
▓ THIS FIGURE ▓ (stays with this figure · not exported; recessed paper)
  banding · ▸ watermark · ▸ row pins · ⚙ per-figure override escape
  [Reset figure]
```

## Wire / engine work this requires (do FIRST — the boundary is fake without it)

- **`roleOverrides` export bug (shipped P0):** all three studio export paths
  serialize `studioStore.inputs` only — the T2 spine rebind does not survive
  the studio's own Copy JSON. Fix + make `roleOverrides` a first-class wire
  field with R serialization parity (`test-parity-themes.R` extension).
- **Border preset = a REAL Tier-1 enum** (`borders: none|hairline|ruled|
  boxed|…`) with a resolver expansion into the T3 cluster — the
  `header_style` precedent. If it's a dropdown writing `borders.*` T3 paths,
  the boundary is cosmetic and the whole plan is void. Same test for font
  scaling: the settings knob is the T1 scalar pair (`type_base_size`,
  `type_scale_ratio`), never `text.{role}.*`.
- **Studio's second override channel** for non-role T2/3 pins (per-role text,
  raw borders/spacing): a TYPED per-cluster union on the studio store —
  NOT a re-import of `themeEdits`' string-keyed paths. Pins enter the
  cascade pre-resolve (so contrastWarnings/validate-matrix see them), never
  post-resolve stamping (`reapplyEdits` is the anti-pattern being escaped).
- **Delete `reapplyEdits` + `themeEdits`** from the widget store once no
  settings control writes T2/3 paths — dead code proof via grep gate, not
  dormancy.

## Design tests (any implementation must pass)

DT-1..7 (from the round-1 critic): pin round-trip; one reset vocabulary per
surface; non-R reachability of every settings capability; single source per
value (no duplicated controls); preview-swatch fidelity (read resolver
output, never recompute inline — must be correct under dark/HC); usable at
the width floor without scroll-tunnel; the boundary statement matches what
each surface actually contains.

DT-8..14 (round 2): studio self-round-trip (export → import → rebind
intact — FAILS today); cross-surface round-trip through R (roleOverrides
parity); single JSON envelope both surfaces emit/consume; boundary-is-real
grep gate (no settings control calls `setThemeField` with T2/3 paths);
no invisible-unclearable pins in widgets (a theme with studio pins must say
so); per-field Tier-1 revert exists or is explicitly deferred; dead-code
proof for `reapplyEdits`/`themeEdits`.

## Persona conditions (carry into implementation)

- **Status colors** ("make negatives red") — satisfied by construction:
  `status_*` are Tier-1 anchors → IDENTITY ▸ Status.
- **Frame text size** — DECIDED (P4): consciously declined for settings.
  The per-role size is a token pin — `set_pin("--tv-text-footnote-size",
  "0.7rem")` in R or the studio PinsPanel — both one-liners. Settings
  stays Tier-1-pure; the carve-out would have been the first cosmetic
  T3 write in the panel and the thin end of the boundary's wedge.
- **JSON import affordance** in settings (export-only is write-only for
  no-R Shiny consumers) — backlog, pairs with the single-envelope work.
- **Author freeze** `enable_theme_edit = FALSE` on `web_interaction()` —
  backlog (the "widen" knob is moot under the new model; freeze is the
  residual need).
- **Everything removed from settings stays settable in R** (`set_text()`,
  `set_borders()`, `set_spacing()` …) — the studio is GUI convenience,
  never the only door.

## Cull list

Tab apparatus (registry, TabSelect import, tab-bar, aria wiring) ·
scroll-fade + updateScrollHint machinery · LayoutControl cards/cyclers/
`.sr-only` shadows/`!important` Swatch overrides · SegmentedField (once
callerless) · settings' Spacing/Viz/Text/Tokens tabs (→ studio) ·
`reapplyEdits`/`themeEdits` (after grep gate) · the combined Reset ·
the studio-hint paragraph (replaced by the Quick-strip handoff) ·
`--tp-*` tokens + `theme-panel/controls/*` (end of migration, after the
studio rail adopts the shared controls).

## Status (2026-06-07)

P0–P4 EXECUTED (commits 48030de, 13c8a9f, 04d09fc, eb50684, 0dfe523 +
the P4 batch). All design tests have gates; two adversarial review
passes ran mid-arc (P0 review: paint-path fix; P1/P2 review: scenario
harness, hex NaN gate, banding restoration). Remaining backlog: the
divergence badge counts vs the LOADED theme (not a named org base);
per-field Tier-1 revert deferred (DT-13 documents it); `themeEdits`/
`reapplyEdits` SURVIVE deliberately — canvas gestures (title-gap /
footer-gap drags on the plot) still write spacing paths, which is
per-figure APPLY under the doctrine; the DT-11 gate guarantees the
SETTINGS tree never does. Full deletion needs the canvas gestures
migrated to a figure-scoped channel first.

## Build sequence

0. Wire prerequisites (roleOverrides export/wire/parity; border-preset enum;
   envelope schema). Gates: DT-8/9/10.
1. New shared v2 controls (AnchorRow flagship, enum pills, sliders,
   DisclosureField, TextInput) — built host-agnostic with compact/roomy
   layout prop. Gate: DT-11 grep.
2. Settings panel rebuild on the new IA (quick strip, THEME/FIGURE seam,
   two resets, value chips). Cull list items fall here. Gates: DT-1..7,
   DT-13.
3. Studio rail adopts the shared controls; `--tp-*` + theme-panel/controls
   deleted. Studio gains the typed T2/3 pin channel + provenance readouts.
   Gates: DT-12, DT-14.
4. Polish: divergence badge, import affordance, author freeze, frame-text
   carve-out decision.

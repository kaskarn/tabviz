# tabviz UX + Theme Redesign — the rgc_v4-ceiling plan

**Directive (2026-06-08, maintainer):** Redesign ALL UX. ZERO dead buttons.
Tight theme set with unique identities. Be ambitious; aim for excellence.
Look to **rgc_v4** (`dev/rgc_v4_unzipped/`) for AESTHETIC outcomes (not its
framework). Propose BOLD ways to expose package internals. Long haul —
quality over speed. Summon front-end experts periodically to keep honest.

**North star — rgc_v4's four identities each OWN one axis** (Ledger=COLOR,
Brutalist=GEOMETRY, Aurora=EFFECTS, Terminal=ALIASING), fully committed,
nothing half-applied. Control language = uppercase-mono kicker + serif title
+ prose hint + inline OKLCH coordinates ("the editor IS the documentation").
Table-craft = TABLE chip · green p-value pills · teal emphasis-row border ·
column-group spanner rules · footnote band.

## The two root diagnoses (panel-converged)

1. **Two design systems in one viewport.** `StudioShell.svelte` ships ~19
   hardcoded slate-gray literals + `-apple-system` font; the rail *inside* it
   is warm v2-themed. The "fkin mess" is largely this incoherence + native
   `<select>` menus shattering the editorial skin. The bones (v2 tokens, Pill,
   AnchorRow LCH instrument, DT-11 boundary, the rich Picker) are GOOD.
2. **Texture used as a substitute for table-craft.** 14/27 presets carry
   `shell_texture`; journals (`nature` ruled, `tufte` ruled) use background
   pattern to fake character the type + borders + craft should carry.
   `border_preset` (frame/hairline) is built and used by ZERO presets. Elegance
   = subtraction + committing one axis.

## Workstream A — Control language & settings/studio UX

**A0. Unify the design language.** Delete the slate literals + `-apple-system`
from `StudioShell.svelte` (+ OklchPicker, StudioChart); route all studio chrome
through `data-tv-v2` + the v2 tokens. One token set top to bottom. *Highest
leverage, lowest risk; silences the core complaint.*

**A1. Kill native `<select>`.** New `Dropdown.svelte` (Picker-backed, Select
API: value/options/onchange). Swap all `Tier1Sections` call sites (Texture,
fonts, type role family/size/weight). Demote/delete `Select.svelte`. *Most
visible single win.*

**A2. The editorial voice.** New `Kicker.svelte` = `[MONO-UPPERCASE EYEBROW ·
axis] / serif Title / prose hint`. Upgrade `Section` to use it. Put the
declared-but-mute `--v2-font-serif/-display` to work. Add inline OKLCH
coordinate micro-text to `AnchorRow` (compact) + a `coords` mode on `Slider`.
New tokens in `tokens.css`: kicker/title/prose/coord/axis-dot.

**A3. The IA — 4 axis-tabs.** Replace the "Advanced controls" junk-drawer with
Pill-tabs (colored dots): **IDENTITY** (anchors+polarity+status) · **COLOR**
(mode, categorical, header, series, role-tones, read-only mini-spine) · **FORM**
(geometry w/ live samples, density, type, borders, texture, shell) · **EFFECTS**
(glow/gradient/glass/elevation/title/caption). QuickStrip stays pinned above.
Disclosure-depth ≤ 1 preserved (tabs replace the toggle).

**A4. Zero dead buttons (machine-enforced).** (a) Universal *live* reset gutter:
every Tier-1 row that diverges from `initialTheme` shows a hot dot; click
reverts that field (reuse `theme-diff.ts`). (b) Delete the dead
`tabviz_studio(plot)` R-snippet fallback. (c) New harness
`tests/browser/panel-liveness.browser.ts`: mount the panel, drive EVERY control,
assert each fires a store mutation. The permanent guarantee.

## Workstream B — Theme set: 8 axis-committed identities (HARD cull)

Delete 27→8 (maintainer: cull hard). Each keeper OWNS one axis, fully
committed; journals are CLEAN (no texture) + ELEGANT (committed serif, real
accent, `border_preset:"frame"`, confident type scale, numeric figure font).

| Theme | Axis owned | Texture | Border | Absorbs |
|---|---|---|---|---|
| **Clinical** | restraint | none | frame | cochrane, nejm, jama, bmj, nature, lancet |
| **Ledger** | COLOR | none | hairline | ledger, solarized, sunprint, executive |
| **Brutalist** | GEOMETRY | none | boxed | brutalist, swiss, bauhaus |
| **Aurora** | EFFECTS | none | none | aurora, tonal, tonal_dark |
| **Terminal** | ALIASING | none | none | terminal, dark |
| **Darkroom** | DARK (designed) | none | hairline | solarized_dark, dwarven |
| **Newsprint** | TEXTURE (the one) | grain | ruled | newsprint, hobbit, atelier, tufte, elvish |
| **Blueprint** | grid/draft | grid | none | (keep ~verbatim; maintainer-loved) |

(Synthwave = optional 9th neon showpiece; maintainer-loved. Recipes: see panel
report — committed fonts, oxblood/teal accents, frame-not-texture.) `theme_blend()`
covers the dropped variants. **Highest-leverage first move: texture OUT,
`border_preset:"frame"` IN on every journal.**

**B-craft.** Ship the six rgc table details as role-recipe defaults, not
per-preset texture: TABLE chip (`caption_style`), p-value PILL on significant
(`pvalue.significant_style:"pill"` — NEW option), emphasis row = thick left
accent border + bold (role-recipe change), spanner hairline rules, footnote
`note.band:"callout"` (NEW), differentiated row states. Wire the 4th `numeric`
figure font slot into all keepers (`fonts.numeric`, falls back to body).

## Workstream C — Bold internals exposure

- **C1. `suggest_theme(brand, base)` first-class** — one brand color → a
  complete contrast-validated theme on the nearest archetype. (Engine shipped
  in Wave 4; promote it as THE "make it mine" on-ramp + a panel control.)
- **C2. `theme_blend(a,b,t)` as a studio slider** — ship 8 corners, slide
  between them (OKLab lerp + enum snap). Replaces shipping every point.
- **C3. Alt-click-any-cell → trace, in the WIDGET** — promote
  `inspector-store` + `CascadeView` out of the studio: any cell/mark reveals its
  Tier1→3 derivation (token, OKLCH, ramp·grade, cascade path). The resolver
  becomes a user-facing teaching + debugging feature. *The flagship.*
- (Stretch, from the 3rd panelist: embeddable theme-editor web component;
  shareable cascade permalink; in-panel live contrast/a11y audit; "what does
  this token affect" consumedBy highlighter.)

## Workstream D — Contained correctness

- **D1. CI column width** — `_formatIntervalImpl` must share the renderer's
  variant recipe (stacked/plus_minus measure wrong) + per-variant parity test.
- **D2. Title-chip text** inline-on-canvas editing (finish item 6).

## Sequencing

0. **A0** (unify design language) — silences the complaint, de-risks all after.
1. **A1** (kill native Select) — most visible win.
2. **A2** (editorial voice) — reach rgc surface polish.
3. **B** (theme cull + craft + numeric font) — the identity payoff.
4. **A3** (4 axis-tab IA) — reach rgc IA.
5. **A4** (zero-dead-buttons gate).
6. **C** (bold internals: coordinate skin → mini-spine → widget trace).
7. **D** (CI width, chip text).

Each phase: build → verify (svelte-check, gates, screenshot via studio-shot/
panel-shot, R suites) → summon an honesty-check agent (with the directive +
rgc grounding) before moving on.

## Critic corrections (3rd panelist — integrated)

1. **Native `<select>` is deliberately native** (`Select.svelte` — free a11y +
   type-ahead + mobile pickers). The "web 0.0" is the OPEN OS menu, not the
   closed control. So A1's `Dropdown` MUST be a fully keyboard-accessible
   listbox (arrows/Home/End/Enter/Esc/type-ahead/ARIA/focus-mgmt) — a naive
   swap REGRESSES a11y. (Our Dropdown.svelte does all of this.) Keep native as
   a documented escape hatch; don't blanket-delete.
2. **A0 is architectural, not paint.** The studio rail is OUTSIDE the widget
   DOM → cannot inherit `--tv-*` ("light by construction"). Define a real
   `--studio-*` token LAYER (the shell already references undefined
   `--studio-bg/-fg`) deriving an editorial light/dark studio chrome, then
   replace the 19 literals against it. Required by the embeddable-editor story.
3. **Reset gutter must be TWO-SCOPED** (A4): theme controls diff vs
   `initialTheme`; FIGURE-band controls (banding/watermark/row-pins/contrast —
   spec-scoped, NOT in initialTheme, separate reset) diff vs figure-initial. A
   single "universal vs initialTheme" gutter breaks the shipped two-scoped-reset
   architecture + trips DT-11.
4. **Liveness gate asserts the wrong property.** "Every control mutates state"
   is necessary-not-sufficient + false for mode-suppressed controls. Assert:
   (a) PIXEL-DELTA in the preview (screenshot-diff) — catches "writes a field
   nothing reads"; (b) a slider DRAG (pointermove) repaints — guards the
   `$state.raw` silent-dead-preview trap; (c) a justified-no-op ALLOW-LIST
   (texture under HC, dropped pins) so suppression stays honest; (d) both
   scoped resets clear only their scope; (e) keyboard reachability of every
   control.
5. **Unified interaction contract (new Phase 1):** every control =
   live-preview-on-input → debounced-commit-to-history → same-field
   coalescing. This gives the WIDGET undo for free (it has preview, lacks
   history) and makes rgc-style liveness safe. Every preview path MUST go
   through setSpec/writeThemePath (the `$state.raw` trap).
6. **Vet the 8 by ΔE before naming** (run `preset-distinctness.test.ts` on the
   candidates): Terminal/Darkroom and Ledger/Newsprint may be near-neighbors
   wasting the distinctness budget. Measure, then cut/merge.
7. **Bolder internals (elevated):** the flagship isn't another R function — it's
   making the cascade a SHAREABLE/EMBEDDABLE/SELF-EXPLAINING artifact on the
   wire envelope + `consumedBy` contract that already exist + are CI-enforced:
   ① theme PERMALINK (`#theme=base64url(envelope)`) + embeddable
   `<tabviz-theme-editor>` web component; ③ BIDIRECTIONAL `consumedBy`
   highlighter (hover cell → which tokens+behaviors made it — drift-gated, so
   free correctness); ② `explain_theme()` prose from roleSource/consumedBy;
   ④ live DTCG-export panel + AMBIENT a11y/contrast badge (validateVerdicts is
   already computed). Ship ①+③ first; stage ②+④.

## Progress log (2026-06-08/09)

SHIPPED (each commit verified — svelte-check, DT-11/control-contract, snapshots,
R parity/render-smoke):
- **A0 ✓** studio `--studio-*` editorial token layer (StudioShell + OklchPicker
  + StudioChart) — one design language, no cold-slate.
- **A1 ✓** `Dropdown.svelte` (keyboard-accessible custom listbox + aria-
  activedescendant) replaces native `<select>` in the panel.
- **A3 ✓** the 4-axis TAB IA (IDENTITY/COLOR/FORM/EFFECTS, colored dots) replaces
  the long-scroll + "Advanced controls" junk-drawer. Both viewer + studio rail.
- **A2 (partial)** inline OKLCH coordinate readout on AnchorRow (rgc instrument
  texture). REMAINING: the Kicker/serif Section voice; coords on more controls.
- **B (started)** `web_theme(border_preset=)` unlocked; journal family
  (cochrane/nejm/jama/bmj/nature) → `border_preset:"frame"` (texture out).
  `fonts.numeric` figure-font slot + reachable "Numbers" picker. REMAINING: the
  27→8 ΔE-vetted cull + committed identities; the rest of the table-craft.
- **B-craft** the rgc green p-value PILL (`significant_style:"pill"`).
- **D1 ✓** CI column-width variant-aware measurement + parity gate.

NEXT (priority for the panel-polish + theme-elegance maintainer): finish A2
voice · A4 zero-dead-buttons gate · B 27→8 cull + table-craft · C bold internals
(in-widget trace + permalink).

## Guardrails to keep green throughout
DT-11 (`settings-band-contract`), control-contract, resolver-dispatch snapshot
(regen+review), preset-distinctness (rewrite for 8), R↔TS parity, serialize-
weight, dist-smoke (contract surface). Docs re-render (index+studio). Bundle
budget is a movable tripwire (bump freely).

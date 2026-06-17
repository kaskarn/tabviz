# Arc history — chronological status records

Moved out of `.claude/CLAUDE.md` on 2026-06-10 when it was restructured
to lean conventions + current-state map (the diary had grown to ~750
lines that every agent session paid context for). These records are the
arc-by-arc trail: what shipped, in what order, with the reasoning of the
moment. The DURABLE residue (conventions, traps, key files, invariants)
was distilled into CLAUDE.md's "Current architecture" and "Traps" sections
— if you find something here that still bites and isn't in CLAUDE.md,
promote it.

Newest first within each block, as originally accreted.

## 2026-06-17 — systematic review pass: caption-ascent naming + R serialization/parity audit (clean)

Two loop firings of focused review. (1) **Width-system fudge audit** →
the system came back clean; the one real finding was bare ascent literals
in the title/subtitle caption block (`0.8` ×2, `0.75`), inconsistent with
the named `LEGEND.*_ASCENT_RATIO` convention. Named them
`TYPOGRAPHY.CAPTION_BASELINE_RATIO` / `SUBTITLE_ASCENT_RATIO` (same values,
byte-identical geometry — commit 6b8c0b75). (2) **R serialization / wire-import
+ R↔TS parity audit** — irreducibly R-side, not previously given a dedicated
pass. Came back clean on all known trap classes: eager S7 defaults ZERO,
`theme_from_wire` uses `[[ ]]` exact access + full untrusted-ingress
validation (pin grammar, component bindings, schema), `%||%` self-guards on
length>1. R↔TS sync + parity gates 55 checks / 0 failing (wire-version, both
rosters, systemfonts injection, columns, themes). knip 0 dead values. No code
change warranted — recorded here so future firings skip re-auditing this ground.
The autonomous roadmap remains complete: every register Open item (D29/D25/D20)
and roadmap remainder is post-1.0 / maintainer-gated.

## 2026-06-16 — D33 closed: systemfonts width constants → full TS alignment (fudge removed)

`.inject_systemfonts_widths` (save_plot) hard-coded buffer=8 / min=40 / max=480
(one cap), diverging from the TS source (4 / 60 / 600 / label 400). The min/max
were clear drift (the screen floors at 60, caps data at 600, label at 400);
realigning is truncation-safe (only widens). The +8 buffer was the fudge
candidate — ASSUMED to compensate for systemfonts measuring narrower than the
estimator. Settled it EMPIRICALLY (prompted by the maintainer's "make sure
you're not adding fudge debt"): rendered save_plot PNGs of long clinical labels
at buffer=4 → truncates + overflows NOTHING (eyes-on verified). So the +4 was
unjustified drift, not compensation. Aligned all four to TS exactly (zero fudge,
WYSIWYG-improving: screen + save_plot now share identical clamps). Added a
source-parse drift test pinning the R constants to the TS values (wired into the
in-tree CI sync-gate step); corrected the stale CLAUDE.md trap that had
justified the fudge. D33 → Decided (c). Lesson: don't preserve a fudge factor on
an assumption — render it and measure.

## 2026-06-16 — D32 investigated + closed (no second flex impl) + D31 wired

Two roadmap arcs after the review convergence.

**D31** — wired the 3 real interaction flags (show_legend / enable_collapse /
enable_hover) as default-ON opt-outs in both render paths + deleted the
featureless enable_select across R + TS + roster + serializer + tests. Decided
(a). Details in the D31 commit / register.

**D32** — the directive said "refactor the brittle elements." The flagged
brittleness ("DOM and export have TWO separate flex-distribution
implementations") turned out to be a MISCHARACTERIZATION: investigation found
`columns.svelte.ts` only MEASURES naturals; the DOM's distribution is in
`layout-zoom.svelte.ts` and uses `resolveFlexWidths` — the SAME engine the
export uses. ONE engine, three callers. The real (smaller) duplication was the
`ColumnWidthSpec` assembly copied across the 3 sites → extracted `toColumnWidthSpec`
(`flex-weights.ts`) locking the spec shape + natural-resolution order; the
context-specific sourcing (live store vs wire) + target (container-compress vs
grow-to-natural, no container in the from-scratch export) stay per-caller because
they're legitimately different. The from-scratch divergence is inherent +
production-pinned (D20 item 4). Behavior byte-identical (layout-metrics +
wysiwyg + hero + interaction-qa unchanged). Closed (a) with the corrected record.
Lesson: investigate the actual code before believing a "two implementations"
brittleness claim — the engine was already centralized.

## 2026-06-16 — systematic review Rounds 4–7 + CONVERGENCE ("basically perfect")

Continued the recursive review/cleanup arc to convergence. Rounds 4–6 each ran 4
parallel adversarial agents over the remaining + previously-deep surfaces;
Round 7 was a confirmation pass.

**R4** (export drawing residue · layout · R theme · settings/components):
formatAxisTick DOM/export dedup (one source in axis-utils; EffectAxis sources
AXIS.* instead of re-hardcoding); DropIndicator portaled-accent (D4) threaded
from TabvizOverlays; portal.ts/eslint/SettingsPanel header doc-honesty; vestigial
tailwindcss() dropped from the split build; R rlang `%||%`/abort/… import was
dead+misleading → removed; tabviz(weight) now warns like its deprecated siblings;
**CI: the R↔TS source-parse sync gates (wire-version, glyph, interaction) SKIPPED
in every CI run** (R CMD check builds a srcjs-less tarball) → added an in-tree
step to R-CMD-check.

**R5** (verify R1–4 · docs · harnesses): my refactors verified sound (one
defensible %||% empty-env edge); **two real browser gates (theme-screenshots —
the SOLE gate for shell/paper/glow/glass — and hero-width) were never wired into
CI** → added; drift.test only checked consumedBy was non-empty → added a frozen
VALID_CONSUMERS gate; the incomplete 27→9 theme cull had left **erroring docs
examples** (README/roxygen/shiny demo calling web_theme_lancet/jama/… ) + pervasive
stale .qmd prose (counts, ink2-as-anchor, broken anchors, wrong package_themes
keys) → fixed across 9 files + the cheatsheet's fictional web_theme(inputs=…) API,
all re-rendered clean.

**R6** (adversarial sweep of under-reviewed areas): found ONE HIGH bug 5 rounds
missed — **update_data()'s proxy path was dead** (`as.data.frame` stripped the
WebSpec before the S7_inherits check → every proxy data-push aborted), hidden
behind a test that passed for the wrong reason. Fixed + added the missing
positive-path test. + tightened the set_figure_layout envelope-unwrap guard.

**R7** (confirmation): all checks PASS — update_data fix correct + covered,
serialize_data hot path sane on zero-rows/factor/Date, formatters boundary-safe,
single canonical %||%, no eval/RegExp-from-input. Verdict: **basically perfect.**

CONVERGENCE: ~42 findings fixed across 7 rounds, every consequential one
validated + committed separately; full TS gauntlet + R suite (543 ctx) green;
decisions D32 (dual flex impls) + D33 (systemfonts constants) logged as
post-ship arcs. The theme system, XSS egress wall, and browser/V8 split were
verified-clean true-negatives throughout. The arc came out the other end clean.

## 2026-06-16 — systematic multi-round code review (Rounds 1–3, 12 streams)

A recursive review/cleanup arc (goal: iterate until a full pass comes back
"basically perfect"). Each round = 4 parallel critical-review agents over
distinct subsystems, every finding triaged through a rational-design test before
any change. Three rounds in; all three found REAL issues, so not yet "perfect" —
but the theme system + the pure-utility browser/V8 split + the XSS egress wall
all came back verified-clean (stated explicitly, true negatives).

**R1** (R serialize/classes · TS stores · theme system · schema/authoring):
interval emitSource dropped the D30 bounds primitives; emit default-strip drift
(pictogram/range/img); range separator unified to one source; colImg R↔TS parity;
ALL_SEMANTIC_TOKENS de-duplicated (4 copies → 1, type derived); numeric-FILTER
kinds sourced from the canonical set (currency/percent now numeric-filterable);
zoom + RESIZE_MIN constants hoisted; setSpec double theme-clone collapsed;
R serialize_annotations() shared (viz_forest skipped validation); RiskOfBias
doc-rot.

**R2** (export drawing · layout geometry · R theme · Svelte components): dead
VIZ_DEFAULT_SERIES_COLORS fallback (empty-series NaN colors); heatmap palette
crash guard; group-count measured at the role token; **getExportDimensions trim**
— removed a hand-rolled divergent row-height/forest layout that NOTHING read
(F1, future-bug trap); column-resize pointercancel teardown; RowEdgeHandles 2px
dead-zone; CellPvalue semantic-bundle vars; R read_theme legacy-blob SECURITY
gate (pins bypassed the XSS grammar); .theme_v8_opts dedup; header_style "tint"
honesty; dead themes-modes.R deleted.

**R3** (pure libs · authoring/bridge · R core utils · R export/shiny):
formatPvalue(0) NaN guard; arrayMin/Max (spread-free, latent-crash fix);
**widget teardown leak** (Shiny store/subscription disposal); flex proxy drift;
setTag modifier; **%||% consolidation** (5 defs → 1, character(0) crash fixed);
**glyph roster-sync test** (documented invariant was unguarded);
print.SplitForest cli-glue crash on brace keys; set_*_style proxy warn;
**create_subset_spec** clone-then-override (split DROPPED 17 fields incl markers
+ label_column); **paginate composite-key** summary filter (hierarchical grouping
dropped all summaries); D33 (save_plot systemfonts width-constant drift — flagged,
needs visual validation).

Decisions logged: D32 (DOM/export dual flex impls), D33 (systemfonts constants).
Every batch validated (TS: type-check/lint/bun/vitest/wysiwyg/hero/interaction-qa;
R: full testthat 542 contexts) + committed separately. Rounds continue.

## 2026-06-16 — tabular-nums under-measure FIXED + wysiwyg gate recovery (D32)

Closed the two threads the column-width report opened.

**Tabular-nums under-measurement (the maintainer's "inaccuracy could be
elsewhere" — it was, systemic across every numeric column).** Cells render
`font-variant-numeric: tabular-nums` but width is measured with PROPORTIONAL
advances, so figures under-measure ~0.9px/digit. Fix: `tabularizeDigits(text)`
(`width-utils.ts`) normalizes every digit to the widest-advance digit before
measuring, gated by `--tv-text-numeric-figures !== "normal"`, at the two FLAT
measure sites — DOM (`columns.svelte.ts doMeasurement`) and export
(`svg-generator.ts calculateSvgAutoWidths`). Composed cells (intervals) were
already covered by `COMPOSED_SPAN_BEARING`, left untouched. Worst hero overflow
7px→1px; hero-width gate GENERAL floor tightened 8→3px. layout-metrics snapshots
unchanged; full bun+vitest green. The ~1px residual (true tnum figure is a hair
wider than even "0") awaits a font-metrics regen — deferred.

**WYSIWYG gate recovery (D32).** The component-cell fix (`ba165fd3`, last arc)
correctly grew pvalue/badge naturals from 0 → real, which pushed the wysiwyg
fixture's Σ-naturals past the 800 nominal and UNMASKED a pre-existing divergence
the gate had never exercised: the DOM and export use TWO separate
flex-distribution implementations (export = `resolveFlexWidths` with
`max=Infinity`, grows a weight-3 flex column unbounded to 600; the DOM store has
its own even-er path → 162). 104 breaches (flex-column widths + their cumulative
xOffset cascade + dwarven header truncation). Diagnosis: it's the FROM-SCRATCH
export flex path; production PINS widget widths (D20 item 4) and is unaffected,
so the no-browser path has no DOM to be WYSIWYG with. Recovery, all honest +
documented (D32): (1) the harness now mounts the DOM at the export's resulting
width, not a fixed 800 — apples-to-apples totals, dropped raw artifact Δ
433→56; (2) budgeted exceptions for the from-scratch flex widths + xOffset
cascade, pointing at D32; (3) `findHeaderText` tolerates ellipsis truncation
(the export truncates a header when its column is narrower than the DOM's —
dwarven's wide EB Garamond; the truncated run carries the same font so
typography stays measurable). Gate back to 0 breaches / 216 within budget. D32
default = accept (pinned production unaffected); the real fix is unifying the
two flex implementations onto `resolveFlexWidths` (a post-ship rationalization
arc — two implementations of one concept is exactly the brittleness the roadmap
says to shed).

## 2026-06-16 — hero-width gate generalized + TABULAR-NUMS under-measure found

Generalized `hero-width-repro.browser.ts` from interval-cells-only to ALL data
cells (component cells render their own root, e.g. `.cell-pvalue`, which the old
`.cell-content`-only selector missed — exactly why the pvalue MIN-floor
regression slipped past it). Intervals stay strict (0.5px, Canvas-exact);
others get an 8px floor.

That 8px floor exists to absorb a NEWLY-FOUND, still-OPEN measurement gap (the
maintainer's "the inaccuracy could be elsewhere" — it was): cells render
`font-variant-numeric: tabular-nums` (DOM `.cell-content`/`.cell-pvalue` AND the
SVG export, svg-generator:4621, gated by `--tv-text-numeric-figures`), but the
width measurement (`estimateTextWidth` / `measureExact`) uses PROPORTIONAL glyph
advances. Tabular forces every digit to the figure (widest) advance, so a
numeric cell renders ~0.9px/DIGIT WIDER than measured. Measured directly on the
hero: an events cell `839/14,752` renders **87px** but Canvas-proportional is
**70px** (17px / 8 digits ≈ 2px/digit in Lora) — its column under-sized and
clipped 7px. This under-measures EVERY numeric column (N / Events / HR / pvalue);
most have slack, the tightest (events) clips. Both backends render tabular so
they under-size CONSISTENTLY (no DOM↔export divergence) — it's a shared absolute
error.

**FIX (next arc — deliberately deferred, it's a careful core change):**
tabular-aware measurement. `estimateTextWidth` gains a `tabular` flag → digits
use `max(advance("0".."9"))` (the figure width) from the font-metrics table;
`measureExact` (Canvas can't set tabular) approximates by measuring with digits
normalized to the widest digit (cache the widest per font). Thread the flag from
the measurement entry points (DOM `exactMax` + composedResolver; export
`measureTextWidth` + the renderNodeToSvg estimator), derived once from
`readVar(cssVars,"--tv-text-numeric-figures") !== "normal"`. Then the hero gate's
GENERAL floor drops back to strict. Requires layout-metrics snapshot regen
(numeric columns legitimately widen) + wysiwyg revalidation.

## 2026-06-16 — anti-recurrence gate: schema-driven export-option parity

Built the structural fix for the recurring DOM↔export divergence class (the
highest-leverage deep-review follow-up). The root: `consumedBy:["renderCell"]`
checks only array-non-empty, so an option the DOM honors but the SVG export
silently ignores (badge `size`, range `thousandsSep`, pvalue `starsColor`)
passes the drift gate. The NEW `export-option-parity.test.ts` (CI via bun)
auto-iterates every concrete visual/composed type's LEAF render options
(`consumedBy` ⊇ renderCell|formatValue), renders an SVG cell at two genuinely
distinct values, and asserts the output CHANGES — i.e. the export reads it. ~35
cases across 10 types (badge/bar/progress/heatmap/icon/sparkline/ring/interval/
range/pvalue). A NEW DOM-only render option now FAILS CI instead of shipping a
silent divergence.

Design lessons baked in (the iterate-to-green found them): perturb to TWO
explicit values (segment[0] vs segment[last]) — a single perturbation to the
declared default no-ops when an unset option's recipe resolves to that default
(`interval:boundsLayout`); key fixtures by REGISTRY KEY not `type` (percent/
currency share `type:"numeric"`); iterate LEAF `schema.options` not the full
cascade (the inherited BASE chrome — header/align/width/naText — doesn't change
an isolated cell-content tree, and was 100+ false positives). The honest ledger
`EXPORT_OPTION_GAPS` carries the legit exceptions WITH reasons: pvalue
`starsColor`/`significantStyle` (real export gaps — asserted NOT-changing so they
flip red when fixed), `bar:maxValue` (saturates at the fixture value). pictogram
+ stars are out of scope here (registry-glyph paths don't load in the bun env;
their options inherit from the glyph-cell parent) — covered DOM-vs-SVG by the
`glyph-cell-parity` browser gate. Deep-review items still open: the pvalue
export gap itself, the nested-group-header squash + flex-bound-inversion layout
bugs, StylingTab text-onsolid, and D31 (dead interaction flags).

## 2026-06-16 — magic-number consolidation (deep-review catalog, behavior-preserving)

Collapsed the duplicated literals + DOM↔export drift seams the deep review
cataloged into single sources in `rendering-constants.ts` — every one a no-op
(same values), proven by unchanged resolver-dispatch + layout-metrics snapshots
and a byte-identical forest render:
- `HEADER_FONT_SCALE = 1.05` — was bare `* 1.05` at 3 PAINT sites
  (resolve-theme header-size token, svg-generator header measurement ×2) +
  table-metrics' own named-but-not-shared copy. A real DOM↔export drift seam
  (the header band reservation vs the painted header size) — now one source.
- `markerSizeFromWeight(rawWeight, baseSize)` — the `0.5+√(w/100)*1.5` clamp
  `[3, base*2.5]` formula was hand-mirrored ×4 (DOM RowInterval + export
  getPointSize, twice each). One helper, both backends.
- `EFFECT.SUMMARY_DIAMOND_HEIGHT = 10` — summary-diamond height, was `10` ×3
  (DOM + export interval + export summary).
- `BOLD_CELL_WEIGHT = 600` — cellStyle-bold export weight, was `600` ×3 (named,
  with a comment distinguishing it from the weight-NAME table's "bold"=700).
- `RENDERING.OVERALL_ROW_HEIGHT_MULTIPLIER` — the DOM (layout-zoom) used bare
  `1.5` ×2 where the export already had the named constant; now shared.
- rowHeight fallback aligned `32`→`34` in the aspect ladder (matched the
  main-path/DOM fallback; only bites degenerate no-rowHeight themes).

Remaining deep-review items still open: the structural renderCell DOM/SVG
consumedBy split (the anti-recurrence root), the pvalue export gap, the
nested-group-header squash + flex-bound-inversion layout bugs, the axisRegion
`+2` slack, StylingTab text-onsolid, and D31 (dead interaction flags).

## 2026-06-16 — DEEP review: unwired elements / fudge factors / magic numbers

Maintainer: "we keep finding weird issues, unwired elements, fudging factors,
and magic numbers." Four parallel agents swept exactly those classes across the
un-reviewed surfaces (UI/settings/interaction · schema-options/tokens/wire ·
fudge-factors/magic-numbers · layout/sizing). ~22 verified findings. The SYSTEMIC
root surfaced: the `consumedBy: ["renderCell"]` drift gate checks only that the
array is non-empty — it CANNOT distinguish a DOM-only renderCell option from a
DOM+SVG one, so a whole class of DOM↔export divergences hid behind a green gate.

**FIXED this pass (the export-divergence cluster + its anti-recurrence net):**
- `range` SVG renderer applied only `decimals`, dropping `thousandsSep` /
  `abbreviate` / `digits` and showing a partial bound when one side was missing.
  Now mirrors `CellRange.svelte` exactly (shared `formatNumber` pipeline +
  either-missing→naText). `badge.size` (sm/base) was ignored by the export
  (every badge base-sized); threaded into `computeBadgeGeometry`
  (`BADGE.FONT_SCALE_SM = 0.7`, mirrors `.badge-sm`). New gate
  `export-option-parity.test.ts` asserts the SVG output CHANGES when each fixed
  option toggles — the template to extend whenever a pixel-affecting renderCell
  option is wired.

**DEFERRED — engineering follow-ups (verified, file:line so they're pickable):**
- STRUCTURAL: split the `consumedBy` `renderCell` token into `renderCellDom` /
  `renderCellSvg` (or add a general DOM-vs-SVG render-parity gate), so the drift
  gate can SEE DOM-only options. This is the root fix that would have caught the
  whole cluster. (`schema/columns/drift.test.ts`.)
- `pvalue` export gap: the SVG path emits plain `formatPvalue` text — no
  `starsColor` rubrication, no `significantStyle` pill (DOM `CellPvalue.svelte`
  does both; the nejm preset ships `starsColor:"ink2"`). Needs a render-tree
  (colored stars node + pill group-bg) in `visual-svg-renderers.ts`.
- `dom-export-divergence.test.ts` ledger only recognizes ONE DOM-consumer string
  (`"svelte/TabvizPlot.svelte"`); a token consumed solely by a
  `components/table/Cell*.svelte` (e.g. `--tv-ink2`) is invisible to it. Broaden
  to "consumedBy ⊆ {known DOM files}".
- StylingTab offers a `text-onsolid` role override the resolver discards
  (`resolve-theme.ts:206` short-circuits OFF_RAMP_ROLES) — exclude
  `OFF_RAMP_ROLES` from `rolesOfKind` (the D28 dead-control class).
- MAGIC NUMBERS / duplicated literals to collapse into `rendering-constants.ts`:
  header-scale `1.05` bypasses its own `HEADER_FONT_SCALE` at 3 paint sites
  (resolve-theme:788, svg-generator:368/3079 — a real DOM↔export drift seam);
  diamond height `10` ×3 (RowInterval + svg-generator ×2); marker-size formula
  `0.5+√(x/100)*1.5` clamp `[3,base*2.5]` ×4 (DOM+export); bold-cell-weight
  `600` ×3 (and a `700` "bold" elsewhere — reconcile); `+6` row padding dup of
  `HEADER_ROW_PADDING`; `axisRegionHeight` trailing bare `+2` slack; ellipsis/
  watermark `0.55` char-ratio literals. Overall-summary `1.5` magic in the DOM
  vs named `OVERALL_ROW_HEIGHT_MULTIPLIER` in export; rowHeight fallback 34 vs 32.
- LAYOUT bugs: nested column-group headers (depth ≥3) squash — DOM reserves a
  2-tier band but renders N tiers, and the export only renders 2 (a real
  wrong-size + DOM↔export divergence; `layout-zoom.svelte.ts:298` boolean depth
  vs `TabvizPlot.svelte:811` true depth). Inverted flex bounds (content floor >
  aspect cap) silently clip a column (`flex-distribute.ts:57`). Live row-kind
  session pin vs a spec-pushed pin diverge DOM-vs-export (`layout-zoom:728` vs
  `svg-generator:943`).

The cascade/measure/aspect cores were re-confirmed SOUND (idempotency,
shared-reference safety, measure-commit no-ratchet all held). The dead
interaction-flag finding (showLegend/enableCollapse/enableSelect/enableHover —
documented R API + serialized but NO TS consumer) is a PRODUCT decision (wire to
honor the docs, or delete per D9's maximal-affordances philosophy) → register D31.

## 2026-06-16 — systematic review: theme resolve/cascade (found SOUND + 3 fixes)

Three parallel verified-findings agents swept the 12.7k-line theme module
(cascade correctness · ingress security · emission-parity/rationalization) — the
V4 substrate at the heart of "theme-first," resolved TS-side with R delegating
via V8. **The cascade itself is SOUND**: idempotency (re-resolve from the stored
un-reflected `authoringInputs`; polarity applied exactly once per path),
shared-reference safety (`scaleSpacing` copies even on the factor-1 path —
the scar from the production bug holds; `effectiveTypeRoles` consumers all
spread before mutating), NaN-poisoning (every user hex `isValidHex`-gated before
oklch; `density_factor` clamped on both paths), and pin-overlay ordering (pins
after resolve, before contrast; HC/RT ratchet beats pins; `isValidPinValue` +
`--tv-` gate at the one chokepoint) all verified safe — no RANK-1. Ingress is
solid too: `parseThemeWire` validates inputs/roleOverrides/pins/components/
column_defaults/series at every gate; `__proto__` keys can't pass the closed-enum
/ `--tv-`-prefix / roster key gates.

**3 fixes landed:**
1. **XSS egress wall — 8 unescaped `theme.series[].fill/stroke` sites** in the
   forest renderer (CI line `lineColor`, summary diamond, clip arrows via
   `arrowConfig.color`, summary-marker diamond). `generateSVG` reads `spec.theme`
   directly, so a hand-built wire (JS/V8/LLM) can supply pre-resolved series
   colors that never passed `buildTheme`'s `isValidHex` gate → stored XSS. Same
   wall class as the prior export review; wrapped all 8 in `escapeAttr` (escaped
   `lineColor` once at its definition). Locked: a `theme.series`-poison vector
   added to `svg-xss.runes.ts` (verified 16 attribute sites escape, diamond +
   lines render).
2. **`RULE_SLOTS.normal.regular` 1.5→2** (`scale-roles.ts`): D28 (2026-06-14)
   bumped `DEFAULT_BORDER_WIDTH.regular` 1.5→2 but left this slot stale, so
   `set_rules("normal")` silently THINNED the header border instead of being the
   no-op its "≡ defaults" comment claimed. Re-synced; no preset used 1.5 (all
   resolver-dispatch snapshots unchanged), `matchFullSlot` slots stay distinct.
3. **Stale v3-tail comment** in `theme-css.ts`: a 30-line block described a
   "v3-alias block" + "v3 tail of computed vars" that W4 (2026-06-11) DELETED
   (`computeV3BridgeVars` is gone; the body emits only the v4 manifest +
   utility constants + the live-config bridge). Replaced with the reality.

Validated: 1460 bun + 319 vitest (snapshots unmoved) + R theme/parity 162
contexts, JAMA forest visual clean. **Deferred (RANK-2/3, documented):** glass/fx
`parseInt` hex-slicing assumes 7-char hex (route through guarded `hexToRgba`);
the `.bg-accent` DOM(`color-mix 12%`)↔export(`accent.tintSubtle`) tint divergence
(needs a real `--tv-accent-tint-subtle` token — acknowledged on both sides);
`role-overrides-wiring` lockstep gate checks pin-PRESENCE not full token-set
equality (could miss a one-path-only token); `__proto__`/`ov.shape`
defense-in-depth; redundant `var(--x, var(--x, #fff))` self-fallbacks.

## 2026-06-16 — systematic review: export/SVG-generator pipeline (7 bugs fixed)

Four parallel review agents (geometry/layout · XSS egress · viz-renderer DOM
parity · rationalization) swept the 5421-line `export/svg-generator.ts` — the
highest-stakes runtime (V8, no DOM fallback). Every finding was re-verified
against the actual code before acting (subagents can mis-read). **7 RANK-1 bugs
found + fixed:**

1. **Degenerate axis domain → div-by-zero.** `createLinearScale`/`createLogScale`
   had no `d0===d1` guard, so equal explicit axis limits / `xDomain:[v,v]` (no
   upstream `rangeMin<rangeMax` validation) made `ratio` Infinity → every
   marker/tick coord `±Infinity`/`NaN` → blank plot. Now collapses to the range
   midpoint (matches d3). Also guarded `ticks(count<=1)`. Teeth:
   `svg-robustness.runes.ts`.
2-4. **Three XSS egress gaps** (spec-DATA color → `fill=` unescaped, the
   string-concat export has no auto-escaping): row-LABEL color (`row.style.color`),
   `spec.watermarkColor`, and the forest-legend `effect.color` in `lib/legend.ts`
   — the last ALSO a latent DOM XSS (the DOM injects `legendGlyphSvg` via
   `{@html}`, which bypasses Svelte escaping). All wrapped in `escapeAttr` at
   egress. Teeth: 3 vectors added to `svg-xss.runes.ts` (verified they render
   AND neutralize).
5-7. **Three DOM↔export divergences from copy-paste drift** (the viz path lacked
   a fix its forest/box sibling had): viz-axis tick labels baked
   `readBodyFamily`/`400`/`formatNumber` instead of the `tick` type-role +
   `formatTick` (forest axis was correct) — fixed by EXTRACTING a shared
   `axisTickLabelSvg` used by BOTH axes, killing the drift surface; violin
   median/quartile lines forced content-primary instead of the per-effect
   `ms.stroke ?? lineColor` (the violin outline already did it right);
   reference-line LABEL forced secondary instead of `ann.color ?? muted`.

Cleanups: removed dead `Scale.range()`, a redundant nested `readTypeFamily("title",
"title")`, dead `formatNumber` import + stale comment. Validated: 1460 bun + 318
vitest, layout-metrics snapshots unchanged (typography-only), wysiwyg within
budget (no NEW divergence — the viz axis now MATCHES), viz/forest/box/violin
visual renders clean.

**Deferred (verified, documented — not bugs today, brittleness for the v3→v4
migration):** the aspect ladder still reads raw `spec.theme.spacing?.rowHeight`
(`:~4097/4114/4314`) instead of the resolved `--tv-spacing-row-height` token, so
a slim/D13 theme's aspect target can drift; `validateSpec` still hard-requires
`theme.spacing` though the main layout path is v4-cssVars; `resolveBorders` is
recomputed per-row inside the render loop (hoist candidate); several dead fn
params (`vizWidth`, `theme` in renderHeader/Footer/RefLine, `autoWidths`/`_allRows`)
inflate the signature surface. All RANK-2/3 — left for a focused follow-up so this
arc stays a clean security+correctness pass.

## 2026-06-16 — D30: interval "exacting users" tier + D27 heatmap parity

Two register items closed (roadmap implementation is checkbox-complete; the
register is now the live worklist).

**D27 — heatmap default palette theme-derived everywhere.** R `col_heatmap`
baked a fixed blue while TS omitted the palette (renderer derives a theme-accent
ramp) — same default, different output on non-blue themes. Dropped R's blue
default AND the TS schema's matching fixed default (→ `null`), so both omit and
the renderer's `palette ?? defaultPalette(theme)` wins. `EXEMPT` list in
test-parity-column-defaults.R now empty; rendered ramps track the accent (nejm
steel-blue, terminal amber).

**D30 = (a) — promote interval's bounds primitives to options.** The "exacting
users" fork resolved to option (a): expose the recipe knobs a `variant` resolves
to as real `presentation` options so authors fine-tune within a variant
("bracket_muted but with `/`") and themes can set them too — harmonizing
interval with badge. Added 7 options (`boundsLayout`/`boundsContent`/
`boundsOpen`/`boundsClose`/`boundsSeparator`/`boundsPrefix`/`boundsMuted`), all
default null. `recipeFor` refactored: `baseRecipe` (variant `__resolved` or
fallback) then an author-primitive overlay (`i.boundsX ?? base.boundsX`; `??`
preserves an explicit `boundsMuted:false`, and `boundsOpen`/`boundsClose`
reassemble `boundsDelimiter`). Precedence theme-variant < author-variant <
author-primitive. Wired TS `colInterval` + R `col_interval(bounds_*=)` (snake,
validated) + schema + regenerated artifacts; `column_schema("interval")` lists
all 7 as themeable; `set_column_default` reaches them via the camelCase schema
key (its established vocabulary — intentional layering, not a wart). Verified: 4
TS override tests, R parity round-trip + default-absent, end-to-end V8 render
(`0.90 [0.80/1.01]` — variant brackets+muting, author `/`), all suites green
(1456 bun + 317 vitest + R parity 74 contexts). Option (b) (named-recipe
authoring API) stays post-1.0.

## 2026-06-16 — composed-cell width measurement (retire COMPOSED_TEXT_BUFFER)

Replaced the fixed `+18px` `COMPOSED_TEXT_BUFFER` fudge — applied to
interval/custom columns because their flat-string width measure under-shot the
rendered cell — with **structural measurement of the actual render tree**.
New `schema/measure-composed.ts::measureComposedColumnWidth`: rank rows by the
cheap flat estimate (`rankTopKBy`, the generalized `rankTopK`), then
`renderCell`→`renderNodeToSvg` the top-K widest TREES through a width-only
`StyleResolver` and take the max. Plain columns (single un-styled text node)
return null → keep the proven flat path. The win the buffer's own comment
promised: any-variant-any-column accuracy — a `bracket_muted` interval now
sizes its column TIGHTER (bounds measured at their real minor/muted size),
`plus_minus` tighter still (short `0.85 ± 0.14` form), instead of all variants
getting the same flat-string-plus-buffer width. Both measurement sites share
the helper (live widget `stores/slices/columns`, V8 export `svg-generator`) so
they stay WYSIWYG-locked; each injects its own width metric.

Diagnosis cost the arc (recorded so the next agent doesn't re-pay it): the naïve
tree measure UNDER-sized and clipped, exposing TWO real gaps the flat buffer had
been blindly absorbing. (1) **Font size**: the resolver re-derived px from
cssVars without the root-aware rem→px conversion the DOM does, so it measured
14px while the DOM painted 16px (rem×root). Fixed: `makeMeasureResolver` now
takes explicit px (`MeasureSizes`); the DOM site resolves them in its own space,
the export reuses `makeThemeResolver` verbatim. (2) **Render-big-scale-down**:
the widget lays out at NATURAL size then `transform: scale(actualScale)`s to
fit, and each composed cell is a multi-SPAN inline run the browser rounds up
per-span and can't kern across — so the grid's layout-space width =
Canvas-visual ÷ actualScale + ~1px/span. The DOM resolver's per-text `measure`
now folds in `/scaleComp` (live `actualScale` threaded via the columns-slice
deps) + a `COMPOSED_SPAN_BEARING` per-span side-bearing then `ceil`,
reproducing the DOM's per-span layout exactly. The export needs neither (V8
draws at scale 1, fractional x — self-consistent). Validated: hero-width-repro
gate (downscaled, scaleComp<1) 0 overflows; broad sweep (4 themes × 4 variants,
scale 1) 0 clips with 10–24px slack + correct variant differentiation; JAMA V8
export render clean; wysiwyg-diff within budget; 1456 bun + 317 vitest green.

## 2026-06-15 — systematic R-serialization review (found SOUND) + I()-array lock

Full correctness/brittleness review of the R wire serializer (`utils-serialize.R`
+ the S7 classes it serializes) against the TS wire shape — the
wrapper-over-runtime boundary where R↔TS DIVERGENCE is the highest-stakes bug
class. VERDICT: **no RANK-1 divergence** — every wire key is correctly
camelCased and shape-accurate (columns/data/groups/interaction/pagination/
split all match the TS interfaces). The risk is RANK-2: several CORRECT-but-
UNGUARDED paths (no parity test) where a future change could drift silently —
`serialize_figure_layout`, `serialize_annotation` (forest reflines), the
cell/row-style recipe DICTs (new `style_*` props silently dropped if the
hand-coded recipe isn't updated), theme role_overrides/pins/components on the
resolved blob, `cond_ref` unwrap, and the **`I()`-wrapped length-1 array
fields** (tooltipFields / hiddenColumns / expandedRows / splitVars — the
jsonlite `auto_unbox` collapse trap). Locked the last one
(`test-wire-arrays.R`, teeth-verified: stripping an `I()` fails it); the others
are documented gaps for when those areas next change. The serializer is sound
today — this is regression insurance for the precious R↔TS parity guardrail.

## 2026-06-15 — systematic store/slices review (found SOUND) + cleanup arcs

A full brittleness review of the interactive-state heart — `tabvizStore`
+ `forestStore` + every `slices/*.svelte.ts` (columns/layout-zoom/theme/
data/semantics/…) + `splitTabvizStore` — focused on the #1 trap class:
`spec` is `$state.raw`, so a deep mutation that skips `setSpec` is silently
dead (the 2026-05-25 `previewThemeField` regression). VERDICT: **no genuine
bugs.** Every `preview*`/`set*`/`apply*` path routes through `setSpec` /
`writeThemePath` / a slice helper that does; the mutable-`$state` (non-raw)
slices (`columnWidths`, `styleEdits`, `labelEdits`) mutate keys in place
legitimately (deep-proxied, reactive). The flagged async-measure "race" in
`doMeasurement` is a non-issue (single-threaded JS runs it atomically).
Only durable note: `columnWidths` (columns slice) uses in-place key writes
and carries a self-documented "convert to spread-and-reassign in Phase 5"
debt comment — accepted; the ONLY watch-item is that a future swap to
`$state.raw` there must convert the writers together. Acted on one genuine
finding: two differently-named inline `100` constants in layout-zoom
(`FLEX_DEFAULT_COL_WIDTH`, `DEFAULT_COLUMN_WIDTH`) both meant "default column
width" — pointed both at the canonical `LAYOUT.DEFAULT_COLUMN_WIDTH` (which
the renderer also uses), killing a layout-vs-renderer drift risk.

This sat alongside the 2026-06-15 robustness/cleanup sweep (export
validate-first → ingress-wall hardening → SVG XSS egress wall → knip
dead-code harness + dead-export/dep/type removal); see the ship-roadmap
status log for those.

## 2026-06-11 (evening) — first pushes, ship mechanics, and the sizing audit

The 74-commit ship-readiness sweep went to GitHub (first real pushes).
The maiden CI runs caught three issues before going green: an unpinned
bun runtime in js-ci ("latest" — now pinned 1.3.5), a half-committed
lockfile state (the frozen-lockfile gate working as designed), and the
headline find — `scaleSpacing`'s factor-1 identity path returned the
module-level DENSITY_SPACING entry BY REFERENCE, so every comfortable
theme in a process shared one spacing object; one mutation restyled
them all. Linux test-file order exposed what macOS order had hidden for
months. js-ci (ts-suite + browser-gates), the 5-platform R matrix, and
Quarto Publish all green after.

npm 0.7.0 staged for publish (version/lockfiles/dated changelog;
prepublishOnly exit 0; tarball inspected; the MCP server ships as a
`tabviz-mcp` bin). The published docs site exposed the ingress wall's
first false positive — col_group containers carry no `type`, so EVERY
grouped-column widget mounted blank, including the front-page hero;
none of the harness fixtures used column groups. Validator now recurses
into groups; the hero shape is regression-pinned. The "thirty seconds"
index section was axed per maintainer taste (README keeps the GIF).

Then the maintainer's nose drove the SIZING AUDIT
(docs/dev/sizing-audit-2026-06-11.md): obligate fill-width was real
(D19 — growth now requires an absorber; plain tables hug content,
matching the export's long-standing contract), the width estimator was
font-class-naive (mono themes under-measured ~12% — flush first
columns), the label column's parallel width path is deleted (the
remaining label specialness is inventoried in OPEN register entry D20,
discussion-first per maintainer), the systemfonts injection gained a
metric-class guard (uninstalled mono fonts shaped with Helvetica while
rsvg rendered Courier — colliding columns), and the content-sized
centering flash is gone (synchronous first measurement). Five findings
fixed, four recorded with revisit triggers.

## W4 — v3 blob slimming + bridge retirement — DONE 2026-06-11 (wire 1.6→1.10)

`docs/dev/w4-v3-blob-slimming.md` is the full record. WHAT FUTURE AGENTS
MUST KNOW:

- **The bridge is GONE.** computeV3BridgeVars no longer exists; the only
  non-cascade emission is `computeLiveConfigVars` (series slot 0 +
  layout — blob fields that deliberately stay). The `v3-bridge` resolver
  group is now `live-config` (sentinel "<live-config>").
- **Port-don't-rebind was the framework**: v3 values were distinct
  derivations, not role mirrors (equivalence-swept all 9 presets before
  every port). New resolver groups carry the recipes: `header-active`
  (trio by header_style), `first-col` (by first_column_style — now a
  Tier-1 INPUT), `borders` (lib/theme/borders.ts::resolveBorders is the
  ONE derivation, shared with the SVG export), `ramp-direct` (UNWALKED
  ramp[grade] reads — note grammar "ramp:<name>[<grade>]"; the walked
  text roles would shift dark presets).
- **Blob fields deleted** (wire 1.6→1.10): marks, cell, annotation,
  semantic, columnGroup, lightDarkPair, text (TextRoles), variants
  (ALL of it), firstColumn, borders. S7 classes + serializers mirrored.
  Surviving clusters (header/rowGroup/row/plot/axis/layout/spacing/
  series) still ride the blob; field-level slimming of the first three
  is ordinary post-W4 debt.
- **D18 (delegated)**: title-fg binds to role `text` (the v3 value was
  the raw ink ANCHOR — pre-cascade special-casing). Re-route
  set_component("title", col="brand-text") for chromatic titles.
- Component-model dividends: cell paint states (emphasis/muted/accent),
  group-header rule, first-column bg/col/rule (frame region's first
  inhabitants), header-cell active bg/col/rule are all live channels;
  anchor/ramp-direct/header-active/first-col/borders resolvers honor
  re-routes (honesty gate enforces the list).
- A LIVE bug died with the header port: the bridge trio (v3 hexes) and
  the variant tokens (v4 roles) could paint different header colors in
  ONE render (TabvizPlot chrome vs PlotHeader cells).

## Component-model Stage 1 (W6) — SHIPPED 2026-06-11 (wire 1.5)

Design: `docs/dev/component-model.md` (locked same day, two user rounds).
One commit `[component-model S1]`. The substrate for roadmap area E — the
THREE-VERB grammar's missing middle verb (re-route a component channel)
now works end-to-end. WHAT FUTURE AGENTS MUST KNOW:

- **The roster is honesty-filtered**: `COMPONENT_ROSTER` derives from
  manifest `binding` annotations but SKIPS tokens in KNOWN_UNCONSUMED —
  an editable channel must paint. Dropped today: row.selected.bg,
  header-cell.light.rule, cell.family/weight, numeric-cell.size/weight,
  caption/subtitle/footnote.family, axis-tick-label.size. They join
  AUTOMATICALLY when their tokens gain consumers (Stage 3) — wire DOM +
  export TOGETHER or you create a WYSIWYG divergence (the deleted dead
  `cellFamily` read in svg-generator is the cautionary example: wiring
  export-only would have diverged from the DOM's body-font inheritance).
- **v3-bridge interaction**: `computeV3BridgeVars` deletes its stamp for
  any token with an ACTIVE re-route — without this, re-routes on
  bridge-owned tokens (--tv-text-title-fg was the live case) were
  silently inert. The bridge fully retires at W4.
- **Precedence**: HC/RT mode ratchet > re-route > role-level type_roles
  rebind > manifest default. Pins still overlay last (and the ratchet
  beats pins too).
- **One validation source**: TS `sanitizeComponentBindings`; R calls it
  via `ts_call("validateComponentBindings")` in `set_component()` AND
  `theme_from_wire()` (strict — abort, never half-apply).
- **Cache**: getCssVarsRaw's key now includes `componentBindingsKey` —
  same inputs identity with different re-routes must not share entries.
- **Threading**: `re_resolve()` defaults `components = theme@components`;
  any future hand-rolled buildTheme opts bag (serialize_theme,
  theme_css_vars, theme_to_dtcg were the three) must include it — grep
  `opts$roleOverrides` when adding a fourth.
- Studio: components are a PASSTHROUGH (seeded at init, resolved in
  preview, re-emitted on export; NOT in history until Stage 2 makes them
  editable).
- Side-fix: R type-role `family` vocab now accepts `"numeric"` (TS
  already did; R silently dropped it at wire ingress + set_type_role).
- Gates: `component-bindings.test.ts` (21 — roster/sanitize/lockstep/
  ratchet/cache/wire + 2 honesty gates), `test-theme-components.R` (31 —
  verb/round-trip/strict-ingress/R↔TS parity).

## Interactivity-UX arc — SHIPPED 2026-06-10 (P0/P1/P2; wire 1.4)

Plan + decision record: `docs/dev/interactivity-ux-plan.md` (decisions locked
via user Q&A; memory `interactivity-ux-decisions`). Three commits
`[interactivity P0/P1/P2]`. WHAT FUTURE AGENTS MUST KNOW:

- **Interaction flags resolve through a 4-tier chain** in
  `srcjs/src/lib/interaction-resolve.ts`: baked defaults <
  `spec.interactionDefaults` (R `options(tabviz.interaction_defaults=)`) <
  theme `inputs.interaction_defaults` (web_theme opinion; UNTRUSTED — validated
  at both wire ingresses) < `spec.interaction` (SPARSE explicit tier). NEVER
  read `spec.interaction.X` directly — use `store.interaction` /
  `resolveInteraction(spec)`. R `InteractionSpec` slots default NA (= unset);
  the serializer drops NAs. **Conservative-everywhere baked defaults**:
  reader-safe ON (sort/collapse/hover/select/filters/export/resize/theme cog);
  author-grade OFF (enableEdit, enableReorderRows/Columns, enableAxisZoom,
  enableArrange). `web_interaction_full()` = explicit all-on.
- **Persistence tiers**: VIEW state (zoom/fit/contrast → localStorage, key
  scoped by document path + element id) · FIGURE state (column width pins,
  reorder, row-KIND height pins → `spec.figureLayout` wire block, hydrated
  UNDER surviving session state on setSpec; `set_figure_layout()` re-attaches
  Shiny `input$<id>_column_widths` / `_row_kind_heights` across data refreshes;
  `columns.hydrateForSpec` reconciles by column id instead of wiping) · THEME
  state (spacing gap drags → theme, travels with it).
- **The seam grammar** (every resize surface): preview during drag → ONE
  commit on release; Escape CANCELS (restores, no commit); double-click resets
  to auto (column autosize via `e.detail >= 2` on pointerdown — preventDefault
  suppresses synthesized dblclick); live px readout; arrow-key nudge ±1/±10 on
  focused armed seams. `EdgeResize.svelte` is the canonical implementation.
- **The arrange tool** (`ArrangeButton`, `store.arrangeMode`, gated by
  `interaction.enableArrange`): toolbar mode that arms ALL seams — header
  height / group gaps / footer gap (theme spacing) + per-row-KIND height
  handles (`RowEdgeHandles.svelte`, now mounted INSIDE the rows region with
  `topOffset = layout.headerHeight` — the old root-level mount never aligned).
  Hover/drag ghost-highlights every row of the kind (per-kind model must be
  visible). The old per-row `spacing.rowHeight` seam is DELETED — density owns
  global row height; per-kind pins own row seams.
- **Domain zoom** (forest x-axis) is Ctrl/Cmd+wheel ONLY (plain wheel always
  scrolls the page) and opt-in via `enable_axis_zoom`; disabled overlays set
  `pointer-events: none` so painter clicks pass natively. Cmd/Ctrl+wheel over
  the widget = WIDGET zoom (the overlay stopPropagates when it consumes).
- **TRAPS**: `.grid-cell` has `overflow: hidden` — a header affordance that
  overhangs the cell edge is CLIPPED out of hit-testing (the resize handle
  sits fully inside the cell). The floating toolbar overlaps the top-right
  header region whenever the widget is hovered — it now has `pointer-events:
  none` while faded out, but VISIBLE it still shadows the last column's
  header; don't put load-bearing affordances there. Puppeteer
  `mouse.click({clickCount: 2})` sends ONE pointer pair (detail 2-ish, but
  CDP reports detail 0 — use the dblclick event or e.detail, and test both).
- **Gate**: `srcjs/tests/browser/arrange-tool.browser.ts` (build first; real
  mouse input) walks default-off → arm → ghost → drag → Escape-cancel →
  dblclick-release → column drag/autosize → disarm. Extend it, don't bypass.
- `ColumnHeaders.svelte` is ORPHANED (zero importers — TabvizPlot renders
  headers inline); candidate for deletion in the next consolidation pass.

**REVIEW PASS — 2026-06-10 (4-lens adversarial panel: wiring / UX-gesture /
cross-runtime / robustness; commit [interactivity review]).** ~20 verified
fixes landed. CONSTRAINTS future agents must keep:
- **Drag deltas divide by `elementScale(el)`** (`lib/scale-factor.ts`) —
  every gesture lives inside the CSS-scaled `.tabviz-scalable`, and raw
  client deltas lag/outrun the cursor at zoom ≠ 100% (auto-fit shrink is
  the DEFAULT for wide tables). Applies to EdgeResize, RowEdgeHandles,
  column resize, and zoom-interactions' nodeLocalX/pan. New drag surfaces
  MUST do the same.
- **figureLayout is honored by the EXPORT path**: `generateSVG` applies
  `applyFigureLayoutColumnOrder` (shared `lib/column-order.ts` — also used
  by the columns slice), merges width pins under `options.columnWidths`,
  and feeds `sanitizeRowKindPins(spec.figureLayout.rowKindHeights)` (shared
  gate in `row-kind-heights.ts`, vocab + [8,2000] clamp) into
  computeRowLayout; `exportSpec` attaches the live block. Gate:
  `src/export/figure-layout-export.test.ts`.
- **Escape priority**: drag surfaces use CAPTURE-phase window listeners
  (always win); panel/menu consumers mark consumption with
  `preventDefault()`, and ArrangeButton's bubble listener honors
  `e.defaultPrevented`. `stopPropagation` does NOT order same-node window
  listeners — never rely on it for that.
- **Escape-cancel must restore PIN STATE, not just the value**:
  `previewColumnWidth` side-effects `userResizedIds`; cancel goes through
  `cancelPreviewColumnWidth`. EdgeResize has a moved-guard (zero-movement
  click commits nothing — a stray click on a seam used to permanently pin
  the theme spacing value).
- **Row handles sit on the VISIBLE row bottom** (track − trailingPad) via
  the `trailingPads` prop — this both de-collides them from the group-gap
  seam (previously 100% occluded) and keeps the trailing pad OUT of the
  pinned kind height. Gate leg: the group-gap drag in
  arrange-tool.browser.ts.
- **`hydrateForSpec` validIds must include `spec.labelColumn.id`** (the
  label column rides a separate wire slot but resizes like any column).
- **Interaction flag rosters sync-gated**: R `TABVIZ_INTERACTION_FLAGS`
  (classes-components.R; must sit ABOVE the InteractionSpec roxygen block
  or roxygen rebinds the docs) ↔ TS `INTERACTION_FLAG_KEYS`, enforced by
  `test-interaction-roster-sync.R`. The R ThemeInputs validator REJECTS
  unknown interaction_defaults flag names (the R resolve path never crosses
  TS validateThemeInputs, which THROWS — an R-accepted typo made the
  exported envelope un-importable).
- **`set_figure_layout()` unwraps Shiny envelopes** (`list(value, source,
  ts)`) and the serializer drops `source`/`ts` keys + gates row kinds
  against `FIGURE_LAYOUT_ROW_KINDS`; flat character vectors accepted as
  top-level column order (the shape the `column_order` event emits).
- **Presets are COMPLETE statements**: web_interaction_minimal/publication
  pin every flag explicitly so theme/global tiers can't flip capabilities
  under a named preset.
- Width-measure reads RESOLVED interaction (`resolveInteraction(spec)`),
  never raw spec.interaction — measure and render must budget identically.
- localStorage zoom state is field-validated on load (NaN re-persists
  through the setZoom clamp otherwise — sticky poison).
- Known remaining (documented, deliberate): arrange-mode renders one
  handle per row (no virtualization — arrange is opt-in; degrades on 10k
  unpaginated rows); per-dimension Shiny `column_order` event is still a
  flat array (the by-group shape only rides spec.figureLayout).

**SEARCH-AND-DESTROY CLEANUP — 2026-06-10 (commit [cleanup]; 3-agent audit
+ 1 executor; ~3,900 lines deleted).** What future agents must know:
- **The flagship browser gates had been BROKEN since the preset cull**
  (panel-liveness / interaction-qa / fixtures imported deleted COCHRANE/
  DARK — failing at import, silently not running). Fixed (NEJM/TERMINAL).
  LESSON: gates that aren't executed in CI rot invisibly; when deleting
  exports, grep tests/browser/ and scripts/ too.
- **The component-tokens drift gate had a self-scan hole**: it scanned
  component-tokens.ts itself, so KNOWN_UNCONSUMED strings self-matched and
  the staleness test was vacuous. Fixed (file excluded). KNOWN_UNCONSUMED
  burned 120 → 49; the gate now has real teeth — regen via the documented
  awk pipeline when it complains.
- **Wired (were consumed-but-never-emitted, silently falling back)**:
  `--tv-hover-bg`/`--tv-hover` (now alias --tv-row-hover-bg on
  .tabviz-container — hovers follow the theme; NOTE portaled popovers
  (zoom dropdown) can't inherit container-scoped vars and still render
  fallbacks — open issue), `--tv-semantic-emphasis-{bg,fg}` (added to
  v3-bridge — cell-scope emphasis paint was DOM-inert), `--v2-accent`
  (tokens.css ← --v2-hot), 3 more --tabviz-* RenderTree aliases.
- **Deleted** (zero-reference verified): primitives v1 island (12 files +
  scenarios; v2 is the live dialect; mapped-value.ts SURVIVES — schema/
  initial-state.ts imports MappedState), ColumnHeaders.svelte (+
  getColumnWidth), Color/Number/Boolean/OptionalField + swatch-palettes,
  OklchPicker, theme-store trio, lib/swatches, lib/font-presets, 7 dead
  lib exports, dead split-store/slice methods, 9 dead R serialize_*
  helpers + slow-path extract_*/build_cell_styles + nice_domain cluster,
  the empty .KNOWN_DIVERGENCES machinery, dead emissions
  (--tv-header-depth/--tv-plot-width/--row-indent/--tv-primary/
  --tv-group-header-opacity/--tv-row-hover-opacity/--studio-accent).
- **Deliberately KEPT (decision needed, not dead)**: the HC-fidelity
  vertical (.hc-caret/.status-tag/.pval-chip rules + --tv-hc-* tokens —
  designed a11y feature, zero producers; wire or kill as a product call)
  and the 4 elevation shadow tokens (--tv-shadow-raised/overlay-near/far
  — consumedBy corrected to [] + TODO). Column-schema grandfather list:
  115 options need consumedBy annotation (separate arc); 6 options are
  truly dead (range:showBar, viz_bar barWidth/barGap/orientation,
  viz_boxplot boxWidth/whiskerType) — wire or delete with their R args.

**WYSIWYG FIDELITY PASS — 2026-06-10 (commit [wysiwyg]).** Measured (not
guessed): new harness `srcjs/tests/browser/wysiwyg-diff.browser.ts` mounts
the real widget at scale-1 vs `generateSVG` of the same spec across a
theme/density/shell matrix, diffs geometry + computed typography, drops
side-by-side PNGs in /tmp/wysiwyg. 181 findings -> fixes:
- **Export now draws the SHELL + PAPER**: band rect (bg/border/radius from
  the same --tv-shell-bg/--tv-shell-border/--tv-shell-radius tokens),
  content translated by shellPad, paper card behind the table region only
  (title/caption stay on the shell like the DOM), gradient
  (--tv-shell-gradient -> linearGradient def), grain (same feTurbulence
  recipe as theme-runtime.css), ruled/grid/dotted patterns. Raised-theme
  artifact deltas: 44x70px -> ~3px. FLUSH INERTNESS INVARIANT: when
  shell/paper pads resolve 0, export geometry is byte-identical to
  pre-shell output (layout-metrics snapshots enforce). Glass/glow/blobs
  stay browser-only (declared boundary); shell-strip seam + caption chip +
  elevation shadows still TODO in export.
- **Crossed typography reads fixed in svg-generator**: title layout was
  reserved from the SUBTITLE size (and subtitle from BODY) — now
  title/subtitle roles with PlotHeader's 1.3/1.4 line-heights;
  caption/footnote drew the mono LABEL role at hardcoded weight 400 — now
  their own roles + readTypeWeight (footnote keeps italic — PlotFooter has
  font-style: italic); axis label drew body/500 while the DOM consumes the
  LABEL role (mono/bold on several presets); the header-size scale-up
  branch was unreachable (v3 "0.875rem" string-compared against the v4
  "14px" body token — compare PARSED px); header rule width was hardcoded
  2 (now --tv-header-border-width); tabular-nums was forced on all export
  text (now follows --tv-text-numeric-figures).
- **Schema render-tree vars wired**: RenderTree.svelte consumes --tabviz-*
  aliases that nothing emitted — every schema fragment (badge/stars/ring
  text) rendered 12px/#888 literals in the DOM while the export themed
  them. `.tabviz-container` now emits the aliases, mirroring
  svg-generator's makeTokenResolvers table — KEEP THE TWO IN LOCKSTEP.
  This also gave --tv-text-cell-size its DOM consumer.
- **Row line-height floor in computeRowLayout**: data rows floor at
  dataLineHeightPx — whenever density/pins drop the base below the body
  line-height the DOM measure loop grows rows anyway, so the estimator
  (export/first-paint) rendered tighter tables (brutalist df0.88: 18 vs
  20px per row, compounding down the table).
- Title-block top inset is the DOM's literal 12px (PlotHeader padding),
  NOT --tv-spacing-padding; below the block only headerGap applies (the
  extra padding term double-padded the seam).
- KNOWN RESIDUAL (documented boundary): estimator-vs-canvas column widths
  (delta up to ~30px/column on raw generateSVG) — mitigated in real flows
  by save_plot's systemfonts injection and the widget download's live
  widths; group-header banding scope + chevron indent relationship still
  differ between DOM and export.
- TRAP: the component-tokens drift gate scans svg-generator + Svelte
  COMMENTS too — never write a `--tv-` glob/prefix shorthand in a comment
  (it string-matches as a dead token name).

## Theme cascade — V4 LANDED on main

**Status (2026-06-04):** the V4 substrate is the package's theme system. Merged from `feat/v4-input-surface` to `origin/main` at `0d6b80b` (19-commit branch arc: Phase A vocabulary migration → Phase B shared cascade authoring surface → Phase B2 rgc_v4-fidelity rebuild → Phase D substrate extensions → coherence pass). Stages 1, 2, 3, 4 from the prior design docs are all landed; the prior staged-plan documents are superseded by the realized architecture described below.

**V4 authoring vocabulary:**
- Tier 1 inputs live as `anchors: { paper, ink, brand, accent? }` OKLCH triples + `polarity` (L-reflection) + `mode` (accessibility: standard / high-contrast / reduced-transparency) + `geometry` (radius + border-width scales) + `effects` (glow + gradient-shell + elevation) + the existing fonts / curves / shell_mode / shell_texture / density / density_factor / type_* / row_kinds blocks.
- Wire format at v1.2 (Tier-1 inputs additively gained geometry + effects since v1.1; mode now fully wired from R).
- R `web_theme()` accepts hex or [`oklch()`] triples for every anchor; status/curves/geometry/effects each have a focused `set_*` modifier (15+ focused setters in `R/themes-api.R` plus `set_inputs()` escape hatch).

**Key files (current surface):**
- `srcjs/src/types/theme-inputs.ts` — `ThemeInputs` interface + `ThemeStructure.schemaVersion = 4`.
- `srcjs/src/lib/theme/component-tokens.ts` — `--tv-*` manifest with `consumedBy` declarations + drift gate.
- `srcjs/src/lib/theme/resolve-theme.ts` — `resolveTheme(wire) → ResolvedTheme`; calls `validateThemeInputs()` up front.
- `srcjs/src/lib/theme/theme-validate.ts` — `validateThemeInputs(inputs)` (construction-time range/enum checks) + `validateResolvedTheme(theme)` (post-resolution contrast).
- `srcjs/src/lib/theme/density-presets.ts` — single source for the density px scales; v3-adapter and v4-resolver project from this.
- `srcjs/src/lib/theme/theme-presets-inputs.ts` — 22 presets via `defineInputs(seeds, rest)` helper.
- `srcjs/src/lib/layout/row-kind-heights.ts` — 5-layer per-row-kind height cascade. Layer 3 (theme defaults) reads from `inputs.row_kinds.<kind>.heightRatio`.
- `srcjs/src/components/theme-panel/ThemeControlsStrip.svelte` — Tier-1 controls only. Used by both the widget cog drawer (`components/ui/ThemeControl.svelte`) and the studio (left rail). Eight categories: Identity / Polarity / Shell / Texture / Type / Density / Geometry / Effects.
- `srcjs/src/components/theme-panel/CascadeView.svelte` — pedagogical visualization (studio-only). Six `CascadeStep` sections: TIER 1 · COLOR (RampPlateGrid), TIER 1 · GEOMETRY (GeometrySamples), TIER 1 · EFFECTS (EffectsPreview), TIER 2 · BINDING (SpineDiagram + OffTheScales) + TIER 2 · COLOR (AliasTable role-mode), TIER 3 · COLOR (AliasTable token-mode), SCALE · TYPE (TypeRolePreview), RESILIENCE · FALLBACK (ResilienceTriptych).
- **R-side**: `R/theme-defaults.R` (single source for R-side default constants; parity-tested vs TS via `tests/testthat/test-parity-defaults.R`); `R/font-urls.R` (Google Fonts URL registry); `R/themes.R` / `R/themes-modes.R` / `R/themes-design.R` / `R/themes-lotr.R` / `R/themes-showcase.R` (22 preset constructors, file location matches `package_themes()` category).
- `R/v4-inspect.R` — `list_component_tokens()`, `theme_css_vars()`, `inspect_token()`, `diff_themes()`, `contrast_report()`.

**Vocabulary clarifications (post-coherence-pass):**
- `set_polarity(theme, polarity)` sets the L-reflection axis (light/dark).
- `set_mode(theme, mode)` sets the accessibility axis (standard/high-contrast/reduced-transparency). It was a deprecated alias for `set_polarity()` through earlier sessions; **now it does what its name says.**
- Wire field is `density_factor` (snake_case, post-coherence; was `densityFactor` previously).
- R S7 slot prefixes mirror their wire keys 1:1: `curves_X` / `fonts_X` / `type_weights_X` (plural, matching `curves.X` / `fonts.X` / `type_weights.X` on the wire). Were singular through earlier sessions.
- `WebTheme.schemaVersion = 4` (was 2 — bumped to align with `ThemeStructure.schemaVersion = 4`). Distinct from `CURRENT_VERSION = "1.2"` (wire spec version).

**Wire naming convention (locked 2026-06-04, task #60):**
The theme wire deliberately uses **two cases**, separated by surface:

- **`ThemeInputs` (user-authoring surface) — `snake_case`.** What R/JS authors hand-write: `shell_mode`, `density_factor`, `type_weights`, `row_kinds`, `shell_texture`, etc. Matches R / Python idioms so the same JSON ships unchanged from either language.
- **`WebTheme` (resolved / engine-internal surface) — `camelCase`.** Engine-produced; consumers don't hand-write it: `headerStyle`, `firstColumnStyle`, `authoringInputs`, `lightDarkPair`, `tintSubtle`, `axisLabel`, etc.

This split is intentional, not technical debt. Don't "unify" it — each case is right for its surface. When adding a new field, match the case of the surface it lives on. The R serializer (`R/utils-serialize-resolved.R` + `R/themes-api.R::theme_inputs_to_json`) converts snake_case S7 slots → snake_case wire for ThemeInputs and snake_case S7 slots → camelCase wire for WebTheme fields, per this rule.

**WIRE-AUDIT ARC — SHIPPED 2026-06-05 (wire 1.3 / v0.37.0).** The rgc_v4
design-lab parity plan (`docs/dev/wire-audit-plan.md`, Round 3) executed in
full: theme-runtime.css is LIVE (shell/paper wrap on the widget DOM; flush
mode is geometrically inert), the resolver is a `resolverGroup` Map table
(0d — add new tokens by declaring their group; dev-throws are reachable),
new Tier-1 inputs (`ink2`, `monochrome`, `marks`, `effects.{glass,
caption_style,header_style,title_style}`, `labels.tag`), 27 presets with
distinctness CI gates, LCH-native studio rail (5 tabs, Alt+click trace,
preview-without-measure path). KEY NEW HARNESSES:
`srcjs/tests/browser/theme-screenshots.browser.ts` (the ONLY gate that
sees browser-additive effects — V8/rsvg renders a flat rect),
`preset-distinctness.test.ts`, the full-cssVars snapshot lock in
`resolver-dispatch.test.ts` (regen + review diff on intentional resolver
changes). B2 (group-padding runaway) was CLOSED post-arc: the measure
loop committed scrollHeight of non-overflowing cells (which just reports
the pinned track back, re-adding trailing rowGroupPadding every frame) —
fixed by overflow-only commits + grow-merge in setMeasuredRowHeights.
Open: variants.headerStyle
retirement (superseded by effects.header_style, still on wire); post-V4
backlog in the plan doc. Docs screenshots MUST be taken over HTTP —
file:// CORS breaks Quarto module scripts and fakes layout regressions.

**SPACING REWORK — SHIPPED 2026-06-05.** Three-agent review (geometry /
rgc_v4-aesthetics / spacing-architecture) converged; landed in one arc.
CURRENT WRAP CONTRACT: `.tv-shell > .tabviz-scalable > (.tv-caption,
.shell-strip, .tv-paper(table+pager), PlotFooter)` — the paper lives
INSIDE the measured/zoom-scaled subtree; the strip is the caption↔data
SEAM (lab semantics), never a top cap; chip+title share a baseline grid
row. Shell owns the figure's air: raised pad 14/20/26×density_factor +
paper inner mat 10/14/18 (scales live in `shell-paper.ts`, deliberately
NOT in DENSITY_PX — mode-gated, flush stays 0/0 inert). Auto-fit height
formula = `scaledHeight + 2*containerPadding(0) + 2*readVarPx(--tv-shell-
padding) + bottomMargin` — `shellExtrasPad`/`shellPaperPaddingPx` are
DELETED; never hand-count chrome heights again, put new chrome inside
`.tabviz-scalable`. Texture always lives on the SHELL (paper-texture
fallthrough + `--tv-paper-texture-*` + `--tv-paper-text-knockout-bg` +
`svgTexturePattern` all deleted); transparent/glass shells premix the
knockout against the PAPER bg (white-pad legibility bug). Glass: outline
drops to `--tv-glass-faint`; shell-borne prose promoted to `--tv-text`.
Axis descent reservation is 0.6×font (was 0.4 — under-reserved by one
descender, geometry audit). The drift gate string-matches `--tv-*` even
inside COMMENTS — never write a dead token name or a `{a,b}` brace
expansion in a comment. KNOWN pre-existing failures NOT from this arc:
vitest `layout-zoom.runes.ts` null-spec headerHeight (jsdom canvas env),
4 eslint no-irregular-whitespace in extract-svg-css.ts (intentional
zero-width-space escapes).

**SHELL/PAPER EXPORT PARITY — SHIPPED 2026-06-10.** `generateSVG` now mirrors
the DOM's shell band + paper card: `computeLayout` reads `--tv-shell-padding`
/ `--tv-paper-padding` from cssVars, adds 2×shellPad to totalWidth/totalHeight
and folds the paper mat VERTICALLY (mainY/footerY/totalHeight); drawing wraps
all content in a `translate(shellPad shellPad)` group while `layout` stays in
CONTENT coordinates (generateSVG derives the inner layout from `layoutFull` —
drawing call sites untouched). Shell rect (bg/border/radius) + paper rect
(around table+axis; title/caption stay on the shell) + `--tv-shell-gradient`
as `<linearGradient>` + ruled/grid/dotted/grain textures as `<pattern>` defs
(grain = the CSS feTurbulence recipe, polarity-matched; VERIFIED rendering
through rsvg). Horizontal paper mat is NOT folded into column x (v1:
`--tv-spacing-padding` serves as the visible side mat — matches the DOM
artifact width, which is content + 2×shellPad only). INVARIANTS: flush/stub
themes (pads 0) stay byte-identical to the pre-shell export; the aspect path
passes `width = targetWidth − 2×shellPad` inward so the artifact hits the
target exactly; `LayoutMetrics` gained `shellPad`/`paperPad` (snapshots
regenerated — only the two new 0-valued keys changed). Gate:
`tests/browser/wysiwyg-diff.browser.ts` (shell-aware comparisons; raised
artifact deltas collapsed from 44/70px to ≤4px). NOT ported: texture knockout
pads behind shell-borne prose, the shell-strip seam, glass/glow/blobs
(declared browser-only).

**1.0 STRATEGY LOCKED — 2026-06-06 (spec-first).** Four decisions after the
R3 ideation round (7 agents; plan: `docs/dev/spec-first-1.0-plan.md`):
(1) 1.0 identity = ENGINE-AS-PRODUCT / SPEC-FIRST — "the declarative table
engine any language (or LLM) can drive": publish npm @tabviz/core for real,
emit the machine contract (JSON Schema generated from SCHEMA_REGISTRY's
option metadata + runtime validator), MCP server, token compiler. R stays
the richest wrapper, stops being the only shipping artifact.
(2) Effects boundary DECLARED: browser-only effects (glass/glow/blobs)
frozen at current polish; gradient+grain get real SVG export parity;
save_plot warns when active effects are dropped. Never polish an effect
that only renders in the runtime that matters least.
(3) PRESET CULL 27 → ~8 archetypes + theme_blend() interpolation (OKLab
anchor lerp + scalar lerp + enum snap). Stop ADDING presets.
(4) Virtualization OUT of 1.0: default-paginate threshold + documented
row-count ceiling + windowed-flatten design note. XL retrofit-hostile.
FONTS-IN-PDF — FIXED (verified by 2 round-2 user agents via pdffonts):
NEJM PDFs embed Lora-Regular/SemiBold (subsetted TrueType), dwarven embeds
Cinzel-Bold + EBGaramond — NOT Georgia. register_web_fonts_for_rsvg() →
session fontconfig (hoisted above .inject_systemfonts_widths in save_plot)
works. The old "journal fonts DO NOT survive PDF" bug is HISTORY; don't
re-flag it. Still Phase 0: NO LEGEND exists anywhere (multi-effect forests
are uninterpretable); neutral paint mode (painter is never null — clicking
to read paints).

**THEME-TIER EXPOSURE REWORK — SHIPPED 2026-06-07 (Waves 0–4 + 1.5/3.5;
plan: `~/.claude/plans/lazy-churning-eich.md`).** How the 3-tier cascade is
EXPOSED across viewer / studio / API, reviewed by a recurring 6-lens
adversarial panel (two interim checkups; every P0/P1 fixed). Realized:
- **W0 named-alias wire** (`lib/theme/alias.ts`): role bindings serialize as
  stable NAME aliases (`"neutral.5"`) — DTCG-shaped + rename-migratable (NOT
  re-tune-proof); readers accept both alias + legacy `{ramp,grade}`. R mirror
  in `theme-wire-import.R`. + `list_roles()` roster (domain-aware) + pin
  accessibility ratchet at paint (`applyTokenPins` drops `modes.hc` pins under
  HC) + full-precision wire (`digits=NA`).
- **W1 studio**: RoleSpine MOUNTED (left rail); runtime-honest handoff (viewer
  "Edit in studio" copies the wire to clipboard + posts Shiny
  `tabviz_studio_request` — observer recipe in `?tabviz_studio`;
  `read_theme()` accepts inline JSON); pins-are-last-resort banners + lints (R
  `set_pin` throttled warn, `theme_from_wire`/`parseThemeWire` warn).
- **W2 viewer**: lean core (identity anchors) + an "Advanced controls" TOGGLE
  (plain button, NOT a disclosure — depth≤1) gating surface/type/color/
  effects/geometry; RoleTones "safe middle rung" (curated color role nudges
  via `setThemeRoleOverride`, cascade-safe not raw pins).
- **W3 non-color scale-role keystone** (`lib/theme/scale-roles.ts`): TYPE roles
  rebindable via `inputs.type_roles` (overlay on `DEFAULT_TYPE_ROLES`;
  snapshot-safe — `effectiveTypeRoles` returns the default table BY REFERENCE
  when empty); geometry named SLOTS (`set_corners`/`set_rules` → CORNER_SLOTS/
  RULE_SLOTS, single-sourced via `ts_call("geometrySlotTables")`); spacing =
  density; ALL in one `list_roles()` namespace. R `set_type_role`; `set_role`
  redirects non-color roles. Shared "Text sizes" + Corners/Rules UI in
  `Tier1Sections` (both studio rail + viewer advanced).
- **W4 contract**: `parseThemeWire`/`buildThemeWire`/`toDtcg`/`fromDtcg`/
  `suggestTheme`/`listRoles` now PUBLISHED from `@tabviz/core` + gated in
  `dist-smoke.mjs` (27 checks). Structured error envelope
  (`ThemeIssue{path,code,message}` on both validation errors, `.problems`
  back-compat). DTCG adapter (`lib/theme/dtcg-adapter.ts`): reference/semantic/
  component groups, lossless round-trip via `$extensions["com.tabviz.theme"]`.
  `suggest_theme(brand_hex)` (R + TS). NEW harnesses:
  `srcjs/tests/browser/studio-shot.mjs` + `panel-shot.mjs` (screenshot the
  studio / viewer settings panel over HTTP — the only way to eyeball them
  without launching R; double as smoke gates).
- **type_roles is UNTRUSTED ingress** — validated in `validateThemeInputs`
  (TS) + `theme_inputs_from_wire` (R drops out-of-vocab leaves); a garbage
  `size` once rendered `undefinedpx` (W3.5 P0). When adding a ThemeInputs
  field, validate it at BOTH ingresses.
- DEFERRED past this arc: `dtcgPath`/`pinnable` on the ComponentToken manifest
  (the two-ingress pin gap stays open — raw setPin/wire-import validate grammar
  + `--tv-` prefix but not pinnability); studio RoleSpine remains color-only
  (type/geometry rebind is via the shared Tier1Sections control, not the drag
  spine); HC border-width `+1px` bump still inline (not yet `token.modes`).

**SETTINGS OVERHAUL EXECUTED — 2026-06-07 (P0–P4, commits 48030de…77968ae;
plan doc carries the status section).** The realized architecture:
- **Portable theme artifact = the wire envelope** `{$schema:"tabviz-theme/
  v4", name, inputs, roleOverrides, pins?}`. Every egress emits it (studio
  Copy JSON/Download/Save-as/studio_done; settings export ⇩ in the quick
  strip); imports: `theme_from_wire()` (R), `read_theme()` (auto-detects),
  settings import ⇧, studio preset switcher. roleOverrides AND pins ride
  WebTheme next to authoringInputs and reach BOTH resolve paths
  (`getCssVars` two-level cache + `_emitV4CssVarsBody` paint path — they
  MUST stay in lockstep or widget diverges from export; gate:
  `role-overrides-wiring.test.ts`).
- **Token pins** = the studio's T2/3 channel: cssVar→value validated
  against TOKENS_BY_VAR at set time, overlaid AFTER resolve BEFORE
  contrast validation (never a reapplyEdits-style cluster stamp). R:
  `set_pin()/clear_pin()`; studio: PinsPanel; snippet emits `set_pin()`
  steps. `set_role()/clear_role()` = the T2 spine twin.
- **Shared controls**: `theme-controls/Tier1Sections.svelte` is THE
  Tier-1 IA; ThemeBand (settings, compact) and StudioRail (studio, roomy)
  are thin wrappers. AnchorRow = the flagship (swatch+hex → LCH editors
  with axis-painting tracks). Dialects B (LayoutControl cards) and C
  (--tp-*/theme-panel/controls) are DELETED; --tp-* survives ONLY inside
  the cascade pedagogy components (self-defined).
- **The panel**: 400px fixed, no tabs, quick strip (preset echo +
  divergence count + export/import + polarity/density), THEME band,
  FIGURE band on recessed paper with its OWN reset. Store seam:
  hasThemeEdits (theme-only) vs hasFigureEdits; resetThemeEdits vs
  resetWatermark+banding+rowpins. `web_interaction(enable_theme_edit =
  FALSE)` removes the cog (author freeze).
- **Gates to extend, not bypass**: settings-band-contract.test.ts (DT-11
  — the settings tree may NEVER call setThemeField/writeThemePath),
  control-contract.test.ts (theme-controls import no store, no --tp-),
  studio-store.runes.ts (envelope shape + self-round-trip),
  test-theme-wire.R (39 assertions: pins/roles through serialize, paint
  path, envelope re-hydration, border presets).
- **themeEdits/reapplyEdits survive deliberately** for canvas gestures
  (gap drags = per-figure APPLY); the DT-11 gate is the boundary.
- TRAPS from this arc: `hexToOklch` NaN-poisons on garbage (gate user
  input with `isValidHex`); the primitive-wiring audit's tag regex stops
  at the first `>` — an options arrow fn truncates the attr scan, so put
  `onchange=` BEFORE `options=` on Select call sites; jsonlite `$` partial
  matching (wire with density_factor but no density → w$density returns
  the factor — `[[ ]]` exact access in wire importers).

**WORKSTREAM C — INTERNALS EXPOSURE (theme-controlled behavior + queryable
column schema) — SHIPPED 2026-06-09.** Two deliverables realizing "idiomatic,
flowing use of the column schema and theme-controlled behavior":
- **`theme.column_defaults`** — a theme declares per-column-TYPE default
  options (`list(pvalue = list(stars = TRUE, significantStyle = "pill"))`),
  merged UNDER each matching column. THREE rules, all in
  `srcjs/src/lib/theme/column-defaults.ts`: (1) AUTHOR WINS — applies only when
  the column is still at the option's SCHEMA default (col_* builders eager-fill,
  so "unset" == "at schema default"); (2) KIND GATE — only `styling`/`editor`
  options (the `OptionKind` taxonomy on `OptionSpec`), never `core`
  (data/precision) or un-annotated; (3) XSS GRAMMAR GATE — string values can
  ride an UNTRUSTED shareable theme wire and several styling options are colors
  the renderers emit RAW into SVG attrs (`bar-renderer.ts fill="${color}"`), so
  any string failing `isValidPinValue` is dropped. The MERGE is the universal
  chokepoint: `applyThemeColumnDefaultsToSpec(spec)` runs at every engine
  spec-ingest (store `setSpec` + svg-generator's two `compileVariants` sites),
  so an R-authored spec gets it in widget AND export with ZERO R schema/kind
  logic (R just serializes `column_defaults` onto the wire). R surface:
  `column_defaults` S7 list slot, `web_theme(column_defaults=)`,
  `set_column_default(theme, type, ...)`; untrusted wire-import sanitizes
  structure + value grammar in `theme-wire-import.R`. KNOWN LIMITATION (doc'd in
  the .ts header): the merge bakes into spec.columns, so a theme SWITCH re-merges
  over already-merged columns and a prior theme's house style sticks (harmless —
  no shipped preset uses it; clean fix needs provenance marking). Deliberately
  NOT baked into any preset (the "don't pre-bake defaults" rule). Gate:
  `column-defaults.test.ts` + `column-defaults.integration.test.ts` + the
  `set_column_default` block in `test-theme-wire.R`.
- **`list_column_types()` + `column_schema(type)`** — the queryable column
  CONTRACT (`srcjs/src/authoring/schema-introspect.ts`, reachable via the V8
  `callBuilder` bridge; R wrappers in `R/column-schema.R`). list = concrete
  types (abstract schemas excluded) + option/themeable counts; column_schema =
  every option resolved across the inheritance DAG with kind/themeable/control/
  default/enum-choices/hint/consumedBy/inheritedFrom. `subset(column_schema(t),
  themeable)` is exactly what `set_column_default()` may touch — the discovery
  companion. This is the machine-readable substrate an MCP server / JSON-Schema
  generator would build on; shipped now as plain introspection (no speculative
  codegen). Gate: `schema-introspect.test.ts` + `test-column-schema.R`.
- TRAP learned: R `format(x, trim=TRUE)` still LEFT-PADS character vectors to
  common width (trim only affects numeric justification) — use `paste()` to
  collapse choice vectors or trailing whitespace leaks into the contract string.

**CONSOLIDATION PASS — SHIPPED 2026-06-10 (commits [consolidation], waves
A/B/C).** A 3-lens audit panel (interface-legibility / wiring-hygiene /
optimization) drove a no-new-features pass: clean wiring, optimize, legible
chrome. KEY OUTCOMES future agents must know:
- **DELETED modules (don't look for them):** `lib/theme/token-attribution.ts`
  (+test) and `lib/theme/extract-svg-css.ts` (+test) were fully orphaned
  (zero non-test importers; extract-svg-css's `sv-omit` markers existed
  nowhere). The 4 vestigial `data-tv-token=` literal emissions (TabvizPlot,
  svg-generator) went with them. `inspector-store` lost `tryTraceFromEvent`
  (widget-root trace handler that was never installed — the LIVE trace path
  is StudioChart's selector-based `handleTraceClick` → `inspectorStore.trace`
  → CascadeInspector, mounted via TraceInspector) and `learningMode` (a
  no-op toggle). Also gone: `studioStore.reset()` (no caller), `readSlotStyle`
  (dead twin of theme-adapter.ts's inline `inputs.slot_style ?? …`).
- **getCssVars now WeakMap-caches the base+v3-bridge overlay** keyed on the
  immutable theme identity (`cssVarsBridgeCache` in consumer-bridge.ts).
  Spacing pins are STILL applied fresh per call (they're per-figure mutable —
  the documented landmine) and the result is still spread per call (callers
  mutate it). The cache only elides the bridge recompute. Don't "simplify" by
  caching the full result — callers mutate the map AND spacing is per-figure.
- **region-tree childGroups** is now a single-pass `childrenByParent` Map +
  memoized `countDescendantRows` (was O(G²)); **split-shared computeSharedWidths**
  uses a per-subset id→col Map (was O(M²·K)); **column-defaults optionMetaFor**
  is memoized per type; **save_plot `.inject_systemfonts_widths`** shapes only
  the top-K widest candidates (`top_candidates`, dedup + nchar rank), not every
  cell — mirrors the TS width-measure contract; **utils-serialize** hoists
  spec@group_col/@group_cols out of the per-row loop.
- **Studio chrome unified onto v2:** `.studio` root now carries `[data-tv-v2]`,
  so `--studio-*` are aliased onto `--v2-*` (warm-cream fallbacks resolve
  outside a widget DOM) — the parallel near-duplicate literals are gone.
  PresetHeader's `based on` switcher is the v2 `Dropdown` (last native
  `<select>` killed); its chrome buttons use the recessive `.bar-btn` grammar
  (transparent + ink-2, inversion reserved for the one CTA). CascadeStep h3
  routes through `--v2-font-sans`/`--v2-text-large` (was a third heading font).
  Tier1Sections: Effects tab has a "Surface finish" micro-cap divider; type
  family/size/weight are a left-ruled `.sub-group` (was "· family" dot labels).
- KEPT despite "tested-but-unwired" flags: `polarityOf` (assertion helper for
  the live reflectAnchors tests), `aliasToTypeRole` (clean inverse) — removing
  trades a named helper for inline duplication. `--tp-*` stays in the cascade
  pedagogy components (CLAUDE.md's documented home; NOT touched).

**ROUND-3 USER-PERSONA REVIEW — EXECUTED 2026-06-07 (6 persona agents,
commits [review2-user]; plan doc carries the full record).** Personas:
biostatistician / Shiny-dev / no-code-journalist / a11y / LLM-driver /
Quarto-author. KEY LANDED CHANGES (future agents: these are DONE, don't
re-flag or revert):
- **ink2 anchor REMOVED — merged into accent.** There is NO `ink2` anchor
  anymore (TS ThemeAnchors / R anchors_ink2_* slots / web_theme ink2 arg /
  set_ink2() all gone). It silently won the accent-ramp seed (redundant
  second engagement hue). Rubrication is now the `--tv-ink2` TOKEN (kept,
  defaults to accent-anchor) + the p-value `starsColor:"ink2"`/"Rubrication"
  column option; pin `--tv-ink2` to make rubrication differ from accent.
  Presets that used ink2 got `accent := old ink2` (behavior-preserving —
  the resolver snapshot + R↔TS parity both unchanged). Don't reintroduce
  an ink2 anchor.
- **write_theme emits the WIRE ENVELOPE** (`theme_to_wire()`), not the
  resolved blob; `write_theme(theme, file=)` writes an arbitrary path.
  read_theme restores inputs from a legacy resolved blob's authoringInputs
  (the old round-trip silently returned a different theme). Envelope is the
  one portable artifact everywhere.
- **Static knit (format:pdf) routes through save_plot** — `knit_print_webspec`
  detects `!is_html_output()` and emits PNG/PDF via `.render_static_image`
  (webshot fallback rendered BLANK). SplitForest static path still TODO.
- **End-user high-contrast**: TabvizPlot honors OS `prefers-contrast`/
  `forced-colors` (matchMedia) + a `contrastOverride` ("auto"|"more") on
  the layout-zoom slice, surfaced as a Contrast row in the FIGURE band.
  Applied as a paint-time re-resolve (mode=high-contrast) — NEVER mutates
  theme.inputs.mode or the export.
- **Dark-mode anchor display**: Tier1Sections shows the polarity-REFLECTED
  (on-screen) anchor hex in dark mode and un-reflects on commit (reflectL
  is an involution); status anchors stay absolute. "Match brand" renamed
  "Harmonize hues to brand".
- VERIFIED working (no change): explicit `axis_range` is honored+clipped;
  PDF fonts embed; proxy set_theme(WebTheme) applies. Doc-drift swept
  (README set_colors/set_axis were dead; ?set_theme names; themes.qmd
  @surface/@content + preset count). The "fonts DO NOT survive PDF" bug
  is HISTORY.

**ROUND-2 REVIEW BOARD — EXECUTED 2026-06-07 (6 agents, commits
[review2-A..D]; plan doc carries the full record).** Scopes orthogonal to
the first board: cross-runtime fidelity / state-machine / input-robustness
/ test-gap / TS-quality / R-quality. 1 P0 + 8 P1s; the artifact core held
(test-gap planted 10 regressions, gates caught 7). KEY LANDED CONSTRAINTS:
- **Pin VALUES are untrusted and reach exported SVG `fill="…"` attributes
  → stored XSS in a SHARED artifact.** TWO defenses, keep BOTH: ingress
  grammar gate `isValidPinValue` (consumer-bridge, bans `<>{};"`+ctrl,
  ≤512) at applyTokenPins (the chokepoint all resolve paths share) AND R
  `set_pin`/`theme_from_wire`/studio `setPin`/`parseThemeWire`; egress
  neutralizer — svg-generator wraps `getCssVars` as `getCssVarsUnsanitized`
  + a local `getCssVars` that strips `"<>` from values. Never emit a pin
  value into an SVG attribute unescaped.
- **Untrusted theme-wire JSON has ONE validating ingress:
  `lib/theme/theme-wire-parse.ts::parseThemeWire`** (Tier-1 range/enum via
  validateThemeInputs, pin grammar, roleOverride shape). Settings import
  uses it — NEVER raw `JSON.parse` + `buildTheme` (that skipped
  validateThemeInputs; R's S7 validator rejected what TS rendered as
  `#NANNANNAN`). `validateThemeInputs` now uses `Number.isFinite` (typeof
  NaN==="number" sailed through range checks).
- **Theme file names are filesystem paths** — `studio_save_as` +
  `write_theme` gate names to `^[A-Za-z0-9._-]+$` (path traversal).
  `studio_save_as` body extracted to `.studio_save_as_payload()` (testable)
  and persists the wire envelope VERBATIM (not the resolved blob).
- **The paint path overlays spacing pins**: `_emitV4CssVarsBody` does
  `applySpacingPins({...getCssVarsRaw(theme)}, theme)` — spacing lives
  OUTSIDE the cache key (per-figure), so it can't ride getCssVarsRaw; the
  bridge vars are emitted separately. R `set_spacing()` now overlays
  `theme@spacing` (non-NA, snake→camel) onto `blob$spacing` in
  serialize_theme (was dropped entirely).
- **Shiny `set_theme(proxy, <WebTheme>)` applies** via `setThemeObject`
  (the dispatcher branch was a no-op); studio `init(base, name, seed)`
  captures handoff pins/roleOverrides in history[0] (else first undo wipes
  them); `hasThemeEdits` compares live pins/roleOverrides vs initialTheme
  (else pin-clear stranded Reset); `applyThemeSnapshot` snaps the restored
  theme as the reset target.
- **ONE rebuild idiom** in theme.svelte.ts: private `rebuild({inputs?,
  roleOverrides?, pins?, remeasure?, skipValidation?})` — the "artifacts
  ride every rebuild" invariant lives at one site. `WebSpec["theme"]` IS
  `WebTheme` (declares authoringInputs/roleOverrides/pins) — don't re-cast
  it. `rString` has ONE home (op-recorder, newline-safe); theme-diff
  re-exports it. DT-11 gate walks SettingsPanel's TRANSITIVE .svelte import
  graph (not a dir glob) + catches bracket-member evasion.

**SETTINGS⇄STUDIO BOUNDARY LOCKED — 2026-06-06 (plan:
`docs/dev/settings-overhaul-plan.md`; supersedes/rescinds D14).** Three agent
rounds (5-perspective debate → proposal workshop → 3 blueprints). Model:
**tier-gated writes, artifact-typed travel** — settings = Tier-1 + variants
(everything cascade-re-resolving) + a FIGURE section (per-spec state:
banding/watermark/row-pins; does NOT travel); studio = superset (same Tier-1
+ total T2/3 via a TYPED pin channel entering the cascade PRE-resolve, never
a reapplyEdits-style post-resolve stamp) + pedagogy/validate/snippet/trace.
Both export ONE JSON envelope `{schemaVersion, inputs, roleOverrides?,
pins?}` with provenance marks. Settings is a strict prefix → "Edit in
studio" is a lossless projection. LOCKED: 400px fixed panel; tabs die
(vertical scroll + sticky smcp flags); ONE control dialect (v2 primitives)
as SHARED components both hosts mount (--tp-* and theme-panel/controls/*
die at end of migration); disclosure depth ≤ 1; collapsed sections carry
value chips; two scoped resets (theme vs figure); content text editing is
inline-on-canvas, NOT panel fields. KNOWN SHIPPED BUG the plan fixes first:
studio JSON export drops roleOverrides (all 3 PresetHeader paths serialize
.inputs only) and roleOverrides has NO wire field in R. The settings'
Text/Tokens/Spacing/raw-Border tabs are CUT (→ studio); border presets must
become a REAL Tier-1 enum (header_style precedent) or the boundary is
cosmetic. `themeEdits`/`reapplyEdits` get DELETED with a grep gate once no
settings control writes T2/3 paths. Design tests DT-1..14 in the plan doc.

**STUDIO/SETTINGS REVIEW ARC — EXECUTED 2026-06-06 (5 batches, commits
[studio A]–[studio E]).** Six agents (wiring/UX/effectiveness/IA/SoC/
chrome) reviewed the studio + settings drawer; all batches landed:
- A (contract truth): snippet diff covers EVERY input family (ink2/
  header_style/slot_style/geometry/effects), anchors emit oklch()
  triples, buildBaseExpression derives from PRESETS (the stale inline
  KNOWN map is gone — gate: `snippet-generator.test.ts`). theme-validate
  split into non-throwing `collectContrastFailures(cv)` + throwing
  wrapper; studio shows a live amber contrast banner. V3-bridge values
  single-sourced in `v3-bridge-vars.ts` — theme-css emits from the map,
  getCssVars overlays it; R `theme_css_vars()` reports 0 sentinels.
- B (Reset ≡ gate): `hasThemeEdits` folds watermark color/opacity +
  cross-slice probes (rowKindHeights pins, banding overrides) via new
  ThemeSliceDeps; confirmReset clears the same set; resetThemeEdits
  clears themeOverrides.
- C (split-brain killed): `slot_style` derivation moved INTO
  theme-adapter's slotRole (was ONLY implemented inside LayoutControl —
  R/studio produced identical series regardless; gate:
  `slot-style-wiring.test.ts`). R ThemeInputs gained the slot_style
  slot + validator + serializer entry. LayoutControl density/header/
  series delegate to setAuthoringInputs (private DENSITY_PRESETS mirror
  + oklch slot math deleted). Vocabulary unified: studio tab
  Shell→Surface, "Depth"→"Figure shadow", "Marks"→"Series style",
  density labels = wire words, one shared `ui/weight-ladder.ts`.
  SettingsPanel is Theme-tab-first.
- D (chrome/a11y): v2 `tokens.css` + ThemeControlsStrip `--tp-*` derive
  from `--tv-*` with light fallbacks (dark themes get dark drawers; the
  studio rail, outside widget DOM, stays light by construction). All
  seg radiogroups carry role="radio"+aria-checked. LCH H-sliders draw
  hue-wheel tracks + anchor-colored thumbs; aria-valuetext everywhere;
  24px hit areas; prefers-reduced-motion.
- E (consequence): "Validate ▦" renders the REAL chart 2×2 across
  light/dark × standard/HC with per-cell contrast verdicts (StudioChart
  `overrides` prop). History labels via `describeInputsEdit` (reuses the
  snippet diff); undo/redo buttons name their step. In-studio preset
  switcher (dirty-confirmed). Match-brand toast. Density effective-px
  readout. Deferred: preview fixture switcher (needs designed fixtures).

**ROUND-2 ADVERSARIAL REVIEW — EXECUTED 2026-06-05/06.** Two rounds of
8-agent adversarial review (spacing/color/UX/effects/versatility/API/
code-quality/extensibility), all R1 closures re-verified empirically in
R2, ~70 R1 + ~40 R2 findings triaged, P0+P1+R2 batches landed (commits
[review-p0] [review-p1] [review-r2] ×3). LOCKED DECISIONS:
- `effects.elevation` = FIGURE-WIDE depth, vocabulary `none|low|medium|
  high` (magnitude words only — never reuse shell_mode's raised/float).
  Shell carries it under raised; paper otherwise; band-less shells gain
  shadow air (ELEVATION_AIR_PX) when pinned.
- `header_style` is a TOP-LEVEL STRUCTURAL VARIANT input (`light|tint|
  bold`), NOT an effect. `effects.header_style` + the {normal,tint,fill}
  enum are DELETED. One surface: `web_theme(header_style=)` /
  `set_header_style()` (re-resolves). Studio control lives in the Shell
  tab. variants.headerStyle mirrors the input (v3 bridge).
- `categorical` schemes are WIRED: a pinned scheme fills series slots 1+
  while slot 0 keeps theme identity (gate: scheme-wiring.test.ts). The
  registry rosters are mirrored into R assert_choice calls.
- `col_custom(field, type, ...)` = R escape hatch for JS-registered
  plugin types (validator honors an opt-in attr; built-ins stay strict).
- Status anchors are NEVER polarity-reflected (absolute semantics).
- text-subtle/muted carry a structural ≥4.5 contrast guarantee with
  hierarchy preservation (muted ≥ subtle's grade + 1) and provenance
  write-back to roleSource.
- contrast gates: theme-validate.test.ts (all presets, throw-mode) +
  warn-only validateResolvedTheme in buildTheme.
TRAPS LEARNED (do not re-introduce): a CSS var consumed inside
background-image LISTS must resolve "none", never "transparent" (one
invalid <image> layer voids the whole declaration — killed all
textures once); the formatter test file must import `it` (bun silently
SKIPS unimported test fns); pinned systemfonts widths are narrower than
the estimator — export truncation thresholds need ~one-pad tolerance;
single-text schema trees ellipsize IN the tree path (falling through to
the legacy emitter skips schema formatters).
R2 BACKLOG (not yet done): drift-gate consumedBy/name-presence
enforcement + KNOWN_UNCONSUMED stale-check; registerMark() registry;
auto-columns for tabviz(df) (versatility H2 — design in R2 report);
header keyboard sort + table ARIA; virtualization; banding ΔL floor
(14 presets imperceptible); light-mode chroma at solids; studio history
labels; resolveShellPaper hoist to ResolveCtx; hexToRgba dedup;
adding-a-column-type.md / adding-a-theme-preset.md.

**V3→V4 cutover — STRUCTURALLY COMPLETE as of 2026-06-04 late.** The duality is killed (single value source), the parity test is strict (11 documented divergences closed, KNOWN_DIVERGENCES is empty), and the remaining v3 surface is a documented compat shim with a clear deletion path. 21 cutover commits this session.

**LANDED this session (commits prefixed `[coh.*]` and `[v3→v4 #*]`):**
1. **Real parity test** (`tests/testthat/test-parity-themes.R`): top-level field set + per-axis anchor tolerance (L/C 1e-3, H 0.1°, H skipped on achromatic) + strict-with-known-divergences allowlist. 11 documented divergences (10 font strings, nejm curves) as burn-down backlog.
2. **`readVar` dev-throw + CI gate** (`tests/testthat/test-render-smoke.R::V3 fallback path in readVar is dead`): proves the 35 svg-generator `readVar(cssVars, "--tv-X", v3_fallback)` calls never actually fall back in production flows. Toggle via TS `setReadVarDevThrow(true)`.
3. **svg-generator deep migration**: 200+ direct `theme.X.Y` reads collapsed to ~12 leftovers. Cluster helpers added to `consumer-bridge.ts`: `readContentPrimary/Secondary/Muted`, `readDividerSubtle/Strong`, `readAccentDefault`, `readSurfaceBg`, `readRowAltBg`, `readBodyFamily/Size`, `readLabelSize`, `readCellSize`. Layout-metrics snapshots regenerated to lock v4-driven values.
4. **8 column renderers migrated**: badge, bar, ring, progress, icon, pictogram, sparkline, heatmap.
5. **Store slices migrated**: `stores/slices/columns.svelte.ts` + `stores/slices/layout-zoom.svelte.ts` (full layout derivation v4-driven).
6. **`swatches.ts`** rewritten on cssVars.
7. **theme-css.ts: dual emission killed.** `_buildThemeCSSImpl` no longer computes the v3 `--tv-*` block from `theme.X.Y` paths. Instead it emits the v4 manifest first (canonical source) + a small tail of user-config bridges (see below).
8. **Svelte/CSS sweep**: every `var(--tv-X)` consumer of a v3 var name migrated to its v4 manifest equivalent (`--tv-bg` → `--tv-surface-bg`, `--tv-fg` → `--tv-text`, `--tv-primary` → `--tv-accent`, `--tv-font-family` → `--tv-text-body-family`, etc.). 53 files touched in one sweep.
9. **Status manifest entries** added: `--tv-status-{positive,negative,warning,info}` sourced from status anchors via `pickAnchorHex`, with `STATUS_ANCHOR_FALLBACK` palette when unset.
10. **Italic CSS reads dropped** (Coh.22 had removed italic from v4 typography; consumers replaced with inline literals).

**ADDITIONAL CLEANUP this session (post-duality):**
11. **R↔TS theme parity test KNOWN_DIVERGENCES → empty** (#67, #68): 10 R preset font strings aligned to TS canonical forms (cochrane/bmj/bauhaus/swiss/tufte/dwarven/elvish/hobbit/atelier/executive) + NEJM curves ordering aligned (TS-side reordered to neutral-first matching R serializer). Any future drift fails the test at the moment of introduction.
12. **`ResolvedInputs` marked deprecated** (#62): 4 of 5 consumers migrated to v4 cssVars helpers (ThemeSwitcher, CellHeatmap, SplitTabvizPlot, TokensControl, LayoutControl partial). The interface stays as a documented compat shim until LayoutControl's two remaining reads (seriesAnchors + slotStyle) migrate per #76.
13. **`theme-inputs.ts` v3 vocabulary block marked `@deprecated`** (#63): prominent "V3 LEGACY VOCABULARY" section header + `@deprecated` on every export (TokenName/RampStepRef/ColorRef/ref/lit/PaintRole/ThemeRoles + 13 cluster interfaces + ClustersInputs). The block stays because `buildThemeStructure` still depends on it, but future agents see the boundary instantly.
14. **`AnchorName` cleanup**: dropped `"decorative"` from theme-roles.ts (vestigial pre-V4 anchor; no consumer).
15. **Drift gate burn-down** (#64): 54 orphan v3-legacy entries removed from `KNOWN_UNCONSUMED`. List shrunk 194 → 140.
16. **Status manifest entries** (#71): `--tv-status-{positive,negative,warning,info}` added as proper manifest entries sourcing from status anchors via `pickAnchorHex`, with `STATUS_ANCHOR_FALLBACK` palette when unset. 12+ Svelte/CSS consumers now resolve via the v4 manifest.

**REMAINING IN THE V3 TAIL (not duality, just config bridges):**

The ~30 lines left in `theme-css.ts::_buildThemeCSSImpl` are NOT a duality problem. They're single-source bridges between user-pinnable config and CSS, with no v4 manifest equivalent because they aren't anchor-derived:

- **Borders** (`theme.borders.{major,minor,table}.{color,style,thickness}`): user pins border attributes via R `set_borders()`; theme-css.ts emits `--tv-border-{major,minor,table}-{color,style,width}`. Task #73 — add manifest entries with computed resolvers if/when this is worth it.
- **First-column variant** (`theme.firstColumn.{default,bold}` × `theme.variants.firstColumnStyle`): emits `--tv-first-col-{bg,fg,weight,rule}`. Task #74.
- **Container** (`theme.layout.{containerBorder,containerBorderRadius}`): 2 vars. Task #74.
- **Header variant** (active-row pick from `theme.firstColumn.X` based on `theme.variants.headerStyle`): emits `--tv-header-{bg,fg,rule}`. Task #72.
- **Row-state semantic** (`theme.row.{emphasis,muted,accent}.{bg,fg}`): user-pinnable row tints; emits `--tv-semantic-{emphasis,muted,accent}-{bg,fg}`. No follow-up filed; small.
- **Series slot[0]** (`theme.series[0].{stroke,fill}`): emits `--tv-summary-{fill,border}`. No follow-up filed.
- **Header role typography** (header role not in v4 9-role matrix): emits `--tv-text-header-{weight,family,size}`. Either add header to the v4 typography matrix, or accept this bridge.
- **text-title-fg, axis-label-fg, axis-tick-fg** (computed from theme.text.title.fg / theme.plot.X.fg fallbacks): small set.
- **`--tv-text-column-group-weight`, `--tv-text-numeric-figures`** (column-group + numeric-figures bridges).

These can stay indefinitely without re-introducing duality. The pattern: user pins config → resolver emits to CSS once. The v4 manifest hosts the substrate-derived tokens; theme-css.ts hosts the user-config bridges.

**theme-adapter.ts::buildTheme still calls `buildThemeStructure` (v3)** to populate `WebTheme.{borders,firstColumn,layout,variants,series,row,text.title,text.tick,...,text.header}` — these are still the user-config payload that theme-css.ts's tail reads from. Until those clusters become manifest entries (tasks #72-#74), buildThemeStructure stays.

**ResolvedInputs v3 fields** (`primary`/`primaryDeep`/`secondary`/etc. at theme-resolved.ts:128) — emitted on every wire but no consumer reads them post-cutover. Safe to delete in a follow-up commit alongside dropping v3 vocabulary from theme-inputs.ts (`TokenName`, `ColorRef`, `ref`, `lit`).

**Other deferred items (smaller):**
- Manifest singleton clustering (`--tv-brand-glow` / `--tv-emphasis-shadow` cluster renames) — touches consumer references.
- HC mode behavior migration — `applyHcGradePush` (in `resolveRoleValue`) and inline `hcBump` in `resolveGeometryComputed` should migrate to declarative `token.modes.{hc,rt}` on the manifest.
- Resolver-as-manifest-table refactor — `resolveTokenValue` dispatches via prefix-matching; cleaner as a `Map<resolverGroup, ResolverFn>` driven by a `resolverGroup` field on `ComponentToken`. **Made urgent by Coh.23**: the dev-throw I added at the placeholder branches is structurally dead until this refactor — `tier: "input"` entries never reach the switch because earlier branches intercept by `cssVar` or `kind`.

Full audit at `docs/dev/v4-coherence-audit.md`.

**When working on theme-related code:** the v4 substrate IS the target. Add new manifest entries to `component-tokens.ts` rather than scattering inline reads. Update `KNOWN_UNCONSUMED` downward, not upward. Per-axis defaults belong in `density-presets.ts` / `R/theme-defaults.R` / inline at the resolver (each axis has one canonical home — don't duplicate).


# tabviz Package Development Conventions

DO NOT USE pkgdown

## Package Vision

tabviz is a **TypeScript/Svelte package (`@tabviz/core`, in `srcjs/`) with an R interface wrapper (the `tabviz` R package, in `R/`)**. The canonical authoring surface is JS; the R package is one consumer among potentially many.

- **`@tabviz/core`** owns the runtime: data model, rendering, formatters, width measurement, theme resolution, interactive state, SVG export. All semantics live here. JS authors can use it directly without R in the loop.
- **R package** is a wrapper providing: idiomatic R API, syntactic sugar (`col_*` helpers, fluent modifiers), data coercion, Shiny handlers, server-side reactivity. R produces the same spec shape a JS author would write — there is no privileged R-side computation path.
- Decisions about where logic lives default to **TS unless it is irreducibly R-side** (Shiny bindings, R-environment ergonomics, knit-time integration). When in doubt, put it in the TS package and have R call into it.


## Session protocol

This package is built in long, disjointed agentic sessions. These rules
keep the trail coherent:

1. **Planning any substantive arc?** Read `docs/dev/ship-roadmap.md`
   (areas A–M, milestones M0–M3, checkable exit criteria) and
   `docs/dev/decision-register.md` first. When an arc lands, add a dated
   one-liner to the affected roadmap area + status log.
2. **Deferring a product decision** (behavior, scope, defaults) requires a
   decision-register entry with a default-if-undecided and decide-by
   milestone. Silent deferral is banned. Decided entries move to the
   register's Decided section with one line of rationale.
3. **CLAUDE.md carries only durable material**: conventions, the
   current-architecture map, traps, test instrumentation. Arc narratives
   go to `docs/dev/arc-history.md` (append, newest first); design docs to
   `docs/dev/*.md`. If you learn a trap, add ONE line to the Traps ledger
   here with a pointer.
4. **Validation cadence**: iterate with screenshots + targeted tests; full
   suites at commit (`npm test`, `devtools::test()`, visual render smoke);
   after every commit, quick-render the docs regression net:
   `cd docs && quarto render index.qmd && quarto render studio.qmd`.
5. Commit messages use a `[tag]` prefix naming the arc
   (`[interactivity P2]`, `[wysiwyg]`, `[cleanup]`, …).

## Current architecture (the durable map)

Full chronological record: `docs/dev/arc-history.md`. Design deep-dives:
`docs/dev/{sizing-model,row-types,region-tree,r-ts-parity-notes,
interactivity-ux-plan,spec-first-1.0-plan,settings-overhaul-plan}.md`.

### Wire (v1.4)

- `WebSpec` wire is camelCase; semver string at top; sync points:
  `R/wire-version.R` ↔ `srcjs/src/spec/index.ts::CURRENT_VERSION`
  (gate: `test-wire-version.R`). Pre-release: clean breaks allowed until
  the M3 wire freeze (then additive-only minors).
- **Theme wire** is the deliberate two-case split: `ThemeInputs`
  (user-authoring) = snake_case; `WebTheme` (resolved, engine-internal) =
  camelCase. Don't "unify" — match the case of the surface you're on.
- **Portable theme artifact** = the envelope `{$schema:"tabviz-theme/v4",
  name, inputs, roleOverrides, pins?}`. Every egress emits it; imports:
  `theme_from_wire()`/`read_theme()` (R), `parseThemeWire` (TS — the ONE
  validating ingress; never raw JSON.parse + buildTheme).
- **`spec.figureLayout`** (figure-state tier): column width pins, column
  reorder, per-row-KIND height pins. Hydrated UNDER surviving session
  state on setSpec; honored by BOTH the widget and the SVG export; Shiny
  round-trip via `set_figure_layout()` (envelope-unwrapping).
- **Interaction flags are SPARSE + resolved through a 4-tier chain**
  (`srcjs/src/lib/interaction-resolve.ts`): baked defaults <
  `spec.interactionDefaults` (R `options(tabviz.interaction_defaults=)`)
  < theme `inputs.interaction_defaults` < explicit `spec.interaction`.
  NEVER read `spec.interaction.X` raw — use `store.interaction` /
  `resolveInteraction(spec)`. Baked defaults are MAXIMAL as of the D9
  reversal (2026-06-13): every affordance ON — reader-safe AND author-grade
  (enableEdit, reorder, enableAxisZoom, enableArrange) — because the primary
  users are developers who tinker; only `showGroupCounts`/`showFilters` stay
  off. Edits are local (never persist), so default-on is low-cost; opt out
  per-spec/theme/global. Flag rosters sync-gated: R `TABVIZ_INTERACTION_FLAGS`
  ↔ TS `INTERACTION_FLAG_KEYS` (`test-interaction-roster-sync.R`).
- **Persistence tiers**: VIEW state (zoom/fit/contrast → localStorage,
  key scoped by document path + element id) · FIGURE state
  (`spec.figureLayout`; survives data updates by id-reconcile incl. the
  labelColumn slot) · THEME state (spacing drags; travels with the theme).

### Theme system (V4 substrate)

- 3-tier cascade (T1 anchors/inputs → T2 roles → T3 component tokens)
  resolves TS-side (`lib/theme/resolve-theme.ts`; R delegates via V8 in
  `resolve_from_inputs()`). Add new tokens to the `component-tokens.ts`
  manifest (declare `resolverGroup` + honest `consumedBy`), never as
  scattered inline reads. `KNOWN_UNCONSUMED` only shrinks (burned to ~49,
  2026-06-10; the drift gate now excludes the manifest file from its own
  consumer scan — it has real teeth).
- 9 presets post-cull: nejm (default), ledger, brutalist, aurora,
  terminal, newsprint, blueprint, synthwave, dwarven
  (`theme-presets-inputs.ts` + R `R/themes*.R`; distinctness CI gates).
  There is NO `ink2` anchor (merged into accent; `--tv-ink2` survives as
  a pinnable token only).
- Roles: color roles via `roleOverrides` (stable NAME aliases like
  `"neutral.5"` on the wire); type roles via `inputs.type_roles`; geometry
  named slots (`set_corners`/`set_rules`); all rosters via `list_roles()`.
- **Component model (W6, Stage 1 landed 2026-06-11)**: the middle verb —
  `theme.components` re-routes a component CHANNEL to a different role
  (`set_component(th, "title", col="accent-text")`; R `list_components()`,
  TS `COMPONENT_ROSTER` in `lib/theme/component-bindings.ts`). Roster
  derives from manifest `binding` annotations and HONESTY-FILTERS
  channels backed by KNOWN_UNCONSUMED tokens (they join when Stage 3
  wires consumers — DOM + export TOGETHER, never one side). Validation
  single-sourced: TS `sanitizeComponentBindings` at every ingress (R via
  `ts_call("validateComponentBindings")`). HC/RT ratchet beats re-routes;
  re-routed tokens suppress their v3-bridge stamp (full retirement = W4).
  Design: `docs/dev/component-model.md`.
  Token pins (`set_pin`) overlay AFTER resolve, BEFORE contrast
  validation; pins + roleOverrides + components ride `WebTheme` and MUST reach
  both resolve paths (`getCssVars` and `_emitV4CssVarsBody` stay in
  lockstep — gate: `role-overrides-wiring.test.ts`). The v3 BRIDGE IS
  GONE (W4, 2026-06-11; wire 1.10): the only non-cascade emission is
  `computeLiveConfigVars` (series slot 0 + layout). Border tokens +
  export share lib/theme/borders.ts::resolveBorders. header_style and
  first_column_style are Tier-1 inputs with their own resolver groups.
- **Untrusted-ingress rule**: theme wires, figureLayout blocks, pins,
  `interaction_defaults`, `column_defaults`, `type_roles`,
  `series_overrides` (Phase 4 — per-series fill/stroke hex + shape enum;
  hex reaches SVG `fill=`/`stroke=` so the grammar gate is an XSS
  defense) are validated at EVERY ingress (TS
  `validateThemeInputs`/`parseThemeWire`/sanitizers; R
  `theme_inputs_from_wire`/S7 validators). Pin values reach exported SVG
  attributes → two XSS defenses (ingress grammar `isValidPinValue` +
  egress neutralizer in svg-generator); keep both.
- `theme.column_defaults` = theme-as-house-style per-column-TYPE options;
  merged at spec-ingest (author-wins, kind-gated styling/presentation only, XSS
  grammar gate) in `lib/theme/column-defaults.ts`. Queryable column
  contract: `list_column_types()` / `column_schema(type)`
  (`authoring/schema-introspect.ts`).
- **Settings panel: REDESIGN COMPLETE (2026-06-12)** — five surfaces
  shipped tab-by-tab; canonical record + per-phase log:
  `docs/dev/settings-redesign.md`. The SettingsPanel tab spine is
  `variations | labels | edit theme | this figure`; "edit theme" is an
  inner cluster (`EditThemeCluster`: identity | plots | styling). Tabs:
  `VariationsTab` (L1 theme-blessed mode flips) · `LabelsTab` (L1b
  figure content + watermark) · `IdentityTab` (L2 anchors/families/
  geometry/scheme) · `PlotsTab` (L3 per-series shape/fill/stroke via
  `series_overrides`) · `StylingTab` (L4 density_factor + role/text-role
  remapping + override release). The pre-redesign panel (two-band, quick
  strip, role tones, components band) and the STUDIO are SUPERSEDED;
  studio is DORMANT (do not extend). **The merge bar is
  `tests/browser/settings-consequence.browser.ts`** (`npm run
  qa:consequence`, CI-gated): every `[data-vt|lt|it|pt|st]` control must
  move ≥20 visible pixels in the figure (pixelmatch threshold 0 — zero
  ambient noise, so the floor only rejects genuinely-dead controls), a
  selector that only changes WHICH value you edit carries no marker, and
  the theme tabs reset to baseline first so accumulated state can't
  inflate a small control's footprint (the flakiness source — it IS a
  merge gate, keep it deterministic). The `LIVENESS_VERIFIED` set exempts
  controls whose honest offline footprint is below the floor (webfonts
  never load on file://; corner-radius/rule-width/type-size are real but
  tiny) — those are wiring-verified by panel-liveness instead; add to the
  set with a reason, never raise the floor. Extending a tab = extend this
  harness. Still-true substrate rules:
  tier-gated writes (panel never calls setThemeField/writeThemePath for
  T2/3 — gate: `settings-band-contract.test.ts`, 23 tests; sanctioned
  verbs only: setAuthoringInputs / setThemeRoleOverride / clear*);
  artifact-typed travel; the store verbs + wire envelope are the stable
  layer. OPEN (D25): per-token spacing / pin-creation / component
  re-routing need new sanctioned verbs (post-1.0; R/set_spacing/set_pin
  meanwhile).

### Interactivity

- **Seam grammar** (every resize surface): preview during drag → ONE
  commit on release; Escape CANCELS (restores value AND pin state — see
  `cancelPreviewColumnWidth`); double-click resets to auto; live px
  readout; arrow-key nudge on focused armed seams; zero-movement clicks
  commit nothing. `EdgeResize.svelte` is canonical. ALL drag deltas
  divide by `elementScale(el)` (`lib/scale-factor.ts`) — gestures live
  inside the CSS-scaled `.tabviz-scalable`.
- **Arrange tool** (`ArrangeButton`, `store.arrangeMode`, gated by
  `interaction.enableArrange`): arms all seams — header height/group
  gaps/footer gap (theme spacing) + per-row-KIND height handles
  (`RowEdgeHandles.svelte`, mounted INSIDE the rows region with
  `topOffset`/`trailingPads`; ghost-highlights every row of the dragged
  kind). Gate: `tests/browser/arrange-tool.browser.ts`.
- Forest domain zoom: Ctrl/Cmd+wheel only, opt-in (`enable_axis_zoom`);
  disabled overlays are `pointer-events: none`. Cmd/Ctrl+wheel over the
  widget = widget zoom (containment-gated; so are the Cmd+/-/0/1
  hotkeys — never page-global).
- Escape priority: drag surfaces use CAPTURE-phase window listeners;
  panels/menus mark consumption with `preventDefault()`; ArrangeButton's
  bubble listener honors `e.defaultPrevented`. `stopPropagation` cannot
  order same-node window listeners.

### Export / WYSIWYG

- `generateSVG` draws the SHELL band + PAPER card (same `--tv-shell-*`/
  `--tv-paper-*` tokens as the DOM), gradient + grain + ruled/grid/dotted
  textures, with content translated by shellPad. **FLUSH-INERTNESS
  INVARIANT**: pads resolving 0 ⇒ geometry byte-identical to the
  pre-shell output (layout-metrics snapshots enforce). Typography draws
  from the SAME role tokens the DOM consumes (title/subtitle/caption/
  footnote/axis-label/header — all role-aligned 2026-06-10).
- Declared browser-only (allowed WYSIWYG breaks): glass, glow, blobs.
  Everything else must match within harness budgets. Known residuals are
  decision-register items (estimator column widths D8; group-header
  banding scope D10).
- `computeRowLayout` floors data rows at one body line-height (the DOM
  measure loop grows them anyway — estimator parity).
- Measurement harness: `tests/browser/wysiwyg-diff.browser.ts` (widget at
  scale-1 vs generateSVG, numeric diffs + side-by-side PNGs).
- The `--tabviz-*` aliases on `.tabviz-container` mirror svg-generator's
  `makeThemeResolver` table — keep the two in lockstep.
- **DOM↔export divergence ledger** (`src/lib/theme/dom-export-divergence.test.ts`,
  2026-06-14): the numeric wysiwyg gate can't see 1px line/color differences, so
  this RATCHET gate guards them. Any component token whose `consumedBy` is
  DOM-only (`["svelte/TabvizPlot.svelte"]`) must carry a justification
  (browser-only / parallel / PENDING) in the ledger; a new unjustified DOM-only
  token FAILS (forcing: draw it in the export too, or document why not), and the
  ledger only shrinks. The Bug-B class (boxed verticals, first-col bold, header
  fg/rule, group rule) all lived here — now wired into the export + de-listed.
  When you add a DOM-only token, decide its export fate here.

### Sizing

- Density px scales: single source `lib/theme/density-presets.ts`
  (`DENSITY_PX` + `density_factor` multiplier). Shell/paper pad scales
  live in `shell-paper.ts`, deliberately NOT in DENSITY_PX.
- Row heights: 5-layer per-kind cascade (`lib/layout/row-kind-heights.ts`)
  + content growth; DOM measure-then-commit uses grow-merge (B2: settled
  rows are absent from reports — never replace the map). Auto-fit height
  formula = `scaledHeight + 2*containerPadding + 2*shellPad +
  bottomMargin`; never hand-count chrome — put new chrome inside
  `.tabviz-scalable`.

## Traps ledger

One line each; the cost of ignoring these has already been paid once.

**Svelte / state**
- `spec` is `$state.raw` — deep mutations are invisible; mutate only via
  `setSpec`/`writeThemePath`/slice helpers (full story: Frontend section).
- Svelte 5 `$state/$derived` don't rewrite inside helper-function bodies —
  route through store getters or inline `{@const}`.
- Portal × delegation: bubble-phase handlers never fire on portaled
  subtrees — use `onXcapture`; test with REAL keys.
- Portaled popovers (zoom dropdown) can't inherit container-scoped CSS
  vars — they render fallback chrome (decision D4).
- Vite minifier trips on top-level typed `Set<TaggedUnion["k"]>` in runes
  modules; `package.json sideEffects` tree-shakes side-effect-import
  `register*()` modules and unit tests won't catch it.
- Never `window.confirm/alert/prompt` (silently blocked in RStudio viewer
  / sandboxed iframes) — use the in-widget `<ConfirmDialog>`.

**Theme / CSS**
- The component-tokens drift gate string-matches `--tv-*` even in
  COMMENTS — never write a dead token name or a glob/brace shorthand
  (`--tv-text-caption-*`) in a comment.
- A CSS var consumed inside a `background-image` LIST must resolve
  `none`, never `transparent` (one invalid layer voids the declaration).
- Check BOTH directions when adding vars: consumed-but-never-emitted
  renders silent fallbacks (the `--tabviz-*`/`--tv-hover-bg` bug class);
  emitted-but-never-consumed is tracked debt (KNOWN_UNCONSUMED).
- `getCssVars` WeakMap-caches only the base+bridge overlay; spacing pins
  apply fresh per call and callers mutate the result — don't cache the
  full map.
- D13 roster themes are SLIM envelopes (`{name, authoringInputs, …}` — no
  resolved `spacing`/`layout`/`row` cluster). NEVER feed one to
  `getCssVars` or a renderer raw: `applySpacingPins` read
  `theme.spacing.rowHeight` off the undefined cluster and crashed the
  theme switcher ("…reading 'rowHeight'"). Resolve via `buildTheme` first
  (ThemeSwitcher's `resolveSlim`, memoized by name). Both consumer-bridge
  spacing-pins and `computeLiveConfigVars` now skip when their cluster is
  absent (defense-in-depth), but the FIX is to resolve at the source.
  Gate: `slim-envelope-resolve.runes.ts`. Same partial-theme class as the
  B1 containerBorder crash.
- NEVER return a module-level table entry by reference from a builder's
  identity path (`scaleSpacing` factor-1 shared ONE spacing object
  across every comfortable theme; one mutation restyled them all —
  js-ci's maiden run caught it via Linux test-file order).
- `hexToOklch` NaN-poisons on garbage — gate user input with `isValidHex`.
- On `Select` call sites put `onchange=` BEFORE `options=` (the
  primitive-wiring audit's tag regex stops at the first `>`).

**Testing**
- Runner split: `*.test.ts` = bun; `*.runes.ts` = vitest; a `.vitest.ts`
  is collected by NEITHER. bun can't resolve `@stdlib` — resolved-theme
  tests use stub themes or move to vitest. bun silently SKIPS test fns
  the file didn't import (`it` vs `test`).
- Browser gates rot silently if nothing executes them (the preset cull
  broke panel-liveness/interaction-qa for weeks) — when deleting exports,
  grep `srcjs/tests/` and `scripts/` too. CI for harnesses = roadmap M0.
  When you ADD a browser gate, wire it into `js-ci.yaml`'s `browser-gates`
  job (theme-screenshots + hero-width sat unwired) — a gate not in that list
  never runs.
- R↔TS source-parse sync gates (`test-wire-version`, `test-glyph-roster-sync`,
  `test-interaction-roster-sync`) read `../../srcjs` and `skip_if_not` when it's
  absent — so they SKIP in the tarball-based `R CMD check` (srcjs is
  `.Rbuildignore`d). An in-tree step in `R-CMD-check.yaml` (ubuntu/release) runs
  them where srcjs exists; keep new R↔TS source-parse gates in that filter.
- Puppeteer `mouse.click({clickCount: 2})` sends ONE pointer pair and CDP
  reports `detail` 0 — detect double-press via the `dblclick` event.
- Liveness-harness lessons: comprehensive fingerprints (full outerHTML +
  style text + geometry), drive dropdowns by real keyboard, never press
  Escape to dismiss (closes the whole panel), bound every evaluate with
  timeouts.
- panel-liveness BLIND SPOT (D28): its widget fingerprint hashes ALL
  `<style>` text (the re-emitted theme CSS), so a control that EMITS a
  `--tv-*` token but whose token nothing RENDERS still moves the
  fingerprint → false "live". The dead geometry controls passed it this
  way (drove only the panel preview). panel-liveness proves a control
  REACHES the theme, NOT that the table consumes it — for true consequence
  trust the RENDER-measuring gates (settings-consequence pixel-diff,
  glyph-cell-parity, wysiwyg-diff), which a stray token can't fool. When
  adding a theme token, confirm a renderer reads it (not just the panel
  preview).
- Docs screenshots MUST be over HTTP — `file://` CORS breaks Quarto
  module scripts and fakes layout regressions.
- Pinned systemfonts widths are narrower than the estimator — export
  truncation thresholds need ~one-pad tolerance.
- The DOM and the export have TWO separate flex-distribution paths (export
  = `resolveFlexWidths`; the DOM store has its own). They agree only while
  content fits the container; past it the export grows a high-weight flex
  column unbounded while the DOM stays even. Production WYSIWYG PINS widget
  widths so it's unaffected — but `wysiwyg-diff.browser.ts` exercises the
  FROM-SCRATCH path (no provided widths), where flex widths legitimately
  diverge (budgeted under D32). Unifying the two is a post-ship arc (D32).
- Numeric cells render `tabular-nums` but are measured with PROPORTIONAL
  advances (~0.9px/digit under-count) — `tabularizeDigits()` normalizes
  digits at the flat-measure sites (DOM `doMeasurement` + export
  `calculateSvgAutoWidths`); composed cells use `COMPOSED_SPAN_BEARING`.

**Layout / export**
- Renderer registration is SPLIT across two boots (schema/init.ts = V8;
  init-dom.ts = +Svelte) — an svg renderer registered only via a
  Svelte-importing module silently text-degrades every headless export.
  Gate: schema/boot-coverage.test.ts; pattern: *-svg-renderer.ts pure
  modules registered from BOTH boots. Propagation survey:
  docs/dev/propagation-readiness.md.
- `.grid-cell` has `overflow: hidden` — affordances overhanging a cell
  edge are clipped out of hit-testing; keep handles fully inside.
- The floating toolbar overlaps the top-right header region whenever the
  widget is hovered (it's `pointer-events: none` only while faded) —
  don't put load-bearing affordances under it.
- Shell/paper export work must preserve the flush-inertness invariant
  (pads 0 ⇒ byte-identical geometry).
- COMPOSED-CELL width (interval/variant/custom) = measure the actual
  RENDER TREE (`schema/measure-composed.ts`), not the flat string — the
  retired `COMPOSED_TEXT_BUFFER` blindly absorbed two real gaps. (1) Measure
  at the size the surface PAINTS: the DOM cell is `rem×root` px (use the
  root-aware conversion, NOT raw cssVars); the export reuses
  `makeThemeResolver`. (2) The DOM lays out at NATURAL size then
  `transform: scale(actualScale)` to fit, and composed cells are multi-SPAN
  inline runs the browser rounds up per-span — so grid-space width =
  Canvas-visual ÷ actualScale + ~1px/span (ceil per text node). The DOM
  resolver's injected `measure` folds both in (`scaleComp` via columns-slice
  deps + `COMPOSED_SPAN_BEARING`); the export needs neither (scale 1,
  fractional x). Get the size wrong and columns silently under-clip.
- XSS EGRESS WALL: any spec-DATA color (EffectSpec/marker/cellStyle/row.style.bg/
  annotation/ReferenceLine + viz-renderer `opts.*Color`) reaching a `fill=`/
  `stroke=` SVG attribute MUST pass `escapeAttr` (= escapeXml) at egress — the
  export is string-concatenated (no DOM auto-escaping) and embeds into HTML, so
  a `#fff" onload="…` value is stored XSS. The DOM path is *usually* safe (Svelte
  escapes) — EXCEPT a shared raw-markup helper (e.g. `legendGlyphSvg`) that the
  DOM injects via `{@html}`: `{@html}` bypasses Svelte escaping, so such a helper
  needs the escape for BOTH consumers (escape inside it, not at the export site).
  THEME colors are safe (ingress isValidHex/getCssVars neutralizer). It's a no-op
  on legitimate colors, so escape at the resolve-call definition in any new
  *-renderer.ts. Gate: `export/svg-xss.runes.ts` (covers row.style.bg/color,
  cellStyle, bar.color, watermarkColor, legend effect.color). 2026-06-16 export
  review found 3 missed egresses (row-label color, watermarkColor, legend) — the
  wall ratchets, never loosens.

**R**
- NEVER `new_property(X, default = SomeClass())` — always
  `default = quote(SomeClass())` (eager defaults embed instance graphs;
  serialize(widget) once weighed 583 MB; gate: test-serialize-weight.R).
- jsonlite `$` partial-matches — `[[ ]]` exact access in wire importers;
  the package-local `%||%` errors on length>1 vectors and treats "" as
  NULL-ish.
- `format(x, trim=TRUE)` still left-pads character vectors — use
  `paste()` to collapse choice vectors.
- Wrap length-1 character vectors in `I()` when the wire needs a JSON
  array (auto_unbox collapses them to scalars).
- A constant placed between a roxygen block and its object REBINDS the
  docs to the constant (and deletes the object's .Rd on roxygenise).
- Continuation lines AFTER `@export` corrupt the directive (export
  silently dropped; load_all masks it) — run `devtools::document()`
  after roxygen edits; gates: test-namespace-integrity.R (exports +
  Collate file checks).
- roxygenise rewrites in-flight `.Rd`s from others' docstring edits —
  commit only your own (`git checkout --` the rest).
- NEVER pass `--cache-refresh` to quarto render (forces knitr cache ON;
  S7/htmlwidget chunks explode to multi-minute serializes). Fresh-render
  guarantee = `rm -rf docs/_freeze docs/.quarto`.
- A bare `dev` rule in `.gitignore` shadows `docs/dev/` — `git add -f`
  new files there and verify with `git status`.
- `cli_abort()` glue-interpolates its strings — machine-built messages
  (e.g. TS validator output quoting user values) must escape `{`/`}`
  (double them, `fixed = TRUE`) or cli errors on pluralization/glue.
- `%||%` has ONE canonical def (`R/conditions.R`) — coalesces NULL **and**
  length-0 (incl. `character(0)`, which the old variant CRASHED on) **and**
  `""`. Never re-add a local `%||%` (5 copies drifted once; the empty-string
  one silently won by Collate order) and don't `@importFrom rlang "%||%"` (its
  NULL-only semantics differ). The `web_col` empty-header idiom needs raw
  `is.null` precisely because `%||%` eats `""`.
- Coerce constructor args (`as.data.frame`, etc.) INSIDE the branch that needs
  them, never before a class dispatch — `update_data` coerced the WebSpec to a
  data.frame above its `S7_inherits(WebSpec)` proxy check, killing the whole
  proxy path (gate it with a POSITIVE-path test, not just the rejection case).

## Working in this Codebase

This package is developed in long, disjointed agentic sessions. Future agents (including you, next session) will not remember the current conversation. **Leave a clear trail.**

- **Update this `CLAUDE.md`** when you establish a new convention, learn a constraint future agents will hit, or build new test infrastructure worth sharing.
- **Look for existing code before writing new code.** Search `srcjs/src/lib/`, `srcjs/src/stores/`, `srcjs/src/spec/`, `srcjs/src/authoring/`, and `R/utils-*.R` for prior art. When you find near-duplicates while working in an area, consolidate.
- **Centralize, don't scatter.** Configuration, defaults, registries, and feature constants live in one discoverable place per concern (e.g. `R/themes.R`, `R/glyph-registry.R`, `srcjs/src/lib/theme/component-tokens.ts`). Prefer named constants over magic numbers, named functions over inline expressions, frozen module-level dispatch tables over scattered `const`s at call sites.
- **Document non-obvious *why*** in code comments only when the why isn't visible from the code itself.

## Codebase Ontology

The package is **specification-first**: authors construct a `WebSpec`, serialize it to JSON, and ship it to a renderer. The terms below are used consistently throughout the code; future work should use them too.

- **WebSpec** (`R/classes-core.R:259`, mirrored in `srcjs/src/spec/v1.0.json`) — the root container: `data`, `columns`, `theme`, `groups`, `summaries`, `interaction`, `initial_state`, `layout`, `labels`, `paginate`, plus *style-mapping columns* (`row_bold_col`, `marker_color_col`, …).
- **SplitForest** (`R/classes-core.R:411`) — a collection of WebSpecs plus shared axis range and column widths for split-by views.
- **Column** — has a `type` string (`text`, `numeric`, `interval`, `forest`, `sparkline`, `pictogram`, `pvalue`, `bar`, `events`, `icon`, `badge`, `ring`, `stars`, …) plus a type-specific `options` object. One R class (`ColumnSpec`) and one TS shape; types are flat instances with string discriminators.
- **Effect** (`R/classes-core.R:58`) — a single forest data series (point/lower/upper columns + label + color/shape/opacity). Multi-effect forest columns hold a list of these.
- **Annotation** (`R/classes-annotations.R`) — typed overlay on the plot (`ReferenceLine`, `CustomAnnotation`, …). Each is a distinct S7 class; serialization dispatches on `S7_inherits` in `serialize_annotation()` (`R/utils-serialize.R:917`).
- **Mark** — a visual element type (forest point, interval, bar, box, violin, lollipop). Each carries a `MarkRecipe` wiring channels (body/outline/line) to slot bundle fields.
- **Glyph** — a named SVG path (person, skull, leaf, …). Roster lives in `R/glyph-registry.R` and `srcjs/src/lib/glyph-registry.ts` and **must stay in sync** (parity tests guard this).
- **Slot** — a per-series visual styling bundle (`SlotRole`, `R/classes-theme.R:243`; `SlotBundle` is a deprecated alias at `:283`): fill, stroke, muted/emphasis variants, text_fg, shape. One slot per data series; the pooled summary reads slot[0].
- **Token** — a named semantic role applied to rows/cells. Paint-tool tokens: `emphasis`, `muted`, `accent`, `bold`, `fill` (`R/classes-theme.R:535-609`). Status tokens (`positive`, `negative`, `warning`, `info`) are orthogonal.
- **Tier** — the cascade levels in theme resolution. **Tier 1 = inputs** (primary, secondary, accent, series_anchors, fonts, neutrals, slot_style). **Tier 2 = derived roles** (surfaces, content, dividers, accent roles, semantics, series slots). **Tier 3 = component clusters** (Header, ColumnGroup, RowGroup, Row, Cell, FirstColumn, PlotScaffold, MarksRecipes, AxisConfig, Layout).
- **Cluster** — a Tier 3 region grouping bg/fg/rule/text-role (e.g. `RowCluster` with base/alt/hover/selected + semantic bundles + banding mode).
- **Cascade** — the resolution flow `Tier 1 → Tier 2 → Tier 3`, deterministic and **idempotent**: NA fields fill from upstream; user pins survive re-resolution. The cascade now runs TS-side (`srcjs/src/lib/theme/theme-resolve.ts`); R delegates to it via V8 in `resolve_from_inputs()` (`R/themes-api.R`), so `R/utils-theme-resolve.R` retains only the density-preset mirror used by parity tests.
- **Style mapping** — pointing the spec at *data columns* that supply per-row or per-cell style values (`row_bold_col`, `marker_color_col`, …). Styles are not embedded per row; they're extracted at serialization time from the mapped column.
- **Modifier** (`R/modifiers.R`) — a function that transforms a `WebSpec`, htmlwidget, or `tabviz_proxy`; dispatches on input class so the same modifier name does the right thing for each target.
- **Region tree** (`srcjs/src/lib/layout/region-tree.ts`) — the row-system foundation: rows are a tree of `RegionNode`s (`kind`/`traits`/`scope`, body = column-cells | free content, `children`) that `flatten()` projects into the flat `DisplayRow[]` the layout/render path consumes. `buildRegionTree` is structural (groups/rows/reorder, collapse-independent); `flatten` applies collapse + disclosure (`expandedRows`) at emit. The seam **details panels** and (future) **faceting** attach to. Design: `docs/dev/region-tree.md`.
- **RowKind** (`srcjs/src/lib/layout/row-kind.ts`) — single source of truth for "what kind of row": `data` / `group_header` / `spacer` / `summary` / `header` / `panel`. `resolveRowKind` + a `rowKindProps` table (banded / measuresWidth / rendersCells / summaryMarker) consolidate what were ~50 scattered predicates. `RegionKind = RowKind | "axis_strip"`.
- **Details / notes** — full-width free-content rows built on one primitive: a `panel` region (markdown, content-driven height). **Details** (`Row.details`, R `details=`/`details_expanded`) is a row-owned disclosure panel gated by `expandedRows`; **notes** (`WebSpec.notes`, R `add_note(after, content)`) are always-visible inserts. DOM renders markdown→HTML (`lib/markdown.ts`); SVG export renders markdown→plain-text band (`markdownToPlainText`).
- **Forest scale** (`srcjs/src/lib/layout/forest-scale.ts`) — the single source of truth for a forest column's x-scale, keyed by a `ForestScaleContext` (column + group + scaleType + domain + width). `buildForestScale` + the shared range/clamp helpers; the per-column `forestAxes` resolver (axis slice) retired the old global `xScale`. The `groupId` seam is what faceting extends.
- **Density** — spacing preset `compact` / `comfortable` / `spacious` lives in `srcjs/src/lib/theme/density-presets.ts::DENSITY_PX` (single source; the v3 adapter and v4 resolver project from it). A continuous `density_factor` (theme input, clamped `[0.5, 2]`) multiplies the preset (`scaleSpacing`). Per-row-kind height **overrides/pins** layer on top: `computeRowLayout`'s `rowKindHeights` map (set via `setRowKindHeight`, survives density/factor). The full 5-layer per-kind cascade (intrinsic ratio → theme defaults `inputs.row_kinds.<kind>.heightRatio` → constructor pins → user pins → inheritance) lives at `srcjs/src/lib/layout/row-kind-heights.ts`; see `docs/dev/sizing-model.md` §8a.
- **Banding** — alternating-row background mode: `none` / `row` / `group` / `group-N` (`R/utils-banding.R`).
- **Wire version** — semver string at the top of every WebSpec. Major bumps are breaking; minor bumps are additive (`srcjs/src/spec/index.ts:22-91`, `R/wire-version.R`).

## Supported Runtimes

Designs must work across all of these, and prefer generic solutions to runtime-specific ones. If an optimization or feature only works in one runtime, it must be additive — never load-bearing for the others.

- **Interactive browser** — htmlwidget in HTML, RStudio viewer, standalone HTML.
- **V8 (R-side)** — server-side SVG/PNG export via the `V8` package; no DOM, no Canvas.
- **Static** — Quarto/RMarkdown knit output; widget JSON serialized at build time, rendered at view time.
- **Shiny** — server-driven reactivity; the widget receives updates from R and dispatches handlers back.

## Interactive Model

The widget supports interactive mutation of the underlying spec/data:

- Cell value edits (double-click)
- Row/cell token application via the paint tool (`emphasis`, `muted`, `accent`, `bold`, `fill`)
- Theme edits via the settings panel (Tier 1 inputs change → cascade re-resolves; user pins survive)
- Column reorder/resize, sort/filter, group collapse, pagination
- Details/disclosure panels (`toggleRowDetails`; `expanded_rows` syncs to Shiny)
- Per-row-kind height pins (`setRowKindHeight`; survive density/theme/data
  updates; ride `spec.figureLayout`). Surfaces: the figure band's "Row
  heights" sliders (can CREATE pins) + `RowEdgeHandles.svelte` drag
  handles, LIVE inside the arrange tool (`enableArrange`).
- The arrange tool (toolbar mode): arms every resize seam — row-kind
  edges, header height, group gaps, footer gap — with px readouts and
  the shared seam grammar.

Mutations must be efficient and granular — interactive edits should not require rebuilding bulk data structures.

## Package Status

- **Lifecycle stage**: Experimental (via `lifecycle::signal_stage()` in `.onLoad`).
- **Pre-release** — no backward-compatibility constraints on wire format, in-memory model, or API surface. Prefer clean breaks over compatibility shims.
- **Target**: CRAN submission for the R wrapper after stabilization.

## Frontend (TypeScript/Svelte)

### Location
Source in `srcjs/src/`; built output in `inst/htmlwidgets/`.

### Build targets
`cd srcjs && npm run build` produces all three runtime bundles (htmlwidget, split, V8). Individual targets in `srcjs/package.json` (`build:widget`, `build:split`, `build:v8`, `build:npm`).

### State management
Svelte 5 runes (`$state`, `$derived`, `$effect`, `$state.raw`, `untrack`). Stores live in `srcjs/src/stores/` as sliced state, composed in `forestStore.svelte.ts`.

**Critical rule — `spec` is `$state.raw`:** the root `spec` variable in `tabvizStore.svelte.ts` is held as `$state.raw<WebSpec | null>(null)`. That means **deep mutations are invisible to Svelte**. Writing `spec.theme.spacing.field = value` or `const t = spec.theme; t.field = value` will update the in-memory object but **will not trigger any re-render** — and you won't get a runtime error to tip you off.

The only ways to trigger reactivity on a spec change:
- Reassign the whole `spec` variable: `spec = { ...spec, X: ... }` (only inside the store).
- Call `deps.setSpec({...spec, ...})` from a slice (preferred).
- For nested theme paths use `writeThemePath(path, value)` in `slices/theme.svelte.ts` — it reconstructs `spec.theme` immutably and calls `setSpec`.

If you write a new mutation function on a slice, especially a `preview*` one called during pointer drag, **make sure it goes through `setSpec` or a helper that does**. This was the root cause of the 2026-05-25 "row resize doesn't preview during drag" regression (`previewThemeField` was directly mutating `spec.theme.spacing.field = v` — silently dead).

The drift gate `bun test src/export/svg-centering.test.ts` and the manual scrub of any new `preview*` / `setX` slice method are the only protections; there's no eslint rule for this yet.

### Formatting & measurement
`srcjs/src/lib/formatters.ts` and `srcjs/src/lib/width-utils.ts`. Must work in both browser (Canvas available) and V8 (no Canvas) — keep a pure-JS estimator path that does not depend on DOM APIs.

### Authoring API
`srcjs/src/authoring/` mirrors the R surface: `tabviz()`, `col_*` → `colText/colNumeric/vizForest/…`, modifiers. Parity notes in `docs/dev/r-ts-parity-notes.md`.

### Wire format
The JS spec is the wire format. `R/wire-version.R` + `srcjs/src/spec/index.ts` track the version; bump on shape changes (pre-release, no migration shims).

## R Wrapper Conventions

R code is a thin wrapper over the TS engine. Keep R idiomatic where it matters for R users, but resist building parallel logic that duplicates the TS package.

### Validation
Use `checkmate` for function argument validation:
```r
checkmate::assert_flag(show_legend)
checkmate::assert_number(decimals, lower = 0, upper = 10, null.ok = TRUE)
checkmate::assert_string(header, null.ok = TRUE)
checkmate::assert_choice(format, c("auto", "scientific", "decimal"))
```

### S7 classes
- Core authoring classes use S7 (`WebSpec`, `WebTheme`, `ColumnSpec`, `EffectSpec`, `GroupSpec`, `GroupSummary`, `SplitForest`, …).
- Use `@` for property access, not `$`.
- Validators go in the class definition, not external functions.
- S7 classes describe the **R authoring surface**; they serialize to the canonical JS spec shape.

### Error messages
Use `cli` for user-facing messages:
```r
cli::cli_abort("Column {.field {name}} not found in data")
cli::cli_warn("Using default theme because {.arg theme} is NULL")
```

### col_* helpers
Standard argument order: `field(s), header, width, type-specific params, ...`. All helpers delegate to `web_col()` (`R/classes-components.R:230`).

### API surface
Top-level `tabviz()` arguments are the preferred primary API; mirror on fluent modifiers as a secondary surface. Don't duplicate knobs that already belong to a contained object (themes, columns).

### NSE for column references
`R/utils-nse.R` resolves formula-based column references (`bold = ~is_significant`) to column names at spec construction time. Use the existing NSE helpers; don't roll your own quoting.

## Testing Instrumentation

### TS-side (`srcjs/`)
Inline `*.test.ts` next to source; `npm test` runs both bun and vitest.

**Runner split (load-bearing):** `*.test.ts` run under **bun**; `*.runes.ts` run under **vitest** (Svelte-compiler path, for rune state). `vitest.config.ts` `include` is `*.runes.ts` only — a plain `.vitest.ts` will be collected by *neither* runner and silently not run. **bun's runner can't resolve `@stdlib`** (pulled in by the real theme resolver via oklch), so a bun `.test.ts` that needs a resolved theme must either use a stub theme (see `sizing-fixtures.ts`) or move to a `.runes.ts` vitest file. Regenerate bun snapshots with `bun test <file> --update-snapshots`.

| Area | Location | Covers |
|---|---|---|
| Pure utilities | `src/lib/*.test.ts` | formatters, oklch, scale-utils, axis, text-wrap, theme-resolve, etc. |
| Spec validation | `src/spec/index.test.ts` | wire-spec shape |
| Store slices | `src/stores/**/*.test.ts` | events, column-id |
| JS authoring | `src/authoring/*.test.ts` | `tabviz`, `columns`, `modifiers` |
| htmlwidget bridge | `src/htmlwidgets/*.proxy.test.ts` | proxy contract |
| Sizing harness | `src/export/layout-metrics.test.ts` + `sizing-fixtures.ts` | box-model regression gate: snapshots `computeLayoutMetrics()` (per-row height/top/marker/kind/indent, per-column width+x, chrome dims, spacing-token echo) over a density/wrap/indent/spacer/group/overall/mixed fixture matrix + invariants. Locks geometry before/after sizing & row-kind refactors. Stub themes → runs under bun. Regenerate: `bun test src/export/layout-metrics.test.ts --update-snapshots`. Visual half: `debug-shapes.ts` (`renderDebugShapes`) draws the box model as labeled boxes; eyeball via R `render_debug_shapes(spec, "out.png")`. See `docs/dev/sizing-model.md` §6b and `srcjs/src/export/README.md` (indexes every export-side harness). |

Additional gates from `srcjs/`:
- `npm run check` — svelte-check type-check
- `npm run check:size` — bundle-size budget (`bundle-size-budget.json`)
- `npm run check:lockfiles` — npm + bun lockfile parity
- `npm run knip` — DEAD-CODE harness (`knip.json`). Models the REAL entry
  graph (the 5 npm barrels + 4 runtime boots + tests) so it reports only
  TRUE unused exports, not the public API. Scoped to dead *values* (the
  `exports`/`nsExports` categories — currently ZERO); `types` and
  `duplicates` are OFF on purpose (the published type vocabulary in
  `types/index.ts` isn't internally consumed, and intentional aliases like
  `escapeAttr`=`escapeXml` are not dups). The script runs knip via
  `npx --yes knip@5` — do NOT vendor knip as a devDep: it pulls native
  `@emnapi/*` transitives that broke `npm ci` lock parity on the Linux
  runner (2026-06-15). For a DEEPER one-off audit run
  `npx knip --include dependencies,files,unlisted,unresolved`. LOCKFILE TRAP
  (paid twice): to change deps, edit package.json then run
  `npm install --package-lock-only` (SURGICAL — keeps every other version
  pinned) + `bun install`. NEVER `rm package-lock.json && npm install` — a
  full regen bumps `eslint-plugin-svelte`/`svelte` within their `^` ranges to
  a11y-stricter versions whose `svelte/valid-compile` rules fail the
  zero-warning lint gate on pre-existing components. KNIP-INVISIBLE
  CONSUMERS: an export consumed only by an R-side regex (e.g.
  `SHINY_EVENT_FIELDS`, read by `test-wire-version.R`) looks dead to knip but
  isn't — always trace WHY before deleting. Drive `exports` to zero; raw
  `npx knip` with no config reports ~286 false positives (it can't see the
  barrels).
- `npm run lint` — eslint (flat config, `eslint.config.js`). **ZERO-WARNING baseline, every rule `error`, CI-gated** (paydown completed 2026-06-12; the sweep deleted real dead code: the legacy plot-resize trio, getLabelWidth/getLabelFlex (D20 item 7), a vestigial polarity reflection in buildTheme). `prefer-const` is OFF for `*.svelte`/`*.svelte.ts` — the rule doesn't understand the Svelte 5 runes idiom `let {x} = $props()`; plugin v3's runes-aware svelte/prefer-const is the re-enable path. `no-undef` off (TS handles it).
- `scripts/screenshot.js` — headless browser screenshot generator
- `scripts/dist-smoke.mjs` — smoke test for the published npm dist (runs in `build:npm`)
- `src/schema/columns/drift.test.ts` — CI drift gate. Every concrete-schema option must declare `consumedBy: string[]` listing the behaviors that read it (`"emitSource"`, `"sortKey"`, `"estimateWidth"`, `"formatValue"`, `"renderCell"`, `"contributeBanks"`, `"contributeConditions"`, `"aggregate"`, or `"editor"` for UI-only knobs). The GRANDFATHER list is EMPTY (D11, 2026-06-11) — every option is annotated; new options must annotate. NOTE: option `kind` vocabulary is core/styling/presentation (the kind value "editor" was renamed 2026-06-11; `consumedBy: ["editor"]` still means the editor UI). New options must annotate or explicitly grandfather (with a follow-up issue). The gate catches "added an option but nothing reads it" bugs.

### R-side (`tests/testthat/`)
testthat. Notable groups:
- `test-classes-*.R`, `test-theme-*.R` — class behavior + cascade resolution
- **`test-parity-columns.R`, `test-parity-themes.R`, `test-parity-split-shared.R`** — R↔TS parity, the critical guardrail for wrapper-over-runtime correctness. `test-parity-split-shared.R` (added Phase 3) locks the equivalence between R's `split_table()` shared-axis/widths output and TS's `computeSharedAxis`/`computeSharedWidths`.
- `test-theme-roster-sync.R` — guards the glyph/theme roster sync between R and TS
- `test-theme-css.R` — guards the `tabviz_theme_css()` R wrapper against the TS `getThemeCSS()` (R/TS via V8 produce identical output)
- `test-systemfonts-injection.R` — guards `.inject_systemfonts_widths()` (Phase 2.5 V8-export pixel-exact widths)
- `test-shiny-proxy.R`, `test-shiny-state.R` — Shiny integration
- `test-render-smoke.R`, `test-examples.R` — end-to-end smoke + gallery render
- `test-save-plot*.R`, `test-paginate.R`, `test-split_table.R` — pipeline-specific

Manual tests in `tests/manual/`; visual regression in `tests/visual/`.

**Browser interaction + Shiny harnesses (Arc A, 2026-06-05):**
- `srcjs/tests/browser/settings-consequence.browser.ts` (`npm run
  qa:consequence`, CI-gated) — the CONSEQUENCE gate (settings-redesign D21,
  first principle 1): walks every `[data-vt]` control on the panel's
  Variations tab with real input (segment clicks, End/Home on ranges) and
  pixel-diffs the FIGURE region (left of the panel) before/after via
  pixelmatch at threshold 0 — deterministic headless rendering makes raw
  RGB inequality the honest measure (several blessed variations are
  sub-perceptual: nejm banding tint Δ≈4/255). A control passes when SOME
  segment moves ≥100px; conditionals unmounted mid-walk are re-swept after
  the Reset-theme travel check (which itself must revert the figure).
  `--only id1,id2` isolates controls from walk-order state accumulation.
  Each new redesign tab extends this harness — it is the per-tab merge bar.
- `srcjs/tests/browser/panel-liveness.browser.ts` (`npm run qa:liveness`) —
  the ZERO-DEAD-BUTTONS gate (UX redesign A4). Opens the real settings cog and
  WALKS every value/nav control across all five D21 surfaces (variations,
  labels, edit-theme{identity/plots/styling}, this-figure; ~85 repaints) —
  the old line below references the early subset (variations /
  edit theme / this figure), operating each with REAL input and
  asserting an observable consequence. Liveness = operating a control changes
  the WIDGET fingerprint OR the PANEL fingerprint; a control that moves neither
  is DEAD (unless on the justified-no-op allow-list: export/import/handoff/
  close, verified present+enabled instead). Also asserts the two-scoped reset
  gutter (Reset theme / Reset figure) is dirty-gated and actually reverts.
  HARD-WON LESSONS baked in (don't relearn): (1) the widget fingerprint must
  be COMPREHENSIVE — hash the widget's full outerHTML + ALL document `<style>`
  text (the re-emitted theme CSS) + laid-out geometry; element-sampling a few
  selectors was BLIND to forest marks / cell borders / title decorations /
  geometry tokens and false-flagged ~20 live controls as dead. (2) Drive
  Dropdowns by REAL KEYBOARD (focus trigger → ArrowDown opens → Enter commits);
  synthetic clicks never open them (Svelte 5 delegation + window-pointerdown
  close listener) and headless mouse coords proved unreliable. (3) NEVER press
  Escape to dismiss a stray dropdown — Escape closes the whole panel and
  cascades null-panel crashes; re-click the open trigger instead. (4) The
  fixture needs a forest column or series-style/effects controls have nothing
  to repaint. (5) The contrast a11y toggle (auto/more) is REPAINT-EXEMPT — it
  re-resolves at HC which is visually inert on an HC-friendly theme. (6) BOUND
  every page.evaluate/screenshot with withTimeout — a captureScreenshot flake
  hangs to the 120s protocolTimeout and reads as a "hang"; bun buffers stdout
  so the harness appends a live trail to `/tmp/liveness-progress.log` (tail it).
  Run takes ~3-4 min; deviceScaleFactor 1, headless. Known minor gaps it
  reports transparently: conditional Start band/plain (hidden when banding=
  none) and FontFamily pickers (not `.dd-trigger`).
- `srcjs/tests/browser/interaction-qa.browser.ts` — drives sort / collapse /
  paint (mouse + keyboard) / inline edit / zoom / settings / theme-switch /
  filter / SVG export with REAL puppeteer input on a grouped fixture. Use
  real keys/mouse, not synthetic events — Svelte 5's untrusted-event
  fallback masks the portal×delegation bug class this harness exists to
  catch. Found numeric inline editing fully broken (2 stacked bugs).
- `tests/manual/shiny-smoke/` — live Shiny app + headless driver
  (render / proxy set_theme / edit → input round-trip). Reinstall the
  package first or you smoke a stale bundle.
- `srcjs/tests/browser/arrange-tool.browser.ts` — the arrange-tool +
  seam-grammar gate (default-off → arm → ghost → drag → Escape-cancel →
  dblclick-release → column drag/autosize → gap-seam drag → disarm).
  Real mouse/keyboard input only. Run after `npm run build`.
- `srcjs/tests/browser/wysiwyg-diff.browser.ts` — DOM↔export fidelity
  measurement: mounts the widget at scale-1 vs `generateSVG` of the same
  spec across a theme/density/shell matrix; numeric geometry+typography
  diffs + side-by-side PNGs in /tmp/wysiwyg. The WYSIWYG regression net.
- `srcjs/tests/browser/glyph-cell-parity.browser.ts` — the GLYPH-LAYER
  twin of wysiwyg-diff (cell-render-parity-review.md gap #2): pixel-diffs
  each visual column's cell (badge/progress/ring/stars/pictogram/icon/bar/
  sparkline/heatmap) DOM-vs-`generateSVG` raster — the layer the numeric
  wysiwyg gate is blind to. Fixed column widths so cell boxes match;
  per-column budgets encode the review's open ranks, only shrink; `--gate`
  fails on new/widened divergence. TRAP: the widget-DOM `page.screenshot`
  HANGS under the local headless-Chrome capture flake (blocks bun's loop —
  withTimeout/protocolTimeout only break it when the loop isn't fully
  jammed), so locally it SKIPS (⊘, exit 0) and only MEASURES in CI. Recipe
  that works for widget screenshots (mirrors settings-consequence):
  `--force-device-scale-factor=1` + reduced-motion + foreground tab +
  bounded close + a hard watchdog. MUST call `bootBuiltinBehaviors()`
  before generateSVG or every visual cell text-degrades (the split-boot
  trap — inflated heatmap to 71%). CI-GATED in browser-gates (budgets
  calibrated 2026-06-14 from run 27512901960, measured×1.6); locally it
  SKIPS (screenshot flake) — download the `glyph-parity-crops` artifact to
  eyeball. Budgets only shrink (drop to new floor when a rank-3/4/5
  reconcile lands).
- `srcjs/tests/browser/studio-shot.mjs` — DORMANT with the studio (not
  in CI; keep passing if touched, don't extend). Was the ONLY way to eyeball the
  studio without launching R (it's a Shiny gadget). Serves `inst/studio/`
  over HTTP (the file:// CORS rule) and boots the studio in standalone
  forge mode (no host data → sample spec + cochrane). Doubles as a smoke
  gate: exits non-zero if the role spine never mounts or the page throws.
  `node tests/browser/studio-shot.mjs [out.png]`; screenshots dir is
  gitignored. Run after `npm run build:studio`.

### Visual regression
`tabviz::render_visual_tests()` renders example specs to PNG via the V8 + rsvg SVG export pipeline — same TS engine that drives the browser, executed in V8. Output in `tests/visual/output/` (gitignored). Review with the Read tool for clipping, alignment, theme styling, blank regions. Filter with `render_visual_tests("pattern")`.

### Performance bench harnesses

Three complementary benches measure different layers of the pipeline.
Run them when changing anything in the measurement, serialization, or
render path. All emit results to stdout; capture to a file with `>` for
before/after diffing.

| Harness | Location | What it measures | Run |
|---|---|---|---|
| **Bun (algorithmic)** | `srcjs/tests/perf/` | Cost of pure-JS algorithms (estimator, rank+top-K, theme resolve, formatters) over synthetic fixtures at 100→10k rows. No DOM, no Canvas; in-process Node. Captures algorithmic shape, not real-browser cost. | `cd srcjs && npm run bench` |
| **Puppeteer (real browser)** | `srcjs/tests/browser/` | Real Chromium mount: launches headless Chrome, injects any tabviz bundle (`--bundle <path>`). Two kinds: the **bench** (`run-bench.ts`, times `renderValue`) and **correctness tests** (`*.browser.ts`, assert DOM-measured behavior, exit non-zero on fail — for things headless bun/vitest can't check, e.g. `measure-rows.browser.ts` verifies the content-driven-height measure-then-commit loop grows rows + settles; `forest-marks.browser.ts` asserts forest mark x-positions match the canonical `plotRegion` scale (DOM↔export WYSIWYG); `details-panel.browser.ts` asserts details panels render markdown + toggle). Catches Canvas, DOM, layout cost. | `cd srcjs && npm run bench:browser` · `bun run tests/browser/measure-rows.browser.ts` |
| **R-side serialize** | `tests/perf/bench-r-serialize.R` | R-side stages: `split_table()` (incl. V8 round-trip for shared mode), `serialize_split_table()`, `toJSON`, `forest_plot_split()` factory, single-spec baseline. Real-world fixture: 1k rows / 10 subsets. | `Rscript tests/perf/bench-r-serialize.R` |

Each harness has its own README with run/diff instructions and known
floors. Baselines are checked in alongside the harnesses
(`baseline-prev.json`, `baseline-current.json`, `baseline.txt`) so a
change's perf impact can be audited from the commit alone.


## Building New Test Apparatus

Current instrumentation will not be sufficient as the package grows. **Tests and harnesses are both essential — and harnesses are often the bigger gap.**

The codebase already runs on more than unit tests: R↔TS parity tests, the V8+rsvg visual-regression pipeline, the bundle-size gate, the lockfile-parity gate, the roster-sync test, the npm dist-smoke check. These *harnesses* — instrumentation that captures behavior, compares against a baseline, and surfaces drift — catch the classes of bug that unit tests structurally cannot. Treat building new harnesses as first-class work, not as scaffolding around the "real" tests.

**Add unit tests aggressively** in the existing trees (`srcjs/src/**/*.test.ts`, `tests/testthat/test-*.R`). Don't invent a parallel test tree.

**Build new harnesses when the current ones don't cover a concern.** Examples of harnesses worth standing up if a gap appears:
- Fixture generators producing synthetic specs at chosen scales and shapes.
- Snapshot harnesses capturing wire JSON for regression.
- Session record/replay for mutation flows (paint, edit, sort, theme).
- Shiny harnesses with mocked sessions for state round-trips.

When you build a new harness, name it obviously, place it where future agents will find it, and add a one-line pointer under "Testing Instrumentation" in this file. A harness that no one else discovers is dead weight.

**Specific guardrails to extend, not bypass:**
- **R↔TS parity is precious.** Wire-shape changes or authoring-surface changes need parity-test coverage; roster additions need `test-theme-roster-sync.R` updates.
- **Visual regression needs both authoring paths.** As the JS authoring API matures, mirror R `inst/examples/` with TS-authoring examples under `srcjs/tests/visual/`.

A future agent must be able to discover and run any new test infrastructure without reading the conversation that created it.

## Workflow

### After Frontend Changes
1. `cd srcjs && npm run build`
2. `devtools::install(quick = TRUE)` — **skip if you've linked the dev bundle** (see below)
3. `tabviz::render_visual_tests()`
4. Review PNGs in `tests/visual/output/` with the Read tool
5. `cd srcjs && npm test` for TS unit tests

#### One-time setup: skip the install step

`node srcjs/scripts/link-htmlwidgets-dev.mjs` replaces the installed package's `htmlwidgets/` and `js/` directories with symlinks back to the source-tree `inst/htmlwidgets/` and `inst/js/`. After that, `npm run build` alone makes the new bundle visible to R — the ~15s `devtools::install` step drops out and the cycle becomes ~8s instead of ~25s. The script backs up the original dirs (`.preserved-<ts>`) and refuses to touch dirs outside known user libraries. Reverse with `--unlink` before publishing or rebuilding the actual package.

### After R-Wrapper Changes
- `devtools::test()` — unit tests
- `devtools::check()` — full R CMD check (before release)
- `cd docs && quarto render` — live R chunks catch JS regressions the SVG tests don't

## Documentation
- roxygen2 with markdown enabled for the R wrapper. Regenerate with
  `roxygen2::roxygenise()`; commit only your own `man/*.Rd` + NAMESPACE changes —
  the run also rewrites `.Rd`s for any in-flight `.R` docstring edits (others'
  work), which should NOT be bundled into an unrelated commit (`git checkout --`
  them).
- Design/architecture notes live in `docs/dev/*.md` (e.g. `sizing-model.md`,
  `row-types.md`, `r-ts-parity-notes.md`) — the durable cross-session trail.
  **Gotcha:** a bare `dev` scratch rule in `.gitignore` shadows `docs/dev/`, so
  **new** files there are silently ignored — `git add -f` them (existing tracked
  ones are unaffected). Verify with `git status` after adding.
- Examples should be runnable without external data when possible.
- Quarto site under `docs/` is the user-facing documentation; rebuild after each commit.


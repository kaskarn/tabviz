# Ship roadmap — tabviz 1.0

Status: **living document** (stood up 2026-06-10). This is the bird's-eye
map of what must tighten before 1.0 ships. Companion:
`docs/dev/decision-register.md` (open product decisions with defaults and
deadlines — the other half of staying tidy).

Identity (locked, spec-first 1.0 plan): *the declarative table engine any
language (or LLM) can drive.* R is the richest wrapper, not the product.

## How to use this document

- Each area has **exit criteria** — checkable statements, not vibes. An
  area is done when its criteria pass, not when it feels done.
- When an arc lands, update the area's status line (one line, dated).
- When work surfaces a product decision it doesn't settle, it goes in the
  decision register — never into silent deferral.
- Ordering: milestones M0–M3 below are clusters, not a strict sequence.
  M0 is genuinely first (it changes the cost of everything else).
  Area C (columns-in-themes) starts early because creative iteration
  needs calendar time, even though it finishes late.

---

## M0 — Foundations (meta: do first, they cheapen everything else)

### A. Gates that cannot rot (CI)
The flagship browser gates were silently broken for weeks because nothing
executed them (the preset cull broke their imports; discovered 2026-06-10).
Every other area on this roadmap decays invisibly without this one.
**Exit criteria:**
- [x] CI runs on every push: js-ci.yaml `ts-suite` job (bun + vitest,
      svelte-check, eslint errors, build, bundle budget, lockfile parity;
      the drift gates run inside the suites). R side: the existing
      R-CMD-check.yaml 5-platform matrix. VERIFIED GREEN on the first
      real push (2026-06-11) — and the maiden runs EARNED their keep:
      caught an unpinned bun runtime, a half-committed lockfile state,
      and a REAL shared-spacing-object production bug that macOS test
      order had hidden for months (scaleSpacing identity-path reference
      share; fixed + regression-locked).
- [x] CI runs the browser harnesses headless: js-ci.yaml `browser-gates`
      job (`arrange-tool`, `forest-marks`, `measure-rows`,
      `details-panel`, `panel-liveness`, `interaction-qa`) — verified
      locally 2026-06-10; GREEN ON CI HARDWARE 2026-06-11 (2m33s,
      first real push).
- [x] `wysiwyg-diff.browser.ts --gate`: budgeted CI gate; every budget
      annotated with its decision-register ID (D8/D15/residuals); new or
      over-budget findings fail. 0 breaches at stand-up; the gate's first
      catch (header.fontSize v3-bridge mismatch) was fixed, not budgeted
      (2026-06-10).
- [x] Perf benches run with regression thresholds against checked-in
      baselines: bun bench `--gate` on every push (calibration-normalized
      vs `baseline-current.json`, 1.75×, missing-scenario rot guard) +
      region-tree budget gate in CI; browser bench weekly
      (perf-weekly.yaml, informational artifacts). The bench itself had
      ROTTED (culled-preset import) — repaired same day (2026-06-11).
- [ ] A gate failure blocks merge (configure branch protection once CI is
      green on main). Known-failure allowance: NONE — the long-standing
      vitest "jsdom canvas" failure was a test-harness bug (`?? null`
      swallow), fixed 2026-06-10; all suites fully green.

### B. Decision infrastructure
**Exit criteria:**
- [x] `docs/dev/decision-register.md` exists, populated with all known
      open decisions, each with a default-if-undecided and a decide-by
      milestone (2026-06-10).
- [ ] Register is EMPTY of pre-1.0 items at ship (every entry decided or
      explicitly re-dated post-1.0).
- [x] CLAUDE.md instructs agents: deferring a product call ⇒ register
      entry; landing an arc ⇒ roadmap status line. Done 2026-06-10;
      VERIFIED FOLLOWED across the 2026-06-11 session sweep (every arc
      logged, every deferral registered or explicitly post-1.0).

### C0. Wire-freeze planning (the freeze itself is M3)
Pre-release "clean breaks allowed" is why recent arcs were cheap. The
remaining wire-shape work must be scheduled BEFORE the freeze.
**Exit criteria:**
- [x] `docs/dev/wire-freeze-inventory.md` (2026-06-10): W1–W5 breaking
      items scheduled (D2 option deletions, column-ontology fallout,
      variants.headerStyle retirement, v3-blob slimming, hiddenColumns
      home), additive list, freeze checklist.

---

## M1 — Contract & substance

### C. Columns as a design medium *(start early — creative iteration time)*
The schema + `column_defaults` machinery exists; no shipped theme uses it
expressively. This is what makes the 9 survivor themes feel like designed
objects rather than palettes — and it exercises the machine contract.
**Exit criteria:**
- [x] Column ontology reviewed: vocabulary + kind taxonomy audited, the
      6 dead options DECIDED+DELETED (D2), inheritance DAG documented
      (docs/dev/column-ontology-review.md §Inheritance DAG; the F4
      irregularities are recorded there with their fix path).
- [x] All grandfathered options carry `consumedBy` annotations; the
      grandfather list is EMPTY (119 → 0, 2026-06-11; the sweep also
      killed 3 more dead options — currency editor menus + violin
      maxWidth).
- [x] FIVE presets ship house styles (2026-06-11), battery-reviewed as
      design: nejm (pvalue stars+pill, outlined badges), terminal (mono
      numerals, square boxed badges), brutalist (square badges, display
      numerals), newsprint (ink stars, small circle badges), synthwave
      (lg glyph columns, pill significance). Structural-only by design
      (colors stay role-driven → polarity/HC keep working); no-op
      entries pruned in review. PREREQUISITE FIXED: theme-switch
      stickiness (#65) — setSpec now re-bases the outgoing theme's bake
      (rebaseThemeColumnDefaults, 5 tests). THE ARC'S REAL CATCH: the
      V8 boot never registered the SVG halves of pvalue/reference/
      range/img (Svelte-trapped module) NOR bar/heatmap — six types
      silently exported as plain text (pvalue stars and BARS absent
      from every save_plot ever). Split into V8-safe modules
      (visual-svg-renderers.ts, bar-svg-renderer.ts,
      heatmap-svg-renderer.ts), booted both sides.
- [x] Documented 2026-06-11: guide/themes.qmd "Column house styles"
      (three safety rules, R + JS, schema introspection pointers); the
      stale 27-preset section rewritten to the nine. AREA C COMPLETE.

### D. Spec-first contract shipped for real
**Exit criteria:**
- [x] JSON Schema generated + published (2026-06-11):
      scripts/generate-json-schema.ts merges the hand-written top-level
      shape with per-WIRE-TYPE column defs from SCHEMA_REGISTRY (controls
      → JSON types, segments → enums, bounds carried; unknown-type
      fallback keeps additive minors valid while KNOWN types must
      satisfy their defs). Ships in the npm dist
      (dist/tabviz-spec.schema.json). Gated: json-schema.test.ts
      validates a REAL authored spec with Ajv (2020-12), rejects broken
      ones, and drift-checks def count vs the registry. The schema's
      first catch was real (toggles carry null on the wire).
- [x] npm consumer leg (2026-06-11): srcjs/README.md refreshed into
      real JS-author docs (mount + drive the instance, author a spec,
      themes incl. the verified buildTheme/wire round-trip, schema
      validation) — every snippet RUN against dist/ first (two were
      wrong as drafted: buildThemeWire takes INPUTS, parseThemeWire
      returns a wire not a theme). scripts/consumer-fixture.mjs = the
      real external-consumer gate: author → shipped-schema validate →
      headless SVG, imports ONLY dist/; runs in build:npm after
      dist-smoke.
- [x] MCP server LANDED 2026-06-11 (scripts/mcp-server.mjs):
      dependency-free stdio JSON-RPC exposing six tools —
      list_column_types / get_column_schema / list_themes /
      get_spec_schema / validate_spec (structured diagnostics, typo
      roster from the schema's own wire-type defs) / render_svg
      (headless, preset-name themes resolved server-side). Imports ONLY
      dist/. Gate: scripts/mcp-smoke.mjs (npm run mcp:smoke) drives the
      full journey over REAL stdio — 10 checks. First run caught a real
      seam: listColumnTypes returns AUTHORING keys while the wire wants
      WIRE types (viz_forest vs forest). AREA D COMPLETE.
- [x] Structured spec errors LANDED 2026-06-11: src/spec/validate.ts —
      `validateSpec` collects `{path, code, message, severity}` issues
      (version, WebData shape, row-id presence/uniqueness, column
      type/duplicate-id, field references incl. forest options →
      warnings); `assertValidSpec` is the ingress wall in createTabviz
      (errors throw SpecValidationError with issues attached; warnings
      console.warn). Exported on the /spec subpath (dist-smoke gated).
      Its first run caught MY OWN wrong model of the wire (data is
      {rows, groups} with per-row metadata, not a flat array) — the
      interaction-qa gate flagged it before commit.

### E. Ontology engagement — the component model
Design: `docs/dev/component-model.md` (locked 2026-06-11). The cascade
becomes OPERABLE through the three-verb grammar — re-tune a role /
re-route a component channel / pin — with T3 components as sparse,
editable channel→role records organized by table region. This is also
the retirement path for the v3 theme-css bridges (W4) and the wire work
is W6 (pre-freeze).
**Exit criteria:**
- [x] Stage 1 substrate + wire: manifest `binding` annotations (47
      tokens / 13 components); the `components` wire block validated at
      every ingress (TS + R via ONE V8-shared validator); both resolve
      paths in lockstep (structural — shared getCssVarsRaw + cache key);
      `set_component()`/`clear_component()`/`list_components()`; gates
      both sides; wire 1.4→1.5. (2026-06-11)
- [x] Stage 2 color channel — SETTINGS HALF LANDED 2026-06-11:
      RoleChipGrid (grouped swatches, hover names, aria) +
      ComponentsBand (region accordions, live spec-line rows, per-channel
      chip popover, release-to-default) mounted in the panel's theme
      band; store verbs setComponentChannel/clearComponentChannel
      (immutable, $state.raw-safe); hasThemeEdits counts re-routes.
      BOTH acceptance examples verified end-to-end ("table-frame →
      border-subtle", "title → accent-text"); liveness gate green.
      STUDIO HALF LANDED same day: ComponentsEditor extracted as the
      presentational core (compact/roomy layouts); the studio mounts it
      roomy below PinsPanel; studio store gained
      setComponentChannel/clearComponentChannel WITH history (components
      ride HistoryStep — undo/redo/revert restore them; init seeds
      history[0]). Walk coverage CLOSED with area H (2026-06-11): the
      studio walk operates the 51 channel rows, re-routes, undoes; the
      re-route leg's first run caught the chart preview dropping
      components. Stage 2 [x].
- [x] Stage 3 text channels — LANDED 2026-06-11: family/size/weight
      slot-chip pickers in ComponentsEditor (both hosts); the design
      doc's motivating example (axis-label → numeric/regular) verified
      end-to-end. Honesty filter still governs which channels appear
      (figures + the unconsumed-token channels join when their consumers
      land — they are SUBSTRATE-ready, the resolver honors them).
      Icon/indicator records remain design work (no manifest tokens yet).
- [x] Stage 4 (HC exploration DONE 2026-06-11 — component-model.md
      "HC-as-state-overlay" note: fits as a reserved-state record BELOW
      the baked ratchet; additive wire; post-1.0 verdict). States LIVE
      already (Stage-2 editor renders state·channel rows — row alt/hover/
      emphasis, cell paint states, header variants all editable);
      caption-chip records live. Gradient-strip + watermark decorative
      records EXPLICITLY DEFERRED POST-1.0 (2026-06-11; watermark is
      figure state today — a theme-level twin is a design call with no
      pre-1.0 forcing function). The HC-as-state-overlay note is written
      (component-model.md). Stage 4 [x] at pre-1.0 scope.
- [x] v3 theme-css bridges RETIRED (W4, 2026-06-11): computeV3BridgeVars
      deleted; the only non-cascade emission is computeLiveConfigVars
      (series slot 0 + layout) under its own resolver group.
- [x] Verb + travel mental model documented (2026-06-11): the themes
      guide's "Three editing verbs" section (verb table + reach + the
      theme/figure/view travel split + introspection cross-refs:
      list_roles / list_components / inspect_token). The settings panel
      + studio band state their verb inline ("re-route"). Also fixed
      stale "27 presets" doc drift (it's 9).

---

## M2 — Experience hardening

### F. Interaction quality (zero dead UI)
Dead menus in the column-config settings are the symptom; the discipline
is a liveness audit across ALL surfaces.
**Exit criteria:**
- [x] Surface walks LANDED 2026-06-11 (interaction-qa grew 5 scenarios,
      now 17): header context menu (all 4 items consequential — lookup
      by data-header-id, the toggle-header leg hides the text it would
      match), column type menu (search narrows; pick → editor → INSERT
      commits a column — the pick alone is configure-then-commit, not a
      direct insert), column editor (opens via configure; Escape
      closes), zoom dropdown (zoom-row live; Escape closes — the walk's
      first catch: NO Escape path existed, fixed in ZoomControls), pager
      (fresh paginated mount: next/prev/readout/continuous/disable).
      Filter popover + arrange seams already gated (filter scenario,
      arrange-tool.browser.ts). The pager leg also surfaced a parity
      gap: TS authoring has no paginate= (recorded in
      r-ts-parity-notes.md).
- [x] Empty/disabled states reviewed 2026-06-11: context-menu items are
      capability-gated (canConfigure by type-def, dynamic toggle-header
      label); pager hides at ≤1 page; toolbar affordances all flag-
      gated; settings conditionals documented in the liveness allowlist.
      ONE real defect found + fixed: hide-column had no floor — a
      reader could hide EVERY column into a blank widget with no header
      left to right-click for recovery. The menu now omits "Hide
      column" on the last visible column; gated in headerContextMenu.
      AREA F COMPLETE.
- [x] Gesture grammar re-verified 2026-06-11: arrange gate + the new
      walks; the zoom dropdown's missing Escape was the one breach
      found and is fixed (preventDefault-consuming, per the Escape
      priority convention).

### G. WYSIWYG as a contract
**Exit criteria:**
- [x] Exception list user-documented (2026-06-11): the export guide's
      "What matches the screen" fidelity contract — browser-only
      effects, whole-table pagination semantics (D7), raw-spec
      estimator boundary (D8). save_plot's roxygen carries the D7
      sentence. UPDATE 2026-06-13: D8 is no longer a boundary — it was
      RESOLVED (empirical estimator + label-flex unification); the
      raw-generateSVG path now matches the DOM at 0 breaches. The
      browser-only effects (glass/glow/blobs/gradients) remain the only
      declared exceptions.
- [x] wysiwyg-diff budgets green across the FULL matrix in CI (area A
      wired it 2026-06-10; 9-preset coverage 2026-06-11).
- [x] All known divergences decided/fixed (2026-06-11): D7 documented;
      D8 accepted+documented (budget annotations name it); D10 verified
      aligned (permanent groupLabel.x metric); D15 RESOLVED (closed-form
      caption model); shell-strip/chip/elevation are the declared
      exception list (verified visually in the aurora battery pair).
      LATE STRENGTHENING: pvalue+bar columns joined the matrix fixture
      (the V8 boot-split bug lived precisely in the fixture's blind
      spot) — first run caught the nejm pill inflating compact rows by
      2px (fixed via margin-block neutralization, not a budget).
- [x] Battery complete (2026-06-11): the WYSIWYG matrix now covers ALL
      9 presets (15 cases) — every case produces a DOM-vs-export PNG
      pair (/tmp/wysiwyg) and passes the budgeted gate immediately at
      existing budgets. Aurora (the exception-list stressor) eyeballed:
      divergence is EXACTLY the declared list (chip, gradient strip,
      glow — browser-side decoratives; chevrons are affordances).

### H. Studio: good enough
Deliberately scoped down — correct and unsurprising, not flagship.
**Exit criteria:**
- [x] Studio walk LANDED 2026-06-11 (studio-shot.mjs extended): rail
      tabs switch content; the components editor's 51 channel rows live;
      a component re-route repaints the chart; undo restores it; zero
      console/page errors across the walk. FIRST-RUN CATCH: the chart
      preview rebuilt its theme WITHOUT components (the hand-rolled
      opts-bag class) — fixed. TAIL CLOSED same day:
      the walk now operates every rail VALUE slider with real keys
      (24 identity LCH + 8 form; PageUp-sized nudges — one arrow step
      on chroma rounds to the same hex and false-flags live controls)
      and the full PinsPanel flow (bogus token → manifest error; real
      pin → row + accurate count banner + repaint; clear → both gone).
- [x] Round-trips lossless (2026-06-11): runes gate — one edit of EVERY
      kind (input/re-tune/pin/re-route) → exportWire → parseThemeWire
      (the real ingress) → re-init → exportWire DEEP-EQUAL; envelope
      re-parseable. Plus handoff-seed + undo/redo gates already in
      studio-store.runes.ts.
- [x] No console errors across the full session walk (2026-06-11);
      Validate ▦ accuracy GATED: the matrix renders all 4 polarity ×
      contrast cells with verdicts + charts, and JUDGES PINNED VALUES
      (same-grey header-fill fg/bg pin flips 0 → 4 warn cells). Probe
      lesson: the invariant set covers header bands + body text, NOT
      every token — a title-token pin is legitimately unjudged.
      AREA H COMPLETE.
- [x] Everything beyond the above (richer studio layouts, multi-theme
      sessions, server-backed galleries) explicitly deferred post-1.0
      (2026-06-11).

### I. Zero-config first run
**Exit criteria:**
- [x] `tabviz(df)` auto-columns LANDED 2026-06-11 (R/auto-columns.R):
      type+name inference → col_numeric (counts get 0 decimals) /
      col_percent (0–1 + rate-ish name) / col_pvalue (p-name + range) /
      col_date / col_text; Title-Cased headers; label/group excluded;
      explicit columns always win; once-per-session hint; 9 behaviors
      test-locked; visually verified.
- [x] First-run path LANDED 2026-06-11: docs index now opens with
      "Thirty seconds to a first table" — zero-config `tabviz(trials)`
      live-rendered, then the one-minute staircase, then the hero.
      README leads with docs/images/readme-tour.gif (generated by
      srcjs/scripts/readme-gif.mjs: real widget, real sort click, real
      theme-switcher tour nejm→terminal→synthwave; regenerate after
      visual-identity changes) + the 30-second code block. Side
      catches: __row_number__ leaked into inference (internal fields
      now excluded); export(tabviz) had been DROPPED from NAMESPACE
      (see the namespace-integrity commit).
- [ ] Defaults reviewed deliberately at ship (the "decide late" rule
      comes due — register D9 etc.).

### J. Accessibility floor
Clinical/regulatory audience makes this table stakes.
**Exit criteria:**
- [x] Table semantics LANDED 2026-06-11: the CSS grid is a real ARIA
      table — role="table" + rowcount/colcount, display:contents row
      wrappers (layout-inert: WYSIWYG gate zero-delta), columnheader on
      ALL headers (was sortable-only; viz headers got keyboard-sort
      parity too), role="cell" everywhere (data cells were
      role="presentation" — the table was structurally INVISIBLE to
      screen readers), aria-expanded collapse-tracking on group rows,
      aria-hidden drawing layers. Survey + map:
      docs/dev/a11y-semantics.md. GATED: interaction-qa keyboardSort +
      tableSemantics legs (real input).
- [x] HC-fidelity vertical decided: KILLED (register D1, 2026-06-10).
- [x] Focus visibility + reduced motion (2026-06-11): ONE global
      prefers-reduced-motion kill-switch in theme-runtime.css covers
      every transition/animation in widget + chrome by construction
      (was 4-of-18 files); D16's smooth scroll guards via matchMedia;
      sortable headers got a :focus-visible ring on the new
      --tv-focus-ring token (the focus-ring ROLE finally has its
      emission — the drift gate forced the honest declaration).
- [x] Review pass done 2026-06-11 — 4 findings triaged in
      docs/dev/a11y-semantics.md (viz-marks text alternative ACCEPTED
      w/ guidance; paint-mode role flip ACCEPTED; keyboard edit path
      BACKLOG→area F; spacer verbosity ACCEPTED). AREA J COMPLETE.

---

## M3 — Ship mechanics

### K. R interface tidied + documented
**Exit criteria:**
- [x] API review DONE 2026-06-11: 211 exports inventoried (after the
      review deleted the deprecated SlotBundle alias). Findings: all 64
      modifier-family functions are object-first; col_* holds the
      field/header/width contract; camelCase only where htmlwidgets
      convention demands (render*/­*Output/elementId); cond()/condition()
      verified deliberate (reference vs define). ONE real defect fixed:
      viz_forest led with header while three documented examples called
      it positionally as (point, lower, upper) — the signature now leads
      with data fields, making those examples CORRECT (UNILATERAL
      (delegated): clean pre-release signature break, all internal
      callers named). Fresh R CMD check after: 0E/0W/0N.
- [x] Task guides read through 2026-06-11: all six guide pages render
      clean against the current API; the sweep caught and fixed stale
      culled-preset references (jama/lancet in shiny.qmd's app + a
      nonsensical fluent-api example, cochrane in the themes artifact
      sample) and retargeted them at surviving presets. The deep-dive
      architecture.qmd still describes the PRE-W4 theme model (variants/
      cell/annotation fields) — flagged for a docs pass, not API-load-
      bearing (deep-dive, not task guide).
- [x] `R CMD check` fully clean 2026-06-11 (END of session surgery):
      0 errors, 0 warnings, 0 NOTES — after wire 1.10, house styles,
      the viz_forest reorder, SlotBundle deletion, namespace-integrity
      gates. (The check run itself caught the namespace gate needing a
      source-tree skip and a test assuming nejm had no house style.)
- [x] Default-paginate threshold decided + implemented (D12,
      2026-06-11): 200 rows/group-break auto-default, FALSE opt-out,
      once-per-session hint, test-default-paginate.R locks all four
      behaviors.
- [x] Row-count envelope documented (2026-06-11): the interactivity
      guide's "How many rows?" section — smooth ≤200, auto-paginate
      default, 1k–5k degradation (bench-cited; arrange mode degrades
      first), 10k+ unsupported interactively (export/split/aggregate).
- [x] Windowed-flatten design note exists (2026-06-11):
      docs/dev/windowed-flatten-note.md — the flatten-projection seam,
      deterministic per-kind heights as the scroll-height model, the
      measure-loop/arrange/export interactions, and the do-nothing-for-1.0
      posture (pagination is the scale story).

### M. Wire freeze + release
**Exit criteria:**
- [x] All pre-freeze wire work (C0 inventory) landed (W1–W6, 2026-06-11).
- [x] WIRE FROZEN at 1.10 (2026-06-11, delegated authority — flagged):
      policy text flipped in both version files; the published schema
      describes the frozen shape; the freeze checklist in the inventory
      is fully executed. Nothing on the remaining roadmap needs a break.
- [~] Decision register at ONE entry (D9 — open by its own decide-at-
      ship rule; everything else Decided with rationale, 2026-06-11).
- [~] Release notes DONE (NEWS 0.38.0 + CHANGELOG 0.7.0-unreleased,
      2026-06-11); docs site CUT fresh same day (freeze cleared; 60
      sources → 102 pages, zero errors, against the current install).
      REMAINING — user's call: npm publish (0.7.0 staged, gate green)
      and the D9 joint review.
      **CRAN: MOVED TO DISTANT FUTURE** (maintainer, 2026-06-11 —
      "lots of work to do still"). The package keeps its CRAN
      discipline (clean checks stay a gate; the 5-platform matrix runs
      on every push) but submission is no longer a near-term milestone;
      the strict --as-cran TinyTeX run moves to whenever submission
      re-enters the horizon.

---

## Status log

- 2026-06-15 — **XSS EGRESS WALL on exported SVG (Area D / G — security).**
  Follow-on to the ingress sweep, on the OTHER end of the untrusted-wire
  contract: the SVG export is string-concatenated (no DOM auto-escaping) and
  embeds into HTML/Quarto, so any spec-DATA color reaching a `fill=`/`stroke=`
  attribute was a stored-XSS vector (`#fff" onload="alert(1)`). A security
  audit found the egress neutralizer (`getCssVars`) + ingress grammars
  (`isValidPinValue`, series_overrides `isValidHex`) defended THEME colors and
  pins, but spec-data colors had NO defense on either end — and only the badge
  renderer escaped. Added `escapeAttr` (= escapeXml) at egress to every
  spec-data color site: core renderer (forest marks/bars/box/violin via
  `ms.fill`/`ms.stroke`/`style.fill`, cell text `cellColor`, `row.style.bg`,
  reference-line + custom-annotation colors) AND the seven schema cell
  renderers (bar/progress/ring/sparkline/pictogram/stars/icon — escaped at the
  resolve-call definition; heatmap was already safe — computed hex). No-op on
  legitimate colors (so glyph-cell-parity/wysiwyg pixel gates stay green).
  Gate: `export/svg-xss.runes.ts` (payload reaches output escaped, never as a
  live handler). CLAUDE.md trap added.

- 2026-06-15 — **INGRESS-WALL HARDENING (Area D — "any language can drive
  the wire").** A systematic robustness sweep of the public spec/theme
  ingress surface found a class of "deref-before-validate" / "no-validate"
  gaps where a malformed wire spec crashed cryptically ("Cannot read
  properties of null") instead of failing with the intentional error. Fixed:
  (1) all THREE SVG-export entrypoints (`generateSVG` /
  `computeLayoutMetrics` / `computeNaturalDimensions`) validated `spec` only
  AFTER the transform pipeline had dereferenced it — `validateSpec` moved to
  the first line of each (gate: `svg-robustness.runes.ts`, 9 cases). (2) The
  live htmlwidget proxy `updateData` now validates-and-SKIPS on error-severity
  issues (logs a clear diagnostic; never corrupts the running widget) rather
  than crashing in setSpec's group walk. (3) `createTabviz.update()` now
  applies the same `assertValidSpec` ingress wall as the constructor. (4) The
  split store `setPayload` validates every reconstituted pane spec
  (pane-keyed clear error) — and the sweep CAUGHT A REAL BUG: R hoists the
  wire `version` to the payload ROOT, not into `base`, so merged panes lacked
  `version`; the merge now stamps it (gate: `split-payload-ingress.runes.ts`).
  Skipped deliberately: `buildTheme` (called very frequently with trusted
  preset-derived inputs; the real untrusted wall is `parseThemeWire`, already
  validating). The internal reactivity choke point `setSpec` is left
  unguarded ON PURPOSE — it fires on every paint/drag frame, so heavy
  per-call validation would be a perf regression; validation stays at the
  EXTERNAL boundary.

- 2026-06-13 — **MAINTAINER FEEDBACK PASS (settings/roles/borders) — batch
  1: crash fix + D9 reversal.** A live-testing pass surfaced ~11 issues,
  several pointing at brittle/hardcoded substrate. Landed first: (1) the
  `theme.layout.containerBorder` theme-switch CRASH — `computeLiveConfigVars`
  read the layout blob raw while guarding `series?.` right beside it; fixed
  by a shared `resolveContainerBorder()` (`lib/theme/layout-defaults.ts`)
  that also kills the triplicated magic `8` radius default (DOM emitter +
  SVG export + buildTheme now single-source it); regression-tested. (2) **D9
  REVERSED to MAXIMAL** interaction defaults — author-grade affordances
  (edit/reorder/axis-zoom/arrange) default ON; rationale: primary users are
  developers who tinker, edits are local. Reaches R/JS/Shiny via the
  unchanged baked tier. Gates green (1402 bun + 300 vitest; R 44/44).
  REMAINING from the pass (next batches, mostly one brittle root —
  role↔element legibility): hover-explanations for theme toggles + glow/glass
  reimagine-or-remove; density slider is vertical-only (H density matters
  more); rebind-role omits COLOR; "cell" role purpose; "ruled" border
  meaning; boxed-borders first-column anomaly (likely the D20 label
  special-casing); sliders commit-on-release vs on-change (duplicate
  component defs?); font-selector previews.

- 2026-06-13 — **AREA G: D8 RESOLVED — empirical estimator + label-flex
  unification close the WYSIWYG flex-parity gap.** The V8/export
  text-width estimator's hand-tuned character-class multipliers (magic
  numbers, ~7% over-budget) were replaced by REAL per-glyph advance tables
  measured offline from every preset's actual webfonts at 400/700, with
  serif/sans/mono class fallbacks + continuous-axis weight interpolation
  (`font-metrics.generated.ts`, `measure-font-metrics.mjs`,
  `npm run regen:font-metrics`; sub-pixel vs canvas). The sub-pixel
  estimator UNMASKED a real divergence (label flexed in the DOM but was a
  separate export scalar; viz naturals mismatched) — root-caused to D20
  item-4 and fixed: the primary column now joins the export multi-flex set
  (pins under provided widths, flexes from-scratch) and viz columns measure
  to visual-min like the DOM. WYSIWYG gate 5→0 breaches, 178→155 findings
  (tighter). Full validation green: layout-metrics 26/0 (snapshots
  regenerated — pure width redistribution, geometry preserved), TS 1398
  bun + 298 vitest, forest-marks ≤1px, lint 0, check 0; R 85/85
  (render-smoke/save-plot/parity/systemfonts); visual eyeballed clean.
  Branch `wip/empirical-text-metrics` (2087168 estimator + 7edcf73 D20-4).
  D20 item-4 width-threading half DONE; structural `columns[0]` membership
  stays coupled to wire-frozen item (1), post-1.0.

- 2026-06-12 — **SETTINGS REDESIGN COMPLETE — PHASE 5 (STYLING)
  LANDED.** All five surfaces shipped (Variations · Labels · Identity ·
  Plots · Styling). StylingTab: density_factor dial (Variations
  signpost target) + full kind-filtered color-role remapping + text-role
  rebinds + carried-override release — all via SANCTIONED verbs (DT-11
  held, band-contract 23 tests). Registered D25: per-token spacing /
  pin-creation / component re-routing need new sanctioned verbs
  (post-1.0). Consequence harness 51 controls; liveness 85 repaints.
  The accreted panel + studio presentation is fully retired; substrate
  unchanged. Full record: settings-redesign.md ("Build complete").

- 2026-06-12 — **SETTINGS REDESIGN PHASE 4 (PLOTS) LANDED.** "Edit
  theme" is now an inner cluster (Identity | Plots); PlotsTab gives
  per-series shape/fill/stroke control (L3 freeform). NEW substrate:
  series_overrides theme-input (full TS+R+wire parity, hex/shape
  gated). REAL renderer bug fixed (harness-surfaced): multi-effect
  forest CI lines hardcoded series[0].stroke — now per-slot, in DOM +
  export together (WYSIWYG + forest-marks green). 45 controls + both
  resets green; liveness 76 repaints. Record: settings-redesign.md
  Phase 4.

- 2026-06-12 — **SETTINGS REDESIGN PHASE 3 (IDENTITY) LANDED.** Real
  IdentityTab (anchors + status + monochrome + font families + geometry
  + data scheme) replaces the interim ThemeBand (deleted; Tier1Sections
  stays for the dormant studio). Consequence-or-absence finding: the
  categorical scheme is inert on single-series figures — now gated on
  hasMultiSeries. Harness extended (select/dropdown ops, anchor hex
  typing, quiescent screenshots); 39 controls + both reset travels
  green; liveness 72 repaints. Record: settings-redesign.md Phase 3.

- 2026-06-12 — **SETTINGS REDESIGN PHASE 2 (LABELS) LANDED.** Labels
  tab (title/subtitle/caption/footnote/tag fields + watermark) on the
  spine; tag promoted to a first-class label slot (op kind + R
  set_tag()); figure reset now covers label edits. REAL BUG: the
  widget proxy table had no setLabel handler — R's set_title(proxy,…)
  family was silently dropped on live Shiny widgets; fixed + covered.
  Consequence harness extended (Labels walk + Reset-figure travel; 27
  controls green). Record: settings-redesign.md Phase 2.

- 2026-06-12 — **SETTINGS REDESIGN PHASE 1 (VARIATIONS) LANDED** + D23
  DECIDED (all 9 presets bless the polarity flip, no pins — battery in
  the register). The panel carries the real tab spine; Variations is
  the landing tab with 16 theme-input controls; `banding`/
  `banding_start` promoted to Tier-1 inputs end-to-end (TS+R+wire);
  the NEW consequence harness (settings-consequence.browser.ts,
  CI-gated) pixel-diffs every control and already caught the
  gradient×shell-mode inertness + drove the row-level gates. Liveness
  + interaction-qa rewritten for the spine. Full record:
  settings-redesign.md Phase 1.

- 2026-06-12 — **SETTINGS UX TOTAL REDESIGN OPENED** (D21; canonical
  record docs/dev/settings-redesign.md). The maintainer's layer
  taxonomy locks five surfaces (Variations · Labels · Identity ·
  Plots · Styling); old panel + studio presentation superseded
  (substrate unchanged). Studio DORMANT (D22, de-documented); a11y
  polish deferred to pre-CRAN (D24); polarity-as-variation open as D23
  (9-preset flipped battery before Variations ships). Plan: Phase 0
  removal first — nothing new until the old surfaces are gone — then
  tab-by-tab with a consequence gate (visible-pixel delta) replacing
  fingerprint liveness as the merge bar.

- 2026-06-12 (early) — R presets GENERATED from the TS literals
  (propagation flag #2 resolved; −231 net lines): fixpoint-verified
  value-identical imports, web-font URL table moved to TS as single
  source (also fixing npm's silent webFonts:[] gap), FONT_URLS retired.
  All three workflows green on the commit (js-ci 3m53s, 5-platform R
  matrix 4m45s, Quarto Publish). Six of seven propagation red flags
  now resolved or gated; only #6 (toolbar placement, a UX call)
  remains.

- 2026-06-11 (late) — CRAN submission moved to DISTANT FUTURE by
  maintainer ("lots of work to do still"); check discipline unchanged.
  CI fully green on the sizing-arc commits (js-ci + 5-platform R
  matrix); Node-24 forced-cutover opt-in pushed ahead of the
  2026-06-16 deadline.

- 2026-06-11 (SESSION SWEEP — areas C, D, F, G, H, J closed; I at
  pre-ship scope). The day's arcs: 9-preset WYSIWYG battery + matrix
  fixture extension (pvalue/bar; caught the nejm pill inflating compact
  rows); ARIA table semantics + a11y review pass (4 findings triaged);
  spec-first completed (consumer docs+fixture, structured spec errors
  with ingress wall, dependency-free MCP server + stdio smoke);
  area-H tail (rail value-control walk, PinsPanel flow, Validate ▦
  accuracy, lossless round-trip gate); area-F surface walks (5 new
  interaction-qa scenarios; zoom-dropdown Escape fixed; last-column
  hide floor); zero-config first-run docs page + README GIF; area C
  closed (5 preset house styles, #65 re-base fix, and THE catch: six
  column types silently text-degrading in every headless export —
  boot-split fixed + gated by schema/boot-coverage.test.ts). Cross-
  cutting: propagation-readiness survey (docs/dev/
  propagation-readiness.md); namespace-integrity + Collate gates after
  export(tabviz) was found dropped. REMAINING (8 open lines): K's API
  review + task-guide tails + check re-verify; M's release notes +
  docs cut (agent-executable); D9 ship-time defaults review (joint);
  branch protection + npm/CRAN credentials (user).

- 2026-06-11 (W4 COMPLETE) — ALL PRE-FREEZE WIRE WORK DONE (W1–W6).
  W4 executed across one extended session: blob slimmed (marks, cell,
  annotation, semantic, columnGroup, lightDarkPair, text, variants,
  firstColumn, borders all deleted — wire 1.6→1.10); every v3 recipe
  ported pixel-faithfully into named resolver groups (header-active,
  first-col, borders, ramp-direct + role/anchor/const/typography
  entries) or decided (D18 title→text, delegated authority);
  computeV3BridgeVars DELETED (live-config overlay = series slot 0 +
  layout only). Dividends along the way: a live double-source header
  paint bug killed; first_column_style + dead "tint" enum rationalized;
  cell paint states + group-header + first-column + header-cell active
  trio all became live component-model channels. The M3 freeze can take
  1.10's shape. Remaining non-wire W4 cleanup (header/rowGroup/row
  cluster field slimming) is ordinary debt, not freeze-blocking.

- 2026-06-11 (later still) — W3 LANDED (variants.headerStyle retired,
  wire 1.6; duplicated R S7 mirror slot deleted) + W5 DECIDED
  (hiddenColumns stays in initialState — authored-defaults family;
  figureLayout extension is additive if ever needed). New docs-drift
  gate (test-docs-drift.R) validates columns.qmd's curated table against
  live formals — first run caught 2 more stale rows. Pre-freeze wire
  work remaining: W2 (review fallout) + W4 (v3 blob slimming).

- 2026-06-11 (later) — D11 EXECUTED: consumedBy sweep complete, drift-gate
  grandfather list 119 → 0. Found + fixed a live area-F instance
  (currency symbol/position dead editor menus) and a 7th D2-class dead
  option (viz_violin maxWidth). New behavior vocab entry: naturalHeight.

- 2026-06-11 — Area C opened: D2 executed (6 dead column options deleted
  both sides + docs; W1 done). Same day, area A COMPLETED (perf gate; the
  bun bench itself had rotted — repaired + gated). Remaining area-C work:
  the ontology review proper (vocabulary/kind/DAG → W2 list), D11
  consumedBy arc, column_defaults-in-presets design work.
- 2026-06-11 — Area E STAGE 1 LANDED (W6): component-model substrate +
  wire. The middle verb (re-route) works end-to-end R→wire→both resolve
  paths; v3-bridge stamps are suppressed for re-routed tokens (full
  retirement stays W4). Honesty gate added: annotations only on
  resolverGroups that honor re-routes. Side-fix: R type-role family vocab
  accepts "numeric" (R↔TS wire-drop asymmetry). Stage 2 (chip-grid +
  components page UI) is next in area E.
- 2026-06-10 — Document stood up. Decision register populated (14
  entries). Same day: D1 decided (HC vertical killed, code deleted) and
  D14 decided (theme_blend + split static-knit cut from 1.0).
- 2026-06-11 — Area E redesigned around the COMPONENT MODEL
  (docs/dev/component-model.md): three-verb grammar, typed channel
  archetypes (text/border/surface/icon/decorative), sparse states,
  curated ~25-component regional roster; W6 added to the wire-freeze
  inventory; D17 (role naming review) filed. Studio trace bug fixed
  (AliasTable display-id leak — the user catch that started the thread).
- 2026-06-10 — M0 substantially landed: js-ci.yaml (ts-suite +
  browser-gates jobs); wysiwyg gate mode (0 breaches, budgets
  register-annotated, D15 filed); all suites fully green (the "jsdom
  canvas" known failure was a harness bug); wire-freeze inventory stood
  up. Open in M0: perf thresholds, branch protection, first-push
  verification. Recent context: interactivity-UX arc (P0–P2) shipped; WYSIWYG
  fidelity pass shipped (shell/paper export parity, typography role
  alignment); search-and-destroy cleanup shipped (−3.9k lines, gates
  repaired, KNOWN_UNCONSUMED 120→49).

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
      R-CMD-check.yaml 5-platform matrix. (2026-06-10 — verify green on
      the first real push.)
- [x] CI runs the browser harnesses headless: js-ci.yaml `browser-gates`
      job (`arrange-tool`, `forest-marks`, `measure-rows`,
      `details-panel`, `panel-liveness`, `interaction-qa`) — all verified
      passing locally first (2026-06-10).
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
- [ ] CLAUDE.md instructs agents: deferring a product call ⇒ register
      entry; landing an arc ⇒ roadmap status line. (Done 2026-06-10 —
      verify it's being followed at each milestone review.)

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
- [ ] Column ontology reviewed: option vocabulary coherent across types,
      `kind` taxonomy (core/styling/editor) complete, the 6 dead options
      ~~decided~~ DECIDED+DELETED (D2, 2026-06-11), inheritance DAG
      documented.
- [x] All grandfathered options carry `consumedBy` annotations; the
      grandfather list is EMPTY (119 → 0, 2026-06-11; the sweep also
      killed 3 more dead options — currency editor menus + violin
      maxWidth).
- [ ] ≥ 4 shipped presets use `column_defaults` to visible, deliberate
      effect (e.g. clinical theme styles p-value columns; editorial theme
      styles badges/bars distinctly) — reviewed as *design*, not plumbing.
- [ ] Theme-level column logic is documented for theme authors (R + JS).

### D. Spec-first contract shipped for real
**Exit criteria:**
- [ ] JSON Schema generated from `SCHEMA_REGISTRY` + option metadata,
      published with the npm package; a hand-written spec validates.
- [ ] npm `@tabviz/core` consumable by a third party: JS-author docs
      (mount a widget, author a spec, themes) exist; dist-smoke extended
      to a real "external consumer" fixture.
- [ ] MCP server exposing schema introspection + spec validation +
      render-to-SVG (the LLM-driver path) — minimal but real.
- [ ] Structured errors (ThemeIssue-style `{path, code, message}`) cover
      SPEC validation, not just themes (folds in roadmap area "error
      experience").

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
- [~] Stage 2 color channel — SETTINGS HALF LANDED 2026-06-11:
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
      history[0]). REMAINING for the Stage-2 checkbox: liveness-walk
      coverage of the new controls (area-F harness work).
- [x] Stage 3 text channels — LANDED 2026-06-11: family/size/weight
      slot-chip pickers in ComponentsEditor (both hosts); the design
      doc's motivating example (axis-label → numeric/regular) verified
      end-to-end. Honesty filter still governs which channels appear
      (figures + the unconsumed-token channels join when their consumers
      land — they are SUBSTRATE-ready, the resolver honors them).
      Icon/indicator records remain design work (no manifest tokens yet).
- [~] Stage 4 states + decorative: paint/interaction STATES are LIVE
      already (Stage-2 editor renders state·channel rows — row alt/hover/
      emphasis, cell paint states, header variants all editable);
      caption-chip records live. REMAINING: gradient-strip + watermark
      decorative records (watermark is currently FIGURE state — moving a
      theme-level twin needs a design call) + the HC-as-state-overlay
      exploration note.
- [ ] v3 theme-css bridges (#72–74 clusters) retired into the component
      table (joint with W4).
- [ ] Every editing surface names its verb + what the edit travels with
      (theme / figure / view); one user-facing mental-model page; the
      introspection story (`list_roles()` / `component_schema()` /
      `inspect_token()`) cross-referenced in docs.

---

## M2 — Experience hardening

### F. Interaction quality (zero dead UI)
Dead menus in the column-config settings are the symptom; the discipline
is a liveness audit across ALL surfaces.
**Exit criteria:**
- [ ] `panel-liveness`-style walk extended to: column editor (the known
      dead menus fixed), header context menu, filter popovers, column
      type menu, zoom dropdown, arrange seams, pager. Zero dead controls
      (or justified-no-op allowlisted with reasons).
- [ ] Empty/disabled states designed, not accidental (no menu renders
      options that can never apply).
- [ ] Gesture grammar audit holds: preview/commit/Escape/double-click
      uniform (re-verified by the arrange gate + new walks).

### G. WYSIWYG as a contract
**Exit criteria:**
- [ ] The declared exception list is short, explicit, user-documented:
      browser-only effects (glass/glow/blobs) + anything else we
      consciously add. Everything else matches within budget.
- [ ] wysiwyg-diff budgets green across the full theme/density/shell
      matrix (CI, area A).
- [ ] The remaining known divergences either fixed or moved to the
      exception list via register decisions: estimator column widths
      (D8), group-header banding scope + chevron indent (D10),
      shell-strip/chip/elevation in export, pagination contract (D7).
- [ ] `save_plot()` PDF/PNG spot-checked against the widget for the 9
      presets (extend visual battery with DOM-vs-export pairs).

### H. Studio: good enough
Deliberately scoped down — correct and unsurprising, not flagship.
**Exit criteria:**
- [ ] No dead controls (liveness walk over the studio rail/tabs).
- [ ] Round-trips lossless: handoff in, envelope out, undo/redo sane.
- [ ] Validate ▦ and contrast banners accurate; no console errors in a
      full session walk.
- [ ] Anything beyond this explicitly deferred post-1.0.

### I. Zero-config first run
**Exit criteria:**
- [ ] `tabviz(df)` with no columns produces a genuinely good table
      (auto-columns: type inference → sensible col_* choices, the
      versatility-H2 design).
- [ ] The first-run path is the first page of the docs and the README
      GIF; under 30 seconds to something impressive.
- [ ] Defaults reviewed deliberately at ship (the "decide late" rule
      comes due — register D9 etc.).

### J. Accessibility floor
Clinical/regulatory audience makes this table stakes.
**Exit criteria:**
- [ ] Table semantics + `aria-sort` + keyboard sort (the deferred
      interactivity Phase 3).
- [x] HC-fidelity vertical decided: KILLED (register D1, 2026-06-10).
- [ ] Focus visibility + reduced-motion verified across chrome.
- [ ] One a11y review pass (agent or manual) with findings triaged.

---

## M3 — Ship mechanics

### K. R interface tidied + documented
**Exit criteria:**
- [ ] API review: exported surface inventoried; naming/argument-order
      consistent (col_* contract holds everywhere); deprecations done
      cleanly (pre-release = deletions allowed).
- [ ] Reference docs complete (roxygen, no pkgdown per house rule) +
      task-oriented vignettes/Quarto guides for: first table, theming,
      columns, Shiny, export.
- [ ] `R CMD check --as-cran` clean (0E/0W + the 2 known env NOTEs).

### L. Scale posture (honesty as a feature)
**Exit criteria:**
- [ ] Default-paginate threshold decided (register D12) + implemented.
- [ ] Documented row-count envelope: what's smooth, what degrades, what's
      unsupported; arrange-mode degradation noted.
- [ ] Windowed-flatten design note exists for post-1.0 virtualization.

### M. Wire freeze + release
**Exit criteria:**
- [ ] All pre-freeze wire work (C0 inventory) landed.
- [ ] Wire policy flips to additive-only minors; documented in both
      version files; JSON Schema versioned alongside.
- [ ] Decision register cleared (B).
- [ ] npm publish + CRAN submission; release notes; docs site cut.

---

## Status log

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

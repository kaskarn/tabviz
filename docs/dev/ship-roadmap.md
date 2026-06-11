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
- [ ] CI runs on every push: bun + vitest suites, svelte-check, eslint
      (errors), bundle budget, lockfile parity, R CMD check (or
      devtools::test at minimum), the component-token + column-option
      drift gates.
- [ ] CI runs the browser harnesses headless: `arrange-tool`,
      `forest-marks`, `measure-rows`, `details-panel`, `panel-liveness`,
      `interaction-qa`.
- [ ] `wysiwyg-diff.browser.ts` runs as a **budgeted gate**: per-case
      numeric budgets (geometry ≤ small px tolerance; typography exact),
      with the declared-exception list (see area E) encoded, not implied.
- [ ] Perf benches run with regression thresholds against checked-in
      baselines (bun bench at minimum; browser bench at least weekly).
- [ ] A gate failure blocks merge. No "known failure" lives longer than
      one documented entry with an issue link (current allowance: the
      layout-zoom.runes jsdom canvas test).

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
- [ ] Inventory of remaining wire-shape changes (column ontology work,
      figureLayout refinements, theme inputs additions) exists with each
      item scheduled pre-freeze or explicitly deemed additive.

---

## M1 — Contract & substance

### C. Columns as a design medium *(start early — creative iteration time)*
The schema + `column_defaults` machinery exists; no shipped theme uses it
expressively. This is what makes the 9 survivor themes feel like designed
objects rather than palettes — and it exercises the machine contract.
**Exit criteria:**
- [ ] Column ontology reviewed: option vocabulary coherent across types,
      `kind` taxonomy (core/styling/editor) complete, the 6 dead options
      decided (register D2), inheritance DAG documented.
- [ ] All ~125 grandfathered options carry `consumedBy` annotations; the
      grandfather list is ≤ a handful of justified rows.
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

### E. Ontology legibility (T1–T2–T3 engagement)
The cascade is architecturally real but experientially muddy.
**Exit criteria:**
- [ ] Every editing surface signals which tier it touches and what the
      edit travels with (theme / figure / view) — the persistence-tier
      vocabulary made visible.
- [ ] One documented mental-model page (user-facing) explains anchors →
      roles → tokens with the studio's pedagogy as the deep dive.
- [ ] `list_roles()` / `column_schema()` / `inspect_token()` form a
      coherent, cross-referenced introspection story in docs.

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

- 2026-06-10 — Document stood up. Decision register populated (14
  entries). Same day: D1 decided (HC vertical killed, code deleted) and
  D14 decided (theme_blend + split static-knit cut from 1.0). Recent context: interactivity-UX arc (P0–P2) shipped; WYSIWYG
  fidelity pass shipped (shell/paper export parity, typography role
  alignment); search-and-destroy cleanup shipped (−3.9k lines, gates
  repaired, KNOWN_UNCONSUMED 120→49).

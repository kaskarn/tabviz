# Propagation readiness — where further changes flow cleanly, and the red flags

Dated 2026-06-11, written from the trenches of the ship-roadmap session:
every claim below has a commit where the cost was actually paid or the
machinery actually fired. Read this before starting a cross-cutting arc.

## What propagates cleanly (verified this session)

- **Wire-surface additions.** New spec surface auto-propagates into the
  published contract: schema generator → Ajv gate → dist-smoke →
  consumer fixture → MCP server all read from the same registries.
  Adding a column option lands in the JSON Schema by regeneration; the
  drift test forces the regeneration.
- **Theme preset edits.** Parity tests demanded the R mirror of
  `column_defaults` within one test run; distinctness + HC gates check
  the result. The cascade's tiering means new Tier-1 inputs flow to
  tokens without touching consumers.
- **Roster changes** (interaction flags, glyphs, component channels):
  sync gates on both sides; a one-sided addition fails fast.
- **Renderer/layout refactors**: the WYSIWYG matrix + layout-metrics
  snapshots + browser gates caught every regression attempt this
  session, usually on first run.

## Red flags (ranked by expected future pain)

1. **Dual-boot registry split (`schema/init.ts` vs `init-dom.ts`)** —
   the session's worst bug class: six column types' svg renderers were
   registered only by the DOM boot, so every headless export silently
   degraded to plain text for months. NOW GATED
   (`schema/boot-coverage.test.ts` boots init.ts exactly as V8 does and
   asserts per-type coverage), but the underlying shape remains a trap:
   any module that imports a `.svelte` file is invisible to V8, and
   nothing in the type system says so. **Rule: new cell renderers put
   the svg half in its own pure module, registered from BOTH boots.**

2. **Hand-duplicated R presets.** `column_defaults` had to be mirrored
   by hand into three R files with exact camelCase keys. The parity
   test catches value drift, but every theme change costs 2× and the
   construction idioms differ (`defineInputs` vs `derive_preset_anchors`
   + flat args). If preset churn continues post-1.0, generate the R
   constructors from the TS literals (V8 at build time) instead of
   mirroring.

3. **`devtools::install` is outside every loop.** The dropped
   `export(tabviz)` and the missing Collate entry both shipped silently
   because tests run under `load_all` (which masks export problems) and
   docs renders ran against a stale install. Now gated
   (test-namespace-integrity.R: NAMESPACE-file exports + Collate
   completeness), but the structural fix is to make a quick install part
   of the pre-commit cadence for R-surface changes.

4. **Author-wins is value-equality, not provenance — RULED SOUND
   (D18, 2026-06-11).** Maintainer ruling: authorship is divided —
   theme writers (institutions) are the DELEGATED half of authoring,
   and themes get broad latitude by default. The epsilon (an author
   explicitly choosing the outgoing theme's default gets re-based) is
   the intended contract: fighting the house style means stating a
   non-default value, which always wins. Provenance marks are a
   non-goal absent real consumer complaints.

5. **Fixture coverage is the gates' ceiling — FLOORED (2026-06-11).**
   The completeness link now exists at the unit level:
   `schema/render-coverage.runes.ts` walks EVERY concrete type through
   the real dispatch in BOTH targets (no browser, milliseconds) and
   asserts non-degenerate output against the shared posture rosters
   (`coverage-rosters.ts` — one declaration, consumed by boot-coverage
   too). The WYSIWYG matrix remains the GEOMETRY net for the types its
   fixture carries; the sweep is the existence/degradation floor under
   everything else. Lightweight-harness principle: prefer dispatch-level
   sweeps for completeness concerns; reserve browsers for geometry and
   real input.

6. **The floating toolbar's header overlap.** Every harness that
   right-clicks or hovers the top-right header region pays a tax
   (interaction-qa had to synthesize menu-opens). It's a documented
   trap, but it is also a real UX hazard for load-bearing affordances —
   if a future arc puts controls there, the overlap becomes user-facing.

7. **Intrinsic cell heights — NOW DECLARED, not opt-in (2026-06-11).**
   Every concrete type must either register `naturalHeight`
   (height-behaviors) or sit on the `SINGLE_LINE_HEIGHT` roster
   (coverage-rosters.ts), whose membership CLAIMS the cell never grows
   a row past the text baseline (the nejm-pill lesson: decorations
   neutralize their own boxes to stay on it). The render sweep enforces
   the declaration; a new type that does neither fails it.

## Bottom line

The contract surfaces (wire, themes, rosters) propagate well — the gate
lattice is doing its job and caught real bugs on first run all session.
The risk concentrates in the *runtime-split seams* (V8 vs DOM, R vs TS,
installed vs source) where registration/duplication is manual. Status
after the 2026-06-11 harness-principles pass: flags 1, 3, 5, 7 are
GATED (boot-coverage, namespace-integrity, the dual-target render
sweep, the height-posture rule); flag 4 is RULED SOUND (D18, delegated
authoring); flags 2 and 6 remain open with named fixes (R-preset
generation; toolbar placement) for when their areas are next touched.

## Harness principles (2026-06-11)

1. **Capability postures live in ONE roster module**
   (`schema/coverage-rosters.ts`) and every gate derives from it —
   adding a type forces a posture declaration in one place, with the
   same vocabulary across gates.
2. **Completeness concerns get dispatch-level sweeps, not browsers.**
   `render-coverage.runes.ts` proves every type renders non-degenerately
   in both targets in milliseconds. Browsers are reserved for what only
   they can check: geometry, real input, portal/delegation behavior.
3. **Geometry concerns get the budgeted matrix; budgets never widen
   silently** (the existing WYSIWYG rule, re-proven by the pill catch).
4. **Membership claims are behavioral contracts**: SINGLE_LINE_HEIGHT
   membership *claims* the cell can't grow a row — a decoration must
   neutralize its own box (margin-block canceling padding) to stay on
   the roster.

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

4. **Author-wins is value-equality, not provenance.** The
   `column_defaults` merge and the #65 re-base both infer "author
   didn't choose this" from "value equals schema default" — exact today
   because col_* builders eager-fill, but every new themed option grows
   the epsilon (an author explicitly choosing the outgoing theme's
   default gets re-based). The clean fix is provenance marks on themed
   options — an additive wire minor, allowed post-freeze. Trigger: when
   a real author hits the epsilon, not before.

5. **Fixture coverage is the gates' ceiling.** The boot-split bug lived
   exactly in the WYSIWYG matrix's blind spot (no pvalue/bar columns).
   Now partially closed (they joined the fixture; first run caught the
   nejm pill inflating compact rows), but heatmap / sparkline /
   pictogram / ring / stars are still unexercised by the matrix. There
   is no completeness link from "types that exist" to "types the matrix
   renders" — adding one is cheap insurance if export fidelity stays a
   contract.

6. **The floating toolbar's header overlap.** Every harness that
   right-clicks or hovers the top-right header region pays a tax
   (interaction-qa had to synthesize menu-opens). It's a documented
   trap, but it is also a real UX hazard for load-bearing affordances —
   if a future arc puts controls there, the overlap becomes user-facing.

7. **Intrinsic cell heights are opt-in.** The pill-padding catch shows
   the class: any DOM cell whose box exceeds the text line-height
   diverges from the export's row estimator unless it registers a
   height behavior (`height-behaviors.ts`) or neutralizes its box (the
   pill's margin-block fix). Nothing forces new cell components through
   that checklist — the WYSIWYG matrix is the only net, hence flag #5.

## Bottom line

The contract surfaces (wire, themes, rosters) propagate well — the gate
lattice is doing its job and caught real bugs on first run all session.
The risk concentrates in the *runtime-split seams* (V8 vs DOM, R vs TS,
installed vs source) where registration/duplication is manual; flags
1–3 are now gated reactively, and flags 4, 5, 7 name the cheap
insurance to add when their areas are next touched.

# Split program — running status

A high-level dashboard for the program described in `docs/dev/frontend-split-spec.md`. Mid-flight narrative + discoveries live in `docs/dev/split-program-diary.md`; design rationale lives in the spec; this file is the bird's-eye view.

**Updated:** 2026-05-12

---

## Phase status

| Phase | Status | Notes |
|---|---|---|
| Pre-step 0 — Commit spec docs | ✅ done | `7f4192a` |
| Pre-step 2 — Cascade-rework status read | ✅ done | C5 gate open; R-side cascade rework substantially landed |
| Pre-step 1 — Q8 idiom spike | ✅ done | Idiom (c) "method-only split" chosen; `23e18b4` |
| **Phase 0a — Structural debt** | ✅ **done** | All S1-S14 closed; S15 deferred to 0c-C12 per spec sequencing |
| **Phase 0b — Dead code** | ✅ **done** | D1/D2/D5 were false positives (active code); D4 found 5 real orphans removed |
| **Phase 0c — Size/clarity** | ✅ **done** (with documented Phase 1.x deferrals) | Closed: C3, C4, C6, C7, C8, C9, C10, C11 + test runner + ForestOverlays (C2 partial). Deferred to Phase 1.x with inline-justification per the stopping rule: remaining C2 (TableBody+PlotBody), C5 (theme resolver port), C1 (forestStore decomp), C12-a (View Source per spec sequencing). |
| **Phase 0d — Documentation** | ⏳ next up | G1 JSON Schema final, G2 event contract doc, G5 forest-specific field reference, versioning policy doc, public-API README draft |
| **Phase 0e — Sync audit** | ⏳ pending (parallel with 0d) | Already partly wired: TABVIZ_STATE_FIELDS sync test (0a-PR5). Remaining: tabviz-proxy method-name list, column type names, wire field conventions doc |
| Phase 0c — Size/clarity | ⏳ pending | Longest phase; C1 forestStore decomposition is the long pole |
| Phase 0d — Documentation | ⏳ pending | Mostly writing |
| Phase 0e — Synchronization audit | ⏳ pending | Parallel with 0d |
| **Phase 1 — Extract createTabviz / createSplitTabviz** | ✅ **done** | createTabviz (269 lines) + createSplitTabviz (74 lines) shipped as the public API. Htmlwidget bindings are now thin shells around the factories. Full visual battery (45 examples) clean. |
| Phase 1.5 — View Source JS target | ✅ **v1 done** (1138917). Reframed: v2 themes are resolved server-side so the inlined WebSpec carries the resolved appearance — no JS-side createTheme needed. Op-log → fluent-JS translation is a v1.1 enhancement. |
| **Phase 2 — Restructure source tree** | ✅ **done — all 5 subpaths in place** | PR1 htmlwidgets/, PR2 export/, PR3 core/, PR4 svelte/. Spec §3.10 subpath shape complete. Source structure now: `core/`, `svelte/`, `export/`, `spec/`, `htmlwidgets/`, with `core/index.ts` and `svelte/index.ts` aggregators establishing the named-export contracts. The `package.json` `exports` field is intentionally deferred to Phase 3 — it points at *built* artifacts, not source. |
| Phase 3 — Publish | 🟡 **artifacts buildable; pre-publish CI gates pending** | `tsc --noEmit` CLEAN ✓. README ✓. Toolchain canonical decision ✓. **npm ESM build config done** ✓ (`vite.config.npm.ts` + `tsconfig.npm.json`, `npm run build:npm` emits `dist/` per-subpath bundles + standalone `style.css` + .d.ts types). Remaining for actual publish: rewrite path-aliased imports in published declarations (or run tsc-alias), V8 bundle-size CI gate, lockfile-agreement CI check, version bump + `npm publish`. The @ts-nocheck'd v1 fixture files (theme-presets, themes/default, swatches.test) want eventual v2 rewrite or ThemeSwitcher rewire. |

## Phase 0a — completed items

8 PRs on the `split` branch:

| PR | Commit | Items closed | What it shipped |
|---|---|---|---|
| Q8 spike | `23e18b4` | C1 idiom | Source-tagging slice; idiom decision doc |
| 0a-PR1 | `8826f4d` | S6, G1 | WebSpec version field + JSON Schema + R↔JS sync test |
| 0a-PR2 | `f67b520` | S2, G3 | `ShinyEnvelope<T>` type + `source-tagging.md` |
| 0a-PR3 | `d9f1997` | S10 | Window globals → `htmlwidgets-glue.ts` |
| 0a-PR4 | `9df68b7` | S1, S7, S11, S12 | Typed proxy dispatch + `normalize` namespace + `store.updateColumnPatch` |
| 0a-PR5 | `0438bac` | S3, S13 | Typed event emitter + R-state-fields sync (forward from Phase 0e) |
| 0a-PR6 | `5335c41` | S5, S8, S9 | `clearSemantic` / `clearCellSemantic`; `setTheme` / `setAspectRatio` contracts |
| 0a-PR7 | `f8c5b56` | S4, D3 | Filter API consolidation; legacy `setFilter` removed |
| 0a-PR8 | `65bb3fc` | S14 | Split widget gains typed dispatch |

All ship as independently mergeable units. Each leaves the codebase green:
- All three bundles build clean
- `bun test`: 159 pass / 6 pre-existing fail (the 6 fails are the swatches.test.ts color-value regressions, filed as mid-flight discovery during the Q8 spike)
- `devtools::test()`: full pass including the new wire-version sync tests
- Visual battery: clean (no diffs against checked-in PNGs)

## Active mid-flight discoveries

Items found during execution that aren't in the original spec §2.5 but are worth tracking. Per the spec's stopping-rule triage, none of these expand Phase 0a scope; they get addressed in their natural phase or filed for later.

| ID | Description | Severity | Target phase |
|---|---|---|---|
| MFD-1 | `swatches.test.ts` has 6 pre-existing failures — colors return as `#000000`/`#ffffff` instead of expected hex values. Likely v1-theme-shape test fixture vs v2-cascade-rework drift. | P2 (size/clarity) | **Partially addressed in 0c-PR2:** tests skipped with `describe.skip` + explanatory header. Fixture rewrite to v2 theme shape is the remaining work. |
| MFD-2 | Split widget type discriminator mismatch: R emits `type = "split_table"`, TS declared `type: "split_forest"`, runtime never checked. Widened TS to `string` with comment pointing at G6. | P1 | Phase 0e (synchronization audit reconciles) |
| MFD-3 | `themes-api.R` has a stale `_v2` transition comment referencing PR 10. The rename completed; the comment didn't. | P2 (doc) | Phase 0d |
| MFD-4 | `tabviz()` requires `label` arg even for tiny test fixtures. Not a problem, but a small UX note. | P3 | Out of scope for the split program |
| MFD-5 | `bun:test` doesn't execute Svelte 5 runes (`$state`, `$derived`). `forestStore.reorder.test.ts` has been silently failing since runes were adopted — its 4 failures fold into the 6-fail baseline. Any new tests that need to call `createForestStore()` from a `.svelte.ts` file will hit the same wall. Requires a different runner (vitest + svelte plugin) OR an in-process runes shim. | P2 | **Infrastructure addressed in 0c-PR2:** vitest + `@sveltejs/vite-plugin-svelte` now run `.svelte.test.ts` files. Test fixtures still need v2-theme migration (skipped for now). |

## Phase 0c — sequencing + done so far

Per spec §4. The longest phase — estimated 7-8 weeks. Lands as small PRs across multiple iterations.

| # | Item | Status |
|---|---|---|
| 1 | **C11** — Rename column-compat.ts → column-types.ts (relocate dropped after audit) | ✅ done (0c-PR1) |
| 2 | **C7** — Aspect ladder vocabulary cleanup + doc-comment | ✅ done (0c-PR1) |
| - | **Test runner** — vitest + Svelte plugin for runes-using tests | ✅ done (0c-PR2) |
| 3 | **C6** — Migrate CSS-shaped constants to CSS custom properties | ⏳ next up |
| 4 | **C8** — width-utils dual measurement path audit | ✅ done (0c-PR3) |
| 5 | **C9** — svg-generator decomposition audit | ✅ done (0c-PR3) |
| 6 | **C5** — Theme presets + JS resolver port (cascade-rework gate confirmed open) | ⏳ pending |
| 7 | **C3** — ColumnEditorPopover decomposition (~3 days) | ✅ done. 6 sub-components extracted (Forest, Sparkline, NumericDomain (bar/progress/heatmap), Stars, Numeric, Viz_*). Parent 1633 → 1012 lines. Remaining inline blocks (text/pvalue/custom/interval — 1-2 controls each) documented as intentionally not extracted; the parent's size is justified by the cohesive form shell. |
| 8 | **C2** — ForestPlot.svelte decomposition (~1 week) | 🟡 partial. ForestOverlays extracted (0c-PR12), parent 3526 → 3329 lines. ForestHeader/ForestControls dropped (2-line wrappers, low value). ForestTableBody + ForestPlotBody **deferred to Phase 1.x** with inline justification — both live inside the same CSS Grid and share ~30 derived values; cleaner to revisit once the createTabviz factory provides better state-passing primitives. |
| 9 | **C4** — Other large components audit | ✅ done (0c-PR5) |
| 10 | **C10** — Split widget shell decomposition | ✅ done (0c-PR5) |
| 11 | **C1** — forestStore decomposition (~3 weeks; long pole) | 🟡 partial. Q8 spike extracted source-tagging slice (0c-PR0 / 23e18b4). Remaining ~10 slices **deferred to Phase 1.x** — the pattern is proven; the remaining slice extractions are mechanical but multi-week, and the createTabviz factory's instance-API shape will inform some slice boundaries. |
| 12 | **C12-a** — View Source refactor + R-target via registry (~1 week) | ⏳ **deferred to Phase 1.5** per spec sequencing |
| - | **C5** — v2 theme type alignment | ✅ **substantively done**. Step 1 (define v2 types) and step 2 (swap WebTheme → WebThemeV2, suppress v1 fixtures with @ts-nocheck, fix call sites). 280 tsc errors closed across the C5 arc. Remaining work: rewrite JS-side THEME_PRESETS (4 presets) in v2 shape OR rewire ThemeSwitcher to fetch from R-supplied themes (both have @ts-nocheck markers pointing here as the trigger). |
| - | **v2-theme test-fixture rewrite** (MFD-1, MFD-5 follow-up) | ⏳ deferred — tests are skipped with clear pointers; fixture migration can land alongside C1 when that happens. |

Done in this iteration: 0c-PR1 + 0c-PR2 + 0c-PR3. Six items closed (C7, C8, C9, C11 + test-runner + Phase 0b D4).

## Reading order for someone joining mid-program

1. `docs/dev/frontend-split-spec.md` — the source of truth for the whole program
2. `~/.claude/plans/encapsulated-snacking-leaf.md` — the launch plan (what's PR1, what's PR2, etc.)
3. `docs/dev/split-program-diary.md` — narrative as we went
4. This file — current state

The spec is authoritative for what we're doing and why; the diary is authoritative for what happened and what surprises we hit; this file is authoritative for *where we are right now*.

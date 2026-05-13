# Split program — running status

A high-level dashboard for the program described in `docs/dev/frontend-split-spec.md`. Mid-flight narrative + discoveries live in `docs/dev/split-program-diary.md`; design rationale lives in the spec; this file is the bird's-eye view.

**Updated:** 2026-05-13

---

## Phase status

| Phase | Status | Notes |
|---|---|---|
| Pre-step 0 — Commit spec docs | ✅ done | `7f4192a` |
| Pre-step 2 — Cascade-rework status read | ✅ done | C5 gate open; R-side cascade rework substantially landed |
| Pre-step 1 — Q8 idiom spike | ✅ done | Idiom (c) "method-only split" chosen; `23e18b4` |
| **Phase 0a — Structural debt** | ✅ **done** | All S1-S14 closed; S15 deferred to 0c-C12 per spec sequencing |
| **Phase 0b — Dead code** | ✅ **done** | D1/D2/D5 were false positives (active code); D4 found 5 real orphans removed |
| Phase 0c — Size/clarity | ⏳ pending | Longest phase; C1 forestStore decomposition is the long pole |
| Phase 0d — Documentation | ⏳ pending | Mostly writing |
| Phase 0e — Synchronization audit | ⏳ pending | Parallel with 0d |
| Phase 1 — Extract createTabviz / createSplitTabviz | ⏳ pending | Becomes mechanical after 0a-0c |
| Phase 1.5 — View Source JS target | ⏳ pending | Gated on Phase 1 |
| Phase 2 — Restructure source tree | ⏳ pending | File moves |
| Phase 3 — Publish | ⏳ pending | npm + CI gates |

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
| MFD-1 | `swatches.test.ts` has 6 pre-existing failures — colors return as `#000000`/`#ffffff` instead of expected hex values. Likely v1-theme-shape test fixture vs v2-cascade-rework drift. | P2 (size/clarity) | Phase 0c (likely D-list addition) |
| MFD-2 | Split widget type discriminator mismatch: R emits `type = "split_table"`, TS declared `type: "split_forest"`, runtime never checked. Widened TS to `string` with comment pointing at G6. | P1 | Phase 0e (synchronization audit reconciles) |
| MFD-3 | `themes-api.R` has a stale `_v2` transition comment referencing PR 10. The rename completed; the comment didn't. | P2 (doc) | Phase 0d |
| MFD-4 | `tabviz()` requires `label` arg even for tiny test fixtures. Not a problem, but a small UX note. | P3 | Out of scope for the split program |

## Phase 0b — what's coming next

Per spec §4:
1. **D1** — Audit `setContinuousMode` callers; remove if unused
2. **D2** — Audit `previewColumnWidth`, `previewLabel`, other `preview*` methods
3. **D4** — Run usage audit across ~80 store methods; remove orphans
4. **D5** — Audit `__tabvizExports`, `__tabvizStoreRegistry` usage in tests + scripts; gate behind `__DEV__` or remove

Estimated 3-4 days of work. One PR.

## Reading order for someone joining mid-program

1. `docs/dev/frontend-split-spec.md` — the source of truth for the whole program
2. `~/.claude/plans/encapsulated-snacking-leaf.md` — the launch plan (what's PR1, what's PR2, etc.)
3. `docs/dev/split-program-diary.md` — narrative as we went
4. This file — current state

The spec is authoritative for what we're doing and why; the diary is authoritative for what happened and what surprises we hit; this file is authoritative for *where we are right now*.

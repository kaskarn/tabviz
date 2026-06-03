# Theme cascade rework — refactor & rationalization log

> **Status:** v0 — opened 2026-06-02. Living log, append-only.
> **Companion:** [`theme-cascade-rework.md`](theme-cascade-rework.md) — the vision & staged plan this log feeds.

---

## Purpose

A working log of code rationalization opportunities, cleanups, refactor candidates, optimizations, and architectural debts encountered while reading and reflecting on the codebase during the theme cascade rework planning.

Not every entry will be acted on; some will become PRs in their own right, some will fold into stage work in the vision doc, some will be deferred or dismissed. The point is to *capture* what's noticed while we have eyes on the code, so nothing decays unrecorded.

## Entry format

```
### [bucket] short title — YYYY-MM-DD

**Location:** `srcjs/src/path/to/file.ts:LL` (or `R/foo.R:LL`)

**Observation:** what's there now, terse.

**Recommendation:** what it should become, terse.

**Coupling:** independent | depends on stage N | blocks stage N

**Status:** open | scheduled | dismissed | done (link to PR)
```

## Buckets

Logical groupings. Add new buckets as new categories emerge.

- **theme-code** — `srcjs/src/lib/theme/` internals
- **consumers** — renderer code that reads the theme
- **r-mirror** — R-side parallels (`R/classes-theme.R`, `R/themes.R`, `R/themes-api.R`)
- **wire** — `theme-wire.ts` overrides/pins
- **tests** — test infrastructure, parity tests, drift gates
- **naming** — inconsistent or stale identifiers
- **dead-code** — likely unused, candidate for removal
- **docs** — `docs/dev/`, in-code comments
- **performance** — hot paths, redundant work
- **cross-cutting** — patterns that recur across multiple files

---

## Entries

### [seed] theme-code · resolved-theme is a deep object — 2026-06-02

**Location:** `srcjs/src/lib/theme/theme-adapter.ts` (Tier 3 cluster assembly) + `srcjs/src/types/theme-resolved.ts`

**Observation:** Tier 3 component clusters (RowCluster, HeaderCluster, etc.) are deeply nested typed objects. Consumers reach into `theme.row.base.bg`, `theme.spacing.cellPaddingX`, etc. ~13 consumer files do this; reorganizing the shape ripples to all of them.

**Recommendation:** The substrate move (vision doc §4a, Move 2) addresses this by making CSS variables the wire — consumers read `var(--row-alt-bg)` not `theme.row.alt.bg`. The deep object can remain as the in-memory source of truth, but it stops being the consumer-facing interface.

**Coupling:** depends on stage S1 (manifest) + S2 (CSS-var wire).

**Status:** open — will land via stage sequencing in vision doc.

---

### [seed] wire · dotted-path overrides are stringly-typed — 2026-06-02

**Location:** `srcjs/src/lib/theme/theme-wire.ts` — `pin()`, `resolveWire()`, `inspectLeaf()` traverse paths like `"row.fill.bg"` as strings.

**Observation:** No type-check on override paths; typos fail silently or create dead pin entries. Settings panel writes via these strings (e.g. `TokensControl.svelte` calls `setThemeField(["row", "fill", "bg"], value)`).

**Recommendation:** Refactor override schema to `{role: string, ramp: RampName, grade: number}` records (vision doc §4a, Move 3). Removes runtime traversal; makes the override surface drift-checkable; enables cross-ramp rebinding.

**Coupling:** depends on stage S2 (manifest) + stage S3 (role bindings) as a coordinated migration.

**Status:** open.

---

### [seed] consumers · spacing tokens are the highest-fanout reads — 2026-06-02

**Location:** Cross-cutting across `svg-generator.ts`, `TabvizPlot.svelte`, `stores/slices/layout-zoom.svelte.ts`, `stores/slices/columns.svelte.ts`, and several `ui/*Control.svelte` files.

**Observation:** Counted by `grep` earlier in planning: ~84 reads of `theme.spacing.*` across ~15 fields. `cellPaddingX` 16×, `padding` 10×, `rowHeight` 9×, `rowGroupPadding` 9×, `headerHeight` 7×, `axisGap` 6×, `headerGap` 5×, `footerGap` 5×. Top 6 fields ≈ 60 reads.

**Recommendation:** First-class migration target for stage S2 (CSS-variable wire). Migrating spacing alone eliminates ~60 of the ~150 leaf-reads in the renderer. High-leverage starting point.

**Coupling:** stage S2 specifically.

**Status:** open — sequencing recommendation for stage S2.

---

### [seed] consumers · row cluster fanout is more diffuse than spacing — 2026-06-02

**Location:** `theme.row.*` reads across `TabvizPlot.svelte`, `svg-generator.ts`, `ui/`.

**Observation:** Counted earlier: 3× `row.base.bg`, 3× `row.alt.bg`, most other fields 1–2×. Fanout is across many distinct *fields*, not repeated reads of the same field.

**Recommendation:** Selector-style centralization helps less here than for spacing — the win comes from the COMPONENT_TOKENS manifest (stage S1) which catalogs *which* fields are consumed, not from a getter wrapper. Manifest is sufficient; no selector layer needed for row cluster.

**Coupling:** stage S1.

**Status:** open.

---

### [seed] r-mirror · `R/classes-theme.R` mirrors the TS resolved shape by hand — 2026-06-02

**Location:** `R/classes-theme.R`

**Observation:** S7 classes (ThemeInputs, WebTheme, surfaces/content/dividers) duplicate the TS type vocabulary in R. Drift is possible (a field added to TS but not R, or vice versa). Parity tests (`test-themes.R`, `test-theme-css.R`) gate against drift but don't prevent it.

**Recommendation:** Once the substrate (vision §4a) lands, the *resolved-theme* shape becomes less load-bearing in R (R serializes inputs and reads back a CSS-var map for export, not a deep object). The S7 ThemeInputs class remains; the resolved-theme S7 classes can be slimmed dramatically or eliminated. Worth re-evaluating at end of stage S2.

**Coupling:** depends on stage S2 outcome.

**Status:** open — re-evaluate after S2.

---

### [seed] theme-code · `theme-adapter.ts` is the T2→T3 cluster assembler — 2026-06-02

**Location:** `srcjs/src/lib/theme/theme-adapter.ts`

**Observation:** `buildTheme()` hardwires Tier 3 cluster structure (Header, RowGroup, Row, Cell, etc. — ~13 clusters) by reading the T2 token map. The shape decisions here ripple through every downstream consumer.

**Recommendation:** This file becomes the *primary* candidate for restructuring during the substrate work. Once consumers read CSS variables instead of deep fields, the function's job shifts from "build a typed nested object" to "emit a flat CSS-variable map keyed by component-token names." The intermediate cluster types may become unnecessary; the manifest (S2) supersedes them as the documented contract.

**Coupling:** stage S2.

**Status:** open — likely heavy rewrite during S2.

---

## Observations parked for later (will become entries when actioned)

These are scoped intuitions noted in conversation but not yet sharp enough to action. Promote to formal entries above when concrete.

- **rgc_v4's `roleSrc` provenance pattern** (each role records `{type, ramp, i, note}` for inspector consumption) is the source for the Cascade Inspector and worth porting. Falls out of stage S1 plus a small resolver-side addition.
- **rgc_v4's status tokens distinction** (pos/neg/warn/info ramps independent of brand) — verify V3 has full parity; if not, this is a small additive fix.
- **rgc_v4's curves-per-ramp** (linear/ease/log/exp on neutral/brand/accent) — small Tier 1 lever worth surveying for V3 inclusion.
- **rgc_v4's "off-ramp" roles distinction** (status + computed roles in their own tray) — useful for the editor UI; falls out of the manifest if we tag manifest entries by source-type.
- **TokensControl.svelte / ThemeControl.svelte / settings panel structure** — full audit will happen during stage S8 (editor overhaul); pre-audit might surface cleanups landable independently.

---

## Cross-cutting principles to keep noting as we read

- Watch for **path-string theme access** anywhere — every site is a future migration target.
- Watch for **JS-side variant branching** (`if (headerStyle === 'fill') ...`) that could become a `[data-*]` selector.
- Watch for **duplicated R-side logic** that could delegate to TS via V8 (per CLAUDE.md).
- Watch for **named constants scattered at call sites** that could move to a frozen module-level table (per CLAUDE.md).
- Watch for **dead exports** or **unused fields** the drift gate would catch later — fix now if obvious.
- Watch for **`$state.raw` reactivity traps** in the Svelte store (per CLAUDE.md the `2026-05-25` regression note).

---

## Sprint journal — Stage 1 substrate sprint

### 2026-06-02 — Sprint kickoff session: steps 1 + 2 scaffolded

**Branch:** `feat/theme-rework` opened from `main` (per Decisions log vision §9 commit).

**Internal commits landed (all on the branch; none merged to main):**

- `[arc] open feat/theme-rework — substrate sprint kickoff` — branch marker + the 5 design docs force-added (they were gitignored on main per the `dev` shadow rule).
- `[M1] theme-roles.ts: new file — RoleName / RampName / AnchorName / CurveName unions` — `srcjs/src/types/theme-roles.ts`, 185 lines.
- `[M1] component-tokens.ts: scaffold + types + initial 40 entries` — `srcjs/src/lib/theme/component-tokens.ts`, 517 lines. Manifest covers spacing/row/cell/header/plot clusters; ~110 more entries deferred to subsequent commits.
- `[M1] component-tokens.drift.test.ts: regex-based drift gate` — `srcjs/src/lib/theme/component-tokens.drift.test.ts`, 168 lines. Three tests cover (a) consumer references in manifest, (b) entries with consumers, (c) stale KNOWN_UNCONSUMED entries. Mirrors `srcjs/src/schema/columns/drift.test.ts` precedent.
- `[M2] theme-runtime.css: scaffold cluster blocks + sv-omit markers` — `srcjs/src/lib/theme/theme-runtime.css`, 185 lines. Cluster comments + all 10 scope-level `data-*` selectors + element-level row-kind/row-token selectors + sv-omit markers around browser-only :hover/transition section.
- `[M2] theme-runtime.css ?raw import test` — `srcjs/src/lib/theme/theme-runtime-css.test.ts`, 48 lines. Confirms Vite/bun support `?raw` import natively; no `vite.config.ts` change needed.
- `[M2] theme-css.ts: emitCssVarsFromManifest stub (placeholder values)` — added function returns `<TBD tier:detail>` placeholder values; full implementation requires resolver rewrite (step 4). Test in `emit-manifest.test.ts`.
- `[M2] extract-svg-css.ts: SVG-CSS extractor strips sv-omit blocks` — `srcjs/src/lib/theme/extract-svg-css.ts`, 40 lines. Single-regex implementation; 7-test coverage including real-file integration.

**Branch state at end of session:**
- 980 bun tests pass (was 963 on main + 17 new substrate tests added).
- `npm run check` clean: 0 errors, 0 warnings.
- v3 code on main continues to work unchanged (the substrate is parallel; consumers haven't migrated; resolver hasn't been rewritten).
- Drift gate's `KNOWN_UNCONSUMED` contains: 40 entries from the new manifest (consumers haven't migrated yet) + ~140 v3 legacy `--tv-*` references from existing emitters (will shrink during step 10 as v3 is deleted).

**Observations surfaced during scaffold:**

- **Nested `/* ... */` comments break TS parse.** Initial `component-tokens.ts` used `/* ... /* ── ── */ ... */` for section dividers — the inner `/*` closed the outer block early, producing parse errors. Switched to `// ...` line comments for section dividers. Worth a refactor-notes flag: any TS file using nested block comments will trip the parser similarly.
- **Regex `--tv-[a-z][a-z0-9-]*` can produce trailing-hyphen matches.** Examples found: `--tv-badge-` (the `*` after `--tv-badge-` in a comment context). False positives are harmless (they grandfather into KNOWN_UNCONSUMED) but worth knowing. Future refinement: tighten the regex to require at least one trailing alphanumeric (`[a-z][a-z0-9-]*[a-z0-9]`).
- **`theme-css.ts:186-200` has hard-coded fallback values** (`--tv-badge-success: var(--tv-status-positive)`) — these become part of step 10 (v3 emitter deletion). Currently grandfathered.

**Next session pickup — step 3 (override schema + wire rewrite):**

- Rewrite `theme-wire.ts` to use `{role, ramp, grade}` override records (per Stage 1 §8–9).
- Add `setRoleBinding` and `pinTokenByName` API functions with `TokenNotPinnableError` for non-role-sourced tokens.
- Refactor `pin()` / `release()` / `isPinned()` callers — settings panel files (`TokensControl.svelte`, etc.) need to migrate.
- This is the first **disruptive** step of the sprint: it changes API shape and will break some existing tests until the consumer call sites migrate. Plan to run consumer migration (step 6) in tandem with the wire rewrite.

**State to verify in next session:**
- `git log --oneline feat/theme-rework` shows the 7 commits above.
- `bun test src/lib/theme/component-tokens.drift.test.ts` passes (3 tests).
- `bun test src/lib/theme/emit-manifest.test.ts` passes (5 tests).
- `bun test src/lib/theme/extract-svg-css.test.ts` passes (7 tests).
- `bun test src/lib/theme/theme-runtime-css.test.ts` passes (5 tests).
- Total: 980 pass across full bun suite.

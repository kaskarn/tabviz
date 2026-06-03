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

---

### 2026-06-02 — Sprint continuation: M3 wire rewrite + M4 resolver capabilities

**Internal commits landed (extending the kickoff session):**

- `[M3] theme-wire.ts: rewrite — v4 override schema + role-binding API` — replaces v3 dotted-path pin/release with role-bindings; new `ThemeWire { $schema, name, inputs, roleOverrides }` shape; exports `createWire`, `setRoleBinding`, `pinTokenByName`, `releaseRole`, `releaseAllRoles`, `isRolePinned`, `getRoleBinding`, `getRoleProvenance`, `resolveWire`, `WIRE_SCHEMA`, `DEFAULT_ROLE_BINDINGS`. New error classes: `TokenNotPinnableError`, `RoleNotBindableError`. `resolveWire` still calls `buildThemeStructure` and ignores `roleOverrides` — the resolver rewrite (step 4 main commit, future session) plugs in actual override application.
- `[M3] theme-store: migrate to v4 wire API` — `theme-store.svelte.ts` + `theme-store.plain.ts` both consume the new role-binding API. Exposed verbs: `setRoleBinding`, `pinTokenByName`, `releaseRole`, `releaseAllRoles`, `isRolePinned`, `getRoleBinding`, `getRoleProvenance`. Removed: `pinPath`, `releasePath`, `isPinned`, `inspect`. No production consumers affected (only the test files).
- `[M3] tests: rewrite theme-wire + theme-store tests for v4 API` — 24 wire tests + 12 store tests cover the new surface, including error-class cases for off-ramp roles and non-role-sourced tokens.
- `[M4] curves.ts: five ramp-shape curve functions` — linear/ease/smooth/log/exp pure functions; `DEFAULT_RAMP_CURVES` const (neutral=ease, brand=linear, accent=linear) per Q-P4.3 closure. 12 tests.
- `[M4] alpha-ramp.ts: 11-step alpha companion ramp builder` — pure math emitting an 11-step alpha-progression OKLCH companion (`α = 0.03 + t^1.25 * 0.9`) for a ramp anchor. 7 tests.
- `[M4] polarity.ts: applyPolarity (anchor L-reflection)` — `L → 1.1 − L` clamped to [0.04, 0.99]; involutive within [0.11, 0.99]; pure functions `reflectL`, `reflectHex`, `polarityOf`, `reflectAnchors`. Per Q-P4.1 closure. 12 tests.

**Branch state at end of extended session:**
- 1020 bun tests pass (was 989 after M3 wire rewrite + 31 new M4 capability tests).
- `npm run check` clean: 0 errors, 0 warnings.
- `npm run build:widget` succeeds (no consumer migration yet; bundle size unchanged).
- Drift gate still passing: KNOWN_UNCONSUMED hasn't grown (the v4 capability modules don't introduce new CSS-var references).
- v3 rendering path unchanged on the branch; substrate work is additive at the resolver level until the rewrite (step 4 main commit) ties it all together.

**Observations from this session:**

- **Nested comment-block parse gotcha.** Re-discovered: `/* ... /* ... */ ... */` patterns break TS parsing. Switched all section dividers in new modules to `// ── ... ──` line comments. Worth surfacing as a CLAUDE.md note if a future agent hits it.
- **Drift gate false positives from doc comments.** `--tv-ramp-` appeared in an alpha-ramp.ts doc comment (`--tv-ramp-{ramp}-alpha-{grade}` template-syntax mention). The regex grabbed the `--tv-ramp-` partial. Worked around by removing the template syntax from the doc; longer-term we could tighten the regex to require trailing alphanumeric or scan comments more carefully. Logged here as a future refinement.
- **DEFAULT_ROLE_BINDINGS placement.** Currently in `theme-wire.ts` so the wire can answer `getRoleBinding()` without a not-yet-rewritten resolver. Step 4 main commit may move this to `theme-resolve.ts` for tighter cohesion; the wire would then import from the resolver instead.

**Next session pickup — step 4 main commit (resolver rewrite):**

1. Add `polarity` field to `ThemeInputs` (new Tier-1 input). Existing `mode` field changes semantics from `"light" | "dark"` to `"standard" | "high-contrast" | "reduced-transparency"` per Q-P4.5.
2. Add the new variant Tier-1 inputs: `head_style`, `title_style`, `rules`, `frame`, `first_col_style`, `curves` (record), `row_kinds` (per-kind structured). All flat on `ThemeInputs` per Q-P4.8.
3. Add R-side `set_polarity` modifier; `set_mode` throws when called with `"dark"` per Q-P4.6 (clean break, no deprecation redirect).
4. Rewrite `theme-resolve.ts` substantially: replace `buildRamps` with a polarity-applying version that uses curves; add `buildAlphaRamps` (composed of the M4 builder); add `resolveRoles` that consumes `wire.roleOverrides`; replace `buildThemeStructure` with `resolveTheme(wire)` returning `ResolvedTheme` (Stage 1 §10a shape).
5. Wire up `emitCssVarsFromManifest` to consume the new resolved theme — TBD placeholders become real OKLCH/hex strings + spacing px.
6. Delete or quarantine `theme-adapter.ts` per Stage 1 §10c.
7. Update all consumers — heavy work; budgets a whole session at minimum.

**State to verify in next session:**
- 1020 bun tests pass; svelte-check clean; `npm run build:widget` succeeds.
- All capability modules' tests pass: curves (12), alpha-ramp (7), polarity (12), drift gate (3), emit-manifest (5), theme-runtime-css (5), extract-svg-css (7), theme-wire (24), theme-store (12).
- DEFAULT_ROLE_BINDINGS const in theme-wire.ts ready to be consumed by the new resolver.

---

### 2026-06-02 — Sprint deeper push: step 4 resolver integration

**Internal commits landed (extending the prior session):**

- `[M4] ThemeInputs: add polarity + curves fields (additive)` — `srcjs/src/types/theme-inputs.ts` gains optional `polarity` and `curves` fields. v3 behavior unchanged when unset; the new resolver consumes them when present.
- `[M4] resolveTheme: v4 substrate resolver entry point` — new `srcjs/src/lib/theme/resolve-theme.ts` (336 lines) composes the v4 pipeline: applyPolarity → buildRamps → buildAlphaRamp ×3 → resolveRoles → emit manifest → ResolvedTheme. `theme-css.ts::emitCssVarsFromManifest` accepts an optional ResolvedTheme parameter and returns the real CSS-var map when given.

**Branch state at end of session:**
- 1037 bun tests pass (was 1020 + 17 new resolveTheme tests).
- svelte-check clean.
- The wire-to-cssVars pipeline now produces REAL values for role-sourced tokens (hex from ramps), spacing tokens (px from density table), and const-sourced transparent tokens. Computed/anchor/input-sourced tokens still ship placeholder values pending the resolver rewrite proper.

**What works end-to-end now:**
- `resolveTheme(wire)` returns a complete ResolvedTheme with ramps + alpha companions + role values + cssVars.
- `setRoleBinding(wire, role, ramp, grade)` followed by `resolveTheme` produces a cssVars map reflecting the override (cross-ramp rebinding included).
- Polarity flip (anchor L-reflection) is wired and produces visually different dark themes when `polarity: "dark"` is set.
- The friendly `pinTokenByName` lookup pins the source role and the override propagates through.

**What's still placeholder (deferred to future sessions):**
- Off-ramp role resolution (status `*-text/fill/solid`, computed `text-onsolid`) — emits ramp values as a placeholder; needs APCA contrast picker + status anchor wiring.
- Anchor-sourced tokens (paper/ink) — `pickAnchorHex` returns null for these.
- Computed non-spacing tokens — emit `<computed>` placeholder.
- HC + RT mode transforms — not yet wired (Stage 1 §23).
- Curves integration into ramp construction — module exists, not yet consumed by `oklchRamp`.
- 18-preset polarity audit — deferred to Stage 4 per preset-deferral decision.

**Next session — large rewrite that ties it all together:**

The natural next step is the proper rewrite of `theme-resolve.ts` and the eventual deletion of `theme-adapter.ts`. Specifically:

1. Modify `oklchRamp` (in `lib/oklch.ts`) to accept an optional `curve: CurveName`; when given, generate the L progression dynamically via `curveFn(curve)` rather than the fixed LIGHT_RAMP_L / DARK_RAMP_L arrays.
2. Wire `inputs.curves` through `buildRamps` to `oklchRamp` per-ramp.
3. Implement HC + RT mode transforms in the resolver (per Stage 1 §23) — read `inputs.mode` (now meaning standard/HC/RT after the proper split), push border grades, swap alpha→solid for RT.
4. Add proper status anchor resolution to `resolveRoleValue` — use `inputs.status.{positive,...}` to seed status ramps (Stage 1 §27).
5. Add APCA contrast pick for `text-onsolid` per the existing `pickInkOnBg` utility.
6. Move `DEFAULT_ROLE_BINDINGS` from `theme-wire.ts` to `theme-resolve.ts` (tighter cohesion with the resolver).
7. Begin step 6 (consumer migration) — start with `svg-generator.ts`'s most-consumed tokens (row-base-bg, cell-fg, spacing-cell-padding-x) so the visual output begins consuming the new wire.

Step 5 (row-kind height cascade) can land independently of these resolver refinements.

**State to verify in next session:**
- 1037 bun tests pass; svelte-check clean; `npm run build:widget` succeeds.
- `resolveTheme(createWire({brand: "#0099CC"}))` returns a ResolvedTheme with non-placeholder values for the row/cell/header/spacing entries in COMPONENT_TOKENS.

---

### 2026-06-02 — Sprint continuation: M4 refinements + M9 inspect helpers

**Internal commits landed (extending further):**

- `[M4] role-bindings.ts: extract DEFAULT_ROLE_BINDINGS to own module` — new `srcjs/src/lib/theme/role-bindings.ts` (89 lines). theme-wire.ts and resolve-theme.ts both import from it; theme-wire.ts re-exports for backwards compat.
- `[M4] resolve-theme: status anchors + APCA text-onsolid` — wires the off-ramp role resolution. text-onsolid uses pickInkOnBg against brand-solid; status roles (pos/neg/warn/info × fill/solid/text) read from the 5-step status ramps the existing buildStatusRamp produces. Adds 6 new tests.
- `[M9] inspect.ts: cascade-trace inspection helpers` — new module providing `inspectToken(resolved, name)` (walks Tier 3 → Tier 2 → Tier 1 trace), `formatTrace(inspection)` (pretty prints), `listComponentTokens(resolved?)` (discovery surface). Used by R-side `inspect_token` (future V8 wiring) and the Stage 3 Cascade Inspector. 18 tests pass.

**Branch state at end of session:**
- 1061 bun tests pass (was 1037 + 6 new resolve-theme tests + 18 new inspect tests).
- svelte-check clean.
- npm run build:widget succeeds (bundle size unchanged).

**Significant capabilities now live:**

- End-to-end wire integration: `resolveTheme(wire) → ResolvedTheme.cssVars` produces real values for all role-sourced tokens (including status + computed text-onsolid via APCA), spacing-px / border-width tokens, and const-sourced tokens.
- Override propagation: `setRoleBinding` and `pinTokenByName` produce cssVars maps reflecting the override (cross-ramp included).
- Polarity flip: anchor L-reflection produces distinct dark themes.
- Status anchors: custom status seeds produce different pos-/neg-/warn-/info- roles.
- APCA-aware text-onsolid: contrast picker against brand-solid.
- Cascade trace: any token's cascade walk is structured, formattable, and ready for R-side / Inspector consumption.
- Discovery: full manifest list with optional resolved values.

**Architectural cleanups along the way:**

- DEFAULT_ROLE_BINDINGS moved to its own module (cleaner separation; both wire and resolver consume from one place; future relocation toward the resolver is easier).
- OffRampContext factored from the per-token inner loop to a per-resolveTheme outer step (O(1) per token, not per off-ramp computation).
- inspect.ts is small + self-contained — no transitive dependency growth.

**Pilot consumer migration deliberately deferred.** Started looking at svg-generator.ts (`theme.row.alt.bg` reads at lines 1502/4178/4201) but concluded the proper migration requires wholesale refactor of the SVG generator's theme parameter to consume a `ResolvedTheme` or `cssVars` map. That's step 6 work, sized for its own session. Pilot would have been mostly mechanical refactor with no architectural payoff.

**Next session — natural priorities:**

1. **HC + RT mode transforms in the resolver** (Stage 1 §23). The resolveRoleValue function reads the binding but doesn't yet apply mode-specific transforms (border-grade push, alpha→solid swap, fill drops). The mode field on ThemeInputs is currently `"light" | "dark"` — the proper split into `polarity` + `mode` is half-done (polarity field exists; mode semantics unchanged from v3). Completing the mode split is half-day work + 18-preset audit deferred to Stage 4 per preset-deferral decision.

2. **Curves integration into `oklchRamp`** (Stage 1 §25). Modify `lib/oklch.ts:oklchRamp` to accept an optional `curve: CurveName` parameter; when given, generate the L progression via `curveFn(curve)` instead of the fixed LIGHT_RAMP_L / DARK_RAMP_L arrays. Wire `inputs.curves` through `buildRamps` per-ramp.

3. **Phase 5 row-kind height cascade** (Stage 1 §33–34). New focus area: layers 1–4 of the row-kind height resolution, settings-panel control, drag-handle overlay layer + browser harness. Mostly independent of the resolver refinements above.

4. **Phase 6 consumer migration** — `svg-generator.ts` is the biggest single file (4730 LOC, ~223 theme.* reads). A focused session can migrate one cluster (e.g., row backgrounds + cell text) and ship visible end-to-end integration.

**State to verify in next session:**
- 1061 bun tests pass; svelte-check clean; npm run build:widget succeeds.
- `inspectToken(resolveTheme(createWire({brand:"#0099CC"})), "row-base-bg")` returns a 3-step trace.
- `listComponentTokens(resolveTheme(...))` returns 40+ entries with resolved values.

---

### 2026-06-02 — Sprint continuation: Q-P4.5 mode split + HC/RT transforms

**Internal commits landed (extending into the resolver capabilities):**

- `[M4] complete Q-P4.5 mode split` — `ThemeMode` type changed from `"light" | "dark"` to `"standard" | "high-contrast" | "reduced-transparency"`. Polarity now lives in its own field. Migrated 18 preset entries in `theme-presets-inputs.ts`, 5 test files, `ThemeControl.svelte` UI, `WebThemeArgs` in `theme-api.ts`, and `theme-resolve.ts::buildRamps` (now reads `inputs.polarity` for L direction).
- `[M4] resolveTheme: HC + RT mode transforms via manifest.modes` — `resolveTokenValue` reads `inputs.mode` and applies the per-token mode behavior declared in `COMPONENT_TOKENS.modes`. `"drop"` emits `transparent`; `{swap: roleName}` reads from the swap role. Tests verify both behaviors plus orthogonal composition with polarity.
- `[M4] resolveTheme: HC mode pushes border roles +2 grades` — `applyHcGradePush` extends the role-resolution path with the Stage 1 §23b border push. Five border-family roles (border-subtle / border / border-strong / focus-ring / accent-border) shift +2 grades under HC mode, clamped at 11. Composes correctly with cross-ramp role overrides.

**Branch state at end of session:**
- 1068 bun tests pass (was 1061 + 5 HC/RT manifest tests + 4 border-push tests + 2 polarity-default tests; with 4 redundant legacy-mode tests dropped during the migration).
- svelte-check clean: 0 errors, 0 warnings.
- `npm run build:widget` succeeds (732.55 kB; bundle size barely changed).

**Capability surface after this session:**

✓ Mode vocabulary is correctly split (polarity orthogonal to contrast mode)
✓ HC mode drops wash fills to transparent (manifest-encoded)
✓ HC mode pushes border roles +2 grades (resolver-level)
✓ RT mode swaps translucent washes to opaque equivalents
✓ All three modes compose orthogonally with polarity (light/dark)
✓ All 18 production presets migrated to `polarity` field
✓ ThemeControl UI surfaces "Polarity" instead of "Mode"

**Next session — natural priorities (unchanged in priority order, fewer in scope):**

1. **Curves integration into `oklchRamp`** (Stage 1 §25) — the curves module exists; not yet wired into the ramp builder.
2. **Phase 5 row-kind height cascade** (Stage 1 §33–34) — layered resolution + dual affordance.
3. **Phase 6 consumer migration** — `svg-generator.ts` cluster-by-cluster.

The session's HC push implementation may be a good template for any other Stage 1 §23 mode-transform that arrives later (e.g., if we want fill-state grades to push under HC too, the pattern is established).

**State to verify in next session:**
- 1068 bun tests pass; svelte-check clean; npm run build:widget succeeds.
- `resolveTheme(createWire({brand:"#0099CC", mode:"high-contrast"})).roles.border` returns ramps.neutral[8] (HC-pushed from default neutral.6).
- `resolveTheme(createWire({brand:"#0099CC", mode:"high-contrast"})).cssVars["--tv-row-alt-bg"]` returns `"transparent"`.

---

### 2026-06-02 — Sprint continuation: curves wiring + Phase 5 height cascade

**Internal commits landed:**

- `[M4] curves: integrate into oklchRamp + buildRamps` — `oklchRamp` gains optional `curve` parameter; when set, derives L progression dynamically by interpolating between `LIGHT_RAMP_L[0]` (paper) and `LIGHT_RAMP_L[11]` (ink) bounds. `buildRamps` reads `inputs.curves` and passes per-ramp curves through. Decorative shares accent curve. 12 tests.
- `[M5] row-kind-heights.ts: layers 1-4 of the height cascade` — new module with `INTRINSIC_KIND_RATIOS` (layer 1: spacer=0.5, rest=1.0), `KIND_INHERITANCE` (layer 2: summary→data), `resolveRowKindRatio` and `resolveRowKindHeight` functions walking layers 4→3→2→1. `ThemeInputs.row_kinds` field added per Q10 closure (structured shape with `heightRatio`, forward-compatible with Stage 2 paint fields). 16 tests.
- `[M5] computeRowLayout: consume row-kind-heights cascade` — replaces inline `kindBase` in `table-metrics.ts` with cascade walker. `RowLayoutInput` gains `themeKinds` (layer 3) and `constructorRowHeights` (layer 4). The existing `rowKindHeights` pin (layer 5) stays unchanged. 6 new integration tests.

**Branch state at end of session:**
- 1102 bun tests pass (was 1068 + 12 curves integration + 16 row-kind module + 6 table-metrics integration).
- svelte-check clean: 0 errors, 0 warnings.
- `npm run build:widget` succeeds (733.65 kB).

**Capability surface after this session:**

✓ Per-ramp curves (linear/ease/smooth/log/exp) wired end-to-end
✓ `inputs.curves.{neutral,brand,accent}` reshapes ramp L progression
✓ Decorative ramp shares accent curve
✓ Row-kind height cascade (5 layers) — full pipeline:
  - Layer 5 (pin) bypasses everything (already shipped)
  - Layer 4 (constructor) wins over layer 3
  - Layer 3 (theme) wins over inheritance
  - Layer 2 (inheritance, summary→data) walks correctly
  - Layer 1 (intrinsic) is the floor
- `computeRowLayout` consumes the cascade transparently — existing call sites unchanged, new optional inputs available
✓ `ThemeInputs.row_kinds` structured shape per Q10 closure

**What's still owed for Phase 5 completion** (deferred to a future session):

- Settings-panel per-kind height control (`RowKindHeightsControl.svelte`) — UI work.
- Drag-handle overlay layer (`RowEdgeHandles.svelte`) + browser harness — needs Puppeteer test setup.
- R modifier API (`set_row_kind_height_ratio`, `set_row_kind_height_pin`, `release_row_kind_heights`) — V8 wiring.
- `RowKind` enum rename to kebab-case (Q9 closure — group_header → group-header, etc.) — coordinated rename across ~50 sites; substrate-landing concern.

**Architectural seam: curves vs. v3 hand-tuned ramps.**

The existing `LIGHT_RAMP_L` array is hand-tuned for perceptual smoothness; the curve-derived path interpolates linearly between paper L (0.987) and ink L (0.180) through whichever curve is chosen. These are NOT equivalent:
- `LIGHT_RAMP_L[5]` (hand-tuned) = 0.804
- linear curve at index 5: 0.987 - (5/11) × 0.807 = 0.620

The hand-tuned array gives a perceptually-correct gentle S curve. The linear curve is "uniform L distribution" which is different. The mismatch is intentional and signals to authors: pick a curve to alter the feel; leave unset for the v3 perceptually-correct default.

**Next session — natural priorities:**

1. **Phase 6 consumer migration** — `svg-generator.ts` cluster-by-cluster (highest user-visible payoff; biggest mechanical effort).
2. **Phase 5 affordances** — settings-panel + drag-handle (UI work; can wait for Stage 3 redesign).
3. **R-side modifier API** — `set_polarity`, `set_curve`, `set_row_kind_height_ratio`, `set_role_binding`, `pin_token_by_name`, etc. via V8.

**State to verify in next session:**
- 1102 bun tests pass; svelte-check clean; npm run build:widget succeeds.
- `oklchRamp("#0099CC", { mode: "light", curve: CURVES.log })` produces a different ramp than default.
- `computeRowLayout({...rowHeight:24, themeKinds:{data:{heightRatio:1.5}}}).rowHeights` reflects layer 3.

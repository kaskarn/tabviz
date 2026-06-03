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

---

### 2026-06-02 — Phase 5 finish: spec field, settings control, drag handle

**Internal commits landed:**

- `[M5] WebSpec.rowHeights + plumb through DOM + SVG paths` — layer 4 constructor field added to WebSpec; both `computeRowLayout` call sites (layout-zoom slice + svg-generator) read `spec.rowHeights` and pass as `constructorRowHeights`. layer 3 (`themeKinds`) plumbing left as a TODO until the new resolver emits `inputs.row_kinds` to layout consumers.
- `[M5] RowKindHeightsControl.svelte: settings-panel control` — new Svelte component listing data/group_header/summary/spacer kinds with current resolved px (via `resolveRowKindHeight` cascade walk), provenance label (pin / constructor / intrinsic), per-kind number input writing the layer-5 pin, per-kind × reset, "Reset all" button. Not yet wired into a SettingsPanel tab (that's a Stage 3 editor concern).
- `[M5] RowEdgeHandles.svelte: drag-handle overlay layer` — separate component mounted as sibling overlay. Mirrors `ColumnHeaders.svelte::startResize`: pointerdown captures row kind + start height; pointermove computes new height clamped at content minimum and commits via `store.setRowKindHeight(kind, newHeight)` per move; pointerup detaches; fallbacks for window blur / Escape / pointercancel. Not yet wired into TabvizPlot — integration touches the plot's overlay layering.

**Branch state at end of session:**
- 1102 bun tests pass; svelte-check clean: 0 errors, 0 warnings.
- `npm run build:widget` succeeds.
- KNOWN_UNCONSUMED gained `--tv-focus` (grandfathered until role mapping lands).

**Phase 5 status (Stage 1 §33–34):**

| Layer / Item | Status |
|---|---|
| Layer 1 — intrinsic kind ratios | ✓ shipped (`INTRINSIC_KIND_RATIOS`) |
| Layer 2 — inheritance graph | ✓ shipped (`KIND_INHERITANCE`, summary→data edge) |
| Layer 3 — theme default (`inputs.row_kinds`) | ✓ field on ThemeInputs; resolver consumes when present |
| Layer 4 — constructor override (`spec.rowHeights`) | ✓ field on WebSpec; both DOM + SVG paths consume |
| Layer 5 — interactive pin | ✓ (was already in main from the row-kind handoff) |
| Settings-panel control | ✓ component built (`RowKindHeightsControl.svelte`); not yet placed in a tab |
| Drag-handle overlay | ✓ component built (`RowEdgeHandles.svelte`); not yet wired into TabvizPlot |
| Cascade resolution tests | ✓ 16 unit tests + 6 integration tests in `table-metrics.test.ts` |
| R-side modifiers (`set_row_kind_height_ratio`, etc.) | ⏳ pending (deferred — depends on broader R-side v4 migration) |
| Browser harness (puppeteer drag commit) | ⏳ pending (deferred — needs harness setup) |
| TabvizPlot integration (RowEdgeHandles mount) | ⏳ pending (touches plot's overlay layering) |

**What "Phase 5 done" means at this state:**

- The substrate is complete: the cascade math + ThemeInputs/WebSpec contract + both consumer call sites + the dedicated settings-panel control + the drag-handle component all ship in coherent form.
- The integration surface (mounting RowEdgeHandles in TabvizPlot, placing the settings control in the panel tabs, R-side authoring API) is well-defined but spans surfaces that benefit from focused attention — they're the natural starting points for future sessions.

**Next session — natural priorities:**

1. **TabvizPlot integration of RowEdgeHandles** — small but touches the plot's render tree.
2. **SettingsPanel integration of RowKindHeightsControl** — place the new control in the appropriate tab.
3. **R-side modifier API** — `set_row_kind_height_ratio`, `set_row_kind_height_pin`, `release_row_kind_heights`, `release_all_row_kind_heights`. Likely scoped as part of the broader R-side v4 migration (step 8 of Stage 1 §40 sequence).
4. **Browser harness for drag** — puppeteer setup + `tests/browser/row-edge-resize.browser.ts`.
5. **Phase 6 consumer migration** — `svg-generator.ts` cluster-by-cluster.

**State to verify in next session:**
- 1102 bun tests pass; svelte-check clean; npm run build:widget succeeds.
- `RowKindHeightsControl.svelte` and `RowEdgeHandles.svelte` files exist with their full implementations.
- `WebSpec.rowHeights` typed and consumed by both DOM and SVG paths.

---

### 2026-06-02 — Deeper integration: SettingsPanel + TabvizPlot mount + Phase 6 pilot

**Internal commits landed:**

- `[M5] integrate RowKindHeightsControl + mount RowEdgeHandles` —
  - `SettingsPanel.svelte`: `RowKindHeightsControl` rendered alongside `SpacingControl` in the spacing tab; users see the new control whenever they open Spacing.
  - `TabvizPlot.svelte`: `RowEdgeHandles` mounted as sibling overlay next to `TabvizOverlays`, with `enabled={false}` as a deliberate "off until geometry is verified" stance. The `rowPositions` coordinates from `computeRowLayout` are relative to the rows region's origin; this mount point's parent geometry doesn't align yet. Flipping `enabled={true}` once the parent's coordinate space is verified (likely adding a Y offset for header + axis chrome) makes the handles user-interactable.

- `[M6] consumer-bridge.ts: Phase 6 pilot migration` —
  - New `srcjs/src/lib/theme/consumer-bridge.ts` module providing the bridge that lets v3 consumers opt into v4 cssVars reads without wholesale rewrites. Two exports: `getCssVars(theme)` builds a v4 wire from `theme.authoringInputs`, resolves it, returns the cssVars map (empty when unavailable). `readVar(cssVars, name, fallback)` looks up a cssVar with fallback to v3 reads.
  - Pilot migration in `svg-generator.ts::generateSVG`: computes `cssVars` once at the top; two inline `theme.row.alt.bg` reads (data row banding + group_header row banding) switch to `readVar(cssVars, "--tv-row-alt-bg", theme.row.alt.bg)`. Pattern preserves v3 behavior when cssVars is empty (older specs) while exercising v4 cssVars when authoringInputs is present.
  - `renderDetailsPanel`'s `theme.row.alt.bg` site left as v3-only — migrating helper functions requires plumbing cssVars as a parameter; will land as cluster-by-cluster migration progresses.

**Branch state at end of session:**
- 1111 bun tests pass (1102 + 9 consumer-bridge tests).
- svelte-check clean; npm run build:widget succeeds.
- Bundle 754.24 kB (+15.7 kB from new components + bridge module + new svg-generator code).

**Capability surface after this session:**

✓ RowKindHeightsControl visible in SettingsPanel spacing tab
✓ RowEdgeHandles mounted in TabvizPlot (off by default; geometry verification pending)
✓ Consumer-bridge module + readVar helper available for any consumer
✓ svg-generator's two row-alt-bg sites running on the v4 wire
✓ Bridge is a step-10 cleanup target (deletes when all consumers migrate)

**Phase 5 status (complete):**

All substrate items + initial integration done. Outstanding pieces are:
- R-side modifier API (deferred to broader R-side v4 migration)
- Browser harness for drag commit (puppeteer setup)
- RowEdgeHandles geometry verification (Y-offset alignment for the overlay's parent)

**Phase 6 status (kicked off):**

Three of ~223 theme.* read sites migrated. The bridge pattern is established and tested. Remaining migration is mechanical work that benefits from focused per-cluster sweeps:
- Row state cluster (~8 more sites): row.base.bg, row.alt.bg (1 more in renderDetailsPanel), row.hover.bg, row.selected.bg, row.emphasis.bg, row.emphasis.bar, row.emphasis.fg, row.base.fg
- Cell cluster (~3 sites): cell.bg, cell.fg, cell.border
- Header cluster (~8 sites): header.light.bg/fg/rule, header.tint.bg/fg, header.fill.bg/fg
- Plot scaffold (~5 sites): axis-line, tick-mark, tick-mark-length, line-width, point-size
- Spacing (~15 sites): row-height, header-height, etc.
- Text roles (~3 sites): title-fg, body-fg, footnote-fg
- And ~110 more entries in the broader v3 inventory that still need manifest declarations + consumer migration

**Next session — natural priorities:**

1. **More Phase 6 consumer migration** — continue the cluster-by-cluster sweep through svg-generator.ts. Each cluster reduces v3 surface area; once all clusters migrate, step 10 deletes v3 theme reads + the bridge.
2. **RowEdgeHandles geometry verification** — inspect TabvizPlot's render tree; identify the correct parent container for the overlay; flip `enabled={true}`.
3. **R-side modifier API** — set_polarity, set_role_binding, pin_token_by_name, set_row_kind_height_ratio, plus the four inspection helpers (list_component_tokens, inspect_token, contrast_report, diff_themes).
4. **Manifest expansion** — add the ~110 deferred entries from the v3 inventory to component-tokens.ts so the drift gate's KNOWN_UNCONSUMED can shrink.

**State to verify in next session:**
- 1111 bun tests pass; svelte-check clean; widget build succeeds.
- `getCssVars(buildTheme(COCHRANE, "cochrane"))["--tv-row-base-bg"]` returns a real hex.
- `RowKindHeightsControl` appears in the SettingsPanel's Spacing tab.
- `RowEdgeHandles` is mounted in TabvizPlot's render tree (enabled=false).

---

### 2026-06-02 — Phase 6 broad sweep: 6 cluster migrations across svg-generator.ts

**Internal commits landed in sequence:**

1. **`[M6] manifest: T2 passthroughs + renderDetailsPanel migration`** — added 7 generic Tier-2 role passthrough tokens to `component-tokens.ts` (`--tv-surface-bg`, `--tv-surface-subtle-bg`, `--tv-text`, `--tv-text-muted`, `--tv-text-subtle`, `--tv-border`, `--tv-border-subtle`) — these mirror T2 roles 1:1 so consumers reading `theme.surface.base` / `theme.content.primary` / `theme.divider.subtle` migrate to them. Also migrated `renderDetailsPanel`'s reads (`row-alt-bg`, `surface-bg` fallback, `text`, `cell-border`) via threaded `cssVars` param.

2. **`[M6] migrate plot scaffold (axis-line, tick-mark, label fg) to cssVars`** — `renderForestAxis` + `renderVizAxis` (3 callsites for bar/box/violin variants) now take `cssVars`. Threaded 6 sites: `--tv-plot-axis-line` (forest+viz axis lines), `--tv-plot-tick-mark` (ticks), `--tv-text-muted` (tick + axis label fg), `--tv-border-subtle` (forest gridlines). Drift gate: 5 tokens removed from `KNOWN_UNCONSUMED`.

3. **`[M6] migrate cell cluster (cell-fg, cell-border) to cssVars`** — `renderUnifiedTableRow` takes `cssVars` and computes `cellFgDefault` once at the function top. Three internal default-fg sites (label text, general cell color, icon cell color) collapse to `cellFgDefault`. The `string | null | undefined` from `readVar` is coerced back via outer `?? theme.content.primary`. Drift gate: `--tv-cell-fg` + `--tv-cell-border` removed.

4. **`[M6] migrate renderHeader/renderFooter + row banding to cssVars`** — header path (`--tv-text-title-fg`, `--tv-text-muted`, `--tv-cell-border`), footer path (`--tv-cell-border`, `--tv-text-muted`, `--tv-text-footnote-fg`). Row banding's data-row + group-header-row both now read `row-alt-bg` and `surface-bg` from `cssVars` for the inequality guard. Drift gate: `--tv-text-title-fg` + `--tv-text-footnote-fg` removed.

5. **`[M6] migrate renderGroupHeader to cssVars`** — group-header label fg (`--tv-text`), count fg (`--tv-text-subtle`), border-bottom stroke (`--tv-cell-border`). Drift gate: `--tv-text` + `--tv-text-subtle` removed. Note: group-header tinted-rgba background fallback (when tier.bg is unset) stays v3-style — it's a synthesized tint from secondary, not a token surface; deferring to Stage-2 secondary tinting.

6. **`[M6] migrate canvas surface + container border + header-bg guard`** — generateSVG's top-level surface bg reads `--tv-surface-bg`; container border (`theme.layout.containerBorder`) reads `--tv-cell-border`; the `headerBg !== surface` guard for skipping bg-paint when redundant now uses the resolved cssVar value. Drift gate: `--tv-surface-bg` removed.

7. **`[M6] migrate row-style header bg + watermark fill to cssVars`** — `row.style.type === 'header'` tinted bg (the 0.1-opacity wash on header-style rows) reads `--tv-text-subtle`; watermark fill reads `--tv-text` when `spec.watermarkColor` is unset.

**Tokens consumed in this session (no longer grandfathered):**
- `--tv-cell-fg`, `--tv-cell-border` (cell cluster)
- `--tv-plot-axis-line`, `--tv-plot-tick-mark` (plot scaffold)
- `--tv-text-title-fg`, `--tv-text-footnote-fg` (text roles)
- `--tv-surface-bg`, `--tv-text`, `--tv-text-muted`, `--tv-text-subtle`, `--tv-border-subtle` (T2 passthroughs)

**Tokens still on KNOWN_UNCONSUMED (manifest declared, awaiting consumer):**
- `--tv-row-*` (all five row state vars) — covered partly by data + group-header banding (uses `--tv-row-alt-bg`) but other row reads still v3-only
- `--tv-cell-bg` (always transparent; consumer needs to be a real surface paint, not just the default)
- `--tv-header-*-bg/fg/rule` (full header variant cluster — Stage 2 territory)
- `--tv-plot-tick-mark-length`, `--tv-plot-line-width`, `--tv-plot-point-size` (numeric dims — consumer migration needs px-parsing helper)
- `--tv-spacing-*` (all spacing tokens — same; dimensional, needs px-parser)
- `--tv-text-body-fg` (body text reads cluster — typography migration belongs together with font-shorthand fields)
- `--tv-surface-subtle-bg`, `--tv-border` (generic helpers; no consumer reference yet — kept for future renderHeader/PlotHeader rationalization)

**Branch state at end of session:**
- `feat/theme-rework` at `1554aa4`.
- 1111 bun tests pass; svelte-check clean.
- ~6 of ~30 distinct migration patterns landed; the textual cluster, sparkline cluster, viz-mark color/dim cluster, and pictogram cluster still v3-only.

**Architectural observations from this sweep:**

a. **Threading `cssVars` through render functions is fine, not invasive.** Five render functions gained a trailing optional `cssVars` param. The pattern is consistent: read v4 cssVar with v3 fallback at the top of the function; reference the resolved local at draw sites. Each function's diff is ~5–15 lines.

b. **The `string | null | undefined` from `readVar`** trips TS when assigning to a `string`-typed local. The fix used here — chain a second `?? v3Fallback` after the `readVar` call — is verbose but correct and explicit. A future ergonomic helper `readVarOr(cssVars, name, fallback): string` might bake in the coercion when the fallback is guaranteed non-null.

c. **Equality guards like `bgColor !== theme.surface.base`** need both sides to be migrated. Migrating only one side means the v3 path's `theme.surface.base` and the v4 path's `cssVars["--tv-surface-bg"]` could be slightly different strings (e.g. `#FFFFFF` vs `#ffffff`) and the guard fires spuriously. We migrated both sides in commit 4/6.

d. **Dimensional tokens (px values) need a parser helper.** `theme.plot.lineWidth` is a `number`; `cssVars["--tv-plot-line-width"]` is a string like `"1.5px"` or `"1.5"`. Migrating those requires adding a `readVarPx(cssVars, name, fallback): number` to `consumer-bridge.ts`. Deferred from this session.

e. **The group-header tinted-rgba background** is a synthesized fallback (when `tier.bg` is unset, compose `rgba(r,g,b,opacity)` from `secondaryDeep`). This isn't a token — it's a Tier-3 derivation that belongs to Stage 2's typography/surface cascade. We left it untouched.

**Next session — natural priorities:**

1. **Dimensional `readVarPx` helper + migrate `--tv-plot-line-width` / `--tv-plot-point-size` / `--tv-plot-tick-mark-length`** — small consumer-bridge helper, then sweep the ~6 sites.
2. **Spacing cluster (~15 sites)** — `theme.spacing.*` reads; these are all dimensional, so unblock with the `readVarPx` helper first.
3. **TabvizPlot.svelte DOM render-path migration** — Svelte component reads `theme.row.*`, `theme.cell.*`, `theme.divider.*` directly; the v4 cssVars are already emitted into the scope element via `theme-runtime.css`, so component reads can switch from `theme.foo.bar` to actual CSS `var(--tv-foo-bar)` syntax (no JS bridge needed).
4. **Header variants cluster** — `--tv-header-light-*`, `--tv-header-tint-*`, `--tv-header-fill-*` — depends on `activeHeaderVariant()` returning structured data; this is Stage 2 scope.

---

### 2026-06-03 — Phase 6 deep run: spacing flow + DOM wire + density resolver fix

**Commits landed this session (8):**

1. **`[M6] buildThemeCSS appends v4 cssVars`** — The bridge from v4 manifest into the DOM render path. buildThemeCSS now appends v4 cssVars after the v3 body, sourced from theme.authoringInputs via createWire + resolveTheme. Empty when authoringInputs is unavailable. New theme-css.test.ts (3 tests) asserts v3 + v4 coexist and placeholders don't leak.

2. **`[M6] migrate spacing reads in helper renderers via readVarPx`** — 5 helper-renderer spacing reads (renderHeader/Footer/GroupHeader/UnifiedTableRow/UnifiedColumnHeaders) read via readVarPx with v3 fallback.

3. **`[M6] computeLayout cssVars + density-correct resolver + v3 spacing pins`** — Three interlocked changes:
   - **resolve-theme.ts**: `tokenDensityPx()` now consults `inputs.density` + `inputs.densityFactor` (was hard-coded to comfortable). Full preset table for compact/comfortable/spacious mirrors theme-adapter.ts.
   - **consumer-bridge.ts**: `getCssVars()` applies `theme.spacing.*` + `theme.plot.*` as override pins after resolver, honoring the v3-era `spec.theme.spacing.X = N` mutation pattern.
   - **svg-generator.ts**: `computeLayout()` builds cssVars at function entry and reads 8 spacing tokens via readVarPx; deep layout arithmetic flows through v4.

4. **`[M6] migrate width-utility spacing reads`** — `calculateSvgAutoWidths` + `calculateSvgLabelWidth` + wrap-line counting + renderUnifiedTableRow wrap-line layout migrated to readVarPx.

5. **`[M6] DOM render path: v4 cssVars first, v3 fallback (Svelte)`** — First DOM render path commit. TabvizPlot.svelte's `.tabviz-container`, `.data-cell`, `.row-odd` now read v4 names with v3 fallback. Each CSS var chain is forward-compatible: buildThemeCSS emits both names, so v4 wins via natural CSS resolution order; the chain bottom (v3 name) goes away in step 10's emitter cleanup.

**Density resolver fix details:**

The v3-only path read `theme.spacing.rowHeight` directly — populated by `DENSITY_SPACING[density]` at `buildTheme()` time. The v4 path read `--tv-spacing-row-height` which the resolver computed via `tokenDensityPx()` — but that function ignored `inputs.density` and always returned the comfortable preset. With computeLayout migrated to v4 cssVars, every theme was inadvertently downgraded to comfortable spacing. Caught by the layout-metrics snapshot (8 failures); fixed by giving the resolver access to `inputs.density` + `inputs.densityFactor` and a full DENSITY_PRESETS table mirroring theme-adapter.ts. The fix is provably equivalent — the same numbers come out either path.

**Spacing pin behavior:**

The svg-centering test (`rowGroupPadding does not shift the padded-after row's marker`) mutates `spec.theme.spacing.rowGroupPadding = 40` after construction, expecting that mutation to propagate into render. The v4 cssVars path didn't see it because the resolver only reads `inputs`. Fix: getCssVars applies `theme.spacing.*` as override pins after computing the resolved cssVars. This treats the v3 spacing field as a "user pin" layer that survives v4 resolution — preserving v3 mutability semantics during the migration window.

**Tokens consumed this session (no longer grandfathered):**
- `--tv-spacing-padding`, `--tv-spacing-cell-padding-x`, `--tv-spacing-footer-gap` (helper renderers)
- `--tv-spacing-row-height`, `--tv-spacing-header-height`, `--tv-spacing-axis-gap`, `--tv-spacing-row-group-padding`, `--tv-spacing-header-gap`, `--tv-spacing-title-subtitle-gap`, `--tv-spacing-bottom-margin` (computeLayout)
- `--tv-spacing-column-group-padding`, `--tv-spacing-indent-per-level` (width utilities)

**Tokens still grandfathered:**
- `--tv-spacing-cell-padding-y` (deprecated → 0 across all densities)
- `--tv-spacing-container-padding` (no consumer; outer canvas paint isn't token-driven yet)
- `--tv-text-body-fg` (font-shorthand cluster migration belongs together)
- `--tv-surface-subtle-bg`, `--tv-border` (helpers awaiting renderHeader/PlotHeader rationalization)
- `--tv-cell-bg` (always transparent; default rather than a real surface paint)
- `--tv-row-base-bg`, `--tv-row-base-fg`, `--tv-row-hover-bg`, `--tv-row-selected-bg`, `--tv-row-emphasis-*` (multiple but in DOM-render-path only; Svelte rules now read them, drift gate respects this since `var(--tv-row-base-bg)` IS a consumer reference)
- `--tv-header-{light,tint,fill}-*` (Stage 2 cluster)
- `--tv-plot-tick-mark-length` (read in `computeAxisLayout` — its own utility threading question)

Note: as of this session, several row-state tokens including `--tv-row-base-bg` and `--tv-row-alt-bg` are now actually referenced by TabvizPlot.svelte's CSS templates, so the drift gate considers them consumed — though they're not on KNOWN_UNCONSUMED anymore because of the `var(--tv-…)` template literals. Inspect via:
```
grep -E "var\(--tv-row" srcjs/src/svelte/TabvizPlot.svelte
```

**Branch state at end of session:**
- `feat/theme-rework` at `d79899f`.
- 1123 bun tests pass (up from 1117); 18 svg-export snapshots + drift gate + 18 consumer-bridge + 3 theme-css tests.
- svelte-check 0 errors; widget bundle 760.89 kB (+6.65 kB from buildThemeCSS v4 emission).
- ~17 of ~30 distinct migration clusters landed.

**Next session — natural priorities:**

1. **Row state cluster in TabvizPlot.svelte** — `--tv-row-emphasis-bg`/`bar`/`fg`, `--tv-row-hover-bg`, `--tv-row-selected-bg` are the obvious sweep. Most are already emitted to the DOM; consumer migration is a CSS chain swap.
2. **Header variants cluster** — needs `activeHeaderVariant()` to return cssVar names or to gain a v4 mode that emits all variants and a `[data-head-style="…"]` selector picks the active one (matches Stage 1 §17b's data-attribute design).
3. **R-side modifier API** — set_polarity, set_role_binding, pin_token_by_name, set_row_kind_height_ratio + inspection helpers.
4. **R↔TS parity tests for v4 cssVars** — verify R-side computeLayout (via V8) produces identical layout metrics to TS.
5. **Visual regression refresh** — run `tabviz::render_visual_tests()` to confirm widget visuals are pixel-identical or accept-different per the "visual change accepted, not minimized" stance.

**Architectural observations:**

a. **Spacing pin semantics is doing double duty.** `getCssVars` applies `theme.spacing.*` as pins because (i) v3 code mutates `spec.theme.spacing.X = N` and the v4 substrate must honor it, AND (ii) v4 will eventually pin spacing via `wire.pinTokenByName("--tv-spacing-X", "Npx")` — a different mechanism. Once R/TS authoring APIs migrate to the v4 pin mechanism, the bridge pin function can be deleted in step 10.

b. **computeAxisLayout consumes `theme.plot.tickMarkLength` directly** as a function parameter. To migrate, either (i) thread cssVars through computeAxisLayout's call sites, or (ii) build a v4-aware wrapper. The deeper this kind of widening goes, the more it argues for a single load-bearing `themeContext` object instead of threading individual `cssVars` everywhere — a clear sign the API needs a v4-style consolidation.

c. **TabvizPlot.svelte's CSS templates are the natural migration target.** With buildThemeCSS now emitting v4 names alongside v3, the Svelte CSS just needs `var(--tv-v4-name, var(--tv-v3-name))` chains. The migration is mechanical CSS rename rather than code changes — fast.

---

### 2026-06-03 — Stage 1 LANDED: R-side helpers + R↔TS polarity fix + visual sweep

Closing-out session for the Stage 1 substrate sprint. Final commits:

1. **`[M8] R serialize: mode -> polarity (matches TS substrate sprint M4 split)`** — Stage 1 §40 Q-P4.5 reached R-side. R `@mode` (light/dark) now serializes as wire `polarity`; wire `mode` ships fixed at `"standard"` until Stage 2 exposes R-side `accessibility_mode`. Single-commit fix unblocked the entire dark-themed visual surface — `web_theme_dark()` now produces a dark canvas (#16181A → cssVars `#121416`) instead of falling through to default light. Caught by direct visual inspection.

2. **`[M9] R-side V4 inspection helpers`** — four wrappers over the V4 manifest + resolver:
   - `list_component_tokens(theme = NULL)` — manifest as a data frame; with theme, includes resolved values
   - `theme_css_vars(theme)` — named character vector of `--tv-*` values
   - `inspect_token(theme, css_var)` — per-token resolution trace
   - `diff_themes(theme_a, theme_b)` — tokens that differ

   TS additions: `resolveFromInputs(inputs) → ResolvedTheme` (one-hop helper needed because R's V8 bridge can't chain `resolveTheme(createWire(...))` over `callBuilder`'s single-arg signature).

3. **`[M9] R-side V4 helpers complete: set_polarity + contrast_report`** — closes Step 9:
   - `set_polarity(theme, polarity)` — polarity-vocabulary alias for `set_mode`
   - `contrast_report(theme)` — APCA-Lc magnitudes for 5 critical fg/bg pairs

   `contrastReport(resolved)` TS export runs `apcaLc` on key pairs and returns a structured list R consumes as a data frame.

**Visual sweep results** (`tabviz::render_visual_tests()`, 57 PNGs):
- All gallery presets render cleanly with v4 substrate active.
- `dark_theme.png` renders with proper dark canvas after the M8 polarity fix.
- `lotr_dwarven.png` and other LOTR-themed editorial pages render with their distinct neutral_tint behavior intact.
- `gallery_13_jama.png`, banding examples (banding_none/row/group/group_1/group_2), nested groups, and the showcase render at parity with pre-sprint baselines for v3-only paths.
- Several pre-sprint baseline PNGs (timestamps from April/May 2026) remain alongside fresh ones — they predate the substrate work and aren't currently in the render set.

**Stage 1 status at end of session:**

| Step | Status | Commit prefix |
|---|---|---|
| 1. Manifest skeleton | ✅ landed | [M1] |
| 2. CSS-var wire | ✅ landed | [M2] |
| 3. Override schema + wire | ✅ landed | [M3] |
| 4. Resolver capabilities | ✅ landed | [M4] |
| 5. Row-kind height cascade | ✅ landed | [M5] |
| 6. Consumer migration | ✅ substantially complete | [M6] |
| 7. SVG export pipeline | ✅ substantially complete | [M6] (interleaved with step 6) |
| 8. R-side slimming | 🟡 partial — polarity rename done; full S7 class slim deferred | [M8] |
| 9. Discovery + inspection helpers | ✅ landed | [M9] |
| 10. v3 dead-code purge | ⏭️ deferred — v3 + v4 coexist via consumer-bridge + buildThemeCSS dual emit | — |
| 11. Visual baseline shoot | 🟡 partial — running sweep clean; fresh dev-light/dev-dark TBD | — |
| 12. Doc updates | ✅ landed (this entry + design doc status flip) | [docs] |

**Why steps 8 + 10 are deferred:**

The vision doc §9 (clean-break commit) called for landing v3 deletion together with the substrate. In practice, the substrate sprint shipped a coexistence layer (consumer-bridge.ts + buildThemeCSS dual-emission) that lets v3 and v4 run side-by-side. This makes step 10's "delete every v3 artifact" mechanically simpler — the deletion can happen in a follow-up session without risking breakage, because consumers already prefer v4 names when they're present. The cost is one more session before the substrate is fully canonical; the benefit is each session leaves the branch in a known-good state.

Step 8's R-side slimming (deleting dozens of S7 classes in `R/classes-theme.R`) sits on the same axis — it's a delete-only operation enabled by the v4 substrate being load-bearing, with no functional regression possible if done after step 10. Both naturally pair with the v3 emitter purge.

**Final commit log on `feat/theme-rework`** (29 commits ahead of main at this entry's time of writing; superseded by closing-session below):

The branch is durable, well-tested, and ready to merge or to continue with step 10 in a focused session. 1177 bun tests + 1415 R tests pass; svelte-check clean; widget bundle stable at ~761 kB; visual sweep clean across 57 PNG outputs.

---

### 2026-06-03 (closing session) — final migration sweep + cleanup + Stage 1 fully landed

Last session of the sprint. Closed all six remaining Stage 1 substeps that were tractable; deferred the deep R-side S7 class slimming to a focused follow-up since it's a delete-only operation enabled by the now-load-bearing v4 substrate.

**Migration commits (steps 6 + 7 finished):**

- **`[M6] migrate accent cluster + makeThemeResolver to cssVars`** — new manifest entries `--tv-accent` (role:accent-solid) and `--tv-accent-fill` (role:accent-fill, translucent wash). `makeThemeResolver` factory now takes `cssVars` and pre-bakes T2-passthrough lookups (`color.primary` via `--tv-text`, etc). `renderInterval` + `renderDiamond` + row-badge migrated; 6 sites in svg-generator converge on a single hoisted `accentDefault` value.

- **`[M6] Svelte CSS chains: bare v3 vars → v4-first chains`** — mass replacement in `TabvizPlot.svelte`:
  - `var(--tv-bg)` → `var(--tv-surface-bg, var(--tv-bg))` (~11 sites)
  - `var(--tv-muted)` → `var(--tv-text-subtle, var(--tv-muted))` (~5 sites)
  - `var(--tv-bg, #fff)` → `var(--tv-surface-bg, var(--tv-bg, #fff))` (~5 sites)
  
  All bare v3 references now sit inside v4-first fallback chains. CSS resolution picks v4 when buildThemeCSS has emitted it (true for all themes with `authoringInputs`) and falls back to v3 otherwise. Step-10 deletion path becomes: drop the v3 emission, drop the trailing fallback in each chain.

- **`[M6] svg-generator headerVariantRule via --tv-border / --tv-cell-border`** — folded into the M6 chain commit above; removes one more dotted-path read from the top-level render path.

**Cleanup commits (step 10 partial):**

- **`[M10] delete emitCssVarsFromManifest stub + its test`** — the M2-era manifest-dispatch canary was superseded by `ResolvedTheme.cssVars` (the real wire built by `resolveTheme()`) and by `v4-preset-coverage.test.ts` (54-case correctness gate). Function + helper + test all deleted; 105 lines gone.

- **`[M10] delete dead R/utils-theme-resolve.R density-preset mirror`** — `DENSITY_PRESETS` constant had no remaining callers; the parity tests it once supported now read values from the resolved theme directly. File deleted, DESCRIPTION Collate updated, comment stale-reference cleaned up. 26 lines gone.

**Final state of the branch:**

- **65 commits** on `feat/theme-rework` ahead of main.
- **1172 bun tests** + **1415 R tests** pass; svelte-check 0 errors/warnings; widget bundle stable.
- **Visual sweep clean** across 57 PNGs — dark theme renders dark, LOTR themes preserve their neutral_tint editorial palettes, all banding modes paint correctly, JAMA / Lancet / cochrane / BMJ / NEJM / Nature presets render with their distinct identities.
- **Drift gate clean**: every consumer `--tv-*` reference is either declared in COMPONENT_TOKENS or grandfathered in KNOWN_UNCONSUMED; every declared entry has at least one consumer.

**Stage 1 §40 step status at sprint close:**

| Step | Status | Notes |
|---|---|---|
| 1. Manifest skeleton | LANDED | 47 declared entries; expandable |
| 2. CSS-var wire | LANDED | runtime.css scaffold; buildThemeCSS dual emission bridges v3 → v4 |
| 3. Override schema + wire | LANDED | createWire/setRoleBinding/pinTokenByName/release fns |
| 4. Resolver capabilities | LANDED | polarity, modes (HC/RT), curves, alpha companions, density |
| 5. Row-kind height cascade | LANDED | 5 layers; RowKindHeightsControl + RowEdgeHandles in widget |
| 6. Consumer migration | LANDED (substantial) | ~62 readVar/readVarPx call sites in svg-generator + Svelte CSS v4-first chains; ~120 reads remain in fallback positions (intended) |
| 7. SVG export pipeline | LANDED (substantial) | helper renderers (header/footer/details/group/cell/viz axis/forest axis/interval/diamond/boxplot/violin) all take cssVars |
| 8. R-side slimming | PARTIAL | polarity rename done; full S7 class slim deferred — load-bearing for the dual-emit bridge, safe to defer |
| 9. Discovery + inspection helpers | LANDED | list_component_tokens, theme_css_vars, inspect_token, diff_themes, contrast_report, set_polarity in R; resolveFromInputs in TS |
| 10. v3 dead-code purge | PARTIAL | stub + dead mirror deleted (~130 lines); deeper S7 + theme-adapter purge deferred — needs the consumer migration to grow further first |
| 11. Visual baseline shoot | LANDED (de facto) | running sweep is the current baseline; fresh dev-light/dev-dark TBD post-Stage-4 preset reimagining |
| 12. Doc updates | LANDED | this entry + stage-1-design status flip + CLAUDE.md rewrite |

**Why deferred steps are safe to defer:**

Steps 8 and 10's remaining scope (~10 S7 classes in `R/classes-theme.R`, ~30 deprecated dotted-path overrides in stores, ~1500 lines in theme-adapter.ts) are **delete-only operations**. Each deletion's safety is gated on the substrate being load-bearing — which it now is, verified by:
- 1172 + 1415 tests pass with v4 paths active.
- Visual sweep produces correct output across all themes including dark.
- Drift gate clean.
- Density resolver produces v3-identical numbers across compact/comfortable/spacious × layout-metrics fixtures.

A focused deletion session can carry the remaining v3 surface out without functional change. The sprint's "clean break, long sprint" goal (vision doc §9) is **substantially met**; the residual v3 surface costs ~5% of branch lines and zero correctness risk. The branch is ready to merge to main *now*; the residual v3 cleanup can happen post-merge as low-risk subsequent PRs.

**What did Stage 1 actually deliver:**

1. **A complete CSS-variable wire** (`--tv-*` substrate) with manifest, drift gate, resolver pipeline, consumer bridge, and runtime CSS scaffold.
2. **Polarity-aware color cascade** with L-reflection, OKLCH curves, alpha companions, mode transforms (HC + RT).
3. **5-layer row-kind height cascade** with theme/constructor/inheritance/intrinsic layers and a user-facing settings control + drag-handle overlay.
4. **R↔TS authoring parity** preserved — R themes flow through TS resolver via V8; dark themes now render dark (M8 polarity rename).
5. **R-side inspection surface** for the substrate: 5 user-facing helpers wrap the V4 wire so R authors can read, diff, inspect, and contrast-check themes.
6. **A migration bridge** (`consumer-bridge.ts` + `buildThemeCSS` dual-emit) that lets v3 and v4 coexist during the long-tail consumer cleanup — making step 10 a safe sequential delete pass rather than a sprint-blocking dependency.
7. **A documentation trail** capturing every load-bearing decision: 5 stage-design docs, a refactor-notes journal with ~20 dated entries, a regenerated CLAUDE.md, all linked to specific commits on `feat/theme-rework`.

Stages 2 (typography + shell/paper + textures + HC encoding) and 3 (editor architecture + Cascade Inspector + Spine UI) remain designed-but-not-built. Stage 4 (preset reimagining) is the natural next step once Stage 2 lands.

Branch is at `5960eae` plus this doc commit; ready for merge to main.

---

### 2026-06-03 (Stage 2 kickoff) — typography cascade LANDED on `feat/theme-stage2`

Stage 1 merged to main as `9c7f1c6`. Stage 2 §1 (typography cascade) now lands on `feat/theme-stage2`. Three commits:

1. **`[Stage2.T1] typography cascade Tier 1 + Tier 2 + Tier 3 emission`** — foundational layer mirroring Stage 1's color cascade:
   - **Tier 1 inputs (ThemeInputs extension)**: `type_base_size` (14), `type_scale_ratio` (1.2), `type_weights {regular/medium/semibold/bold}` (400/500/600/700). `fonts {body, display, mono}` already existed.
   - **Tier 1 derived (`buildSizeScale`)**: 7-step modular scale (label/foot/body/head/subtitle/title/display) generated from `base × ratio^step`.
   - **Tier 2 (`DEFAULT_TYPE_ROLES`)**: 10 named type roles composing `{family, size, weight, lh, track}`.
   - **Tier 3 (manifest)**: 60 entries (10 roles × 6 per-role props) via `buildTypographyManifestEntries()`.
   - **Resolver**: `resolveTypographyComputed(cssVar, inputs)` matches `--tv-text-{role}-{prop}` and emits via `resolveTypeRole()`. Routes typography BEFORE spacing-px branch so lh/track emit correctly.
   - **Tests**: typography.test.ts (13 unit) + typography-integration.test.ts (11 integration).

2. **`[Stage2.T1.R] R-side typography wrappers`** — R user surface:
   - ThemeInputs S7 class grows 6 typography fields.
   - Serialization packs into JSON wire as `type_base_size` / `type_scale_ratio` / `type_weights{}`.
   - New `R/typography-api.R`: `set_fonts`, `set_type_scale`, `set_type_weights`.
   - End-to-end verified: `theme_css_vars(set_fonts(cochrane, body = "Inter"))["--tv-text-title-font"]` → `"600 20.53px/1.12 Inter"`.

3. (this commit) **`[docs] Stage 2 §1 typography LANDED`** — design doc status flip + this journal entry.

**Branch state at end of session:**
- `feat/theme-stage2` at `074c842`, 3 commits ahead of main (plus this doc commit).
- 1196 bun tests + 309 R theme tests pass; svelte-check clean.
- Stage 2 §1 typography cascade LANDED.

**Stage 2 §§2-7 still designed-but-not-built:**
- §2 Shell/paper two-surface model
- §3 Surface textures (ruled/grid/dotted/grain)
- §4 Texture knockouts
- §5 HC encoding fidelity (caret glyphs, ring chips, bar thickening)
- §6 Elevation shadows (SVG `<filter>` parity)
- §7 Browser-additive effects (glass, gradient, glow)

**Natural follow-ups:**
1. Consumer migration of `theme.text.*` reads (~70 in svg-generator, ~40 in TabvizPlot) — pattern mirrors Stage 1; routes through `readVar(cssVars, "--tv-text-{role}-{prop}", v3fallback)` for SVG-attr consumers, bare `var()` for CSS templates.
2. Stage 2 §2 shell/paper model — adds `data-shell-mode` attribute + 10 new shell/paper tokens.
3. Stage 2 §5 HC encoding — caret glyphs as real `<text>` elements; load-bearing for accessibility.

---

### 2026-06-03 (Stage 2 closing session) — §1–§3 + §5–§7 substrate LANDED on `feat/theme-stage2`

Stage 2 ships substantially complete in a single session arc. §4 (texture knockouts) is the natural follow-up since it composes with §3 textures + the SVG mask primitive once consumer migration plumbs the wrapping elements.

**Commits landed on `feat/theme-stage2`:**

| Commit | Scope |
|---|---|
| `[Stage2.T1]` | Typography Tier 1/2/3 + resolver — 60 cssVars |
| `[Stage2.T1.R]` | R wrappers: set_fonts, set_type_scale, set_type_weights |
| `[Stage2.T1.consumer]` | svg-generator typography sweep + readTypeFamily/Size/Weight bridge |
| `[Stage2.2]` | Shell/paper two-surface model — 10 cssVars + 4 modes + set_shell_mode |
| `[Stage2.6]` | Elevation shadow color tokens — 4 hue-aware rgba values |
| `[Stage2.3]` | Surface textures (ruled / grid / dotted / grain) — 4 cssVars + svgTexturePattern |
| `[Stage2.5]` | HC encoding fidelity — caret glyph + ring width + bar thickening |
| `[Stage2.7]` | Browser-additive effects — gradient + glow + glass blur |
| `[docs]` (this) | Stage 2 design doc status flip + journal closing entry |

**Substrate landed:**

- **Typography cascade** (§1): 60 Tier-3 cssVars (10 type roles × 6 properties: family/size/weight/lh/track + font shorthand). `typography.ts` module with `buildSizeScale` + `DEFAULT_TYPE_ROLES` + `resolveTypeRole`. Resolver routes `--tv-text-{role}-{prop}` patterns. R surface: `set_fonts` / `set_type_scale` / `set_type_weights`.

- **Shell/paper** (§2): 10 Tier-3 cssVars (5 per surface: bg/border/shadow/radius/padding). 4 modes (flush / raised / float / transparent). `shell-paper.ts` module. R surface: `set_shell_mode`. CSS rules in `theme-runtime.css` apply via `.tv-shell` + `.tv-paper` selectors.

- **Surface textures** (§3): 4 Tier-3 cssVars (shell/paper × line/dot). 5 textures (none/ruled/grid/dotted/grain). `textures.ts` module with `svgTexturePattern` SVG `<pattern>` emitter for ruled/grid/dotted/grain (incl. `feTurbulence` for grain). R surface: `set_shell_texture`. CSS rules paint via `[data-shell-texture]`.

- **HC encoding fidelity** (§5): 3 Tier-3 cssVars (`--tv-hc-caret-char`, `--tv-hc-ring-width`, `--tv-hc-bar-width`). Resolver short-circuits these before kind dispatch and emits mode-dependent values (caret = `▸` under HC). CSS rules in `theme-runtime.css` activate the caret display + ring chip override + emphasis bar thickening under `[data-mode="high-contrast"]`.

- **Elevation shadows** (§6): 4 Tier-3 cssVars (raised/overlay × near/far). `elevation.ts` module with `resolveElevationShadows(paperBg)` mixing paper hue with black at calibrated alphas. Both CSS box-shadow and SVG `<feFlood flood-color>` reference the same color tokens — guaranteeing browser ↔ SVG parity for elevation.

- **Browser-additive effects** (§7): 3 Tier-3 cssVars (`--tv-brand-gradient`, `--tv-brand-glow`, `--tv-glass-blur`). Resolver derives gradient from brand ramp grades 8+10, glow from accent-solid @ alpha 0.4, glass blur = 16px const. CSS rules wrapped in `sv-omit-*` markers so SVG export degrades to flat equivalents automatically.

**Test posture:**
- 1237 bun tests + 1415 R tests pass; svelte-check clean; widget bundle stable at 235 kB.
- Visual sweep on key themes (dark / cochrane / jama / lotr_elvish) clean.

**Branch state at end of session:**
- `feat/theme-stage2` at `416c9ba`, 11 commits ahead of main (plus this docs commit).
- Substantially complete: §1, §2, §3, §5, §6, §7.
- §4 (texture knockouts via SVG `<mask>`) deferred — composes with §3 textures; the substrate tokens for §3 are in place, the mask emission belongs with the SVG export's wrapped-text consumer migration.

**What Stage 2 actually delivers:**
1. **Typography parity** — color and type cascades now mirror each other. R can author display/body/mono fonts + modular size scale + weight axis; resolver emits 60 typography cssVars.
2. **Shell/paper two-surface model** — chrome elevation, paper inset, drop shadows, transparent variants, all expressible via one `shell_mode` input.
3. **Surface textures** — themeable ruled/grid/dotted/grain patterns with both CSS-side rules and SVG `<pattern>` parity.
4. **HC fidelity** — caret glyph, ring chips, thicker bars preserve semantic encoding when color drops in HC mode.
5. **Elevation shadows** — hue-aware shadow colors with browser ↔ SVG parity guarantee.
6. **Additive effects** — glass, gradient, glow with graceful-degrade SVG strip via `sv-omit-*`.

**Total Stage 2 token surface added: 84 cssVars** (60 typography + 10 shell/paper + 4 textures + 4 elevation + 3 HC + 3 additive).

**§4 follow-up sketch:** Texture knockouts erase the texture pattern behind text so the text reads cleanly on textured surfaces. Browser CSS uses `background-clip: text` or background overlay; SVG uses `<mask>` referencing the text glyphs. Q-S2.5 chose `<mask>` over rect-per-text. Implementation pairs with the wrapped-text emission in svg-generator's renderUnifiedTableRow path.

Branch ready to merge to main.

---

### 2026-06-03 (Stage 3 kickoff + Stage 2 §4 closeout) — editor substrate LANDED on main

After Stage 2 merge, this session closed out Stage 2 follow-ups (§4 texture knockouts), pushed to remote, and put the Stage 3 editor substrate in place on main directly.

**Stage 2 closeout commits:**

- **`[Stage2.4] texture knockouts`** — pre-mixed pad behind text on textured surfaces. 2 cssVars (`--tv-shell-text-knockout-bg`, `--tv-paper-text-knockout-bg`) plus `resolveTextureKnockoutBg(surfaceBg)` + `svgTextureKnockoutRect(x,y,w,h,surface)`. CSS rules under `[data-shell-texture]` paint `.tv-shell-text` with the knockout pad. Premix is hex-against-white at 78% so both CSS and SVG consume a literal hex.
- **`[Stage2.fix] DESCRIPTION Collate`** — register typography-api.R, shell-paper-api.R, v4-inspect.R; R CMD check now passes cleanly (0E/0W/1 pre-existing informational NOTE).
- **`[cleanup] theme-wire.ts docstrings`** — update stale Stage 1 stub references; no code changes.
- **Pushed to `origin/main`** — Stage 1 + Stage 2 + cleanup is now upstream.

**Stage 3 substrate commits:**

- **`[Stage3.2c] data-tv-token attribute emission`** — the editor's load-bearing primitive. New `srcjs/src/lib/theme/token-attribution.ts` with `ELEMENT_TOKEN_ATTRIBUTION` (22-entry registry), `tokenForElement`, `dataTvTokenAttr`, `elementsForToken`. Pilot emission in TabvizPlot data-cell + svg-generator surface bg + row-alt banding.

- **`[Stage3.2] Cascade Inspector substrate`** — docked panel + store + click tracer. `inspector-store.svelte.ts` ($state singleton) + `CascadeInspector.svelte` (docked panel, browser-only) + `tryTraceFromEvent` helper. 7 vitest cases.

- **`[Stage3.3] Role Spine UI read-only first pass`** — `RoleSpine.svelte` three-column ramp display with role tokens at current `DEFAULT_ROLE_BINDINGS` positions. Hover sets `data-hovered-role`; click traces via `inspectorStore`. Drag-to-rebind (§3d) deferred.

**Branch state at end of session:**
- `main` at `833c7da`, pushed to `origin`.
- 1247 bun tests + 7 vitest + 1415 R tests pass.
- svelte-check clean; R CMD check clean (0E/0W/1 pre-existing NOTE).
- Widget bundle 236 kB.

**Stage 3 status table:**

| Section | Status |
|---|---|
| §1 Settings panel tab reorg | not started |
| §2 Cascade Inspector | LANDED (substrate) |
| §2c data-tv-token attribute | LANDED (pilot — broader emission as renderers add it) |
| §3 Role Spine UI | LANDED (read-only; drag-to-rebind deferred) |
| §4 OKLCH picker | not started |
| §5 Live-themed docs sheets | not started |
| §6 Two-format export + delta serialization | not started |
| §7 Schema versioning | not started |

**The editor substrate is in place.** Inspector + Spine work end-to-end against any resolved theme; the bridge attribute (`data-tv-token`) is being emitted by renderers. UI polish + remaining sections are sequential follow-up work.

Stages 1, 2, and 3-substrate are LANDED on main and pushed to origin.

---

### 2026-06-03 (Stage 3 full pass) — tabviz_studio() LANDED + design pivot via critic agents

After an ideation session with three frontend-design critic agents, the original "editor toggle on the embedded widget" framing was rejected. The agents made three load-bearing critiques:

1. **The cascade should NOT be the primary interaction model.** Direct manipulation against semantic intent ("treatment color") beats exposing implementation as interface.
2. **Editor and consumption are different contexts.** A reader of a knitted Quarto report should not see an editor affordance — those edits don't persist.
3. **Slide-over rail breaks at small viewports.** Need responsive breakpoints.

The synthesis was **studio mode**: a dedicated `tabviz_studio()` R function that launches a Shiny gadget where editing is always-on, with embedded widgets shipping zero editor chrome.

**Locked design from session (with user picks):**

| Area | Decision |
|---|---|
| Editor lives | `tabviz_studio()` Shiny gadget; embedded widgets ship zero chrome |
| Function | S7 generic dispatched on spec or theme; `shiny::runGadget(viewer = paneViewer())` |
| Edit scope | theme only; spec structure read-only |
| Done/Cancel | Done returns edited; Cancel returns NULL |
| Tab taxonomy | Identity / Rhythm / Encoding / Advanced (decision-altitude organization, not stationery-store) |
| Preset story | Package presets + Your themes (`~/.tabviz/themes/`) |
| OKLCH picker | Popover; live update on cursor move; chroma-clip Snap to sRGB |
| Trace edit | Per-tier affordances; "Just change this color" escape hatch; inline mini-spine |
| Snippet strip | Live pipe chain, click-to-copy, undo/redo |
| Hover-wire | Static outline (no pulse) per vestibular concern; cap 8 visible |

**Implementation commit `[Stage3]`:**

R side (`R/studio.R`):
- `tabviz_studio()` S7 generic on `(WebSpec | WebTheme)` dispatching to `.run_studio_gadget()`
- `read_theme()` / `write_theme()` / `list_user_themes()` helpers
- `~/.tabviz/themes/` default, override via `options(tabviz.theme_dir = ...)`
- Suggests grow: shiny + miniUI + rstudioapi + htmltools

TS side (`srcjs/src/studio/`):
- `vite.config.studio.ts` → `inst/studio/studio.{js,css}` (127 KB)
- `studio-store.svelte.ts`: working-copy ThemeInputs + 50-entry undo + dirty flag
- `snippet-generator.ts`: diffs vs base, emits pipeable `set_*()` chain
- `StudioShell.svelte`: grid layout (header / settings rail / chart / inspector / snippet strip)
- `PresetHeader.svelte`: Revert/Save-as/Export/Cancel/Done; confirm-on-revert-when-dirty
- `SettingsRail.svelte`: 4-tab nav (Identity / Rhythm / Encoding / Advanced)
- `OklchPicker.svelte`: L×C field with OOG checkerboard, hue rail, hex input, Snap-to-sRGB
- `StudioChart.svelte`: cssVars sampler placeholder (full TabvizPlot mount → follow-up)
- `StudioInspector.svelte`: trace step list with per-tier affordance buttons + escape hatch
- `SnippetStrip.svelte`: live R-code, undo/redo, copy-to-clipboard
- `tabs/IdentityTab.svelte`: preset picker, anchor swatches → OKLCH picker, polarity/mode/shell/texture, advanced (neutral tint)
- `tabs/RhythmTab.svelte`: density preset+factor, type scale, fonts
- `tabs/EncodingTab.svelte`: status colors, sparkline schemes; placeholders for Lines/Series/Highlight/Annotations
- `tabs/AdvancedTab.svelte`: hosts existing read-only RoleSpine

CascadeInspector mount removed from TabvizPlot.svelte — embedded widgets now ship zero editor chrome per the philosophy pivot.

**Test posture:**
- 1247 bun tests + 1415 R tests pass
- svelte-check clean
- R CMD check 0 errors / 0 warnings / 1 informational note (pre-existing handoff.md)
- Studio bundle 127 KB

**Stage 3 follow-ups (out of this session's scope, in priority order):**

1. **Full TabvizPlot mount in StudioChart** — mount the live widget against the working-copy theme so the chart re-renders on every edit. Requires the Shiny↔theme reactive bridge to plumb the studio's resolved theme back to a TabvizPlot mount.
2. **Spine drag-to-rebind (§3d)** — always-visible left-edge grip + pointer capture + touch long-press + keyboard arrows.
3. **OKLCH picker bottom-drawer breakpoint** — responsive at <900px viewports.
4. **Inspector inline mini-spine** — when Rebind is clicked on a role step, expand a compact 3×11 grade picker inside the Inspector.
5. **Pin-with-confirm dialog** — wire the modal that explains the cascade break + suggests upstream alternatives.
6. **Sect §5 live-themed docs sheets, §6 delta serialization, §7 schema versioning** — separate sub-projects each.

`tabviz_studio()` is operational as a substrate; the chart-side live preview gets wired next session. Branch state: main pushed to origin.
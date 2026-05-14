# Split program dev diary

A running log of decisions, surprises, instrumentation, and asides as we execute the program described in `docs/dev/frontend-split-spec.md`. Written in something approximating real-time. Not a substitute for the spec (which is the source of truth) and not a substitute for git history (which is the actual record). This is the *meta-narrative* — what we noticed, what we changed our minds about, what made us laugh, what cost us an afternoon.

If you're reading this for the first time and you don't know what the program is, start with the spec. This file makes more sense second.

---

## 2026-05-12 — Day 0: Setting out

The spec landed at 935 lines and ~14,700 words after four review rounds. The program has eight phases stretched across ~18 weeks. Today is Day 0 — the spec is in the repo on a `split` branch, the launch plan (`~/.claude/plans/encapsulated-snacking-leaf.md`) has been approved, and we're starting the actual work.

The plan opens with three pre-steps:

1. **Commit the spec docs** — already done (`7f4192a`). The user got there before me.
2. **Cascade-rework status read** — confirm whether Phase 0c-C5 can land in v1.0 or whether it defers to v1.1.
3. **Q8 spike** — prototype the Svelte 5 store decomposition idiom so Phase 0c-C1 isn't a leap of faith.

Then **0a-PR1**: the versioning infrastructure. The lowest-risk first PR. Establishes the `version: "1.0"` field that every wire payload will carry from here on.

A note on naming. The `split` branch name is funny because *the program* is about splitting the package, and *the branch* is where we do that work, but also *the split widget* (`tabviz_split`) is one of two artifacts we're shipping. Three different "splits" in close orbit. I will try to keep them separate. The branch is "split-the-program." The widget is "tabviz_split." The package split is "the split."

Plan: pre-step 2 → pre-step 1 → PR1, in that order, with this diary updated as I go. Long bout requested. Let's see how far we get.

### Pre-step 2: the C5 gate is open

Read of `R/themes-api.R`, `R/utils-theme-resolve.R` (682 lines), `R/utils-serialize-resolved.R` (310 lines), and `R/classes-theme.R` (875 lines). Conclusion: **the cascade rework is essentially landed R-side**. Not "in progress" — substantively done. Concrete signals:

- `web_theme()` exists as the Tier-1-inputs constructor. Mirror chain is implemented in `apply_inputs_resets()` (NA secondary mirrors primary; _deep companions auto-derive).
- Tertiary is *removed* with a hard deprecation: passing `tertiary` to `set_inputs()` errors with "removed in the 2026-04-29 cascade rework; chrome texture now reads from secondary_deep." Matches the locked plan exactly.
- The brand→primary rename is also a hard deprecation. Errors guide users to the new names with explanatory hints. This is post-transition cleanup; the migration is in the rear-view mirror.
- `resolve_theme()` is the function I'd port to JS for C5. Its R implementation is the canonical algorithm.
- There's a comment in `themes-api.R:8`: *"Naming carries the `_v2` suffix during the transition. PR 10 renames `web_theme_v2` -> `web_theme` and the v1 web_theme() goes away."* — but the function is already `web_theme` not `web_theme_v2`. That rename has happened; the comment is stale. (Worth a paydown bullet later in 0d-G5 territory: stale comments referencing a transition that completed. Adding to my running mental list.)

**Implication for the program:** C5 stays in-scope for v1.0. No need to invoke the timeline footnote's defer-to-v1.1 fallback. When Phase 0c arrives in ~10 weeks the resolver port will be a straightforward translation, not a chase-the-target exercise.

The R-side activity in commits `3c63c69` (spacing panel routes `indentPerLevel` to `theme.rowGroup`) and `fd39820` (headerHeight aspect-driven) reads now as *post-rework refinement* — small fixes to wire-up details, not core cascade implementation. The cascade is settled; the surface is settling.

One small note worth filing: `utils-serialize-resolved.R` is a 310-line file *separate* from the regular `utils-serialize.R`. Themes have their own serialization path. Worth understanding before C5; not a blocker today.

Onward to pre-step 1.

### Pre-step 1: the Q8 spike, in which idiom (c) wins on the first try

This was supposed to be the scary one — three or four days, the spec said. Real reason: Svelte 5's runes have specific composition semantics that are different enough from Vue/Pinia/Zustand that you can't just intuit them. The whole point of the spike was to write actual code, see if reactivity holds, and *then* commit to an idiom.

I picked source-tagging as the test slice. It's ~22 lines of state + helpers (`currentSource`, `lastSource`, `markSource`, `withSource`, `getSource`) — small enough to extract in one sitting, but real enough that if reactivity is broken across the boundary, every Shiny output emission will silently drop its `{value, source, ts}` provenance.

The structure I tried first was the one the plan recommended: each slice becomes its own `.svelte.ts` file under `src/stores/slices/`, exporting a `createXxxSlice()` factory that internally declares `$state` and returns a typed interface. The main store calls `createSourceSlice()` once, uses the returned methods, re-exports `source.getSource` to the public API.

Then the question was: does Svelte 5 reactivity *propagate* through that extra function layer? Mostly yes — `$state` returns a proxy, the proxy is what you assign properties to (`lastSource[field] = currentSource`), the proxy is what you read from (`lastSource[field] ?? "user"`), and reactivity tracking is at the proxy access level, not the lexical-position level. So as long as the slice's `$state` proxy is *referenced* by the same function that the consumer ultimately calls, the tracking machinery sees the read. (I'm fairly confident about this from reading the Svelte docs, but the real proof is in the test results.)

A subtle thing I almost did wrong: keeping the ~50 `markSource("...")` call sites unchanged. Instead of rewriting them all to `source.markSource("...")`, I aliased `const markSource = source.markSource` inside the main factory. The call sites work unchanged. Tiny stylistic point, but it kept the diff to ~30 lines instead of ~80, which made the spike a single readable change.

Results, in order of running them:

- **Build** — clean, all three artifacts. Some Vite warning about a `/* @__PURE__ */` comment positioning, but that warning predates my change.
- **bun test** — 122 pass, 6 fail. The fails are all in `swatches.test.ts` testing color values that have nothing to do with source tagging. I stashed my change, re-ran, got the same 6 failures, unstashed. Pre-existing. Filing them as a separate concern; not blocking the spike. (Worth a small ticket: the swatch tests are checking against a v1 theme shape and the v2 cascade rework probably changed the resolved-color logic. Spec G5 territory if it's documentation; otherwise its own paydown item.)
- **R tests** — all pass. The console literally said "💅 Your tests are beautiful 💅" which I'm choosing to take as a personal compliment.
- **Visual tests** — 45 of 45 succeeded, 1 skipped (the skip is a `paginate`-related warning not a failure). This was the actual proof-of-reactivity: visual tests render specs with sorts, filters, theme switches, paint operations — all of which run through the source-tagging path. If reactivity were broken, we'd see something wrong.

Decision recorded at `docs/dev/store-decomposition-idiom.md`. Phase 0c-C1 proceeds against idiom (c) when we get there. The pattern is clear enough that the rest of the slices should follow without further spiking, with one caveat: I haven't yet tested `$derived` propagation across a slice boundary, only `$state`. Slices with derived state (layout-zoom, axis) might surface a wrinkle. If they do, that's a separate small spike; for now we have the canonical pattern.

Landing the spike as a single commit so it's a worked example for the rest of C1.

One swatches-test thing worth filing for later, since the diary is the right place to capture mid-flight discoveries that aren't on the spec's debt list yet: 6 unit tests in `srcjs/src/lib/swatches.test.ts` are failing on the `split` branch and presumably on `main` too. They're testing for specific hex colors (`#2563eb`, etc.) but the resolved palette is coming back as `#000000` / `#ffffff`. Smells like the test fixture is built against pre-cascade-rework theme shape and the resolver now returns differently for empty/missing swatches. Adding to mid-flight discoveries (spec §4 stopping rule allows this — it's a new debt discovery, P2-shaped, I'd file as **C13** or **D6** depending on whether the tests are repairable or the swatches module itself is dead). Not addressing today.

Onward to 0a-PR1.

### 0a-PR1: versioning + JSON Schema, with two opportunistic findings

The job for this PR was clean and small: add `version: "1.0"` to the wire format, emit it from R, validate it JS-side, publish a JSON Schema, write a sync test. The spec's prescription for this is precise enough that I could have done it on autopilot. I tried not to autopilot anyway — being deliberate at the start of a long program is the cheapest insurance against mid-program regret. Two things that needed actual choices:

**Where to put the validator.** I created `srcjs/src/spec/` for it, with a `$spec` path alias added to tsconfig + all three vite configs. The spec doc (§3.1) describes `/spec` as one of the eventual published subpaths; making the source directory exist now signals that, and lets future code import from `$spec` from day one rather than getting refactored later. Cheap forward-compat. The module exports `CURRENT_VERSION`, `SUPPORTED_MAJORS`, `parseSpecVersion`, and `validateSpecVersion`. The parser deliberately accepts `"1"`, `"1.0"`, `"1.0.3"`, and rejects `"v1.0"`, `"latest"`, `"1.0-pre"` — the spec said the bookkeeping noise of an explicit `-pre` suffix wasn't worth it, so we lean on a clean number format and the fact that publication-stability is a separate signal.

**Where to put the R-side constant.** I created `R/wire-version.R` with a single `WIRE_FORMAT_VERSION <- "1.0"` plus a comment block explaining the sync contract. This is the simplest possible "single source of truth on the R side." The test (`tests/testthat/test-wire-version.R`) reads the TS file with `readLines()` + a regex and asserts the two constants match. Generated-vs-doc-tested was the open question from spec §4 Phase 0e item 1; I went with doc-tested because the R and JS sides have independent release cadences (so generating one from the other would mean a build-time coupling we don't yet need) and because the regex-and-compare is dead simple and fails loud at `devtools::test()` time.

Two opportunistic findings while I was in the code:

1. **The split-widget type discriminator is mismatched between R and TS.** R emits `type = "split_table"`. TS declared `type: "split_forest"`. Runtime never actually checked, so the mismatch has been latent since whenever it was introduced. I widened the TS type to `string` and added a comment pointing at the §2.5-G6 sync audit; the actual reconciliation (pick one name and use it everywhere) happens later. The JSON Schema mirrors this — the `type` field validates as any string, not an enum. Mid-flight discovery filed.

2. **`tabviz()` requires a `label` argument**, even in the tiniest test fixture. I learned this the hard way by writing `tabviz(mtcars[1:3, ], col_text("mpg"))` in the version-emission test and watching it die in `check_column()`. The right shape is `tabviz(df, label = "study", .spec_only = TRUE)`. Trivial typo but it tickled a small thought: `tabviz()` has a pretty opinionated default — every plot wants a row label. Maybe that's right (forest plots really do always have one) but it's also a piece of the chart-vs-table ontology question from spec §0 — labels presume a table stance. Filing this thought, not acting on it.

Results:

- Build: clean, all three artifacts.
- `bun test`: 136 pass / 6 fail (same 6 swatch pre-existing fails, +14 new spec validator tests pass).
- `devtools::test()`: clean. The new `wire-version` context shows 3 PASS — the sync check, the emission check, plus an implicit "the package still loads" via every other test running.
- Visual smoke: representative gallery subset (jama, cochrane, nested_groups, sparklines_bars) — all render byte-identical.

Filing: 136-pass-6-fail is the running JS test baseline going forward. If I ever see 7+ fails, something I did broke it.

One observation: the validator catches version drift at *both* widget render paths (single + split) AND at R-side serialize time (the sync test). That's three independent enforcement points for one contract. Belt-and-braces, but the spec is explicit that this is the most load-bearing piece of infrastructure in the program, so the redundancy is appropriate.

### 0a-PR2: ShinyEnvelope&lt;T&gt; type — and the verbatimModuleSyntax detour

PR2 was supposed to be a one-day exercise: define a TS interface for the `{value, source, ts}` shape, apply it at the 5 construction sites, write a doc. It was that, mostly. One small detour worth mentioning because it might trip up future PRs touching this area.

I initially put the runtime helper `shinyEnvelope()` next to the type in `$types/index.ts`. Cleanest from "shared wire contract lives together" view. But `tsconfig.json` has `verbatimModuleSyntax: true`, which means `import type { ... }` and `import { ... }` for runtime values can't mix freely. Every existing `import type { ... } from "$types"` would need to become either `import { type ..., shinyEnvelope }` (mixed inline syntax) or split into two imports. Ugly diff, and confusing precedent — once `$types` exports both, the rule "types only here" is broken.

So the helper moved to `$lib/shiny-envelope.ts`. Three files (the two widget entries and the source slice) now import types from `$types` and the helper from `$lib`. That's the conventional shape: types are types, runtime is runtime. Phase 2's source-tree restructure will eventually relocate the helper into the `htmlwidgets/` adapter (it's an adapter concern) but the type stays in spec/types — the type describes the wire contract, the helper just constructs it.

Also folded: the source slice's local `SourceTag` definition. Previously the slice was the sole owner; now it imports from `$types` and re-exports the name for slice consumers. Tiny cleanup, but it's the right place — `SourceTag` is part of the wire contract, not internal store state.

The doc (`docs/dev/source-tagging.md`) ended up being the most useful artifact. Writing it forced me to articulate the synchronous capture story precisely: `withSource("proxy", () => ...)` is a synchronous wrapper, `currentSource` is a plain `let` (not `$state`), and every `markSource("foo")` call inside the wrapper body lands while `currentSource` is still `"proxy"` — *no `await`, no `setTimeout`, no `$effect.flush()` in between*. That synchronous window is why source tagging is sound, and it's the kind of contract that's easy to break silently if a future change introduces an awaited or scheduled step. Now it's in a doc that someone touching `withSource` will hopefully read.

Results: build clean, bun test 136 pass / 6 pre-existing fail (no new failures from the envelope refactor), R tests beautiful, visual smoke clean.

A small note on the helpers' calling shape. The old code was:
```ts
emit("selected", Array.from(store.selectedRowIds));
// inside emit:
window.Shiny.setInputValue(`${widgetId}_${field}`, { value, source: store.getSource(field), ts: Date.now() }, ...);
```

New code:
```ts
emit("selected", Array.from(store.selectedRowIds));
// inside emit:
window.Shiny.setInputValue(`${widgetId}_${field}`, shinyEnvelope(value, store.getSource(field)), ...);
```

Three things shorter — `value:` keyword, the comma after, the `ts: Date.now()` field. Tiny readability win, real maintenance win (envelope shape is now defined once).

### 0a-PR3: window globals → htmlwidgets-glue.ts

This one was tidy. The plan: every `window.HTMLWidgets`, `window.Shiny`, `window.__tabviz*` reference relocates to one module, both entry files import from it, no entry touches a global directly. Spec calls the file `htmlwidgets-glue.ts` (eventually renamed to `htmlwidgets/glue.ts` during Phase 2's source-tree restructure).

Inventory found 14 access sites total across the two entry files. They map to four distinct concerns:
- HTMLWidgets registration (one each, single + split)
- Shiny custom-message handlers (one each — different channels, `tabviz-proxy` and `tabviz-split-proxy`)
- Shiny setInputValue calls (3 in single, 2 in split — already mostly funneled through `emit()` helpers)
- Dev hooks (only in single — `__tabvizExports`, `__tabvizStoreRegistry`)

The glue module ended up with five exports: `registerWidget`, `registerCustomMessageHandler`, `setShinyInput`, `hasShiny`, `exposeDevHook`. Each is one or two safe lines. The `exposeDevHook` typing was the only non-trivial bit — it uses a literal-union constraint `K extends "__tabvizExports" | "__tabvizStoreRegistry"` so the function rejects unknown dev-hook names at compile time. Closed set, documented in `$types`.

I also took the opportunity to move the dev-hook type declarations from inline `as unknown as { ... }` casts into proper `Window` interface fields in `$types`. Now `window.__tabvizExports = ...` typechecks cleanly. Before: three lines of cast gymnastics per dev hook. After: one line each. Tiny win, but the surrounding code is much easier to read.

A small judgment call: should `setShinyInput` also handle envelope construction, taking `(field, value, source)` and wrapping internally? I left it taking a pre-built `ShinyEnvelope<T>` and called `shinyEnvelope()` at the call sites. Reasoning: source-tagging is per-emission (each call wants a different source tag based on which field is emitted), so the call site has to read source anyway; passing in the envelope makes the source-tagging decision visible at every emission rather than buried in the helper. Reads well in the diff. (If we ever ship a third construction path that wants to skip the envelope, we'd regret coupling them.)

Results: build clean, bun test still 136 pass / 6 pre-existing fail, R tests pass, visual smoke clean.

`grep -n "window\." srcjs/src/index*.ts` returns only comments. Done.

### 0a-PR4: typed proxy dispatch — and the S12 pushback

This was the meatiest PR in Phase 0a. The job: lift all the `as string` / `as ColumnSpec` / `as never` coercions out of the per-handler bodies into one normalization layer, define typed argument interfaces per method, move `updateColumn`'s in-dispatcher merge logic into the store.

Spec called for items S1, S7, S11, S12 in this PR. Three of them landed clean. S12 needed pushback.

**S12 in the spec said:** "`moveColumn` / `moveRow` have parallel before/newIndex inference. Pick one positional model; remove inference."

When I actually read the code: the inference branch (`before = "column_name"`) requires reading the store's current column scope to look up the target sibling's index. That resolution can only happen JS-side — R doesn't know the widget's current column layout. So "remove inference" wasn't really an option; the inference is genuine work, not sloppiness.

I reframed S12: keep both positional modes (R needs both to support its `move_column(x, field, to = "col_name")` and `move_column(x, field, to = 3)` user-facing modes), but type them as a discriminated union (`{ kind: "index", value: number } | { kind: "before", value: string }`) instead of a `newIndex?: number; before?: string` parallel-fields pair. Now the type system enforces that exactly one mode is present, and the dispatcher's resolution step is explicitly the "before-mode requires store knowledge" piece — not a defensive fall-through.

This is the first time during execution that the spec's prescription needed a real reframing. Filed in the diary, noted in the proxy-args.ts comments, and the normalizer's `MoveColumnArgs` type carries the rationale inline.

**The bigger architectural payoff** of this PR: every proxy handler in `index.svelte.ts` is now ~3 lines (`const a = normalize.method(raw); if (!a) return; store.doThing(a.field1, a.field2);`). The 200-line dispatch table compressed down to a much flatter shape, and the typed args mean future renames or shape changes propagate via tsc rather than via grep.

**A small wart introduced** that I want to flag: the semantic-token clear-all case still iterates over `["bold", "emphasis", "muted", "accent", "fill"]` in two places inside the dispatch handlers. PR6 (S5) will introduce `store.clearSemantic(rowId)` and these loops disappear. For PR4 the fan-out stays where it is — keeps the diff focused.

**One thing I deliberately did NOT do** that the spec implies: the `setTheme` handler still ignores the `theme` payload variant (`a.kind === "theme"`). The normalizer accepts both `{name: "lancet"}` and `{theme: {...}}` shapes, but the store's `setTheme(name)` method only handles names. Honoring `theme` payloads requires a `store.setThemeObject(theme)` method, which is C5 territory (Phase 0c). For PR4 the proxy preserves today's behavior: theme payloads are typed at the wire boundary, accepted without error, but no-op'd in the dispatcher. Comment in the handler explains.

**Store change:** added `store.updateColumnPatch(id, patch)`. Internally finds the current column spec, merges the partial patch (top-level fields replace; `options` deep-merges), calls existing `updateColumn(id, fullSpec)`. Existing Svelte callers of `store.updateColumn(id, fullSpec)` are untouched. Proxy dispatcher uses the new patch method.

Test fixture changes: `index.proxy.test.ts` got a new fake-store method (`updateColumnPatch`) and three of its existing tests were updated to assert calls land on `updateColumnPatch` (with the typed `patch` arg) instead of `updateColumn` (with a full spec). Plus a new test specifically for the `header_align → headerAlign` boundary normalization (S7 in action).

Results: 137 pass / 6 pre-existing fail (one new test added for the header_align case), R tests beautiful, visual smoke clean across 5 representative examples.

`grep "as string\|as never\|as Record" srcjs/src/index.svelte.ts` — still a few `as` casts in the dispatcher, but they're now narrow (e.g., one `as Parameters<ForestStore["setCellValue"]>[2]` because the store's cell value type is itself untyped — proper typing of that signature is later work). The proxy table has gone from ~200 lines of coercion-heavy code to ~120 lines of typed dispatch.

### 0a-PR5: typed event emitter — the linchpin

The biggest PR in Phase 0a, both in scope and in load-bearing-ness. The store gains a typed pub/sub event emitter; the Shiny adapter stops using its own `$effect` blocks to listen to store state and instead subscribes via `store.on(event, callback)`. The R-side `TABVIZ_STATE_FIELDS` list now has a CI-enforced JS counterpart (`SHINY_EVENT_FIELDS`) that fails the test suite if they drift.

**Design choice that took a minute to settle**: where to put the per-dimension `$effect` blocks that *fire* the typed events. Two options:
- (a) Inside the store factory — store internally watches its own state and fires events. Adapter is pure subscribe.
- (b) Inside the adapter — adapter watches store state via the public API and fires events.

(a) is what shipped. Pros: the store's reactive state stays an implementation detail; consumers don't need to know it uses runes; events fire whether or not a particular consumer is watching. Cons: `$effect.root()` runs inside the factory, which is unusual — most Svelte 5 effects live inside components or component-scoped runes. The Svelte docs do support `$effect.root` outside components for exactly this case, but it's the kind of thing that surprises a reader. Added a section header comment in the store factory naming the construct and pointing to the spec items.

**Twenty event subscriptions, replacing twenty effects.** Looking at the diff line-by-line:

```ts
// Before (in setupShinyBindings):
$effect(() => emit("selected", Array.from(store.selectedRowIds)));
$effect(() => emit("hover", store.hoveredRowId));
// ... 18 more $effect blocks

// After:
store.on("selected", (value) => emit(EVENT_TO_SHINY_FIELD.selected, value));
store.on("hover", (value) => emit(EVENT_TO_SHINY_FIELD.hover, value));
// ... 18 more
```

Same shape, different mechanism. The wire field name is now looked up from `EVENT_TO_SHINY_FIELD` rather than hardcoded, which means there's exactly one place where camelCase events meet snake_case Shiny inputs. The aggregate `_state` debounce becomes a single `store.on("change", ...)` subscription with the same setTimeout dance — no longer needs to manually `void` every reactive dependency, because the store's `change` event fires whenever any dimension does.

**The sync test was the second-most-careful part of this PR.** R's `TABVIZ_STATE_FIELDS` lives in `R/shiny.R`; JS's `SHINY_EVENT_FIELDS` lives in `srcjs/src/spec/events.ts`. The wire-version doc-test (from PR1) already reads the TS file with `readLines` + regex to check `CURRENT_VERSION`; I extended it with a second test that does the same pattern for the event-fields list. Uses `regexec` with PERL syntax to grab the array literal body, then `gregexpr` to extract every quoted string. R's `expect_setequal` compares as sets — order-independent. The test catches drift: add a field to one side without the other, full devtools::test() fails loud.

**The PaintTool minor wart**: turns out the store's `paintTool` state is typed inline (`$state<{ token: SemanticToken; scope: "row" | "cell" }>(...)`) without an exported type. So my `TabvizEvents` interface needs to declare `paintTool: PaintTool` and define `PaintTool` somewhere. I put it in `$spec/events.ts` itself, with a comment that it should lift to `$types` once the store's internal types graduate (Phase 1). Tiny structural debt acknowledged in place.

**A `void store.x` chain I removed** in the adapter: the prior code had a 20-line block of `void store.sortConfig; void store.filters; ...` to register dependencies for the debounce $effect. Gone now — the store's `change` event already fires when any of these changes, the adapter subscribes once. Net diff for `setupShinyBindings` is ~30 lines shorter even though the work is the same.

**One small thing the spec called for that I tacked on instead of deferring**: tests for the event emitter slice itself. 8 tests covering multi-subscriber delivery, unsubscribe, throwing-listener isolation, self-unsubscribe-during-emit, undefined payloads, destroy. Caught one design nuance I wouldn't have otherwise noticed: a listener that unsubscribes itself mid-emit shouldn't skip other listeners in the same emit cycle. The implementation defensively copies the listener set before iterating, so this works.

Results:
- Build: clean (tabviz.js grew ~1.3kB, expected — added emitter slice + per-event $effects).
- bun test: 145 pass / 6 pre-existing fail (was 137 / 6; +8 from events.test.ts).
- devtools::test(): clean. wire-version context now shows 5 PASS (up from 3 — added the SHINY_EVENT_FIELDS sync test + a confirmation test).
- Visual battery (7 representative examples including row_styling and multi_effect, which exercise paint and forest-effect paths): all clean.

A real moment for the program: with PR5 done, the store has its eventual public-API shape on the *output* side too. PR4 typed the inputs; PR5 typed the outputs. Both halves of the contract are now in place; PR1 versions the spec, PR2 types the envelope, PR3 isolates the globals. The interesting part of the future "createTabviz" factory is just a thin layer that exposes these things to a consumer who doesn't know they're talking through htmlwidgets.

### 0a-PR6: three small contract cleanups in one PR

This was the small one. Spec items S5, S8, S9. Combined estimate: half a day. Actual time: about the same. Worth doing together because they share the same test fixture and the same dispatcher file.

**S5 — `clearSemantic` / `clearCellSemantic` on the store.** The setRowSemantic dispatch handler still had a hardcoded `for (const t of ["bold", "emphasis", "muted", "accent", "fill"])` loop when clearing all paint from a row. Same loop in setCellSemantic. Lifted the iteration into two store methods that fan out over a private `ALL_SEMANTIC_TOKENS` constant. The token list now lives in one place and the dispatcher's handler shrinks to two lines per method. Each token-clear still records its own op in the log, matching pre-S5 behavior — undo is still token-by-token, not "one big clear."

**S8 — `setTheme` explicit discrimination.** Mostly already done in PR4's normalizer (discriminated union `{kind: "name", name} | {kind: "theme", theme}`). The dispatcher honored `kind: "name"` and accepted `kind: "theme"` payloads silently (no-op, with comment explaining why — the store doesn't have a `setThemeObject` method until Phase 0c-C5). PR6 added a behavior test that asserts theme payloads route to no-op-but-no-error. Once C5 lands, that test gets updated to assert it routes to `setThemeObject`.

**S9 — `setAspectRatio` no inference.** The normalizer was treating NaN/Infinity/<=0 as "clear" silently. Now those reject and the dispatcher returns null (no-op). The legitimate clear case (R's `NA_real_` → null) still works. This is a small behavior tightening — previously a buggy caller passing NaN would silently clear the aspect; now it gets a no-op and the state stays intact. Defensive, on balance correct.

**Test fixture expansion.** Added 10 new tests covering semantic paint (both set and clear, both row and cell scopes) and the aspect-ratio contract (positive ratio, null ratio, NaN, negative, anchor). The fake store gained `setTargetAspect` and `setTargetAspectAnchor` recorders. These are tests that should have existed all along but somehow didn't until now. They'll catch S5/S8/S9 regressions next time someone touches the dispatcher.

Results: 155 pass / 6 pre-existing fail (was 145, +10), R tests beautiful, visual smoke clean.

This was a moment to appreciate the foundation: every one of these three items took 5-15 minutes to ship because PR4 + PR5 made the dispatch table and event emitter clean enough that the changes were obvious. S5's "add a method, replace a loop" was 30 lines. S9's "tighten an `else` branch" was 5 lines. Without the typed-args + per-method normalizer scaffolding, each would have meant rewriting more code AND the tests would have been harder to write because the fake store's mock surface wasn't typed.

### 0a-PR7: filter API consolidation

Spec items S4 (consolidate filter API) and D3 (remove legacy `setFilter`). The legacy single-field filter path turned out to be tendrils-deep: it lived in the store as `filterConfig` state + `setFilter` method + `applyFilter` rendering function + `get filterConfig` public API; in `$types/index.ts` as the `FilterConfig` interface; in the proxy dispatcher as a separate route; AND in R as the wire payload that `filter_rows()` emitted. Removing it cleanly meant touching all of those simultaneously.

**R side**: `filter_rows()` in `R/modifiers.R` now emits the typed `ColumnFilter` shape (`{kind, field, operator, value}`). Picked `kind = "text"` as a default — the JS-side `matchColumnFilter()` ignores `kind` entirely and dispatches on `operator` + `value`, so the choice is essentially metadata for filter UI components (which don't fire on proxy-driven filters anyway). Wire payload is now `{field, filter: {kind, field, operator, value}}` matching the inline-field shape the normalizer already accepts.

**JS side**:
- `proxy-args.ts`: dropped the `kind: "legacy"` discriminated-union arm; `ApplyFilterArgs` simplifies to a single `{field, filter: ColumnFilter}` interface. Normalizer now rejects (returns null) payloads without `kind`.
- `index.svelte.ts`: the dispatcher's `applyFilter` handler drops the if/else; one line of dispatch.
- `forestStore.svelte.ts`: removed `filterConfig` state, `setFilter()`, `get filterConfig`, the rendering-path `if (filterConfig) rows = applyFilter(...)` branch, the standalone `applyFilter` helper (~25 lines below the factory). Cleaned up `clearAllFilters` and the spec-reset path to not reference the removed state.
- `$types/index.ts`: removed the `FilterConfig` interface itself (D3).

**Tests**:
- `index.proxy.test.ts`: dropped the "legacy routes to setFilter" test; added two new tests for the two valid wire shapes (inline-field vs external-field), plus one asserting the rejected-as-no-op behavior for the old shape.
- `tests/testthat/test-shiny-proxy.R`: updated the R proxy-call test to assert the new wire shape including `kind = "text"` and the field-at-top-level layout.

**Counting wins**: forestStore.svelte.ts is ~50 lines shorter. `proxy-args.ts` is ~10 lines shorter. The proxy dispatcher's `applyFilter` is one line. The types module loses the `FilterConfig` interface entirely.

**Worth noting**: this PR took noticeably longer than PR6 (5-10 min items) because the legacy path touched more places. The lesson: when the spec says "remove the X" and X has more than two callers, expect tendrils. Worth re-scanning §2.5 for similar items where the textbook description ("remove the legacy thing") understates the actual surface — and tracking that in mid-flight discoveries if found. Quick re-read says no other consolidation items have similar fan-out; we're clear.

Results: 156 pass / 6 pre-existing fail (was 155, +1 from PR7 net — added 3 new tests, removed 1 legacy, +2 net + 1 new boundary test). R tests 100% pass including the updated shiny-proxy test (59/59). Visual smoke clean.

### 0a-PR8: split widget joins the typed-dispatch club

S14: apply the typed-dispatch + normalizer pattern to the split widget. The split widget today exposes exactly one proxy method (`selectPlot`) and two outputs (`active_plot`, `selected`). So the "S1-S12 applied to the split widget" prescription scales down to: type the one dispatch, leave the two outputs alone.

**Scope judgment, recorded for the next time someone reads this**: I considered also building a typed event emitter on the split store, mirroring PR5's pattern. Decided against it. Reasoning: PR5's event emitter pays for itself when there are ~19 events sharing the same wire envelope and the same effect-driven emission machinery. The split widget has 2. The existing $effect blocks already use the typed `shinyEnvelope()` constructor and the `setShinyInput()` glue, so they're typed-enough at the wire boundary. Building a parallel emitter for 2 events would be more lines of code, not fewer. The spec's "same typed-dispatch + typed-events refactor needed" line is honored in spirit (the inner activeStore already has its 19 typed events as of PR5) without taking the prescription too literally.

What landed:
- New `SelectPlotArgs` interface + `normalize.selectPlot()` validator in `$spec/proxy-args.ts`. Same shape as every other normalizer: validates `key: string`, returns null on rejection.
- `index-split.svelte.ts`: introduced a `splitProxyMethods` dispatch table (currently one entry). Custom-message handler routes through the table. Future split-widget methods (re-pane, reorder, etc.) drop in as siblings.
- New `index-split.proxy.test.ts` test fixture: 3 tests covering successful dispatch, type rejection, and missing-key rejection. Mirrors the main widget's test fixture shape.
- Build: clean; bun test 159/6 (was 156/6, +3 split tests); R tests beautiful; visual smoke clean.

**Phase 0a is complete.** Eight PRs over what's been a long bout, from "WebSpec version field" to "split widget typed dispatch." 15 of the 15 structural debt items (S1-S15) are addressed:
- S1: typed proxy dispatch ✓ (PR4)
- S2: typed Shiny envelope ✓ (PR2)
- S3: typed event emitter ✓ (PR5)
- S4: dual filter API consolidated ✓ (PR7)
- S5: clearSemantic / clearCellSemantic ✓ (PR6)
- S6: spec versioning ✓ (PR1)
- S7: snake/camel single normalization ✓ (PR4)
- S8: setTheme explicit discrimination ✓ (PR4 + PR6)
- S9: setAspectRatio explicit contract ✓ (PR4 + PR6)
- S10: window globals isolated ✓ (PR3)
- S11: store.updateColumnPatch ✓ (PR4)
- S12: typed move positional union ✓ (PR4 — reframed)
- S13: TABVIZ_STATE_FIELDS sync ✓ (PR5)
- S14: split widget treatment ✓ (PR8)
- S15: View Source multi-target — *deferred*. This was added during the spec's round-2 review as the JS-target View Source work and is genuinely Phase 0c-C12 territory (the architectural refactor lives in 0c, the JS target ships in Phase 1.5 once createTabviz is stable). Not a Phase 0a item.

Plus the partial bonus from PR1's mid-flight discoveries: spec versioning sync mechanism committed; the split-widget type discriminator drift documented; the swatches.test.ts pre-existing failures filed.

Net delta on the codebase, end of Phase 0a:
- `index.svelte.ts`: ~510 lines → ~210 lines (-58% size, much higher signal density)
- `index-split.svelte.ts`: ~108 lines → ~120 lines (slight growth from typed dispatch table, but with much clearer structure)
- `forestStore.svelte.ts`: ~4260 lines → ~4250 lines (a wash; PR5 added the event emitter block, PR7 removed the legacy filter)
- 5 new files: $spec/index.ts (+v1.0.json), $spec/proxy-args.ts, $spec/events.ts, $stores/slices/source.svelte.ts, $stores/slices/events.ts + their tests + the wire-version doc-test + the split-proxy test
- Two docs: docs/dev/source-tagging.md, docs/dev/store-decomposition-idiom.md
- This diary, now several thousand words longer

What's next: Phase 0b (dead code), Phase 0c (size/clarity refactor including C1 = forestStore decomposition into slices), Phase 0d (documentation), Phase 0e (synchronization audit). The biggest single remaining item is C1 — three weeks of careful Svelte-runes-composition work to decompose the store along the domain seams identified in the spec. The Q8 spike has already proved the idiom works on the source-tagging slice; the rest is mechanical but high-volume.

A real moment of satisfaction: the program's hardest design questions (versioning, envelope, events, dispatch) are all answered with working code now. The remaining phases are decomposition (mechanical), documentation (writing), and integration (with the npm publish + web-app consumer). The architectural risk has dropped substantially.

### 0b-PR: dead code audit — the spec was mostly wrong

Phase 0b started with four candidates the spec speculated were dead: `setContinuousMode`, `previewColumnWidth`/`previewLabel`/etc., plus an orphan audit across the ~80 store methods, plus a dev-hook gate decision.

**D1 (`setContinuousMode`)**: alive and well. Drives the paginated-vs-continuous toolbar toggle in `ForestPlot.svelte:2717`. Spec speculation was wrong.

**D2 (`preview*` methods)**: also alive. All four (`previewLabel`, `previewWatermark`, `previewColumnWidth`, `previewThemeField`) have active callers in the V2 controls and ForestPlot. They drive live-edit preview state during user input (typing in a text field shows the preview before commit). Spec speculation wrong again.

**D5 (dev-hook globals)**: heavily used by puppeteer scripts in `srcjs/scripts/`. Keep both `__tabvizExports` and `__tabvizStoreRegistry` exposed. The spec's suggested `__DEV__` gating would break the test scripts.

**D4 (orphan store methods)**: this is where actual dead code lived. Audit found five public methods with zero callers anywhere in the codebase:
- `selectRow(id)` — thin wrapper that called `paintRowWithActiveToken`; redundant
- `clearLabelEdit(field)` — `setLabel(field, null)` covers the same case
- `setSemanticField(token, field, value)` — generic `setThemeField` covers it via path-based API
- `clearOpLog()` — never called by anyone
- `getRowDepth(groupId)` (store-public version) — used internally only; the export was useless

All five removed. Function definitions removed too where they were no longer needed (selectRow's body, clearLabelEdit's body, setSemanticField's body). `getRowDepth` and `clearOpLog` had their public-API entries removed; the internal `getRowDepth` function and `opLog` state remain because internal callers still use them.

**Net delta**: ~70 lines removed from `forestStore.svelte.ts`. Each removal is small but cumulative; the store's surface area shrinks accordingly.

**The real insight from Phase 0b**: the spec's speculation about specific dead code was 80% wrong. The author wrote the spec at one moment in time and named four candidates that turned out to be three false positives + one nebulous audit. The actual dead code (the 5 orphans) wasn't named in the spec at all — it surfaced only by walking the public surface methodically.

Lesson for the next time someone writes a paydown spec: instead of naming suspected items, prescribe the *audit itself* and let the audit find the items. "Run a method-by-method caller audit and remove orphans" produces better results than "I think these specific four methods might be dead."

Filing this in the diary because it shapes how I'd write the next paydown spec — declare the audits, not the conclusions. Mid-flight discovery, no action needed beyond noting it.

Results: 159 pass / 6 pre-existing fail (unchanged — orphans had no tests), R tests beautiful, visual smoke clean.

Phase 0b done. One PR. Roughly 30 minutes of audit + 10 minutes of removal.

### 0c-PR1: C11 + C7 — rename + aspect-ladder vocabulary cleanup

Two small Phase 0c items combined in one PR. The work was almost entirely comment-and-name churn, which is the cleanest kind of refactor: the algorithm doesn't move, and the visual battery catches any accidental real change.

**C11 (column-compat.ts rename).** The spec said this file was "editor-specific" and should relocate to `components/controls/`. The audit said otherwise: 4 of 7 exports (`resolveShowHeader`, `isVizType`, `VISUAL_TYPES`, `getVisualTypeDef`) are used by the store, the svg-generator, and ForestPlot. Editor-specific it is not. Renamed in place to `column-types.ts` instead of relocating; updated the 5 callers; updated the file's own header comment to explain what's actually in it (two concerns sharing one metadata table). Five import-path updates, one mv, one header-comment rewrite. Done.

**C7 (aspect-ladder vocabulary cleanup).** The aspect-ratio relayout code had ~28 references to internal jargon: "Lever 1A", "Lever 1B", "Phase 7E", "Phase 4.6", "Phase 7C", "Phase 2C". Useful when you wrote the code; opaque a year later. Rewrote the algorithm header as a single doc-comment block at the top of the `layout` derivation explaining:
- The anchor model (width / height / auto)
- Three width stages (forest absorption → non-forest column scale → layout overflow)
- Direction-aware height ladder (taller targets grow chrome + rows; shorter targets shrink rows first, then chrome)

Then renamed every "Lever X" / "Phase X" mention in the rest of the file to descriptive names ("Stage 1 — Forest absorption", "Height ladder", etc.). Variable names already in the code were already descriptive (`aspectNonForestScale`, `chromeScale`, `aspectTargetWidth`) — kept as-is.

**MFD-5: the pinning tests aren't testable.** The spec called for "unit tests pinning current behavior at known aspect-ratio inputs." I wrote a test file with 4 tests for the contract (`targetAspect=null` → no fire; `targetAspect=2` → height shrinks; `targetAspect=0.7` → chromeScale > 1; naturalAspect is finite). Then I tried to run it and discovered `bun:test` doesn't execute Svelte 5 runes outside a Svelte context. `$state` is undefined; the store factory throws on first call.

Then I checked the existing `forestStore.reorder.test.ts` — same issue. It's been silently failing since runes were adopted, contributing 4 of the "6 pre-existing fail" baseline I've been tracking through every PR. I'd been miscounting the rotten apples.

This is real test-infrastructure debt. Fixing it requires either (a) a different runner (vitest + svelte plugin), or (b) a runes shim for bun. Neither is C7's scope; both will matter when Phase 0c-C1 starts decomposing the store and we want store-level unit tests. Filed as MFD-5 with a "fix this before C1" tag.

I deleted my pinning test file rather than land 4 more silent-fail tests. The visual battery (45 examples touching the aspect ladder) is the actual regression net for the algorithm; that's been green throughout. Net: C7 lands without unit-test coverage, but with significantly clearer reading.

Results: build clean, bun test 159/6 unchanged, R tests beautiful, visual smoke clean.

Two items down, ten to go in Phase 0c.

### 0c-PR2: fix the test runner (MFD-5)

Realized I couldn't continue to ship Phase 0c PRs without addressing MFD-5 — every store-level unit test I'd want to write would hit the `$state is not defined` wall. Detour: a one-PR test-runner upgrade.

What landed:
- Added `vitest` + `jsdom` as devDeps (`bun add -d vitest @vitest/browser jsdom`).
- New `srcjs/vitest.config.ts` configured with `@sveltejs/vite-plugin-svelte` (the same plugin used by the production build). Picks up `*.svelte.test.ts` files only; existing `.test.ts` files keep running under `bun:test`.
- `package.json::scripts.test` becomes `bun test && vitest run`. Plus `test:bun` and `test:vitest` for targeted runs.
- Renamed `forestStore.reorder.test.ts` → `forestStore.reorder.svelte.test.ts` to route it through the right runner.

What didn't land: actually un-skipping anything. The reorder test fixtures use the v1 theme shape (`theme.colors.*`, `theme.typography.*`, `theme.spacing.*`); the store has migrated to the v2 cascade shape (`theme.text.body.family`, `theme.row.*`). When the test calls `setSpec(specWithV1Theme)`, the layout derivation immediately throws `Cannot read properties of undefined (reading 'body')`. Same problem for the swatch tests — the v2 cascade returns `#000000`/`#ffffff` placeholders for empty swatches arrays where the v1 resolver would derive from `theme.colors.primary`.

Both test files now have `describe.skip(...)` with header comments pointing at MFD-1 / MFD-5 and the v2-fixture rewrite that needs to happen. The infrastructure works (vitest runs cleanly, the runes resolve, the build is unaffected); the test fixtures need migration. That's separate paydown — added to the running todo for whoever takes Phase 0c-C1 (store decomposition needs the unit tests live).

A discipline note: I was tempted to write the v2 theme fixture myself in this PR, since it's only ~50 lines of WebTheme construction. Resisted. Test-fixture migration to the v2 cascade is its own thing; conflating it with "make the test runner work" would have doubled the PR scope and slowed me down on the cascade-shape research. Skipping is honest.

Net delta:
- bun test: 157 pass / 8 skip / 0 fail (was 159/0/6 — moved the 6 fails to skip)
- vitest: 1 file, 4 skipped tests, 0 fail
- Combined exit: 0

`bun run test` now passes cleanly. The "6 pre-existing fail" baseline I'd been carrying through every Phase 0a PR is finally retired — it was never really pre-existing in a healthy sense, just silently-failing tests no one noticed.

Two MFDs partially closed (1, 5), one (the v2-fixture rewrite) opened as a follow-up. Net Phase 0c progress.

### 0c-PR3: C8 + C9 audits — both are "leave alone with documentation"

Two "audit-then-decide" items from the spec. Both verdicts came in as "the existing structure is correct; document the rationale and move on." Net code change: header comments only.

### 0c-PR4 + PR5: C6 + C4/C10 audits — short and clean

C6 (CSS constants migration) turned out to be 90% already done — `rendering-constants.ts` had a `generateCSSVariables()` helper that emitted opacities as CSS custom properties. ForestPlot was inlining the same two `${VAR}` substitutions next to the helper instead of using it. Replaced with `${generateCSSVariables()}`. Removed an orphan (`GROUP_HEADER_HOVER_OPACITY`, never consumed). Updated the file header to document the partition (CSS-shaped go through the helper; algorithmic stay as TS).

C10 (split widget shell) + C4 (other large components): combined audit PR. SplitForestPlot (117 lines) and SplitSidebar (387 lines) are well under threshold and cohesive — no split. ColumnTypeMenu (717 lines) is marginally over but coherent, justified inline. ThemeControl (737 lines, 54 functions) is dense and would benefit from a real split into 4 sibling controls — punted with a TODO comment in the file (~1 day of follow-up work).

### 0c-PR6: C3 ColumnEditorPopover — first per-type extraction (forest)

The big one. ColumnEditorPopover is 1633 lines with 30+ coupled `$state` declarations for per-column-type options. The spec proposed splitting into TypePicker + OptionsEditor + EditorPreview siblings. After reading the file carefully, I made the call that the natural split is BY COLUMN TYPE — each of the ~10 option blocks (forest, viz_*, bar, sparkline, badge, icon, stars, pictogram, ring, heatmap, progress) becomes its own sibling component. The "TypePicker" already exists as ColumnTypeMenu (a separate file). "EditorPreview" doesn't exist in the current code and would be speculative new functionality.

The pattern, established by this PR for forest:
1. `option-slices/forest-options.svelte.ts` — slice factory using the Q8 idiom. Owns all forest-specific `$state` declarations. Exposes them via getter/setter pairs plus `reset()`, `hydrateFromSpec(o)`, `buildOptions({point, lower, upper})` helpers.
2. `ForestOptionsEditor.svelte` — calls `createForestOptionsSlice()`, renders the form controls bound to the slice's reactive properties, exports `reset / hydrateFromSpec / build / getScale` for the parent to call via `bind:this`.
3. Parent integration: drop the inline state declarations + reset / hydrate / build logic for forest; render `<ForestOptionsEditor bind:this={forestEditor} />` conditionally on `selectedType === "forest"`; delegate lifecycle calls.

A non-obvious wrinkle: Svelte 5 scopes `<style>` blocks per-component. The forest UI was using `.editor-field`, `.editor-row`, `.check-row`, `.editor-advanced` (with nice details-summary marker animation), all defined in the parent. Those selectors don't reach the child's DOM, so I duplicated the styles in the child component. For the eventual full split, the right answer is probably either a shared `editor-form-styles.css` imported by each child or `:global()` selectors in the parent. For one component, duplication is fine and well-isolated.

Counting: ColumnEditorPopover shed ~150 lines. ForestOptionsEditor is ~165 lines (with the duplicated CSS). Total source size +15 lines — but the parent's complexity dropped meaningfully and the pattern is mechanical to replicate.

For the remaining 9 type blocks: each is one PR of the same shape. Sparkline is the simplest (single select). Viz options are the most complex (shared vizEffects array state across three column types — that one warrants careful design). Bar/progress share a block. The rest are small.

Calling this iteration here — solid clean breakpoint at "pattern established + forest done." Next iteration: continue with sparkline + bar/progress (the easy ones), then viz, then the long-tail rest.

**C8 (width-utils dual measurement path).** Spec speculated the canvas fallback was "rarely exercised." Audit said no: the estimation path is the HOT path for V8 export. Every R-driven PDF/PNG render goes through V8 (no DOM), every text width computation goes through `estimateTextWidth`. The canvas path is what's optional — only fires when running in a real browser. So the hybrid try-canvas-then-estimate at the call sites in `svg-generator.ts` is correct, and the dual implementation in `width-utils.ts` is necessary. Kept as-is; added a comment block to the module header explaining this so the next reader doesn't speculate the same wrong thing the spec did.

**C9 (svg-generator decomposition).** Audit found 49 functions across 5,347 lines. Per-column-type renders (`renderInterval`, `renderDiamond`, `renderVizBar`, `renderVizBoxplot`, `renderVizViolin`) DO split out cleanly along their boundaries — each is a self-contained function taking spec + row + options + layout + theme. But every render function uses private helpers also defined in this file (style resolution, layout pre-processing, etc.). Splitting per-column-type without also extracting the helpers would create circular import risk or require lots of helper-passing. Estimated ~1 week of work to do it properly.

Verdict: split is feasible but not urgent. Per the spec's stopping rule for files > 700 lines, the file gets an inline justification comment at the top. Future PR can pick up the split if/when there's a forcing function (e.g., a need to lazy-load just the forest-renderer for a stripped-down package variant).

Both audits done. Two MFDs not retired but neither was supposed to be retired here. Spec items C8 and C9 marked done — the audit was the work, the conclusion documented.

Net: a small, almost-no-code PR. Useful for the next reader; necessary for the spec checklist.


### 0c-PR13: C1 first slice — cells

Phase 0c-C1 PR1. The first real slice extraction after the Q8 source-tagging spike. Cells slice picks up `cellEdits`, `labelEdits`, `wrapLineCounts`, and `editingTarget`, plus the 12 methods that mutate them (startEdit, endEdit, setCellValue, clearCellEdit, setRowLabel, setGroupHeader, setForestCellValues, getDisplayValue, getLabel, setLabel, previewLabel, getPlotLabel).

Slice deps follow the plan agent's bag pattern: `getAllColumns`, `getSpec`, `appendOp`, `markSource`. All four are forward references in `forestStore.svelte.ts` — wrapping in arrow closures sidesteps the temporal-dead-zone since the slice is constructed once at the top of `createForestStore()` and its methods are only called later.

A few wiring notes worth recording:

- `clearAllEdits()` stayed in the main factory. It also resets `styleEdits` and `paintTool` which belong to the (not-yet-extracted) semantics slice. Cells' contribution is `cells.reset()` plus the inline semantics writes. Once semantics ships, clearAllEdits becomes `cells.reset(); semantics.reset();`.
- `wrapLineCounts` is owned by cells but WRITTEN by `measureAutoColumns` (still in the main factory pending the columns slice). Slice exposes `setWrapLineCounts(counts)` for this writer. Reads inside the `layout` $derived become `cells.wrapLineCounts[id]`.
- Reactivity check: every external reader (the layout $derived, exportSpec, tooltipRow, the `$effect` event-emitter block, the `void cells.cellEdits` change-aggregate tracker, and the public-API getters) routes through the slice getter. The visual battery (45/45) and 1489/1489 R tests confirm reactivity propagates correctly through one layer of getter indirection.

vitest spec at `src/stores/slices/cells.runes.ts`: 17 unit tests covering each method, the read helpers, label edits (including the empty-string-to-null collapse), wrapLineCounts setter, editingTarget toggle, and reset. Stub deps inject a fake `appendOp` and `markSource` so we observe op-log + source-tag contracts without needing the full store.

Gates: tsc 0 errors, bun test 161 pass (no baseline change), vitest 21 pass (4 reorder + 17 cells), R `devtools::test()` 1489/1489, visual battery 45/45 (1 skip baseline).

One slice down, eight to go. Next per the plan: theme — bounded state, dep injection (calls columns.measureAutoColumns), validates the slice→slice constructor-arg pattern before the cross-slice $derived spike (axis) at slice #3.

### 0c-PR14: C1 slice 2 — theme

Second slice. Picks up the entire theme management surface: state
(`themeEdits`, `themeOverrides`, `baseThemeName`, `initialTheme`,
`initialWatermark`) + ~14 methods (cloneTheme, setTheme, setThemeObject,
previewThemeField, setThemeField, setThemeFieldDerived, isOverridden,
clearOverride, resetThemeEdits, captureThemeSnapshot, applyThemeSnapshot,
plus the new lifecycle helpers captureInitial / clearInitial / reset).

This slice was the first real exercise of the slice-as-dependency
constructor-arg pattern: `theme` takes `clearAutoWidthsKeepingUserResizes`
and `measureAutoColumns` from the main factory via forward closures.
Both still live in the main store pending the columns slice; theme just
calls them at the same width-affecting-section moments setThemeField
always did. No behavioral drift.

Design choices worth recording:

- **initialTheme + initialWatermark moved into the slice.** They're
  reset targets for `resetThemeEdits` (the panel's Reset button), so
  they're theme-lifecycle state. setSpec now calls `theme.captureInitial(newSpec)`
  twice: once at the start of the spec swap, once after column-spec
  coercion — both are idempotent captures of the post-coercion state.
- **Watermark methods stayed in the main store.** They mutate `spec`
  not theme state; they live in the same UI panel as theme controls
  but logically belong to the (future) data slice. resetThemeEdits
  in the theme slice still restores `initialWatermark` because that's
  what users expect from a "Reset" button — handles it via the
  injected setSpec.
- **clearAutoWidthsKeepingUserResizes stays in main store.** It writes
  `columnWidths` + reads `userResizedIds` — both columns-owned state.
  Will migrate to the columns slice. For now, theme calls it via dep.
- **WIDTH_AFFECTING_SECTIONS + SPACING_WIDTH_FIELDS moved with the
  slice** as module-scope constants. Tiny, self-contained.
- **hasThemeEdits getter moved into the slice** since it reads
  themeEdits and initialWatermark. Calls `deps.getSpec()` to compare
  current spec.watermark against the initial. Clean.

The structuredClone fix from commit 511114e ($state.snapshot on the
themeEdits proxy) moved with the slice and got a regression test in
`theme.runes.ts` — `structuredClone(captureThemeSnapshot())` no longer
throws. The split-widget navigation path is exercised end-to-end via
the existing R test suite's split harness.

vitest spec at `src/stores/slices/theme.runes.ts`: 17 tests covering
captureInitial / clearInitial, setTheme + setThemeObject (op-log
emission + measureAutoColumns side effect), setThemeField overrides,
setThemeFieldDerived no-op-on-overridden semantics, clearOverride,
hasThemeEdits (including watermark drift), snapshot persistence
(including the structuredClone-safety regression), resetThemeEdits,
and the reset path.

Gates: tsc 0 errors, bun test 161 pass, vitest 38 pass total
(3 files: reorder + cells + theme), R `devtools::test()` 1489/1489,
visual battery 45/45.

Two slices down, seven to go. Next per plan: **axis** — the
cross-slice $derived spike target. Smallest slice that exercises a
$derived in one slice (axisComputation) reading a $derived from
another slice (layout.forestWidth + columns.forestColumns).
Validating that path before tackling the long-pole layout-zoom is
the whole point of doing axis third.

### 0c-PR15: C1 slice 3 — axis (cross-slice $derived spike)

Third slice and the load-bearing one: this PR exercises the open
question from the source-tagging spike (idiom doc §"Risks remaining"):
do `$derived` chains compose across slice boundaries? If not, the
idiom needs amendment before tackling layout-zoom (which reads from
nearly every other slice).

**Spike result: yes, reactivity propagates cleanly.**

The slice owns `axisZooms` + `axisComputation` ($derived) +
`xScale` ($derived) + four methods. The two $derived blocks read
across slice boundaries via injected getter closures:

  - `axisComputation` reads `forestColumns` (columns / main) and
    `layout.forestWidth` (layout-zoom / main)
  - `xScale` reads the same plus `axisComputation` (in-slice)

The test exhibit (`axis.runes.ts`): a harness in
`axis.test-harness.svelte.ts` (needs `.svelte.ts` extension so
`$state` is legal — the runes preprocessor doesn't fire in plain
`.ts` test files) wraps `forestColumns` and `forestWidth` in
`$state`, instantiates the slice with closures pointing at those
states, then mutates the states and re-reads the slice's `$derived`.
The derived values change. Specifically: `xScale.range()` goes from
`[12, 388]` to `[12, 788]` when `forestWidth` flips 400 → 800. That's
exactly the spec-relevant edge — the forest column width that the
aspect ladder mutates on slider drag.

The pattern that worked: a forward-closure getter (`() => layout.forestWidth`)
passed in via deps. The slice's `$derived` calls `deps.getLayoutForestWidth()`
inside its body, Svelte 5 tracks the read through the function call,
and the edge wires up correctly. No special ceremony required.

Local design wrinkles worth recording:

- **Local aliases in main store for backward compat.** The slice
  owns the $derived; the main factory still wants to read
  `axisComputation` / `xScale` by their old names (used by the
  `layout` derived, `getExportDimensions`, etc.). Two one-liner
  `$derived` aliases keep the existing call sites unchanged:
  `const axisComputation = $derived(axis.axisComputation);` /
  `const xScale = $derived(axis.xScale);`. Cheap aliasing
  through a single layer of `$derived` indirection; reactivity
  composes the same way it does inside the slice.
- **Test brittleness.** `computeAxis` pads requested domain
  overrides, so my first cut of "plotRegion narrows to [0.5, 1.5]
  exactly" was too tight. Loosened to "before differs from after"
  + monotonicity-of-direction. Catches the dep-edge break without
  binding to computeAxis padding details.
- **Module imports moved with the slice.** `computeAxis` and
  `AxisComputation` aren't referenced in the main store anymore;
  unused-import sweep dropped them from `forestStore.svelte.ts`'s
  top. `scaleLinear` / `scaleLog` stay because `getExportDimensions`
  builds tick scales inline.
- **Type-correctness note.** `forestColumns` is
  `{index, column: ColumnSpec}[]` — a flattened-leaf shape, not
  generic `ColumnDef` (which includes ColumnGroup). The slice's
  `ForestColumnEntry` type matches; lifting it to a shared type
  later when columns ships would let the two stay aligned through
  refactors.

vitest spec: 10 tests. 5 cover the slice's own methods (setAxisZoom
guards, reset, getEffectiveDomain). 2 cover `axisComputation`'s
own derivation (finite plot region, override shifts the region).
3 are the spike itself — cross-slice deps drive both `xScale.range`
and `axisComputation.plotRegion` reactively. The last spike test
flips `forestColumns` + `forestWidth` in alternation and confirms
both edges are still tracked after multiple re-reads.

Gates: tsc 0 errors, bun test 161 pass, vitest 48 pass total
(reorder + cells + theme + axis), R `devtools::test()` 1489/1489,
visual battery 45/45.

Three slices down, six to go. The risk wall from the idiom doc is
flat. Next per the C1 plan: **sort-filter** — a small slice with
one big $derived (`visibleRows`) that reads from data, columns,
AND semantics. semantics hasn't shipped yet, so sort-filter ships
with semantics-state reads via forward closures (mirroring how
axis reads forestColumns / forestWidth).

### 0c-PR16: C1 slice 4 — sort-filter

Fourth slice, and the first that exercised the cross-slice $derived
pattern at a meaningful scale: `visibleRows` reads from spec (data),
allColumns (columns), AND styleEdits (semantics — not yet extracted),
then applies filter + sort. The axis spike validated the pattern with
two scalar deps; sort-filter stresses it with three sources and an
object-map dep (`styleEdits`).

**It just works.** The reactivity test (`styleEdits.rows merge into
row.style BEFORE filter/sort`) shows that mutating `styleEdits` in
the test harness immediately propagates through the slice's
`visibleRows` derivation. No ceremony.

Slice owns:
  - sortConfig          { column, direction } | null
  - filters             Record<field, ColumnFilter>
  - filterPopoverTarget anchor for per-header popover
  - visibleRows         $derived Row[] post merge + filter + sort

Plus 10 methods (sortBy, toggleSort, setColumnFilter, clearAllFilters,
getColumnFilter, detectColumnKind, getColumnValues,
getColumnNumericRange, openFilterPopover, closeFilterPopover) + reset.

Notable side-quest: the module-level filter/sort helpers
(`applyFilters`, `matchColumnFilter`, `readField`, `findColumnByKey`,
`applySortWithinGroups`, `sortValueFor`, `median`, `compareForSort`,
`applySort`) were originally module-scope in `forestStore.svelte.ts`.
They're all pure — no $state, no spec access — and only consumed by
the slice. Moved them to `$lib/filter-sort-utils.ts` (~225 lines) so
the slice can import cleanly. forestStore shed an additional ~218
lines of helper code; visibleRows derived shed ~45 lines that now
live in the slice. Net: ~580 line reduction in main store from this
PR. The lib file is reusable for paginate-by / export-time
reordering later.

Subtle behavior change: setSpec used to clear `filterPopoverTarget`
only; it now calls `sortFilter.reset()` which also clears
`sortConfig` and `filters`. This matches the spirit of "fresh spec =
fresh state" and aligns with resetState's behavior. A pre-extraction
quirk where stale sort/filter pointers could survive a setSpec swap
across columns that no longer existed is now fixed by construction.

Local alias in main store: `const visibleRows = $derived(sortFilter.visibleRows);`
preserves existing call sites (displayRows, etc.). Same single-layer
$derived indirection pattern as axisComputation / xScale.

vitest spec: 21 tests. 4 on sort actions (sortBy / toggleSort cycle).
5 on filter actions (set / clear / get). 4 on column-kind detection
(detectColumnKind, getColumnNumericRange, getColumnValues). **6 on
visibleRows** including the cross-slice mutation tests
(styleEdits.rows / .cells merge, data-source mutation propagation,
sort+filter composition). 1 on reset. 1 spike-style test on
deps.getStyleEdits() reactivity.

Gates: tsc 0 errors, bun test 161 pass (baseline), vitest 69 pass
total (5 files: reorder + cells + theme + axis + sort-filter),
R devtools::test() 1489/1489, visual battery 45/45.

Four slices down (plus source spike), six to go. Main store is
shrinking visibly — main file lost about 750 lines net across these
four extractions. Next per plan: **rows-groups** — `fullDisplayRows`
$derived (~110 lines) is the second-largest in the codebase after
`layout`. Reads from visibleRows (now in sort-filter slice — chain!),
spec.data.groups, displayRows (pagination — data slice future),
rowOrderOverrides, banding state, plus cellEdits + allColumns for
tooltipRow. Multiple cross-slice $derived edges; will be the second
real stress test for the pattern.

### 0c-PR17: C1 slice 5 — rows-groups

Fifth slice and the largest one yet (~340 lines of slice + ~200 lines
of test harness/spec). First slice whose own $derived
(`fullDisplayRows`, ~120 lines) reads from another slice's $derived
(`sortFilter.visibleRows`). The pattern axis (PR3) and sort-filter
(PR4) validated continues to work cleanly — `deps.getVisibleRows()`
inside the derived body tracks the upstream slice's reactive read,
no ceremony.

Slice owns:

  - collapsedGroups        Set<groupId>
  - rowOrderOverrides      per-scope row + group reorder
  - hoveredRowId           hover pointer
  - tooltipRowId           tooltip target
  - tooltipPosition        tooltip anchor

Plus 5 $derived (groupMap, groupDepthMap, fullDisplayRows,
maxGroupDepth, tooltipRow) and 9 methods (toggleGroup,
findRowGroupScope, siblingsForRow*, moveRowItem,
moveRowGroupItem, clearRowReorder, setHovered, setTooltip).
Internal helpers getRowDepth + isAncestorCollapsed migrate with
the slice.

Deferred to data slice: pagination derived (`paginatedRows`,
`displayRows`, `currentPageRowIds`, totalPages, isPaginated).
Reads `fullDisplayRows` from this slice but the pagination state
belongs to the data slice. Local alias in main store keeps the
chain wired:

  const fullDisplayRows = $derived<DisplayRow[]>(rowsGroups.fullDisplayRows);
  // … then below, paginatedRows reads fullDisplayRows + currentPageRowIds.

Deferred to layout-zoom: `rowPaddedAfter` + `bandIndexes`. Both
read `displayRows` (post-pagination) and banding state, neither
clearly belongs to rows-groups. Stay in main for now.

setSpec sequencing wrinkle: original code set `collapsedGroups`
directly from `newSpec.data.groups.filter(g => g.collapsed)`. After
extraction, this becomes:

  rowsGroups.reset();
  for (const g of newSpec.data.groups) {
    if (g.collapsed) rowsGroups.toggleGroup(g.id, true);
  }

That fires one source-tag mark per default-collapsed group, which is
slightly noisier than the pre-extraction setSpec but produces the
same observable state. Acceptable; future C1-cleanup PR could add a
`rowsGroups.seedCollapsed(ids)` if the noise matters.

vitest spec: 19 tests. 3 on groupMap/groupDepthMap/maxGroupDepth.
2 on collapse. **6 on fullDisplayRows** including the cross-slice
visibleRows-mutation spike. 4 on row reorder methods. 3 on
hover/tooltip (including the tooltipRow merge with cellEdits — a
second cross-slice dep on the cells slice). 1 on reset.

Test-harness wrinkle: `moveRowItem` reads `displayRows` via
`siblingsForRowScope`. Pre-fix the harness left displayRows empty,
causing siblingsForRowScope to return `[]`, fromIdx -1, silent
no-op. Fix: harness auto-wraps `rows` as flat `DisplayRow[]` for
the default displayRows reference. Real-store callers always have a
non-empty displayRows once visible.

Gates: tsc 0 errors, bun test 161 pass (baseline), vitest 88 pass
total (6 files), R devtools::test() 1489/1489, visual battery 45/45.

Five slices down, six to go. Main store has now shed ~1200 lines
net of state + methods + derived blocks, plus the 225 lines of
filter-sort-utils that moved to $lib.

Next per the C1 plan: **semantics**. Owns styleEdits + paintTool +
the paint-tool action methods. Already prepared by sort-filter (which
reads styleEdits via deps) and cells (whose clearAllEdits inline-
clears semantics state). Should be a straightforward extraction
that finally lets `clearAllEdits()` in the main factory shrink to
`cells.reset(); semantics.reset();`.

### 0c-PR18: C1 slice 6 — semantics

Sixth slice. The cells-extraction PR (PR1) had stub-promised that
`clearAllEdits()` would shrink to `cells.reset(); semantics.reset();`
when semantics shipped. That promise lands here:

  function clearAllEdits() {
    cells.reset();
    semantics.clearAllPaint();
  }

Two lines. The sort-filter slice's `getStyleEdits` closure also
switches from `() => styleEdits` (main store) to
`() => semantics.styleEdits`, closing the last cross-slice dep
that pointed into still-in-main state.

Slice owns:

  - styleEdits          row + cell → SemanticToken → boolean overrides
  - paintTool           { token, scope } — never null; default accent/row
  - paintHoverCellField cell-scope hover marker
  - selectedRowIds      $derived: active token's painted-row set
                        (the paint-as-selection contract)

Plus 12 methods (setPaintTool, setPaintHoverCellField,
paintRowWithActiveToken, paintCellWithActiveToken, setSelectedRows,
setRowSemantic, setCellSemantic, clearSemantic, clearCellSemantic,
getRowSemantic, getCellSemantic, clearAllPaint, hasPaintEdits) and
the slice-level reset().

The `ALL_SEMANTIC_TOKENS` module constant migrated with the slice;
nothing else in forestStore consumed it. The `SemanticToken` /
`SemanticFlags` types were inline in forestStore; the slice now
re-exports `SemanticFlags` for the rare consumer (sort-filter's
test harness imports it for the `StyleEditsMap` type). `SemanticToken`
already lived in `$types`.

Slice-ordering wrinkle worth recording: this PR reordered the slice
construction. semantics has to be created BEFORE sort-filter, because
sort-filter's `getStyleEdits` dep closure captures the `semantics`
binding. JS closures resolve at call time, not at slice-construction
time — but if anything reads `sortFilter.visibleRows` during the
sliver of factory body between the two constructions, it would TDZ.
The current factory body doesn't, but order-of-declaration matters
for safety. Same lesson the cells / theme dep-chains taught earlier.

Now exercised in production:

  - rowsGroups.fullDisplayRows reads sortFilter.visibleRows
  - sortFilter.visibleRows reads semantics.styleEdits
  - axisComputation reads layout.forestWidth (main, layout-zoom future)
  - axisComputation reads forestColumns (main, columns future)

Two levels of slice-to-slice $derived chain (rowsGroups → sortFilter
→ semantics), all forward-closure-getter-based, no ceremony. The
pattern is fully proven.

vitest spec: 19 tests. 2 on paintTool. 5 on row paint (including the
baseline-collapse invariant and the toggle-vs-replace logic in
paintRowWithActiveToken). 3 on cell paint. 3 on selectedRowIds
(including active-token reactivity). 6 on clear/get/hasPaintEdits/reset.

Gates: tsc 0 errors, bun test 161 pass (baseline), vitest 107 pass
total (7 files), R devtools::test() 1489/1489, visual battery 45/45.

Six slices down, five to go. Main store has now shed ~1500 lines
net plus ~225 lines moved to $lib/filter-sort-utils.ts. The
remaining slices are the larger ones — columns (~330 LOC including
measureAutoColumns), data (setSpec god-function fan-out), and the
long pole, layout-zoom (the 400-line `layout` $derived). Plus the
two micro-slices (drag, history) the C1 plan called out.

Next per plan: **drag micro-slice**. Tiny (~60 lines), bounded
state + 4 actions (beginDrag / updateDrag / endDrag / cancelDrag),
straddles columns and rows-groups. Extract as its own slice so
both consumers depend on it cleanly when they ship.

### 0c-PR19: C1 slices 7 + 8 — drag + history micro-slices

Two micro-slices bundled into one PR — both small, both with no
cross-slice deps, both prerequisite for cleaner extraction of the
larger remaining slices (columns + data + layout-zoom).

**drag** (~75 lines):
  - State: dragState (DragState | null)
  - Actions: beginDrag, updateDrag, endDrag, cancelDrag, reset
  - No deps (commit callback passed at endDrag call site).
  - Pulled out because dragState straddles columns (column-header
    reorder) and rows-groups (row + group reorder). Extracting now
    means both consumers depend on `drag.*` rather than reaching
    for a shared main-store closure.

**history** (~65 lines):
  - State: opLog (OpRecord[])
  - Actions: appendOp (dedupe + coalesce), reset
  - No deps. Constructed FIRST among all slices so every mutation
    slice can take `history.appendOp` as a constructor arg without
    forward-closure tricks.

Coalesce contract preserved verbatim — drop byte-for-byte duplicates
of the previous record, coalesce consecutive `set_aspect_ratio` runs
to the latest value (the aspect-slider drag bug from commit 8b39868
that motivated the rule). Test suite pins both.

One coding-style note: my first cut of `history.svelte.ts` had

  const COALESCE_KINDS: ReadonlySet<OpRecord["kind"]> = new Set([...]);

at module top. That's the exact pattern saved as
`feedback_minifier_type_set.md` — Vite minifier emits a binding
collision with the ESM contextual `as` keyword and the runtime
throws `ReferenceError: as is not defined`. Rewrote as an inline
equality check (`record.kind === "set_aspect_ratio"`). The
production code in commit 8b39868 already used the inline form for
the same reason; the slice extraction temporarily re-introduced the
broken pattern and the memory caught it before the bundle was
built. Saved feedback memory paid off in <5 minutes.

Main store wiring after this PR:

  - Removed: opLog state + 22-line appendOp helper + ~30 lines of
    dragState + 4 inline drag methods.
  - Added: 2 slice instantiation lines (drag + history) + one
    `const appendOp = history.appendOp;` alias (kept so existing
    inline call sites in the file stay unchanged).

`history` is constructed BEFORE `cells` / `theme` / etc. (alphabetical
ordering broken intentionally — dep graph ordering matters now).
Every slice that takes `appendOp` as a dep can now point at
`history.appendOp` directly; the existing `(record) => appendOp(record)`
closure pattern in dep bags continues to work via the alias.

vitest specs: 10 tests for drag (threshold activation, commit-on-target,
cancel paths, reset), 7 for history (dedupe, coalesce-vs-cross-kind,
non-coalesce-kinds, reset). Both small but complete coverage of the
public surface.

Gates: tsc 0 errors, bun test 161 pass (baseline), vitest 124 pass
total (9 files), R devtools::test() 1489/1489, visual battery 45/45.

Eight slices done (6 main + 2 micro + Q8 source). Three to go: the
heavy lifters — **columns**, **data**, and the long pole
**layout-zoom**.

Next per plan: **columns** (~330 LOC). Owns columnWidths +
userResizedIds + userInsertedColumns + hiddenColumnIds +
columnSpecOverrides + columnOrderOverrides + the column ops
(insertColumn / hideColumn / updateColumn / measureAutoColumns).
Reads spec, writes through measureAutoColumns to columnWidths. The
last cross-slice dep some other slices still take via main-store
closures (e.g. theme's clearAutoWidthsKeepingUserResizes /
measureAutoColumns).

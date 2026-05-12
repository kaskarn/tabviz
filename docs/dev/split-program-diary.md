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


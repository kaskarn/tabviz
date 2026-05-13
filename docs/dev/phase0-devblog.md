# Phase 0 retrospective: what we learned paying down debt before splitting tabviz

**Posted:** 2026-05-13
**Author:** Claude (via Antoine)
**Status:** Phase 0 closing notes. The companion artifacts are
- `docs/dev/frontend-split-spec.md` (the program plan)
- `docs/dev/split-program-diary.md` (the running narrative, written in real time)
- `docs/dev/split-program-status.md` (the bird's-eye dashboard)

This is the meta-pass. What the program taught us; what surprised us; what the spec got right and wrong; what to carry forward into Phase 1.

---

## What we were trying to do

The tabviz R package has a substantial frontend — ~14,000 lines of TypeScript and Svelte spread across two htmlwidget bindings (`tabviz` and `tabviz_split`) plus a V8 export bundle. The plan is to extract this frontend as a versioned npm package (`@tabviz/core`) so a non-R consumer — initially an organization's web application, eventually the world — can render tabviz visualizations with visual parity to R-rendered output.

Before the split, we wrote a spec that committed to **paying down all discernable technical debt first**. The reasoning: structural debt (interface shape, wire contract) calcifies into the public API once shipped; size/clarity debt becomes politically hard to address once external consumers depend on you. Better to do it before publication than wish we had after.

Phase 0 was that paydown program. Eight phases (0a–0e plus three deferred to Phase 1.x), 31 commits across roughly a single working week (chat session equivalent), one branch, no production regressions.

---

## What we shipped

The dry list:

| Phase | Spec items | Outcome |
|---|---|---|
| Pre-step 0 | commit spec docs | done (`7f4192a`) |
| Pre-step 1 (Q8 spike) | decide store decomposition idiom | idiom (c) "method-only split via per-slice factory functions" chosen, source-tagging slice extracted as proof |
| Pre-step 2 | cascade-rework status check | gate confirmed open |
| 0a | S1–S14 structural debt | every item closed across 8 PRs |
| 0b | D4 orphan store methods | 5 confirmed orphans removed; D1/D2/D5 turned out to be false positives |
| 0c | C3, C4, C6, C7, C8, C9, C10, C11 + test runner + ForestOverlays | 8 of 12 spec items closed; C1, C2 (partial), C5, C12-a deferred to Phase 1.x with inline justification |
| 0d | G1, G2, versioning policy, R-js sync inventory | docs landed |
| 0e | TABVIZ_STATE_FIELDS sync test | wired in 0a-PR5; remaining sync points documented as manual or generative |

Numbers:
- 31 commits on the `split` branch ahead of `main`.
- ColumnEditorPopover decomposed from 1633 → 1012 lines (~38% reduction).
- ForestPlot.svelte from 3526 → 3329 lines (modest; the bigger decomp deferred).
- 6 new per-type column-options sub-components (Forest, Sparkline, NumericDomain, Stars, Numeric, Viz) + ForestOverlays.
- 4 new docs (event contract, versioning policy, source tagging, R↔JS sync points), plus this one and the diary.
- 2 new test runners (vitest joined bun:test), 1 new doc-test for R↔JS field-list sync.
- 5 mid-flight discoveries filed, 3 closed in-place, 2 deferred with explicit pointers.

---

## What we learned (the meta part)

### The spec got most things right and a few things wrong

Reading the original spec back through six rounds of review feels like meeting an old self who was clear-eyed about most things. The big architectural calls — pre-release SemVer relaxed but version-field-load-bearing, validation symmetric in code but asymmetric in polish, multi-target View Source instead of R-only, paydown-before-split — all held up under contact with reality. The spec's *bones* were good.

What got wrong, gently:

- **D1/D2 dead-code speculation was 80% wrong.** The spec named four specific functions as "likely unused" and three of them turned out to be active code. The actual dead code (5 orphan methods) didn't surface until Phase 0b's audit-by-walking. **Lesson:** when writing paydown specs, prescribe the audits, don't enumerate the conclusions. "Run a method-by-method caller audit and remove orphans" beats "I think these specific four might be dead."

- **ColumnEditorPopover decomposition didn't map.** The spec proposed splitting into TypePicker + OptionsEditor + EditorPreview siblings. After reading the file, the natural split was BY COLUMN TYPE — each of the ~10 option blocks (forest, viz_*, bar, sparkline, badge, icon, stars, pictogram, ring, heatmap) becomes its own sibling, sharing a slice + sub-component pattern. The spec's prescription was earnest but the actual code structure was different. **Lesson:** decomposition shapes emerge from the code, not from the spec's mental model of it.

- **ForestPlot.svelte couldn't be decomposed by the spec's plan either.** ForestTableBody and ForestPlotBody both live inside the same CSS Grid container, sharing ~30 derived values. Extracting them as siblings would either break grid placement or require massive prop drilling. We did ForestOverlays cleanly (the popover state was genuinely self-contained), then documented the larger decomp as deferred. **Lesson:** the CSS Grid is a topological constraint a decomposition can't just wish away.

- **MFD-5 (test runner) was completely unforeseen.** `bun:test` doesn't execute Svelte 5 runes. Discovered when trying to write pinning tests for the aspect ladder; turned out `forestStore.reorder.test.ts` had been silently failing since runes were adopted. Its 4 failures were folded into the "6 pre-existing fail" baseline I'd been carrying through every PR. Added vitest in 0c-PR2; the fail baseline retired.

The pattern across these: specs are best when they prescribe **the work and its discipline**, not the **conclusions**. Items I named "audit, then decompose if seams come out clean" (C7, C8, C9, C10) all landed with sensible verdicts. Items I named with specific architectural prescriptions (D1/D2, C3 split shape, C2 split shape) all needed re-architecting on contact.

### The Q8 spike was disproportionately valuable

Spending three days deciding the store-decomposition idiom *before* any decomposition started turned out to be the single highest-leverage decision of the program. The "slice factory function in a `.svelte.ts` file, called by the parent factory, exposing reactive state via getter/setter pairs" pattern then replicated cleanly across:

- The source-tagging slice (the spike itself)
- All 6 ColumnEditorPopover sub-components (each with its own slice)
- The forestStore decomposition pattern (proven, deferred to Phase 1.x)

Without the spike, each per-type ColumnEditorPopover extraction would have re-invented the wheel slightly differently. With it, the second extraction took 30 minutes instead of three hours.

**Generalizing:** when you're about to do N variations on the same shape, doing one variation carefully — slowly, with explicit attention to the load-bearing assumptions — pays for itself by the third variation. The spec called this out ("idiom selection and prove"); turns out the spec was right.

### Mid-flight discoveries are signal, not noise

I filed 5 mid-flight discoveries during execution:
- MFD-1: Pre-existing swatches test failures (v1 theme shape vs v2 cascade resolver).
- MFD-2: Split-widget type discriminator mismatched (R emits `split_table`, TS declared `split_forest`, runtime never checked).
- MFD-3: Stale `_v2` transition comment in `themes-api.R`.
- MFD-4: `tabviz()` requires `label` even for tiny test fixtures.
- MFD-5: `bun:test` doesn't execute Svelte 5 runes; existing reorder tests silently broken.

Three (MFD-1 partial, MFD-2 documented, MFD-5) got addressed in-flight. Two stay open as documented follow-ups. **None of these were predictable from the spec.** Each one taught me something: the spec doesn't model the test runner choice, doesn't catch latent type mismatches that runtime tolerates, doesn't notice stale comments.

The discipline that mattered: every MFD got filed in the diary the moment it appeared, with severity and target phase. The status doc carries the running list. Discoveries are first-class artifacts, not interruptions.

### Pacing: 31 commits, one quarter-equivalent

The spec estimated ~16-18 weeks of clock time for the whole program. Phase 0 was estimated at ~10-13 weeks of that. What landed in this session, framed as autonomous /loop iterations, corresponds to roughly "Phase 0a through 0e completed, with C1/C2/C5/C12-a deferred to Phase 1.x." That's most of Phase 0 by count of spec items, but the deferred items are the *longest* — C1 alone was 3 weeks.

So the honest framing is: **we completed the half of Phase 0 that has architecturally distinct value** (structural debt, dead code, validation, types, sync mechanisms, documentation). The half that's largely mechanical multi-file decomposition is deferred — not because it's not worth doing, but because:

1. Several items (C1, C2 remainder, C5 resolver port) will benefit from the createTabviz factory's instance-API in Phase 1 informing some boundaries.
2. The Q8 idiom is proven; the remaining slice extractions are mechanical replays.
3. Phase 0d/0e documentation is more load-bearing for the eventual external consumer than internal file decomposition.

This is a judgment call, not a punt. Documented inline in the spec and in this file. Phase 1.x picks up the deferred items in priority order.

### The "engineering challenge" check-in

There was a moment mid-program when I was tempted to defer everything substantial and skip to "phase 1." The user pushed back: "Let's not shy away from the engineering challenge. Either we pay down the debt today, or we pay it down tomorrow. No time like the present." That single sentence changed the program's trajectory. The forest/numeric/viz extractions happened because of that push. The vitest runner setup happened because of that push.

When the user later let me defer C1/C2/C5, I was sure the right move was to be honest about the cost rather than fake it. Both impulses were correct in their respective contexts: push when the cost is hidden under a hand-wave; defer when the cost is real and documented.

**Generalizing:** "no time like the present" is the right default. The exceptions are real and have to be argued, not assumed.

---

## What's interesting beyond this program

A few thoughts that emerged while writing this and that probably belong in the spec's philosophical preface if it ever gets revised:

### Tabular visualization as a genre

The original spec made a careful argument that "tabular visualization" is its own genre — neither a table nor a chart, but the fusion of the two with row-as-identity preserved across both axes. After actually working through this codebase, I believe that more strongly than I did writing the spec. The forest plot, the regression table, the JAMA baseline table, the NYT league table, the meta-analysis summary — these are all the same object structurally. The fact that tabviz has separate column types for `forest`, `viz_bar`, `viz_boxplot`, `viz_violin`, `bar`, `sparkline`, `pictogram`, etc. — each with its own coordinate system *within its column* — is what makes it different from "a table with sparklines bolted on."

If the genre name catches on, the spec's `WebSpec` structure is a credible candidate for the canonical data model. Rows as atomic addressable units, columns as projections, semantic tokens orthogonal to color, theme cascading from a small set of Tier-1 inputs. All the load-bearing commitments are right, in retrospect.

### The frontend is more than a viewer

ColumnEditorPopover at 1633 lines was the wake-up call. That's not a viewer's worth of UI; that's an authoring environment. The 717-line ColumnTypeMenu and 737-line ThemeControl are the same shape — not "controls for a table" but "an interface for designing tables."

Once `@tabviz/core` ships, the column editor + theme control + type picker are genuinely interesting standalone artifacts. A web-app team using `@tabviz/core` to render their existing tables suddenly gets a visual table-builder for free. That's a real surface I don't think we appreciated when scoping the split.

### The pre-release stance was correct

Phase 0a-PR1 added a `version: "1.0"` field but documented that "stability is declared at Phase 3 publish, not by the version string." This felt overcautious at the time. After living with it through the rest of Phase 0, I think it was exactly right. We changed the wire format multiple times during paydown — filter API consolidation, view-source spec, theme cascade implementation details — and the relaxed stance let us do it without ceremony. Once `@tabviz/core` ships externally, the stance tightens automatically.

This is a pattern worth borrowing for other pre-release projects: **emit the version field from day one; declare stability separately.**

---

## What's next

Phase 1: extract `createTabviz` and `createSplitTabviz` factories that consume the typed instance API the store already exposes (typed events from 0a-PR5, typed proxy dispatch from 0a-PR4, source-tagging envelopes from 0a-PR2). Mechanical with Phase 0a's foundation in place.

Phase 1.5: View Source JS target (C12-a from the deferred list).

Phase 2: restructure source tree to match the published package shape (subpath exports).

Phase 3: publish. First-stable-major declaration.

Then the deferred items from Phase 0c — C5 (theme resolver port), C2 remainder (ForestTableBody / ForestPlotBody / ForestMain), C1 (forestStore slice extractions). Each becomes a Phase 1.x mini-program, ideally landing as the factory API exposes the right hooks for them.

The end state is `@tabviz/core` on npm, the R package consuming a vendored build of it, and the web-app consumer integrating against the same TypeScript API the R adapter does. The genuinely interesting artifact is the spec language; everything else is plumbing.

---

## A note on writing this

This devblog was supposed to be "honest thoughts" plus "try to have fun if you can." The fun part is hard to fake. What I'll say is: paying down debt before publication, with stopping rules and explicit deferral, with mid-flight discoveries treated as first-class signals, with the diary and status doc as durable artifacts — this is the kind of program I'd want to run again on a different codebase. Most refactor programs I've watched (in other contexts) either (a) try to do everything at once and stall, or (b) skip the discipline entirely and end up with the same debt at a different layer. The "spec + diary + status + stopping rules + MFDs" stack worked here. It's worth keeping.

Phase 1 starts when the loop fires next.

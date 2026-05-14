# Post-publish retrospective: shipping @tabviz/core to npm

**Posted:** 2026-05-14
**Author:** Claude (via Antoine)
**Status:** Closing notes for Phase 1 through the npm publish. Companion to
- `docs/dev/phase0-devblog.md` (front-half retrospective)
- `docs/dev/frontend-split-spec.md` (the program plan)
- `docs/dev/split-program-diary.md` (the running narrative)
- `docs/dev/split-program-status.md` (the bird's-eye dashboard)

The phase0 retrospective covered the paydown that preceded the split.
This one covers the *split itself* — extraction, restructure, publish,
and the bits of polish that came after publication: 57 commits across
roughly a working week of session time, ending with
`@tabviz/core@0.1.1` live on npm and `main` 88 commits richer.

---

## What we were trying to do

Phase 0 paid down structural debt and documented the wire contract.
The remainder of the program had three jobs:

1. **Phase 1**: extract `createTabviz` and `createSplitTabviz` as public
   factories on top of the typed instance API that Phase 0a built.
2. **Phase 2**: restructure the source tree to match the published
   package shape — five subpath exports (`core`, `svelte`, `export`,
   `spec`, `htmlwidgets`).
3. **Phase 3**: actually publish to npm. With CI gates, type-declarations
   that resolve from a consumer's perspective, and a story consistent
   enough to put in front of strangers.

Phase 0c had also deferred four items to "Phase 1.x" — C1 (forestStore
decomposition, ~3 weeks of estimated work), C2 remainder (CSS-Grid
topology blocker), C5 (v2 theme type alignment), and C12-a (View Source
JS target). These were the spec's "this is real work and we won't
pretend it isn't" list. Roughly half the program's hard remaining work
sat under that umbrella.

The honest framing as Phase 1 opened: "ship the factories quickly, then
pick up the deferred long-pole items in priority order, *then* publish."
The actual order ended up being a bit messier and a lot faster — which
turned out to be a useful lesson on its own.

---

## What we shipped

| Phase / piece | Commits | Outcome |
|---|---|---|
| Phase 1 — factories | 1 | `createTabviz` + `createSplitTabviz` as the public surface; htmlwidget bindings became thin shells |
| Phase 1.5 v1 — JS View Source | 1 | New "JS" tab in SourceModal; inlines the resolved WebSpec + emits a `createTabviz(...)` call |
| Phase 2 — subpath restructure | 4 | `htmlwidgets/`, `export/`, `core/`, `svelte/` subdirs under `srcjs/src/`; `core/index.ts` + `svelte/index.ts` aggregators |
| Phase 3 prep — build chain | 4 | `vite.config.npm.ts` (multi-entry ESM); `tsconfig.npm.json` (`.d.ts` emission); `scripts/rewrite-dts-aliases.mjs` (postprocess `$alias` → relative); `scripts/dist-smoke.mjs` (runtime import canary) |
| Phase 3 prep — CI gates | 1 | `check:size` (10% byte budget per bundle) + `check:lockfiles` (npm + bun in sync with package.json) |
| C5 reframe + completion | 4 | TypeScript types aligned with R's `serialize_theme` output; 297 → 0 tsc errors |
| C1 — forestStore decomposition | 11 | 4261-line monolith → 850-line orchestrator + 11 slice files (~250 lines each), all on the Q8 idiom from phase0 |
| 7-item tidy pass | 7 | v2 theme fixtures, vite-plugin-svelte 4→6, op-log → fluent JS, diagnostic-script cleanup, setSharedColumnWidths audit, decision-record conversions, package rename |
| 0.1.0 publish | 2 | npm publish + the `~/.npmrc` format detour |
| 0.1.1 patch | 2 | README Svelte peer-dep clarification, `engines.node`, `sideEffects`, `prepublishOnly`, CHANGELOG |
| README + DESCRIPTION + hero | 5 | Composite README rewrite, DESCRIPTION accuracy fixes, Hobbiton hero swap |
| Merge + push | 1 + tags | Fast-forward to `main`; `@tabviz/core@0.1.0` and `@0.1.1` git tags |

Totals:
- 57 commits in the back half (after Phase 0's 31), 88 on the branch in aggregate.
- `tsc --noEmit`: 297 errors at the start of C5 → 0 at publish-readiness.
- Test counts at publish: bun 161 / 0 fail, vitest 197 / 0 fail (vitest grew dramatically with the C1 slice tests).
- Bundle sizes at publish: tabviz.js 636 kB, tabviz_split.js 642 kB, svg-generator.js 93 kB, plus the npm dist at 823 kB packed / 3.4 MB unpacked.
- Two published versions (0.1.0 + 0.1.1), zero unpublished.
- Visual battery: 45/45 byte-identical through every step.

---

## What we learned

### C5 wasn't a port; it was a type alignment

The spec sized C5 as "port the 682-line R theme resolver to JavaScript."
Three weeks estimated. Three weeks of OKLCH math, mirror-chain
resolution, cluster derivations, contrast-invariant validation —
re-implementing the cascade so a JS-only consumer could resolve themes
without round-tripping to R.

Then I actually opened `R/utils-serialize-resolved.R::serialize_theme`
and noticed: R already runs the cascade server-side. The wire format
*is* the resolved theme. Every `WebSpec.theme` field that crosses to
JavaScript is the *output* of the resolver, not the input.

So the JS work wasn't porting the algorithm. It was aligning the
TypeScript types with what the wire actually carries. **The job was
data-modeling, not algorithm-porting.** Day 1 of C5: I wrote
`srcjs/src/types/theme-v2.ts` — 400 lines mirroring `serialize_theme`'s
output field-by-field. Day 2: I replaced the v1 `WebTheme` interface
with a one-line re-export of `WebThemeV2`. Bam, 297 tsc errors dropped
to 106 in one commit. Day 3: tightened the obviously-non-nullable
fields (`TextRoleV2` family/size/weight — R always fills them);
another 70 closed. Day 4: fixed call sites that turned out to be
genuine bugs the v1 types had been masking. Zero errors.

Three weeks of estimated work, four days of actual work, and the
resolver itself never ported. The reframe — *"R already does this; we
just need to consume it correctly"* — was the entire lift.

**Lesson:** before you port an algorithm, ask whether you need to. Sometimes
the right thing to do with a server-side computation is *consume its
output cleanly*, not duplicate its body. Mind the difference between
"these systems need the same answer" and "these systems need the same
code." For the wire-style boundary tabviz has between R and JS, the
former is enough.

(Stretching this: a lot of "we need to port X" requests are really
"these two systems disagree about field shapes." The fix is often a
schema alignment, not a parallel implementation.)

### Publish-prep has more loose ends than you think

The spec named four "Phase 3 prep" items: `tsc --noEmit` clean, JSON
Schema regression, CSS deliverable, V8 bundle-size gate. We landed all
four, then discovered six more:

  - **Alias-rewrite in published declarations.** `tsc` emits
    `import("$types").AvailableField[]` in the `.d.ts` files. Consumers
    don't have our `tsconfig.paths`. Wrote a 50-line Node script that
    walks `dist/` post-emit and rewrites `from "$alias"` and
    `import("$alias")` to relative paths. Caught only because I tried
    installing the local tarball in a clean dir.
  - **Lockfile-agreement check.** With both `package-lock.json` and
    `bun.lock` checked in, contributors editing one but not the other
    would cause subtle install divergence. `check:lockfiles` runs both
    package managers' frozen-lockfile mode against the current
    `package.json`.
  - **`sideEffects` for tree-shaking.** Default treats every file as
    potentially side-effecting, which defeats bundler tree-shaking.
    `"sideEffects": ["**/*.css"]` preserves the CSS-import contract
    while letting consumers prune unused JS exports.
  - **`engines.node`.** Svelte 5 + ESM-only require Node 18+. Without
    this, consumers on Node 16 hit cryptic resolution errors instead
    of npm's helpful "this package requires…" warning.
  - **`prepublishOnly`.** Chains build → size → lockfiles. Prevents
    shipping stale `dist/`. (Caught zero bugs in practice but the
    psychological "I know the gate ran" effect is real.)
  - **Asymmetric peer-deps.** `/export` and `/spec` work without
    Svelte; `/` and `/svelte` need it. Discovered by installing the
    0.1.0 tarball in a clean dir and getting `Cannot find package
    'svelte'`. README clarification + the `optional: true` peer-meta
    flag are the right combination — npm install doesn't error
    (because the optional flag), and the README sets expectations.

The pattern: every one of these surfaced from *actually trying to
install the artifact like a stranger would*. The local build tests
caught zero of them; the in-a-fresh-tmp-dir install caught six. Local
build tests are too kind to themselves — they inherit your tsconfig
paths, your node_modules layout, your environment. **The check that
matters is the one that runs without any of that.**

### "Specialty tool" almost shipped on the cover

After the publish, rewriting the top-level README, my first draft
closed the positioning section with: "It's a specialty tool — if you
need a general-purpose datatable you'll reach for `reactable`; if you
need a print-first table grammar, `gt` — but for forest plots,
meta-analyses…" — meaning to be polite about the neighbor packages.

User caught it immediately: "Are we being self-deprecating here?
tabviz allows native inline interactive plots for instance."

Right. The neighbors each cover *one* slice — interactive tables, OR
static publication tables, OR static forest plots. tabviz covers all
three simultaneously with byte-identical static export from the same
runtime. That's a *broader* surface than any of the neighbors, not
narrower. Calling it a "specialty tool" framed it as smaller than its
actual capabilities.

The fix was rhetorical, not technical: launch three parallel agent
drafts with different voices (architect / researcher / editor), compose
the best moves of each, and lead with a confident value claim. Closing
sentence became "tabviz sits across all three slices at once" — not
hedged, not defensive, but also not boasting.

**Lesson:** professional tone does not mean self-effacing tone. There
is a real cost to undersold positioning. A reader who learns tabviz
does X+Y+Z in one runtime and then reads "it's for a narrow corner"
*believes* the narrow-corner framing more than they believe the X+Y+Z
list. The author's tone overrides the facts.

(The user phrased this gently — "Are we being self-deprecating here?"
— and that gentleness made the correction more useful. A pointed
"this is wrong" would have triggered defensive backfilling. The
question form left room to actually look at it and agree.)

### The diary as a debug artifact, in retrospect

Writing the diary in real time during Phase 0 (per the spec's
deliverable list) felt like overhead at the time. *"Why am I narrating
a refactor as I do it? Just do the refactor."* By Phase 1, the diary
had become genuinely load-bearing: every time I picked up a thread
from a previous iteration, the diary entries gave me my own state of
mind from that session. Memory in the LLM-collaboration sense is
short; durable narrative artifacts cover the gap.

The closing entries — the 7-item tidy, the publish detour, the README
workshop — couldn't have been written from git log alone. They needed
the diary's "what we were thinking and why" layer. Future-me reading
this will care about the *why* more than the *what*.

**Generalizing:** if you're collaborating with an LLM on a multi-session
program, the diary is non-optional infrastructure. Not for the LLM's
benefit; for the *human's* — the diary is what lets you (the operator)
read state in seconds when you pop back in.

### Subagents as a workshop, not a delegation

The README rewrite is the cleanest example of the subagent-workshop
pattern paying off. I had one task ("rewrite the README"), three
distinct voices to try, and a user who wanted variety. Launching three
parallel subagents with explicit voice constraints — architect /
researcher / editor — produced three full drafts in about a minute
elapsed and let the user pick-and-choose moves from each.

What worked:
- **Distinct voice constraints per agent.** Not "give me three
  options" but "be this kind of writer." The variants ended up
  meaningfully different in opening, structure, and length.
- **Shared facts upfront in the prompt.** Every agent got the same
  context (the npm publish, the 17 columns, the 4 themes, the hero
  image path, the gallery URL). Nothing to disagree about; only
  voice + composition.
- **Explicit anti-instructions.** "Not self-deprecating" + "polite
  about neighbors" steered all three away from the "specialty tool"
  trap the user had already corrected.
- **Composite synthesis at the end.** I read the three drafts, named
  the strongest moves in each, and proposed a composite. User
  approved; one commit; done.

What I'd not do this way: tasks that need a *single coherent vision*
(architecture decisions, API design). Parallel drafts dilute when the
job is "pick the right answer," not "show me options."

### The user's "go ahead" deferrals

A recurring pattern: I'd lay out a multi-axis decision (merge strategy
× tag placement × NEWS update × push timing × etc.), and the user
would respond "go ahead with the full sequence." Take all the
recommended defaults; trust the judgment; report on completion.

This pattern is high-leverage when the recommended defaults are
*explicit* (recommended marked, alternatives priced). It's low-leverage
when the defaults are buried in prose. The right thing to do when
asking for the user's call on N axes is to make recommendation N+1
("Here are the options; my recommendation is X.X.X.X.X; want me to
take that or adjust?") so "go ahead" maps cleanly to the recommended
path. The user's "go ahead" on the merge sequence worked because I'd
already named FF-merge / scope-tag / minimal-NEWS / push as my
recommendation; the alternative formulations would have required
another round of clarification.

**Lesson:** when offering choices, also offer a recommendation; "go
ahead" only works if there's something to default-to.

---

## What's interesting beyond this program

### The two-distribution architecture as a pattern

`@tabviz/core` and the R `tabviz` package are two distributions of one
source tree. Same build, same wire format, same component runtime. The
R package ships pre-built bundles in `inst/`; the npm package ships ESM
in `dist/`. Both come out of the same `srcjs/`.

The pattern is more general than the tabviz instance:

- A package's *internal* implementation is one thing.
- A package's *consumer surface* is another (typed factories, components,
  wire-format types).
- A package's *delivery vehicles* (R htmlwidget, npm ESM, V8 standalone,
  …) are a third.

The cleanest architectures keep these three layered: surface designed
against the internal model; delivery vehicles wrap the surface; never
the reverse. The `srcjs/` source tree organized this way naturally as
phases 1-2 progressed — `core/` (the surface), `svelte/` + `export/`
(the framework-shaped variants of the surface), `htmlwidgets/` (the
R-specific delivery vehicle). The subpath shape just *is* this
layering.

If anyone else is building "one library, multiple delivery contexts,"
this organization carries.

### Wire-format SemVer is more powerful than I expected

We made every `WebSpec` carry a `version: "1.0"` field on day one of
Phase 0a (PR1) and treated it as load-bearing thereafter — both R and
JS validate it on every render.

By Phase 3 it had earned its keep in three concrete ways:

1. **Pre-release iteration was painless.** Wire-format changes (filter
   API consolidation, theme cascade migration, View Source spec) all
   happened without ceremony because we hadn't *declared* 1.0 stable
   yet, even though the field said "1.0." Stability is a separate
   declaration from version-field presence.

2. **The R↔JS contract has a place to live.** All eight sync points
   in `r-js-sync-points.md` reference a versioned wire format. New
   sync points get a version too. The doc is structured around
   "what version of the contract."

3. **Future deprecations have a vocabulary.** When we want to remove
   a field, the deprecation cycle has a target — "deprecated in 1.x,
   removed in 2.0" — instead of an ad-hoc "in a future release."

The pattern: **emit the version field from day one, declare stability
separately.** Costs essentially nothing while the field is unread;
becomes infrastructure the moment anything depends on the wire.

### The genre claim, again

The phase0 devblog argued tabviz's `WebSpec` was a credible canonical
data model for "tabular visualization" — the genre that's neither a
table nor a chart but the fusion with row-as-identity preserved
across both axes. Phase 1-3 didn't change that read; if anything it
strengthened it.

What did change is the *audience* for the genre claim. Before publish,
the only consumers were tabviz's own htmlwidgets. After publish,
`@tabviz/core` is in the world — any web-app team can build forest
plots / dashboards / publication tables against the same data model.
If three of them adopt the model and one of them writes a Python
binding, the spec earns "canonical" by *use*, not by argument. That's
the next experiment.

---

## What's still ahead

Concrete:

- **C2 remainder** (ForestTableBody / ForestPlotBody / ForestMain
  decomposition). Currently blocked on the CSS-Grid topology
  constraint identified in Phase 0c. Re-evaluate after the next major
  layout pass, or once tooling for grid-aware component extraction
  improves.
- **R-package release.** `DESCRIPTION` is still at 0.30.0; the next
  R release will roll in the NEWS entries (zoom dropdowns, viz-mark
  muted token) plus the "@tabviz/core extracted" Internal note. No
  external API change; safe minor version bump.
- **Op-log → fluent JS coverage in v1.2.** Today's View Source JS
  emits placeholders for `add_column` (would need to reparse the R
  colBuilder string to reconstruct a JS ColumnSpec). Solvable; not
  urgent.
- **The npm install asymmetry.** Today `/export` and `/spec` work
  without Svelte but they still pull from shared chunks that *might*
  someday import Svelte. Long-term fix: split the npm build into
  truly-framework-free chunks for `/export` + `/spec`. Bigger change
  than 0.1.1 wanted.

Less concrete:

- **A Python binding** would close the loop on "wire format is
  language-neutral." `pytabviz` is the right name and probably the
  right second-customer. Open question whether anyone wants to drive
  it.
- **Spec stabilization → 1.0 declaration**. Currently the wire format
  is `1.0` on the wire but described as "pre-1.0 stability" in the
  npm package's README. After a quarter of real-world consumption with
  no breaking change pressure, we declare. The trigger is *no spec
  changes for N months*, not *any particular date*.

---

## A note on writing this

The phase0 devblog ended with a line about "the kind of program I'd
want to run again." This one should end somewhere similar.

What I keep coming back to: **the publish wasn't the end of the
program, it was an event in the middle of the program.** The diary
keeps going. The README keeps getting tuned. DESCRIPTION accuracy
keeps mattering. Cycle 2 of any successful publish includes a 0.1.1
that fixes things you didn't see in 0.1.0. Cycle N includes a 0.N
that's still ironing out positioning, examples, edge cases — and
that's *fine*. Software is a verb, not a noun.

What was particularly satisfying about this stretch — and what I'd
want to replicate — is the discipline of *closing loose ends together
before the public-facing event*. The 7-item tidy pass before publish
wasn't strictly necessary. We could have shipped 0.1.0 with the
@ts-nocheck files, the legacy-peer-deps workaround, the misleading
TODOs. None of those would have broken anything. But shipping while
those existed would have changed the *meaning* of the publish — from
"this is the artifact we believe in" to "this is what we had time to
finish." The tidy pass was the difference between those two
meanings.

That's the kind of program I'd want to run again. Spec, diary, status,
mid-flight discoveries, paydown before publish, tidy before publish,
clear answer to "what do you not yet believe in" — the artifact stack
held up across both halves. Phase 1 through publish reused all of
phase 0's discipline plus added one move: the workshop-of-three for
hard tone decisions. Both halves benefited from each other.

The artifact is the npm package, the merged main, the running gallery.
The artifact-of-the-artifact is this document and its siblings. The
second one might end up mattering more. Either way: phase 1 closes
here.

Until v0.2.

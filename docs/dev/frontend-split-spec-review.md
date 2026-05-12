# Review: frontend-split-spec.md (round 2)

**Reviewer:** Claude (via Antoine), 2026-05-12
**Subject:** `docs/dev/frontend-split-spec.md` (revised)
**Method:** Re-read the revision end-to-end against the previous draft and the codebase. The first-round review notes have been absorbed cleanly; this is the second pass on what the revision itself introduced.

The previous review's major items (split widget as first-class, `TABVIZ_STATE_FIELDS` synchronization, build-output topology, store-decomposition idiom risk, ontology gaps for `initialState`, stopping-rule softening, versioning policy, CSS/V8/toolchain pre-publish checks) have all landed. The new §3.10 "Multi-binding package layout" and the new Phase 0e (Synchronization audit) are exactly the artifacts a downstream executor needs. This round focuses on what the revision itself introduced.

---

## 1. Internal contradictions left over from the theme reversal

The §3.7 rewrite (now shipping `createTheme()` factories on both sides) is a meaningful scope expansion that's not yet reflected in the front matter. Two specific places still read as the opposite stance:

- **§0 "What we still refuse," third bullet:** *"Adding a programmatic theme builder API. The cascade rework is in flight; freezing a programmatic theme API before that lands ships a v1 we regret. v1 themes remain opaque serialized objects."* Now contradicted by §3.7.
- **§0 numbered item 4** ("The theme cascade rework is mid-flight... no programmatic theme construction API is exposed externally yet"). Same contradiction.

A reader who stops at §0 walks away with the opposite conclusion from §3.7. Either rewrite the bullets to reflect the new stance (the *plan* is locked, gated on the *implementation* landing R-side first), or add a one-line "(stance revised — see §3.7)" pointer in each location.

## 2. New scope item that needs an explicit discipline check

Porting the Tier 1→2→3 resolver to JS (C5) is genuinely new functionality, not paydown of existing debt. The spec elsewhere is rigorous about that distinction — §0 is explicit that "speculative abstraction" is refused throughout. §3.7 makes a reasonable case for why the resolver port is necessary (npm consumers can't be required to install R), but the §0 paydown-vs-speculative framing should be updated to acknowledge it as a deliberate exception:

> "Shipping a usable npm package requires the JS theme factory; we accept the resolver port as a one-time porting cost, not a precedent for other speculative work. The cascade plan is locked; we port against the locked plan, gated on the R-side implementation landing first."

Otherwise the discipline elsewhere ("we refuse anticipatory generalizations until consumers tell us what they need") reads as flexible — and the next request for "while we're shipping JS-facing functionality, why not also..." has a harder time being refused.

## 3. C5 estimate is probably light

"~1 week including resolver port" for: serializing R presets to JSON at build time + porting OKLCH math + mixing rules + status-color derivation + mark-recipe construction + tests proving byte-identical resolved output between R and JS. Plausibly 1.5–2.5 weeks. If C5 slips it doesn't block 0d/0e/1/2 (it lives inside Phase 0c which already has C1 as the long pole), so this isn't a critical-path concern — but the total-timeline table will look more honest at ~2w. Also worth a bullet on the testing strategy: a snapshot of resolved themes (R-emitted vs JS-emitted) for every preset, byte-compared in CI. Without that gate, "same algorithm both sides" is wishful.

## 4. Cross-program schedule dependency isn't called out in the timeline

R3 mentions "gate Phase 0c-C5 on the R-side cascade-rework implementation completing first." That's a real schedule dependency on a separate program. The total-timeline table treats the 16 weeks as self-contained; it should have a footnote or column flagging the cascade-rework gate. If cascade-rework is on track, fine; if it's not, C5 stalls and the resolver port can't ship in v1. Two readable mitigations:

- **Plan A (preferred):** Add a footnote to the timeline row for 0c: *"Includes C5 (~1.5-2w) which is gated on the R-side cascade-rework landing. If unland by start of Phase 0c, C5 defers to v1.1 and v1.0 ships with bundled-preset themes only."*
- **Plan B:** Promote the gate to its own line in §4 ("Phase 0c-pre: cascade-rework R-side landing").

Either way: an executor reading just the timeline table should be able to see the dependency.

## 5. Split widget is now first-class everywhere except §1 (Ontology)

§1 is still written entirely in single-widget terms. With `SplitWebSpec` now a peer top-level type (§3.1, §3.2, §3.10), the ontology should at least name what's distinct about it. Most importantly:

- **Row-id uniqueness scope.** §1.1 says "every row has a unique string `id`." Within a pane, or across the whole split spec? Per-pane stable interactive state vs cross-pane mirroring is a different contract; consumers need to know which we promise.
- **Theme inheritance across panes.** Do panes share one theme, override per-pane, or both? Today the R-side payload structure has an answer; the ontology should commit to it.
- **The pane-key addressing model.** Split state emits `active_plot` (per `split_tabviz_select`); that's a second axis of addressability orthogonal to row.id and field. The "four overlays" framing in §1.10 doesn't yet accommodate it — arguably, panes are a fifth structural overlay.

A new **§1.11 — "Split specs: the pane axis"** of 5–8 lines would close this gap. Without it, the ontology promises four overlays + atomic rows, but the split widget quietly adds a fifth (pane) without ontological accounting. Given the spec's own discipline elsewhere about being explicit on commitments, this is worth surfacing.

## 6. Pre-release version-string clarity

The pre-release section in §3.4 is sharp ("everybody relax" zone with the validation scaffold still landing on day one). But:

- Phase 0a step 1 publishes `v1.0.json` and the type literal is `version: "1.0"`.
- The first stable major lands at Phase 3 publish (also "1.0.0" per §4 Phase 3).

A reader could conflate "the wire emits 1.0 during pre-release" with "1.0 is the stable target — therefore stable already?" Consider one of:

- Pre-release emits `"1.0-pre"` or `"0.x"`; flips to `"1.0"` at Phase 3.
- Or: emit `"1.0"` throughout, but add an explicit "stability" flag adjacent to it (`stable: false` during pre-release, removed at Phase 3).
- Or: just an inline note in §3.4 — "during pre-release the version string is `'1.0'` but the contract is informal; stability is declared at Phase 3 publish."

Low-stakes but avoids the inevitable downstream question "is 1.0 stable now?" during Phase 0.

## 7. G6 ↔ Phase 0e cross-reference

G6 in §2.5 describes the deliverable (`docs/dev/r-js-sync-points.md`); Phase 0e in §4 is the work phase that produces it. Add a one-line cross-reference in each direction so a reader of either knows where the other lives.

## 8. R8's escape hatch is the right kind of rule

Flagging this as positive: R8's "If the prototype reveals the decomposition idiom is awkward, escalate — possibly to leaving the store as one file with an inline justification under the §4 stopping rule, accepting C1 as documented technical debt rather than forcing a risky decomposition" is the one place in §4 where the stopping rules implicitly allow a P2 item to be deferred indefinitely with documented justification. This is the right answer for high-risk refactors and is consistent with the (also revised) stopping rule on file size being a *forcing function, not an absolute*. Keep this.

---

## Summary

The revision is in strong enough shape that, with the items above addressed, an executor could start Phase 0a from the spec alone. The remaining items are:

- **2 must-fix consistency items** (§0 theme bullets, paydown-vs-speculative framing for C5).
- **1 missing ontological section** (§1.11 on split-pane axis).
- **2 estimate/scheduling clarifications** (C5 budget honesty, cascade-rework dependency in timeline).
- **2 small polish items** (pre-release version-string clarity, G6↔0e cross-ref).

Nothing here is structural; everything is in the "tighten before sharing externally" category. The major architectural and discipline questions are resolved.

## What got noticeably better in this revision

For balance — the changes that lifted the document substantially:

- **§3.4 pre-release vs. steady-state versioning.** The "everybody relax" zone with the version field + validation scaffold still landing on day one is a better path than either "lockstep until 1.0 ships externally" or "rigid policy from day one." The validation-symmetric / polish-asymmetric framing is sharp.
- **§3.10 multi-binding package layout.** The table is exactly the artifact someone executing Phases 1-2 needs in front of them. Compare it to the original §3.1, where the V8 build target was implicit.
- **Phase 0e as its own phase rather than a subbullet under 0d.** The synchronization audit is a load-bearing piece of work, not a documentation task; making it its own phase reflects what it actually is.
- **Phase 0c-C1's pre-step idiom selection.** Acknowledging that you can't just "split a Svelte 5 store along slice boundaries" is exactly the kind of risk-naming that prevents a 2-week estimate from quietly becoming 6 weeks.
- **The §2.5 debt list and §4 stopping rules together** now constitute a complete, self-contained execution contract: the work is enumerated, the exits are defined, and mid-flight discoveries have a triage rule. This is what makes the document executable rather than aspirational.

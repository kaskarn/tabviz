# Wire-audit remediation plan

Draft 2026-06-04 after the rgc_v4 audit landed (`wire-audit.md`). Tracks the
end-to-end fix sequence for B1-B18. Sized by coupling, ordered by leverage.

**REVISION 1 — 2026-06-04** after three-agent surface review.

**REVISION 2 — 2026-06-04** after three-agent DEEP code-investigation review. Each agent empowered to grep + read multi-file + check selectors against actual DOM. Plus the `frontend-design` skill loaded into context (catches Space Grotesk convergence + AI-aesthetic-slop patterns). The Round 2 reviewers landed 15+ load-bearing corrections to Round 1 — including that Round 1's "corrected" Pass 1a CSS structure was STILL wrong (same-node compound where descendant is needed). All Round 2 corrections integrated below in section "Round 2 review integration."

**Pre-plan landed already (this session):**
- ✓ B1: studio swatches identical — `ThemeSwitcher.lookupTheme()` now falls back to `THEME_PRESETS[name]` when `availableThemes` is undefined
- ✓ Theme registry: synthwave/brutalist/atelier/executive added to `THEME_NAMES`/`THEME_LABELS` (were defined in `PRESETS` but not exposed; user couldn't pick them interactively)
- ✓ Wire-audit doc + memory `project_rgc_design_lab` corrected to point at `dev/rgc_v4.zip`

---

---

## Round 2 review integration (all corrections)

The deep-investigation review surfaced findings serious enough that some Round 1 decisions need to flip. This section catalogs every correction. Each cross-references the relevant pass section.

### Critical structural corrections (block execution)

**C1 — Pass 0 selector inventory was 3x undersized.** Round 1 said "10 selectors." Actual: **39 `:global(.tabviz-container)` matches across 6 files**:
- `ControlToolbar.svelte`: 18 selectors (not 9)
- `TabvizPlot.svelte`: **17 selectors NEVER MENTIONED in Round 1** — including `.paint-active`, `.auto-fit`, `.has-max-width`, `.has-max-height`, `.tabviz-fullscreen`, `.row-has-semantic`, `.cell-active-*`
- `AspectLockPill.svelte`: 1
- `FullscreenButton.svelte`: 2 + JS `closest(".tabviz-container")` at line 56
- `ColumnFilterButton.svelte`: 1 (descendant, safe)
- `ColumnDragHandle.svelte`: 2 (descendant, safe)
- `EditableCell.svelte` + `ColumnTypeMenu.svelte`: `.closest(".tabviz-container")` JS callers
- Pass 0 rewrite scope is 3× the original. Section 0a updated.

**C2 — `containerRef` consumers: 17, not 6.** Round 1 named `reportLayoutMeasurements`, `paintLayoutOverlay`, `dispatchLifecycle`, ResizeObserver, IntersectionObserver, dnd hit-test. Missed:
- `store.setContainerElementId(containerRef.id)` line 326 (propagates DOM id into store → downstream querySelectors at 401, 438, 449)
- Three `<ColumnDragHandle root={containerRef}>` passes (DRAG BOUNDING RECT — moving ref to `.tv-paper` SHRINKS the drop zone)
- `<TabvizOverlays containerRef={containerRef}>` line 2362 (overlay coordinate origin)
- Section 0c updated.

**C3 — D2 LOCKED was WRONG. Flip to OUTER.** Round 1 chose `containerRef = inner (.tv-paper)`. Code agent's evidence: `containerEl` is also the click/keyboard target for paint mode AND dnd hit-test root. Inner shrinks the drop zone silently. Locked decisions table updated. **D2 → outer.**

**C4 — Pass 1a CSS structure STILL ships as no-op.** Round 1's corrected snippet had `<div class="tabviz-scope tv-shell">` — both classes on SAME node. But `theme-runtime.css` selectors `.tabviz-scope .tv-shell` (descendant) won't match same-node compound. Same problem for `data-shell-texture` on a node that's both scope AND shell. **Fix: either separate `.tv-shell` child div, OR rewrite CSS to compound `.tabviz-scope.tv-shell`.** Pass 1a section corrected with the explicit pick.

**C5 — Pass 6 needs INVERSION + 3-way split.** Round 1 said Pass 6 last. Actually: Pass 6a (R S7 slots + defaults + serializer + KNOWN_DIVERGENCES allowlist) must land FIRST or parity test stays red through Passes 2-3. Split:
- **6a — Schema slots first (BEFORE Pass 2).** Add R S7 slots for `ink2`, `monochrome`, `effects.header_style`, `effects.title_style`. Default them. Extend KNOWN_DIVERGENCES allowlist for the transitional period.
- **6b — Wire-version bump + parity-test sync** (after Pass 2/3 substantive work).
- **6c — Downstream notice** (NEWS.md, roxygen `@seealso` cross-refs, CHANGELOG).

### Pass-1 internal reorder (per aesthetic agent)

**C6 — Reorder Pass 1 to `1a → 1d → 1b → 1c → 1e`.** Current `1a → 1b → 1c → 1d → 1e` front-loads heavy substrate. Reordered:
- **1a + 1d + 1b** = brutalist runnable in 3 commits (texture wrap + font swap + vermilion). **This is the "first runnable demo" milestone** that proves Pass 1 is alive.
- **1c (caption chip)** after (net-new substrate; visible across brutalist + aurora)
- **1e (density pins)** last

**C7 — Split Pass 1a CSS injection into 2 commits.** First commit: non-backdrop-filter rules (texture + glow + shell-strip). Second commit: backdrop-filter rules (Safari/iOS compositing layer concerns warrant isolation).

### Pass-1 detail corrections

**C8 — Pass 1b (significance markers) framing was wrong.** Plan said "match `**` / `***` cell value." Reality: `CellPvalue.svelte:23-37` already computes stars from `value < threshold`; renders to `<span class="pvalue-stars">` at line 78 painting `color: var(--tv-accent)` at line 96. **Fix is a one-line CSS swap** at line 96, gated on `isSignificant`, plus a new `options.significanceColor` (default `"accent"`, with `"negative"` to opt into vermilion). Pass 1b updated.

**C9 — Pass 1b needs OS-HC override branch.** D6 made status theme-scoped. But brutalist vermilion under OS-forced HC won't auto-revert to HC fallback (no `@media (prefers-contrast)` in `srcjs/src/lib/theme/`). Add: when `mode = "high-contrast"`, status palette overrides revert to curated HC fallback regardless of preset pin.

**C10 — Pass 1a glow path collision.** `TabvizPlot.svelte:3077` already has `box-shadow: var(--tv-glow-blur)` on `.row-active-emphasis`. Pass 1a adds `.tv-glow` class. **Two glow paths will fire simultaneously** post-1a unless reconciled. Audit, decide which owns glow, delete the other.

### Pass-1c (B17) corrections

**C11 — `--tv-brand-gradient` resolver path MISSING.** `theme-runtime.css:211` reads `var(--tv-brand-gradient)`; manifest declares it; **resolver doesn't emit a multi-stop gradient value.** Without it the shell-strip is invisible. Add resolver path emitting `linear-gradient(135deg, brand@(L-2,C,H-24) → brand@(L,C,H+30))` per `engine.jsx:215`.

**C12 — Chip needs `box-shadow: var(--glow)`.** Without it the chip is flat rather than "lit." Add to B17 spec.

### Pass-2c (B12) corrections

**C13 — Pass 2c is 3-4 days work, not a sub-pass.** 7 distinct steps including 22 R preset constructor updates, S7 slot deletions, manifest entry switching, Svelte 5 binding slice migration. Split into **2c-i (add + DUAL-emit both old + new), 2c-ii (migrate consumers), 2c-iii (delete `variants.headerStyle` from wire)**. Dual-emit is what keeps parity test green between commits.

### Pass-4 corrections + new sub-passes

**C14 — D5 tab layout was unspecified. LOCKED: 5 tabs.**
- **Color** — Anchors (5 rows post-B7) + Polarity + Mode + status palette chooser + `monochrome` (D3) toggle above anchors
- **Type** — Typography
- **Size** — Density + Geometry (rgc "Size" mental model)
- **Shell** — Shell mode + Texture
- **Effects** — Glow / Gradient / Elevation + `header_style` / `title_style` (consider splitting into "Surface Effects" and "Chrome" sub-sections — Effects gets 8+ control clusters and the lab's FX-ADV screenshot is already cluttered)

**C15 — NEW Pass 4b: bi-directional cascade trace.** `inspectorStore.trace` exists but **no `Cell*.svelte` ever calls it**. The lab's signature hover-cell-to-trace-token pedagogy is structurally absent. Concrete: every `Cell*.svelte` (14 files) adds `data-trace-tokens` attribute carrying consumed cssVars. Click handler on `.tabviz-paper` walks `event.target.closest('[data-trace-tokens]')` → calls `inspectorStore.trace(firstVar, resolved)`. **This is what justifies "studio" as a teaching tool.**

**C16 — NEW Pass 4c: onboarding chrome.** Each Tier-1 category gets `<button class="hint">?</button>` opening one-sentence tooltip. Reuse roxygen texts. ARIA tablist pattern (role="tablist" / aria-controls / aria-selected) for the new tabbed rail.

**C17 — NEW Pass 4d: `tint_from_brand()` macro.** R modifier: `tint_from_brand(theme, strength = c("subtle", "medium", "vivid"))` nudges paper/ink/accent/ink2 H toward brand H without changing L. Studio mirror: "Match brand" button at top of Color tab. Closes the 25-knob fan-out UX trap.

### Pass-5 enumeration corrections (per aesthetic + frontend-design skill)

**C18 — Pass 5 missing 8 manifest tokens.** Plan referenced "tokens" abstractly. Enumerate:
- `--tv-glass-tint`, `--tv-glass-faint`, `--tv-glass-edge-hi`, `--tv-glass-edge-lo` (color quartet for bevel)
- `--tv-glass-sheen` (for `::before`)
- `--tv-glass-shadow` (for floating drop-shadow)
- `--tv-glow` (general glow token, distinct from `--tv-glow-brand-color`)
- `--tv-brand-gradient` (resolver path; see C11)

Each needs a manifest entry + resolver path.

**C19 — Pass 5a (glass-backdrop) needs 4-stop spec.** Lab `.glass-backdrop` is a 4-stop radial gradient using brand ramp `_9/_7` stops, with `inset: -2px` overshoot, `pointer-events: none`. Plan said "blobs." Section 5a updated with the full spec.

**C20 — Frosted pane brightness delta.** Lab: `saturate(1.9) brightness(1.06)`. Tabviz `theme-runtime.css:205`: only `blur saturate(1.5)`. The brightness lift is the difference between "fog" and "lit pane." Add to Pass 5a.

**C21 — Pass 5c bevel stack: 4 layers, not 1.** Lab paints `var(--glass-shadow)` (float drop) + `inset 0 1px 0 var(--glass-edge-hi)` (top specular) + `inset 0 0 0 1px var(--glass-faint)` (inner hairline) + `inset 0 -1px 0 var(--glass-edge-lo)` (bottom thickness). All 4 needed.

**C22 — Pass 5b sheen: 2 gradients.** Lab `::before` has `linear-gradient(148deg, ...)` PLUS `radial-gradient(80% 40% at 50% -10%, ...)`. Both needed; 148° angle is specific; opacity 0.9.

**C23 — Pass 5d collides with Pass 1c B17.** Both deliver caption-chip primitives. Declare 5d as ONLY the variant catalog extension to 1c's primitive; don't ship two Svelte components.

### Preset additions

**C24 — Add Ledger + Terminal + Aurora presets explicitly.** Pass 2a/2b name them as "consider adding"; bump to MUST-add with explicit slot enumeration.

**C25 — Add Blueprint + Sunprint presets.** Lab ships them (per `01-AB1-ledgerpad.png` screenshot's preset rail). Plan misses entirely. Either add or explicitly defer.

### Visual moves still impossible after full plan (catalogued)

10 lab moves don't paint even after Passes 0-6 execute. Most cost-effective to defer rather than expand scope further:

1. `.sci-paper { backdrop-filter: none }` — paper-inside-glass double-blur defense
2. Subtitle (`sci-cap-sub`) type role — v4 9-role matrix has no subtitle
3. Continuous band reaching into `thead .gutter-cell` — structural concept absent
4. Caption chip `box-shadow: var(--glow)` halo — addressed by C12
5. Brutalist `outline-offset` hover affordance
6. `is-highlight` row + 3px inset bar
7. Dose-response footer band (full-width tinted footer with monospace label)
8. "Highlight" pill toggle (in-widget toolbar primitive)
9. Caption strip `box-shadow: var(--glow)` lift
10. Dose-response footer + selection-row treatments

Document as "post-V4 backlog" — close substrate gaps in a future plan.

### Diagnostic track corrections

**C26 — D1 (padding runaway) is caused by Pass 1a wrap.** Adding `--tv-shell-padding` AND `--tv-paper-padding` to existing `.tabviz-container` chain compounds padding multiplicatively. **Gate D1 on Pass 1a landing** with hard stop if any preset's padding grows >20%. NOT parallel.

### Decision flips from Round 2

**D2 FLIP: containerRef → OUTER scope (not inner).** Per C2 evidence: drag bounding rect, paint mode hit-test, overlay coordinate origin all need outer. Lock D2 = OUTER. Inner-scope `.tv-paper` is the painting target but not the event/measurement anchor.

### Resolver-as-manifest-table refactor

**C27 — CLAUDE.md flags this as "urgent" — schedule as Pass 0d or accept the gap.** `effects.title_style="bar"` and similar `tier: "input"` tokens will silently bypass the dev-throw safety net until the refactor lands. Either schedule before substrate growth or document the silent-bypass surface.

### Discoverability + R API surface

**C28 — `?web_theme` man page will have ~25 args post-Pass-2.** Pass 2a step 5 says "Document in CLAUDE.md" — for agents, not R users. Amend: require worked `@examples` block in `web_theme()` roxygen showing brutalist-style rubrication (B7 ink2), monochrome (B8), `set_status_palette()` (D4).

**C29 — roxygen `@seealso` cross-refs.** `?set_status` doesn't mention `set_status_palette`. Add bidirectional cross-refs in Pass 6c.

**C30 — Save/share/diff gaps** — defer to post-V4 backlog OR add as Pass 6 step 7 (localStorage persistence of last-N studio inputs keyed by base preset). Recommend defer; not blocking.

### Frontend-design skill convergence guard

**C31 — Brutalist font: NOT Space Grotesk.** Skill warns: "NEVER converge on common choices (Space Grotesk, for example) across generations." Use Archivo Black (body) + Bowlby One (display), or another distinctive pair. Section 1c updated.

**C32 — Audit every preset's typography for AI-slop convergence.** Today's distinctness probe shows 4 presets use Inter, 2 use system-ui — these are exactly the fonts the skill flags as "AI-aesthetic slop." Each preset must commit to an intentional pair.

---

## Sequencing principles

1. **Highest-leverage first.** B14 (shell+paper DOM) closes 4 bugs simultaneously and unblocks ~80% of the visual ceiling per the aesthetic agent. Goes first.
2. **Substrate before presets.** Adding new anchors (B7/B8) before re-pinning presets avoids two rounds of preset edits.
3. **Schema cleanup before refactors.** B10 (declarative `modes`) and B12 (Tier-1 header/title) reduce surface area before the LCH UI work in B9.
4. **Diagnostics decoupled.** B2 (padding runaway) and B3 (studio crash) get their own track — runtime traces, not architectural decisions.
5. **No commits without verification.** Every phase ends with: bun + svelte-check + R suite + visual regression + a specific eyeball check named in the phase.

### Discipline rules added after agent review

6. **Every substrate PR ships its author surface in the same commit** (UX agent). No "add token now, expose later." That pattern produced `theme-runtime.css` as dead code (B13). Concretely: B7 must include `AnchorControls.svelte` 5th row; B8 must include a ThemeControlsStrip toggle; B17 must include an IA placement decision.
7. **R+TS atomic landing for every wire-touching pass** (API agent). Parity tests pin field sets — landing TS without R (or vice versa) breaks parity in the intermediate commit.
8. **CSS selector verification gates Pass 1a.** Before the DOM wrap lands, every selector in `theme-runtime.css` must be proven to match the new DOM (browser console + computed-style check). Pass 0 prework makes this provable.
9. **Atomic decisions are recorded inline.** Every "decision needed" item gets resolved before the relevant pass starts; not after.

---

## Pass 0 — DOM prework (NEW, added after agent review)

Goal: make Pass 1a safe by rewriting fragile selectors and locking the DOM-wrap shape against the actual CSS targets.

**Why this exists**: aesthetic + API agents found that `theme-runtime.css` selects `.tabviz-scope` / `.tv-shell` / `.tv-paper` with `data-shell-*` attributes on the SCOPE. Today tabviz emits `.tabviz-container`. Without reconciliation Pass 1a is a no-op. UX agent found 10 `:global(.tabviz-container > X)` direct-child selectors in `ControlToolbar.svelte` + `AspectLockPill.svelte` that silently break when a wrapper appears.

### 0a. Selector inventory + rewrite

Steps:
1. `grep -rn ":global(.tabviz-container\b" srcjs/src/` and rewrite every direct-child (`>`) selector to either descendant or `.tabviz-paper > X` (anchored under the new wrap). Files known to break: `ControlToolbar.svelte:85-155` (9 selectors), `AspectLockPill.svelte:88`.
2. Run visual regression — these rewrites must be a **no-op** at the current DOM. If anything changes visually, the rewrite is wrong.
3. Land as a refactor commit. Drift gate / svelte-check / bun all green.

### 0b. Naming decision: `.tabviz-container` → `.tabviz-scope`, or nest them?

Two valid options (decision needed before 1a):
- **(A)** Rename `.tabviz-container` → `.tabviz-scope`. Aligns with `theme-runtime.css`. Touches every consumer reading `.tabviz-container` (R `inst/htmlwidgets/tabviz.yaml`, Quarto skins, downstream Shiny CSS).
- **(B)** Keep `.tabviz-container`, add `.tabviz-scope` as either an alias class on the same node OR a new outer wrapper. Backwards-compat for downstream consumers; more DOM.

Recommend (B) with `class="tabviz-container tabviz-scope"` on the existing root (both classes on the same node — no new DOM, no consumer breakage, `theme-runtime.css` selectors work).

### 0c. Containerref + observer audit

Steps:
1. Enumerate every reader of `containerRef` in `TabvizPlot.svelte`: `reportLayoutMeasurements`, `paintLayoutOverlay`, `dispatchLifecycle` (`widget.root`), ResizeObserver, IntersectionObserver, dnd hit-test, `querySelector[data-display-index]`. Per API agent.
2. Decide canonically: does `containerRef` point at the new outer scope (gets shell padding rect) or the inner paper (clean inner content rect)? Layout math depends on this.
3. Document the choice as a comment at `containerRef = …` declaration.
4. Land as comment-only commit if no actual repointing — or as the repointing commit if needed.

Validation: layout-metrics snapshots, browser overlay test, sizing harness all green.

Risk: medium. Pure surface refactor; no semantic change. If visual regression catches a change, the rewrite was wrong, not the DOM.

---

## Pass 1 — Visual ceiling unblock (highest leverage)

Goal: every effects/shell/texture pin in the substrate becomes observable. Synthwave actually glows, Brutalist actually shows its grid texture, the elevation series produces a real raised-paper card.

**REORDER 2026-06-04 per C6 (aesthetic agent):** within Pass 1 the execution order is `1a → 1d → 1b → 1c → 1e`, NOT the section order below. Rationale: `1a + 1d + 1b` = **brutalist runnable in 3 commits** (texture wrap + Archivo Black/Bowlby One fonts + vermilion stars). This is the "first runnable demo" milestone proving Pass 1 is alive. The heavier 1c (caption chip + brand-gradient resolver per C11/C12) lands after the demo holds. 1e (density_factor pins per D7) lands last. Subsection numbering kept as-is for reference; agents executing should respect the reorder.

**Per C7:** within 1a itself, split CSS injection into 2 commits — first non-backdrop-filter rules (texture + glow + shell-strip), second backdrop-filter (Safari/iOS compositing layer isolation).

**Per C10:** before 1a lands, reconcile the two glow paths. `TabvizPlot.svelte:3077` already has `box-shadow: var(--tv-glow-blur)` on `.row-active-emphasis`. Pass 1a adds `.tv-glow` class. Audit + decide which owns glow; delete the other or scope under a different selector. Otherwise synthwave glows twice.

### 1a. **B14** — shell+paper DOM wrapper + real `theme-runtime.css` import

**The single most important change in the plan.** Per the aesthetic agent: the substrate ships shell/paper/texture/glass tokens, the resolver fills them, but the canonical paint surface is dead-imported. One DOM wrap + one CSS import wires all of it.

**⚠ CORRECTED TWICE — 2026-06-04.** Round 1 used `.tabviz-shell` / `.tabviz-paper` (wrong). Round 2 used `.tabviz-scope tv-shell` on same node (STILL wrong — CSS selectors are descendant `.tabviz-scope .tv-shell`). Round 3 corrected shape below uses 3 nested elements.

Per C4: `theme-runtime.css` uses descendant selectors, not same-node compound. `.tabviz-scope .tv-shell` requires `.tv-shell` to be a child of `.tabviz-scope`. Three-node nesting is required.

Steps:
1. `srcjs/src/svelte/TabvizPlot.svelte` — wrap the existing widget DOM as 3 NESTED elements:
   ```svelte
   <div class="tabviz-container tabviz-scope"
        data-shell-mode={inputs?.shell_mode ?? "flush"}
        data-shell-texture={inputs?.shell_texture ?? "none"}
        data-shell-surface={inputs?.shell_surface ?? "opaque"}>
     <!-- Pass 5a: glass-backdrop blob layer (sibling, behind everything) -->
     {#if inputs?.shell_surface === "glass"}
       <div class="tv-glass-backdrop" aria-hidden="true"></div>
     {/if}
     <div class="tv-shell"
          data-shell-mode={inputs?.shell_mode ?? "flush"}>
       <!-- shell-strip element for brand-gradient seam (lab .shell-strip) -->
       {#if inputs?.effects?.gradient_shell_intensity !== "none"}
         <div class="shell-strip"></div>
       {/if}
       <!-- glow-bearing class for chrome-wide glow (lab .tv-glow) -->
       <div class="tv-paper {inputs?.effects?.glow_intensity !== 'none' ? 'tv-glow' : ''}"
            data-paper-texture={inputs?.paper_texture ?? inputs?.shell_texture ?? "none"}>
         <!-- existing widget DOM (containerRef points HERE for content metrics,
              OR at .tabviz-container for event/measurement anchor — see D2 FLIP -->
       </div>
     </div>
   </div>
   ```
   **D2 LOCKED → OUTER** (per C3): `containerRef` stays at `.tabviz-container` (event/measurement anchor). Add `paperRef = .tv-paper` for content-bounded reads if any new consumer needs the clean rect. **Most existing 17 containerRef consumers stay correct without changes** because they want the event/drag/overlay coordinate origin.

   Why 3 nested elements (not 2):
   - `.tabviz-container`/`.tabviz-scope` carries `data-shell-*` attrs (CSS selector gate)
   - `.tv-shell` is a descendant child so `.tabviz-scope .tv-shell` matches
   - `.tv-paper` is a descendant of `.tv-shell` so paper-only CSS rules don't cascade to shell chrome
   - `.tv-glass-backdrop` is a sibling-before of `.tv-shell` so it sits BEHIND the frosted pane (z-index discipline)
2. Inject `theme-runtime.css` via `<svelte:head>` (`import runtimeCss from "$lib/theme/theme-runtime.css?raw"`).
3. **Verify selector match before declaring victory.** Concretely:
   - `theme-runtime.css:128-141` (texture rules) — selector is `.tabviz-scope[data-shell-texture="grid"] .tv-shell`; **the wrap above satisfies this when `.tabviz-scope` is the parent and `.tv-shell` shares the same node OR is a child.** Audit the rule's structure before committing.
   - `theme-runtime.css:204` (glass blur) — needs `data-shell-surface="glass"` on `.tabviz-scope`.
   - `theme-runtime.css:209` (`.shell-strip`) — needs a child element with class `shell-strip`.
   - `theme-runtime.css:214` (`.tv-glow`) — needs a child element with class `tv-glow`.
4. **Verify resolver emits visible texture color.** Per aesthetic agent: brutalist's `--tv-shell-texture-line` must resolve to a non-transparent color or the grid is invisible. Probe before validating visually.
5. Walk every existing layout dependency: scroll containers, click capture targets, drag handles. Adding a wrapper changes `containerRef` semantics. **Pick one canonical containerRef and audit `measure-row` $effect + `paintLayoutOverlay` + `reportLayoutMeasurements` paths.**
6. Sizing harness regen — `bun test src/export/layout-metrics.test.ts --update-snapshots` (geometry snapshots will move because shell+paper introduces padding).

Validation:
- Visual regression: synthwave's frame glows (gradient seam + glow); brutalist shows grid texture; elevation presets show raised paper shadow.
- Browser repro: open studio, switch to Synthwave — frame glows AND a gradient strip appears between caption and paper. Switch to Brutalist — grid pattern visible AND the table sits in a clean angular shell.
- Confirm B2 (padding runaway) doesn't get worse — the DOM wrap could compound it. Run the local repro fixture before/after.

Risk: medium-high. Widget root DOM is the hottest seam in the codebase. Touches every layout test. **Selector verification is now load-bearing.**

### 1b. **B5** — preset status anchor coverage

Per the cross-preset probe, all 22 presets share identical `STATUS_ANCHOR_FALLBACK` semantics. Brutalist should have its vermilion `*` markers; clinical themes should keep clean semantic palettes; LOTR themes get period-appropriate semantics.

**⚠ CORRECTED TWICE — 2026-06-04.** Round 1 said "match `**` / `***` cell value." Round 2 (UX agent) corrected via C8: significance markers aren't cell values — they live in `<span class="pvalue-stars">` rendered by `CellPvalue.svelte:78` and painted `color: var(--tv-accent)` at line 96. The real fix is a **one-line color swap** on the existing span, gated on `isSignificant` (already computed at `CellPvalue.svelte:23-37`).

Plus per C9: D6 (status theme-scoped) breaks OS-forced HC. Need OS-HC override branch.

Steps:
1. In `srcjs/src/lib/theme/theme-presets-inputs.ts`: add `status: { positive, negative, warning, info }` triples to each preset that wants a distinctive semantic palette. Showcase + LOTR first (highest visual differentiation), journals second.
2. R-side: mirror in `R/themes-*.R` so the wire stays parity-equal.
3. **REVISED:** Add a `significanceColor` option to `col_pvalue` (default `"accent"`, with `"negative"` and `"none"` choices). `CellPvalue.svelte:96` reads it and swaps the `.pvalue-stars` color:
   ```svelte
   <span class="pvalue-stars" style:color={
     isSignificant && options.significanceColor === "negative"
       ? "var(--tv-status-negative)"
       : "var(--tv-accent)"
   }>{stars}</span>
   ```
   Brutalist (and any preset wanting vermilion significance) pins `col_pvalue(..., significance_color = "negative")` in its example fixtures. Substrate default stays `"accent"`.
4. R API mirror: `col_pvalue()` constructor accepts `significance_color` arg. Roxygen updated.
5. **NEW per C9:** Add OS-forced HC override branch. When `inputs.mode === "high-contrast"`, status palette overrides revert to `STATUS_ANCHOR_FALLBACK` (curated HC-safe). One branch in `resolveStatusComputed`.
6. New visual fixture: `tests/visual/pvalue-significance.R` running brutalist + cochrane through a 3-threshold pvalue table.
7. Re-run `tests/testthat/test-parity-themes.R` (KNOWN_DIVERGENCES = empty must hold).

Validation:
- Visual regression: badges in brutalist render vermilion. **AND p-value `**` markers in brutalist render vermilion.**
- Cross-preset probe: status anchors now distinct across 22 (no more single-value `#16A34A` for all).

Risk: low (data change) + low (one renderer wiring). Parity test catches drift.

### 1c. **B15** — brutalist body font

Two-line change. `R/themes-showcase.R`'s `web_theme_brutalist()` pins `fonts.body = "'Inter', ..."`. Lab uses Space Grotesk.

**⚠ CORRECTED 2026-06-04 after frontend-design skill load.** The skill explicitly warns: *"NEVER converge on common choices (Space Grotesk, for example) across generations."* Both prior agent reviews recommended Space Grotesk. Doing what the lab does there is itself a generic-AI-aesthetic anti-pattern.

**Pick something more intentional.** Brutalist candidates that match the aesthetic without converging:
- **Archivo Black** (heavy industrial display)
- **Antonio** (condensed brutalist, very narrow)
- **Public Sans Display** (US-gov inspired, more political)
- **Plus Jakarta Sans** with heavy weight
- A stencil face like **Stencil Std**

Recommend Archivo Black for body + an even heavier display face (e.g. **Bowlby One**) for title/headers. Adds `web_fonts` Google Fonts URLs.

Validation: brutalist preset renders with chunky, geometric body — distinctively NOT Inter. Parity test must still pass.

**Cross-cutting (added per skill):** Apply the same lens to every preset's typography. Today's preset distinctness probe shows lancet/nejm/newsprint all share Georgia (defensible — editorial serif), but tonal/tonal_dark/solarized/solarized_dark/executive all share Inter — generic AI default. Each preset must commit to a font pair that is intentional for its aesthetic.

Risk: trivial code change. Higher discipline cost: requires curating 22 distinctive font pairs.

### 1d. **B17 (PROMOTED from Pass 5)** — caption chip + brand-gradient strip primitives

**Promoted to Pass 1 per aesthetic agent review.** Aurora's signature look IS the gradient strip + "TABLE N" boxed chip. Defer this and Aurora paints a milky frosted rectangle without any of its identity. Brutalist's `01-06` also leans on the chip.

This is net-new substrate work but the agent estimates it's small:
- One Svelte component (`<TabvizCaption>` with chip variant + strip variant)
- One cluster in `component-tokens.ts` (`--tv-caption-chip-{bg,fg,border}`, `--tv-caption-strip-{gradient,height}`)
- One input enum: `effects.caption_style ∈ {"none","chip","stripe"}` (mirrors lab's `engine.jsx` caption shape)
- R API mirror

Wire the `.shell-strip` element added in Pass 1a to consume the strip variant; the chip variant places the "TABLE N" label above title.

Validation:
- Aurora preset (once added) renders with gradient strip + chip.
- Brutalist screenshot's chip becomes reachable.

Risk: medium. Net-new component; new manifest entries; new input enum. But scope is contained.

### 1e. **(D7 LOCKED — lands)** Pin `density_factor` on identity-bearing presets

See Pass 1e detailed section below for the steps.

### 1d. **(deferred)** Don't auto-pin `density_factor` on any preset

Even after B14, the cross-preset probe will still show only 3 distinct row heights. Fine — `density_factor` is an *author* knob (fine-tune from the preset's base), not a *preset* dial. Don't pre-bake (per memory `feedback_dont_pre_bake_defaults`). Document in `wire-audit.md` and move on.

---

## Pass 2 — Substrate vocabulary extensions

Goal: close the lab's input-surface gap (B7, B8, B12).

### 2a. **B7** — add `anchors.ink2` (rubrication ink)

Steps:
1. `srcjs/src/types/theme-inputs.ts` — add `ink2?: OklchTriple` to `ThemeAnchors`. Optional; defaults absent.
2. `srcjs/src/lib/theme/resolve-theme.ts` — branch the accent ramp seed: `const accentAnchor = inputs.anchors.ink2 ?? inputs.anchors.accent ?? inputs.anchors.brand`. Mirror lab's `engine.jsx:322-326`.
3. R-side: add `anchors_ink2_L/_C/_H` slots to `ThemeInputs` S7 class; `set_anchor(theme, "ink2", ...)` modifier; `theme_inputs_to_json()` emission.
4. Add 1-2 presets that lean on it: `ledger` (oxblood rubrication) as a new editorial preset OR extend `brutalist` to use ink2 for `**`.
5. Document the role: ink2 seeds the accent ramp; `accent` (when also set) is engagement. Reflect in CLAUDE.md "Wire naming convention" section.

Validation:
- Parity test (`test-parity-themes.R`) — KNOWN_DIVERGENCES still empty.
- Existing presets don't change behavior (ink2 defaults absent).
- New ledger preset renders with rubrication.

Risk: medium. Wire-format addition (additive, no break). Touches both runtimes.

### 2b. **B8** — add `inputs.alias_neutral_to_brand`

Steps:
1. `srcjs/src/types/theme-inputs.ts` — add `alias_neutral_to_brand?: boolean` (default false).
2. `srcjs/src/lib/theme/resolve-theme.ts` — `buildRamps` branch: when true, run `lerp(aliasHue.C * 0.18, aliasHue.C * 0.62, t)` on neutrals using brand's H. Per `engine.jsx:82-89`.
3. R: mirror slot + setter.
4. Add a `terminal` preset (phosphor green monochrome) to showcase the toggle.

Validation:
- Terminal preset is monochrome with a single brand-hue control. Substrate verified visually.

Risk: medium. Resolver branch; additive.

### 2c. **B12** — promote header/title styles to Tier-1

**SPLIT after API + aesthetic agent review.** Original draft conflated additive substrate work with breaking-change consumer migration. The two need separate commits. Also, the plan as written missed the `::before` title-bar primitive and continuous-band semantics (header fill connecting to group rows) per aesthetic agent — those are added to 2c-ii below.

Replaces tasks #72/#74's v3-bridge approach. Lab treats these as first-class effects inputs (`engine.jsx:223-224, 555-571`).

#### 2c-i. Add new Tier-1 inputs (additive, no break)

Steps:
1. `srcjs/src/types/theme-inputs.ts` — add `effects.header_style ∈ {"normal","tint","fill"}` and `effects.title_style ∈ {"normal","bar","underline"}`.
2. `srcjs/src/lib/theme/resolve-theme.ts` — add `resolveHeaderVariantComputed` / `resolveTitleVariantComputed` mirroring `engine.jsx:555-571,572-705`. **Including** the continuous-band semantics for `fill` (header bg flows into group rows; tabviz needs to emit a token like `--tv-header-fill-continuous` that group-row selectors can consume).
3. New manifest entries that emit values matching what the v3 bridge produces today (no behavior change yet — Pass 2c-ii migrates consumers).
4. R: mirror inputs (`effects_header_style`, `effects_title_style`) + R `set_effects()` accepts them. **Atomic R+TS commit per discipline rule 7.**
5. UX surface: ThemeControlsStrip's Effects category gets a "Header style" segmented control + "Title style" segmented control. **Same commit per discipline rule 6.**
6. New `::before` title-bar primitive: when `effects.title_style === "bar"`, the title row gets a CSS `::before` accent stripe per `lab.css:278`. Net-new CSS in `theme-runtime.css`; verify it fires after Pass 1a's wrap.

Validation:
- Existing presets emit unchanged `--tv-header-bg/fg/rule` values (no visual regression).
- New `effects.header_style` controls in studio work.
- Title-bar primitive fires when set.

Risk: medium. Additive only; existing field `variants.headerStyle` stays on the wire.

#### 2c-ii. Migrate consumers + retire `variants.headerStyle`

Steps:
1. Audit every consumer of `variants.headerStyle` and `variants.firstColumnStyle`: per API agent, `TabvizPlot.svelte:2708-2709` reads `var(--tv-header-bg/fg)`, `LayoutControl.svelte:232` binds UI, `R/utils-serialize-resolved.R:124` emits the v3 field, `R/classes-theme.R::header_style` slot. Drift gate misses these because CSS fallback chains silently degrade.
2. Migrate each consumer to read `effects.header_style` instead.
3. Drop `variants.headerStyle` and `variants.firstColumnStyle` from wire (`spec/index.ts`) — wire-bump tracked in Pass 6.
4. Delete v3 bridge for `--tv-header-bg/fg/rule` and `--tv-first-col-*` from `theme-css.ts`.
5. Migrate presets to use the new inputs (synthwave underline title; brutalist bar title + fill header; etc.).
6. Re-run `tests/testthat/test-parity-themes.R`. KNOWN_DIVERGENCES = empty must hold.

Validation:
- KNOWN_UNCONSUMED shrinks by ~6-10 entries.
- v3-bridge sentinel count drops.
- All 22 presets visually equivalent or improved.

Risk: HIGH. Breaks wire compat. Coordinated with Pass 6 wire bump.

---

## Pass 3 — Schema cleanup

Goal: reduce manifest debt the API agent flagged ("the schema over-engineered the schema while still being incomplete").

### 3a. **B10** — declarative `modes:{hc,rt}` consumption (LAYER B ONLY)

**SCOPED HONESTLY after API agent review.** Original draft claimed "no HC-behavior code outside `resolveTokenValue`" — that's unreachable. `resolve-theme.ts:248-274` already documents that only Layer B of HC behavior is migratable. Layers A (role-binding +2 grade push), C (HC fidelity tokens with value substitution), D (geometry hcBump) cannot collapse into per-token `modes` declarations because their semantics aren't per-token.

**Honest goal:** migrate Layer B only. Layers A/C/D stay inline with explicit comments documenting why they can't be declarative.

Steps:
1. Audit `resolve-theme.ts:248-274` — confirm Layer B's `applyHcGradePush` and `HC_PUSH` are the only inline-but-migratable logic.
2. Migrate those (and ONLY those) to driven dispatch on `token.modes.hc.{drop,swap}` / `token.modes.rt.{drop,swap}`.
3. Add explicit code comments at Layers A/C/D explaining why they stay inline (per the existing docstring).
4. Verify the existing manifest's `modes` annotations are correct for Layer B tokens (some may need adjustment).

Validation:
- HC mode rendering unchanged on all 22 presets (visual regression).
- Layer B is gone from the inline switch.
- Layers A/C/D inline logic has comments justifying it.

Risk: medium. Resolver core. Visual regression is the safety net.

**Out of scope:** A full HC declarative migration would require rethinking the role-binding cascade (Layer A) and substantial new manifest grammar for value-substitution (Layer C). Not planned in this audit.

### 3b. **B11** — density enum naming decision

Choices:
- **(A)** Document the lab-vs-tabviz translation table in CLAUDE.md and `theme-cascade-stage-1-design.md`. Zero code change. Authors comparing screenshots get a Rosetta stone.
- **(B)** Rename `comfortable → cozy` in `DENSITY_VALUES`, presets, R API, theme-css.ts. Wire-bump. High blast radius.
- **(C)** Add `cozy` as an alias (both `comfortable` and `cozy` accepted; cozy preferred going forward). Compat-shim debt.

Recommend (A) unless the user wants the rename. Decision needs user input.

Validation: doc-only.

Risk: trivial / (B) high.

---

## Pass 4 — Authoring surface

### 4a. **B9** — LCH-native studio anchor controls

Steps:
1. `srcjs/src/studio/AnchorControls.svelte` — replace the per-anchor row with `playground.jsx::ColorAnchor`-style 3-slider layout: L/C/H sliders inline + hex sibling control.
2. Existing OklchPicker dialog stays as the deep-dive editor (eyedropper / 2D field).
3. Real-time cascade-re-resolve must hold (no fps regression).

Validation:
- Manual UX walkthrough: open studio, change `anchors.paper.L` via slider, watch table re-paint.

Risk: low-medium. Self-contained studio component.

---

### 4b. **(NEW per C15)** Bi-directional cascade trace — hover/click widget cell → light up tokens

Goal: realize the lab's signature pedagogy (`01-Y1-states.png`). `inspectorStore.trace` already exists; today only CascadeView pedagogical widgets call it. The widget cells never do.

Steps:
1. Each `srcjs/src/components/table/Cell*.svelte` (14 files) adds `data-trace-tokens` attribute on its root element carrying the cssVars it consumes (e.g. `data-trace-tokens="--tv-cell-fg,--tv-cell-border"`).
2. Click handler on `.tv-paper`: walks `event.target.closest('[data-trace-tokens]')`, splits the attribute, calls `inspectorStore.trace(firstVar, resolvedTheme)`.
3. CascadeView's panel highlights the matching token + traces its provenance per existing one-way trace.
4. Visual fixture: studio with a `data-trace-tokens` overlay enabled in dev mode.

Validation:
- Click any cell in the studio → CascadeView highlights its tokens.
- No regression to existing studio-only click-to-trace.

Risk: medium. Touches 14 Cell components but each change is mechanical.

### 4c. **(NEW per C16)** Onboarding chrome + ARIA

Steps:
1. Every Tier-1 category in `ThemeControlsStrip.svelte` gets a `<button class="hint">?</button>` next to the header. Click/hover → one-sentence tooltip reusing roxygen `@param` text from `R/themes-api.R`.
2. New tabbed rail (D5) implements ARIA Authoring Practices tablist pattern: `role="tablist"`, `role="tab"`, `aria-controls`, `aria-selected`, arrow-key nav.
3. Tooltip texts curated for: Color / Type / Size / Shell / Effects + sub-controls.

Validation:
- Studio screen-reader navigation works (axe-core or manual NVDA/VoiceOver pass).
- Tooltip click → tooltip visible.

Risk: low. Pure UX chrome.

### 4d. **(NEW per C17)** `tint_from_brand()` macro

Closes the 25-knob fan-out trap when an author wants "everything tinted from one brand color."

Steps:
1. R modifier `tint_from_brand(theme, strength = c("subtle", "medium", "vivid"))` nudges paper/ink/accent/ink2 H toward brand H without changing L. Uses OKLCH math.
2. Studio: "Match brand" button at top of Color tab; clicking it applies the modifier visibly (with undo).
3. Example block in `?web_theme` showing the workflow.

Validation:
- After clicking "Match brand," all anchor swatches shift H toward brand; L unchanged.

Risk: low.

---

## Pass 5 — Net-new substrate (revised after Round 2 review)

Aesthetic agent identified 4 lab visual moves the plan misses entirely. Adding them here; B17 was promoted to Pass 1c.

**8 net-new manifest tokens (per C18) enumerated explicitly:**
- `--tv-glass-tint` (color base for the frosted pane background)
- `--tv-glass-faint` (color for inner hairline + 1px border)
- `--tv-glass-edge-hi` (color for top specular bevel)
- `--tv-glass-edge-lo` (color for bottom thickness bevel)
- `--tv-glass-sheen` (color for `::before` diagonal sheen overlay)
- `--tv-glass-shadow` (CSS shadow stack for floating drop shadow)
- `--tv-glow` (general chrome-wide glow token, distinct from `--tv-glow-brand-color`)
- `--tv-brand-gradient` (NEW resolver path emitting multi-stop gradient string per C11)

Each token needs a manifest entry + resolver path. All keyed off existing anchors (brand for gradient/glow; paper-derived for glass-tint/faint/edge variants).

### 5a. **Glass-backdrop blob layer** (per C19)

Lab `.glass-backdrop` (`lab.css:151-160`) is a **4-stop radial gradient** layered on `--surface-base` using brand ramp `_9/_7` stops, with `inset: -2px` overshoot for edge bleed and `pointer-events: none` discipline. Without it, Aurora and Glass-Light themes render as flat milky rectangles.

Plus per C20: lab's frosted pane has `backdrop-filter: blur(N) saturate(1.9) brightness(1.06)`. Tabviz `theme-runtime.css:205` only has `blur saturate(1.5)`. **The brightness lift is the difference between "fog" and "lit pane."** Both deltas land in 5a.

Steps:
1. Add `<div class="tv-glass-backdrop" aria-hidden="true">` as sibling-before of `.tv-shell` in Pass 1a's wrap (already shown in the corrected 3-nested-element snippet above). Z-index: behind everything.
2. CSS: `.tv-glass-backdrop` paints when `data-shell-surface="glass"` on `.tabviz-scope` ancestor. Background: `radial-gradient` 4-stop using `var(--tv-glass-backdrop-blobs)` token.
3. Resolver path: `--tv-glass-backdrop-blobs` emits a 4-stop gradient string using brand ramp grades 7 and 9, accent grade 9 if accent is set, plus brand grade 7.
4. Manifest entry: `--tv-glass-backdrop-blobs` (`tier: "computed"`).
5. Add `effects.glass_backdrop ∈ {"none","aurora","subtle"}` input — when "none" the backdrop element doesn't render; when "subtle" the gradient stops are at lower chroma; "aurora" is the lab's default.
6. R API mirror.
7. Update `.tv-paper` rule: `backdrop-filter: blur(var(--tv-glass-blur, 16px)) saturate(1.9) brightness(1.06)` — three filters, not one.
8. Add `.sci-paper { backdrop-filter: none }` (the paper-inside-glass double-blur defense per #1 in the "10 visual moves still impossible" list).

Risk: medium-high. Net-new DOM + CSS + manifest + input enum + R API.

### 5b. **Diagonal specular sheen on glass** (per C22)

Lab `.widget-frame.glass::before` (`lab.css:188-194`) paints **two gradients**:
- `linear-gradient(148deg, ...)` (the specific 148° angle is non-negotiable; it matches the lab's preferred "viewer above-left" specular)
- `radial-gradient(80% 40% at 50% -10%, ...)` (the off-canvas radial gives the sheen a focal point)
- Combined with `opacity: 0.9` and `z-index: -1`.

Pure-CSS addition to `theme-runtime.css`. Both gradients use the new `--tv-glass-sheen` token (1 token, but the rule uses it twice).

Risk: low.

### 5c. **Inset bevel shadow stack on glass** (per C21)

Lab paints **4 layered shadows** on `.glass` (`lab.css:180-184`):
1. `var(--glass-shadow)` — the floating drop shadow (uses `--tv-glass-shadow`)
2. `inset 0 1px 0 var(--glass-edge-hi)` — top specular highlight (uses `--tv-glass-edge-hi`)
3. `inset 0 0 0 1px var(--glass-faint)` — inner hairline (uses `--tv-glass-faint`)
4. `inset 0 -1px 0 var(--glass-edge-lo)` — bottom thickness (uses `--tv-glass-edge-lo`)

Without all 4, the pane reads as a blurry rectangle. CSS-only emit; uses the 4 tokens defined in the enumeration above.

Risk: low.

### 5d. **Caption-chip cluster expansion** (per C23, scope-limited)

B17 promoted to Pass 1c already delivers the caption-chip primitive Svelte component + its base manifest cluster. **Pass 5d is ONLY the variant catalog extension** (compact chip / full strip / accent-rule between them). Does NOT ship a separate Svelte component — extends 1c's component with variant props.

Plus per C12: caption chip needs `box-shadow: var(--glow)` halo. Without it the chip is flat. Add to 1c's manifest cluster:
- `--tv-caption-chip-shadow` token (default `var(--tv-glow)`)
- Chip rule: `box-shadow: var(--tv-caption-chip-shadow)`

Risk: low — extends existing 1c primitive.

### 5e. **Add Blueprint + Sunprint presets (per C25)**

Lab ships 7 named presets in screenshots: Ledger, Brutalist, Aurora, Terminal, Blueprint, Sunprint, Synthwave. Tabviz has Brutalist + Synthwave already. Pass 2a/2b add Ledger + Terminal + Aurora. **Pass 5e adds Blueprint + Sunprint** — both editorial print-inspired themes that lean on `--tv-shell-texture-ruled` (Blueprint = navy paper + grid texture + monospace; Sunprint = cyanotype blue paper + Helvetica + dramatic accents).

Each preset goes in `srcjs/src/lib/theme/theme-presets-inputs.ts` + `R/themes-showcase.R` + `package_themes()` showcase category + the studio's switcher (which already auto-picks them up from `THEME_NAMES`).

Risk: low (data-only).

---

**Note (per UX agent):** Pass 5 substrate additions MUST ship surfaces. No "add backdrop blob now, expose later." If we can't budget the studio surface, we don't land the substrate.

---

## Pass 6 — Wire version lock + parity-set bump (SPLIT after Round 2 review)

**REORDER per C5**: 6a moves BEFORE Pass 2 substantive work; only 6b/6c run at the end. Otherwise parity test stays red through Passes 2-3.

### 6a. Schema slots first (runs BEFORE Pass 2)

Goal: open R-side S7 slots with defaults so Pass 2's TS field additions don't break parity instantly.

Steps:
1. Add R S7 slots for the new fields on the `ThemeInputs` / `ThemeAnchors` / `ThemeEffects` classes:
   - `anchors@ink2_L`, `anchors@ink2_C`, `anchors@ink2_H` (NA defaults)
   - `monochrome` boolean (default FALSE)
   - `effects@header_style`, `effects@title_style` (default "normal")
2. Set defaults so existing presets construct unchanged.
3. Extend `R/utils-serialize.R::theme_inputs_to_json()` to emit the new fields when set (omit when default).
4. Extend `KNOWN_DIVERGENCES` allowlist in `tests/testthat/test-parity-themes.R` for the **transitional period only** — entries like `c("effects.header_style", "effects.title_style")` get removed in 6b once both sides emit.
5. Run R suite — must stay green at this commit.

Risk: low. Pure schema addition with defaults.

### 6b. Wire bump + parity sync (runs AFTER Pass 2/3 substantive work)

Steps:
1. **Bump `CURRENT_VERSION`** in `srcjs/src/spec/index.ts` from `"1.2"` to `"1.3"`. Single bump.
2. **Update `R/wire-version.R::WIRE_FORMAT_VERSION`** to match.
3. Confirm `srcjs/src/spec/v1.0.json` doesn't need a rename (per CLAUDE.md `additionalProperties: true` policy, minor bumps reuse the same file).
4. **Drain `KNOWN_DIVERGENCES`** from 6a's transitional allowlist. Parity test must pass with the full field set including `ink2`, `monochrome`, `effects.header_style`, `effects.title_style`.
5. **Round-trip test**: construct a theme with every new input set, serialize R → V8 → R, assert preservation.
6. Re-run `test-wire-version.R` (enforces R↔TS constant match).

Risk: medium. Parity-allowlist drain is the load-bearing step.

### 6c. Downstream notice + discoverability

Steps:
1. **Update NEWS.md** — covering DOM change from Pass 0/1a (downstream Shiny CSS may need updates), new anchor `ink2`, new `monochrome` boolean, `effects.header_style`/`effects.title_style`, `set_status_palette()`, `significance_color` arg on `col_pvalue`.
2. **Roxygen `@seealso` cross-refs** (per C29):
   - `?set_status` → `@seealso set_status_palette`
   - `?set_status_palette` → `@seealso set_status`
   - `?web_theme` `@examples` block per C28 with worked rubrication example (B7 ink2)
3. **Optional Pass 6d (deferred)**: localStorage persistence of last-N studio-store inputs keyed by base preset. Per C30 — defer to post-V4 backlog OR include if time permits.
4. `R CMD check --as-cran` clean.

Risk: low (docs only).

---

## Diagnostic track (NOT parallel per C26)

**REVISED 2026-06-04 per C26:** D1 is gated on Pass 1a landing, not parallel. The DOM wrap adds `--tv-shell-padding` and `--tv-paper-padding` between `.tabviz-container` and existing chrome consumers — padding compounds multiplicatively. Run D1 probe **after** 1a + before 1b, with a hard stop if any preset's padding grows >20%.

### D1. **B2** — group-padding runaway

Steps:
1. Repro in studio (any color change triggers it per user).
2. Browser DevTools — watch `theme.spacing.rowGroupPadding` across a single change.
3. If accumulates, trace the writer. If not, the symptom is in the layout `$effect` chain → measured row heights → ...

### D2. **B3** — studio color-change crash

Steps:
1. Repro. Capture stack trace.
2. Likely path: `previewThemeField` → `writeThemePath` → cascade re-resolve → some derived state hits a null path.

Both diagnostic items can run in parallel with the architectural passes.

---

## Locked decisions (2026-06-04)

All 9 decisions answered by user. Locked here for executor reference.

| # | Decision | Locked answer |
|---|---|---|
| **D1** | `.tabviz-container` ↔ `.tabviz-scope` | **Sibling class on same node.** `class="tabviz-container tabviz-scope"` on existing root. Zero new DOM, zero consumer breakage. |
| **D2** | `containerRef` outer or inner | **OUTER (`.tabviz-container`/`.tabviz-scope`).** ~~Inner (.tv-paper)~~ FLIPPED 2026-06-04 per Round 2 review (C3): containerEl is also click/keyboard target for paint mode AND dnd hit-test root + overlay coordinate origin; inner shrinks drop zone silently. Add `paperRef = .tv-paper` if any consumer needs the clean content rect. |
| **D3** | Monochrome boolean name | **`monochrome`** (drops rgc parity on the name for discoverability). |
| **D4** | `set_status` override semantics | **Per-slot override (existing) + new `set_status_palette(theme, palette = list(...))` convenience** for atomic clobber. Both verbs available. |
| **D5** | Studio rail | **Move Color to its own tab.** Right rail becomes tabbed (Color / Effects / Typography / ...). More IA work; each tab gets full real estate. |
| **D6** | Status anchor scoping | **Theme-scoped, documented.** Switching themes changes semantic palette (brutalist vermilion vs clinical green is identity-bearing). Document in `?set_status` + ship the significance-marker convention so the user perceives it as identity-driven. |
| **D7** | Pass 1e (`density_factor` on presets) | **Lands.** density_factor is identity-bearing for some presets (per refined `feedback_dont_pre_bake_defaults` memory: "if a knob's value identifies the preset, pin it"). Pin density_factor on the presets where it matters (atelier may want compact-but-not-too-compact; brutalist wants dense). |
| **D8** | Density enum naming | **(A) Document the translation table.** Zero code change. tabviz `comfortable` = lab `cozy` (middle); tabviz `spacious` = lab `comfortable` (relaxed). Document in CLAUDE.md + theme-cascade docs. |
| **D9** | Pass 5 scope | **Land all 4** (5a glass-backdrop + 5b sheen + 5c bevel + 5d caption-chip variants). Aurora becomes truly reproducible. Largest substrate addition in the plan. |

---

## Pass 1e — Pin `density_factor` on identity-bearing presets (NEW per D7)

Per D7: density is part of theme identity for some presets.

Steps:
1. Audit each preset's intent vs the discrete density preset. Cases where `density_factor` would help:
   - `atelier` — compact-but-not-too-compact (currently 18px row; might want 19-20px with density_factor)
   - `brutalist` — wants dense; might want density_factor = 0.85 on top of `compact`
   - `executive` — wants comfortable-but-airy; density_factor = 1.1
2. R-side `web_theme_X()` constructors pin density_factor.
3. TS-side `theme-presets-inputs.ts` mirrors.
4. Cross-preset distinctness probe should show more than 3 distinct row heights after.

Validation:
- Probe shows 5-8 distinct row heights.
- Parity test green.

Risk: low (additive). Visual regression catches anything off.

---

## Validation gates (every pass must pass)

1. `cd srcjs && npm run check` — 0 errors / 0 warnings
2. `cd srcjs && bun test` — 1231+ pass / 0 fail
3. `Rscript -e 'devtools::test()'` — all green
4. `Rscript -e 'devtools::load_all(); render_visual_tests()` — 60+ visual fixtures green (or intentional diffs reviewed)
5. `cd docs && quarto render index.qmd && quarto render studio.qmd` — both render without errors
6. Eyeball: the specific phase-named manual check (e.g. "open studio, switch to Synthwave, confirm glow")

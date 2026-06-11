# Decision register

Status: **living ledger** (stood up 2026-06-10). The tidy-keeping half of
`docs/dev/ship-roadmap.md`.

**The rule:** any work that defers a product decision MUST add an entry
here instead of deferring silently. Every entry carries a
**default-if-undecided** — what ships if nobody decides — and a
**decide-by** milestone. At each milestone review, entries due are decided
(moved to the Decided section with a one-line rationale) or explicitly
re-dated. The register must be empty of pre-1.0 rows at ship.

Entry format: `ID | question | options | default if undecided | decide by`.

## Open

| ID | Question | Options | Default if undecided | Decide by |
|----|----------|---------|----------------------|-----------|
| D2 | Six authored-but-ignored column options: `range:showBar`, `viz_bar:{barWidth,barGap,orientation}`, `viz_boxplot:{boxWidth,whiskerType}` — wire or delete (incl. R args + types + emit defaults)? | wire each / delete each | delete all six (unread knobs violate the honesty rule; plausible features can return post-1.0 with readers) | M1 (column ontology, pre-wire-freeze) |
| D3 | Elevation shadow tokens (`--tv-shadow-raised/overlay-near/-far`): emitted, resolver-wired, zero consumers — does `effects.elevation` actually paint, and through what? | (a) wire DOM+export through the tokens; (b) simplify elevation to the one consumed shadow | investigate first (cheap); then (a) if elevation is a real shipped effect | M2 (WYSIWYG area) |
| D4 | Portaled popovers (zoom dropdown etc. portaled to document.body) cannot inherit container-scoped `--tv-*` vars → chrome renders fallback-slate on themed pages | (a) copy cssVars onto portal nodes; (b) accept + standardize the neutral chrome palette | (b) accept for 1.0 (consistent neutral chrome is defensible); revisit if dark-theme adoption makes it ugly | M2 (UX area) |
| D5 | Row-height pins: per-KIND only (current) vs adding per-ROW pins | keep per-kind / add per-row layer | keep per-kind (measure loop covers per-row overflow; decided in interactivity arc — re-confirm at ship) | M3 |
| D6 | Keyboard column reorder (expensive, rarely exercised) | build / ship without + document gap | ship without, documented | M2 (a11y) |
| D7 | Pagination-export contract: export renders ALL rows while the widget shows a page | (a) document "export = whole table"; (b) export current page; (c) export option | (a) document — likely the right semantic; needs a sentence in save_plot docs + WYSIWYG exception list | M2 (WYSIWYG) |
| D8 | Estimator-vs-canvas column widths on raw `generateSVG` (Δ up to ~30px/col; real flows mitigated by systemfonts injection + live widths) | (a) accept + document as boundary; (b) invest in estimator accuracy; (c) ship a font-metrics table for common stacks | (a) accept + document for 1.0 | M2 (WYSIWYG) |
| D9 | Conservative-everywhere interaction defaults: re-confirm the baked ON/OFF split before ship (the "decide defaults late" rule comes due) | keep / adjust per flag | keep current split | M3 |
| D10 | Group-header banding scope + chevron indent: DOM bands group-header rows and aligns data rows WITH the shifted label; export does neither | align export to DOM / align DOM to export / document | align export to DOM (DOM is the designed truth) | M2 (WYSIWYG) |
| D11 | Column-option `consumedBy` annotation arc (115 grandfathered options) | schedule as one arc / chip per-arc | one dedicated arc inside roadmap area C | M1 |
| D12 | Default-paginate threshold value (rows) | pick N + breakOn defaults | propose 200 rows, break on group | M3 (scale posture) |
| D16 | Settings panel inherited Tier1Sections' real tab bar (`role=tablist`, content-switching) — the settings-overhaul lock says "tabs die, single-scroll + sticky section flags". Regression shipped while interaction-qa was broken. Restore the lock or amend it? | (a) settings host renders Tier1Sections in single-scroll mode (nav → jump-links); (b) amend the lock: tabs are fine in the panel | (a) restore single-scroll (the lock had reviewed rationale; the studio keeps its tabs) | M2 (UX, area F) |
| D15 | Export title-block arithmetic vs DOM caption block: ≤8px density-correlated offset on display-type themes (headerBand.top — wysiwyg gate, 2026-06-10) | (a) mirror the DOM caption-block layout exactly in computeLayout (title pad 0.15rem, subtitle border+padding chain, measured line boxes); (b) accept ≤8px as a budgeted exception | (b) budgeted at 8px (encoded in GATE_EXCEPTIONS with this ID); fix via (a) when area G lands | M2 (WYSIWYG, area G) |
| D13 | `enable_themes = "default"` ships all 9 resolved presets on EVERY widget wire (weight + chrome) — right default for 1.0? | keep / trim roster on wire / lazy-load presets | keep, but measure wire weight first (serialize-weight gate exists) | M3 |
| D17 | Role-roster naming review for the component model: keep current names (`text`, `text-muted`, `regular`, …) or rename for legibility (`text-main`, `wgt-normal` style)? ONE vocabulary either way — renamed in place pre-freeze (aliases migratable), never a parallel set | keep / rename (which subset?) | keep current names; revisit only names that prove confusing in the Stage-2 UI | M1 (area E Stage 1 — names ship on the W6 wire) |

## Decided

| ID | Decision | Rationale | Date |
|----|----------|-----------|------|
| D1 | HC-fidelity vertical KILLED (rules + `--tv-hc-*` tokens + resolver group + test deleted) | Designed but never wired to any markup; the a11y floor (roadmap J) lands without it — HC mode's live behavior (wash drops, border bump, contrast re-resolve) is untouched | 2026-06-10 |
| D14 | `theme_blend()` + SplitForest static-knit path CUT from 1.0 scope | Neither is started; neither blocks the 1.0 identity; post-1.0 backlog | 2026-06-10 |

## Process notes

- The register is for PRODUCT decisions (behavior, scope, defaults), not
  engineering choices an arc can settle locally.
- "Default if undecided" is binding: if the decide-by milestone closes
  without a decision, the default ships. This is what makes deferral safe.
- Sources feeding the initial population: interactivity-UX arc deferrals,
  WYSIWYG fidelity pass residuals, 2026-06-10 cleanup audit "kept for
  decision" items, 1.0 strategy locks.

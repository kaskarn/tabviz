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
| D9 | Conservative-everywhere interaction defaults: re-confirm the baked ON/OFF split before ship (the "decide defaults late" rule comes due) | keep / adjust per flag | keep current split | M3 |
| D15 | Export title-block arithmetic vs DOM caption block (headerBand.top, ≤8px budgeted) | (a) mirror DOM exactly; (b) keep budgeted | (b) STANDS, with a 2026-06-11 investigation note: the DOM chain decomposes as 12 top-pad + title×1.3 + 0.15rem title pad + (border1+pad12 \| 4px margin) + sub×1.4 + headerGap. Naively ADDING the two "missing" terms to the export OVERSHOOTS (one case hit Δ−10 — the live deltas are NOT a simple missing-term sum; a counter-offset exists, likely browser line-box vs ceil(size×lh) rounding). Reverted; a proper fix instruments per-case line-box measurements in the wysiwyg harness FIRST. Budget 8 remains the contract. | M2 (area G) |


## Decided

| ID | Decision | Rationale | Date |
|----|----------|-----------|------|
| D13 | enable_themes roster: MEASURED (the register's ask) — the resolved 9-preset roster rides interaction.enableThemes at 43.9kB ≈ 88.8% of a small widget's payload. DECIDED: switch to INPUTS-form wire envelopes resolved in-widget (~10× smaller; the widget ships the full resolver). **IMPLEMENTED same day**: serialize_theme_slim emits the roster; ThemeSwitcher expands picks via buildTheme in-widget. Measured: roster 43.9kB → 8.4kB; total widget payload 49.4kB → 14.2kB (3.5×). interaction-qa's real-input theme-switch leg green | UNILATERAL (delegated): the measurement makes keep untenable and lazy-load needless — inputs-form is strictly better on every axis | 2026-06-11 |
| D12 | Default-paginate threshold IMPLEMENTED: NULL past 200 rows auto-paginates (200 rows/page, break on group, once-per-session hint); `paginate = FALSE` is the documented opt-out; explicit specs untouched | UNILATERAL (delegated): the register default applied verbatim; pagination is the honest scale story (the DOM mount degrades before the algorithms do — bench-backed) | 2026-06-11 |
| D17 | Role-roster names KEPT as-is | UNILATERAL (delegated): the names now ship on wire 1.5–1.10 envelopes and the Stage-2/3 UI displays them daily without complaints surfacing; renaming would break existing envelopes for marginal legibility | 2026-06-11 |
| D3 | `effects.elevation` KEPT (it paints — shell-paper consumes it as figure-wide depth, decided 2026-06-05); the four orphan `--tv-shadow-raised/overlay-*` tokens + the elevation resolver group + the orphaned elevation.ts module DELETED | UNILATERAL (delegated): option (b) — the honesty rule (D2/D11 precedent); the quartet had zero consumers and TODO flags | 2026-06-11 |
| D4 | Portaled-popover neutral chrome ACCEPTED for 1.0 | UNILATERAL (delegated): default (b) — consistent neutral chrome is defensible; revisit on dark-theme adoption feedback | 2026-06-11 |
| D5 | Row-height pins stay PER-KIND only | UNILATERAL (delegated): re-confirmed — the measure loop covers per-row overflow; no new evidence since the interactivity arc | 2026-06-11 |
| D6 | Keyboard column reorder: SHIP WITHOUT, documented gap | UNILATERAL (delegated): default — expensive, rarely exercised; the a11y floor (area J) ships without it | 2026-06-11 |
| D7 | Pagination-export contract: EXPORT = WHOLE TABLE, documented | UNILATERAL (delegated): default (a) — the right semantic (a figure is the dataset, a page is a view); needs the save_plot docs sentence + WYSIWYG exception-list line when area G writes them | 2026-06-11 |
| D8 | Estimator-vs-canvas widths on raw generateSVG: ACCEPTED + documented as boundary | UNILATERAL (delegated): default (a) — real flows are mitigated (systemfonts injection, live widths); the gate budget carries this ID | 2026-06-11 |
| D10 | Group-header banding/chevron: VERIFIED ALIGNED by measurement (2026-06-11) — a new permanent matrix metric (groupLabel.x, DOM post-chevron vs SVG text x) agrees within 1.5px across all 12 cases; the export's banding coordination already exists (renderGroupHeader's renderBackground handshake). The 2026-06-10 premise was closed by the intervening WYSIWYG pass + W4 ports. The probe guards regressions from here. | UNILATERAL (delegated): measurement preempted implementation | 2026-06-11 |
| D16 | Settings panel single-scroll RESTORED + IMPLEMENTED: compact layout renders all four sections in one scroll with the bar as sticky jump-links (role=navigation); the studio (roomy) keeps real tabs; the liveness harness rewritten for the new IA — 70 controls verified live (up from 68), reset gutter green | UNILATERAL (delegated): default (a) — the settings-overhaul lock had reviewed rationale | 2026-06-11 |
| D18 | Title color bound to role `text` (option a); the last text-cluster bridge row deleted | UNILATERAL (user-delegated 2026-06-11, flagged for review): the v3 value was the raw ink ANCHOR — pre-cascade special-casing, not a role; deltas vs `text` are small (spot-rendered nejm + terminal: coherent); brand-text would re-identity all 9 presets; a new role for one consumer bloats the curated roster. Chromatic titles stay one re-route away. | 2026-06-11 |
| D11 | consumedBy annotation arc EXECUTED as one dedicated arc: all 119 grandfathered rows cleared (annotated against verified consumers, or deleted as dead — found currency:symbol/position dead editor menus + viz_violin:maxWidth) | The sweep itself caught 3 more dead options — exactly the audit dividend the one-arc approach promised | 2026-06-11 |
| D2 | The 6 authored-but-ignored column options DELETED (`range:showBar`, `viz_bar:{barWidth,barGap,orientation}`, `viz_boxplot:{boxWidth,whiskerType}`) — schema rows, typed fields, authoring args (TS + R), emit defaults, docs, drift-gate grandfather rows | Register default applied at M1: unread knobs violate the honesty rule; renderers compute these locally (VizBar hardcodes its own gap) and never read the options; plausible features can return post-1.0 WITH readers | 2026-06-11 |
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

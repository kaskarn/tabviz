# Wire-freeze inventory (roadmap M0-C0)

Status: stood up 2026-06-10. Wire is at **1.4**; pre-release policy =
clean breaks allowed. At the M3 freeze the policy flips to additive-only
minors, so every BREAKING wire-shape change must land before it. This is
the schedule. (Additive changes can land any time; they're listed only
when they're load-bearing for a roadmap area.)

Sync points when touching the wire: `R/wire-version.R` ↔
`srcjs/src/spec/index.ts::CURRENT_VERSION` (gate `test-wire-version.R`),
`SHINY_EVENT_FIELDS` ↔ `TABVIZ_STATE_FIELDS`, parity tests.

## Breaking — must land pre-freeze

| Item | What changes | Driver | Scheduled |
|---|---|---|---|
| W1 | Delete the 6 dead column options (`range:showBar`, `viz_bar:{barWidth,barGap,orientation}`, `viz_boxplot:{boxWidth,whiskerType}`) — schema rows, typed fields, authoring defaults, R `col_*` args | Register D2 (default: delete) | M1, area C (column ontology review) |
| W2 | Column-ontology review fallout: any option renames / vocabulary harmonization / `kind` reclassification discovered in the area-C review | Roadmap area C | M1, area C — the review must explicitly emit its wire-change list |
| W3 | `variants.headerStyle` retirement (superseded by the `header_style` input; still emitted on the wire per the wire-audit backlog) | Wire-audit leftover | M1 (cheap; fold into the next theme-wire touch) |
| W4 | v3-legacy `WebTheme` blob slimming: `ResolvedInputs` v3 fields emitted with no readers; theme-css user-config bridges (#72–#74 borders/firstColumn/container/header clusters) — decide manifest-migrate vs keep-as-bridge, then delete the dead emissions | v3→v4 cutover backlog | M2 latest (touching it later means a major bump) |
| W5 | `initialState.hiddenColumns` vs `figureLayout` split: hidden columns ride initialState while widths/order/pins ride figureLayout — decide whether hidden moves into figureLayout (one figure-state home) or stays | Interactivity arc note | M1 decision, land with W2 batch |
| W6 | **Component-model wire block** (`components` on the theme envelope: per-component, per-state, typed channel→role/enum/scalar bindings) + manifest `region`/`component` fields. Stage-1 substrate of roadmap area E; also the retirement vehicle for W4's v3 bridges | `docs/dev/component-model.md` | M1, area E Stage 1 — schedule EARLY (other E stages depend on it; W4 lands with or after it) |

## Additive — safe post-freeze, listed for planning

| Item | What | Driver |
|---|---|---|
| A1 | JSON Schema publication (describes the wire; doesn't change it) | Area D |
| A2 | `consumedBy` annotations on column options (metadata, not wire) | D11 |
| A3 | Any new ThemeInputs blocks (effects/geometry extensions) — additive by construction | — |
| A4 | New Shiny event fields (additive; sync-gated) | — |

## Explicitly NOT planned (would be breaking; rejected or deferred)

- snake/camel unification of the theme wire (the two-case split is a
  locked deliberate decision — do not revisit).
- Per-row height pins (D5 default: per-kind only).
- `theme_blend()` / split static-knit (D14: cut from 1.0).

## Freeze checklist (executes in M3, roadmap area M)

1. W1–W5 landed; parity + roster-sync + wire-version gates green.
2. Bump to the freeze version; flip the policy text in BOTH version files.
3. Publish the JSON Schema for the frozen shape (A1 if not already done).
4. From then on: minors additive-only; majors need migration handlers.

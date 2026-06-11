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
| W1 | Delete the 6 dead column options (`range:showBar`, `viz_bar:{barWidth,barGap,orientation}`, `viz_boxplot:{boxWidth,whiskerType}`) — schema rows, typed fields, authoring defaults, R `col_*` args | Register D2 (default: delete) | **LANDED 2026-06-11** (D2 decided: deleted; wire stays 1.5 — option removal is reader-tolerant pre-freeze) |
| W2 | Column-ontology review fallout | Roadmap area C | **DECIDED 2026-06-11: net wire impact ZERO.** Review closed its list (column-ontology-review.md): percent symbol kept; kind editor→presentation rename is schema METADATA (pending, one mechanical commit); no inherits rewires. |
| W3 | `variants.headerStyle` retirement (superseded by the `header_style` input) | Wire-audit leftover | **LANDED 2026-06-11** (wire 1.6: variant slot + duplicated R S7 mirror slot removed; activeHeaderStyle reads inputs only) |
| W4 | v3-legacy `WebTheme` blob slimming + bridge retirement | v3→v4 cutover backlog | **DONE 2026-06-11** (wire 1.10): computeV3BridgeVars deleted; zero v3-bridge rows; blob slimmed (marks/cell/annotation/semantic/columnGroup/lightDarkPair/text/variants/firstColumn/borders all gone); every recipe ported pixel-faithfully or decided (D18). `w4-v3-blob-slimming.md` is the record. |
| W5 | `initialState.hiddenColumns` vs `figureLayout` split | Interactivity arc note | **DECIDED 2026-06-11: stays in initialState.** It belongs to the authored-defaults family (initial_sort / initial_filters / initial_hidden_columns seed session state as ONE surface; moving one breaks the family). A `figureLayout.hiddenColumns` tier is ADDITIVE whenever hide-state needs to ride figure round-trips — nothing forces a pre-freeze break. No wire change. |
| W6 | **Component-model wire block** (`components` on the theme envelope: per-component, per-state, typed channel→role/slot bindings) + manifest `binding` annotations. Stage-1 substrate of roadmap area E; also the retirement vehicle for W4's v3 bridges | `docs/dev/component-model.md` | **LANDED 2026-06-11** (wire 1.4→1.5, additive; W4 still pending and lands on top) |

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

## Freeze checklist — EXECUTED 2026-06-11 (the wire is FROZEN at 1.10)

1. [x] W1–W6 complete; parity + roster-sync + wire-version gates green.
2. [x] Freeze version = 1.10; policy text flipped in BOTH version files.
3. [x] JSON Schema published for the frozen shape (npm dist
       tabviz-spec.schema.json, generated from SCHEMA_REGISTRY, gated).
4. [x] Policy live: minors additive-only; majors need migration handlers
       + vN.0.json + schema regeneration.

Decision provenance: executed under delegated authority (2026-06-11),
flagged for review — nothing on the remaining roadmap (F/G/H/I/J/K
tails) needs a breaking wire change; auto-columns (I) and any future
additions are additive by construction.

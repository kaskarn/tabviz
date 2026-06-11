# Column-ontology review (roadmap area C, M1)

Status: **opened 2026-06-11** — inventory + first findings. This document
is the review's working record AND the source of the W2 wire-change list
(`wire-freeze-inventory.md`). Update findings in place; move items to
"Resolved" with the fixing commit.

## Inventory (post-D2, 2026-06-11)

- 25 concrete schemas / 23 buckets; **108 options** total
  (`bun -e` over `SCHEMA_REGISTRY`; D2 deleted 6 the same day).
- Kind split: 60 core / 32 editor / 16 styling.
- `consumedBy` annotation state: **COMPLETE 2026-06-11 (D11 arc)** —
  every option annotated; the drift gate's GRANDFATHER list is EMPTY
  (was 119 rows). New vocabulary entry: `"naturalHeight"`
  (height-behaviors.ts reads pictogram size/layout, ring/icon size,
  sparkline/img height).

### Inheritance DAG (`inherits` chains)

```
base ── categorical ── ordinal
  ├─ text ── reference
  ├─ date                     ← inherits BASE, not text (F4)
  ├─ numeric ── n · currency · percent · interval · range · events · heatmap
  ├─ pvalue                   ← inherits BASE, not numeric (F4)
  ├─ bar · progress · sparkline        (visual)
  ├─ pictogram ── stars · ring · badge · icon · img   (glyph)
  └─ viz ── viz_forest · viz_bar · viz_boxplot · viz_violin
```

## Findings

- **F1 — `kind: "editor"` definition contradicts its assignments.**
  `schema/types.ts` says editor = "UI-only knob … don't change the
  rendered cell behavior", but its own example (theme defaults
  `abbreviate`) and most assignments (axisLabel, showAxis, showLabel,
  height, shape, size — all paint) DO change rendering. The WORKING
  distinction is: core = data semantics (author-only) / styling =
  per-row visual override (MappedValue) / editor = presentation knob
  (theme-defaultable, never data meaning). Fix the PROSE to say that;
  assignments are mostly right under the corrected definition.
  Renaming the value `"editor"` → `"presentation"` is a W2 candidate
  (internal metadata, not wire) — decide cheap/skip at review close.
- **F2 — `symbol` name collision with different types**: currency
  (`text`, "$") vs percent (`toggle`, show-%). Schema comments mark it
  deliberate (different buckets, matches R arg names). VERDICT: keep,
  but percent's would read better as `showSymbol` — W2 candidate, weigh
  against R `col_percent(symbol=)` churn.
- **F3 — `format` is contextually typed**: date (strptime text) vs
  pvalue (enum auto/scientific/decimal). Same key, different vocab —
  acceptable (format is inherently type-local), document in the
  authoring docs rather than rename.
- **F4 — inheritance irregularities**: `date` inherits base (not text —
  misses wrap/truncate options); `pvalue` inherits base (not numeric —
  misses thousands/abbreviate, deliberately? p-values never abbreviate).
  ACTION: verify each is intentional, write the rationale into the
  schema files, or rewire `inherits`.
- **F5 — `maxValue` defaults vary by domain**: bar/heatmap null (auto),
  progress 100, ring 1. Semantically coherent (natural domains); needs
  a doc line, not a change.
- **F6 — repeated keys are otherwise coherent**: color (6×, all
  styling/color-control), size (4×, all segmented sm/base/…), scale
  (4×, all linear/log segmented), thresholds (3×, custom), separator
  (3×, text), showLabel (3×, toggle/editor). Good baseline.

## Resolved

- **F1** — prose corrected in `schema/types.ts` (2026-06-11): editor =
  presentation knob (never data meaning); assignments stand. The
  `"editor"` → `"presentation"` RENAME stays a W2 candidate (cheap,
  internal) — decide at review close.
- **F4** — verified INTENTIONAL, rationale already written in the schema
  files: date skips text's wrap/maxChars (date strings short/fixed);
  pvalue holds off numeric inheritance until its renderer honors
  decimals/thousandsSep/abbreviate (task #151 — otherwise the editor
  would show visually dead options, the exact dead-menu bug class).
  No change.

- **F7 — currency `symbol`/`position` were DEAD EDITOR MENUS** (the
  area-F symptom, found by D11): the schema re-advertised authoring
  sugar that `col_currency()` resolves into numeric prefix/suffix
  pre-wire, and the editor's generic `options[bucket][key]` write put
  them at `numeric.symbol`/`numeric.position` — keys nothing reads.
  DELETED from the schema (2026-06-11); the editor now surfaces
  numeric's live prefix/suffix. Authoring args unchanged.
- **F8 — `viz_violin:maxWidth` was a 7th D2-class dead option**
  (renderer computes maxWidth locally as violinHeight/2). DELETED
  (2026-06-11) under D2's decided rationale.

## W2 — DECIDED 2026-06-11 (the review's wire-change list, closed)

| Candidate | Decision |
|---|---|
| percent `symbol` → `showSymbol` | **KEEP.** The toggle control makes the semantics clear; a rename buys marginal clarity for real wire + R-arg churn. |
| `kind: "editor"` → `"presentation"` | **RENAME** (execute as one mechanical commit, next session). Internal metadata, not wire — but the name actively confuses: the SAME files use `consumedBy: ["editor"]` to mean "the editor UI reads this" while `kind: "editor"` means "presentation knob, theme-defaultable" (F1's confusion was exactly this). After the rename, "editor" has ONE meaning. |
| `inherits` rewires (date→text?) | **NONE** — F4 verified both irregularities intentional. |

Net W2 wire impact: ZERO (the rename is schema metadata, not wire shape).

## Remaining review passes (next sessions)

1. ~~D11 arc~~ DONE 2026-06-11 (see inventory above).
2. ~~Vocabulary doc~~ RESOLVED 2026-06-11 as a DRIFT GATE instead of
   regeneration (the table documents the CURATED R authoring surface,
   incl. sugar args that never reach the wire — regenerating from the
   registry would document the wrong surface). `test-docs-drift.R`
   asserts every documented helper + arg exists in formals(); its first
   run caught two more stale rows (col_progress min_value/height).
3. `column_defaults`-in-presets design work (the area-C creative half:
   ≥4 shipped presets using theme-level column styling deliberately).

# Windowed flatten — post-1.0 virtualization design note (area L)

Status: design note only (the area-L exit criterion). NOT scheduled for
1.0 — written 2026-06-11 so the door is provably open.

## The current shape, and why it scales the way it does

`buildRegionTree` (structural) and `flatten` (collapse/disclosure
projection) materialize EVERY display row; the DOM then mounts every
row's cells, and the measure-then-commit loop touches each. The
algorithmic half is cheap (bun bench, checked-in baseline: width
measurement over 100 rows ≈ 0.2 ms · 1k ≈ 2.5 ms · 5k ≈ 12 ms ·
10k ≈ 46 ms) — the wall is DOM mounting + style recalc, which is why
the scale posture (D12) leans on default pagination at ~200 rows
rather than virtualization.

## The seam virtualization would use

The design owes its feasibility to two locked structures:

1. **`flatten` is already a projection.** A windowed variant
   (`flatten(tree, {from, to})`) can emit only the visible slice plus
   structural context (sticky group headers above the window, summary
   rows pinned per the existing roster). `buildRegionTree` is
   collapse-independent and needn't change at all.
2. **Row-kind heights are deterministic pre-measure.** The 5-layer
   per-kind cascade gives every kind a height BEFORE DOM measure;
   content growth only ever ADDS height (grow-merge, B2). So a scroll
   container can compute total height as Σ(kind heights × counts) with
   a correction map for grown rows — the same map
   `computeRowLayout.rowKindHeights` already maintains.

## What breaks and what guards it

- The **measure loop** must not interpret "row left the window" as
  "row shrank" — the settled-rows-absent-from-reports rule (B2)
  already encodes exactly this; the harness `measure-rows.browser.ts`
  is the gate to extend.
- **Arrange mode** seams assume mounted rows; arming inside a window
  is fine, but per-kind ghost highlights must cap to mounted instances
  (note in the arrange gate when the time comes).
- **SVG export ignores all of this** — it renders the whole table by
  contract (the export fidelity contract), so virtualization is a
  DOM-only concern.

## Decision posture

Do nothing for 1.0. Pagination (D12) is the honest scale story; this
note exists so the post-1.0 implementation starts from the seams above
instead of an archaeology dig.

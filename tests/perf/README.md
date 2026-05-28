# R-side perf benchmarks

R-side init-time benchmarks for tabviz, complementing the two TS-side
harnesses (`srcjs/tests/perf/` for algorithmic + `srcjs/tests/browser/`
for real-Chromium mount). Run these when you change anything in the
serialization path, the split-table pipeline, or the V8 bridge.

## Run

```bash
Rscript tests/perf/bench-r-serialize.R
```

About 30 seconds total. No setup or fixtures to maintain — the script
generates a synthetic 1k-row data.frame in memory.

## What it measures

| Stage timed | What it stands in for |
|---|---|
| `split_table(shared_axis=TRUE)` | Split construction + V8 ts_call for shared axis only |
| `split_table(both shared)` | Same, plus V8 ts_call for shared widths |
| `serialize_split_table()` | R-side spec → wire-shape list (per-row metadata, style recipes, group structure) |
| `toJSON(payload)` | jsonlite encoding of the wire list |
| `forest_plot_split()` factory | `htmlwidgets::createWidget` — includes its own toJSON internally |
| Single-spec `forest_plot()` | Baseline: same pipeline without splits, with and without `paginate_spec(rows=20)` |

The fixture is **1000 total rows / 10 subsets / 9 fields** — the
user-stated "real-world" workload. Two single-spec baselines are
included for comparison (with/without pagination).

## Known floors

* **V8 round-trip overhead**: `ts_call` from `R/split_table.R` to
  `computeSharedAxis` / `computeSharedWidths` adds ~300-350 ms when both
  shared flags are set. Cost is JSON serialize/parse across the bridge,
  not the computation itself. See `R/split_table.R::.subset_payload_for_shared`
  for the field-filter mitigation; further reductions require protocol
  changes.

* **S7 `@` property accessor**: was 32% of `serialize_split_table()`
  time before Phase 4.1; mitigated via `compile_*_recipe()` helpers that
  pre-resolve column / spec props once outside the per-row loop. If you
  see this re-surface in a profile, the new code is doing `@` accesses
  per row again.

## Profiling

The hot loops use pre-compiled "recipes" (see `R/utils-serialize.R::
compile_cell_style_recipes`, `compile_row_style_recipe`). If you want a
fresh profile:

```r
Rprof(f <- tempfile(), interval = 0.005, line.profiling = TRUE)
for (i in 1:5) tabviz:::serialize_split_table(sf, include_forest = TRUE)
Rprof(NULL)
print(head(summaryRprof(f)$by.self[order(-summaryRprof(f)$by.self$self.time), ], 20))
```

## Reference numbers

For *change-direction* tracking only — absolute numbers are
machine-specific (Apple Silicon, R 4.5.2, late 2026):

| Scenario | Time |
|---|---|
| Single 1k-row `forest_plot()` | ~290 ms |
| Single 1k-row `forest_plot()` w/ paginate | ~255 ms |
| 1k / 10 subsets, `shared_axis` only | ~780 ms R-side total |
| 1k / 10 subsets, both shared | ~1100 ms R-side total |

Add ~1250 ms for the browser-side mount of the active subset (see
`srcjs/tests/browser/baseline-current.json` for that side).

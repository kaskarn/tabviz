# `export/` — SVG export engine + sizing harnesses

The DOM-free render path: build a complete SVG string from a `WebSpec` with no
browser, Canvas, or DOM. This is what the R-side V8 export and the static
(Quarto) runtime use, and it's where the box-model geometry is locked down by
snapshot harnesses. A harness no one discovers is dead weight — so they're
indexed here.

## Production code

| File | Role |
|---|---|
| `svg-generator.ts` | The engine. `generateSVG(spec, options)` → SVG string; `computeLayout()` → the shared geometry; `computeLayoutMetrics()` → the structured `LayoutMetrics` the snapshot gate captures. Also `generateSVGForAspectTarget()` (the aspect-ladder export path; mirrors `stores/slices/layout-zoom.svelte.ts`). |
| `v8-entry.ts` | V8 entry point — globals (`generateSVG`, `computeNaturalDimensions`, `renderDebugShapes`, `callBuilder`) the R `V8` bridge calls. |
| `index.ts` | Public re-exports. |

## Harnesses (run with `bun test` / via R)

| Harness | What it does | Run |
|---|---|---|
| **`layout-metrics.test.ts`** + **`sizing-fixtures.ts`** | The box-model regression gate. Snapshots `computeLayoutMetrics()` (per-row height/top/marker/kind/indent, per-column width+x, chrome dims, spacing-token echo) over a density/wrap/indent/spacer/group/overall/mixed fixture matrix, plus invariants. Locks geometry across sizing & row-kind refactors. Stub themes → runs under bun. | `bun test src/export/layout-metrics.test.ts` · regen: `--update-snapshots` |
| **`svg-centering.test.ts`** | The drift gate. Guards SVG centering/positioning and (per CLAUDE.md) is the manual tripwire for `$state.raw` deep-mutation regressions in the store. Must stay green after any `preview*`/`setX` slice change. | `bun test src/export/svg-centering.test.ts` |
| **`debug-shapes.ts`** + **`debug-shapes.test.ts`** | Visual half of the box model. `renderDebugShapes(spec)` / `renderDebugShapesFromMetrics(m)` draw the layout as labeled boxes (rows, columns, chrome, markers) for eyeball review; the test guards the SVG contract. Eyeball from R via `render_debug_shapes(spec, "out.png")`. | `bun test src/export/debug-shapes.test.ts` |

Design rationale and the metric definitions live in `docs/dev/sizing-model.md`
(§6/§6b). When you add a sizing-affecting change, extend `sizing-fixtures.ts`
and re-baseline `layout-metrics.test.ts` rather than special-casing.

# R ↔ JS synchronization points

**Status:** Phase 0e deliverable. Authoritative inventory of every place an R-side definition mirrors a JS-side definition (or vice versa), the mechanism keeping them in sync, and the test that catches drift.

This is a working document — when a new sync point appears (typically because the wire contract grew a new field, method, or constant), add a row.

---

## What counts as a sync point

A sync point exists when changing one side requires changing the other for the contract to stay valid. Three flavors:

- **Two-side mirror**: both sides own a list / record / type that must match (e.g. `TABVIZ_STATE_FIELDS` ↔ `SHINY_EVENT_FIELDS`).
- **Generative**: one side is authored, the other derived at build time (e.g. theme presets — R writes them, build serializes to JSON, JS reads).
- **One-way reference**: one side references the other by name (e.g. R's `filter_rows` emits `proxy_method = "applyFilter"` — that string must match a JS dispatch key).

For each, we pick a sync mechanism: **generate**, **doc-test**, or **manual** (the last only when changes are rare and obvious).

---

## Inventory

### S1. Wire-format version

| Field | Side | Where |
|---|---|---|
| `WIRE_FORMAT_VERSION` | R | `R/wire-version.R` |
| `CURRENT_VERSION` | JS | `srcjs/src/spec/index.ts` |

**Mechanism:** doc-test. `tests/testthat/test-wire-version.R` reads the TS file with `readLines` + a regex and asserts the two constants match.

**Triggered by:** any wire-format version bump (see `docs/dev/versioning.md`).

---

### S2. Shiny event field list

| Field | Side | Where |
|---|---|---|
| `TABVIZ_STATE_FIELDS` | R | `R/shiny.R:100` |
| `SHINY_EVENT_FIELDS` | JS | `srcjs/src/spec/events.ts` |

**Mechanism:** doc-test. Same `test-wire-version.R` file reads the TS array literal and asserts set equality with the R constant.

**Triggered by:** adding/removing a typed event (see `docs/dev/event-contract.md`).

---

### S3. Proxy method names

| Field | Side | Where |
|---|---|---|
| R proxy verbs | R | `R/modifiers.R`, `R/shiny.R` (via `invoke_proxy_method(... proxy_method = "name")` calls) |
| `proxyMethods` keys + `normalize` keys | JS | `srcjs/src/index.svelte.ts` (proxyMethods) + `srcjs/src/spec/proxy-args.ts` (normalize) |

Known method names (single-widget channel `tabviz-proxy`):
`updateData`, `toggleGroup`, `applyFilter`, `clearFilter`, `sortBy`, `addColumn`, `hideColumn`, `moveColumn`, `setColumnWidth`, `updateColumn`, `selectRows`, `moveRow`, `setCell`, `setRowLabel`, `clearEdits`, `setRowSemantic`, `setCellSemantic`, `setTheme`, `setZoom`, `setAspectRatio`.

Split-widget channel `tabviz-split-proxy`:
`selectPlot`.

**Mechanism:** manual (today). The R proxy emitters are scattered across `R/modifiers.R` and `R/shiny.R`; the JS dispatch table is a single `proxyMethods` object. A doc-test similar to S1/S2 would scan R for `proxy_method = "..."` literals and assert each appears in the JS table. **Wiring this up is a Phase 0e follow-up** — currently relies on R-side proxy tests (`tests/testthat/test-shiny-proxy.R`) to catch drift indirectly (a renamed method would fail the round-trip there).

---

### S4. Split-widget type discriminator

| Field | Side | Where |
|---|---|---|
| `type = "split_table"` | R | `R/utils-serialize.R:844` (in the split serializer) |
| TS literal `type: "split_forest"` (historical) → now `type: string` | JS | `srcjs/src/types/index.ts::SplitForestPayload` |

**Status:** historical drift. R emits `"split_table"`. The TS type previously declared `"split_forest"` (never enforced at runtime). 0a-PR1 widened the TS type to `string` with an inline comment pointing here.

**Mechanism:** open. Two paths to reconciliation:
- Rename R-side to `"split_forest"` and tighten TS back to a literal.
- Or rename TS-side to `"split_table"` and tighten.

Neither is urgent; the runtime ignores the field. Address before the v1.0 publish so the published JSON Schema isn't silently wrong.

---

### S5. Theme preset names

| Field | Side | Where |
|---|---|---|
| Exported preset constructors | R | `R/themes.R`, `R/themes-lotr.R`, `R/themes-api.R` |
| Preset-by-name lookup (post-C5) | JS | TBD: `srcjs/src/themes/presets.json` (build-generated) |

**Status:** gated on C5 (Phase 1.x). Today, JS-side has its own hardcoded `theme-presets.ts` (586 lines, ~30 themes) that mirrors but doesn't strictly match R-side `web_theme_<name>()` exports.

**Planned mechanism:** generate. The R-side preset list serializes to `presets.json` at build time; JS reads from that file. Sync is automatic by construction once the build pipeline is wired up.

**Triggered by:** adding a new preset R-side (the build regenerates the JSON; no manual sync needed in the future).

---

### S6. Column type names

| Field | Side | Where |
|---|---|---|
| `col_*` exported functions | R | `R/web_spec.R`, `R/classes-components.R` (col_text, col_numeric, col_forest, etc.) |
| TS `ColumnType` discriminator union | JS | `srcjs/src/types/index.ts::ColumnType` |

Known types: `text`, `numeric`, `interval`, `bar`, `pvalue`, `sparkline`, `date`, `currency`, `percent`, `events`, `icon`, `badge`, `stars`, `pictogram`, `ring`, `img`, `reference`, `range`, `heatmap`, `progress`, `forest`, `viz_bar`, `viz_boxplot`, `viz_violin`, `custom`.

**Mechanism:** manual (today). The TS union is hand-maintained; the R helper functions are exports of the package. Drift would manifest as a render-time error ("unknown column type") or a build-time R CMD check failure if the exports list goes out of sync with usage.

**Future:** a doc-test could scan `R/` for `col_*` exported functions and assert each is in the `ColumnType` union. Worth wiring up; not urgent.

---

### S7. Wire field name conventions (snake_case ↔ camelCase)

| Field | Side | Where |
|---|---|---|
| Wire field names | R | `R/utils-serialize.R` (canonical normalization point) |
| Internal field names | JS | `srcjs/src/types/index.ts` |

**Convention:** R-side internals use snake_case (`row_color_col`, `target_aspect_anchor`). Wire format is camelCase (`rowColorCol`, `targetAspectAnchor`). The conversion happens in one place: `R/utils-serialize.R`.

JS-side `srcjs/src/spec/proxy-args.ts` handles the legacy snake-case stragglers that arrive from R (e.g. `header_align` → `headerAlign` in `updateColumn`'s changes payload) at the wire boundary.

**Mechanism:** convention + single-point normalization. No doc-test today; drift would manifest as missing fields on the JS side (the field would be present but under the wrong key).

**Improvement opportunity:** auto-generate a snake/camel mapping table from the TS types and assert R's serializer covers all of them. Phase 1.x follow-up.

---

### S8. View Source target emitters (per C12-a)

**Status:** deferred to Phase 0c-C12 / Phase 1.5. Currently `op-recorder.ts` and `theme-source.ts` embed R-API knowledge (function names, argument names, helper calls) in TS templates. No automated guard against drift.

**Planned mechanism:** R-side doc-test. Emit code from a known WebSpec via the JS target, evaluate it in R via `eval(parse(text=...))`, assert the resulting spec equals the input.

**Why it matters:** R's API can rename a `col_*` helper or change a `tabviz()` argument shape; today nothing catches the JS template still emitting the old call.

---

## Wiring up new sync mechanisms

When you find a new sync point (or want to upgrade an existing one from manual to doc-test):

1. **Decide the mechanism.** Generate (build-time derivation) when one side is the canonical author and the other is derived. Doc-test when both sides need to author independently. Manual only when drift is rare and the consequence is loud.

2. **Wire it up.** Doc-tests typically live in `tests/testthat/test-wire-version.R` (extending the existing pattern: read TS file, regex out the constant, compare).

3. **Add a row to the inventory above.**

4. **Reference the new mechanism in the spec section that touches it.** The whole point of explicit sync mechanisms is that a maintainer can find them.

---

## Audit findings (Phase 0e completion)

| Sync point | Mechanism | Status |
|---|---|---|
| S1 — wire-format version | doc-test | ✅ wired (0a-PR1) |
| S2 — Shiny event field list | doc-test | ✅ wired (0a-PR5) |
| S3 — proxy method names | manual + indirect (R-side proxy tests) | 🟡 sufficient for now; doc-test would be cleaner |
| S4 — split-widget type discriminator | (drift documented) | 🟡 reconcile before v1.0 publish |
| S5 — theme preset names | generate at build time | ⏳ gated on C5 |
| S6 — column type names | manual | 🟡 sufficient; doc-test possible |
| S7 — wire field name conventions | single-point normalization (R/utils-serialize.R) | 🟡 sufficient; auto-generated mapping is a future enhancement |
| S8 — View Source target emitters | (none yet) | ⏳ gated on C12-a |

Three sync points (S5, S8, S4 reconciliation) wait on Phase 1.x work. The rest are either wired or have documented manual policies that will hold until they don't.

# The theme cascade

Reference documentation for the tabviz theme subsystem, written for an agent
who has never opened this code. Every claim below was checked against the
source at the cited `file:line` (2026-07-27, working tree at `1f4528e9` + the
uncommitted D42 spacing arc). Findings — bugs, brittleness, redundancy — are
in the `## Findings` section at the end.

---

## 1. What the subsystem is

A theme is authored as a small **`ThemeInputs`** record (anchors, fonts,
density, enums) and resolved into **153 `--tv-*` CSS custom properties** plus a
handful of object clusters the renderers read. Resolution is deterministic,
idempotent, and runs **entirely in TypeScript** — R delegates over V8.

Two artefacts come out of one authoring record:

| Artefact | Shape | Who reads it |
|---|---|---|
| `WebTheme` (the "blob") | camelCase object clusters (`spacing`, `row`, `header`, `series`, `plot`, `layout`, `axis`) + the carried `authoringInputs` / `roleOverrides` / `pins` / `components` | Svelte renderers, SVG export, R `S7` mirror |
| `cssVars` map | `--tv-*` → string | the widget's emitted `<style>`, the SVG export, `theme_css_vars()` |

The blob is produced by `buildTheme` (`srcjs/src/lib/theme/theme-adapter.ts:116`).
The cssVars map is produced by `resolveTheme` (`srcjs/src/lib/theme/resolve-theme.ts:1181`)
walking the token manifest, then wrapped by `getCssVars`
(`srcjs/src/lib/theme/consumer-bridge.ts:169`).

**Both derive from the same `ThemeInputs`.** They are not layered — they are
two projections of one input record, and the pieces the cssVars path cannot
express (density-scaled spacing, series slot 0, layout config) are stamped back
onto the map as post-resolve overlays (§6).

### File map

| File | Role |
|---|---|
| `lib/theme/theme-adapter.ts` | `buildTheme` — inputs → `WebTheme` blob. Owns the spacing cluster, series slots, text roles, row/header/rowGroup/plot clusters. |
| `lib/theme/theme-resolve.ts` | `buildThemeStructure` (`:495`) + `buildRamps` (`:100`) — the ramp/token layer `buildTheme` consumes. **Not** the v4 cascade despite the name. |
| `lib/theme/resolve-theme.ts` | `resolveTheme` (`:1181`) — THE v4 cascade: `runCascade` (`:1080`) → roles, then the manifest walk (`resolveTokenValue`, `:653`) → cssVars. |
| `lib/theme/component-tokens.ts` | `COMPONENT_TOKENS` (`:190`), the 153-entry manifest; `KNOWN_UNCONSUMED` (`:1529`). |
| `lib/theme/component-bindings.ts` | `COMPONENT_ROSTER` (`:101`), `sanitizeComponentBindings` (`:165`), `componentChannelOverride` (`:254`). |
| `lib/theme/consumer-bridge.ts` | `getCssVarsRaw` (`:136`), `getCssVars` (`:169`), `applyTokenPins` (`:102`), `applySpacingPins` (`:199`), `isValidPinValue` (`:97`), the `readVar*` accessors. |
| `lib/theme/theme-css.ts` | `buildThemeCSS` (`:73`) / `_emitV4CssVarsBody` (`:156`) — the widget paint path. |
| `lib/theme/v3-bridge-vars.ts` | `computeLiveConfigVars` (`:18`) — the ONE non-cascade emission (4 tokens). |
| `lib/theme/spacing-tokens.ts` | D42 spacing roster + bounds + `applySpacingOverrides`. |
| `lib/theme/theme-wire.ts` | `ThemeWire` (`:64`), `createWire` (`:115`), `buildThemeWire` (`:148`) — the portable envelope. |
| `lib/theme/theme-wire-parse.ts` | `parseThemeWire` (`:35`) — the validating TS ingress. |
| `lib/theme/theme-validate.ts` | `validateThemeInputs` (`:273`), `validateResolvedTheme` (`:67`). |
| `lib/theme/borders.ts` | `resolveBorders` (`:42`) — shared by the borders resolver group and the SVG export. |
| `lib/theme/column-defaults.ts` | theme-as-house-style per-column-type option merge. |
| `lib/theme/theme-presets-inputs.ts` | the 9 preset `ThemeInputs` records. |
| `stores/slices/theme.svelte.ts` | the store verbs (`rebuild` `:313`, `setAuthoringInputs` `:342`, `setSpacingOverride` `:449`, …). |
| `R/classes-theme.R` | `ThemeInputs` (`:122`), `SpacingTokens` (`:667`), `WebTheme` (`:944`) S7 mirrors. |
| `R/themes-api.R` | `resolve_from_inputs` (`:216`), `re_resolve` (`:237`), `web_theme` (`:420`), the ~20 `set_*` verbs. |
| `R/theme-wire-import.R` | `theme_inputs_from_wire` (`:83`), `theme_from_wire` (`:322`) — the R ingress. |
| `R/v8-bridge.R` | `ts_call` (`:62`), `.theme_v8_opts` (`:90`). |

---

## 2. The three tiers, and exactly where each lives

### Tier 1 — inputs

`ThemeInputs` (`srcjs/src/types/theme-inputs.ts`) is the whole authoring
surface: 4 OKLCH `anchors` (paper/ink/brand/accent?), optional `status`
anchors, `fonts`, `polarity`, `mode`, `density` + `density_factor`, curves,
geometry, effects, marks, and a set of sparse sub-records:

| Field | Line | Meaning |
|---|---|---|
| `type_roles` | `theme-inputs.ts:164` | Tier-2 typography rebinds (`{family,size,weight}` per role). |
| `spacing_overrides` | `theme-inputs.ts:189` | D42 — absolute-px per-token spacing (camelCase keys). |
| `series_overrides` | `theme-inputs.ts:230` | per-series fill/stroke/shape. |
| `column_defaults` | `theme-inputs.ts:285` | theme-as-house-style, keyed by column TYPE. |
| `interaction_defaults` | `theme-inputs.ts:296` | theme-opinionated capability flags. |

The R mirror is the FLAT `ThemeInputs` S7 class (`R/classes-theme.R:122`) —
nested wire triples become `anchors_brand_L/C/H`-style slots, re-nested at
serialization by `theme_inputs_to_json` (`R/themes-api.R:~60-210`).

### Tier 2 — roles

Roles are named colour/typography/geometry values.

- **Colour roles**: `RoleName` (`srcjs/src/types/theme-roles.ts:48`), default
  bindings in `role-bindings.ts:33` (`DEFAULT_ROLE_BINDINGS`: role → `{ramp,
  grade}`). Resolved in `runCascade` (`resolve-theme.ts:1080`) via
  `resolveRoleValue` (`:194`). Overridable through `roleOverrides` — an
  artefact channel, NOT part of `inputs`.
- **Type roles**: `DEFAULT_TYPE_ROLES` (`typography.ts:55`), overridden via
  `inputs.type_roles` and merged by `effectiveTypeRoles` (`scale-roles.ts:71`).
- **Geometry slots**: `CORNER_SLOTS` / `RULE_SLOTS` (`scale-roles.ts:101,109`),
  driven by `inputs.geometry`.

Two cascade-level moves happen at this tier and nowhere else:

1. **HC status strip** — under `mode === "high-contrast"`, `inputs.status` is
   deleted before ramps are built (`resolve-theme.ts:1093-1096`), so both the
   status ramps and the `--tv-status-*` anchor tokens fall back to the curated
   HC-safe palette in one place.
2. **Minimum-contrast walk** — `text-subtle` then `text-muted` are walked
   toward the ink end of the neutral ramp until they clear WCAG AA on
   `surface`; `text-muted` gets a floor one grade above where `text-subtle`
   landed so the hierarchy can't flatten (`resolve-theme.ts:1152-1180`). The
   walked grade is written back into `roleSource` so the inspector's provenance
   matches the painted value.

### Tier 3 — component tokens

`COMPONENT_TOKENS` (`component-tokens.ts:190`) — 153 frozen entries. Each
declares:

- `cssVar` — the emitted name;
- `resolverGroup` — which of the 18 `ResolverFn`s in the `RESOLVERS` map
  (`resolve-theme.ts:500`) realizes it (`role`, `typography`, `density`,
  `geometry`, `borders`, `shell-paper`, `glass`, `effects`, `texture`,
  `knockout`, `anchor`, `ramp-direct`, `header-active`, `first-col`,
  `hc-fidelity`, `browser-fx`, `const`, `live-config`);
- `source` — provenance (`{tier:"role"|"input"|"anchor"|"computed"|"const"}`);
- `consumedBy` — **a hand-maintained string list of renderer files. It is NOT
  machine-verified** (see Finding a-1);
- `modes` — optional HC/RT `drop`/`swap` behaviour;
- `binding` — optional `(region, component, channel, state)` address that
  makes the token re-routable (61 tokens carry one).

Group census: `role` 36 · `typography` 31 · `density` 17 · `borders` 11 ·
`shell-paper` 10 · `glass` 8 · `geometry` 8 · `anchor` 6 · `effects` 5 ·
`live-config` 4 · `first-col` 4 · `header-active` 3 · `const` 3 ·
`browser-fx` 2 · `texture` 2 · `ramp-direct` 2 · `knockout` 1.

`resolveTokenValue` (`resolve-theme.ts:653`) runs a short cross-cutting
pre-filter (live-config short-circuit → `token.modes` HC/RT drop/swap) and then
dispatches on `resolverGroup`. A group with no registered resolver dev-throws;
in prod it emits a `TOKEN_RESOLVE_BUG_SENTINEL`.

---

## 3. Component re-routes (the "middle verb")

Three edit verbs exist, in increasing bluntness:

1. **re-tune a role** — `set_role()` / `roleOverrides`. Global; cascade-coherent.
2. **re-route a component channel** — `set_component()` / `theme.components`.
   Local; still cascade-coherent (the role re-resolves under polarity/HC).
3. **pin a token** — `set_pin()` / `theme.pins`. Raw value; bypasses the cascade.

The `components` wire block is `component → state → channel → value`
(`ComponentBindings`, `component-bindings.ts:79`). At resolve time each
re-route-honouring resolver calls `componentRoleOverride`
(`component-bindings.ts:269`) FIRST and redirects to `ctx.roles[reroute]`. Only
seven groups honour re-routes — `role`, `typography`, `anchor`, `ramp-direct`,
`header-active`, `first-col`, `borders` — and `component-bindings.test.ts:78`
gates that only those groups may carry a `binding` annotation.

Precedence: **manifest default → components re-route → role resolution → token
pins**, with the **HC/RT mode ratchet beating both** re-routes (the pre-filter
in `resolveTokenValue` runs before dispatch) and pins (`applyTokenPins`
`consumer-bridge.ts:114-125` skips pins on tokens whose manifest declares
behaviour for the active mode).

`COMPONENT_ROSTER` (`component-bindings.ts:101`) derives from the manifest and
applies a **mechanical honesty filter**: a channel whose backing token is in
`KNOWN_UNCONSUMED` is dropped from the roster, "because advertising an editable
channel nothing paints is the option-nothing-reads bug class". That filter is
only as good as `KNOWN_UNCONSUMED` (Finding a-1).

---

## 4. The two case conventions and every boundary they cross

There are exactly two case worlds and they are deliberate:

- **`ThemeInputs` = snake_case** — the authoring surface (`density_factor`,
  `spacing_overrides`, `first_column_style`, `type_roles`, `border_preset`).
- **`WebTheme` / resolved clusters = camelCase** — the engine-internal shape
  (`densityFactor` does not exist; `rowHeight`, `cellPaddingX`, `roleOverrides`,
  `authoringInputs`).

Boundaries where the two meet:

| Boundary | Direction | Where |
|---|---|---|
| `buildTheme(inputs, opts)` | snake in → camel out | `theme-adapter.ts:116` |
| `createWire(inputs)` | snake passthrough (the wire's `inputs` stays snake) | `theme-wire.ts:115` |
| `spacing_overrides` keys | **camelCase INSIDE a snake_case input** — deliberate: the keys ARE the resolved `SpacingTokens` field names, so no conversion is needed at the merge | `spacing-tokens.ts:22`, `theme-adapter.ts:271` |
| cssVar names | camel cluster field → kebab cssVar (`cellPaddingX` → `--tv-spacing-cell-padding-x`) | hand-written table in `applySpacingPins` (`consumer-bridge.ts:220-237`); generated by `snakeToCssVar` in `density-presets.ts` for the density group |
| R `ThemeInputs` slots | flat snake (`anchors_brand_L`) → nested snake wire | `theme_inputs_to_json` (`R/themes-api.R:~60`) / `theme_inputs_from_wire` (`R/theme-wire-import.R:83`) |
| R `SpacingTokens` props | snake (`row_height`) ↔ camel wire (`rowHeight`) | `R/utils-serialize-resolved.R:100-118`, `set_spacing` (`R/themes-api.R:1704-1710`) |
| DTCG export | cssVar → dotted path (`--tv-row-base-bg` → `row.base.bg`) | `dtcg-adapter.ts:52` |

Rule of thumb: **match the case of the surface you are on. Never "unify".**

---

## 5. The portable theme artifact

One envelope, one schema string:

```json
{ "$schema": "tabviz-theme/v4",
  "name": "…",
  "inputs":        { … snake_case ThemeInputs … },
  "roleOverrides": { "text-muted": "neutral.7" },
  "components":    { "title": { "base": { "col": "accent-text" } } },
  "pins":          { "--tv-text-title-fg": "#123456" } }
```

- `roleOverrides` travels as **NAME aliases** (`"neutral.7"`), not `{ramp,
  grade}` coordinates — DTCG-shaped and re-index-migratable. `buildThemeWire`
  (`theme-wire.ts:148`) aliases on the way out; `normalizeBinding`
  (`alias.ts:52`) / R `.normalize_binding` (`R/theme-wire-import.R:31`) accept
  BOTH forms on the way in.
- `components` and `pins` are omitted when empty so pin-less exports stay
  byte-stable.
- Egress: TS `buildThemeWire`; R `theme_to_wire` (`R/studio.R:311`) →
  `write_theme` (`R/studio.R:346`). DTCG is a second egress
  (`dtcg-adapter.ts:63`) carrying the authoritative inputs in
  `$extensions["com.tabviz.theme"]` for a lossless round-trip.
- Ingress: TS `parseThemeWire` (`theme-wire-parse.ts:35`); R `theme_from_wire`
  (`R/theme-wire-import.R:322`) and `read_theme` (`R/studio.R:250`, which
  routes legacy resolved blobs through `theme_from_wire` so they get the same
  validation).

A separate, SLIM envelope exists for the in-widget theme switcher
(`serialize_theme_slim`, `R/utils-serialize-resolved.R:20`): `{name,
authoringInputs, roleOverrides?, components?, pins?, webFonts?}` with **no
resolved clusters**. Feeding one raw to `getCssVars` crashes
(`applySpacingPins` reads `theme.spacing.rowHeight`) — D13. `ThemeSwitcher`'s
`resolveSlim` (`components/ui/ThemeSwitcher.svelte:113`) is the only consumer
and it resolves via `buildTheme` first; `applySpacingPins:218` and
`computeLiveConfigVars` both additionally no-op on an absent cluster as
defence-in-depth. Gate: `slim-envelope-resolve.runes.ts`.

---

## 6. Everything that applies AFTER resolve, in order

```
ThemeInputs
  │
  ├─ buildTheme (theme-adapter.ts:116)
  │    └─ spacing = applySpacingOverrides(                       ← D42 overlay #1
  │           scaleSpacing(DENSITY_PX[density], density_factor),
  │           inputs.spacing_overrides)                          [theme-adapter.ts:271]
  │       → theme.spacing (camelCase cluster)
  │
  └─ getCssVarsRaw (consumer-bridge.ts:136)          ── MEMOIZED ──
       ├─ resolveTheme(wire{inputs, roleOverrides, components})
       │    ├─ validateThemeInputs
       │    ├─ HC status strip · ramps · roles · contrast walk
       │    └─ manifest walk: mode ratchet → component re-route → resolver
       └─ applyTokenPins(cssVars, theme.pins, mode)              ← overlay #2
              (name gate `--tv-`, value gate isValidPinValue,
               mode ratchet beats pin)
         ↓
    getCssVars (consumer-bridge.ts:169)
       ├─ Object.assign({...base}, computeLiveConfigVars(theme, base))  ← overlay #3
       │      4 tokens: --tv-summary-fill/-border, --tv-container-border(-radius)
       └─ applySpacingPins({...withBridge}, theme)                      ← overlay #4
              14 --tv-spacing-* + 3 --tv-plot-* from theme.spacing / theme.plot
```

**Effective precedence, highest last:** cascade < mode ratchet* < component
re-route < token pins < live-config < spacing/plot pins.
(*the ratchet is applied *before* dispatch, so it beats re-routes; and
`applyTokenPins` explicitly refuses to write over it.)

The two consequences of that ordering are not obvious and bite (Finding a-2):
overlays #3 and #4 unconditionally overwrite, so **pins on the 4 live-config
tokens, the 14 spacing tokens and the 3 plot-dim tokens are silently dead.**

Note that `spacing_overrides` reach cssVars only via `theme.spacing` +
overlay #4. `resolveTheme` itself knows nothing about them: `tokenDensityPx`
(`resolve-theme.ts:1007`) resolves the density group from
`DENSITY_PRESETS[density] × density_factor` and nothing else. Any consumer that
calls `resolveTheme` directly gets pre-override spacing (Finding a-3).

---

## 7. The two emission paths and what keeps them in lockstep

| Path | Entry | Used by |
|---|---|---|
| **map** | `getCssVars(theme)` (`consumer-bridge.ts:169`) | SVG export (through a sanitizing wrapper, `export/svg-generator.ts:86`), every `readVar*` consumer, R `theme_css_vars()` |
| **CSS text** | `buildThemeCSS(theme)` → `_buildThemeCSSImpl` (`theme-css.ts:101`) | the widget's emitted `<style>` block |

They agree **structurally**, not by a comparison test:

- Both call the SAME memoized `getCssVarsRaw`, so ramps, roles, `roleOverrides`,
  `components` and `pins` are resolved once and shared
  (`theme-css.ts:168` vs `consumer-bridge.ts:175`).
- Both then call `applySpacingPins` on a fresh spread
  (`theme-css.ts:168`, `consumer-bridge.ts:193`).
- Live-config is single-sourced from `computeLiveConfigVars`
  (`v3-bridge-vars.ts:18`): `getCssVars` `Object.assign`s it LAST;
  `_buildThemeCSSImpl` emits it as the LAST declaration block
  (`theme-css.ts:126-143`), which wins in CSS by source order. Same effective
  precedence in both. The two sets do not overlap with the spacing pins, so the
  differing application order is inert today — but it is an invariant nobody
  tests (Finding b-1).
- `_emitV4CssVarsBody` skips values starting with `<` (unresolved sentinels);
  `getCssVars` keeps them and `readVar` (`consumer-bridge.ts:270`) treats them
  as "fall back".

Gates: `role-overrides-wiring.test.ts` (pins + roleOverrides reach BOTH paths),
`component-bindings.test.ts` (re-routes ride both), `consumer-bridge.test.ts`,
`theme-spacing-overrides.test.ts` (spacing reaches `getCssVars` — but not
`buildThemeCSS`).

### Caching, and whether D42 broke it

Two caches, both still sound after D42:

- `cascadeCache` (`consumer-bridge.ts:58`) — `WeakMap<authoringInputs,
  Map<overridesKey, cssVars>>`. `overridesKey` (`:61`) canonicalizes
  `roleOverrides | pins | components`. It deliberately does NOT include
  `spacing_overrides` — correct, because `resolveTheme` never reads them.
- `cssVarsBridgeCache` (`consumer-bridge.ts:167`) — `WeakMap<WebTheme,
  base+liveConfig>`. `getCssVars` returns `applySpacingPins({...withBridge},
  theme)`: a **fresh spread every call**, so (a) the mutating callers can't
  corrupt the cached map and (b) an in-place `theme.spacing.X = n` mutation
  (the supported v3-compat pin pattern) is still picked up.

D42 did **not** add a second post-resolve overlay at this level: spacing
overrides fold into `theme.spacing` inside `buildTheme`, i.e. *before* either
cache exists, and `buildTheme` always returns a fresh object. So the answer to
"is the WeakMap still safe" is **yes**, and the reason is that
`spacing_overrides` is an *input*, not an overlay. (The residual staleness risk
is `computeLiveConfigVars`, which reads `theme.series[0]` / `theme.layout` and
IS baked into the per-theme-identity cache — see Finding b-2.)

---

## 8. R ↔ TS delegation

R owns no resolution logic. `resolve_from_inputs` (`R/themes-api.R:216`):

```r
inputs_json <- theme_inputs_to_json(inputs)          # flat S7 → nested snake wire
opts        <- .theme_v8_opts(name, role_overrides, pins, components)   # R/v8-bridge.R:90
blob        <- ts_call("buildTheme", inputs_json, options = opts)       # V8 hop
theme       <- deserialize_resolved_theme(blob)
```

`re_resolve` (`R/themes-api.R:237`) is THE single re-resolution idiom for the
~20 `set_*` verbs; it carries every unspecified artefact channel (inputs /
role_overrides / pins / components) forward so no verb can silently wipe one.

Other V8 seams:

| R function | TS builder | Threads artefacts? |
|---|---|---|
| `theme_css_vars` (`R/v4-inspect.R:110`) | `buildTheme` + `getCssVars` | **yes** (`.theme_v8_opts`) |
| `serialize_theme` (`R/utils-serialize-resolved.R:45`) | `buildTheme` | yes |
| `list_component_tokens(theme)` (`R/v4-inspect.R:67`) | `resolveFromInputs` | **no** (Finding a-4) |
| `inspect_token` (`R/v4-inspect.R:143`) | `resolveFromInputs` + `inspectToken` | **no** |
| `contrast_report` (`R/v4-inspect.R:167`) | `resolveFromInputs` + `contrastReport` | **no** |
| `theme_to_dtcg` (`R/dtcg.R:56`) | `toDtcg` | roleOverrides + components only; pins ride `$extensions` but are not applied to the emitted values |
| `.assert_component_bindings` (`R/themes-api.R:1452`) | `validateComponentBindings` | validation single-sourced |

The R `WebTheme` (`R/classes-theme.R:944`) additionally carries mutable
`axis` / `layout` / `spacing` / `web_fonts` slots that are overlaid onto the
V8 blob at serialization (`R/utils-serialize-resolved.R:66-124`) — the
post-resolve pin escape hatch `set_theme_field()` writes there.

Sync gates that read the TS source directly (and `skip_if_not` when `srcjs` is
absent, i.e. inside the tarball `R CMD check`):
`tests/testthat/test-spacing-roster-sync.R`, `test-interaction-roster-sync.R`,
`test-wire-version.R`, `test-glyph-roster-sync.R`.

---

## 9. Ingress points and their validators

| Ingress | Validator | Policy |
|---|---|---|
| TS `parseThemeWire` (`theme-wire-parse.ts:35`) | `validateThemeInputs`, `normalizeBinding`, `sanitizeComponentBindings`, `isValidPinValue` + `--tv-` prefix | **throws** with structured `ThemeIssue[]`; never half-applies |
| TS `resolveTheme` → `runCascade` (`resolve-theme.ts:1081`) | `validateThemeInputs` | throws — the last-line guard for programmatic wires |
| TS `buildTheme` (`theme-adapter.ts:402`) | `validateResolvedTheme` (contrast) | warn-only outside prod; throw-mode in the preset CI gate |
| TS store `setSpacingOverride` (`stores/slices/theme.svelte.ts:449`) | `clampSpacing` | clamps; non-finite = no-op |
| TS `applyTokenPins` (`consumer-bridge.ts:102`) | `--tv-` prefix + `isValidPinValue` + mode ratchet | silently drops |
| TS `applyThemeColumnDefaults` (`column-defaults.ts:113`) | kind gate (styling/presentation only) + author-wins + `isValidPinValue` on strings | silently drops |
| SVG export egress (`export/svg-generator.ts:86`) | `"`→`'`, strip `<>` on every cssVar value | neutralizes |
| R `web_theme()` / `ThemeInputs` S7 validator (`R/classes-theme.R:~330-370`) | ranges, enums, spacing bounds | `cli_abort` |
| R `theme_from_wire` (`R/theme-wire-import.R:322`) | `theme_inputs_from_wire` sanitizers, `.normalize_role_overrides`, `.assert_component_bindings`, pin value grammar | aborts on bad pins; silently drops malformed roleOverrides / column_defaults / series_overrides leaves |
| R `set_pin` (`R/themes-api.R:1359`) | grammar + **manifest membership** | aborts |

**Pin XSS defence is a matched pair and both halves must stay.**
Ingress: `isValidPinValue` (`consumer-bridge.ts:97`) — non-empty, ≤512 chars,
and free of `[<>{};" -]` (`:92`). The `"` ban exists because a value
like `#fff" onload="…` breaks out of a double-quoted SVG attribute with no `<`
at all. Egress: the `getCssVars` wrapper in `svg-generator.ts:86`. R mirrors the
grammar in three places (`set_pin`, `theme_from_wire`, the `column_defaults`
sanitizer at `R/theme-wire-import.R:191`).

---

## 10. Gates you must keep green

| Gate | What it protects |
|---|---|
| `component-tokens.drift.test.ts` | every `--tv-*` in a consumer file is declared; every manifest entry is referenced somewhere; `KNOWN_UNCONSUMED` has no stale rows. **Note its blind spot — Finding a-1.** |
| `dom-export-divergence.test.ts` | every token whose `consumedBy` is exactly `["svelte/TabvizPlot.svelte"]` carries a justification; ledger only shrinks. **Depends on `consumedBy` honesty.** |
| `role-overrides-wiring.test.ts` | roleOverrides + pins reach BOTH emission paths; cache is override-aware. |
| `component-bindings.test.ts` | roster honesty, sanitizer, ratchet, cache key, wire. |
| `slim-envelope-resolve.runes.ts` | D13 slim envelopes don't crash `getCssVars`. |
| `theme-spacing-overrides.test.ts`, `spacing-tokens.test.ts` | D42 resolution + roster. |
| `test-spacing-roster-sync.R` | R `TABVIZ_SPACING_TOKENS` ↔ TS `SPACING_TOKEN_KEYS` ↔ `SpacingTokens` props ↔ `DENSITY_PX`. |
| `preset-distinctness.test.ts`, `v4-preset-coverage.test.ts`, `theme-validate.test.ts` | the 9 presets stay distinct, fully covered and contrast-clean. |
| `settings-consequence.browser.ts` | every settings control moves ≥ the pixel floor in the FIGURE — the only gate that proves a theme control has consequence. |

`bun test src/lib/theme/` currently: **455 pass, 0 fail** (37 files).

---

# Findings

Audit date 2026-07-27. Verification method is stated per item. Nothing in this
audit was fixed — no source file was touched.

## (a) Possible issues / bugs

### a-1 · CONFIRMED — `consumedBy` is unverified, and three gates trust it

`component-tokens.ts` `consumedBy` (declared at `:167` as "Consumer file
paths… The drift gate enforces that every cssVar referenced by a consumer is
declared here") is a **hand-written claim that nothing checks**. The drift gate
(`component-tokens.drift.test.ts:132`) only asks "does the cssVar string appear
in ANY file under `components|svelte|export|stores|lib|schema`" — it never
compares against the token's own `consumedBy` list.

Verified by script (bun, over all non-test `.ts/.svelte/.css` under
`srcjs/src`): **128 `(token, claimed-consumer)` pairs where the named file
exists but does not contain the cssVar.** Many are legitimate indirect reads
(`readTypeSize(cv,"title",…)` builds `--tv-text-title-size` from a template).
The residue is not:

**Confirmed-dead tokens that the manifest claims are painted.** Filtering out
teaching/preview/inspect surfaces (`studio/`, `components/theme-panel/`,
`components/inspector/`, `components/spine/`, `components/ui/`, `authoring/`,
`types/`) and the resolver's own emit sites, these have **no reference in any
figure-rendering file**:

| Token | `consumedBy` claims | Actually referenced by |
|---|---|---|
| `--tv-row-base-fg` | export + TabvizPlot | `ResilienceTriptych.svelte`, `authoring/index.ts` |
| `--tv-row-emphasis-bg` | export + TabvizPlot + `lib/semantic-styling.ts` | `ResilienceTriptych.svelte`, `authoring/index.ts`, a COMMENT in `resolve-theme.ts:269` |
| `--tv-row-emphasis-fg` | export + TabvizPlot | `ResilienceTriptych.svelte`, `authoring/index.ts` |
| `--tv-header-light-bg` / `-fg` | export + `PlotHeader.svelte` | `theme-validate.ts` only |
| `--tv-header-tint-bg` / `-fg` | export + `PlotHeader.svelte` | `theme-validate.ts` only |
| `--tv-header-fill-bg` / `-fg` | export + `PlotHeader.svelte` | `theme-validate.ts`, `authoring/index.ts` |
| `--tv-radius-pill` | TabvizPlot + export | `resolve-theme.ts` (its own emit site) |
| `--tv-border-width-thin` / `-regular` / `-thick` | TabvizPlot + export | `resolve-theme.ts` (its own emit site) |

`lib/semantic-styling.ts` is named as a consumer of `--tv-row-emphasis-bg` and
reads nothing of the sort — `resolveSemanticBundle`
(`lib/semantic-styling.ts:53`) reads the OBJECT path `theme.row.emphasis`,
whose `bg` the adapter hardcodes to `null` (`theme-adapter.ts:317`). Only
`--tv-row-emphasis-bar` is genuinely painted (`svelte/TabvizPlot.svelte:3633`).

**Three consequences, each a real failure:**

1. **Dead editable channels.** `COMPONENT_ROSTER`'s honesty filter
   (`component-bindings.ts:114`) excludes only `KNOWN_UNCONSUMED` tokens, and
   none of the above are listed (they satisfy the drift gate through the
   teaching viz or the resolver itself). `list_components()` therefore
   advertises — and `set_component()` accepts — `row.col@base`,
   `row.bg@emphasis`, `row.col@emphasis`, and `header-cell.{bg,col}` in states
   `light` / `tint` / `fill`. Verified against the live R roster:
   ```
   14  header-cell   header light      bg      --tv-header-light-bg
   18  header-cell   header  fill      bg       --tv-header-fill-bg
   ```
   `set_component(th, "header-cell", bg = "accent", state = "tint")` returns a
   valid theme, exports a valid envelope, and changes nothing — the painted
   header reads `--tv-header-bg`, whose `header-active` resolver
   (`resolve-theme.ts:605-624`) picks its role from `inputs.header_style`
   independently of the per-variant tokens.
2. **The DOM↔export divergence ledger is fooled.** `dom-export-divergence.test.ts:54`
   flags only tokens whose `consumedBy` is EXACTLY `["svelte/TabvizPlot.svelte"]`.
   A token that (dishonestly) lists `export/svg-generator.ts` is invisible to
   the ratchet, which is precisely how `--tv-row-base-fg` and the six header
   variant tokens escape it.
3. **The contrast validator and `contrast_report()` measure unpainted pairs.**
   `theme-validate.ts:89-122` gates the three header variant pairs (not the
   painted `--tv-header-bg`/`-fg` pair), and `authoring/index.ts:295` reports
   `emphasis fg on emphasis bg` from two tokens nothing renders. Verified:
   `contrast_report(web_theme_nejm())` row 3 = `emphasis fg on emphasis bg`,
   row 6 = `header-fill fg on header-fill bg`.

Root cause is structural, not clerical: `lib/` is in the drift gate's
`CONSUMER_DIRS` (`drift.test.ts:35`) and only `component-tokens.ts` is excluded
(`:68`), so **`resolve-theme.ts` mentioning a cssVar in its own resolver switch
counts as a consumer.** That is exactly how `--tv-radius-pill` and the three
`--tv-border-width-*` tokens pass. This is the D42 `groupPadding` lesson
generalized — the gate proves emission, never consumption.

*How to verify / re-run:* the script used is a ~25-line bun test that walks
`srcjs/src`, filters non-renderer directories, and diffs each token's real
reference set against `consumedBy`. Worth landing as a permanent gate (see the
suggestion in b-3).

### a-2 · CONFIRMED — `set_pin()` is a silent no-op on 21 of the 153 manifest tokens

`set_pin` (`R/themes-api.R:1359`) validates the value grammar, checks manifest
membership (`:1380`), warns "writes … as a hardcoded value, bypassing the
cascade" — and for 21 tokens does nothing at all, because two later overlays
overwrite unconditionally:

- `applySpacingPins` (`consumer-bridge.ts:220-237`) re-stamps the 14
  `--tv-spacing-*` tokens and the 3 `--tv-plot-*` dims from `theme.spacing` /
  `theme.plot` on **every** `getCssVars` call and inside `_emitV4CssVarsBody`;
- `computeLiveConfigVars` (`v3-bridge-vars.ts:27-34`) re-stamps
  `--tv-summary-fill`, `--tv-summary-border`, `--tv-container-border`,
  `--tv-container-border-radius`.

Verified in R against the live V8 bridge:

```
--tv-spacing-row-height          before=24px      after-pin("99px")=24px
--tv-plot-line-width             before=1.5px     after-pin("99px")=1.5px
--tv-summary-fill                before=#BD2F2F   after-pin("#00FF00")=#BD2F2F
--tv-container-border-radius     before=8px       after-pin("17px")=8px
--tv-text-muted                  before=#4A4444   after-pin("#00FF00")=#00FF00   ← control
```

Failure scenario: an author writes
`th |> set_pin("--tv-container-border-radius", "16px")`, gets a warning that
*confirms* the pin was taken, sees no change, and has no way to tell whether
the token or the renderer is at fault. Same for the TS `pinTokenByName` /
wire-imported `pins`. `set_spacing()` is the working route for the 14 spacing
tokens; the other 7 have no route at all.

Minimum fix without re-architecting: have `set_pin` / `parseThemeWire` reject
tokens in the `density` and `live-config` resolver groups with a message naming
the real verb. (The manifest already has the `pinnable` field DEFERRED for
exactly this — `component-tokens.ts:181-190`.)

### a-3 · CONFIRMED — `inspect_token()`, `list_component_tokens(theme)` and `contrast_report()` report the wrong values for any customized theme

All three call `resolveFromInputs` (`authoring/index.ts:231` →
`resolveTheme(createWire(inputs,"inspect"))`) — a wire with **empty
roleOverrides, no components, no pins**, and no `theme.spacing`, so no spacing
overlay either. Their sibling `theme_css_vars` was fixed for this
(`R/v4-inspect.R:120`, comment: "so pinned roles resolve in the inspected
cssVars exactly as they paint"); these three were not.

Verified in R:

```r
th2 <- set_role(web_theme_nejm(), "text-muted", "brand", 8)
theme_css_vars(th2)[["--tv-text-muted"]]                      # "#BD403C"  (painted)
inspect_token(th2, "--tv-text-muted")$resolved                # "#4A4444"  (WRONG)
list_component_tokens(th2)$resolved[…"--tv-text-muted"]       # "#4A4444"  (WRONG)

th3 <- set_spacing(web_theme_nejm(), row_height = 44)
theme_css_vars(th3)[["--tv-spacing-row-height"]]              # "44px"
list_component_tokens(th3)$resolved[…row-height]              # "24px"     (WRONG)

th4 <- set_pin(web_theme_nejm(), "--tv-text-muted", "#00FF00")
theme_css_vars(th4)[["--tv-text-muted"]]                      # "#00FF00"
contrast_report(th4)[4, ]  # muted text on surface → fg=#4A4444 (the UNPINNED colour)
```

The `contrast_report` case is the worst: it is the a11y check, and it is blind
to exactly the edit most likely to break contrast. Note the *build-time*
validator does catch it (`validateResolvedTheme` fired on `set_pin` above), so
this is an inspection-surface lie rather than an unguarded hazard — but a user
who runs `contrast_report()` to confirm a fix will get a false all-clear.

Fix shape: route all three through `buildTheme(inputs, opts) + getCssVars` like
`theme_css_vars` does, or extend `resolveFromInputs` to accept the same
`.theme_v8_opts` bag.

### a-4 · CONFIRMED — the store's theme rebuild drops `theme.components` (and `webFonts`)

`rebuild()` (`stores/slices/theme.svelte.ts:313-338`) is documented as "the
single site where the 'roleOverrides + pins MUST ride every rebuild' invariant
lives (the final-review P1 bug was three copies drifting)". Its options bag has
`inputs`, `roleOverrides`, `pins`, `remeasure`, `skipValidation` — and **no
`components`**. The `buildTheme` call at `:325` therefore never passes the
carried `carried.components`, and `buildTheme` only stamps `components` onto
the built theme when it is non-empty (`theme-adapter.ts:385`) — so the key
disappears entirely.

Every settings-panel edit routes through `rebuild` (`setAuthoringInputs` `:342`,
`previewAuthoringInputs` `:363`, `setThemeRoleOverride` `:392`,
`clearThemePin` `:370`, `setSpacingOverride` → `setAuthoringInputs`).

Failure scenario: R author ships
`th <- set_component(web_theme_nejm(), "title", col = "accent-text")`;
the re-route paints correctly on first render; the reader opens the settings
cog and nudges the density dial (or ANY control); the title silently reverts to
its default role and the re-route is gone from the exported theme.

Same omission at `svelte/TabvizPlot.svelte:215` — the high-contrast rebuild
passes `roleOverrides` and `pins` but not `components`, so toggling the
contrast button wipes re-routes on every token that does NOT declare
`modes.hc` (the ratchet would beat the re-route only on those that do).

`components/ui/ThemeSwitcher.svelte:117` and `studio/StudioChart.svelte:64` DO
pass `components`, which is what makes the omission look like an oversight
rather than a policy.

Secondary, same root: `buildTheme` hardcodes `webFonts: []`
(`theme-adapter.ts:381`), so `rebuild` also drops the theme's web-font list.
In-session this is masked because the injector never removes an already-added
`<link>` (`TabvizPlot.svelte:296` "never remove"), and `webFonts` is not part of
the portable envelope — so severity is low, but the loss is real for any
consumer that re-reads `theme.webFonts` after an edit
(`ThemeSwitcher.svelte:193` does).

*Verification:* code reading + the asymmetry with the two call sites that do it
correctly. Not reproducible from R alone (needs the browser store).

### a-5 · SUSPECTED — `spacing_overrides` never reach `toDtcg`

`toDtcg` (`dtcg-adapter.ts:70`) resolves with
`resolveTheme({...createWire(inputs,name), roleOverrides, components})` and
emits `resolved.cssVars[token.cssVar]` for the whole manifest (`:101-108`).
Since the density group resolves from `density × density_factor` only (§6),
the 14 `--tv-spacing-*` entries in the exported DTCG document carry the
PRE-override px. Pins are likewise not applied to the emitted `$value`s (they
ride `$extensions` only).

Round-tripping is unaffected (`fromDtcg` restores from `$extensions`), so this
only misleads a downstream tool (Figma / Style Dictionary) reading the
human-facing `component` group. Labelled SUSPECTED because I did not run the
DTCG export end-to-end; the code path is unambiguous but the intended contract
for the `component` group ("resolved values" vs "cascade values") is not
written down anywhere.

### a-6 · SUSPECTED — R `theme_from_wire` accepts pin keys the TS ingress rejects

`parseThemeWire` (`theme-wire-parse.ts:108`) errors on any pin key not starting
with `--tv-`. R's `theme_from_wire` (`R/theme-wire-import.R:347-356`) validates
only the pin VALUE grammar; a key like `background` rides into `theme@pins`,
into `theme_to_wire()` output, and is then silently dropped by
`applyTokenPins`'s name gate (`consumer-bridge.ts:121`) — but the round-tripped
envelope is now un-importable by `parseThemeWire`. R's `set_pin` additionally
checks manifest membership (`R/themes-api.R:1380`), which neither wire ingress
does; the three surfaces enforce three different pin-key rules. Also note R's
value check permits `""` (`nchar(v) > 512` only) where `isValidPinValue`
requires `v.length > 0`.

---

## (b) Brittle or problematic logic

### b-1 · The emission-path lockstep is structural, and only structural

`getCssVars` and `_emitV4CssVarsBody` agree because both funnel through
`getCssVarsRaw` and both call `applySpacingPins`. Nothing asserts the RESULT is
the same. They already differ in *order*: `getCssVars` applies
live-config-then-spacing, the CSS path applies spacing-then-live-config
(as a later declaration block). That is inert only because the two token sets
happen not to intersect. The moment `computeLiveConfigVars` grows a
`--tv-spacing-*` or `--tv-plot-*` entry — or `applySpacingPins` grows a
`--tv-container-*` entry — the DOM and the export will disagree and no test
will notice. A five-line gate (`Object.entries(getCssVars(t))` ⊆ the parsed
`buildThemeCSS(t)` declarations) would close it permanently.

Related: `_buildThemeCSSImpl` calls the full `getCssVars(theme)`
(`theme-css.ts:120`) solely to read `--tv-accent` for `computeLiveConfigVars`,
which is one whole spread + spacing overlay per theme-CSS build.

### b-2 · `cssVarsBridgeCache` bakes in mutable blob fields

`getCssVars` caches `base + computeLiveConfigVars(theme, base)` keyed on the
**theme object identity** (`consumer-bridge.ts:167-189`), while deliberately
keeping the spacing overlay out of the cache "because they're per-figure".
But `computeLiveConfigVars` reads `theme.series[0].fill/.stroke` and
`theme.layout.containerBorder/-Radius` — blob fields on exactly the same
mutability footing as `theme.spacing`. An in-place
`spec.theme.layout.containerBorder = true` (the same v3-compat pattern
`applySpacingPins` exists to honour) returns a stale border forever. Today the
browser only reaches `layout` through `writeThemePath`, which rebuilds
immutably, and R re-serializes; so this is latent, not live. If you ever add a
live-config token, put it on the same "fresh per call" footing as spacing.

### b-3 · `KNOWN_UNCONSUMED` is the load-bearing honesty signal for three
separate systems, and the drift gate cannot maintain it

`KNOWN_UNCONSUMED` (34 entries) gates: the drift test, `COMPONENT_ROSTER`'s
channel filter (`component-bindings.ts:114`), and `StylingTab.svelte:35`'s
role-remap surface. But the drift gate can only mark a token unconsumed when
its *name string* appears nowhere under six directories — and it counts the
resolver's own `switch` arm, a teaching-viz preview, and the token inspector as
consumers. So a token can be genuinely dead and still be absent from
`KNOWN_UNCONSUMED`, which then silently promotes it to an editable component
channel (Finding a-1). Any future change that adds another non-rendering
`--tv-*` consumer (a new inspector, a new preview panel) widens the hole.

The durable fix is to stop asking "does the string appear" and start asking
"does a RENDERER read it": scan only `svelte/`, `components/{forest,table,
controls,split}/`, `export/`, `schema/`, `lib/theme/theme-runtime.css` — and
verify `consumedBy` against that set instead of ignoring it.

### b-4 · Spacing overrides ride TWO independent transports between R and TS

R serializes both `blob$authoringInputs.spacing_overrides` (the input) AND
`blob$spacing` (the resolved cluster, `R/utils-serialize-resolved.R:100-124`,
all 15 slots, always non-NA after a V8 resolve). TS then applies the cluster via
`applySpacingPins`. They agree today only because `theme@spacing` is populated
from the same V8 resolve. Two ways to break it: (1) `set_theme_field(theme,
c("spacing","row_height"), 50)` writes the cluster but not the input — it works
for one render and is silently reverted by the next `re_resolve`; (2) any future
divergence between the R spacing slots and `applySpacingOverrides` produces a
figure whose CSS and whose object-path consumers disagree.

### b-5 · `spacing_overrides` bounds are enforced with two different policies

`validateThemeInputs` (`theme-validate.ts:380-393`) **throws** on an
out-of-bounds value; `clampSpacing` (`spacing-tokens.ts:79`) **clamps**;
`applySpacingOverrides` (`:111`) filters only non-finite and applies anything
else unclamped. The store clamps before writing so the throwing validator never
sees a bad value from the panel — but a wire whose `spacing_overrides.rowHeight`
is 500 aborts the whole import instead of clamping, while the same value set
through a drag would have been silently clamped to 120. Pick one policy.

### b-6 · `groupPadding` is a roster member with no cssVar and no reader

`groupPadding` is in `SPACING_TOKEN_KEYS` (`spacing-tokens.ts:32`),
`SPACING_TOKEN_BOUNDS`, `TABVIZ_SPACING_TOKENS`, `SpacingTokens`, `DENSITY_PX`
and `SPACING_WIDTH_FIELDS` (`stores/slices/theme.svelte.ts:55`) — but
`applySpacingPins` emits no `--tv-spacing-group-padding` and nothing reads
`theme.spacing.groupPadding` (the identically-named locals in
`stores/slices/columns.svelte.ts:623` and `export/svg-generator.ts:394` both
read `--tv-spacing-column-group-padding`). `SpacingTab.svelte:51-58` correctly
excludes it from the UI with an explicit note. But `set_spacing(th,
group_padding = 30)` still validates, round-trips and does nothing — a dead
knob reachable from R and from any hand-written wire. Either wire a reader or
drop it from the roster (which the sync gate will then enforce on all four
sides).

### b-7 · `theme-adapter.ts:271` is the ONLY injection point for spacing overrides

The comment there is right that this is a single source — but it is a single
source *only for consumers that go through `buildTheme`*. `resolveTheme`,
`toDtcg`, `resolveFromInputs` and `inspectToken` all bypass it (a-3, a-5). A
future "resolve spacing in the cascade" refactor is the correct fix; until then
any new `resolveTheme` caller inherits the bug silently.

---

## (c) Poorly-written or redundant code

### c-1 · `sanitizeSpacingOverrides` has zero callers

`spacing-tokens.ts:90` is documented as the ingress guard ("Sanitize a raw
`spacing_overrides` record at ingress"). Grep across `srcjs/src` finds it
referenced only in its own module docstring, in `theme-adapter.ts:270`'s comment,
and in `spacing-tokens.test.ts`. The real ingresses use `validateThemeInputs`
(throw), `clampSpacing` (store), and the R S7 validator. Either wire it into
`parseThemeWire` / `theme_inputs_from_wire` or delete it — a documented-but-
uncalled validator is worse than none, because the next reader assumes coverage.

### c-2 · `setComponentChannel` / `clearComponentChannel` are store verbs with no caller

`stores/slices/theme.svelte.ts:532` and `:546`, exposed on the public store
interface (`:138`, `tabvizStore.svelte.ts:1171`). The only components UI,
`components/ui/settings/ComponentsEditor.svelte`, is mounted **exclusively by
`studio/StudioShell.svelte:208`** and driven by the studio store — its own
header comment claims "Two hosts: ComponentsBand (settings panel …) and the
studio", but `ComponentsBand` no longer exists (superseded by the settings
redesign). knip cannot see this because the verbs are on the public store
surface. They also write via `writeThemePath(["components"], …)` rather than a
`buildTheme` rebuild, which is the one path that currently survives a-4 —
so the dead verbs are simultaneously the only *correct* ones.

### c-3 · `theme-resolve.ts` vs `resolve-theme.ts` — two files, near-identical names, different eras

`theme-resolve.ts` is the ramp/token/structure builder consumed by
`buildTheme`; `resolve-theme.ts` is the v4 manifest cascade. Nothing in either
filename distinguishes them, and `theme-resolve.ts:18` imports
`applyPolarityToInputs` FROM `resolve-theme.ts`, so the dependency runs
backwards from what the names suggest. Renaming to `ramps-and-structure.ts` /
`cascade.ts` would cost one commit and remove a permanent trip hazard.

### c-4 · The `consumer-bridge` name and docstring no longer describe the module

Its header (`consumer-bridge.ts:1-23`) says it is a migration shim that "once
all consumers have migrated … gets deleted". It is now the canonical cssVars
entry point (`getCssVars`), the pin-security chokepoint (`isValidPinValue`,
`applyTokenPins`), and the spacing-overlay owner (`applySpacingPins`) — none of
which is temporary. The 20-odd `readXxx()` helpers at `:365-430` are documented
as "V3→V4 cutover helpers" whose literal fallbacks "never fire in production"; a
future agent reading this file will believe it is scheduled for deletion.

### c-5 · `applySpacingPins` does three unrelated jobs and says so only in its name's plural

It stamps 14 spacing tokens, 3 plot dims, and (per its own docstring)
`theme.row.borderWidth` — which it does NOT actually do; the docstring at
`consumer-bridge.ts:196-198` is stale. The plot-dim block (`:235-237`) re-checks
`!== undefined` even though `pin()` already returns early on `undefined`.

### c-6 · `--tv-header-light-*` / `-tint-*` / `-fill-*` duplicate `--tv-header-bg/-fg/-rule`

The manifest comment at `component-tokens.ts:1216-1220` states the intent
("expose all three flavors; these 'active' tokens are the chosen one"), and the
`header-active` resolver comment (`resolve-theme.ts:601-604`) claims "one source
of truth". They are in fact two hardcoded copies of the same role mapping — the
per-variant tokens list `surface`/`fill`/`brand-solid` + `text`/`text-onsolid`
in the manifest, the resolver repeats the mapping inline. Nothing gates that
they agree, and a re-route applied to one is invisible to the other (a-1 §1).
Deriving the active token from the variant token (or deleting the six variant
tokens and their roster states) would collapse the duplication.

### c-7 · `--tv-row-emphasis-bg/-fg` and `theme.row.emphasis.bg = null`

The emphasis paint token has two independent representations: a manifest token
sourced from role `highlight-bg` that nothing paints, and an object-path bundle
whose `bg` is hardcoded `null` (`theme-adapter.ts:317-322`) — i.e. the feature
resolves to "no wash" while the cascade computes a wash nobody uses. Whichever
one is meant to win, the other should go.

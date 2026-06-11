# @tabviz/core

**JavaScript runtime + authoring API for tabviz** — the publication-quality
forest plots and rich interactive tables otherwise consumed via the
[`tabviz` R package](https://github.com/kaskarn/tabviz).

> **Status: 0.6.0 — pre-1.0, wire FROZEN at 1.10** (additive minors
> only from here). Authoring API (function builders mirroring R's
> `tabviz()` / `col_*()` / `viz_*()`), nine curated themes, the
> component-model editing verbs, and a published JSON Schema
> (`dist/tabviz-spec.schema.json`) all ship. See
> [`docs/dev/r-ts-parity-notes.md`](https://github.com/kaskarn/tabviz/blob/main/docs/dev/r-ts-parity-notes.md)
> for per-helper R↔TS parity status and known gaps.

## Quick start — build a spec, mount it

```ts
import {
  tabviz, createTabviz,
  colText, colInterval, vizForest,
} from "@tabviz/core";
import "@tabviz/core/style.css";

const spec = tabviz({
  data: rows,
  label: "study",
  theme: "nejm",
  columns: [
    colText({ field: "study", header: "Study" }),
    colInterval({ point: "hr", lower: "lcl", upper: "ucl" }),
    vizForest({ point: "hr", lower: "lcl", upper: "ucl", scale: "log" }),
  ],
  title: "Hazard ratios across studies",
});

const instance = createTabviz(document.querySelector("#plot")!, spec);
```

`tabviz()` returns a `WebSpec` (the wire-format payload). `createTabviz`
mounts it. Every R helper has a TS mirror — argument names + defaults
match; snake_case in R → camelCase in TS.

## What this package will publish

`@tabviz/core` exposes five subpaths over a single versioned npm
package — one repo, one version, one source of truth.

| Subpath | What it exports | Who reaches for it |
|---|---|---|
| `@tabviz/core` | `createTabviz`, `createSplitTabviz` factories + wire-format types | Web-app consumers wanting visual parity with R-rendered tabvizes; vanilla TS/JS in any framework |
| `@tabviz/core/svelte` | `ForestPlot`, `SplitForestPlot` components, `createForestStore` factories | Svelte consumers composing the components directly |
| `@tabviz/core/export` | `exportToSVG`, `exportToPNG`, `computeNaturalDimensions` | Headless rendering pipelines (V8, node-rsvg, server-side export) |
| `@tabviz/core/spec` | TypeScript types + JSON Schema (`v1.0.json`) | Consumers validating wire payloads |
| `@tabviz/core/htmlwidgets` | R-side htmlwidgets adapters | The R package's vendored build artifacts (not for direct npm use) |

## Installation

```sh
npm install @tabviz/core svelte
```

Svelte is the underlying component runtime. You don't write Svelte
code — `createTabviz` returns a plain imperative handle — but the
main entry and the `/svelte` subpath both need Svelte 5 installed as
a peer. The `/export` and `/spec` subpaths are framework-free and
work without it.

## Driving the mounted widget

```ts
import { createTabviz } from "@tabviz/core";
import "@tabviz/core/style.css";

const instance = createTabviz(document.querySelector("#plot")!, spec, {
  width: 800,
  height: 600,
});

instance.on("selected", (rowIds) => console.log("selection:", rowIds));
instance.sortBy({ column: "estimate", direction: "asc" });
instance.setTheme("terminal");   // live theme swap
instance.update(nextSpec);       // data/spec update (state survives by id)
instance.destroy();
```

## Themes

Nine curated presets ship as zero-arg factories — `themeNejm()`
(default), `themeLedger()`, `themeBrutalist()`, `themeAurora()`,
`themeTerminal()`, `themeNewsprint()`, `themeBlueprint()`,
`themeSynthwave()`, `themeDwarven()` — or pass the preset name as a
string (`theme: "nejm"`). To author your own, give `buildTheme` Tier-1
inputs (anchors, fonts, geometry) and let the cascade derive the rest:

```ts
import { buildTheme, buildThemeWire, parseThemeWire, getThemeCSS } from "@tabviz/core";

const inputs = {
  anchors: {
    paper: { L: 0.98, C: 0.005, H: 90 },   // OKLCH
    ink:   { L: 0.22, C: 0.01,  H: 270 },
    brand: { L: 0.55, C: 0.12,  H: 250 },
  },
};
const house = buildTheme(inputs, { name: "house" });  // resolved theme → tabviz({ theme: house })

// Portable artifact round-trip (share/store/re-import):
const wire   = buildThemeWire(inputs, "house");       // {$schema: "tabviz-theme/v4", …}
const parsed = parseThemeWire(JSON.stringify(wire));  // THE validating ingress — never raw JSON.parse
const back   = buildTheme(parsed.inputs, {
  name: parsed.name,
  roleOverrides: parsed.roleOverrides,
  pins: parsed.pins,
  components: parsed.components,
});
const css = getThemeCSS(back);                        // the resolved token sheet
```

Themes travel as a portable envelope (`tabviz-theme/v4`) carrying
authoring inputs + role re-tunes + component re-routes + pins — the
same three editing verbs the in-widget settings panel and the studio
use. Always re-enter through `parseThemeWire`; it validates untrusted
wires at ingress.

## Validating specs (the LLM/codegen path)

The published artifact ships its JSON Schema at
`@tabviz/core/dist/tabviz-spec.schema.json` (2020-12 dialect): the
hand-written top-level shape plus per-column-type option definitions
generated from the schema registry. Unknown column types stay valid
(additive minors); known types must satisfy their definitions. The
`scripts/consumer-fixture.mjs` gate exercises the full third-party
journey — author → schema-validate → headless SVG — against `dist/` on
every `build:npm`.

Spec shape is defined in `@tabviz/core/spec`; validate payloads against
the shipped `dist/tabviz-spec.schema.json` (see "Validating specs"
above).

## Wire-format versioning

Every `WebSpec` carries an explicit `version` field. The runtime
validates it on every render. See
[`docs/dev/versioning.md`](../docs/dev/versioning.md) for the SemVer
policy and minor-evolution rules.

## Consuming from non-Svelte frameworks

The `createTabviz` factory returns a typed
[`TabvizInstance`](src/core/createTabviz.ts) with `update`, `sortBy`,
`applyFilter`, `selectRows`, `setSemantic`, `setTheme`, `setZoom`,
`setAspectRatio`, `on` (typed event subscriptions), `destroy`. Internally
it mounts the Svelte components into the host element; from the React /
Vue / Solid side you treat the host element + instance handle as an
opaque imperative widget. You still install Svelte as a peer dep (the
runtime is bundled-less so the consumer's app and `@tabviz/core` share
the same Svelte instance).

## Source layout

| Path | Purpose |
|---|---|
| `src/core/` | Framework-agnostic factories (`createTabviz`, `createSplitTabviz`) |
| `src/svelte/` | Top-level Svelte components published as `/svelte` |
| `src/export/` | Pure-function SVG/PNG generators + V8 shim |
| `src/spec/` | TypeScript types + JSON Schema per minor |
| `src/htmlwidgets/` | R-side htmlwidgets adapters (Shiny proxy, message channels) |
| `src/stores/` | Svelte 5 reactive stores |
| `src/lib/` | Cross-cutting utilities (formatters, scales, banding, etc.) |
| `src/components/` | Internal sub-components (controls, viz, table cells) |

The `lib/` and `components/` trees are implementation details bundled
into the published chunks; they're not part of the public subpath
surface.

## Building

Four build paths produce four artifact sets:

```sh
npm run build           # the three R-side IIFE bundles
npm run build:widget    # inst/htmlwidgets/tabviz.js
npm run build:split     # inst/htmlwidgets/tabviz_split.js
npm run build:v8        # inst/js/svg-generator.js
npm run build:npm       # dist/ ESM bundles + style.css + .d.ts types
```

R-side bundles ship vendored inside `inst/` for `htmlwidgets` consumers.
The npm path emits per-subpath ESM into `dist/`:

```
dist/
├── index.mjs          # @tabviz/core entry
├── svelte.mjs         # @tabviz/core/svelte entry
├── export.mjs         # @tabviz/core/export entry
├── spec.mjs           # @tabviz/core/spec entry
├── style.css          # standalone CSS for npm consumers
├── chunks/            # shared chunks
├── core/, svelte/, export/, spec/, …   # emitted .d.ts trees
```

`build:npm` runs vite, then `tsc --emitDeclarationOnly`, then a small
postprocessor (`scripts/rewrite-dts-aliases.mjs`) that rewrites the
internal `$lib`/`$stores`/`$types`/… aliases in the published .d.ts
files to relative paths so npm consumers don't need our `tsconfig.paths`.

### CI gates

Two scripts gate publish-readiness:

```sh
npm run check:size       # fails on any bundle >10% over budget
npm run check:lockfiles  # validates package-lock.json + bun.lock both sync with package.json
```

The size budget lives in `bundle-size-budget.json` (raw bytes,
intentional growth is bumped in the same PR with justification).

### Toolchain

The build artifact ships from **npm** (`npm ci` in CI, `package-lock.json`
is canonical). Local development with `bun` is supported and tracked —
`bun.lock` is checked in so `bun install` + `bun test` work fast, but
the published artifact is built from `package-lock.json`. The two
lockfiles must agree on resolved versions; `npm run check:lockfiles`
gates this in CI.

## Testing

```sh
npm test               # bun + vitest
npm run test:bun       # bun only — pure-TS tests
npm run test:vitest    # vitest — Svelte-runes tests (.runes.ts)
```

Bun runs the bulk of fast pure-TS tests. Vitest runs tests that need
the Svelte 5 runes compiler — those live under `*.runes.ts` so bun's
default `*.{test,spec}.ts` glob skips them.

## Related

- [tabviz R package README](../README.md) — the primary consumer surface
- [Frontend split spec](../docs/dev/frontend-split-spec.md) — program plan
- [Wire-format versioning](../docs/dev/versioning.md) — SemVer policy
- [Event contract](../docs/dev/event-contract.md) — typed event reference
- [Source tagging](../docs/dev/source-tagging.md) — Shiny envelope contract
- [Spec fields reference](../docs/dev/spec-fields-reference.md) — which `WebSpec` fields are general vs forest-specific vs viz-family
- [R ↔ JS sync points](../docs/dev/r-js-sync-points.md) — every cross-side mirror and its sync mechanism

# @tabviz/core

**JavaScript runtime for tabviz** — the publication-quality forest plots
and rich interactive tables otherwise consumed via the
[`tabviz` R package](https://github.com/kaskarn/tabviz).

> **Status: pre-publication.** This source tree lives in the R package's
> `srcjs/` directory and produces three artifacts vendored into `inst/`
> for R consumers. The npm `@tabviz/core` package is targeted at v1.0;
> see [`docs/dev/frontend-split-spec.md`](../docs/dev/frontend-split-spec.md)
> for the program plan. Until publish, the surface and subpath shape
> documented here are stable but the dist artifacts are reachable only
> through the R package.

## What this package will publish

When `@tabviz/core` ships, it exposes five subpaths over a single
versioned npm package — one repo, one version, one source of truth.

| Subpath | What it exports | Who reaches for it |
|---|---|---|
| `@tabviz/core` | `createTabviz`, `createSplitTabviz` factories + wire-format types | Web-app consumers wanting visual parity with R-rendered tabvizes; vanilla TS/JS in any framework |
| `@tabviz/core/svelte` | `ForestPlot`, `SplitForestPlot` components, `createForestStore` factories | Svelte consumers composing the components directly |
| `@tabviz/core/export` | `exportToSVG`, `exportToPNG`, `computeNaturalDimensions` | Headless rendering pipelines (V8, node-rsvg, server-side export) |
| `@tabviz/core/spec` | TypeScript types + JSON Schema (`v1.0.json`) | Consumers validating wire payloads |
| `@tabviz/core/htmlwidgets` | R-side htmlwidgets adapters | The R package's vendored build artifacts (not for direct npm use) |

No framework assumptions on the main entry — `createTabviz` works in
any TS/JS environment. The `/svelte` subpath is for consumers who want
to compose the Svelte components directly.

## Quick start (preview)

```ts
import { createTabviz } from "@tabviz/core";
import "@tabviz/core/style.css";

const instance = createTabviz(document.querySelector("#plot")!, spec, {
  width: 800,
  height: 600,
});

instance.on("selected", (rowIds) => console.log("selection:", rowIds));
instance.sortBy({ column: "estimate", direction: "asc" });
```

Spec shape is defined in `@tabviz/core/spec`; you can validate against
the JSON Schema (one schema file per minor version — currently
`v1.0.json`).

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
opaque imperative widget.

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
npm run test:vitest    # vitest — Svelte-runes tests (.svelte.test.ts)
```

Bun runs the bulk of fast pure-TS tests. Vitest runs tests that need
the Svelte 5 runes compiler (`.svelte.test.ts` files).

## Related

- [tabviz R package README](../README.md) — the primary consumer surface
- [Frontend split spec](../docs/dev/frontend-split-spec.md) — program plan
- [Wire-format versioning](../docs/dev/versioning.md) — SemVer policy
- [Event contract](../docs/dev/event-contract.md) — typed event reference
- [Source tagging](../docs/dev/source-tagging.md) — Shiny envelope contract

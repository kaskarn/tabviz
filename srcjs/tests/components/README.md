# tabviz component harness

A browseable scaffold that mounts a single component against a
synthetic state, exposes that state + an interaction log to puppeteer,
and supports per-component screenshot regression.

Pairs with the existing widget-level harnesses:

| Harness | Layer | Use when |
|---|---|---|
| `tests/components/` *(this)* | one component, isolated | designing primitives, asserting state transitions on UI interactions, screenshot diff of a single component |
| `tests/visual-browser/` | full widget render | end-to-end DOM render regression across gallery specs |
| `tests/perf/`, `tests/browser/` | algorithmic + mount perf | benchmarking |

## Quick start

```bash
cd srcjs

# Dev — Vite serve with HMR; open http://localhost:4477/harness.html
npm run dev:harness

# Build the static harness app
npm run build:harness

# Drive a scenario from puppeteer, dump state + log
npm run harness:drive -- toggle
npm run harness:drive -- toggle --interact 'role=switch'
npm run harness:drive -- toggle --screenshot /tmp/toggle.png
```

The harness URL routes by hash: `harness.html#toggle`,
`harness.html#segmented`, etc. Each scenario maps 1:1 to a
`scenarios/<Name>.scenario.svelte` file.

## Layout

```
tests/components/
  harness.html            entry HTML
  main.ts                 mounts Host into #app
  Host.svelte             3-pane shell (picker / stage / state+log)
  harness-store.svelte.ts shared reactive state + log + window.__harness
  scenarios/
    _index.ts             scenario registry + grouping
    Toggle.scenario.svelte
    Segmented.scenario.svelte
    FieldRow.scenario.svelte
    ...                   one per primitive / composite under test
  drive.mjs               puppeteer driver
  dist/                   build output (gitignored)
```

## Writing a scenario

A scenario is a small Svelte component that mounts the under-test
component, owns local reactive variables, and mirrors them into the
shared harness store. The store exposes `state` and `log` to the
inspector panes and to `window.__harness`.

```svelte
<!-- scenarios/Foo.scenario.svelte -->
<script lang="ts">
  import Foo from "../../../src/components/primitives/Foo.svelte";
  import { state, recordChange } from "../harness-store.svelte";

  let count = $state(0);

  $effect(() => {
    if (state.count !== count) {
      const before = state.count;
      state.count = count;
      recordChange("count", before, count, "increment");
    }
  });
</script>

<Foo bind:value={count} />
```

Register it in `scenarios/_index.ts`:

```ts
import FooScenario from "./Foo.scenario.svelte";

export const SCENARIOS: ScenarioMeta[] = [
  // ...existing
  {
    name: "foo",
    description: "Foo — one-line summary.",
    group: "Primitives",  // bucket label in the picker
    component: FooScenario,
  },
];
```

That's it. Run `npm run dev:harness` to see it in the picker.

## Puppeteer API

The harness wires `window.__harness` on mount:

```ts
window.__harness = {
  getState():    Readonly<Record<string, unknown>>;
  getLog():      readonly HarnessLogEntry[];
  clearLog():    void;
  reset():       void;            // state + log to empty
  setScenario(name: string): void; // navigate
};
```

`HarnessLogEntry` is `{ t, kind, path, before, after }` — `t` is
millis since harness boot (monotonic; deterministic across runs of
the same scenario length).

DOM testids on the inspector panes:

- `[data-testid="harness-state"]` — `<pre>` containing pretty JSON of state
- `[data-testid="harness-log"]`   — log rows container

## Integration with existing regression

Per-scenario screenshot baselines + diffs can layer on top of the
existing `tests/visual-browser/snapshot.mjs` pattern. (Not wired yet
— pending a concrete need.) The state+log assertion model is
better-suited for "did this interaction produce the right change"
checks; pixel diff is better for "did the visual rendering shift."
Both can coexist.

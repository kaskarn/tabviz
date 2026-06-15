// Split-payload ingress contract. R hoists the wire `version` to the payload
// ROOT (not into `base`), and each per-pane override carries only data/labels/
// paginate. setPayload reconstitutes full WebSpecs by merging base+override —
// it MUST stamp the root version onto each pane, or the ingress wall (added
// 2026-06-15) would reject every real split pane with "version-missing".
// This locks that hoisting + the validate-and-throw-clearly contract.
// Vitest (not bun): the store + buildTheme pull oklch → @stdlib.

import { describe, test, expect, beforeAll } from "vitest";
import { createSplitTabvizStore } from "./splitTabvizStore.svelte";
import { bootBuiltinBehaviors } from "../schema/init";
import { buildTheme } from "../lib/theme/theme-adapter";
import { NEJM } from "../lib/theme/theme-presets-inputs";
import type { SplitForestPayload } from "$types";

let theme: ReturnType<typeof buildTheme>;
beforeAll(() => {
  bootBuiltinBehaviors();
  theme = buildTheme(NEJM, "nejm");
});

// Mirrors R serialize_split_table: version at the ROOT, shared blocks hoisted
// into `base`, per-pane entries carrying only data (+ labels/paginate).
const hoistedPayload = (over: Partial<SplitForestPayload> = {}): SplitForestPayload =>
  ({
    version: "1.10",
    type: "split_table",
    base: {
      columns: [{ id: "c", type: "text", field: "x", header: "X", options: {} }],
      theme,
      interaction: {},
      layout: { plotWidth: "auto" },
    },
    splitVars: ["grp"],
    navTree: [{ label: "A", key: "A", children: null }],
    specs: {
      A: { data: { rows: [{ id: "r0", label: "A", metadata: { x: 1 } }], groups: [], summaries: [] } },
    },
    sharedAxis: false,
    sharedColumnWidths: false,
    ...over,
  }) as unknown as SplitForestPayload;

describe("split payload ingress", () => {
  test("hoisted-base payload (version at root) mounts without throwing", () => {
    const store = createSplitTabvizStore();
    expect(() => store.setPayload(hoistedPayload())).not.toThrow();
    // The first leaf is selected and its reconstituted spec carries the
    // root-hoisted version (proof the merge stamped it).
    expect(store.payload?.specs.A.version).toBe("1.10");
  });

  test("a structurally-invalid pane throws a CLEAR, pane-keyed error", () => {
    const store = createSplitTabvizStore();
    const bad = hoistedPayload({
      // `data.rows` is not an array → error-severity validation issue.
      specs: { A: { data: { rows: "nope" } } } as unknown as SplitForestPayload["specs"],
    });
    expect(() => store.setPayload(bad)).toThrow(/split pane "A"/);
  });
});

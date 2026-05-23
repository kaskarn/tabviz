// Tests for the runtime behavior dispatcher.
//
// Care: built-in schema behaviors are global module state. Calling
// `__resetRuntimeRegistries()` would erase them and break unrelated
// test files. Instead we use unique synthetic schema keys per test so
// nothing collides, and we never reset.

import { describe, test, expect } from "bun:test";
import { dispatch, dispatchForColumn, findSchemaForColumn } from "./dispatch";
import { registerSchema, registerBehaviors, defineSchema } from "./extend";
import type { ColumnSpec } from "../types";

// Make sure built-in schema-behaviors load (viz_*, sort-behaviors).
import "./init";

let synth = 0;
const uniq = (prefix: string): string => `${prefix}_${++synth}`;

describe("findSchemaForColumn", () => {
  test("scalar type → returns matching schema", () => {
    const col = { id: "x", type: "numeric", field: "x", options: {} } as unknown as ColumnSpec;
    const s = findSchemaForColumn(col);
    expect(s?.key).toBe("numeric");
  });

  test("custom-type with `events` bucket → returns events schema", () => {
    const col = {
      id: "e",
      type: "custom",
      field: "events",
      options: { events: { eventsField: "n_events", nField: "n" } },
    } as unknown as ColumnSpec;
    const s = findSchemaForColumn(col);
    expect(s?.key).toBe("events");
  });

  test("unknown type → undefined", () => {
    const col = { id: "x", type: "made_up_type", field: "x", options: {} } as unknown as ColumnSpec;
    expect(findSchemaForColumn(col)).toBeUndefined();
  });
});

describe("dispatch — basic resolution", () => {
  test("returns undefined when no schema in chain defines the behavior", () => {
    // text + base define no sortKey; numeric inherits from text — none either
    expect(dispatch("text", "sortKey")).toBeUndefined();
  });

  test("returns a callable when a schema in the chain defines the behavior", () => {
    // interval registers sortKey in sort-behaviors.ts
    const fn = dispatch("interval", "sortKey");
    expect(fn).toBeTypeOf("function");
  });

  test("dispatched fn reads ctx.row per the schema's options", () => {
    const fn = dispatch("interval", "sortKey");
    expect(fn).toBeTypeOf("function");
    const out = fn!(
      undefined, // value (ignored for interval)
      { interval: { point: "hr" } },
      { row: { hr: 0.85, lcl: 0.7, ucl: 1.02 } },
    );
    expect(out).toBe(0.85);
  });

  test("missing field on row → returns null", () => {
    const fn = dispatch("viz_forest", "sortKey")!;
    expect(fn(undefined, { forest: { point: "missing" } } as never, { row: {} })).toBeNull();
  });
});

describe("dispatch — parents proxy", () => {
  test("leaf delegates to direct parent via parents proxy", () => {
    const base = uniq("p_test_base");
    const leaf = uniq("p_test_leaf");
    registerSchema(defineSchema({
      key: base, label: "Base", abstract: true, bucket: base, options: [],
    }));
    registerSchema(defineSchema({
      key: leaf, label: "Leaf", inherits: base, type: leaf as never, options: [],
    }));

    registerBehaviors(base, { formatValue: (value) => `[base ${String(value)}]` });
    registerBehaviors(leaf, {
      formatValue: (value, opts, ctx, parents) =>
        `<leaf ${(parents[base] as any)(value, opts, ctx)}>`,
    });

    const fn = dispatch(leaf, "formatValue")!;
    expect(fn(42, {}, { row: {} })).toBe("<leaf [base 42]>");
  });

  test("middle ancestor's behavior is reachable via parents proxy", () => {
    const ga = uniq("ga"), pa = uniq("pa"), child = uniq("child");
    registerSchema(defineSchema({ key: ga,    label: "GA",    abstract: true, bucket: ga, options: [] }));
    registerSchema(defineSchema({ key: pa,    label: "PA",    abstract: true, inherits: ga, bucket: pa, options: [] }));
    registerSchema(defineSchema({ key: child, label: "Child", inherits: pa, type: child as never, options: [] }));

    registerBehaviors(ga,    { formatValue: () => "ga" });
    registerBehaviors(pa,    { formatValue: (v, o, c, p) => `pa(${(p[ga] as any)(v, o, c)})` });
    registerBehaviors(child, { formatValue: (v, o, c, p) => `child(${(p[pa] as any)(v, o, c)})` });

    const fn = dispatch(child, "formatValue")!;
    expect(fn(null, {}, { row: {} })).toBe("child(pa(ga))");
  });

  test("dispatcher skips ancestors that don't define the behavior", () => {
    const root = uniq("x_root"), mid = uniq("x_mid"), leaf = uniq("x_leaf");
    registerSchema(defineSchema({ key: root, label: "Root", abstract: true, bucket: root, options: [] }));
    registerSchema(defineSchema({ key: mid,  label: "Mid",  inherits: root, abstract: true, bucket: mid, options: [] }));
    registerSchema(defineSchema({ key: leaf, label: "Leaf", inherits: mid,  type: leaf as never, options: [] }));

    registerBehaviors(root, { formatValue: () => "ROOT" });
    registerBehaviors(leaf, { formatValue: (v, o, c, p) => `L(${(p[root] as any)(v, o, c)})` });

    const fn = dispatch(leaf, "formatValue")!;
    expect(fn(0, {}, { row: {} })).toBe("L(ROOT)");
  });
});

describe("dispatchForColumn", () => {
  test("forwards to dispatch with the resolved schema key", () => {
    const col = {
      id: "e",
      type: "custom",
      field: "events",
      options: { events: { eventsField: "n_events", nField: "n" } },
    } as unknown as ColumnSpec;
    const fn = dispatchForColumn(col, "sortKey");
    expect(fn).toBeTypeOf("function");
    const out = fn!(undefined, col.options, { row: { n_events: 12, n: 100 } });
    expect(out).toBe(12);
  });

  test("returns undefined when column's schema is not found", () => {
    const col = { id: "x", type: "bogus", field: "x", options: {} } as unknown as ColumnSpec;
    expect(dispatchForColumn(col, "sortKey")).toBeUndefined();
  });
});

describe("dispatchRenderer + renderCell", () => {
  test("dispatchRenderer returns undefined when no schema in chain has one", async () => {
    const { dispatchRenderer } = await import("./dispatch");
    // No built-in schemas register a renderer yet (Phase 7e ongoing)
    expect(dispatchRenderer("text")).toBeUndefined();
  });

  test("renderer composes with parents via injected proxy", async () => {
    const { dispatchRenderer } = await import("./dispatch");
    const { registerRenderer } = await import("./extend");

    const root = uniq("r_root"), leaf = uniq("r_leaf");
    registerSchema(defineSchema({ key: root, label: "R Root", abstract: true, bucket: root, options: [] }));
    registerSchema(defineSchema({ key: leaf, label: "R Leaf", inherits: root, type: leaf as never, options: [] }));

    registerRenderer(root, (v) => ({ kind: "text", value: `[root ${String(v)}]` }));
    registerRenderer(leaf, (v, _o, _c, parents) => {
      const inner = parents[root](v, _o, _c) as { value: string };
      return { kind: "text", value: `<leaf ${inner.value}>` };
    });

    const fn = dispatchRenderer(leaf)!;
    const out = fn("x", {}, { cellWidth: 100, rowHeight: 20, row: {}, target: "browser" });
    expect((out as { value: string }).value).toBe("<leaf [root x]>");
  });

  test("renderCell returns null when no renderer is registered", async () => {
    const { renderCell } = await import("./dispatch");
    const col = {
      id: "t", header: "T", field: "v", type: "text",
      align: "left", sortable: false, isGroup: false, width: "auto", options: {},
    } as unknown as ColumnSpec;
    const out = renderCell(col, "hello", {
      cellWidth: 80, rowHeight: 20, row: { v: "hello" }, target: "browser",
    });
    expect(out).toBeNull();
  });

  test("dispatchRenderer separates dom and svg slots", async () => {
    const { dispatchRenderer } = await import("./dispatch");
    const { registerRenderers } = await import("./extend");

    const key = uniq("ds_split");
    registerSchema(defineSchema({ key, label: "DS", type: key as never, options: [] }));
    registerRenderers(key, {
      dom: () => ({ kind: "text", value: "DOM" }),
      svg: () => ({ kind: "text", value: "SVG" }),
    });

    const domFn = dispatchRenderer(key, "dom")!;
    const svgFn = dispatchRenderer(key, "svg")!;
    const ctx = { cellWidth: 80, rowHeight: 20, row: {}, target: "browser" as const };
    expect((domFn(null, {}, ctx) as { value: string }).value).toBe("DOM");
    expect((svgFn(null, {}, ctx) as { value: string }).value).toBe("SVG");
  });

  test("dispatchRenderer falls back per target independently", async () => {
    const { dispatchRenderer } = await import("./dispatch");
    const { registerRenderers } = await import("./extend");

    const key = uniq("ds_one_slot");
    registerSchema(defineSchema({ key, label: "DS1", type: key as never, options: [] }));
    registerRenderers(key, { dom: () => ({ kind: "text", value: "only-dom" }) });

    expect(dispatchRenderer(key, "dom")).toBeTypeOf("function");
    expect(dispatchRenderer(key, "svg")).toBeUndefined();
  });

  test("renderCell applies nodeRules when provided", async () => {
    const { renderCell } = await import("./dispatch");
    const { registerRenderer } = await import("./extend");

    const key = uniq("rc_text");
    registerSchema(defineSchema({ key, label: "RC", type: key as never, options: [] }));
    registerRenderer(key, (v) => ({
      kind: "text", value: String(v), tags: ["primary-cell"],
    }));

    const col = {
      id: key, header: key, field: "v", type: key,
      align: "left", sortable: false, isGroup: false, width: "auto", options: {},
    } as unknown as ColumnSpec;
    const out = renderCell(
      col, "hi",
      { cellWidth: 80, rowHeight: 20, row: { v: "hi" }, target: "browser" },
      { "primary-cell": { text: { weight: "bold" } } },
    );
    expect(out).not.toBeNull();
    const text = out as unknown as { kind: string; style?: { weight?: string } };
    expect(text.style?.weight).toBe("bold");
  });
});

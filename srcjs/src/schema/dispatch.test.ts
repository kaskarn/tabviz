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

// Tests for the lifecycle dispatcher (schema-sprint Phase 7).

import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import {
  createLifecycleState,
  dispatchLifecycle,
} from "./lifecycle-dispatch";
import {
  registerLifecycle,
  registerSchema,
  __resetRuntimeRegistries,
} from "./extend";
import { bootBuiltinBehaviors } from "./init";
import type { ColumnSpec } from "../types";
import type { WidgetContext } from "./render-types";
import "./init";

// Tests register schemas + lifecycle hooks. Wipe + re-boot builtins
// around each test so the runtime registry stays clean for sibling
// test files (other suites rely on init's side-effect registrations
// being live).
beforeEach(() => {
  __resetRuntimeRegistries();
  bootBuiltinBehaviors();
});
afterEach(() => {
  __resetRuntimeRegistries();
  bootBuiltinBehaviors();
});

function widget(): WidgetContext {
  return { root: {} as HTMLElement, columns: [], update: () => {} };
}

function col(id: string, type: string): ColumnSpec {
  return {
    id, header: id, field: id, type: type as ColumnSpec["type"],
    align: "left", sortable: true, isGroup: false, width: "auto",
  } as unknown as ColumnSpec;
}

describe("dispatchLifecycle — column-level hooks", () => {
  test("onColumnCreate fires when a column is added", () => {
    const created: string[] = [];
    registerSchema({
      key: "toy",
      label: "Toy",
      inherits: "base",
      type: "toy" as ColumnSpec["type"],
      bucket: "toy",
      options: [],
    });
    registerLifecycle("toy", {
      onColumnCreate: (c) => { created.push(c.id); },
    });
    const state = createLifecycleState();
    dispatchLifecycle(state, [col("a", "toy")], widget());
    expect(created).toEqual(["a"]);
  });

  test("onColumnDestroy fires when a column is removed", () => {
    const destroyed: string[] = [];
    registerSchema({
      key: "toy",
      label: "Toy",
      inherits: "base",
      type: "toy" as ColumnSpec["type"],
      bucket: "toy",
      options: [],
    });
    registerLifecycle("toy", {
      onColumnDestroy: (c) => { destroyed.push(c.id); },
    });
    const state = createLifecycleState();
    dispatchLifecycle(state, [col("a", "toy"), col("b", "toy")], widget());
    dispatchLifecycle(state, [col("b", "toy")], widget());
    expect(destroyed).toEqual(["a"]);
  });

  test("onColumnCreate cleanup runs on destroy", () => {
    let cleaned = false;
    registerSchema({
      key: "toy",
      label: "Toy",
      inherits: "base",
      type: "toy" as ColumnSpec["type"],
      bucket: "toy",
      options: [],
    });
    registerLifecycle("toy", {
      onColumnCreate: () => () => { cleaned = true; },
    });
    const state = createLifecycleState();
    dispatchLifecycle(state, [col("a", "toy")], widget());
    expect(cleaned).toBe(false);
    dispatchLifecycle(state, [], widget());
    expect(cleaned).toBe(true);
  });
});

describe("dispatchLifecycle — schema-level hooks", () => {
  test("onFirstPresent fires once on the FIRST instance", () => {
    let calls = 0;
    registerSchema({
      key: "toy",
      label: "Toy",
      inherits: "base",
      type: "toy" as ColumnSpec["type"],
      bucket: "toy",
      options: [],
    });
    registerLifecycle("toy", {
      onFirstPresent: () => { calls++; },
    });
    const state = createLifecycleState();
    dispatchLifecycle(state, [col("a", "toy")], widget());
    expect(calls).toBe(1);
    // Adding a second column of the same schema doesn't fire again.
    dispatchLifecycle(state, [col("a", "toy"), col("b", "toy")], widget());
    expect(calls).toBe(1);
  });

  test("onLastRemoved fires when the last instance leaves", () => {
    let removed = 0;
    registerSchema({
      key: "toy",
      label: "Toy",
      inherits: "base",
      type: "toy" as ColumnSpec["type"],
      bucket: "toy",
      options: [],
    });
    registerLifecycle("toy", {
      onLastRemoved: () => { removed++; },
    });
    const state = createLifecycleState();
    dispatchLifecycle(state, [col("a", "toy"), col("b", "toy")], widget());
    dispatchLifecycle(state, [col("a", "toy")], widget());
    expect(removed).toBe(0); // still one instance present
    dispatchLifecycle(state, [], widget());
    expect(removed).toBe(1);
  });

  test("onFirstPresent cleanup runs on onLastRemoved", () => {
    let cleaned = false;
    registerSchema({
      key: "toy",
      label: "Toy",
      inherits: "base",
      type: "toy" as ColumnSpec["type"],
      bucket: "toy",
      options: [],
    });
    registerLifecycle("toy", {
      onFirstPresent: () => () => { cleaned = true; },
    });
    const state = createLifecycleState();
    dispatchLifecycle(state, [col("a", "toy")], widget());
    expect(cleaned).toBe(false);
    dispatchLifecycle(state, [], widget());
    expect(cleaned).toBe(true);
  });

  test("repeated dispatch with the same set is a no-op", () => {
    let calls = 0;
    registerSchema({
      key: "toy",
      label: "Toy",
      inherits: "base",
      type: "toy" as ColumnSpec["type"],
      bucket: "toy",
      options: [],
    });
    registerLifecycle("toy", {
      onColumnCreate: () => { calls++; },
      onFirstPresent: () => { calls++; },
    });
    const state = createLifecycleState();
    const cols = [col("a", "toy"), col("b", "toy")];
    dispatchLifecycle(state, cols, widget());
    const after = calls;
    dispatchLifecycle(state, cols, widget());
    expect(calls).toBe(after);
  });
});

describe("dispatchLifecycle — error containment", () => {
  test("hook errors don't break the dispatch", () => {
    registerSchema({
      key: "toy",
      label: "Toy",
      inherits: "base",
      type: "toy" as ColumnSpec["type"],
      bucket: "toy",
      options: [],
    });
    registerLifecycle("toy", {
      onColumnCreate: () => { throw new Error("boom"); },
    });
    const state = createLifecycleState();
    expect(() => dispatchLifecycle(state, [col("a", "toy")], widget())).not.toThrow();
  });
});

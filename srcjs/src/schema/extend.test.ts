// Tests for the runtime extension API.

import { describe, test, expect, beforeEach } from "bun:test";
import {
  defineSchema,
  registerSchema,
  registerRenderer,
  registerLifecycle,
  registerColumnType,
  getSchema,
  getRenderer,
  getLifecycle,
  allSchemaKeys,
  __resetRuntimeRegistries,
} from "./extend";

beforeEach(() => __resetRuntimeRegistries());

describe("defineSchema", () => {
  test("returns the spec unchanged (typed identity)", () => {
    const s = defineSchema({
      key: "test_x",
      label: "Test X",
      inherits: "base",
      options: [],
    });
    expect(s.key).toBe("test_x");
  });
});

describe("registerSchema", () => {
  test("adds a user schema discoverable by getSchema", () => {
    registerSchema({
      key: "user_foo",
      label: "Foo",
      inherits: "base",
      options: [],
    });
    expect(getSchema("user_foo")?.key).toBe("user_foo");
  });

  test("rejects overriding a built-in schema", () => {
    expect(() =>
      registerSchema({ key: "numeric", label: "Numeric override", options: [] }),
    ).toThrow(/built-in/);
  });

  test("rejects duplicate user registration", () => {
    registerSchema({ key: "user_bar", label: "Bar", inherits: "base", options: [] });
    expect(() =>
      registerSchema({ key: "user_bar", label: "Dup", inherits: "base", options: [] }),
    ).toThrow(/already registered/);
  });
});

describe("registerRenderer", () => {
  test("attaches a renderer to a registered schema", () => {
    registerSchema({ key: "user_r", label: "R", inherits: "base", options: [] });
    const fn = () => ({ kind: "text" as const, value: "hi" });
    registerRenderer("user_r", fn);
    expect(getRenderer("user_r")).toBe(fn);
  });

  test("rejects renderer for unregistered schema", () => {
    expect(() => registerRenderer("ghost", () => ({ kind: "text", value: "" }))).toThrow(
      /no schema/,
    );
  });

  test("allows overriding a built-in renderer", () => {
    const fn = () => ({ kind: "text" as const, value: "override" });
    registerRenderer("numeric", fn);
    expect(getRenderer("numeric")).toBe(fn);
  });
});

describe("registerLifecycle", () => {
  test("attaches lifecycle hooks", () => {
    registerSchema({ key: "user_lc", label: "LC", inherits: "base", options: [] });
    const onFirst = () => {};
    registerLifecycle("user_lc", { onFirstPresent: onFirst });
    expect(getLifecycle("user_lc")?.onFirstPresent).toBe(onFirst);
  });
});

describe("registerColumnType", () => {
  test("registers schema + renderer + lifecycle in one call", () => {
    const schema = defineSchema({
      key: "user_combo",
      label: "Combo",
      inherits: "base",
      options: [],
    });
    const renderer = () => ({ kind: "text" as const, value: "combo" });
    const onFirstPresent = () => {};
    registerColumnType({ schema, renderer, lifecycle: { onFirstPresent } });
    expect(getSchema("user_combo")?.key).toBe("user_combo");
    expect(getRenderer("user_combo")).toBe(renderer);
    expect(getLifecycle("user_combo")?.onFirstPresent).toBe(onFirstPresent);
  });
});

describe("allSchemaKeys", () => {
  test("includes both built-in and user schemas", () => {
    registerSchema({ key: "user_z", label: "Z", inherits: "base", options: [] });
    const keys = allSchemaKeys();
    expect(keys).toContain("numeric");   // built-in
    expect(keys).toContain("user_z");    // user
  });
});

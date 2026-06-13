import { test, expect } from "bun:test";
import { computeLiveConfigVars } from "./v3-bridge-vars";
import {
  resolveContainerBorder,
  CONTAINER_BORDER_DEFAULT,
  CONTAINER_BORDER_RADIUS_DEFAULT,
} from "./layout-defaults";
import type { WebTheme } from "../../types";

test("resolveContainerBorder fills defaults from an absent layout blob", () => {
  expect(resolveContainerBorder(undefined)).toEqual({
    border: CONTAINER_BORDER_DEFAULT,
    radius: CONTAINER_BORDER_RADIUS_DEFAULT,
  });
  expect(resolveContainerBorder(null)).toEqual({
    border: false,
    radius: 8,
  });
});

test("resolveContainerBorder honors present values", () => {
  expect(resolveContainerBorder({ containerBorder: true, containerBorderRadius: 12 })).toEqual({
    border: true,
    radius: 12,
  });
});

// Regression: theme switch crashed with "Cannot read properties of
// undefined (reading 'containerBorder')" because computeLiveConfigVars read
// `theme.layout.containerBorder` raw on a theme whose `layout` blob was
// absent mid-transition. It must default, not throw.
test("computeLiveConfigVars does not throw on a layout-less theme", () => {
  const partial = { name: "x", series: [] } as unknown as WebTheme;
  let vars: Record<string, string> = {};
  expect(() => {
    vars = computeLiveConfigVars(partial, {});
  }).not.toThrow();
  expect(vars["--tv-container-border"]).toBe("none"); // default false → no border
  expect(vars["--tv-container-border-radius"]).toBe("8px");
});

test("computeLiveConfigVars emits the border when layout opts in", () => {
  const themed = {
    name: "x",
    series: [],
    layout: { containerBorder: true, containerBorderRadius: 10 },
  } as unknown as WebTheme;
  const vars = computeLiveConfigVars(themed, {});
  expect(vars["--tv-container-border"]).toBe("1px solid var(--tv-border)");
  expect(vars["--tv-container-border-radius"]).toBe("10px");
});

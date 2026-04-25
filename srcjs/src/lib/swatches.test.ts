import { expect, test, describe } from "bun:test";
import { resolveSwatches } from "./swatches";
import type { WebTheme } from "$types";

function makeTheme(overrides?: Partial<WebTheme["colors"]>): WebTheme {
  const colors = {
    background: "#ffffff",
    foreground: "#1a1a1a",
    primary: "#2563eb",
    secondary: "#64748b",
    accent: "#8b5cf6",
    muted: "#94a3b8",
    border: "#e2e8f0",
    rowBg: "#ffffff",
    altBg: "#f8fafc",
    headerBg: "#ffffff",
    cellForeground: "#1a1a1a",
    headerForeground: "#1a1a1a",
    interval: "#2563eb",
    intervalLine: "#475569",
    summaryFill: "#2563eb",
    summaryBorder: "#1e40af",
    swatches: [],
    ...overrides,
  } as WebTheme["colors"];
  return { colors } as unknown as WebTheme;
}

describe("resolveSwatches", () => {
  test("returns [] when theme is null/undefined", () => {
    expect(resolveSwatches(null)).toEqual([]);
    expect(resolveSwatches(undefined)).toEqual([]);
  });

  test("returns explicit swatches when length-8", () => {
    const sw = ["#111", "#222", "#333", "#444", "#555", "#666", "#777", "#888"];
    const theme = makeTheme({ swatches: sw });
    expect(resolveSwatches(theme)).toEqual(sw);
  });

  test("derives 8-slot palette when swatches missing", () => {
    const theme = makeTheme({ swatches: [] });
    const sw = resolveSwatches(theme);
    expect(sw.length).toBe(8);
    expect(sw[0]).toBe("#2563eb"); // primary
    expect(sw[6]).toBe("#ffffff"); // background
    expect(sw[7]).toBe("#ffffff"); // rowBg
  });

  test("derives 8-slot palette when swatches has wrong length", () => {
    const theme = makeTheme({ swatches: ["#111", "#222"] });
    const sw = resolveSwatches(theme);
    expect(sw.length).toBe(8);
  });
});

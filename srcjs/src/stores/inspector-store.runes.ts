// Stage 3 §2 — Cascade Inspector store tests.

import { expect, test, describe } from "vitest";
import { inspectorStore } from "./inspector-store.svelte";
import { resolveTheme } from "$lib/theme/resolve-theme";
import { createWire } from "$lib/theme/theme-wire";
import { inputsFromHex } from "$lib/theme/theme-presets-inputs";

describe("inspectorStore", () => {
  test("starts closed and empty", () => {
    // Reset to a known state in case prior tests opened it
    inspectorStore.close();
    expect(inspectorStore.state.open).toBe(false);
    expect(inspectorStore.state.cssVar).toBeNull();
    expect(inspectorStore.state.trace).toBeNull();
  });

  test("trace() opens the panel and populates a trace", () => {
    const resolved = resolveTheme(createWire(inputsFromHex({ brand: "#0099CC" }), "t"));
    inspectorStore.trace("--tv-row-base-bg", resolved);
    expect(inspectorStore.state.open).toBe(true);
    expect(inspectorStore.state.cssVar).toBe("--tv-row-base-bg");
    expect(inspectorStore.state.trace).not.toBeNull();
  });

  test("clearTrace() empties the trace but keeps the panel open", () => {
    const resolved = resolveTheme(createWire(inputsFromHex({ brand: "#0099CC" }), "t"));
    inspectorStore.trace("--tv-row-base-bg", resolved);
    inspectorStore.clearTrace();
    expect(inspectorStore.state.open).toBe(true);
    expect(inspectorStore.state.cssVar).toBeNull();
    expect(inspectorStore.state.trace).toBeNull();
  });

  test("close() resets all state", () => {
    const resolved = resolveTheme(createWire(inputsFromHex({ brand: "#0099CC" }), "t"));
    inspectorStore.trace("--tv-row-base-bg", resolved);
    inspectorStore.close();
    expect(inspectorStore.state.open).toBe(false);
    expect(inspectorStore.state.cssVar).toBeNull();
  });
});

// Stage 3 §2 — Cascade Inspector store tests.

import { expect, test, describe } from "vitest";
import { inspectorStore, tryTraceFromEvent } from "./inspector-store.svelte";
import { resolveTheme } from "$lib/theme/resolve-theme";
import { createWire } from "$lib/theme/theme-wire";

describe("inspectorStore", () => {
  test("starts closed and empty", () => {
    // Reset to a known state in case prior tests opened it
    inspectorStore.close();
    expect(inspectorStore.state.open).toBe(false);
    expect(inspectorStore.state.cssVar).toBeNull();
    expect(inspectorStore.state.trace).toBeNull();
  });

  test("trace() opens the panel and populates a trace", () => {
    const resolved = resolveTheme(createWire({ brand: "#0099CC" }, "t"));
    inspectorStore.trace("--tv-row-base-bg", resolved);
    expect(inspectorStore.state.open).toBe(true);
    expect(inspectorStore.state.cssVar).toBe("--tv-row-base-bg");
    expect(inspectorStore.state.trace).not.toBeNull();
  });

  test("clearTrace() empties the trace but keeps the panel open", () => {
    const resolved = resolveTheme(createWire({ brand: "#0099CC" }, "t"));
    inspectorStore.trace("--tv-row-base-bg", resolved);
    inspectorStore.clearTrace();
    expect(inspectorStore.state.open).toBe(true);
    expect(inspectorStore.state.cssVar).toBeNull();
    expect(inspectorStore.state.trace).toBeNull();
  });

  test("close() resets all state", () => {
    const resolved = resolveTheme(createWire({ brand: "#0099CC" }, "t"));
    inspectorStore.trace("--tv-row-base-bg", resolved);
    inspectorStore.close();
    expect(inspectorStore.state.open).toBe(false);
    expect(inspectorStore.state.cssVar).toBeNull();
  });

  test("toggleLearningMode flips the flag", () => {
    const before = inspectorStore.state.learningMode;
    inspectorStore.toggleLearningMode();
    expect(inspectorStore.state.learningMode).toBe(!before);
    inspectorStore.toggleLearningMode();
    expect(inspectorStore.state.learningMode).toBe(before);
  });
});

describe("tryTraceFromEvent", () => {
  test("returns false when no data-tv-token in the ancestor chain", () => {
    inspectorStore.close();
    const resolved = resolveTheme(createWire({ brand: "#0099CC" }, "t"));
    const el = document.createElement("div");
    const event = { target: el } as unknown as Event;
    expect(tryTraceFromEvent(event, resolved)).toBe(false);
  });

  test("returns true and traces when ancestor has data-tv-token", () => {
    inspectorStore.close();
    const resolved = resolveTheme(createWire({ brand: "#0099CC" }, "t"));
    const parent = document.createElement("div");
    parent.setAttribute("data-tv-token", "row-base-bg");
    const child = document.createElement("span");
    parent.appendChild(child);
    document.body.appendChild(parent);
    const event = { target: child } as unknown as Event;
    expect(tryTraceFromEvent(event, resolved)).toBe(true);
    expect(inspectorStore.state.cssVar).toBe("--tv-row-base-bg");
    document.body.removeChild(parent);
  });
});

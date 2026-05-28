// Harness store — shared state + event log between the Host shell
// and each scenario. Scenarios import this module, read/write the
// `state` proxy and append to the `log` via `recordChange`. The Host
// renders an inspector pane from the same exports.
//
// Why a module-level reactive store (not setContext): scenarios
// often want to access state from outside the component tree
// (e.g. an action callback closure or an inline event handler).
// Module-scoped $state is simplest and matches the rest of the
// codebase's store conventions.

import type { Component } from "svelte";

export interface HarnessLogEntry {
  /** Monotonic millis from harness boot, not wall clock — drops the
   *  noise of date/time formatting and makes diffs deterministic. */
  t: number;
  /** Kind tag — "set", "click", "save", "reset", etc. Free-form,
   *  scenarios choose. */
  kind: string;
  /** Dot-path into the state object that was mutated. */
  path: string;
  before: unknown;
  after: unknown;
}

/** Reactive state object — scenarios mutate via `state.X = Y` and
 *  every change flows into the log via the bound setter pattern. */
export const harnessState: Record<string, unknown> = $state({});

/** Append-only event log. Newest entries pushed to the end; the
 *  inspector renders most-recent-last for natural reading. */
export const harnessLog: HarnessLogEntry[] = $state([]);

const T0 = performance.now();

/** Record a state mutation in the log. Called by scenarios after
 *  they write to `state`. Returns the new value for chaining. */
export function recordChange<T>(
  path: string,
  before: unknown,
  after: T,
  kind: string = "set",
): T {
  harnessLog.push({
    t: Math.round(performance.now() - T0),
    kind,
    path,
    before,
    after,
  });
  return after;
}

/** Reset the harness — clears state + log to empty. Call between
 *  scenario switches or from puppeteer to start a deterministic run. */
export function reset(): void {
  for (const k of Object.keys(harnessState)) delete harnessState[k];
  harnessLog.length = 0;
}

// ────────────────────────────────────────────────────────────────────
// window.__harness — puppeteer-facing API
// ────────────────────────────────────────────────────────────────────

declare global {
  interface Window {
    __harness?: {
      getState: () => Readonly<Record<string, unknown>>;
      getLog: () => readonly HarnessLogEntry[];
      clearLog: () => void;
      reset: () => void;
      setScenario: (name: string) => void;
    };
  }
}

/** Wire up `window.__harness`. Called once from main.ts on boot,
 *  with a setScenario callback the Host owns. */
export function wireGlobal(setScenario: (name: string) => void): void {
  if (typeof window === "undefined") return;
  // Snapshot via JSON round-trip so the puppeteer-facing surface
  // returns plain JS objects (Svelte 5's reactive proxies don't
  // survive structuredClone, and the proxy form trips JSON.stringify
  // when the log array is treated as a Record-keyed-by-index).
  const snap = (v: unknown): unknown => JSON.parse(JSON.stringify(v));
  window.__harness = {
    getState: () => snap({ ...harnessState }) as Readonly<Record<string, unknown>>,
    getLog:   () => snap([...harnessLog]) as readonly HarnessLogEntry[],
    clearLog: () => { harnessLog.length = 0; },
    reset,
    setScenario,
  };
}

// ────────────────────────────────────────────────────────────────────
// Scenario registry shape
// ────────────────────────────────────────────────────────────────────

export interface ScenarioMeta {
  /** Slug used in URL hash and registry key. */
  name: string;
  /** One-line description shown in the harness header. */
  description: string;
  /** Group label — scenarios are bucketed in the picker by this. */
  group: string;
  /** The Svelte scenario component itself (mounts the under-test
   *  component with wired state). */
  component: Component<Record<string, never>>;
}

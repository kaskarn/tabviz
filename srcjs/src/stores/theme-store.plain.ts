// Plain-runtime mirror of theme-store.svelte.ts — for bun test.
// (bun can't run .svelte.ts files directly; this file provides the same
// shape using manual reactivity for testing.)

import type { ThemeStructure, ThemeInputs, ColorRef } from "../types/theme-inputs";
import type { ThemeWire, Provenance } from "../lib/theme-wire";
import {
  emptyWire, pin, release, isPinned, resolveWire, inspectLeaf,
} from "../lib/theme-wire";

export interface ThemeStoreV3Plain {
  wire: ThemeWire;
  theme: ThemeStructure;
  provenance: Record<string, Provenance>;

  setInput<K extends keyof ThemeInputs>(key: K, value: ThemeInputs[K]): void;
  pinPath(path: string, value: ColorRef | string | number | boolean | null): void;
  releasePath(path: string): void;
  isPinned(path: string): boolean;
  inspect(path: string): ReturnType<typeof inspectLeaf>;
  load(wire: ThemeWire): void;
  reset(inputs: ThemeInputs, name?: string): void;
}

export function createThemeStoreV3Plain(
  initialInputs: ThemeInputs,
  initialName = "custom",
): ThemeStoreV3Plain {
  let wire = emptyWire(initialInputs, initialName);
  let cached = resolveWire(wire);

  function recompute() { cached = resolveWire(wire); }

  return {
    get wire() { return wire; },
    get theme() { return cached.theme; },
    get provenance() { return cached.provenance; },

    setInput(key, value) {
      wire = { ...wire, inputs: { ...wire.inputs, [key]: value } };
      recompute();
    },

    pinPath(path, value) {
      wire = pin(wire, path, value);
      recompute();
    },

    releasePath(path) {
      wire = release(wire, path);
      recompute();
    },

    isPinned(path) {
      return isPinned(wire, path);
    },

    inspect(path) {
      return inspectLeaf(wire, path);
    },

    load(newWire) {
      wire = newWire;
      recompute();
    },

    reset(inputs, name) {
      wire = emptyWire(inputs, name ?? wire.name);
      recompute();
    },
  };
}

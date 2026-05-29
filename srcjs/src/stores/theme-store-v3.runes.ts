// Plain-runtime mirror of theme-store-v3.svelte.ts — for bun test.
// (bun can't run .svelte.ts files directly; this file provides the same
// shape using manual reactivity for testing.)

import type { WebThemeV3, ThemeInputsV3, ColorRefV3 } from "../types/theme-v3";
import type { ThemeWireV3, Provenance } from "../lib/theme-wire-v3";
import {
  emptyWire, pin, release, isPinned, resolveWire, inspectLeaf,
} from "../lib/theme-wire-v3";

export interface ThemeStoreV3Plain {
  wire: ThemeWireV3;
  theme: WebThemeV3;
  provenance: Record<string, Provenance>;

  setInput<K extends keyof ThemeInputsV3>(key: K, value: ThemeInputsV3[K]): void;
  pinPath(path: string, value: ColorRefV3 | string | number | boolean | null): void;
  releasePath(path: string): void;
  isPinned(path: string): boolean;
  inspect(path: string): ReturnType<typeof inspectLeaf>;
  load(wire: ThemeWireV3): void;
  reset(inputs: ThemeInputsV3, name?: string): void;
}

export function createThemeStoreV3Plain(
  initialInputs: ThemeInputsV3,
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

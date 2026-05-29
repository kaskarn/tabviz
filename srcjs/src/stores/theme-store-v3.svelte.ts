// V3 theme store — reactive wrapper around ThemeWireV3.
//
// Foundation that future settings-panel UI components hook into. Holds
// a wire (`inputs + pins + overrides`) as reactive state; the resolved
// theme is a `$derived` that automatically recomputes on any wire edit.
//
// Full panel UI rewrite is incremental — individual controls migrate
// off the V2 store one at a time, each hooked into this store via
// inputField() / clusterField() / pinField() accessors.

import type { WebThemeV3, ThemeInputsV3, ColorRefV3 } from "../types/theme-v3";
import type { ThemeWireV3, Provenance } from "../lib/theme-wire-v3";
import {
  emptyWire, pin, release, isPinned, resolveWire, inspectLeaf,
} from "../lib/theme-wire-v3";

export interface ThemeStoreV3 {
  /** Current wire (inputs + pins + overrides). */
  readonly wire: ThemeWireV3;
  /** Fully-resolved theme (derived from wire). */
  readonly theme: WebThemeV3;
  /** Provenance map (path → input/derived/pin/override). */
  readonly provenance: Record<string, Provenance>;

  /** Update an input field (e.g., brand, mode, categorical). */
  setInput<K extends keyof ThemeInputsV3>(key: K, value: ThemeInputsV3[K]): void;
  /** Pin a path to a value (e.g., `clusters.cell.fg = ref("ink_muted")`). */
  pinPath(path: string, value: ColorRefV3 | string | number | boolean | null): void;
  /** Release a pinned path (reset to derived). */
  releasePath(path: string): void;
  /** True if `path` is pinned. */
  isPinned(path: string): boolean;
  /** Inspect a leaf — its value, provenance, and resolved hex (if a color). */
  inspect(path: string): ReturnType<typeof inspectLeaf>;

  /** Load a wire (e.g., from a preset). Replaces all current state. */
  load(wire: ThemeWireV3): void;
  /** Reset to an empty wire (only inputs, no pins/overrides). */
  reset(inputs: ThemeInputsV3, name?: string): void;
}

export function createThemeStoreV3(
  initialInputs: ThemeInputsV3,
  initialName = "custom",
): ThemeStoreV3 {
  let wire = $state<ThemeWireV3>(emptyWire(initialInputs, initialName));
  const resolved = $derived.by(() => resolveWire(wire));

  return {
    get wire() { return wire; },
    get theme() { return resolved.theme; },
    get provenance() { return resolved.provenance; },

    setInput(key, value) {
      wire = { ...wire, inputs: { ...wire.inputs, [key]: value } };
    },

    pinPath(path, value) {
      wire = pin(wire, path, value);
    },

    releasePath(path) {
      wire = release(wire, path);
    },

    isPinned(path) {
      return isPinned(wire, path);
    },

    inspect(path) {
      return inspectLeaf(wire, path);
    },

    load(newWire) {
      wire = newWire;
    },

    reset(inputs, name) {
      wire = emptyWire(inputs, name ?? wire.name);
    },
  };
}

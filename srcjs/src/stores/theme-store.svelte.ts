// Theme store — reactive wrapper around ThemeWire.
//
// Foundation that future settings-panel UI components hook into. Holds
// a wire (`inputs + pins + overrides`) as reactive state; the resolved
// theme is a `$derived` that automatically recomputes on any wire edit.
//
// Full panel UI rewrite is incremental — individual controls migrate
// off the old store one at a time, each hooked into this store via
// inputField() / clusterField() / pinField() accessors.

import type { ThemeStructure, ThemeInputs, ColorRef } from "../types/theme-inputs";
import type { ThemeWire, Provenance } from "../lib/theme-wire";
import {
  emptyWire, pin, release, isPinned, resolveWire, inspectLeaf,
} from "../lib/theme-wire";

export interface ThemeStore {
  /** Current wire (inputs + pins + overrides). */
  readonly wire: ThemeWire;
  /** Fully-resolved theme (derived from wire). */
  readonly theme: ThemeStructure;
  /** Provenance map (path → input/derived/pin/override). */
  readonly provenance: Record<string, Provenance>;

  /** Update an input field (e.g., brand, mode, categorical). */
  setInput<K extends keyof ThemeInputs>(key: K, value: ThemeInputs[K]): void;
  /** Pin a path to a value (e.g., `clusters.cell.fg = ref("ink_muted")`). */
  pinPath(path: string, value: ColorRef | string | number | boolean | null): void;
  /** Release a pinned path (reset to derived). */
  releasePath(path: string): void;
  /** True if `path` is pinned. */
  isPinned(path: string): boolean;
  /** Inspect a leaf — its value, provenance, and resolved hex (if a color). */
  inspect(path: string): ReturnType<typeof inspectLeaf>;

  /** Load a wire (e.g., from a preset). Replaces all current state. */
  load(wire: ThemeWire): void;
  /** Reset to an empty wire (only inputs, no pins/overrides). */
  reset(inputs: ThemeInputs, name?: string): void;
}

export function createThemeStore(
  initialInputs: ThemeInputs,
  initialName = "custom",
): ThemeStore {
  let wire = $state<ThemeWire>(emptyWire(initialInputs, initialName));
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

// V3 wire format — inputs + pins + overrides.
//
// Replaces the V2 resolved-blob wire shape. New wire carries:
//   - schemaVersion: 3
//   - inputs (T1)
//   - pins: dotted-path strings the user has explicitly authored
//   - overrides: map of dotted-path → ColorRef / value override
//
// Resolver runs at consumption (browser, V8 export, R via V8); the wire
// no longer carries a fully-resolved blob. This brings Sprint 2's
// inputs+pins design into Sprint 1.
//
// Provenance is derived during resolution: each leaf is tagged "input",
// "pin", "override", or "derived" so consumers can introspect.

import type {
  ThemeInputsV3,
  WebThemeV3,
  ColorRefV3,
} from "../types/theme-v3";
import { buildTheme, resolveRef } from "./theme-resolve-v3";

// ────────────────────────────────────────────────────────────────────
// Wire shape
// ────────────────────────────────────────────────────────────────────

export interface ThemeWireV3 {
  schemaVersion: 3;
  name: string;
  inputs: ThemeInputsV3;
  /** Dotted-path strings the user has explicitly authored. */
  pins: string[];
  /** Map of dotted-path -> override value. */
  overrides: Record<string, ColorRefV3 | string | number | boolean | null>;
}

/** Construct an empty wire from inputs. */
export function emptyWire(inputs: ThemeInputsV3, name = "custom"): ThemeWireV3 {
  return {
    schemaVersion: 3,
    name,
    inputs,
    pins: [],
    overrides: {},
  };
}

// ────────────────────────────────────────────────────────────────────
// Pin / release verbs
// ────────────────────────────────────────────────────────────────────

/** Add a pin + override to the wire. */
export function pin(
  wire: ThemeWireV3,
  path: string,
  value: ColorRefV3 | string | number | boolean | null,
): ThemeWireV3 {
  const pins = wire.pins.includes(path) ? wire.pins : [...wire.pins, path];
  return {
    ...wire,
    pins,
    overrides: { ...wire.overrides, [path]: value },
  };
}

/** Remove a pin (release back to derived). */
export function release(wire: ThemeWireV3, path: string): ThemeWireV3 {
  if (!wire.pins.includes(path)) return wire;
  const pins = wire.pins.filter((p) => p !== path);
  const { [path]: _removed, ...rest } = wire.overrides;
  void _removed;
  return { ...wire, pins, overrides: rest };
}

/** True if a path is pinned. */
export function isPinned(wire: ThemeWireV3, path: string): boolean {
  return wire.pins.includes(path);
}

// ────────────────────────────────────────────────────────────────────
// Resolve at consumption
// ────────────────────────────────────────────────────────────────────

/** Provenance for a single resolved leaf. */
export type Provenance =
  | { source: "input" }
  | { source: "derived" }
  | { source: "pin"; path: string }
  | { source: "override"; path: string };

/** Walk an override-path and apply to a nested object. Mutates `target`. */
function applyOverrideToPath(
  target: Record<string, unknown>,
  path: string,
  value: unknown,
): void {
  const parts = path.split(".");
  let cursor: Record<string, unknown> = target;
  for (let i = 0; i < parts.length - 1; i++) {
    const k = parts[i]!;
    if (typeof cursor[k] !== "object" || cursor[k] === null) {
      cursor[k] = {};
    }
    cursor = cursor[k] as Record<string, unknown>;
  }
  cursor[parts[parts.length - 1]!] = value;
}

/**
 * Resolve a wire to a fully-built WebThemeV3 at consumption time.
 *
 * Steps:
 *   1. buildTheme(inputs) → base theme
 *   2. Apply overrides into the theme by dotted path
 *
 * Returns the WebThemeV3 + a provenance map computed from pins.
 */
export function resolveWire(wire: ThemeWireV3): {
  theme: WebThemeV3;
  provenance: Record<string, Provenance>;
} {
  const base = buildTheme(wire.inputs, wire.name);
  // Walk overrides; apply each into the theme.
  const themeAny = base as unknown as Record<string, unknown>;
  for (const path of Object.keys(wire.overrides)) {
    applyOverrideToPath(themeAny, path, wire.overrides[path]);
  }

  // Build provenance map: every pin → "pin"; non-pinned override → "override".
  const provenance: Record<string, Provenance> = {};
  for (const path of wire.pins) {
    provenance[path] = { source: "pin", path };
  }
  for (const path of Object.keys(wire.overrides)) {
    if (!wire.pins.includes(path)) {
      provenance[path] = { source: "override", path };
    }
  }
  return { theme: base, provenance };
}

/** Inspect a specific leaf path. Returns the resolved hex (if a color) + provenance. */
export function inspectLeaf(
  wire: ThemeWireV3,
  path: string,
): { value: unknown; provenance: Provenance; resolved?: string | null } {
  const { theme, provenance } = resolveWire(wire);
  const parts = path.split(".");
  let cursor: unknown = theme;
  for (const k of parts) {
    if (typeof cursor !== "object" || cursor === null) {
      return { value: undefined, provenance: { source: "derived" } };
    }
    cursor = (cursor as Record<string, unknown>)[k];
  }
  // If the cursor is a ColorRef or string, also try to resolve it.
  let resolved: string | null | undefined;
  if (
    cursor != null &&
    (typeof cursor === "string" ||
      (typeof cursor === "object" && ("ref" in cursor || "hex" in cursor)))
  ) {
    resolved = resolveRef(cursor as ColorRefV3 | string, theme.ramps);
  }
  return {
    value: cursor,
    provenance: provenance[path] ?? { source: "derived" },
    resolved,
  };
}

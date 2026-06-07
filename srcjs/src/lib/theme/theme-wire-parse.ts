// Theme-wire envelope PARSER — the validating ingress for untrusted JSON
// (settings-panel import; any future drag-drop / URL loader). Round-2
// robustness review: the import path called buildTheme directly, so
// malformed inputs skipped validateThemeInputs entirely (NaN anchors
// rendered as #NANNANNAN with no error; a bad density enum crashed with
// a cryptic internal TypeError) and hostile pin values rode through.
//
// Lives in its own module (not theme-wire.ts) to avoid the import cycle
// theme-wire → theme-validate → consumer-bridge → theme-wire.

import type { ThemeInputs } from "../../types/theme-inputs";
import type { PinnedThemeWire, RoleOverrides } from "./theme-wire";
import { validateThemeInputs } from "./theme-validate";
import { isValidPinValue } from "./consumer-bridge";

export class ThemeWireParseError extends Error {
  problems: string[];
  constructor(problems: string[]) {
    super(problems.join(" · "));
    this.name = "ThemeWireParseError";
    this.problems = problems;
  }
}

/** Parse + validate a theme-wire envelope from untrusted JSON text.
 *  Throws `ThemeWireParseError` (shape/pin problems) or
 *  `ThemeInputsValidationError` (Tier-1 range/enum problems) with
 *  user-presentable messages; never returns a half-valid wire. */
export function parseThemeWire(json: string): PinnedThemeWire {
  let wire: {
    $schema?: unknown;
    name?: unknown;
    inputs?: ThemeInputs;
    roleOverrides?: unknown;
    pins?: unknown;
  };
  try {
    wire = JSON.parse(json) as typeof wire;
  } catch {
    throw new ThemeWireParseError(["Not valid JSON."]);
  }
  if (typeof wire !== "object" || wire === null) {
    throw new ThemeWireParseError(["Not a theme wire (expected a JSON object)."]);
  }
  if (!wire.inputs || typeof wire.inputs !== "object" || !wire.inputs.anchors) {
    throw new ThemeWireParseError(["Not a theme wire (missing inputs.anchors)."]);
  }
  // Tier-1 inputs: the same wall R authors hit via the S7 validator.
  validateThemeInputs(wire.inputs);

  const problems: string[] = [];

  const roleOverrides: RoleOverrides = {};
  if (wire.roleOverrides !== undefined) {
    if (typeof wire.roleOverrides !== "object" || wire.roleOverrides === null || Array.isArray(wire.roleOverrides)) {
      problems.push("roleOverrides must be an object.");
    } else {
      for (const [role, b] of Object.entries(wire.roleOverrides as Record<string, unknown>)) {
        const binding = b as { ramp?: unknown; grade?: unknown } | null;
        if (!binding || typeof binding.ramp !== "string" ||
            !Number.isFinite(binding.grade as number)) {
          problems.push(`roleOverrides.${role}: expected {ramp, grade}.`);
          continue;
        }
        (roleOverrides as Record<string, unknown>)[role] = {
          ramp: binding.ramp,
          grade: binding.grade as number,
        };
      }
    }
  }

  const pins: Record<string, string> = {};
  if (wire.pins !== undefined) {
    if (typeof wire.pins !== "object" || wire.pins === null || Array.isArray(wire.pins)) {
      problems.push("pins must be an object of cssVar → value.");
    } else {
      for (const [k, v] of Object.entries(wire.pins as Record<string, unknown>)) {
        if (!k.startsWith("--tv-")) {
          problems.push(`pins: "${k}" is not a --tv- token.`);
        } else if (!isValidPinValue(v)) {
          // Surfacing (not silently dropping) is deliberate: an envelope
          // that SAYS it pins a token must either apply or explain.
          problems.push(`pins: "${k}" has an invalid value (structural characters or over-length).`);
        } else {
          pins[k] = v;
        }
      }
    }
  }

  if (problems.length > 0) throw new ThemeWireParseError(problems);

  return {
    $schema: "tabviz-theme/v4",
    name: typeof wire.name === "string" && wire.name.length > 0 ? wire.name : "imported",
    inputs: wire.inputs,
    roleOverrides,
    ...(Object.keys(pins).length > 0 ? { pins } : {}),
  };
}

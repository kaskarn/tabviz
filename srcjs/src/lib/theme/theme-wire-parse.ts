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
import { normalizeBinding, type RoleOverrideWire } from "./alias";
import { validateThemeInputs, type ThemeIssue } from "./theme-validate";
import { isValidPinValue } from "./consumer-bridge";
import { sanitizeComponentBindings, type ComponentBindings } from "./component-bindings";

export class ThemeWireParseError extends Error {
  /** Structured issues — the machine contract (Wave 4). */
  issues: ThemeIssue[];
  /** Back-compat string view. */
  problems: string[];
  constructor(issues: ThemeIssue[]) {
    super(issues.map((i) => i.message).join(" · "));
    this.name = "ThemeWireParseError";
    this.issues = issues;
    this.problems = issues.map((i) => i.message);
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
    components?: unknown;
    pins?: unknown;
  };
  try {
    wire = JSON.parse(json) as typeof wire;
  } catch {
    throw new ThemeWireParseError([{ path: "$", code: "parse", message: "Not valid JSON." }]);
  }
  if (typeof wire !== "object" || wire === null) {
    throw new ThemeWireParseError([{ path: "$", code: "shape", message: "Not a theme wire (expected a JSON object)." }]);
  }
  if (!wire.inputs || typeof wire.inputs !== "object" || !wire.inputs.anchors) {
    throw new ThemeWireParseError([{ path: "inputs.anchors", code: "shape", message: "Not a theme wire (missing inputs.anchors)." }]);
  }
  // Unknown-schema lint (parity with R theme_from_wire, Wave 1.5): a future
  // schema imports best-effort, but the version mismatch shouldn't be silent
  // (R warns; the studio/settings importer was the silent half).
  if (typeof wire.$schema === "string" && wire.$schema !== "tabviz-theme/v4") {
    // eslint-disable-next-line no-console
    console.warn(
      `tabviz: unknown theme wire schema "${wire.$schema}" (expected "tabviz-theme/v4"); importing anyway.`,
    );
  }
  // Tier-1 inputs: the strict ingress wall. The R S7 validator now
  // mirrors the checks that matter for cross-side artifacts (e.g.
  // interaction_defaults flag NAMES — review pass: an R-accepted typo
  // used to make the exported envelope un-importable here).
  validateThemeInputs(wire.inputs);

  const problems: ThemeIssue[] = [];

  const roleOverrides: RoleOverrides = {};
  if (wire.roleOverrides !== undefined) {
    if (typeof wire.roleOverrides !== "object" || wire.roleOverrides === null || Array.isArray(wire.roleOverrides)) {
      problems.push({ path: "roleOverrides", code: "shape", message: "roleOverrides must be an object." });
    } else {
      // Accept BOTH the name-alias form ("neutral.5") and the legacy
      // coordinate-object form ({ramp,grade}) — one-way migration so old
      // files keep importing (theme-rework Wave 0). normalizeBinding returns
      // null for malformed entries, which we surface rather than drop.
      for (const [role, entry] of Object.entries(wire.roleOverrides as Record<string, RoleOverrideWire>)) {
        const binding = normalizeBinding(entry);
        if (!binding) {
          problems.push({ path: `roleOverrides.${role}`, code: "shape", message: `roleOverrides.${role}: expected a "ramp.grade" alias or {ramp, grade}.` });
          continue;
        }
        (roleOverrides as Record<string, unknown>)[role] = binding;
      }
    }
  }

  // Component-model re-routes (W6): validated against the curated roster +
  // per-channel value vocabularies. Strict here — an envelope that SAYS it
  // re-routes a channel must either apply or explain (same policy as pins).
  let components: ComponentBindings = {};
  if (wire.components !== undefined) {
    const sanitized = sanitizeComponentBindings(wire.components);
    components = sanitized.bindings;
    problems.push(...sanitized.issues);
  }

  const pins: Record<string, string> = {};
  if (wire.pins !== undefined) {
    if (typeof wire.pins !== "object" || wire.pins === null || Array.isArray(wire.pins)) {
      problems.push({ path: "pins", code: "shape", message: "pins must be an object of cssVar → value." });
    } else {
      for (const [k, v] of Object.entries(wire.pins as Record<string, unknown>)) {
        if (!k.startsWith("--tv-")) {
          problems.push({ path: `pins.${k}`, code: "shape", message: `pins: "${k}" is not a --tv- token.` });
        } else if (!isValidPinValue(v)) {
          // Surfacing (not silently dropping) is deliberate: an envelope
          // that SAYS it pins a token must either apply or explain.
          problems.push({ path: `pins.${k}`, code: "shape", message: `pins: "${k}" has an invalid value (structural characters or over-length).` });
        } else {
          pins[k] = v;
        }
      }
    }
  }

  if (problems.length > 0) throw new ThemeWireParseError(problems);

  // Pins-are-last-resort lint (theme-rework Wave 1): an imported envelope
  // that pins tokens bypasses the cascade — surface it so a silently
  // pinned, polarity-unresponsive theme doesn't arrive unannounced. The
  // UI banner is the primary signal; this is the console twin.
  if (Object.keys(pins).length > 0) {
    // eslint-disable-next-line no-console
    console.warn(
      `tabviz: imported theme pins ${Object.keys(pins).length} token(s) directly — ` +
        `pinned tokens bypass the cascade and may not respond to polarity / high-contrast.`,
    );
  }

  return {
    $schema: "tabviz-theme/v4",
    name: typeof wire.name === "string" && wire.name.length > 0 ? wire.name : "imported",
    inputs: wire.inputs,
    roleOverrides,
    ...(Object.keys(components).length > 0 ? { components } : {}),
    ...(Object.keys(pins).length > 0 ? { pins } : {}),
  };
}

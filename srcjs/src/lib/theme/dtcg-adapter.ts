// DTCG (Design Tokens Community Group) adapter — theme-rework Wave 4.
//
// Projects a tabviz theme into the DTCG token-file format
// (https://tr.designtokens.org/format/) so the cascade interoperates with
// Figma / Tokens Studio / Style Dictionary, and reverses a DTCG file back
// into a tabviz wire envelope.
//
// Shape (three groups under `tabviz`):
//   reference — the generated primitives: the four anchors + the three
//               11-step ramps + status seeds. Concrete color tokens.
//   semantic  — the Tier-2 roles, each an ALIAS into reference
//               (`{tabviz.reference.neutral.5}`) so a downstream tool sees
//               the binding, not a baked hex. Off-ramp roles (status/onsolid)
//               emit a direct value.
//   component — the Tier-3 `--tv-*` manifest, resolved values, DTCG path
//               derived from the cssVar name. The surface a consumer themes.
//
// LOSSLESS ROUND-TRIP: the authoritative tabviz inputs ride
// `$extensions.tabviz` (a sanctioned DTCG escape hatch). fromDtcg restores
// from it, so `theme → toDtcg → fromDtcg → resolve` is byte-stable — the
// human-facing token groups are the interop view, $extensions is the source
// of truth.

import type { ThemeInputs } from "../../types/theme-inputs";
import type { ComponentBindings } from "./component-bindings";
import {
  createWire,
  buildThemeWire,
  type ThemeWireEnvelope,
  type RoleOverrides,
} from "./theme-wire";
import { resolveTheme } from "./resolve-theme";
import { COMPONENT_TOKENS } from "./component-tokens";
import { DEFAULT_ROLE_BINDINGS } from "./role-bindings";
import { oklchToHex } from "../oklch";
import type { RoleName } from "../../types/theme-roles";

export const DTCG_EXTENSION_KEY = "com.tabviz.theme";

interface DtcgColorToken { $type: "color"; $value: string; $description?: string }
export interface DtcgDocument {
  $schema?: string;
  $description?: string;
  tabviz: {
    reference: Record<string, unknown>;
    semantic: Record<string, DtcgColorToken>;
    component: Record<string, { $value: string; $extensions?: Record<string, unknown> }>;
  };
  $extensions: Record<string, { name: string; inputs: ThemeInputs; roleOverrides?: RoleOverrides; components?: ComponentBindings; pins?: Record<string, string> }>;
}

/** `--tv-row-base-bg` → `row.base.bg` (the DTCG path under component.). */
function cssVarToDtcgPath(cssVar: string): string {
  return cssVar.replace(/^--tv-/, "").replace(/-/g, ".");
}

function anchorHex(t: { L: number; C: number; H: number } | undefined): string | null {
  if (!t) return null;
  return oklchToHex({ L: t.L, C: t.C, H: t.H });
}

/** Project a tabviz theme to a DTCG document. */
export function toDtcg(
  inputs: ThemeInputs,
  name = "tabviz-theme",
  roleOverrides: RoleOverrides = {},
  pins: Record<string, string> = {},
  components: ComponentBindings = {},
): DtcgDocument {
  const resolved = resolveTheme({ ...createWire(inputs, name), roleOverrides, components });

  // reference — anchors + ramps.
  const reference: Record<string, unknown> = {};
  const anchors: Record<string, DtcgColorToken> = {};
  for (const key of ["paper", "ink", "brand", "accent"] as const) {
    const hex = anchorHex(inputs.anchors?.[key] ?? (key === "accent" ? inputs.anchors?.brand : undefined));
    if (hex) anchors[key] = { $type: "color", $value: hex };
  }
  reference["anchors"] = anchors;
  for (const ramp of ["neutral", "brand", "accent"] as const) {
    const steps: Record<string, DtcgColorToken> = {};
    resolved.ramps[ramp].forEach((hex, i) => {
      steps[String(i + 1)] = { $type: "color", $value: hex };
    });
    reference[ramp] = steps;
  }

  // semantic — roles as aliases into reference (or direct value off-ramp).
  const semantic: Record<string, DtcgColorToken> = {};
  for (const role of Object.keys(DEFAULT_ROLE_BINDINGS) as RoleName[]) {
    const binding = resolved.roleSource[role];
    if (binding && (binding.ramp === "neutral" || binding.ramp === "brand" || binding.ramp === "accent")) {
      semantic[role] = { $type: "color", $value: `{tabviz.reference.${binding.ramp}.${binding.grade}}` };
    } else {
      const v = resolved.roles[role];
      if (v) semantic[role] = { $type: "color", $value: v };
    }
  }

  // component — the manifest, resolved values, derived DTCG path.
  const component: Record<string, { $value: string; $extensions?: Record<string, unknown> }> = {};
  for (const token of COMPONENT_TOKENS) {
    const v = resolved.cssVars[token.cssVar];
    if (v === undefined) continue;
    component[cssVarToDtcgPath(token.cssVar)] = {
      $value: v,
      $extensions: { [DTCG_EXTENSION_KEY]: { cssVar: token.cssVar, group: token.resolverGroup } },
    };
  }

  return {
    $schema: "https://tr.designtokens.org/format/",
    $description: `tabviz theme "${name}" exported as DTCG tokens. The authoritative tabviz inputs ride $extensions.${DTCG_EXTENSION_KEY} for a lossless round-trip.`,
    tabviz: { reference, semantic, component },
    $extensions: {
      [DTCG_EXTENSION_KEY]: { name, inputs, ...(Object.keys(roleOverrides).length ? { roleOverrides } : {}), ...(Object.keys(components).length ? { components } : {}), ...(Object.keys(pins).length ? { pins } : {}) },
    },
  };
}

/** Single-object wrapper for the R V8 bridge (callBuilder passes one args
 *  object). R `theme_to_dtcg()` calls this with the theme's inputs +
 *  name + artifacts. */
export function dtcgFromTheme(bag: {
  inputs: ThemeInputs;
  name?: string;
  roleOverrides?: RoleOverrides;
  pins?: Record<string, string>;
  components?: ComponentBindings;
}): DtcgDocument {
  return toDtcg(bag.inputs, bag.name ?? "tabviz-theme", bag.roleOverrides ?? {},
    bag.pins ?? {}, bag.components ?? {});
}

/** Reverse a DTCG document to a tabviz wire envelope. Reads the
 *  authoritative inputs from `$extensions` (lossless); throws if absent
 *  (a foreign DTCG file with no tabviz provenance can't be resolved by the
 *  cascade — that's an import-from-scratch story, not a round-trip). */
export function fromDtcg(doc: unknown): ThemeWireEnvelope {
  const d = doc as DtcgDocument | null;
  const ext = d?.$extensions?.[DTCG_EXTENSION_KEY];
  if (!ext || !ext.inputs || typeof ext.inputs !== "object") {
    throw new Error(
      `fromDtcg: no tabviz provenance ($extensions.${DTCG_EXTENSION_KEY}.inputs). ` +
      `Only DTCG files exported by tabviz round-trip; a foreign token file needs a manual mapping.`,
    );
  }
  return buildThemeWire(ext.inputs, ext.name ?? "imported", ext.roleOverrides ?? {},
    ext.pins ?? {}, ext.components ?? {});
}

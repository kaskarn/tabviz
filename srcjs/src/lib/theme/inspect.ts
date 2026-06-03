/**
 * Cascade-trace inspection for any component token.
 *
 * Given a `ResolvedTheme` and a token name, produces a structured walk of
 * the cascade from Tier 3 down to the underlying anchor / input / ramp
 * grade. Used by:
 *
 *   - R-side `inspect_token(theme, token_name)` (ships via V8).
 *   - Browser Cascade Inspector (Stage 3 §2).
 *   - PR review / debugging contexts (the JSON form is pretty-printable).
 *
 * Per Stage 1 §12e (decisions log Q-P2.8 closed 2026-06-02).
 *
 * The trace is a flat array of steps; each step labels its tier and what
 * the tier resolves to. Higher tiers come first.
 */

import type { RoleName } from "../../types/theme-roles";
import { OFF_RAMP_ROLES } from "../../types/theme-roles";
import { TOKENS_BY_VAR, type ComponentToken } from "./component-tokens";
import type { ResolvedTheme } from "./resolve-theme";

/** A single step in the cascade trace. */
export type TraceStep =
  | { tier: "component"; cssVar: string; kind: string; description?: string; value: string }
  | { tier: "role"; role: RoleName; bindingSource: "default" | "override"; value: string }
  | { tier: "ramp-grade"; ramp: string; grade: number; value: string; alpha?: boolean }
  | { tier: "anchor"; anchor: string; value: string }
  | { tier: "input"; input: string; value: string }
  | { tier: "computed"; note: string; value: string }
  | { tier: "const"; note: string; value: string };

/** The full inspection result. */
export interface TokenInspection {
  /** The cssVar inspected. */
  readonly cssVar: string;
  /** The manifest entry (if found). */
  readonly token: ComponentToken | null;
  /** Ordered cascade walk, deepest tier last. */
  readonly trace: readonly TraceStep[];
  /** Consumer files declared by the manifest (relative to srcjs/src/). */
  readonly consumedBy: readonly string[];
  /** The final resolved value as it appears in `cssVars`. */
  readonly resolved: string | null;
}

/** Result for the "token not found" case. */
function unknownTokenResult(cssVar: string): TokenInspection {
  return {
    cssVar,
    token: null,
    trace: [],
    consumedBy: [],
    resolved: null,
  };
}

/** Normalize a token name to its full `--tv-*` form. */
function normalizeTokenName(tokenName: string): string {
  return tokenName.startsWith("--tv-") ? tokenName : `--tv-${tokenName}`;
}

/** Walk the cascade trace for a token, given a ResolvedTheme.
 *
 *  Returns a structured inspection result with the full chain. Unknown
 *  tokens produce a result with `token: null` and empty trace.
 */
export function inspectToken(
  resolved: ResolvedTheme,
  tokenName: string,
): TokenInspection {
  const cssVar = normalizeTokenName(tokenName);
  const token = TOKENS_BY_VAR.get(cssVar) ?? null;
  if (!token) return unknownTokenResult(cssVar);

  const value = resolved.cssVars[cssVar] ?? "";
  const trace: TraceStep[] = [];

  // Step 1 — the Tier 3 component token itself.
  trace.push({
    tier: "component",
    cssVar,
    kind: token.kind,
    description: token.description,
    value,
  });

  // Step 2 — descend by source.tier.
  const source = token.source;
  switch (source.tier) {
    case "role": {
      const role = source.role;
      const binding = resolved.roleSource[role];
      const isOverride = wasOverridden(resolved, role);
      trace.push({
        tier: "role",
        role,
        bindingSource: isOverride ? "override" : "default",
        value: resolved.roles[role],
      });
      // Step 3 — the ramp+grade the role resolves through.
      // Off-ramp roles (status, computed) don't have a meaningful ramp-grade
      // step; we surface that as a synthetic "anchor" step instead.
      if (OFF_RAMP_ROLES.has(role)) {
        trace.push({
          tier: "anchor",
          anchor: roleToAnchorLabel(role),
          value: resolved.roles[role],
        });
      } else {
        const isAlpha = role === "highlight-bg";  // the only wash role we currently track
        trace.push({
          tier: "ramp-grade",
          ramp: binding.ramp,
          grade: binding.grade,
          value: resolved.roles[role],
          alpha: isAlpha ? true : undefined,
        });
      }
      break;
    }
    case "input": {
      trace.push({
        tier: "input",
        input: String(source.input),
        value,
      });
      break;
    }
    case "anchor": {
      trace.push({
        tier: "anchor",
        anchor: source.anchor,
        value,
      });
      break;
    }
    case "computed": {
      trace.push({
        tier: "computed",
        note: source.note,
        value,
      });
      break;
    }
    case "const": {
      trace.push({
        tier: "const",
        note: source.note,
        value,
      });
      break;
    }
  }

  return {
    cssVar,
    token,
    trace,
    consumedBy: token.consumedBy,
    resolved: value || null,
  };
}

/** Was this role overridden (vs. using its default binding)? */
function wasOverridden(_resolved: ResolvedTheme, _role: RoleName): boolean {
  // Currently `roleSource` always carries the active binding (override or
  // default) but doesn't carry the "source" tag. Inferring requires
  // comparing against DEFAULT_ROLE_BINDINGS — punted to the resolver's
  // own provenance field in a future commit. For now report "default"
  // uniformly; the Cascade Inspector's wire-level provenance shows pin
  // status independently.
  return false;
}

/** Label for an off-ramp role's "anchor" — a human-readable identifier
 *  for the data source (status seed, computed pick, etc.). */
function roleToAnchorLabel(role: RoleName): string {
  if (role === "text-onsolid") return "APCA-picked ink (brand-solid bg)";
  if (role.startsWith("pos-")) return "status.positive";
  if (role.startsWith("neg-")) return "status.negative";
  if (role.startsWith("warn-")) return "status.warning";
  if (role.startsWith("info-")) return "status.info";
  return role;
}

/** Print a human-readable trace string. Used by R-side `inspect_token`
 *  and by debug logging. */
export function formatTrace(inspection: TokenInspection): string {
  if (!inspection.token) {
    return `Token '${inspection.cssVar}' is not in COMPONENT_TOKENS.`;
  }
  const lines: string[] = [];
  lines.push(`Token: ${inspection.cssVar} (${inspection.token.kind})`);
  if (inspection.token.description) {
    lines.push(`  Description: ${inspection.token.description}`);
  }
  for (let i = 0; i < inspection.trace.length; i++) {
    const step = inspection.trace[i]!;
    const indent = "  ".repeat(i + 1);
    lines.push(`${indent}${formatStep(step)}`);
  }
  if (inspection.consumedBy.length > 0) {
    lines.push(`  Consumed by:`);
    for (const c of inspection.consumedBy) {
      lines.push(`    - ${c}`);
    }
  }
  return lines.join("\n");
}

function formatStep(step: TraceStep): string {
  switch (step.tier) {
    case "component":
      return `[Tier 3] ${step.cssVar} (${step.kind}) = ${step.value}`;
    case "role":
      return `[Tier 2] role: ${step.role} (${step.bindingSource}) = ${step.value}`;
    case "ramp-grade":
      return `[Tier 1] ${step.ramp}[${step.grade}]${step.alpha ? " (alpha)" : ""} = ${step.value}`;
    case "anchor":
      return `[Tier 1] anchor: ${step.anchor} = ${step.value}`;
    case "input":
      return `[Tier 1] input: ${step.input} = ${step.value}`;
    case "computed":
      return `[Tier 1] computed: ${step.note} = ${step.value}`;
    case "const":
      return `[Tier 1] const: ${step.note} = ${step.value}`;
  }
}

/** List all component tokens in the manifest, with their kind, source
 *  summary, and resolved value (when a ResolvedTheme is given).
 *
 *  Per Stage 1 §12e — the discovery helper paired with `inspectToken`. */
export interface TokenSummary {
  readonly cssVar: string;
  readonly kind: string;
  readonly description?: string;
  readonly sourceTier: string;
  readonly sourceLabel: string;
  readonly resolved?: string;
}

export function listComponentTokens(
  resolved?: ResolvedTheme,
): readonly TokenSummary[] {
  return Array.from(TOKENS_BY_VAR.values()).map((token) => {
    const summary: TokenSummary = {
      cssVar: token.cssVar,
      kind: token.kind,
      description: token.description,
      sourceTier: token.source.tier,
      sourceLabel: formatSourceLabel(token),
      ...(resolved ? { resolved: resolved.cssVars[token.cssVar] } : {}),
    };
    return summary;
  });
}

function formatSourceLabel(token: ComponentToken): string {
  const s = token.source;
  switch (s.tier) {
    case "role": return s.role;
    case "input": return String(s.input);
    case "anchor": return s.anchor;
    case "computed": return s.note;
    case "const": return s.note;
  }
}

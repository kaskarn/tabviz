/**
 * Component bindings (component model Stage 1 — W6 substrate).
 *
 * The component model makes the T3 manifest OPERABLE: curated components
 * (named, grouped by table region) expose typed channels (`col`, `bg`,
 * `family`, …) whose default bindings live in the manifest, and a sparse
 * `components` wire block re-routes any channel to a different role —
 * the missing middle verb between re-tuning a role (`setRoleBinding`)
 * and pinning a raw token value (`pins`). Design:
 * `docs/dev/component-model.md`; wire item W6 in
 * `docs/dev/wire-freeze-inventory.md`.
 *
 * This module owns:
 *   - the channel vocabulary + per-channel value validation,
 *   - the COMPONENT_ROSTER derived from manifest `binding` annotations,
 *   - `sanitizeComponentBindings` — the ONE ingress validator (untrusted-
 *     wire rule: every ingress validates; structured ThemeIssue errors),
 *   - `componentChannelOverride` — the resolve-time lookup consulted by
 *     the role + typography resolvers in resolve-theme.ts.
 *
 * Resolution order (must hold in BOTH resolve paths — getCssVars and
 * theme-css's emission share getCssVarsRaw, so this is structural):
 *   manifest default binding → `components` override → role/slot
 *   resolution → pins overlay. The HC/RT mode ratchet (token.modes)
 *   beats a component re-route, same as it beats pins.
 */

import type { ThemeIssue } from "./theme-validate";
import {
  COMPONENT_TOKENS,
  KNOWN_UNCONSUMED,
  type ComponentToken,
  type ComponentRegion,
  type ComponentStateName,
  type ComponentChannelName,
} from "./component-tokens";
import { ROLE_KIND, type RoleName } from "../../types/theme-roles";

// ── Channel typing ──────────────────────────────────────────────────────────

/** Channels whose value is a Tier-2 COLOR role name. */
const COLOR_CHANNELS: ReadonlySet<ComponentChannelName> = new Set([
  "col", "bg", "bar", "rule",
] as const);

/** Type-channel vocabularies — mirror typography.ts's TypeRole slots. */
const FAMILY_SLOTS = new Set(["display", "body", "mono", "numeric"]);
const SIZE_STEPS = new Set([
  "label", "foot", "body", "head", "subtitle", "title", "display",
]);
const WEIGHT_SLOTS = new Set(["regular", "medium", "semibold", "bold"]);

/** True when `value` is valid for `channel`. Color channels accept any
 *  Tier-2 color role (including off-ramp status roles — re-ROUTING to a
 *  status role is legitimate even though re-TUNING one is not); type
 *  channels accept their slot vocabulary. */
export function isValidChannelValue(
  channel: ComponentChannelName,
  value: unknown,
): value is string {
  if (typeof value !== "string") return false;
  if (COLOR_CHANNELS.has(channel)) return value in ROLE_KIND;
  switch (channel) {
    case "family": return FAMILY_SLOTS.has(value);
    case "size":   return SIZE_STEPS.has(value);
    case "weight": return WEIGHT_SLOTS.has(value);
    default:       return false;
  }
}

// ── Wire shape ──────────────────────────────────────────────────────────────

/** Sparse channel→value record for one component state. */
export type ComponentChannelOverrides = Partial<
  Record<ComponentChannelName, string>
>;

/** The `components` wire block: component → state → sparse channel record.
 *  `base` is the implied state; most components define only base. */
export type ComponentBindings = Record<
  string,
  Partial<Record<ComponentStateName, ComponentChannelOverrides>>
>;

// ── Roster (derived from the manifest at module load) ───────────────────────

export interface ComponentDescriptor {
  readonly component: string;
  readonly region: ComponentRegion;
  /** state → channel → backing manifest token. */
  readonly states: ReadonlyMap<
    ComponentStateName,
    ReadonlyMap<ComponentChannelName, ComponentToken>
  >;
}

/** The curated component roster — every manifest token carrying a
 *  `binding` annotation, grouped component → state → channel. This is
 *  what the wire block validates against and what introspection
 *  (`listComponents` / R `list_components()`) surfaces. */
export const COMPONENT_ROSTER: ReadonlyMap<string, ComponentDescriptor> =
  (() => {
    const m = new Map<
      string,
      {
        component: string;
        region: ComponentRegion;
        states: Map<ComponentStateName, Map<ComponentChannelName, ComponentToken>>;
      }
    >();
    for (const t of COMPONENT_TOKENS) {
      const b = t.binding;
      if (!b) continue;
      // MECHANICAL HONESTY: a channel whose backing token is headroom
      // (KNOWN_UNCONSUMED — emitted but nothing paints it) is NOT
      // editable; advertising it would be the "option nothing reads"
      // bug class. As Stage 3 wires consumers (DOM + export TOGETHER —
      // wiring one side creates a WYSIWYG divergence), tokens leave
      // KNOWN_UNCONSUMED and their channels join the roster
      // automatically. The gate test asserts this invariant.
      if (KNOWN_UNCONSUMED.has(t.cssVar)) continue;
      let d = m.get(b.component);
      if (!d) {
        d = { component: b.component, region: b.region, states: new Map() };
        m.set(b.component, d);
      }
      const state = b.state ?? "base";
      let channels = d.states.get(state);
      if (!channels) {
        channels = new Map();
        d.states.set(state, channels);
      }
      channels.set(b.channel, t);
    }
    return m;
  })();

/** JSON-able roster projection for V8/R introspection + parity tests. */
export function componentRoster(): Record<
  string,
  { region: ComponentRegion; states: Record<string, Record<string, string>> }
> {
  const out: Record<
    string,
    { region: ComponentRegion; states: Record<string, Record<string, string>> }
  > = {};
  for (const [name, d] of COMPONENT_ROSTER) {
    const states: Record<string, Record<string, string>> = {};
    for (const [state, channels] of d.states) {
      const chans: Record<string, string> = {};
      for (const [channel, token] of channels) chans[channel] = token.cssVar;
      states[state] = chans;
    }
    out[name] = { region: d.region, states };
  }
  return out;
}

// ── Ingress validation ──────────────────────────────────────────────────────

/** Validate an untrusted `components` wire block. Returns the cleaned
 *  bindings plus structured issues for everything rejected. A caller that
 *  wants strict behavior (parseThemeWire) throws on non-empty issues; a
 *  tolerant caller may apply `bindings` and surface `issues`. */
export function sanitizeComponentBindings(raw: unknown): {
  bindings: ComponentBindings;
  issues: ThemeIssue[];
} {
  const issues: ThemeIssue[] = [];
  const bindings: ComponentBindings = {};
  if (raw === undefined || raw === null) return { bindings, issues };
  if (typeof raw !== "object" || Array.isArray(raw)) {
    issues.push({
      path: "components",
      code: "shape",
      message: "components must be an object of component → state → channel bindings.",
    });
    return { bindings, issues };
  }
  for (const [component, statesRaw] of Object.entries(raw as Record<string, unknown>)) {
    const desc = COMPONENT_ROSTER.get(component);
    if (!desc) {
      issues.push({
        path: `components.${component}`,
        code: "unknown",
        message: `components: "${component}" is not a known component. See listComponents().`,
      });
      continue;
    }
    if (typeof statesRaw !== "object" || statesRaw === null || Array.isArray(statesRaw)) {
      issues.push({
        path: `components.${component}`,
        code: "shape",
        message: `components.${component}: expected an object of state → channel bindings.`,
      });
      continue;
    }
    const cleanStates: ComponentBindings[string] = {};
    for (const [state, channelsRaw] of Object.entries(statesRaw as Record<string, unknown>)) {
      const channels = desc.states.get(state as ComponentStateName);
      if (!channels) {
        issues.push({
          path: `components.${component}.${state}`,
          code: "unknown",
          message: `components.${component}: "${state}" is not a state of this component ` +
            `(states: ${[...desc.states.keys()].join(", ")}).`,
        });
        continue;
      }
      if (typeof channelsRaw !== "object" || channelsRaw === null || Array.isArray(channelsRaw)) {
        issues.push({
          path: `components.${component}.${state}`,
          code: "shape",
          message: `components.${component}.${state}: expected an object of channel → value.`,
        });
        continue;
      }
      const cleanChannels: ComponentChannelOverrides = {};
      for (const [channel, value] of Object.entries(channelsRaw as Record<string, unknown>)) {
        if (!channels.has(channel as ComponentChannelName)) {
          issues.push({
            path: `components.${component}.${state}.${channel}`,
            code: "unknown",
            message: `components.${component}.${state}: "${channel}" is not a channel of this ` +
              `component (channels: ${[...channels.keys()].join(", ")}).`,
          });
          continue;
        }
        if (!isValidChannelValue(channel as ComponentChannelName, value)) {
          issues.push({
            path: `components.${component}.${state}.${channel}`,
            code: "enum",
            message: `components.${component}.${state}.${channel}: ` +
              `${JSON.stringify(value)} is not a valid ${channel} value.`,
          });
          continue;
        }
        cleanChannels[channel as ComponentChannelName] = value;
      }
      if (Object.keys(cleanChannels).length > 0) {
        cleanStates[state as ComponentStateName] = cleanChannels;
      }
    }
    if (Object.keys(cleanStates).length > 0) bindings[component] = cleanStates;
  }
  return { bindings, issues };
}

// ── Resolve-time lookup ─────────────────────────────────────────────────────

/** The override value for `token`'s (component, state, channel), or null
 *  when no override applies. The resolvers consult this AFTER the HC/RT
 *  mode ratchet (the ratchet beats a re-route, same as it beats pins). */
export function componentChannelOverride(
  token: ComponentToken,
  components: ComponentBindings | undefined,
): string | null {
  const b = token.binding;
  if (!b || !components) return null;
  const v = components[b.component]?.[b.state ?? "base"]?.[b.channel];
  // Defense-in-depth: every ingress sanitizes, but a programmatically
  // assembled wire may not have passed one — never let a garbage value
  // poison the cssVar map.
  if (v === undefined || !isValidChannelValue(b.channel, v)) return null;
  return v;
}

/** Color-channel override as a RoleName (the role resolver's view). */
export function componentRoleOverride(
  token: ComponentToken,
  components: ComponentBindings | undefined,
): RoleName | null {
  const b = token.binding;
  if (!b || !COLOR_CHANNELS.has(b.channel)) return null;
  return componentChannelOverride(token, components) as RoleName | null;
}

/** Canonical, order-independent key fragment for cache keys
 *  (consumer-bridge's overridesKey). */
export function componentBindingsKey(
  components: ComponentBindings | undefined,
): string {
  if (!components) return "";
  return Object.entries(components)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([comp, states]) =>
      Object.entries(states)
        .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
        .map(([state, channels]) =>
          Object.entries(channels ?? {})
            .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
            .map(([ch, v]) => `${comp}.${state}.${ch}=${v}`)
            .join(","),
        )
        .join(","),
    )
    .join(",");
}

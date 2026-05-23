// Scenario registry. Add new scenarios here in the order they should
// appear in the picker. Group bucketing is taken from the `group`
// field; the picker renders one section per group.

import type { ScenarioMeta } from "../harness-store.svelte";

import ToggleScenario     from "./Toggle.scenario.svelte";
import SegmentedScenario  from "./Segmented.scenario.svelte";
import FieldRowScenario   from "./FieldRow.scenario.svelte";

export const SCENARIOS: ScenarioMeta[] = [
  {
    name: "toggle",
    description: "Pill switch — 26×14, ink-when-on. Boolean primitive.",
    group: "Primitives",
    component: ToggleScenario,
  },
  {
    name: "segmented",
    description: "Enum-picker rows — words vs glyphs side-by-side.",
    group: "Primitives",
    component: SegmentedScenario,
  },
  {
    name: "field-row",
    description: "Layout row — label/control grid that anchors every editor row.",
    group: "Layout",
    component: FieldRowScenario,
  },
];

/** Group scenarios for the picker rail. Stable insertion order. */
export function groupedScenarios(): { group: string; scenarios: ScenarioMeta[] }[] {
  const order: string[] = [];
  const map = new Map<string, ScenarioMeta[]>();
  for (const s of SCENARIOS) {
    if (!map.has(s.group)) {
      map.set(s.group, []);
      order.push(s.group);
    }
    map.get(s.group)!.push(s);
  }
  return order.map((g) => ({ group: g, scenarios: map.get(g)! }));
}

export function findScenario(name: string | null): ScenarioMeta | undefined {
  if (!name) return SCENARIOS[0];
  return SCENARIOS.find((s) => s.name === name) ?? SCENARIOS[0];
}

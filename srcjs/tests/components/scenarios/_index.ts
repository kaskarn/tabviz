// Scenario registry. Add new scenarios here in the order they should
// appear in the picker. Group bucketing is taken from the `group`
// field; the picker renders one section per group.

import type { ScenarioMeta } from "../harness-store.svelte";

import ToggleScenario     from "./Toggle.scenario.svelte";
import SegmentedScenario  from "./Segmented.scenario.svelte";
import FieldRowScenario   from "./FieldRow.scenario.svelte";
import GlyphsScenario     from "./Glyphs.scenario.svelte";

// v2 primitives — the new ink-on-cream editorial set.
import V2PillScenario     from "./v2/Pill.scenario.svelte";
import V2KnobScenario     from "./v2/Knob.scenario.svelte";
import V2FieldScenario    from "./v2/Field.scenario.svelte";
import V2SectionsScenario from "./v2/Sections.scenario.svelte";

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
  {
    name: "glyphs",
    description: "Contact sheet of the UI glyph vocabulary — visual audit.",
    group: "Vocabulary",
    component: GlyphsScenario,
  },

  // ── v2 primitives — preview the new editor surface ───────────────
  {
    name: "v2-pill",
    description: "v2 Pill — boolean + segmented + glyph + icon-only in one primitive.",
    group: "v2 primitives",
    component: V2PillScenario,
  },
  {
    name: "v2-knob",
    description: "v2 Knob — number + slider unified. Plain / scrub / track modes, drag-to-adjust.",
    group: "v2 primitives",
    component: V2KnobScenario,
  },
  {
    name: "v2-field",
    description: "v2 Field — labeled row with override-dot gutter + reset affordance.",
    group: "v2 primitives",
    component: V2FieldScenario,
  },
  {
    name: "v2-sections",
    description: "v2 Sections + Accordion — composed into a popover mock of the new column editor.",
    group: "v2 primitives",
    component: V2SectionsScenario,
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

// Scenario registry. Add new scenarios here in the order they should
// appear in the picker. Group bucketing is taken from the `group`
// field; the picker renders one section per group.

import type { ScenarioMeta } from "../harness-store.svelte";

import GlyphsScenario     from "./Glyphs.scenario.svelte";

// v2 primitives — the new ink-on-cream editorial set.
import V2PillScenario     from "./v2/Pill.scenario.svelte";
import V2KnobScenario     from "./v2/Knob.scenario.svelte";
import V2FieldScenario    from "./v2/Field.scenario.svelte";
import V2PickerScenario   from "./v2/Picker.scenario.svelte";
import V2ModeScenario     from "./v2/Mode.scenario.svelte";
import V2SwatchScenario   from "./v2/Swatch.scenario.svelte";
import V2SectionsScenario from "./v2/Sections.scenario.svelte";
import V2ColumnEditorScenario from "./v2/ColumnEditor.scenario.svelte";
import V2VariantPreviewScenario from "./v2/VariantPreview.scenario.svelte";
import V2SchemaSweepScenario from "./v2/SchemaSweep.scenario.svelte";
import V2SettingsScaffoldScenario from "./v2/SettingsScaffold.scenario.svelte";

export const SCENARIOS: ScenarioMeta[] = [
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
    name: "v2-picker",
    description: "v2 Picker — glyph-led dropdown. Column-type, data-field, long+searchable.",
    group: "v2 primitives",
    component: V2PickerScenario,
  },
  {
    name: "v2-mode",
    description: "v2 Mode — four-way MappedValue pill (theme / static / field / condition) + follow-up control pattern.",
    group: "v2 primitives",
    component: V2ModeScenario,
  },
  {
    name: "v2-swatch",
    description: "v2 Swatch — color input with theme palette + recents + native picker.",
    group: "v2 primitives",
    component: V2SwatchScenario,
  },
  {
    name: "v2-sections",
    description: "v2 Sections + Accordion — composed into a popover mock of the new column editor.",
    group: "v2 primitives",
    component: V2SectionsScenario,
  },
  {
    name: "v2-editor",
    description: "Flagship — schema-driven ColumnEditorV2 mounted with numeric / interval / text columns side-by-side.",
    group: "v2 editor",
    component: V2ColumnEditorScenario,
  },
  {
    name: "v2-variant",
    description: "VariantPicker + ColumnPreview isolated — interval / badge / pictogram variant cards, plus preview chips.",
    group: "v2 editor",
    component: V2VariantPreviewScenario,
  },
  {
    name: "v2-schema-sweep",
    description: "Visual regression contact sheet — ColumnEditorV2 mounted against every concrete schema (3-up grid).",
    group: "v2 editor",
    component: V2SchemaSweepScenario,
  },
  {
    name: "v2-settings-scaffold",
    description: "Settings panel design scaffold — the overhauled two-band panel (QuickStrip + THEME + FIGURE) against a real store, no widget behind.",
    group: "v2 settings",
    component: V2SettingsScaffoldScenario,
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

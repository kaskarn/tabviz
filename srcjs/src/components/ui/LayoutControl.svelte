<script lang="ts">
  import type { ForestStore } from "$stores/forestStore.svelte";
  import SettingsSection from "./SettingsSection.svelte";
  import NumberField from "./NumberField.svelte";
  import TextField from "./TextField.svelte";
  import BooleanField from "./BooleanField.svelte";
  import SegmentedField from "./SegmentedField.svelte";

  interface Props {
    store: ForestStore;
  }

  let { store }: Props = $props();

  const layout = $derived(store.spec?.theme?.layout);

  function setField(field: string, value: unknown) {
    store.setThemeField("layout", field, value);
  }

  const positionOptions = [
    { label: "Left",  value: "left"  as "left" | "right" },
    { label: "Right", value: "right" as "left" | "right" },
  ];

  /**
   * tableWidth / plotWidth are `number | "auto"`. The TextField shows "auto"
   * (or empty) for the string case, otherwise the numeric value. Commit
   * "auto"/empty as the string "auto"; anything parseable as a number commits
   * as that number; unparseable input is ignored mid-type.
   */
  function displayAuto(v: number | "auto" | undefined): string {
    if (v == null || v === "auto") return "auto";
    return String(v);
  }

  function commitAutoOrNumber(field: string, raw: string) {
    const t = raw.trim();
    if (t === "" || t.toLowerCase() === "auto") {
      setField(field, "auto");
      return;
    }
    const n = parseFloat(t);
    if (Number.isFinite(n)) setField(field, n);
  }
</script>

{#if layout}
  <SettingsSection
    title="Plot position"
    description="Which side of the table the forest plot sits on."
  >
    <SegmentedField
      label="Position"
      value={layout.plotPosition}
      options={positionOptions}
      onchange={(v) => setField("plotPosition", v)}
    />
  </SettingsSection>

  <SettingsSection
    title="Dimensions"
    description="Leave as 'auto' to let the widget size columns from content."
  >
    <TextField
      label="Table width"
      hint="Pixel width of the table region, or 'auto'"
      placeholder="auto"
      value={displayAuto(layout.tableWidth)}
      onchange={(v) => commitAutoOrNumber("tableWidth", v)}
    />
    <TextField
      label="Plot width"
      hint="Pixel width of the forest plot region, or 'auto'"
      placeholder="auto"
      value={displayAuto(layout.plotWidth)}
      onchange={(v) => commitAutoOrNumber("plotWidth", v)}
    />
  </SettingsSection>

  <SettingsSection
    title="Container"
    description="Outer frame around the whole widget."
  >
    <BooleanField
      label="Border"
      hint="Show a 1px rule around the widget"
      value={layout.containerBorder}
      onchange={(v) => setField("containerBorder", v)}
    />
    <NumberField
      label="Border radius"
      hint="Corner rounding — visible only when the border is on"
      value={layout.containerBorderRadius}
      min={0}
      max={24}
      step={1}
      unit="px"
      onchange={(v) => setField("containerBorderRadius", v)}
    />
  </SettingsSection>
{/if}

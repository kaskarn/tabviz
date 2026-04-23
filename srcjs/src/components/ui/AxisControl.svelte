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

  const axis = $derived(store.spec?.theme?.axis);

  function setField(field: string, value: unknown) {
    store.setThemeField("axis", field, value);
  }

  /**
   * Optional-numeric helpers. `rangeMin`, `rangeMax`, and `tickCount` are all
   * `number | null` — `null` means "let the auto-scaler decide". We surface
   * that as a free-text field with placeholder "auto"; empty or "auto"
   * (case-insensitive) commit as null, anything parseable as a number commits
   * as that number, and unparseable input is ignored to avoid destroying state
   * while the user is mid-type.
   */
  function displayOptional(v: number | null | undefined): string {
    return v == null ? "" : String(v);
  }

  function commitOptionalNumber(field: string, raw: string) {
    const t = raw.trim();
    if (t === "" || t.toLowerCase() === "auto") {
      setField(field, null);
      return;
    }
    const n = parseFloat(t);
    if (Number.isFinite(n)) setField(field, n);
  }

  const gridlineStyleOptions = [
    { label: "Solid",  value: "solid"  as const },
    { label: "Dashed", value: "dashed" as const },
    { label: "Dotted", value: "dotted" as const },
  ];

  // symmetric: `null = auto`, `true = force symmetric`, `false = force asymmetric`.
  const symmetricOptions = [
    { label: "Auto", value: null  as boolean | null },
    { label: "On",   value: true  as boolean | null },
    { label: "Off",  value: false as boolean | null },
  ];
</script>

{#if axis}
  <SettingsSection
    title="Range"
    description="Leave as 'auto' to let the scaler pick from the data."
  >
    <TextField
      label="Min"
      hint="Lower axis bound (e.g. 0.1)"
      placeholder="auto"
      value={displayOptional(axis.rangeMin)}
      onchange={(v) => commitOptionalNumber("rangeMin", v)}
    />
    <TextField
      label="Max"
      hint="Upper axis bound (e.g. 10)"
      placeholder="auto"
      value={displayOptional(axis.rangeMax)}
      onchange={(v) => commitOptionalNumber("rangeMax", v)}
    />
    <NumberField
      label="CI clip factor"
      hint="Clip CIs extending beyond N × estimate range"
      value={axis.ciClipFactor}
      min={0.5}
      max={5}
      step={0.5}
      onchange={(v) => setField("ciClipFactor", v)}
    />
  </SettingsSection>

  <SettingsSection
    title="Ticks"
    description="Override the automatic tick placement."
  >
    <TextField
      label="Tick count"
      hint="Target number of ticks — leave auto for default"
      placeholder="auto"
      value={displayOptional(axis.tickCount)}
      onchange={(v) => commitOptionalNumber("tickCount", v)}
    />
  </SettingsSection>

  <SettingsSection
    title="Gridlines"
    description="Vertical rules at every tick."
  >
    <BooleanField
      label="Show gridlines"
      value={axis.gridlines}
      onchange={(v) => setField("gridlines", v)}
    />
    <SegmentedField
      label="Style"
      hint="Only applies when gridlines are shown"
      value={axis.gridlineStyle}
      options={gridlineStyleOptions}
      onchange={(v) => setField("gridlineStyle", v)}
    />
  </SettingsSection>

  <SettingsSection
    title="Behavior"
    description="Fine-tune how the auto-scaler picks the axis range."
  >
    <BooleanField
      label="Include null value"
      hint="Ensure the null marker stays inside the range"
      value={axis.includeNull}
      onchange={(v) => setField("includeNull", v)}
    />
    <SegmentedField
      label="Symmetric"
      hint="Force equal padding around the null value"
      value={axis.symmetric}
      options={symmetricOptions}
      onchange={(v) => setField("symmetric", v)}
    />
    <BooleanField
      label="Tick at null"
      hint="Always render a tick at the null value"
      value={axis.nullTick}
      onchange={(v) => setField("nullTick", v)}
    />
    <BooleanField
      label="Marker margin"
      hint="Add half-marker-width of padding at range edges"
      value={axis.markerMargin}
      onchange={(v) => setField("markerMargin", v)}
    />
  </SettingsSection>
{/if}

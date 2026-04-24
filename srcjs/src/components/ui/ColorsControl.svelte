<script lang="ts">
  import type { ForestStore } from "$stores/forestStore.svelte";
  import SettingsSection from "./SettingsSection.svelte";
  import ColorField from "./ColorField.svelte";

  interface Props {
    store: ForestStore;
  }

  let { store }: Props = $props();

  // Live color palette — reactive to spec.theme mutations the store performs
  // on our behalf when setThemeField() runs.
  const colors = $derived(store.spec?.theme?.colors);

  function set(field: string, value: string) {
    store.setThemeField("colors", field, value);
  }

  // Field groupings mirror how users think about the palette, not the strict
  // R ColorPalette source order (which has base → rows → intervals → summary
  // mixed by position). Each group is one SettingsSection.
  const baseFields = [
    { key: "background", label: "Background", hint: "Widget background" },
    { key: "foreground", label: "Foreground", hint: "Base text (headers, UI chrome)" },
    { key: "cellForeground", label: "Cell text", hint: "Data cell text (inherits foreground by default)" },
    { key: "primary", label: "Primary", hint: "Accents, active state" },
    { key: "secondary", label: "Secondary", hint: "Subdued text" },
    { key: "accent", label: "Accent", hint: "Highlights, hover" },
    { key: "muted", label: "Muted", hint: "Placeholder / disabled" },
    { key: "border", label: "Border", hint: "Rules and dividers" },
  ];

  const rowFields = [
    { key: "rowBg",    label: "Row background",    hint: "Even rows / base band" },
    { key: "altBg",    label: "Alternate row",     hint: "Odd rows / striped band" },
    { key: "headerBg", label: "Header background", hint: "Column header row (inherits row bg by default)" },
  ];

  const intervalFields = [
    { key: "interval", label: "Interval", hint: "Point marker color" },
    { key: "intervalLine", label: "Interval line", hint: "CI whisker" },
  ];

  const summaryFields = [
    { key: "summaryFill", label: "Summary fill", hint: "Diamond fill" },
    { key: "summaryBorder", label: "Summary border", hint: "Diamond outline" },
  ];
</script>

{#if colors}
  <SettingsSection
    title="Base"
    description="Global hues used across the widget."
  >
    {#each baseFields as f (f.key)}
      <ColorField
        label={f.label}
        hint={f.hint}
        value={(colors as Record<string, string>)[f.key]}
        onchange={(v) => set(f.key, v)}
      />
    {/each}
  </SettingsSection>

  <SettingsSection
    title="Rows"
    description="Banding colors — see the Banding tab for mode and level."
  >
    {#each rowFields as f (f.key)}
      <ColorField
        label={f.label}
        hint={f.hint}
        value={(colors as Record<string, string>)[f.key]}
        onchange={(v) => set(f.key, v)}
      />
    {/each}
  </SettingsSection>

  <SettingsSection
    title="Intervals"
    description="Forest plot marker and whisker colors (per-row marker_color overrides still apply)."
  >
    {#each intervalFields as f (f.key)}
      <ColorField
        label={f.label}
        hint={f.hint}
        value={(colors as Record<string, string>)[f.key]}
        onchange={(v) => set(f.key, v)}
      />
    {/each}
  </SettingsSection>

  <SettingsSection
    title="Summary"
    description="Summary diamond (pooled effect) styling."
  >
    {#each summaryFields as f (f.key)}
      <ColorField
        label={f.label}
        hint={f.hint}
        value={(colors as Record<string, string>)[f.key]}
        onchange={(v) => set(f.key, v)}
      />
    {/each}
  </SettingsSection>
{/if}

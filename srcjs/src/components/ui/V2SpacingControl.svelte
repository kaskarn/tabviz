<script lang="ts">
  // v2 Spacing tab. Per-token overrides on top of the density preset.
  // Matches existing v1 SpacingControl shape: NumberField sliders. The
  // density preset itself is on the Layout tab.
  import type { ForestStore } from "$stores/forestStore.svelte";
  import SettingsSection from "./SettingsSection.svelte";
  import NumberField from "./NumberField.svelte";

  interface Props {
    store: ForestStore;
  }
  let { store }: Props = $props();

  const spacing = $derived(store.spec?.theme?.spacing);

  function set(field: string, value: number) {
    store.setThemeField(["spacing", field], value);
  }

  let advancedOpen = $state(false);

  const tokens = [
    { field: "rowHeight",          label: "Row height",          min: 16, max: 60, step: 1 },
    { field: "headerHeight",       label: "Header height",       min: 18, max: 80, step: 1 },
    { field: "padding",            label: "Plot padding",        min: 0,  max: 40, step: 1 },
    { field: "containerPadding",   label: "Container padding",   min: 0,  max: 40, step: 1 },
    { field: "axisGap",            label: "Axis gap",            min: 0,  max: 40, step: 1 },
    { field: "columnGroupPadding", label: "Column group pad",    min: 0,  max: 24, step: 1 },
    { field: "rowGroupPadding",    label: "Row group pad",       min: 0,  max: 32, step: 1 },
    { field: "cellPaddingX",       label: "Cell padding (X)",    min: 0,  max: 40, step: 1 },
    { field: "footerGap",          label: "Footer gap",          min: 0,  max: 40, step: 1 },
    { field: "titleSubtitleGap",   label: "Title-subtitle gap",  min: 0,  max: 40, step: 1 },
    { field: "bottomMargin",       label: "Bottom margin",       min: 0,  max: 40, step: 1 },
    { field: "indentPerLevel",     label: "Indent per level",    min: 0,  max: 40, step: 1 },
  ];
</script>

{#if spacing}
  <SettingsSection title="Spacing" description="Per-token overrides on top of the density preset (Layout tab). Reset by clearing the override.">
    <button
      type="button"
      class="advanced-toggle"
      onclick={() => (advancedOpen = !advancedOpen)}
      aria-expanded={advancedOpen}
    >{advancedOpen ? "▾" : "▸"} Advanced ({tokens.length} tokens)</button>

    {#if advancedOpen}
      <div class="tokens">
        {#each tokens as t (t.field)}
          <NumberField
            label={t.label}
            value={spacing[t.field] ?? 0}
            min={t.min} max={t.max} step={t.step}
            onchange={(v) => set(t.field, v)}
          />
        {/each}
      </div>
    {/if}
  </SettingsSection>
{/if}

<style>
  .advanced-toggle {
    width: 100%;
    text-align: left;
    padding: 0.4rem 0.5rem;
    border: 1px dashed var(--tv-border);
    background: transparent;
    color: var(--tv-secondary);
    border-radius: 4px;
    cursor: pointer;
    font-size: 0.85rem;
  }
  .advanced-toggle:hover {
    border-style: solid;
    color: var(--tv-fg);
  }
  .tokens {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    margin-top: 0.5rem;
  }
</style>

<!--
  ThemeControl — widget settings-panel Theme tab.

  Phase B (V4 substrate): the entire v3 panel (Identity / Structure /
  Data palettes / Typography / Status / Advanced sections, ~500 LOC)
  was replaced by the shared ThemePanel component used by the studio
  gadget. ThemePanel reads/writes ThemeInputs directly; this file is a
  thin adapter that locates the authoring inputs on the resolved theme
  and forwards edits through the store's setAuthoringInputs setter.
-->
<script lang="ts">
  import type { TabvizStore } from "$stores/tabvizStore.svelte";
  import type { ThemeInputs } from "$types/theme-inputs";
  import ThemePanel from "../theme-panel/ThemePanel.svelte";

  interface Props { store: TabvizStore; }
  const { store }: Props = $props();

  const theme = $derived(store.spec?.theme);
  const inputs = $derived(
    (theme as { authoringInputs?: ThemeInputs } | undefined)?.authoringInputs ?? null,
  );
</script>

{#if inputs}
  <ThemePanel
    {inputs}
    onchange={(next) => store.setAuthoringInputs(next)}
  />
{:else}
  <p class="empty">No authoring inputs on the active theme.</p>
{/if}

<style>
  .empty {
    padding: 16px;
    color: #6b6760;
    font-size: 12px;
    font-style: italic;
  }
</style>

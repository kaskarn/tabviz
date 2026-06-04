<!--
  ThemeControl — widget settings-panel Theme tab.

  Mounts only the controls strip — never the cascade visualization. The
  pedagogical cascade lives in the studio gadget (CascadeView.svelte);
  the cog-icon drawer is a compact editing surface.
-->
<script lang="ts">
  import type { TabvizStore } from "$stores/tabvizStore.svelte";
  import type { ThemeInputs } from "$types/theme-inputs";
  import ThemeControlsStrip from "../theme-panel/ThemeControlsStrip.svelte";

  interface Props { store: TabvizStore; }
  const { store }: Props = $props();

  const theme = $derived(store.spec?.theme);
  const inputs = $derived(
    (theme as { authoringInputs?: ThemeInputs } | undefined)?.authoringInputs ?? null,
  );
</script>

{#if inputs}
  <ThemeControlsStrip
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

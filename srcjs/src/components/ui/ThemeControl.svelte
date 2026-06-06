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
  <!-- D14: the cog drawer is the EVERYDAY surface — polarity + density
       only (preset switching lives in the toolbar ThemeSwitcher).
       Identity anchors / curves / geometry / effects are deliberate
       theme-editing work and live in the studio. -->
  <ThemeControlsStrip
    {inputs}
    only={["polarity", "density"]}
    onchange={(next) => store.setAuthoringInputs(next)}
    onpreview={(next) => store.previewAuthoringInputs(next)}
  />
  <!-- Actionable hint (studio E): "lives in the studio" was a dead end —
       name the command that opens it. -->
  <p class="studio-hint">
    Full theme editing — identity, type, geometry, effects — lives in the
    studio: <code>tabviz_studio(plot)</code> in R.
  </p>
{:else}
  <p class="empty">No authoring inputs on the active theme.</p>
{/if}

<style>
  .studio-hint {
    padding: 10px 16px 14px;
    margin: 0;
    color: var(--tp-muted, #6b6760);
    font-size: 11px;
    border-top: 1px solid var(--tp-rule, #eee8e0);
  }
  .studio-hint code {
    font-family: ui-monospace, "SF Mono", monospace;
    font-size: 10.5px;
    background: var(--tp-input-bg, #f6f3ed);
    padding: 1px 4px;
    border-radius: 3px;
  }
  .empty {
    padding: 16px;
    color: #6b6760;
    font-size: 12px;
    font-style: italic;
  }
</style>

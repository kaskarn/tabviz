<!--
  StudioRail — the studio host for the shared Tier-1 sections
  (settings-overhaul P3). The roomy face of the SAME component the
  settings panel mounts: LCH editors always open, disclosures open,
  Match-brand compound move. Replaces ThemeControlsStrip + the whole
  theme-panel/controls/* dialect, which are deleted. (The --tp-* token
  namespace survives ONLY inside the cascade-pedagogy components, which
  self-define it — no control reads it.)

  Same sections, same vocabulary, same order as settings — learn one
  surface, know both. What the studio ADDS over settings is below the
  rail (pins, spine, inspector), not a different Tier-1 grammar.
-->
<script lang="ts">
  import { studioStore } from "./studio-store.svelte";
  import Tier1Sections from "$components/theme-controls/Tier1Sections.svelte";
  import { tintFromBrand } from "$lib/theme/theme-presets-inputs";
  import "$components/primitives/v2/tokens.css";

  interface Props {
    onchange: (next: import("$types/theme-inputs").ThemeInputs, label?: string) => void;
    onpreview?: (next: import("$types/theme-inputs").ThemeInputs) => void;
  }
  const { onchange, onpreview }: Props = $props();

  const cssVars = $derived(
    (studioStore.resolved?.cssVars ?? {}) as Record<string, string>,
  );
</script>

{#if studioStore.inputs}
  <div class="studio-rail" data-tv-v2>
    <Tier1Sections
      inputs={studioStore.inputs}
      {cssVars}
      layout="roomy"
      {onchange}
      {onpreview}
      showMatchBrand
      onmatchbrand={() => studioStore.inputs && onchange(tintFromBrand(studioStore.inputs, "medium"), "Match brand")}
    />
  </div>
{/if}

<style>
  .studio-rail {
    background: var(--v2-paper, #faf7f0);
    min-height: 100%;
    /* Hosts own the horizontal gutter (one spine across both faces). */
    padding: 0 12px;
  }
</style>

<!--
  ThemeBand — the settings host for the shared Tier-1 sections
  (settings-overhaul P2/P3). A thin wrapper: wires the widget store's
  authoring-inputs channel into the store-agnostic Tier1Sections (the
  ONE implementation both hosts mount; the studio rail is the roomy
  face of the same component).

  DT-11 (boundary-is-real): this file calls ONLY
  setAuthoringInputs/previewAuthoringInputs — never setThemeField with a
  T2/3 path. The grep gate in settings-band-contract.test.ts pins it.
-->
<script lang="ts">
  import type { TabvizStore } from "$stores/tabvizStore.svelte";
  import type { ThemeInputs } from "$types/theme-inputs";
  import Tier1Sections from "$components/theme-controls/Tier1Sections.svelte";
  import { getCssVars } from "$lib/theme/consumer-bridge";

  interface Props { store: TabvizStore; }
  const { store }: Props = $props();

  const theme = $derived(store.spec?.theme);
  const inputs = $derived(
    (theme as { authoringInputs?: ThemeInputs } | undefined)?.authoringInputs ?? null,
  );
  const cssVars = $derived(theme ? getCssVars(theme) : {});
</script>

{#if inputs}
  <Tier1Sections
    {inputs}
    {cssVars}
    layout="compact"
    onchange={(next) => store.setAuthoringInputs(next)}
    onpreview={(next) => store.previewAuthoringInputs(next)}
  />
{/if}

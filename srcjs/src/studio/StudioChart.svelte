<!--
  Stage 3 — StudioChart.svelte
  Live chart rendering: mounts TabvizPlot bound to a tabvizStore whose
  spec.theme is replaced on every studioStore.inputs change.
-->
<script lang="ts">
  import { onMount, untrack } from "svelte";
  import { studioStore } from "./studio-store.svelte";
  import { createTabvizStore } from "../stores/tabvizStore.svelte";
  import { buildTheme } from "../lib/theme/theme-adapter";
  import TabvizPlot from "../svelte/TabvizPlot.svelte";
  import type { WebSpec } from "../types";

  const { spec }: { spec: unknown } = $props();

  // The widget store fed to TabvizPlot. Initialized on mount with the
  // initial spec; spec.theme is replaced on every studioStore.inputs change.
  const store = createTabvizStore();
  let initialized = $state(false);

  onMount(() => {
    const initialSpec = spec as WebSpec;
    if (initialSpec) {
      store.setSpec(initialSpec);
      initialized = true;
    }
  });

  // Reactive: whenever studio inputs change, rebuild the theme and patch
  // spec. The read of `store.spec` is untracked — otherwise this effect
  // would re-trigger itself (it writes to store.spec via setSpec), creating
  // an infinite loop that hangs the main thread.
  $effect(() => {
    if (!initialized) return;
    if (!studioStore.inputs) return;
    const inputs = studioStore.inputs;
    const baseName = studioStore.baseName;
    untrack(() => {
      const currentSpec = store.spec;
      if (!currentSpec) return;
      try {
        const newTheme = buildTheme(inputs, baseName) as unknown as WebSpec["theme"];
        store.setSpec({ ...currentSpec, theme: newTheme });
      } catch (e) {
        console.warn("[StudioChart] buildTheme failed:", e);
      }
    });
  });
</script>

<div class="studio-chart">
  {#if initialized && store.spec}
    <TabvizPlot {store} />
  {:else}
    <p class="loading">Loading chart…</p>
  {/if}
</div>

<style>
  .studio-chart {
    overflow: auto;
    padding: 12px;
    background: #fafafa;
  }
  .loading {
    color: #94a3b8;
    font-style: italic;
    text-align: center;
    padding: 48px;
  }
</style>

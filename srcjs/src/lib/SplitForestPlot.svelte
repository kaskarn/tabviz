<script lang="ts">
  import type { SplitForestStore } from "$stores/splitForestStore.svelte";
  import type { ThemeName } from "$lib/theme-presets";
  import ForestPlot from "./ForestPlot.svelte";
  import SplitSidebar from "$components/split/SplitSidebar.svelte";

  interface Props {
    store: SplitForestStore;
  }

  let { store }: Props = $props();

  const activeStore = $derived(store.activeStore);
  const activeKey = $derived(store.activeKey);
  const payload = $derived(store.payload);
  const sidebarWidth = $derived(store.sidebarWidth);

  // Theme persistence: when theme changes in any plot, persist it across all splits
  function handleThemeChange(themeName: ThemeName) {
    store.setTheme(themeName);
  }

  // Container ref for resize observer
  let containerRef: HTMLDivElement | undefined = $state();

  // Track container dimensions
  $effect(() => {
    if (!containerRef) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        store.setDimensions(width, height);
      }
    });

    observer.observe(containerRef);

    return () => {
      observer.disconnect();
    };
  });
</script>

<div class="split-forest-container" bind:this={containerRef} style:--sidebar-width="{sidebarWidth}px">
  {#if payload}
    <!-- Sidebar with navigation tree -->
    <SplitSidebar {store} />

    <!-- Main plot area -->
    <div class="split-forest-main">
      {#if activeStore.spec}
        {#key activeKey}
          <ForestPlot store={activeStore} onThemeChange={handleThemeChange} />
        {/key}
      {:else}
        <div class="split-forest-empty">
          Select a plot from the sidebar
        </div>
      {/if}
    </div>
  {:else}
    <div class="split-forest-loading">
      Loading...
    </div>
  {/if}
</div>

<style>
  .split-forest-container {
    display: flex;
    height: 100%;
    width: 100%;
    overflow: hidden;
    background: transparent;
    font-family: var(--wf-font-family, system-ui, -apple-system, sans-serif);
  }

  .split-forest-main {
    flex: 1;
    overflow: auto;
    min-width: 0;
    /* Required for flex child to respect overflow when content has min-height */
    min-height: 0;
  }

  .split-forest-empty,
  .split-forest-loading {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 100%;
    color: var(--wf-muted, #64748b);
    font-style: italic;
    font-size: 13px;
  }
</style>

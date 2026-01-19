<script lang="ts">
  import type { ForestStore } from "$stores/forestStore.svelte";
  import type { ThemeName } from "$lib/theme-presets";
  import type { WebTheme } from "$types";
  import ThemeSwitcher from "./ThemeSwitcher.svelte";
  import ViewToggle from "./ViewToggle.svelte";
  import DownloadButton from "./DownloadButton.svelte";
  import ResetButton from "./ResetButton.svelte";
  import ZoomControls from "./ZoomControls.svelte";

  interface Props {
    store: ForestStore;
    enableExport?: boolean;
    enableThemes?: Record<string, WebTheme> | null;  // Available themes (null = disabled)
    enableViewToggle?: boolean;
    enableZoomControls?: boolean;
    enableReset?: boolean;
    onThemeChange?: (themeName: ThemeName) => void;
  }

  let {
    store,
    enableExport = true,
    enableThemes = undefined,  // undefined = show all themes (default behavior)
    enableViewToggle = true,
    enableZoomControls = true,
    enableReset = true,
    onThemeChange,
  }: Props = $props();

  const showZoomControls = $derived(enableZoomControls && store.showZoomControls);

  // Show theme switcher if enableThemes is not null (null explicitly disables it)
  const showThemeSwitcher = $derived(enableThemes !== null);
</script>

<div class="control-toolbar">
  {#if showZoomControls}
    <ZoomControls {store} />
  {/if}
  {#if showThemeSwitcher}
    <ThemeSwitcher {store} availableThemes={enableThemes} {onThemeChange} />
  {/if}
  {#if enableViewToggle}
    <ViewToggle {store} />
  {/if}
  {#if enableReset}
    <ResetButton {store} />
  {/if}
  {#if enableExport}
    <DownloadButton {store} />
  {/if}
</div>

<style>
  .control-toolbar {
    display: flex;
    flex-direction: row;
    gap: 4px;
  }

  /* Floating mode - when placed outside header (absolute positioned) */
  :global(.tabviz-container > .control-toolbar) {
    position: absolute;
    top: 8px;
    right: 8px;
    z-index: 100;
    opacity: 0;
    transition: opacity 0.2s ease;
  }

  :global(.tabviz-container:hover > .control-toolbar) {
    opacity: 1;
  }
</style>

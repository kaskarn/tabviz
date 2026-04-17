<script lang="ts">
  import type { ForestStore } from "$stores/forestStore.svelte";
  import type { ThemeName } from "$lib/theme-presets";
  import type { WebTheme } from "$types";
  import ThemeSwitcher from "./ThemeSwitcher.svelte";
  import DownloadButton from "./DownloadButton.svelte";
  import ResetButton from "./ResetButton.svelte";
  import ZoomControls from "./ZoomControls.svelte";

  interface Props {
    store: ForestStore;
    enableExport?: boolean;
    enableThemes?: Record<string, WebTheme> | null;  // Available themes (null = disabled)
    enableZoomControls?: boolean;
    enableReset?: boolean;
    onThemeChange?: (themeName: ThemeName) => void;
  }

  let {
    store,
    enableExport = true,
    enableThemes = undefined,  // undefined = show all themes (default behavior)
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

  /* ------------------------------------------------------------------ */
  /* Instant hover tooltips for toolbar buttons.                        */
  /* Each button inside .control-toolbar that carries a data-tooltip    */
  /* attribute gets a small label below it on hover.                    */
  /* ------------------------------------------------------------------ */
  /* Every tooltip rule is scoped under .tabviz-container so it can't match
     host-page elements that happen to carry a .control-toolbar or data-tooltip
     attribute (e.g. Bootstrap/Quarto themes). */
  :global(.tabviz-container .control-toolbar button[data-tooltip]),
  :global(.tabviz-container .control-toolbar .download-button-wrapper),
  :global(.tabviz-container .control-toolbar .theme-switcher-wrapper),
  :global(.tabviz-container .control-toolbar .zoom-controls-wrapper) {
    position: relative;
  }

  :global(.tabviz-container .control-toolbar [data-tooltip]::after) {
    content: attr(data-tooltip);
    position: absolute;
    top: calc(100% + 6px);
    right: 0;
    background: rgba(17, 24, 39, 0.95);
    color: #ffffff;
    font-size: 11px;
    font-weight: 500;
    line-height: 1.3;
    letter-spacing: 0.01em;
    padding: 5px 8px;
    border-radius: 4px;
    white-space: nowrap;
    pointer-events: none;
    opacity: 0;
    transform: translateY(-2px);
    transition: opacity 80ms ease-out, transform 80ms ease-out;
    z-index: 10004;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
  }

  :global(.tabviz-container .control-toolbar [data-tooltip]::before) {
    content: "";
    position: absolute;
    top: calc(100% + 1px);
    right: 10px;
    border: 4px solid transparent;
    border-bottom-color: rgba(17, 24, 39, 0.95);
    pointer-events: none;
    opacity: 0;
    transform: translateY(-2px);
    transition: opacity 80ms ease-out, transform 80ms ease-out;
    z-index: 10004;
  }

  :global(.tabviz-container .control-toolbar [data-tooltip]:hover::after),
  :global(.tabviz-container .control-toolbar [data-tooltip]:hover::before) {
    opacity: 1;
    transform: translateY(0);
  }

  :global(.tabviz-container .control-toolbar [data-tooltip][aria-expanded="true"]::after),
  :global(.tabviz-container .control-toolbar [data-tooltip][aria-expanded="true"]::before) {
    opacity: 0;
  }
</style>

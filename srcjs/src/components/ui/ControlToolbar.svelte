<script lang="ts">
  import type { ForestStore } from "$stores/forestStore.svelte";
  import type { ThemeName } from "$lib/theme-presets";
  import type { WebTheme } from "$types";
  import ThemeSwitcher from "./ThemeSwitcher.svelte";
  import DownloadButton from "./DownloadButton.svelte";
  import ResetButton from "./ResetButton.svelte";
  import ZoomControls from "./ZoomControls.svelte";
  import SettingsButton from "./SettingsButton.svelte";
  import TokenPicker from "./TokenPicker.svelte";
  import SourceButton from "./SourceButton.svelte";
  import FullscreenButton from "./FullscreenButton.svelte";

  interface Props {
    store: ForestStore;
    enableExport?: boolean;
    enableThemes?: Record<string, WebTheme> | null;  // Available themes (null = disabled)
    enableZoomControls?: boolean;
    enableReset?: boolean;
    enablePaint?: boolean;
    enableFullscreen?: boolean;
    onThemeChange?: (themeName: ThemeName) => void;
  }

  let {
    store,
    enableExport = true,
    enableThemes = undefined,  // undefined = show all themes (default behavior)
    enableZoomControls = true,
    enableReset = true,
    enablePaint = true,
    enableFullscreen = true,
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
  {#if enablePaint}
    <TokenPicker {store} />
  {/if}
  <SourceButton {store} />
  {#if enableReset}
    <ResetButton {store} />
  {/if}
  {#if enableFullscreen}
    <FullscreenButton />
  {/if}
  {#if enableExport}
    <DownloadButton {store} />
  {/if}
  <SettingsButton {store} />
</div>

<style>
  .control-toolbar {
    display: flex;
    flex-direction: row;
    gap: 2px;
  }

  /* Floating mode - when placed outside header (absolute positioned).
     The toolbar sits in a primary-tinted glass pill that fades in when
     the user hovers the widget, giving the cluster of icons a cohesive
     visual weight without distracting from the table itself. */
  :global(.tabviz-container > .control-toolbar) {
    position: absolute;
    top: 2px;
    right: 4px;
    z-index: 100;
    opacity: 0;
    padding: 1px 2px;
    border-radius: 8px;
    /* Solid tinted bg + border — NO transform, filter, backdrop-filter, or
       will-change here. Any of those would make the toolbar a containing
       block for position:fixed descendants (ThemeSwitcher / ZoomControls /
       DownloadButton autoposition their popovers with viewport coords) and
       drag their popovers to the toolbar's local origin, which also gets
       clipped by the container's overflow:hidden in narrow widgets. */
    background: color-mix(in srgb, var(--tv-primary, #2563eb) 8%, var(--tv-bg, #ffffff));
    border: 1px solid color-mix(in srgb, var(--tv-primary, #2563eb) 18%, transparent);
    box-shadow:
      0 1px 2px color-mix(in srgb, var(--tv-fg, #0f172a) 6%, transparent),
      0 4px 12px -4px color-mix(in srgb, var(--tv-primary, #2563eb) 18%, transparent);
    transition: opacity 0.18s ease;
  }

  :global(.tabviz-container:hover > .control-toolbar),
  :global(.tabviz-container:focus-within > .control-toolbar) {
    opacity: 1;
  }

  /* Keep the toolbar visible whenever a dropdown is open under it — otherwise
     moving the mouse from the button into the popover can break :hover and
     fade the toolbar out mid-interaction. */
  :global(.tabviz-container > .control-toolbar:has(button[aria-expanded="true"])) {
    opacity: 1;
  }

  /* ------------------------------------------------------------------ */
  /* Unified icon-button styling across the toolbar.                    */
  /* Individual components ship their own base styles too, but when     */
  /* they land inside the floating glass pill we override to a          */
  /* transparent, borderless look — the pill owns the visual frame.     */
  /* ------------------------------------------------------------------ */
  :global(.tabviz-container > .control-toolbar button) {
    border-color: transparent !important;
    background: transparent !important;
  }

  /* Inside the floating pill, buttons are icon-only and sit flush against the
     pill's inner padding. Text-bearing triggers (zoom "100%") keep their
     horizontal padding but all others render at their 22px width. */
  :global(.tabviz-container > .control-toolbar button:not(.zoom-trigger-btn)) {
    padding: 0 !important;
  }

  :global(.tabviz-container > .control-toolbar button:hover:not(:disabled):not(.active)),
  :global(.tabviz-container > .control-toolbar button:focus-visible) {
    background: color-mix(in srgb, var(--tv-primary, #2563eb) 12%, transparent) !important;
    color: var(--tv-primary, #2563eb) !important;
  }

  /* `.active` buttons get the standard primary-tint "pressed" treatment
     EXCEPT the paint-mode button — which owns its own accent-color
     styling so users can spot the exit target while painting. */
  :global(.tabviz-container > .control-toolbar button.active:not(.paint-btn)),
  :global(.tabviz-container > .control-toolbar button[aria-expanded="true"]:not(.paint-btn)) {
    background: color-mix(in srgb, var(--tv-primary, #2563eb) 85%, transparent) !important;
    color: var(--tv-bg, #ffffff) !important;
  }

  /* Paint-mode button wears the accent color at full saturation when
     active — louder than the ambient primary tint so "tool is on" pops. */
  :global(.tabviz-container > .control-toolbar button.paint-btn.active) {
    background: var(--tv-accent, #8b5cf6) !important;
    color: #ffffff !important;
    border-color: var(--tv-accent, #8b5cf6) !important;
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

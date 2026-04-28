<script lang="ts">
  // Fullscreen toggle. Uses a CSS overlay approach (position:fixed +
  // tabviz-fullscreen class) rather than the native requestFullscreen()
  // API because most embeddings (RStudio viewer, sandboxed Shiny iframes,
  // Quarto reveal slides) don't permit Element.requestFullscreen(). The
  // overlay covers the host viewport but stays inside the document so
  // popovers, tooltips, and stacking contexts continue to work.

  let { container = $bindable() }: { container?: HTMLElement | null } = $props();

  let isFullscreen = $state(false);

  function toggle() {
    if (!container) {
      // Walk upward from the button to find the .tabviz-container ancestor.
      const btn = document.activeElement;
      if (btn instanceof HTMLElement) {
        container = btn.closest(".tabviz-container") as HTMLElement | null;
      }
    }
    if (!container) return;
    isFullscreen = !isFullscreen;
    container.classList.toggle("tabviz-fullscreen", isFullscreen);
    document.body.classList.toggle("tabviz-fullscreen-active", isFullscreen);
  }

  // Escape key exits fullscreen.
  $effect(() => {
    if (!isFullscreen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        isFullscreen = false;
        container?.classList.remove("tabviz-fullscreen");
        document.body.classList.remove("tabviz-fullscreen-active");
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });
</script>

<button
  class="fullscreen-btn"
  onclick={toggle}
  aria-label={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
  aria-pressed={isFullscreen}
  data-tooltip={isFullscreen ? "Exit fullscreen (Esc)" : "Fullscreen"}
>
  {#if isFullscreen}
    <!-- Compress / exit-fullscreen icon: four arrows pointing inward -->
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M9 21v-3a2 2 0 0 0-2-2H4M21 9h-3a2 2 0 0 1-2-2V4M9 4v3a2 2 0 0 1-2 2H4M21 15h-3a2 2 0 0 0-2 2v3" />
    </svg>
  {:else}
    <!-- Expand / fullscreen icon: four arrows pointing outward -->
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M8 3H5a2 2 0 0 0-2 2v3M21 8V5a2 2 0 0 0-2-2h-3M3 16v3a2 2 0 0 0 2 2h3M16 21h3a2 2 0 0 0 2-2v-3" />
    </svg>
  {/if}
</button>

<style>
  .fullscreen-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 22px;
    height: 22px;
    padding: 0;
    border: 1px solid var(--tv-border, #e2e8f0);
    border-radius: 6px;
    background: var(--tv-bg, #ffffff);
    color: var(--tv-secondary, #64748b);
    cursor: pointer;
    transition: background-color 0.15s ease, color 0.15s ease;
  }

  .fullscreen-btn:hover {
    background: var(--tv-border, #e2e8f0);
    color: var(--tv-fg, #1a1a1a);
  }

  .fullscreen-btn[aria-pressed="true"] {
    background: color-mix(in srgb, var(--tv-accent, #2563eb) 18%, var(--tv-bg, #ffffff));
    color: var(--tv-accent, #2563eb);
    border-color: color-mix(in srgb, var(--tv-accent, #2563eb) 40%, var(--tv-border, #e2e8f0));
  }

  /* Global styles for the overlay state — applied when the toggle is on.
     The container expands to fill the viewport. We avoid `transform`,
     `filter`, and `backdrop-filter` here to keep the toolbar's popover
     positioning math intact (those would create a containing block for
     position:fixed descendants and shift them to the wrong origin). */
  :global(.tabviz-container.tabviz-fullscreen) {
    position: fixed !important;
    inset: 0 !important;
    width: 100vw !important;
    height: 100vh !important;
    max-width: none !important;
    max-height: none !important;
    z-index: 99998;
    overflow: auto;
    background: var(--tv-bg, #ffffff);
  }

  /* Lock host page scroll while the overlay is up so the user can't
     accidentally scroll the underlying document with mouse wheel. */
  :global(body.tabviz-fullscreen-active) {
    overflow: hidden;
  }
</style>

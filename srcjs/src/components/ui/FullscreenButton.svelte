<script lang="ts">
  // Fullscreen toggle. Uses a CSS overlay approach (position:fixed +
  // tabviz-fullscreen class) rather than the native requestFullscreen()
  // API because most embeddings (RStudio viewer, sandboxed Shiny iframes,
  // Quarto reveal slides) don't permit Element.requestFullscreen(). The
  // overlay covers the host viewport but stays inside the document so
  // popovers, tooltips, and stacking contexts continue to work.
  import type { ForestStore } from "$stores/forestStore.svelte";

  interface Props {
    store: ForestStore;
    container?: HTMLElement | null;
  }

  let { store, container = $bindable(null) }: Props = $props();

  let isFullscreen = $state(false);
  let backdrop: HTMLDivElement | null = null;
  let savedZoom = 1.0;

  function resolveContainer(): HTMLElement | null {
    if (container) return container;
    const btn = document.activeElement;
    if (btn instanceof HTMLElement) {
      container = btn.closest(".tabviz-container") as HTMLElement | null;
    }
    return container ?? null;
  }

  function enter() {
    const c = resolveContainer();
    if (!c) return;
    isFullscreen = true;

    // Backdrop sits below the container but above page content. Popovers are
    // portaled to body with z-index ≥ 10001, so they naturally stack above
    // the fullscreen container (z-index 9991). Backdrop is 9990.
    backdrop = document.createElement("div");
    backdrop.className = "tabviz-fullscreen-backdrop";
    backdrop.addEventListener("click", exit);
    document.body.appendChild(backdrop);
    // Force a frame so the fade-in transition runs from opacity 0.
    requestAnimationFrame(() => backdrop?.classList.add("is-active"));

    c.classList.add("tabviz-fullscreen");
    document.body.classList.add("tabviz-fullscreen-active");

    // Auto-magnify: bump zoom up to +40% if the natural content has room to
    // grow. Auto-fit is preserved — when on, fitScale will clamp width back
    // down if zoom-bump would overflow, so the user's resize behavior stays
    // consistent across fullscreen toggles.
    savedZoom = store.zoom;
    const naturalW = store.naturalContentWidth;
    const naturalH = store.naturalContentHeight;
    if (naturalW > 0 && naturalH > 0) {
      // Modal is left/right:4vw, max-height:80vh. Reserve a generous chrome
      // budget on top of naturalH (title/subtitle/toolbar/header rule plus
      // theme-specific display fonts — LOTR themes push this well past 150px)
      // so the bumped zoom doesn't push total modal height past the 80vh cap
      // and produce a scrollbar for content that would otherwise fit.
      const availW = window.innerWidth * 0.92 - 32;
      const availH = window.innerHeight * 0.80 - 32 - 200;
      const fit = Math.min(availW / naturalW, availH / naturalH);
      const target = Math.min(1.4, Math.max(savedZoom, fit));
      if (target > savedZoom + 0.01) {
        store.setZoom(target);
      }
    }
  }

  function exit() {
    if (!isFullscreen) return;
    isFullscreen = false;
    const c = container;
    c?.classList.remove("tabviz-fullscreen");
    document.body.classList.remove("tabviz-fullscreen-active");

    // Restore previous zoom (autoFit was never modified).
    store.setZoom(savedZoom);

    // Reset scroll positions: in auto-fit mode the container has
    // overflow:hidden and a fixed scaledHeight, but a non-zero scrollTop
    // left over from fullscreen browsing would leave the table visually
    // shifted up with no scrollbar to recover it.
    if (c) {
      c.scrollTop = 0;
      c.scrollLeft = 0;
      const main = c.querySelector(".tabviz-main") as HTMLElement | null;
      if (main) {
        main.scrollTop = 0;
        main.scrollLeft = 0;
      }
    }

    // Fade backdrop out, then remove.
    if (backdrop) {
      const b = backdrop;
      backdrop = null;
      b.classList.remove("is-active");
      setTimeout(() => b.remove(), 220);
    }
  }

  function toggle() {
    if (isFullscreen) exit();
    else enter();
  }

  // Escape key exits fullscreen.
  $effect(() => {
    if (!isFullscreen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") exit();
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
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M9 21v-3a2 2 0 0 0-2-2H4M21 9h-3a2 2 0 0 1-2-2V4M9 4v3a2 2 0 0 1-2 2H4M21 15h-3a2 2 0 0 0-2 2v3" />
    </svg>
  {:else}
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
    color: var(--tv-text-muted, #64748b);
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

  /* Dim backdrop appended to <body>. Sits below the modal (9990) but above
     normal page content. Popovers portaled to body land at 10001+ and stack
     above both. */
  :global(body > .tabviz-fullscreen-backdrop) {
    position: fixed;
    inset: 0;
    z-index: 9990;
    background: rgba(15, 23, 42, 0.55);
    backdrop-filter: blur(2px);
    -webkit-backdrop-filter: blur(2px);
    opacity: 0;
    transition: opacity 0.2s ease-out;
  }
  :global(body > .tabviz-fullscreen-backdrop.is-active) {
    opacity: 1;
  }

  /* The widget root becomes a vertically-centered modal: 4vw breathing room
     on each side, height shrinks to content (capped at 80vh, scrolls when
     content is taller). Vertical centering uses `top: 50%; translateY(-50%)`
     so a short table sits in the middle of the viewport instead of stretching
     to fill 80vh with empty background below. Toolbar popovers are portaled
     to <body> (see Portal.svelte) so this transform doesn't capture their
     positioning math into the modal's local coordinate space. */
  :global(.tabviz-container.tabviz-fullscreen) {
    position: fixed !important;
    left: 4vw !important;
    right: 4vw !important;
    top: 50% !important;
    bottom: auto !important;
    width: auto !important;
    height: auto !important;
    max-width: none !important;
    max-height: 80vh !important;
    z-index: 9991;
    /* `!important` beats `.tabviz-container.auto-fit { overflow: hidden }`
       (same specificity, declared later in the bundle). Without this the
       auto-fit rule wins and scaled content past 80vh gets clipped with no
       scrollbar to recover. */
    overflow: auto !important;
    background: var(--tv-bg, #ffffff);
    border-radius: 12px;
    box-shadow:
      0 24px 64px -12px rgba(0, 0, 0, 0.45),
      0 8px 24px -8px rgba(0, 0, 0, 0.25);
    transform: translateY(-50%);
    animation: tabviz-fs-in 0.22s cubic-bezier(0.2, 0.8, 0.2, 1);
  }

  /* In fullscreen the outer modal owns scrolling — suppress the inner
     `.tabviz-main` scrollbar that non-auto-fit mode normally enables, so we
     don't get nested scrollbars stacked on top of each other. */
  :global(.tabviz-container.tabviz-fullscreen .tabviz-main) {
    overflow: visible !important;
  }

  /* Keyframes carry the `translateY(-50%)` base transform forward so the
     modal stays centered while the scale-in plays. Without this, the
     animation would override the base transform and the modal would jump
     down to top:50% during the 220 ms entry. */
  @keyframes tabviz-fs-in {
    from {
      opacity: 0.4;
      transform: translateY(-50%) scale(0.96);
    }
    to {
      opacity: 1;
      transform: translateY(-50%) scale(1);
    }
  }

  /* Lock host page scroll while the overlay is up so the user can't
     accidentally scroll the underlying document with mouse wheel. */
  :global(body.tabviz-fullscreen-active) {
    overflow: hidden;
  }
</style>

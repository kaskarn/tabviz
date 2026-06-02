<script lang="ts">
  import type { TabvizStore } from "$stores/tabvizStore.svelte";
  import { autoPosition } from "$lib/dropdown-position";
  import Portal from "$lib/Portal.svelte";

  interface Props {
    store: TabvizStore;
  }

  const { store }: Props = $props();

  let dropdownOpen = $state(false);
  let triggerEl: HTMLButtonElement | null = $state(null);

  const zoom = $derived(store.zoom);
  const autoFit = $derived(store.autoFit);
  const actualScale = $derived(store.actualScale);
  const isClamped = $derived(store.isClamped);

  // Display percentages
  const displayPercent = $derived(Math.round(actualScale * 100));
  const zoomPercent = $derived(Math.round(zoom * 100));

  // ── Aspect-ratio slider (Phase 4.6) ─────────────────────────────────────
  // Sizes the layout's *shape*, distinct from zoom (scale of the render)
  // and max-size (container constraint). Slider lives in log space so equal
  // drag distances map to equal aspect-ratio multipliers; -1..+1 covers the
  // default flex cap (natural × [0.5, 2]). A sticky detent at zero snaps
  // back to natural within ±5% so "render at natural" is unambiguous.
  const ASPECT_SLIDER_MIN = -1;
  const ASPECT_SLIDER_MAX = 1;
  const ASPECT_STICKY_TOLERANCE = 0.05;

  // Natural aspect from layout: back out the lever-laddered rowHeight so
  // the slider sits at zero whenever the user hasn't pinned a target.
  // Phase 7E hardening: prefer the layout's stable pre-mutation
  // naturalAspect over deriving here. The store-side value uses
  // pre-lever-ladder canvas + natural rowHeight + chrome; deriving
  // from `layout.totalWidth` after mutation drifts the baseline and
  // the slider position <-> ratio mapping changes on every drag —
  // which is what made the slider feel "wild".
  const naturalAspect = $derived.by(() => {
    const fromLayout = store.layout?.naturalAspect;
    if (typeof fromLayout === "number" && fromLayout > 0 && Number.isFinite(fromLayout)) {
      return fromLayout;
    }
    return 1;
  });

  const aspectSliderValue = $derived.by(() => {
    const t = store.targetAspect;
    if (t == null || naturalAspect <= 0) return 0;
    return Math.log2(t / naturalAspect);
  });

  const aspectDisplayRatio = $derived.by(() => {
    const t = store.targetAspect ?? naturalAspect;
    return Math.round(t * 100) / 100;
  });

  const aspectIsPinned = $derived(store.targetAspect != null);
  // Phase 7C: anchor toggle. ON => "auto" (readability-first); OFF =>
  // "width" (v0.30 strict-aspect default, shrinks rows for wide ratios).
  // Reads off the spec; default in the widget skews ON when user hasn't
  // pinned a non-"width" anchor explicitly.
  const aspectAutoAnchor = $derived(
    (store.targetAspectAnchor ?? "width") !== "width"
  );

  function handleAspectSlider(event: Event) {
    const raw = parseFloat((event.target as HTMLInputElement).value);
    if (!Number.isFinite(raw)) return;
    if (Math.abs(raw) <= ASPECT_STICKY_TOLERANCE) {
      store.setTargetAspect(null);
      return;
    }
    // First drag off natural: auto-flip the anchor to "auto" so the
    // slider produces a visible relayout. Without this, the widget
    // defaults to anchor="width" (matching save_plot's back-compat
    // default) and the row-height floor saturates immediately on wide
    // ratios — slider drags appear inert. Only fires on the
    // null -> non-null transition so users who explicitly toggled
    // "Readable rows" off keep their choice on subsequent drags.
    const isFirstDrag = store.targetAspect == null;
    if (isFirstDrag && (store.targetAspectAnchor ?? "width") === "width") {
      store.setTargetAspectAnchor("auto");
    }
    const ratio = naturalAspect * Math.pow(2, raw);
    store.setTargetAspect(ratio);
  }

  function resetAspect() {
    store.setTargetAspect(null);
  }

  function handleAnchorToggle(event: Event) {
    const on = (event.target as HTMLInputElement).checked;
    store.setTargetAspectAnchor(on ? "auto" : "width");
  }

  function closeDropdown() {
    dropdownOpen = false;
  }

  // Handle zoom slider change (fires on release)
  function handleZoomSlider(event: Event) {
    const target = event.target as HTMLInputElement;
    store.setZoom(parseFloat(target.value) / 100);
  }

  // Close dropdown when clicking outside. The popover is portaled to
  // document.body by autoPosition, so ".zoom-controls-wrapper" no longer
  // contains it — we also check the dropdown element itself.
  function handleWindowClick(event: MouseEvent) {
    const target = event.target as HTMLElement;
    if (target.closest(".zoom-controls-wrapper") || target.closest(".zoom-dropdown")) {
      return;
    }
    closeDropdown();
  }
</script>

<svelte:window onclick={handleWindowClick} />

<div class="zoom-controls-wrapper">
  <!-- Trigger button showing current actual scale -->
  <button
    bind:this={triggerEl}
    class="zoom-trigger-btn"
    onclick={() => (dropdownOpen = !dropdownOpen)}
    aria-label="Zoom and display options"
    aria-expanded={dropdownOpen}
    data-tooltip="Zoom & sizing ({displayPercent}%)"
  >
    <!-- Zoom/magnifier icon -->
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.3-4.3" />
      <path d="M11 8v6" />
      <path d="M8 11h6" />
    </svg>
    <span class="zoom-text">{displayPercent}%</span>
  </button>

  {#if dropdownOpen}
    <Portal>
      <div class="zoom-dropdown" use:autoPosition={{ triggerEl }}>
        <!-- Zoom slider row -->
      <div class="zoom-row">
        <button
          class="zoom-btn"
          onclick={() => store.zoomOut()}
          title="Zoom out (Cmd -)"
          aria-label="Zoom out"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
        </button>

        <input
          type="range"
          class="zoom-slider"
          min="50"
          max="200"
          step="5"
          value={zoomPercent}
          onchange={handleZoomSlider}
          title="Zoom level"
          aria-label="Zoom level"
        />

        <button
          class="zoom-btn"
          onclick={() => store.zoomIn()}
          title="Zoom in (Cmd +)"
          aria-label="Zoom in"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
        </button>

        <span class="zoom-value">{zoomPercent}%</span>
      </div>

      <!-- Clamped indicator -->
      {#if isClamped}
        <div class="clamped-note">
          Showing {displayPercent}% (auto-fit)
        </div>
      {/if}

      <!-- Reset button -->
      {#if zoom !== 1.0}
        <button
          class="action-btn"
          onclick={() => store.resetZoom()}
          title="Reset to 100% (Cmd 0)"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
            <path d="M3 3v5h5" />
          </svg>
          Reset to 100%
        </button>
      {/if}

      <div class="divider"></div>

      <!-- Fit to width button -->
      <button
        class="action-btn"
        onclick={() => store.fitToWidth()}
        title="Fit to container width (Cmd 1)"
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M21 12H3M21 12l-4-4m4 4l-4 4M3 12l4-4m-4 4l4 4" />
        </svg>
        Fit to width
      </button>

<!-- Auto-fit checkbox -->
      <label class="checkbox-row">
        <input
          type="checkbox"
          checked={autoFit}
          onchange={(e) => store.setAutoFit((e.target as HTMLInputElement).checked)}
        />
        <span>Auto-fit</span>
        <span class="checkbox-hint">Shrink if too large</span>
      </label>

      <div class="divider"></div>

      <!-- Aspect ratio: reshapes the layout (Phase 4.6 + 7A/C lever ladder).
           Slider snaps to natural at center. Anchor (Phase 7C) controls how
           ratio resolves to absolute dims when only ratio is given:
           "width" anchors width and shrinks rows for wide ratios (the v0.30
           default; aspect strict but rows squish); "auto" anchors the
           limiting dim and grows the other (readability-first; aspect may
           be approximate). The toggle is ON-by-default in the widget so
           interactive use surfaces readable layouts; flipping it off
           reproduces save_plot()'s default. -->
      <div class="section-label">Aspect ratio</div>
      <div class="aspect-row">
        <div class="aspect-track-wrap">
          <input
            type="range"
            class="aspect-slider"
            min={ASPECT_SLIDER_MIN}
            max={ASPECT_SLIDER_MAX}
            step="0.01"
            value={aspectSliderValue}
            oninput={handleAspectSlider}
            aria-label="Target aspect ratio"
          />
          <!-- Detent marker at center = natural aspect (where the slider snaps). -->
          <span class="aspect-detent" class:active={!aspectIsPinned} aria-hidden="true"></span>
        </div>
        <span class="aspect-value" class:at-natural={!aspectIsPinned}>
          {aspectIsPinned ? `${aspectDisplayRatio}:1` : "natural"}
        </span>
      </div>
      <label class="checkbox-row">
        <input
          type="checkbox"
          checked={aspectAutoAnchor}
          onchange={handleAnchorToggle}
        />
        <span>Readable rows</span>
        <span class="checkbox-hint">Grow size to keep rows</span>
      </label>
      {#if aspectIsPinned}
        <button class="action-btn" onclick={resetAspect} title="Render at natural aspect">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
            <path d="M3 3v5h5" />
          </svg>
          Reset to natural
        </button>
      {/if}
      </div>
    </Portal>
  {/if}
</div>

<style>
  .zoom-controls-wrapper {
    position: relative;
  }

  .zoom-trigger-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 4px;
    height: 22px;
    padding: 0 8px;
    border: 1px solid var(--tv-border, #e2e8f0);
    border-radius: 6px;
    background: var(--tv-bg, #ffffff);
    color: var(--tv-text-muted, #64748b);
    font-size: 11px;
    font-weight: 500;
    cursor: pointer;
    transition: background-color 0.15s ease, color 0.15s ease;
  }

  .zoom-trigger-btn:hover {
    background: var(--tv-hover-bg, #e2e8f0);
    color: var(--tv-fg, #1a1a1a);
  }

  .zoom-text {
    min-width: 28px;
    text-align: center;
  }

  .zoom-dropdown {
    /* position: fixed set dynamically by autoPosition to escape clipping */
    min-width: 200px;
    padding: 8px;
    background: var(--tv-bg, #ffffff);
    border: 1px solid var(--tv-border, #e2e8f0);
    border-radius: 8px;
    box-shadow: 0 4px 12px -2px rgba(0, 0, 0, 0.12), 0 2px 4px -1px rgba(0, 0, 0, 0.08);
    z-index: 10001;  /* High z-index to appear above everything */
  }

  .zoom-row {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 2px 0;
  }

  .zoom-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    padding: 0;
    border: 1px solid var(--tv-border, #e2e8f0);
    border-radius: 4px;
    background: var(--tv-bg, #ffffff);
    color: var(--tv-text-muted, #64748b);
    cursor: pointer;
    transition: background-color 0.15s ease, color 0.15s ease;
  }

  .zoom-btn:hover {
    background: var(--tv-hover-bg, #e2e8f0);
    color: var(--tv-fg, #1a1a1a);
  }

  .zoom-slider {
    flex: 1;
    height: 4px;
    margin: 0 4px;
    -webkit-appearance: none;
    appearance: none;
    background: var(--tv-hover-bg, #e2e8f0);
    border-radius: 2px;
    cursor: pointer;
  }

  .zoom-slider::-webkit-slider-thumb {
    -webkit-appearance: none;
    appearance: none;
    width: 14px;
    height: 14px;
    background: var(--tv-accent, #2563eb);
    border-radius: 50%;
    cursor: pointer;
    transition: transform 0.15s ease;
  }

  .zoom-slider::-webkit-slider-thumb:hover {
    transform: scale(1.15);
  }

  .zoom-slider::-moz-range-thumb {
    width: 14px;
    height: 14px;
    background: var(--tv-accent, #2563eb);
    border: none;
    border-radius: 50%;
    cursor: pointer;
  }

  /* Aspect-ratio slider: same visual treatment as the zoom slider so the
     two read as siblings inside the same dropdown. The center detent for
     "natural" is implemented in JS (sticky tolerance), not CSS. */
  .aspect-row {
    display: flex;
    align-items: center;
    gap: 8px;
    margin: 4px 0;
  }

  /* Wrap holds the slider + the center detent marker so the "natural" snap
     point is visible (the snap itself is the JS sticky tolerance). */
  .aspect-track-wrap {
    position: relative;
    flex: 1;
    display: flex;
    align-items: center;
  }

  .aspect-detent {
    position: absolute;
    left: 50%;
    top: 50%;
    transform: translate(-50%, -50%);
    width: 2px;
    height: 10px;
    border-radius: 1px;
    background: var(--tv-border, #cbd5e1);
    pointer-events: none;
    transition: background-color 0.15s ease;
  }
  /* Highlight the detent when the layout is sitting at natural. */
  .aspect-detent.active {
    background: var(--tv-accent, #2563eb);
  }

  .aspect-value.at-natural {
    font-style: italic;
    color: var(--tv-muted, #94a3b8);
  }

  .aspect-slider {
    flex: 1;
    height: 4px;
    -webkit-appearance: none;
    appearance: none;
    background: var(--tv-hover-bg, #e2e8f0);
    border-radius: 2px;
    cursor: pointer;
  }

  .aspect-slider::-webkit-slider-thumb {
    -webkit-appearance: none;
    appearance: none;
    width: 14px;
    height: 14px;
    background: var(--tv-accent, #2563eb);
    border-radius: 50%;
    cursor: pointer;
    transition: transform 0.15s ease;
  }

  .aspect-slider::-webkit-slider-thumb:hover {
    transform: scale(1.15);
  }

  .aspect-slider::-moz-range-thumb {
    width: 14px;
    height: 14px;
    background: var(--tv-accent, #2563eb);
    border: none;
    border-radius: 50%;
    cursor: pointer;
  }

  .aspect-value {
    font-size: 11px;
    font-variant-numeric: tabular-nums;
    color: var(--tv-text-muted, #64748b);
    min-width: 3.5em;
    text-align: right;
  }

  .zoom-value {
    min-width: 36px;
    font-size: 11px;
    font-weight: 500;
    color: var(--tv-text-muted, #64748b);
    text-align: right;
  }

  .clamped-note {
    padding: 4px 8px;
    margin: 4px 0;
    font-size: 10px;
    color: var(--tv-accent, #2563eb);
    background: color-mix(in srgb, var(--tv-accent, #2563eb) 10%, transparent);
    border-radius: 4px;
  }

  .action-btn {
    display: flex;
    align-items: center;
    gap: 6px;
    width: 100%;
    padding: 6px 8px;
    border: none;
    border-radius: 4px;
    background: transparent;
    color: var(--tv-fg, #1a1a1a);
    font-size: 12px;
    text-align: left;
    cursor: pointer;
    transition: background-color 0.15s ease;
  }

  .action-btn:hover {
    background: var(--tv-hover-bg, #f1f5f9);
  }

  .action-btn svg {
    color: var(--tv-text-muted, #64748b);
  }

  .checkbox-row {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 8px;
    font-size: 12px;
    cursor: pointer;
    border-radius: 4px;
  }

  .checkbox-row:hover {
    background: var(--tv-hover-bg, #f1f5f9);
  }

  .checkbox-row input {
    margin: 0;
    accent-color: var(--tv-accent, #2563eb);
  }

  .checkbox-hint {
    margin-left: auto;
    font-size: 10px;
    color: var(--tv-muted, #94a3b8);
  }

  .divider {
    height: 1px;
    margin: 8px 0;
    background: var(--tv-hover-bg, #e2e8f0);
  }

  .section-label {
    padding: 2px 8px 4px;
    font-size: 10px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--tv-muted, #94a3b8);
  }

</style>

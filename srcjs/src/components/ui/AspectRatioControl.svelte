<!--
  Aspect-ratio slider — Phase 4.6 of the aspect-ratio first dimension
  contract. Replaces width / height numeric inputs with a single slider
  bound to `WebSpec.targetAspect`.

  Sticky default: the slider snaps back to the natural aspect when the
  thumb lands within a small tolerance of it, so "render at natural"
  is the unambiguous default position. Drag past the tolerance to pin
  a non-natural aspect.

  Range: derived from natural aspect and the default flex cap (2). At
  natural × 0.5 the layout reaches the FLEX_CAP minimum; at natural × 2
  it reaches the FLEX_CAP maximum. (Beyond the cap, Lever 2 — row-height
  + non-flex column scaling — takes over; the slider lets the user push
  there if they want.) The slider's domain is logarithmic so equal drag
  distances mean equal aspect-ratio multipliers.

  "View source" picks up the ratio via `store.appendOp(ops.setAspectRatio)`,
  which the slider triggers in the store's `setTargetAspect()`.
-->
<script lang="ts">
  import type { ForestStore } from "$stores/forestStore.svelte";
  import SettingsSection from "./SettingsSection.svelte";

  interface Props {
    store: ForestStore;
  }
  let { store }: Props = $props();

  // Natural aspect — derived from the layout. The store's `layout`
  // accessor walks rows/columns/theme; `naturalRowHeight` is the
  // pre-target rowHeight, and `forestWidth` falls out of theme/effective.
  // We compute naturalAspect as effectiveWidth / approxNaturalHeight,
  // mirroring the lever-ladder math in the store.
  const layout = $derived(store.layout);
  const naturalAspect = $derived.by(() => {
    if (!layout) return 1;
    // The layout's totalWidth / totalHeight reflects the post-ladder values
    // when targetAspect is set; back them out by reading naturalRowHeight
    // off the spec.
    const spec = store.spec;
    if (!spec) return 1;
    const rowsCount = layout.rowHeights?.length ?? 0;
    const naturalRowH = spec.theme.spacing.rowHeight;
    const naturalRowsH = rowsCount * naturalRowH;
    const chrome = layout.totalHeight - (layout.rowHeight * rowsCount);
    const naturalH = naturalRowsH + chrome;
    const naturalW = layout.totalWidth;
    return naturalH > 0 ? naturalW / naturalH : 1;
  });

  // Slider in log space — the thumb moves linearly while aspect changes
  // multiplicatively. Range covers [natural × 0.5, natural × 2] by
  // default (the FLEX_CAP), with -1..+1 mapped onto log2 of the multiplier.
  const SLIDER_MIN = -1;       // natural × 0.5
  const SLIDER_MAX = 1;        // natural × 2
  const STICKY_TOLERANCE = 0.05; // ±5% of the slider range

  // Current target → slider position. When unset, sit at 0 (natural detent).
  const sliderValue = $derived.by(() => {
    const t = store.targetAspect;
    if (t == null || naturalAspect <= 0) return 0;
    return Math.log2(t / naturalAspect);
  });

  // Display ratio (rounded for the readout).
  const displayRatio = $derived.by(() => {
    const t = store.targetAspect ?? naturalAspect;
    return Math.round(t * 100) / 100;
  });

  // Whether the user has explicitly pinned a target (vs. natural). Drives
  // the "Reset" affordance and the "natural" detent label visibility.
  const isPinned = $derived(store.targetAspect != null);

  function onInput(e: Event) {
    const raw = parseFloat((e.target as HTMLInputElement).value);
    if (!Number.isFinite(raw)) return;
    // Sticky detent: snap to natural when within the tolerance of zero.
    if (Math.abs(raw) <= STICKY_TOLERANCE) {
      store.setTargetAspect(null);
      return;
    }
    const ratio = naturalAspect * Math.pow(2, raw);
    store.setTargetAspect(ratio);
  }

  function reset() {
    store.setTargetAspect(null);
  }
</script>

<SettingsSection
  title="Aspect ratio"
  description="Drag to reshape the layout. Snaps to natural at center; flex columns absorb width changes (capped at 2×), row heights absorb height changes."
>
  <div class="aspect-row">
    <input
      type="range"
      min={SLIDER_MIN}
      max={SLIDER_MAX}
      step={0.01}
      value={sliderValue}
      oninput={onInput}
      class="aspect-slider"
      aria-label="Target aspect ratio"
    />
    <div class="readout">
      <span class="ratio">{displayRatio}:1</span>
      {#if isPinned}
        <button type="button" class="reset" onclick={reset} aria-label="Reset to natural aspect">
          natural
        </button>
      {:else}
        <span class="natural-tag">natural</span>
      {/if}
    </div>
  </div>
</SettingsSection>

<style>
  .aspect-row {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
  }

  .aspect-slider {
    flex: 1;
    min-width: 0;
    height: 4px;
    accent-color: var(--tv-accent, #2563eb);
  }

  .readout {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 0.85em;
    font-variant-numeric: tabular-nums;
    color: var(--tv-fg, #0f172a);
    white-space: nowrap;
  }

  .ratio {
    min-width: 3.2em;
    text-align: right;
  }

  .natural-tag {
    font-size: 0.85em;
    color: color-mix(in srgb, var(--tv-fg, #0f172a) 55%, transparent);
    font-style: italic;
  }

  .reset {
    border: 1px solid color-mix(in srgb, var(--tv-fg, #0f172a) 18%, transparent);
    background: transparent;
    color: var(--tv-fg, #0f172a);
    border-radius: 4px;
    padding: 1px 6px;
    font-size: 0.85em;
    font-style: italic;
    cursor: pointer;
    transition: background 0.12s;
  }

  .reset:hover {
    background: color-mix(in srgb, var(--tv-accent, #2563eb) 10%, transparent);
  }
</style>

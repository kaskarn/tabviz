<!--
  TabBar — horizontal segmented row for top-level navigation
  (settings panel tabs). Glyph-led so 7+ tabs fit comfortably in a
  340px panel; the visible label appears beside the glyph at wider
  widths and as a tooltip in compact mode.

  Distinct from Pill: TabBar is full-width-aware and renders one row
  of tabs that share width via flex: 1. Active tab inverts ink↔cream
  with a 2px bottom rule in `--v2-hot` so the active state reads
  even at small sizes.
-->
<script lang="ts" generics="T extends string">
  import { glyph as glyphChar } from "$lib/ui-glyphs";
  import type { TabEntry } from "./types";

  interface Props {
    value: T;
    tabs: TabEntry<T>[];
    ariaLabel?: string;
    /** Compact mode shows only glyph; label moves to tooltip. */
    compact?: boolean;
    onchange?: (next: T) => void;
  }

  let {
    value = $bindable(),
    tabs,
    ariaLabel = "Tabs",
    compact = false,
    onchange,
  }: Props = $props();

  function pick(v: T) {
    if (v === value) return;
    value = v;
    onchange?.(v);
  }
</script>

<div class="tabbar" class:compact role="tablist" aria-label={ariaLabel}>
  {#each tabs as t (t.value)}
    {@const active = t.value === value}
    <button
      type="button"
      role="tab"
      class="tab"
      class:active
      aria-selected={active}
      title={compact ? (t.title ?? t.label) : t.title}
      onclick={() => pick(t.value)}
    >
      {#if t.glyph}
        <span class="tab-glyph" aria-hidden="true">{glyphChar(t.glyph)}</span>
      {/if}
      {#if !compact}
        <span class="tab-label">{t.label}</span>
      {/if}
    </button>
  {/each}
</div>

<style>
  .tabbar {
    display: flex;
    gap: 0;
    background: var(--v2-paper-2, #f3efe5);
    border-bottom: 1px solid var(--v2-rule, #d6d0c1);
    padding: 0;
  }
  .tab {
    appearance: none;
    border: 0;
    background: transparent;
    padding: 8px 10px 7px;
    flex: 1 1 0;
    min-width: 0;
    cursor: pointer;
    font: inherit;
    font-family: var(--v2-font-mono, ui-monospace, monospace);
    font-size: var(--v2-text-micro, 9.5px);
    text-transform: uppercase;
    letter-spacing: var(--v2-track-flag, 0.14em);
    color: var(--v2-ink-3, #8a8478);
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    border-bottom: 2px solid transparent;
    transition:
      color var(--v2-dur-snap, 80ms) var(--v2-ease),
      border-color var(--v2-dur-snap, 80ms) var(--v2-ease),
      background var(--v2-dur-snap, 80ms) var(--v2-ease);
  }
  .tab:hover:not(.active) {
    background: var(--v2-hover-tint, rgba(21,20,14,0.05));
    color: var(--v2-ink, #15140e);
  }
  .tab.active {
    color: var(--v2-ink, #15140e);
    background: var(--v2-paper, #faf7f0);
    border-bottom-color: var(--v2-hot, #b53a1f);
  }
  .tab:focus-visible {
    outline: 1px solid var(--v2-focus-ring, #15140e);
    outline-offset: -2px;
    z-index: 1;
  }

  .tab-glyph {
    font-family: var(--v2-font-mono, ui-monospace, monospace);
    font-size: 12px;
    letter-spacing: 0;
    line-height: 1;
    color: inherit;
  }
  .tab-label {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    min-width: 0;
  }

  /* Compact: glyph-only; aligns tabs as fixed-width chips. */
  .tabbar.compact .tab { flex: 0 0 36px; padding: 8px 0; }
  .tabbar.compact .tab-glyph { font-size: 14px; }
</style>

<script lang="ts">
  import type { BarColumnOptions } from "$types";
  import { normalizeValue } from "$lib/scale-utils";

  interface Props {
    value: number | undefined | null;
    maxValue?: number;
    options?: BarColumnOptions;
    naText?: string;
    /** Per-row/cell color override, computed by ForestPlot from the
     * active semantic bundle's markerFill. Lets accent / muted / emphasis
     * paint retint inline bars to match the forest-marker treatment.
     * `null` falls through to the brand default. */
    colorOverride?: string | null;
  }

  let { value, maxValue = 100, options, naText, colorOverride = null }: Props = $props();

  const effectiveMax = $derived(options?.maxValue ?? maxValue);
  const showLabel = $derived(options?.showLabel ?? true);
  // Resolution order: per-column user override > per-row/cell semantic
  // paint > theme brand default. Bars are chrome that should ride brand
  // identity unless explicitly recolored.
  const barColor = $derived(
    options?.color ?? colorOverride ?? "var(--tv-brand, var(--tv-primary, #2563eb))"
  );
  const scale = $derived(options?.scale ?? "linear");

  const percentage = $derived(() =>
    normalizeValue(value, 0, effectiveMax, scale) * 100
  );

  const formattedValue = $derived(() => {
    if (value === undefined || value === null) return "";
    if (value >= 100) return value.toFixed(0);
    if (value >= 10) return value.toFixed(1);
    return value.toFixed(2);
  });
</script>

{#if value !== undefined && value !== null}
  <div class="cell-bar">
    <div class="bar-track">
      <div
        class="bar-fill"
        style:width="{percentage()}%"
        style:background-color={barColor}
      ></div>
    </div>
    {#if showLabel}
      <span class="bar-label">{formattedValue()}</span>
    {/if}
  </div>
{:else if naText}
  <span class="bar-na">{naText}</span>
{/if}

<style>
  .cell-bar {
    display: flex;
    align-items: center;
    gap: 6px;
    min-width: 60px;
  }

  .bar-track {
    flex: 1;
    height: 8px;
    background: var(--tv-border, #e2e8f0);
    border-radius: 2px;
    overflow: hidden;
  }

  .bar-fill {
    height: 100%;
    border-radius: 2px;
    transition: width 0.2s ease-out;
  }

  .bar-label {
    font-size: var(--tv-font-size-sm, 0.75rem);
    font-variant-numeric: tabular-nums;
    min-width: 32px;
    text-align: right;
  }
</style>

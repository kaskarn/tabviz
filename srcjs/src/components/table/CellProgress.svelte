<script lang="ts">
  import type { ProgressColumnOptions } from "$types";
  import { normalizeValue } from "$lib/scale-utils";

  interface Props {
    value: number | undefined | null;
    options?: ProgressColumnOptions;
    naText?: string;
    /** Per-row/cell color override, computed by ForestPlot from the
     * active semantic bundle's markerFill. Lets accent / muted / emphasis
     * paint retint the progress bar to match the forest-marker treatment.
     * `null` falls through to the brand default. */
    colorOverride?: string | null;
  }

  let { value, options, naText, colorOverride = null }: Props = $props();

  const maxValue = $derived(options?.maxValue ?? 100);
  const showLabel = $derived(options?.showLabel ?? true);
  // Resolution order: per-column user override > per-row/cell semantic
  // paint > theme brand default.
  const barColor = $derived(
    options?.color ?? colorOverride ?? "var(--tv-primary, var(--tv-accent, #2563eb))"
  );
  const scale = $derived(options?.scale ?? "linear");

  const percentage = $derived.by(() =>
    normalizeValue(value, 0, maxValue, scale) * 100
  );

  const formattedLabel = $derived.by(() => {
    if (value === undefined || value === null) return "";
    // Label shows raw percent-of-max (not the transformed ratio) so the number
    // matches the user's data even when the bar uses log/sqrt scale.
    if (maxValue <= 0) return "0%";
    return `${Math.round(Math.min(100, Math.max(0, (value / maxValue) * 100)))}%`;
  });
</script>

{#if value !== undefined && value !== null}
  <div class="cell-progress">
    <div class="progress-track">
      <div
        class="progress-fill"
        style:width="{percentage}%"
        style:background-color={barColor}
      ></div>
    </div>
    {#if showLabel}
      <span class="progress-label">{formattedLabel}</span>
    {/if}
  </div>
{:else if naText}
  <span class="progress-na">{naText}</span>
{/if}

<style>
  .cell-progress {
    display: flex;
    align-items: center;
    gap: 6px;
    min-width: 60px;
    width: 100%;
  }

  .progress-track {
    flex: 1;
    height: 10px;
    background: color-mix(in srgb, var(--tv-border, #e2e8f0) 50%, transparent);
    border-radius: 5px;
    overflow: hidden;
  }

  .progress-fill {
    height: 100%;
    border-radius: 5px;
    transition: width 0.2s ease-out;
  }

  .progress-label {
    font-size: var(--tv-font-size-sm, 0.75rem);
    font-variant-numeric: tabular-nums;
    min-width: 32px;
    text-align: right;
  }
</style>

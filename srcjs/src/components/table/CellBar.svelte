<script lang="ts">
  import type { BarColumnOptions } from "$types";

  interface Props {
    value: number | undefined | null;
    maxValue?: number;
    options?: BarColumnOptions;
  }

  let { value, maxValue = 100, options }: Props = $props();

  const effectiveMax = $derived(options?.maxValue ?? maxValue);
  const showLabel = $derived(options?.showLabel ?? true);
  const barColor = $derived(options?.color ?? "var(--wf-primary, #2563eb)");

  const percentage = $derived(() => {
    if (value === undefined || value === null || effectiveMax <= 0) return 0;
    return Math.min(100, Math.max(0, (value / effectiveMax) * 100));
  });

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
    background: var(--wf-border, #e2e8f0);
    border-radius: 2px;
    overflow: hidden;
  }

  .bar-fill {
    height: 100%;
    border-radius: 2px;
    transition: width 0.2s ease-out;
  }

  .bar-label {
    font-size: var(--wf-font-size-sm, 0.75rem);
    font-variant-numeric: tabular-nums;
    min-width: 32px;
    text-align: right;
  }
</style>

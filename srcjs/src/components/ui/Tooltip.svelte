<script lang="ts">
  import type { Row, WebTheme } from "$types";

  interface Props {
    row: Row | null;
    position: { x: number; y: number } | null;
    fields?: string[] | null;
    theme?: WebTheme | undefined;
  }

  let { row, position, fields = null, theme }: Props = $props();

  // Tooltip element for measuring
  let tooltipEl: HTMLDivElement | undefined = $state();

  // Format value for display
  function formatValue(value: unknown): string {
    if (value === null || value === undefined) return "—";
    if (typeof value === "number") {
      if (Number.isInteger(value)) return value.toString();
      return value.toFixed(3);
    }
    return String(value);
  }

  // Get fields to display - only if fields are specified (opt-in)
  const displayFields = $derived.by(() => {
    if (!row || !fields || fields.length === 0) return [];
    const entries = Object.entries(row.metadata);
    return entries.filter(([key]) => fields.includes(key));
  });

  // Compute position styles with viewport boundary detection
  const positionStyle = $derived.by(() => {
    if (!position) return "";

    const tooltipWidth = 220;  // Approximate max width
    const tooltipHeight = 100; // Approximate height
    const margin = 10;

    let x = position.x + margin;
    let y = position.y - margin;

    // Keep tooltip within viewport bounds
    const viewportWidth = typeof window !== 'undefined' ? window.innerWidth : 1000;
    const viewportHeight = typeof window !== 'undefined' ? window.innerHeight : 800;

    // Flip to left side if too close to right edge
    if (x + tooltipWidth > viewportWidth - margin) {
      x = position.x - tooltipWidth - margin;
    }

    // Flip to bottom if too close to top edge
    if (y - tooltipHeight < margin) {
      y = position.y + margin;
      return `left: ${x}px; top: ${y}px; transform: none;`;
    }

    return `left: ${x}px; top: ${y}px;`;
  });

  // Only show tooltip if fields are specified (opt-in behavior)
  const shouldShow = $derived(row && position && fields && fields.length > 0);
</script>

{#if shouldShow}
  <div bind:this={tooltipEl} class="tabviz-tooltip" style={positionStyle}>
    <div class="tooltip-header">{row.label}</div>
    <div class="tooltip-body">
      <div class="tooltip-row tooltip-estimate">
        <span class="tooltip-label">Estimate</span>
        <span class="tooltip-value">
          {formatValue(row.point)} ({formatValue(row.lower)}, {formatValue(row.upper)})
        </span>
      </div>
      {#each displayFields as [key, value] (key)}
        <div class="tooltip-row">
          <span class="tooltip-label">{key}</span>
          <span class="tooltip-value">{formatValue(value)}</span>
        </div>
      {/each}
    </div>
  </div>
{/if}

<style>
  .tabviz-tooltip {
    position: fixed;
    z-index: 1000;
    min-width: 160px;
    max-width: 280px;
    padding: 6px 10px;
    background: var(--wf-fg, #1a1a1a);
    color: var(--wf-bg, #fff);
    border-radius: 4px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
    font-size: 0.7rem;
    line-height: 1.3;
    pointer-events: none;
    transform: translateY(-100%);
  }

  .tooltip-header {
    font-weight: 600;
    padding-bottom: 3px;
    margin-bottom: 3px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.2);
  }

  .tooltip-body {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .tooltip-row {
    display: flex;
    justify-content: space-between;
    gap: 10px;
  }

  .tooltip-row.tooltip-estimate {
    font-weight: 500;
  }

  .tooltip-label {
    color: rgba(255, 255, 255, 0.7);
  }

  .tooltip-value {
    font-variant-numeric: tabular-nums;
    text-align: right;
  }
</style>

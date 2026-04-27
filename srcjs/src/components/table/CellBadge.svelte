<script lang="ts">
  import type { BadgeColumnOptions, CellStyle } from "$types";

  interface Props {
    value: unknown;
    options?: BadgeColumnOptions;
    naText?: string;
    cellStyle?: CellStyle;
  }

  let { value, options, naText, cellStyle }: Props = $props();

  const variants = $derived(options?.variants ?? {});
  const colors = $derived(options?.colors);
  const thresholds = $derived(options?.thresholds);
  const size = $derived(options?.size ?? "base");
  const shape = $derived(options?.shape ?? "pill");
  const outline = $derived(options?.outline ?? false);
  const isMutedRow = $derived(cellStyle?.muted === true);

  const isNa = $derived(value === undefined || value === null);
  const displayValue = $derived.by(() => {
    if (isNa) return naText ?? "";
    return String(value);
  });

  // Resolve color. Precedence:
  //   1. cellStyle.color override
  //   2. thresholds + colors[]  (numeric scale path)
  //   3. colors[value] mapping  (categorical path)
  //   4. variants[value] → semantic
  //   5. theme accent
  const badgeColor = $derived.by(() => {
    if (cellStyle?.color) return cellStyle.color;

    // Threshold path: numeric value bucketed into colors[].
    if (Array.isArray(thresholds) && thresholds.length > 0 && typeof value === "number") {
      const stops = (() => {
        if (Array.isArray(colors) && colors.length === thresholds.length + 1) return colors;
        if (thresholds.length === 1) return ["var(--tv-accent)", "var(--tv-status-negative)"];
        if (thresholds.length === 2)
          return ["var(--tv-status-positive)", "var(--tv-status-warning)", "var(--tv-status-negative)"];
        return ["var(--tv-accent)"];
      })();
      let idx = 0;
      for (const t of thresholds) { if (value >= t) idx++; else break; }
      return stops[Math.min(idx, stops.length - 1)] ?? "var(--tv-accent)";
    }

    // Mapping path (existing behavior).
    const strValue = String(value ?? "");
    if (colors && !Array.isArray(colors) && strValue in colors) {
      return (colors as Record<string, string>)[strValue];
    }
    if (variants && strValue in variants) {
      const variant = variants[strValue];
      switch (variant) {
        case "success": return "var(--tv-status-positive, #16a34a)";
        case "warning": return "var(--tv-status-warning, #f59e0b)";
        case "error":   return "var(--tv-status-negative, #dc2626)";
        case "info":    return "var(--tv-status-info, #2563eb)";
        case "muted":   return "var(--tv-muted, #64748b)";
        default:        return "var(--tv-accent, #2563eb)";
      }
    }
    return "var(--tv-accent, #2563eb)";
  });

  const sizeClass = $derived(size === "sm" ? "badge-sm" : "badge-base");
  const shapeClass = $derived(
    shape === "circle" ? "badge-circle" : shape === "square" ? "badge-square" : "badge-pill"
  );
</script>

{#if isNa}
  {#if displayValue}
    <span class="cell-badge-na">{displayValue}</span>
  {/if}
{:else if displayValue}
  <span
    class="cell-badge {sizeClass} {shapeClass}"
    class:cell-muted={isMutedRow}
    class:badge-outline={outline}
    style:background-color={outline
      ? "transparent"
      : `color-mix(in srgb, ${badgeColor} 15%, var(--tv-bg, #fff))`}
    style:color={badgeColor}
    style:border-color={outline ? badgeColor : "transparent"}
  >
    {displayValue}
  </span>
{/if}

<style>
  .cell-badge {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    font-weight: 500;
    white-space: nowrap;
    border: 1px solid transparent;
    box-sizing: border-box;
  }
  .cell-badge.cell-muted { opacity: 0.5; }

  /* Sizes */
  .badge-sm   { font-size: 0.7em;  font-weight: 600; }
  .badge-base { font-size: 0.77em; font-weight: 600; }

  /* Shapes — pill is content-width with full radius; circle/square force
     equal aspect so "1" and "12" render at the same diameter. */
  .badge-pill   { padding: 0 10px; border-radius: 9999px; }
  .badge-pill.badge-sm   { padding: 0 8px; }

  .badge-circle {
    border-radius: 50%;
    aspect-ratio: 1;
    min-width: 1.6em;
    padding: 0 0.3em;
  }

  .badge-square {
    border-radius: 3px;
    aspect-ratio: 1;
    min-width: 1.6em;
    padding: 0 0.3em;
  }

  .badge-outline {
    /* Outline mode is handled by inline style:background-color/border-color
       above; here we just ensure the border itself is visible. */
    border-style: solid;
    border-width: 1.5px;
  }
</style>

<script lang="ts">
  import type { HeatmapColumnOptions } from "$types";
  import { normalizeValue } from "$lib/scale-utils";

  interface Props {
    value: number | undefined | null;
    options?: HeatmapColumnOptions;
    minValue?: number | null;
    maxValue?: number | null;
    naText?: string;
  }

  let { value, options, minValue, maxValue, naText }: Props = $props();

  const palette = $derived(options?.palette ?? ["#f7fbff", "#08306b"]);
  const decimals = $derived(options?.decimals ?? 2);
  const showValue = $derived(options?.showValue ?? true);
  const scale = $derived(options?.scale ?? "linear");

  // Compute effective min/max (options override computed values)
  const effectiveMin = $derived(options?.minValue ?? minValue ?? 0);
  const effectiveMax = $derived(options?.maxValue ?? maxValue ?? 1);

  // Normalize value to [0, 1]
  const normalized = $derived.by(() => {
    if (value === undefined || value === null || Number.isNaN(value)) return null;
    if (effectiveMax === effectiveMin) return 0.5;
    return normalizeValue(value, effectiveMin, effectiveMax, scale);
  });

  // Parse hex color to RGB
  function parseHex(hex: string): [number, number, number] {
    const h = hex.replace("#", "");
    return [
      parseInt(h.substring(0, 2), 16),
      parseInt(h.substring(2, 4), 16),
      parseInt(h.substring(4, 6), 16),
    ];
  }

  // Interpolate between palette colors
  const bgColor = $derived.by(() => {
    if (normalized === null) return "transparent";
    const n = normalized;
    const stops = palette.length - 1;
    const segment = Math.min(Math.floor(n * stops), stops - 1);
    const t = n * stops - segment;
    const c1 = parseHex(palette[segment]);
    const c2 = parseHex(palette[segment + 1]);
    const r = Math.round(c1[0] + (c2[0] - c1[0]) * t);
    const g = Math.round(c1[1] + (c2[1] - c1[1]) * t);
    const b = Math.round(c1[2] + (c2[2] - c1[2]) * t);
    return `rgb(${r}, ${g}, ${b})`;
  });

  // Auto text color for contrast
  const textColor = $derived.by(() => {
    if (normalized === null) return "inherit";
    const n = normalized;
    const stops = palette.length - 1;
    const segment = Math.min(Math.floor(n * stops), stops - 1);
    const t = n * stops - segment;
    const c1 = parseHex(palette[segment]);
    const c2 = parseHex(palette[segment + 1]);
    const r = c1[0] + (c2[0] - c1[0]) * t;
    const g = c1[1] + (c2[1] - c1[1]) * t;
    const b = c1[2] + (c2[2] - c1[2]) * t;
    // Relative luminance
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return luminance > 0.5 ? "#1a1a1a" : "#ffffff";
  });

  const isNa = $derived(value === undefined || value === null || Number.isNaN(value as number));

  const formattedValue = $derived.by(() => {
    if (isNa) return naText ?? "";
    return (value as number).toFixed(decimals);
  });
</script>

<div
  class="cell-heatmap"
  style:background-color={isNa ? "transparent" : bgColor}
  style:color={isNa ? "inherit" : textColor}
>
  {#if isNa}
    {formattedValue}
  {:else if showValue && formattedValue}
    {formattedValue}
  {/if}
</div>

<style>
  .cell-heatmap {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    height: 100%;
    padding: 2px 6px;
    font-variant-numeric: tabular-nums;
    border-radius: 2px;
    font-size: var(--tv-font-size-sm, 0.75rem);
  }
</style>

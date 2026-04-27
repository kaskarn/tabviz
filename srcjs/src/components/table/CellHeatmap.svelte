<script lang="ts">
  import type { HeatmapColumnOptions, WebTheme } from "$types";
  import { normalizeValue } from "$lib/scale-utils";

  interface Props {
    value: number | undefined | null;
    options?: HeatmapColumnOptions;
    minValue?: number | null;
    maxValue?: number | null;
    naText?: string;
    theme?: WebTheme;
  }

  let { value, options, minValue, maxValue, naText, theme }: Props = $props();

  // Default palette: derive light → dark from the theme's brand color.
  // Light end is a very pale tint (brand mixed into surface base), dark end
  // is brand_deep when the theme pins it. Falls back to the historical blue
  // palette only when no theme is supplied (test/dev contexts).
  const palette = $derived.by((): string[] => {
    if (options?.palette) return options.palette;
    const inputs = theme?.inputs as { brand?: string; brandDeep?: string } | undefined;
    const surface = (theme?.surface as { base?: string } | undefined)?.base ?? "#ffffff";
    const brand = inputs?.brand;
    const brandDeep = inputs?.brandDeep ?? brand;
    if (!brand || !brandDeep) return ["#f7fbff", "#08306b"];
    const light = mixHex(brand, surface, 0.92);
    return [light, brandDeep];
  });

  // Lightweight sRGB hex mix — enough for a 2-stop gradient default. The
  // panel/R cascade uses oklch_mix for full color edits; here we just need
  // a perceptually OK pale tint anchored to brand.
  function mixHex(a: string, b: string, t: number): string {
    const ah = a.replace("#", "");
    const bh = b.replace("#", "");
    const ar = parseInt(ah.substring(0, 2), 16);
    const ag = parseInt(ah.substring(2, 4), 16);
    const ab = parseInt(ah.substring(4, 6), 16);
    const br = parseInt(bh.substring(0, 2), 16);
    const bg = parseInt(bh.substring(2, 4), 16);
    const bb = parseInt(bh.substring(4, 6), 16);
    const r = Math.round(ar * (1 - t) + br * t);
    const g = Math.round(ag * (1 - t) + bg * t);
    const blu = Math.round(ab * (1 - t) + bb * t);
    return `#${r.toString(16).padStart(2,"0")}${g.toString(16).padStart(2,"0")}${blu.toString(16).padStart(2,"0")}`;
  }
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

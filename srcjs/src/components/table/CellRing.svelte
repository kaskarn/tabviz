<script lang="ts">
  import type { CellStyle, RingColumnOptions } from "$types";

  interface Props {
    value: number | undefined | null;
    options?: RingColumnOptions;
    naText?: string;
    cellStyle?: CellStyle;
  }

  let { value, options, naText, cellStyle }: Props = $props();

  // ----- option derivations -------------------------------------------------

  const minValue = $derived(options?.minValue ?? 0);
  const maxValue = $derived(options?.maxValue ?? 1);
  const size = $derived(options?.size ?? "base");
  const sizeClass = $derived(
    size === "sm" ? "size-sm" : size === "lg" ? "size-lg" : "size-base"
  );
  const showLabel = $derived(options?.showLabel ?? true);
  const labelFormat = $derived(options?.labelFormat ?? "percent");
  const labelDecimals = $derived(options?.labelDecimals ?? 0);
  const trackColor = $derived(options?.trackColor ?? "var(--tv-muted)");
  const isMutedRow = $derived(cellStyle?.muted === true);

  // ----- value handling -----------------------------------------------------

  const numericValue = $derived(
    typeof value === "number" ? value : value == null ? null : Number(value)
  );

  const fraction = $derived.by(() => {
    if (numericValue == null || !Number.isFinite(numericValue)) return null;
    if (maxValue <= minValue) return null;
    const clamped = Math.max(minValue, Math.min(maxValue, numericValue));
    return (clamped - minValue) / (maxValue - minValue);
  });

  // ----- color resolution (threshold scale or single color) -----------------

  const filledColor = $derived.by(() => {
    if (cellStyle?.color) return cellStyle.color;     // per-cell override
    const thresholds = options?.thresholds;
    const color = options?.color;
    // Single-color path: identity-secondary by default (with primary
    // fallback in mono themes). Accent is reserved for layered emphasis.
    if (!thresholds || thresholds.length === 0) {
      if (typeof color === "string") return color;
      if (Array.isArray(color) && color.length === 1) return color[0];
      return "var(--tv-secondary, var(--tv-primary))";
    }
    // Threshold path: find the color slot for this value.
    // Threshold defaults when user passed only `thresholds`, not `color`:
    //  1 threshold (2 stops) → secondary / negative
    //  2 thresholds (3 stops) → positive / warning / negative
    //  3+ thresholds → no auto-default, fall back to single secondary
    const stops = (() => {
      if (Array.isArray(color) && color.length === thresholds.length + 1) return color;
      if (thresholds.length === 1) return ["var(--tv-secondary)", "var(--tv-status-negative)"];
      if (thresholds.length === 2)
        return ["var(--tv-status-positive)", "var(--tv-status-warning)", "var(--tv-status-negative)"];
      return ["var(--tv-secondary)"];
    })();
    if (numericValue == null) return stops[0];
    let idx = 0;
    for (const t of thresholds) {
      if (numericValue >= t) idx++;
      else break;
    }
    return stops[Math.min(idx, stops.length - 1)];
  });

  // ----- label format -------------------------------------------------------

  const labelText = $derived.by(() => {
    if (numericValue == null || !Number.isFinite(numericValue)) return "";
    if (labelFormat === "percent") {
      const f = fraction == null ? numericValue : fraction;
      return (f * 100).toFixed(labelDecimals) + "%";
    }
    if (labelFormat === "integer") return String(Math.round(numericValue));
    return numericValue.toFixed(labelDecimals);
  });

  // ----- geometry -----------------------------------------------------------

  // Donut sized by class. Stroke width = ~22% of diameter.
  const diameter = $derived(size === "sm" ? 18 : size === "lg" ? 32 : 24);
  const stroke = $derived(Math.max(2, Math.round(diameter * 0.22)));
  const radius = $derived((diameter - stroke) / 2);
  const cx = $derived(diameter / 2);
  const cy = $derived(diameter / 2);
  const circumference = $derived(2 * Math.PI * radius);
  const dashLen = $derived(fraction == null ? 0 : circumference * fraction);
  const dashGap = $derived(circumference - dashLen);
  // Start at 12 o'clock — rotate the SVG -90deg.
  const titleText = $derived(
    cellStyle?.tooltip ?? `${numericValue ?? "?"}`
  );
</script>

{#if numericValue == null || !Number.isFinite(numericValue)}
  {#if naText}
    <span class="ring-na">{naText}</span>
  {/if}
{:else}
  <span
    class="cell-ring {sizeClass}"
    class:cell-muted={isMutedRow}
    title={titleText}
  >
    <svg
      width={diameter}
      height={diameter}
      viewBox="0 0 {diameter} {diameter}"
      aria-hidden="true"
    >
      <!-- Track ring (full circle) -->
      <circle
        {cx}
        {cy}
        r={radius}
        fill="none"
        stroke={trackColor}
        stroke-width={stroke}
        opacity="0.35"
      />
      <!-- Fill arc via stroke-dasharray. Rotate -90 to start at 12 o'clock. -->
      {#if dashLen > 0}
        <circle
          {cx}
          {cy}
          r={radius}
          fill="none"
          stroke={filledColor}
          stroke-width={stroke}
          stroke-dasharray="{dashLen} {dashGap}"
          stroke-linecap="round"
          transform="rotate(-90 {cx} {cy})"
        />
      {/if}
    </svg>
    {#if showLabel}
      <span class="ring-label">{labelText}</span>
    {/if}
  </span>
{/if}

<style>
  .cell-ring {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    line-height: 1;
  }
  .cell-ring.cell-muted {
    opacity: 0.5;
  }

  .size-sm svg { width: 18px; height: 18px; }
  .size-base svg { width: 24px; height: 24px; }
  .size-lg svg { width: 32px; height: 32px; }

  .ring-label {
    font-variant-numeric: tabular-nums;
    color: var(--tv-cell-fg, var(--tv-fg));
  }
  .size-sm .ring-label { font-size: 0.7em; }
  .size-base .ring-label { font-size: 0.85em; }
  .size-lg .ring-label { font-size: 1em; }

  .ring-na {
    color: var(--tv-muted);
    font-style: italic;
  }
</style>

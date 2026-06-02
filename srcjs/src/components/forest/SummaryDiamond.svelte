<script lang="ts">
  import type { WebTheme, ComputedLayout } from "$types";
  import type { ScaleLinear, ScaleLogarithmic } from "d3-scale";

  interface Props {
    point: number;
    lower: number;
    upper: number;
    yPosition: number;
    xScale: ScaleLinear<number, number> | ScaleLogarithmic<number, number>;
    layout: ComputedLayout;
    /** This plot column's pixel width (from the multi-flex distribution). */
    plotWidth: number;
    theme: WebTheme | undefined;
    label?: string;
  }

  const { point, lower, upper, yPosition, xScale, layout, plotWidth, theme, label }: Props = $props();

  const diamondHeight = 10;
  const halfHeight = diamondHeight / 2;

  // Diamond points: left (lower), top, right (upper), bottom
  const points = $derived.by(() => {
    const xL = xScale(lower);
    const xP = xScale(point);
    const xU = xScale(upper);

    // Clamp to visible area
    const minX = 0;
    const maxX = plotWidth;

    const clampedL = Math.max(minX, xL);
    const clampedU = Math.min(maxX, xU);

    return [
      [clampedL, yPosition].join(","),
      [xP, yPosition - halfHeight].join(","),
      [clampedU, yPosition].join(","),
      [xP, yPosition + halfHeight].join(","),
    ].join(" ");
  });

  // Show arrow indicators if clipped
  const clippedLeft = $derived(xScale(lower) < 0);
  const clippedRight = $derived(xScale(upper) > plotWidth);
</script>

<g class="summary-diamond">
  <!-- Diamond shape -->
  <polygon
    {points}
    fill="var(--tv-summary-fill, #2563eb)"
    stroke="var(--tv-summary-border, #1d4ed8)"
    stroke-width="1"
  />

  <!-- Left arrow if clipped -->
  {#if clippedLeft}
    <path
      d="M 4 {yPosition} L 10 {yPosition - 4} L 10 {yPosition + 4} Z"
      fill="var(--tv-summary-fill, #2563eb)"
    />
  {/if}

  <!-- Right arrow if clipped -->
  {#if clippedRight}
    <path
      d="M {plotWidth - 4} {yPosition} L {plotWidth - 10} {yPosition - 4} L {plotWidth - 10} {yPosition + 4} Z"
      fill="var(--tv-summary-fill, #2563eb)"
    />
  {/if}
</g>

<style>
  .summary-diamond polygon {
    transition: fill 0.15s ease;
  }

  .summary-diamond:hover polygon {
    fill: var(--tv-summary-border, #1d4ed8);
  }
</style>

<script lang="ts">
  import type { ScaleLinear, ScaleLogarithmic } from "d3-scale";
  import { EFFECT } from "$lib/rendering-constants";
  import { summaryDiamondPoints } from "$lib/forest-mark-geometry";

  interface Props {
    point: number;
    lower: number;
    upper: number;
    yPosition: number;
    xScale: ScaleLinear<number, number> | ScaleLogarithmic<number, number>;
    /** This plot column's pixel width (from the multi-flex distribution). */
    plotWidth: number;
  }

  const { point, lower, upper, yPosition, xScale, plotWidth }: Props = $props();

  const halfHeight = EFFECT.SUMMARY_DIAMOND_HEIGHT / 2;

  // Diamond points (left/top/right/bottom) — shared with the SVG export via
  // summaryDiamondPoints, which clamps all three positions (incl. the apex) to
  // [0, plotWidth]. Local plot space, so xOffset = 0.
  const points = $derived(
    summaryDiamondPoints(xScale(lower), xScale(point), xScale(upper), yPosition, halfHeight, 0, plotWidth),
  );

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

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
    theme: WebTheme | undefined;
    label?: string;
  }

  let { point, lower, upper, yPosition, xScale, layout, theme, label }: Props = $props();

  const diamondHeight = $derived(10 ?? 10);
  const halfHeight = $derived(diamondHeight / 2);

  // Diamond points: left (lower), top, right (upper), bottom
  const points = $derived.by(() => {
    const xL = xScale(lower);
    const xP = xScale(point);
    const xU = xScale(upper);

    // Clamp to visible area
    const minX = 0;
    const maxX = layout.forestWidth;

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
  const clippedRight = $derived(xScale(upper) > layout.forestWidth);
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
      d="M {layout.forestWidth - 4} {yPosition} L {layout.forestWidth - 10} {yPosition - 4} L {layout.forestWidth - 10} {yPosition + 4} Z"
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

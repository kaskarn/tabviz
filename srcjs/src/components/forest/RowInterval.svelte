<script lang="ts">
  import type { Row, WebTheme, ComputedLayout } from "$types";
  import type { ScaleLinear, ScaleLogarithmic } from "d3-scale";

  interface Props {
    row: Row;
    yPosition: number;
    xScale: ScaleLinear<number, number> | ScaleLogarithmic<number, number>;
    layout: ComputedLayout;
    theme: WebTheme | undefined;
    onRowClick?: () => void;
    onRowHover?: (hovered: boolean, event?: MouseEvent) => void;
  }

  let {
    row,
    yPosition,
    xScale,
    layout,
    theme,
    onRowClick,
    onRowHover,
  }: Props = $props();

  // Check if row has valid numeric values for rendering
  const hasValidValues = $derived(
    row.point != null && !Number.isNaN(row.point) &&
    row.lower != null && !Number.isNaN(row.lower) &&
    row.upper != null && !Number.isNaN(row.upper)
  );

  // Computed positions (only valid when hasValidValues is true)
  const x1 = $derived(hasValidValues ? xScale(row.lower!) : 0);
  const x2 = $derived(hasValidValues ? xScale(row.upper!) : 0);
  const cx = $derived(hasValidValues ? xScale(row.point!) : 0);

  // Point size scaled by weight if available
  const pointSize = $derived.by(() => {
    const baseSize = theme?.shapes.pointSize ?? 6;
    const weight = row.metadata.weight as number | undefined;
    if (weight) {
      // Scale between 0.5x and 2x based on weight
      const scale = 0.5 + Math.sqrt(weight / 100) * 1.5;
      return Math.min(Math.max(baseSize * scale, 3), baseSize * 2.5);
    }
    return baseSize;
  });

  // Color based on point direction relative to null
  const pointColor = $derived.by(() => {
    if (!theme) return "#2563eb";
    const nullValue = layout.nullValue;
    return row.point > nullValue
      ? theme.colors.intervalPositive
      : row.point < nullValue
        ? theme.colors.intervalNegative
        : theme.colors.muted;
  });
</script>

{#if hasValidValues}
  <g
    class="interval-row"
    role="button"
    tabindex="0"
    onclick={onRowClick}
    onmouseenter={(e) => onRowHover?.(true, e)}
    onmouseleave={(e) => onRowHover?.(false, e)}
    onkeydown={(e) => e.key === "Enter" && onRowClick?.()}
  >
    <!-- CI line -->
    <line
      {x1}
      {x2}
      y1={yPosition}
      y2={yPosition}
      stroke="var(--wf-ci-line, #475569)"
      stroke-width={theme?.shapes.lineWidth ?? 1.5}
    />

    <!-- CI whiskers (caps) -->
    <line
      x1={x1}
      x2={x1}
      y1={yPosition - 4}
      y2={yPosition + 4}
      stroke="var(--wf-ci-line, #475569)"
      stroke-width={theme?.shapes.lineWidth ?? 1.5}
    />
    <line
      x1={x2}
      x2={x2}
      y1={yPosition - 4}
      y2={yPosition + 4}
      stroke="var(--wf-ci-line, #475569)"
      stroke-width={theme?.shapes.lineWidth ?? 1.5}
    />

    <!-- Point estimate (square) -->
    <rect
      x={cx - pointSize}
      y={yPosition - pointSize}
      width={pointSize * 2}
      height={pointSize * 2}
      fill={pointColor}
      class="point-estimate"
    />
  </g>
{/if}

<style>
  .interval-row {
    cursor: pointer;
    outline: none;
  }

  .interval-row:hover .point-estimate,
  .interval-row:focus .point-estimate {
    opacity: 0.8;
  }

  .point-estimate {
    transition: opacity 0.15s ease;
  }
</style>

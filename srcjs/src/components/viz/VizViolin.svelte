<script lang="ts">
  import type { Row, WebTheme, VizViolinColumnOptions, VizViolinEffect, KDEResult } from "$types";
  import type { ScaleLinear, ScaleLogarithmic } from "d3-scale";
  import { computeKDE, computeQuartiles, normalizeKDE } from "$lib/viz-utils";
  import { vizBand, VIZ_BAND_MIN } from "$lib/viz-mark-geometry";
  import { resolveMarkerStyle } from "$lib/marker-styling";
  import { semanticMarkOpacity } from "$lib/semantic-styling";
  import { VIZ } from "$lib/rendering-constants";
  import { getCssVars, readContentPrimary } from "$lib/theme/consumer-bridge";

  interface Props {
    row: Row;
    yPosition: number;
    rowHeight: number;
    options: VizViolinColumnOptions;
    theme: WebTheme | undefined;
    /** Pre-computed column scale, shared across all rows. Always provided by the
     *  parent (the only renderer); the column owns scale construction. */
    sharedScale: ScaleLinear<number, number> | ScaleLogarithmic<number, number>;
  }

  const { row, yPosition, rowHeight, options, theme, sharedScale }: Props = $props();

  // Compute KDE for each effect
  const effectKDEs = $derived.by((): (KDEResult | null)[] => {
    return options.effects.map((effect) => {
      const data = row.metadata[effect.data] as number[] | undefined;
      if (!data || !Array.isArray(data) || data.length < 2) {
        return null;
      }
      return computeKDE(data, options.bandwidth);
    });
  });

  // Compute quartiles for each effect (for median/quartile lines)
  const effectQuartiles = $derived.by(() => {
    return options.effects.map((effect) => {
      const data = row.metadata[effect.data] as number[] | undefined;
      if (!data || !Array.isArray(data) || data.length < 2) {
        return null;
      }
      return computeQuartiles(data);
    });
  });

  // Check if we have valid data
  const hasValidData = $derived(effectKDEs.some((k) => k !== null));

  const xScale = $derived(sharedScale);

  // Violin dimensions
  // Band-split math shared with the SVG export via vizBand. Note: maxWidth now
  // derives from the FLOORED bandHeight (matching the export) — the DOM
  // previously used the unfloored height, a divergence on sub-floor rows.
  const violinConfig = $derived.by(() => {
    const { totalHeight, bandHeight, gap } = vizBand(rowHeight, VIZ.VIOLIN_HEIGHT_RATIO, options.effects.length, VIZ_BAND_MIN.violin);
    return {
      maxWidth: bandHeight / 2, // half-height per side of the mirrored violin
      violinHeight: bandHeight,
      gap,
      totalHeight,
    };
  });

  // Default colors from theme, with fallbacks
  const defaultColors = $derived(
    theme?.series?.map(s => s.fill) ?? ["#3b82f6", "#22c55e", "#f59e0b", "#ef4444", "#8b5cf6"]
  );

  // Per-row overrides (from tabviz(marker_color = "col") / marker_opacity)
  const rowColorOverride = $derived(row.markerStyle?.color ?? null);
  const rowOpacityOverride = $derived(row.markerStyle?.opacity ?? null);
  const numEffects = $derived(options.effects.length);

  // Resolve full marker style (fill + optional outline) via the cascade.
  function getMarkerStyle(effect: VizViolinEffect, idx: number) {
    const base = effect.color ?? defaultColors[idx % defaultColors.length];
    return resolveMarkerStyle(base, rowColorOverride, row.style, numEffects, theme);
  }

  function getEffectOpacity(effect: VizViolinEffect): number {
    const base = effect.opacity ?? effect.fillOpacity ?? VIZ.VIOLIN_OPACITY;
    return rowOpacityOverride !== null ? rowOpacityOverride : base;
  }

  // Generate violin path for an effect
  function generateViolinPath(kde: KDEResult, centerY: number, maxHalfHeight: number): string {
    if (kde.x.length < 2) return "";

    // Normalize KDE to max half-height
    const normalized = normalizeKDE(kde, maxHalfHeight);

    // Build path: right side (positive y offset), then left side (negative y offset)
    const points: string[] = [];

    // Right side (top to bottom in data space, but we're rendering horizontally)
    for (let i = 0; i < normalized.x.length; i++) {
      const x = xScale(normalized.x[i]);
      const y = centerY - normalized.y[i]; // Above center
      points.push(i === 0 ? `M ${x} ${y}` : `L ${x} ${y}`);
    }

    // Left side (reversed, below center)
    for (let i = normalized.x.length - 1; i >= 0; i--) {
      const x = xScale(normalized.x[i]);
      const y = centerY + normalized.y[i]; // Below center
      points.push(`L ${x} ${y}`);
    }

    points.push("Z");
    return points.join(" ");
  }
</script>

{#if hasValidData}
  <g class="viz-violin-row">
    {#each options.effects as effect, idx}
      {@const kde = effectKDEs[idx]}
      {@const quartiles = effectQuartiles[idx]}
      {#if kde && kde.x.length >= 2}
        {@const violinCenterY = yPosition - violinConfig.totalHeight / 2 +
          violinConfig.violinHeight / 2 + idx * (violinConfig.violinHeight + violinConfig.gap)}
        {@const ms = getMarkerStyle(effect, idx)}
        {@const opacity = getEffectOpacity(effect)}
        {@const path = generateViolinPath(kde, violinCenterY, violinConfig.maxWidth)}
        {@const defaultLineColor = theme ? readContentPrimary(getCssVars(theme)) : "#1a1a1a"}
        {@const lineColor = ms.stroke ?? defaultLineColor}
        {@const themeLineWidth = theme?.plot?.lineWidth ?? 1.5}
        {@const violinStrokeW = ms.stroke ? ms.strokeWidth : themeLineWidth * VIZ.VIOLIN_STROKE_RATIO}
        {@const medianStrokeW = Math.max(1, themeLineWidth * 1.3)}
        {@const quartileStrokeW = Math.max(0.5, themeLineWidth * 0.67)}
        {@const mutedOp = semanticMarkOpacity(row.style)}
        {@const fillOp = mutedOp ? opacity * mutedOp.fill : opacity}
        {@const strokeOp = mutedOp ? mutedOp.stroke : 1}

        <!-- Violin shape -->
        <path
          d={path}
          fill={ms.fill}
          fill-opacity={fillOp}
          stroke={lineColor}
          stroke-width={violinStrokeW}
          stroke-opacity={strokeOp}
          class="violin-path"
        />

        <!-- Median line -->
        {#if options.showMedian !== false && quartiles}
          {@const medianX = xScale(quartiles.median)}
          <line
            x1={medianX}
            x2={medianX}
            y1={violinCenterY - violinConfig.maxWidth * 0.6}
            y2={violinCenterY + violinConfig.maxWidth * 0.6}
            stroke={lineColor}
            stroke-width={medianStrokeW}
            stroke-opacity={strokeOp}
          />
        {/if}

        <!-- Quartile lines -->
        {#if options.showQuartiles && quartiles}
          {@const q1X = xScale(quartiles.q1)}
          {@const q3X = xScale(quartiles.q3)}
          <line
            x1={q1X}
            x2={q1X}
            y1={violinCenterY - violinConfig.maxWidth * 0.4}
            y2={violinCenterY + violinConfig.maxWidth * 0.4}
            stroke={lineColor}
            stroke-width={quartileStrokeW}
            stroke-dasharray="2,2"
            stroke-opacity={strokeOp}
          />
          <line
            x1={q3X}
            x2={q3X}
            y1={violinCenterY - violinConfig.maxWidth * 0.4}
            y2={violinCenterY + violinConfig.maxWidth * 0.4}
            stroke={lineColor}
            stroke-width={quartileStrokeW}
            stroke-dasharray="2,2"
            stroke-opacity={strokeOp}
          />
        {/if}
      {/if}
    {/each}
  </g>
{/if}

<style>
  .viz-violin-row {
    pointer-events: auto;
  }

  .violin-path {
    transition: fill-opacity 0.15s ease;
  }

  .viz-violin-row:hover .violin-path {
    fill-opacity: 0.7;
  }
</style>

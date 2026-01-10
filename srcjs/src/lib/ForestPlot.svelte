<script lang="ts">
  import { slide } from "svelte/transition";
  import type { ForestStore } from "$stores/forestStore.svelte";
  import type { ThemeName } from "$lib/theme-presets";
  import type { WebTheme, ColumnSpec, ColumnOptions, Row, DisplayRow, GroupHeaderRow, DataRow, CellStyle } from "$types";
  import RowInterval from "$components/forest/RowInterval.svelte";
  import EffectAxis from "$components/forest/EffectAxis.svelte";
  import SummaryDiamond from "$components/forest/SummaryDiamond.svelte";
  import PlotHeader from "$components/forest/PlotHeader.svelte";
  import PlotFooter from "$components/forest/PlotFooter.svelte";
  import ColumnHeaders from "$components/table/ColumnHeaders.svelte";
  import GroupHeader from "$components/forest/GroupHeader.svelte";
  import Tooltip from "$components/ui/Tooltip.svelte";
  import CellBar from "$components/table/CellBar.svelte";
  import CellPvalue from "$components/table/CellPvalue.svelte";
  import CellSparkline from "$components/table/CellSparkline.svelte";
  import CellContent from "$components/table/CellContent.svelte";
  import CellIcon from "$components/table/CellIcon.svelte";
  import CellBadge from "$components/table/CellBadge.svelte";
  import CellStars from "$components/table/CellStars.svelte";
  import CellImg from "$components/table/CellImg.svelte";
  import CellReference from "$components/table/CellReference.svelte";
  import CellRange from "$components/table/CellRange.svelte";
  import ControlToolbar from "$components/ui/ControlToolbar.svelte";
  import {
    ROW_ODD_OPACITY,
    GROUP_HEADER_OPACITY,
    ROW_HOVER_OPACITY,
    ROW_SELECTED_OPACITY,
    ROW_SELECTED_HOVER_OPACITY,
    DEPTH_BASE_OPACITY,
  } from "$lib/rendering-constants";
  import {
    formatNumber,
    formatEvents,
    formatInterval,
    addThousandsSep,
    abbreviateNumber,
  } from "$lib/formatters";

  interface Props {
    store: ForestStore;
    onThemeChange?: (themeName: ThemeName) => void;
  }

  let { store, onThemeChange }: Props = $props();

  // Reactive derivations from store
  const spec = $derived(store.spec);
  const visibleRows = $derived(store.visibleRows);
  const displayRows = $derived(store.displayRows);
  const layout = $derived(store.layout);
  const xScale = $derived(store.xScale);
  const theme = $derived(spec?.theme);
  const includeForest = $derived(spec?.data.includeForest ?? true);
  const leftColumns = $derived(store.leftColumns);
  const rightColumns = $derived(store.rightColumns);
  const leftColumnDefs = $derived(store.leftColumnDefs);
  const rightColumnDefs = $derived(store.rightColumnDefs);
  const labelHeader = $derived(spec?.data.labelHeader || "Study");
  const tooltipRow = $derived(store.tooltipRow);
  const tooltipPosition = $derived(store.tooltipPosition);
  const selectedRowIds = $derived(store.selectedRowIds);
  const hoveredRowId = $derived(store.hoveredRowId);

  // Layout mode state
  const widthMode = $derived(store.widthMode);
  const heightPreset = $derived(store.heightPreset);

  // Create reactive dependency on columnWidths to trigger re-render when widths change
  const columnWidthsSnapshot = $derived({ ...store.columnWidths });

  // Container ref for fill mode width detection
  let containerRef: HTMLDivElement | undefined = $state();
  let scalableRef: HTMLDivElement | undefined = $state();

  // Container width from ResizeObserver (for fill mode scaling)
  let containerWidth = $state(0);
  let scalableNaturalWidth = $state(0);
  let scalableNaturalHeight = $state(0);

  // Natural content width from store (calculated from column specs)
  const naturalContentWidth = $derived(store.naturalContentWidth);

  // Scale factor for fill mode: stretch or shrink content to fit container
  const fillScale = $derived.by(() => {
    if (widthMode !== 'fill' || containerWidth <= 0) {
      return 1;
    }
    // Use measured width (more accurate - includes padding, borders, gaps)
    // Fall back to calculated width from store if not measured yet
    const contentWidth = scalableNaturalWidth > 0
      ? scalableNaturalWidth
      : naturalContentWidth;
    if (contentWidth <= 0) return 1;

    // Scale to fit content within container (both up and down)
    const scale = containerWidth / contentWidth;
    // Don't scale below 0.6 (text becomes unreadable) or above 2.0 (too stretched)
    return Math.max(0.6, Math.min(2.0, scale));
  });

  // Scaled height for container sizing (CSS transform doesn't affect layout)
  const scaledHeight = $derived(scalableNaturalHeight * fillScale);

  // ResizeObserver for fill mode - track both container width and scalable height
  $effect(() => {
    if (!containerRef || !scalableRef) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (entry.target === containerRef) {
          containerWidth = entry.contentRect.width;
        } else if (entry.target === scalableRef) {
          scalableNaturalWidth = entry.contentRect.width;
          scalableNaturalHeight = entry.contentRect.height;
        }
      }
    });

    observer.observe(containerRef);
    observer.observe(scalableRef);

    return () => {
      observer.disconnect();
    };
  });

  // Check if export is enabled (default true)
  const enableExport = $derived(spec?.interaction?.enableExport !== false);

  // Get available themes for theme switcher (null = disabled, object = custom themes)
  const enableThemes = $derived(spec?.interaction?.enableThemes);

  // Check if the data has any groups
  const hasGroups = $derived((spec?.data.groups?.length ?? 0) > 0);

  // Compute total height of the rows area (accounting for variable row heights like spacers)
  const rowsAreaHeight = $derived.by(() => {
    if (layout.rowPositions.length > 0 && layout.rowHeights.length > 0) {
      const lastIdx = layout.rowPositions.length - 1;
      return (layout.rowPositions[lastIdx] ?? 0) + (layout.rowHeights[lastIdx] ?? layout.rowHeight);
    }
    return displayRows.length * layout.rowHeight;
  });

  // Compute Y offsets for annotation labels to avoid collisions
  // Labels that are too close in x-space get staggered vertically
  const annotationLabelOffsets = $derived.by(() => {
    const annotations = spec?.annotations ?? [];
    const labeledAnnotations = annotations
      .filter(a => a.type === "reference_line" && a.label)
      .map(a => ({ id: a.id, x: xScale(a.x), label: a.label }))
      .sort((a, b) => a.x - b.x);

    const offsets: Record<string, number> = {};
    // Labels are center-anchored, so we need generous spacing to avoid overlap
    // A 100px label extends 50px in each direction from its anchor point
    const MIN_LABEL_SPACING = 120;
    const STAGGER_OFFSET = -18; // Move labels up by ~1.5 line heights

    for (let i = 0; i < labeledAnnotations.length; i++) {
      const current = labeledAnnotations[i];
      offsets[current.id] = 0;

      // Check for collision with previous label
      if (i > 0) {
        const prev = labeledAnnotations[i - 1];
        const xDiff = current.x - prev.x;
        if (xDiff < MIN_LABEL_SPACING) {
          // Alternate labels above/below to avoid overlap
          offsets[current.id] = offsets[prev.id] === 0 ? STAGGER_OFFSET : 0;
        }
      }
    }

    return offsets;
  });

  // Helper to check if a row is selected
  function isSelected(rowId: string): boolean {
    return selectedRowIds.has(rowId);
  }

  // Helper to get unique key for display rows
  function getDisplayRowKey(dr: DisplayRow, idx: number): string {
    if (dr.type === "group_header") {
      return `group_${dr.group.id}`;
    }
    return dr.row.id;
  }

  // Helper to get column width (dynamic or default)
  // Returns "auto" for auto-width columns, "{n}px" for fixed-width columns
  // Uses columnWidthsSnapshot to ensure Svelte 5 reactivity
  function getColWidth(column: ColumnSpec): string {
    const dynamicWidth = columnWidthsSnapshot[column.id];
    if (typeof dynamicWidth === "number") return `${dynamicWidth}px`;
    if (typeof column.width === "number") return `${column.width}px`;
    return "auto";
  }

  // Helper to get label column width
  // Uses columnWidthsSnapshot to ensure Svelte 5 reactivity
  function getLabelWidth(): string | undefined {
    const width = columnWidthsSnapshot["__label__"];
    return width ? `${width}px` : undefined;
  }

  // Helper to get label column flex
  // Uses columnWidthsSnapshot to ensure Svelte 5 reactivity
  function getLabelFlex(): string {
    return columnWidthsSnapshot["__label__"] ? "none" : "1";
  }

  // Plot resize state and handlers
  let resizingPlot = $state(false);
  let plotStartX = 0;
  let plotStartWidth = 0;

  function startPlotResize(e: PointerEvent) {
    if (!spec?.interaction.enableResize) return;
    e.preventDefault();
    e.stopPropagation();
    resizingPlot = true;
    plotStartX = e.clientX;
    plotStartWidth = layout.forestWidth;
    document.addEventListener("pointermove", onPlotResize);
    document.addEventListener("pointerup", stopPlotResize);
  }

  function onPlotResize(e: PointerEvent) {
    if (!resizingPlot) return;
    // Dragging right increases plot width, dragging left decreases
    const delta = e.clientX - plotStartX;
    store.setPlotWidth(plotStartWidth + delta);
  }

  function stopPlotResize() {
    resizingPlot = false;
    document.removeEventListener("pointermove", onPlotResize);
    document.removeEventListener("pointerup", stopPlotResize);
  }

  // Height style based on preset (must be inline to override htmlwidgets inline style)
  // Use max-height for fixed presets so container doesn't fill with empty space
  const heightStyle = $derived.by(() => {
    switch (heightPreset) {
      case 'small': return 'height: auto; max-height: 300px; overflow-y: auto;';
      case 'medium': return 'height: auto; max-height: 500px; overflow-y: auto;';
      case 'large': return 'height: auto; max-height: 900px; overflow-y: auto;';
      case 'full': return 'height: auto; max-height: none; overflow: visible;';
      case 'container': return 'height: 100%; max-height: none; overflow-y: auto;';
      default: return '';
    }
  });

  // CSS variable style string (includes shared rendering constants for consistency)
  const cssVars = $derived.by(() => {
    if (!theme) return heightStyle;
    return `
      ${heightStyle}
      --wf-bg: ${theme.colors.background};
      --wf-fg: ${theme.colors.foreground};
      --wf-primary: ${theme.colors.primary};
      --wf-secondary: ${theme.colors.secondary};
      --wf-muted: ${theme.colors.muted};
      --wf-border: ${theme.colors.border};
      --wf-interval-line: ${theme.colors.intervalLine};
      --wf-interval-positive: ${theme.colors.intervalPositive};
      --wf-interval-negative: ${theme.colors.intervalNegative};
      --wf-summary-fill: ${theme.colors.summaryFill};
      --wf-summary-border: ${theme.colors.summaryBorder};
      --wf-accent: ${theme.colors.accent};
      --wf-font-family: ${theme.typography.fontFamily};
      --wf-font-size-sm: ${theme.typography.fontSizeSm};
      --wf-font-size-base: ${theme.typography.fontSizeBase};
      --wf-font-size-lg: ${theme.typography.fontSizeLg};
      --wf-font-weight-normal: ${theme.typography.fontWeightNormal};
      --wf-font-weight-medium: ${theme.typography.fontWeightMedium};
      --wf-font-weight-bold: ${theme.typography.fontWeightBold};
      --wf-line-height: ${theme.typography.lineHeight};
      --wf-row-height: ${theme.spacing.rowHeight}px;
      --wf-header-height: ${theme.spacing.headerHeight}px;
      --wf-column-gap: ${theme.spacing.columnGap}px;
      --wf-padding: ${theme.spacing.padding}px;
      --wf-cell-padding-x: ${theme.spacing.cellPaddingX}px;
      --wf-cell-padding-y: ${theme.spacing.cellPaddingY}px;
      --wf-axis-gap: ${theme.spacing.axisGap ?? 12}px;
      --wf-group-padding: ${theme.spacing.groupPadding ?? 8}px;
      --wf-point-size: ${theme.shapes.pointSize}px;
      --wf-line-width: ${theme.shapes.lineWidth}px;
      --wf-border-radius: ${theme.shapes.borderRadius}px;
      --wf-container-border-radius: ${theme.layout.containerBorderRadius}px;
      --wf-row-odd-opacity: ${ROW_ODD_OPACITY};
      --wf-group-header-opacity: ${GROUP_HEADER_OPACITY};
      --wf-row-hover-opacity: ${ROW_HOVER_OPACITY};
      --wf-row-selected-opacity: ${ROW_SELECTED_OPACITY};
      --wf-row-selected-hover-opacity: ${ROW_SELECTED_HOVER_OPACITY};
      --wf-depth-base-opacity: ${DEPTH_BASE_OPACITY};
      --wf-fill-scale: ${fillScale};
    `.trim();
  });
</script>

<div
  bind:this={containerRef}
  class="webforest-container width-{widthMode} height-{heightPreset}"
  style="{cssVars}; {widthMode === 'fill' && heightPreset === 'full' && scaledHeight > 0 ? `min-height: ${scaledHeight}px` : ''}"
>
  {#if spec}
    <!-- Control toolbar (appears on hover) - outside scalable area -->
    <ControlToolbar {store} {enableExport} {enableThemes} {onThemeChange} />

    <!-- Scalable content wrapper (header + main + footer) -->
    <div bind:this={scalableRef} class="webforest-scalable">
      <!-- Plot header (title, subtitle) -->
      <PlotHeader title={spec.labels?.title} subtitle={spec.labels?.subtitle} />

      <div class="webforest-main">
      <!-- Left table (label + left-positioned columns) -->
      <div class="webforest-table webforest-table-left">
        <!-- Header -->
        <ColumnHeaders
          columnDefs={leftColumnDefs}
          showLabel={true}
          {labelHeader}
          {store}
          enableResize={spec?.interaction.enableResize ?? true}
        />

        <!-- Rows (including group headers) -->
        {#each displayRows as displayRow, i (getDisplayRowKey(displayRow, i))}
          {#if displayRow.type === "group_header"}
            <!-- Group header row - entire row is clickable -->
            <div
              class="webforest-group-row"
              style:padding-left={`${displayRow.depth * 12}px`}
              role="button"
              tabindex="0"
              onclick={() => store.toggleGroup(displayRow.group.id)}
              onkeydown={(e) => (e.key === "Enter" || e.key === " ") && store.toggleGroup(displayRow.group.id)}
              transition:slide={{ duration: 150 }}
            >
              <GroupHeader
                group={displayRow.group}
                rowCount={displayRow.rowCount}
                {theme}
              />
            </div>
          {:else}
            <!-- Data row with slide animation -->
            {@const row = displayRow.row}
            {@const rowDepth = displayRow.depth}
            {@const effectiveIndent = row.style?.indent ?? rowDepth}
            {@const selected = isSelected(row.id)}
            <div
              class="{getRowClasses(row.style, rowDepth, i, hasGroups)}{selected ? ' selected' : ''}"
              style={getRowStyles(row.style, rowDepth)}
              onclick={() => store.selectRow(row.id)}
              onmouseenter={() => store.setHovered(row.id)}
              onmouseleave={() => store.setHovered(null)}
              role="button"
              tabindex="0"
              onkeydown={(e) => e.key === "Enter" && store.selectRow(row.id)}
              transition:slide={{ duration: 150 }}
            >
              <div
                class="webforest-label-col"
                style:padding-left={effectiveIndent ? `${effectiveIndent * 12}px` : undefined}
                style:width={getLabelWidth()}
                style:flex={getLabelFlex()}
                title={row.label}
              >
                {#if row.style?.icon}<span class="row-icon">{row.style.icon}</span>{/if}
                {row.label}
                {#if row.style?.badge}<span class="row-badge">{row.style.badge}</span>{/if}
              </div>
              {#each leftColumns as column (column.id)}
                {@const cellStyle = getCellStyle(row, column)}
                <div
                  class="webforest-col"
                  class:wrap-enabled={column.wrap}
                  style:width={getColWidth(column)}
                  style:text-align={column.align}
                >
                  {#if column.type === "bar"}
                    <CellBar
                      value={row.metadata[column.field] as number}
                      maxValue={getMaxValueForColumn(visibleRows, column)}
                      options={column.options?.bar}
                    />
                  {:else if column.type === "pvalue"}
                    <CellPvalue
                      value={row.metadata[column.field] as number}
                      options={column.options?.pvalue}
                    />
                  {:else if column.type === "sparkline"}
                    <CellSparkline
                      data={row.metadata[column.field] as number[]}
                      options={column.options?.sparkline}
                    />
                  {:else if column.type === "icon"}
                    <CellIcon
                      value={row.metadata[column.field]}
                      options={column.options?.icon}
                    />
                  {:else if column.type === "badge"}
                    <CellBadge
                      value={row.metadata[column.field]}
                      options={column.options?.badge}
                    />
                  {:else if column.type === "stars"}
                    <CellStars
                      value={row.metadata[column.field] as number}
                      options={column.options?.stars}
                    />
                  {:else if column.type === "img"}
                    <CellImg
                      value={row.metadata[column.field] as string}
                      options={column.options?.img}
                    />
                  {:else if column.type === "reference"}
                    <CellReference
                      value={row.metadata[column.field] as string}
                      metadata={row.metadata}
                      options={column.options?.reference}
                    />
                  {:else if column.type === "range"}
                    <CellRange
                      value={row.metadata[column.field]}
                      metadata={row.metadata}
                      options={column.options?.range}
                    />
                  {:else if column.type === "numeric"}
                    <CellContent value={formatNumber(row.metadata[column.field] as number, column.options)} {cellStyle} />
                  {:else if column.type === "custom" && column.options?.events}
                    <CellContent value={formatEvents(row, column.options)} {cellStyle} />
                  {:else if column.type === "interval"}
                    <CellContent value={formatInterval(
                      column.options?.interval?.point ? row.metadata[column.options.interval.point] as number : row.point,
                      column.options?.interval?.lower ? row.metadata[column.options.interval.lower] as number : row.lower,
                      column.options?.interval?.upper ? row.metadata[column.options.interval.upper] as number : row.upper,
                      column.options
                    )} {cellStyle} />
                  {:else}
                    <CellContent value={row.metadata[column.field] ?? ""} {cellStyle} />
                  {/if}
                </div>
              {/each}
            </div>
          {/if}
        {/each}
      </div>

      <!-- Forest plot (if included) -->
      {#if includeForest && layout.forestWidth > 0}
        <div class="webforest-plot-wrapper">
          <!-- Resize divider for plot area (overlays the left edge) -->
          {#if spec?.interaction.enableResize}
            <!-- svelte-ignore a11y_no_static_element_interactions -->
            <div
              class="plot-resize-handle"
              onpointerdown={startPlotResize}
            ></div>
          {/if}
          <svg
          class="webforest-canvas"
          width={layout.forestWidth}
          height={layout.headerHeight + layout.plotHeight + layout.axisHeight}
          viewBox="0 0 {layout.forestWidth} {layout.headerHeight + layout.plotHeight + layout.axisHeight}"
          style="overflow: visible;"
        >
          <!-- Header border (extend 1px beyond to overlap with table borders) -->
          <line
            x1={-1}
            x2={layout.forestWidth + 1}
            y1={layout.headerHeight}
            y2={layout.headerHeight}
            stroke="var(--wf-border, #e2e8f0)"
            stroke-width="1"
            shape-rendering="crispEdges"
          />

          <!-- Row banding backgrounds -->
          {#each displayRows as displayRow, i (getDisplayRowKey(displayRow, i))}
            <rect
              x={0}
              y={layout.headerHeight + (layout.rowPositions[i] ?? i * layout.rowHeight)}
              width={layout.forestWidth}
              height={layout.rowHeights[i] ?? layout.rowHeight}
              class="row-band {getRowBandClass(displayRow, i, hasGroups)}"
              class:row-hovered={displayRow.type === 'data' && displayRow.row.id === hoveredRowId}
              class:row-selected={displayRow.type === 'data' && selectedRowIds.has(displayRow.row.id)}
              style:fill={displayRow.type === 'data' && displayRow.row.style?.bg ? displayRow.row.style.bg : undefined}
            />
          {/each}

          <!-- Row gridlines (extending table borders into plot) -->
          <!-- Extend lines 1px beyond SVG bounds on each side to overlap with table borders -->
          {#each displayRows as displayRow, i}
            {@const rowY = layout.rowPositions[i] ?? i * layout.rowHeight}
            {@const rowH = layout.rowHeights[i] ?? layout.rowHeight}
            {@const isSummaryRow = displayRow.type === 'data' && displayRow.row.style?.type === 'summary'}
            {@const isSpacerRow = displayRow.type === 'data' && displayRow.row.style?.type === 'spacer'}
            <!-- Top border for summary rows (2px) -->
            {#if isSummaryRow}
              <line
                x1={-1}
                x2={layout.forestWidth + 1}
                y1={layout.headerHeight + rowY}
                y2={layout.headerHeight + rowY}
                stroke="var(--wf-border, #e2e8f0)"
                stroke-width="2"
                shape-rendering="crispEdges"
              />
            {/if}
            <!-- Bottom border (1px) -->
            {#if !isSpacerRow}
              <line
                x1={-1}
                x2={layout.forestWidth + 1}
                y1={layout.headerHeight + rowY + rowH}
                y2={layout.headerHeight + rowY + rowH}
                stroke="var(--wf-border, #e2e8f0)"
                stroke-width="1"
                shape-rendering="crispEdges"
              />
            {/if}
          {/each}

          <!-- Null value reference line (spans full plot height) -->
          <line
            x1={xScale(layout.nullValue)}
            x2={xScale(layout.nullValue)}
            y1={layout.headerHeight}
            y2={layout.headerHeight + rowsAreaHeight}
            stroke="var(--wf-muted)"
            stroke-width="1"
            stroke-dasharray="4,4"
          />

          <!-- Custom annotations (reference lines) -->
          {#each spec.annotations as annotation (annotation.id)}
            {#if annotation.type === "reference_line"}
              <line
                x1={xScale(annotation.x)}
                x2={xScale(annotation.x)}
                y1={layout.headerHeight}
                y2={layout.headerHeight + rowsAreaHeight}
                stroke={annotation.color ?? "var(--wf-accent)"}
                stroke-width={annotation.width ?? 1.5}
                stroke-opacity={annotation.opacity ?? 0.6}
                stroke-dasharray={annotation.style === "dashed" ? "6,4" : annotation.style === "dotted" ? "2,2" : "none"}
              />
              {#if annotation.label}
                {@const yOffset = annotationLabelOffsets[annotation.id] ?? 0}
                <text
                  x={xScale(annotation.x)}
                  y={layout.headerHeight - 4 + yOffset}
                  text-anchor="middle"
                  fill={annotation.color ?? "var(--wf-secondary)"}
                  font-size="var(--wf-font-size-sm)"
                  font-weight="500"
                >
                  {annotation.label}
                </text>
              {/if}
            {/if}
          {/each}

          <!-- Rows area -->
          <g transform="translate(0, {layout.headerHeight})">
            {#each displayRows as displayRow, i (getDisplayRowKey(displayRow, i))}
              {#if displayRow.type === "data"}
                {@const rowY = layout.rowPositions[i] ?? i * layout.rowHeight}
                {@const rowH = layout.rowHeights[i] ?? layout.rowHeight}
                <RowInterval
                  row={displayRow.row}
                  yPosition={rowY + rowH / 2}
                  {xScale}
                  {layout}
                  {theme}
                  effects={spec.data.effects}
                  weightCol={spec.data.weightCol}
                  onRowClick={() => store.selectRow(displayRow.row.id)}
                  onRowHover={(hovered, event) => {
                    store.setHovered(hovered ? displayRow.row.id : null);
                    if (hovered && event) {
                      store.setTooltip(displayRow.row.id, { x: event.clientX, y: event.clientY });
                    } else {
                      store.setTooltip(null, null);
                    }
                  }}
                />
              {/if}
            {/each}

            <!-- Overall summary diamond -->
            {#if spec.data.overall && layout.showOverallSummary &&
                 typeof spec.data.overall.point === 'number' && !Number.isNaN(spec.data.overall.point) &&
                 typeof spec.data.overall.lower === 'number' && !Number.isNaN(spec.data.overall.lower) &&
                 typeof spec.data.overall.upper === 'number' && !Number.isNaN(spec.data.overall.upper)}
              <SummaryDiamond
                point={spec.data.overall.point}
                lower={spec.data.overall.lower}
                upper={spec.data.overall.upper}
                yPosition={layout.summaryYPosition}
                {xScale}
                {layout}
                {theme}
              />
            {/if}
          </g>

          <!-- Axis at bottom -->
          <g transform="translate(0, {layout.headerHeight + layout.plotHeight})">
            <EffectAxis {xScale} {layout} {theme} axisLabel={spec.data.axisLabel} position="bottom" plotHeight={layout.plotHeight} />
          </g>
        </svg>
        </div>
      {/if}

      <!-- Right table (right-positioned columns) -->
      {#if rightColumns.length > 0}
        <div class="webforest-table webforest-table-right">
          <!-- Header -->
          <ColumnHeaders
            columnDefs={rightColumnDefs}
            showLabel={false}
            {store}
            enableResize={spec?.interaction.enableResize ?? true}
          />

          <!-- Rows (including group headers) -->
          {#each displayRows as displayRow, i (getDisplayRowKey(displayRow, i))}
            {#if displayRow.type === "group_header"}
              <!-- Empty row for group header (columns don't apply) -->
              <div class="webforest-group-row-right" transition:slide={{ duration: 150 }}>
                <!-- Empty placeholder to maintain alignment -->
              </div>
            {:else}
              <!-- Data row with slide animation -->
              {@const row = displayRow.row}
              {@const rowDepth = displayRow.depth}
              {@const selected = isSelected(row.id)}
              <!-- svelte-ignore a11y_no_static_element_interactions -->
              <div
                class="{getRowClasses(row.style, rowDepth, i, hasGroups)}{selected ? ' selected' : ''}"
                style={getRowStyles(row.style, rowDepth)}
                onmouseenter={() => store.setHovered(row.id)}
                onmouseleave={() => store.setHovered(null)}
                transition:slide={{ duration: 150 }}
              >
                {#each rightColumns as column (column.id)}
                  {@const cellStyle = getCellStyle(row, column)}
                  <div
                    class="webforest-col"
                    class:wrap-enabled={column.wrap}
                    style:width={getColWidth(column)}
                    style:text-align={column.align}
                  >
                    {#if column.type === "bar"}
                      <CellBar
                        value={row.metadata[column.field] as number}
                        maxValue={getMaxValueForColumn(visibleRows, column)}
                        options={column.options?.bar}
                      />
                    {:else if column.type === "pvalue"}
                      <CellPvalue
                        value={row.metadata[column.field] as number}
                        options={column.options?.pvalue}
                      />
                    {:else if column.type === "sparkline"}
                      <CellSparkline
                        data={row.metadata[column.field] as number[]}
                        options={column.options?.sparkline}
                      />
                    {:else if column.type === "icon"}
                      <CellIcon
                        value={row.metadata[column.field]}
                        options={column.options?.icon}
                      />
                    {:else if column.type === "badge"}
                      <CellBadge
                        value={row.metadata[column.field]}
                        options={column.options?.badge}
                      />
                    {:else if column.type === "stars"}
                      <CellStars
                        value={row.metadata[column.field] as number}
                        options={column.options?.stars}
                      />
                    {:else if column.type === "img"}
                      <CellImg
                        value={row.metadata[column.field] as string}
                        options={column.options?.img}
                      />
                    {:else if column.type === "reference"}
                      <CellReference
                        value={row.metadata[column.field] as string}
                        metadata={row.metadata}
                        options={column.options?.reference}
                      />
                    {:else if column.type === "range"}
                      <CellRange
                        value={row.metadata[column.field]}
                        metadata={row.metadata}
                        options={column.options?.range}
                      />
                    {:else if column.type === "numeric"}
                      <CellContent value={formatNumber(row.metadata[column.field] as number, column.options)} {cellStyle} />
                    {:else if column.type === "custom" && column.options?.events}
                      <CellContent value={formatEvents(row, column.options)} {cellStyle} />
                    {:else if column.type === "interval"}
                      <CellContent value={formatInterval(
                        column.options?.interval?.point ? row.metadata[column.options.interval.point] as number : row.point,
                        column.options?.interval?.lower ? row.metadata[column.options.interval.lower] as number : row.lower,
                        column.options?.interval?.upper ? row.metadata[column.options.interval.upper] as number : row.upper,
                        column.options
                      )} {cellStyle} />
                    {:else}
                      <CellContent value={row.metadata[column.field] ?? ""} {cellStyle} />
                    {/if}
                  </div>
                {/each}
              </div>
            {/if}
          {/each}
        </div>
      {/if}
    </div>

      <!-- Plot footer (caption, footnote) -->
      <PlotFooter caption={spec.labels?.caption} footnote={spec.labels?.footnote} />
    </div>

    <!-- Tooltip (only shown if tooltipFields is specified) -->
    <Tooltip row={tooltipRow} position={tooltipPosition} fields={spec?.interaction?.tooltipFields} {theme} />
  {:else}
    <div class="webforest-empty">No data</div>
  {/if}
</div>

<script lang="ts" module>
  import type { Row, ColumnSpec, RowStyle, DisplayRow } from "$types";

  // Get CSS class for SVG row banding (must match getRowClasses logic for HTML table)
  function getRowBandClass(displayRow: DisplayRow, idx: number, hasGroups: boolean): string {
    if (displayRow.type === "group_header") {
      return "band-group";
    }

    // Handle styled rows to match HTML row backgrounds
    if (displayRow.type === "data") {
      const style = displayRow.row.style;
      if (style?.type === "header") return "band-header";
      if (style?.type === "summary") return "band-summary";
      if (style?.type === "spacer") return "band-spacer";
      // Custom background (style.bg) handled via inline style on the rect
    }

    // Depth-based banding for nested groups (matches HTML row-depth-X)
    if (hasGroups && displayRow.depth > 0) {
      return `band-depth-${Math.min(displayRow.depth, 4)}`;
    }

    // Default alternating banding only when no groups (matches HTML row-odd)
    if (!hasGroups) {
      return idx % 2 === 1 ? "band-odd" : "band-even";
    }

    // When hasGroups but depth === 0, no banding (matches HTML behavior)
    return "";
  }

  // Note: formatNumber, formatEvents, formatInterval, addThousandsSep, abbreviateNumber are imported from $lib/formatters

  function getMaxValueForColumn(rows: Row[], column: ColumnSpec): number {
    // Use explicit maxValue from options if provided
    if (column.options?.bar?.maxValue) {
      return column.options.bar.maxValue;
    }
    // Otherwise compute from data
    let max = 0;
    for (const row of rows) {
      const val = row.metadata[column.field];
      if (typeof val === "number" && val > max) {
        max = val;
      }
    }
    return max || 100;
  }

  function getRowClasses(
    style?: RowStyle,
    depth?: number,
    idx?: number,
    hasGroups?: boolean
  ): string {
    const classes = ["webforest-table-row"];

    // Styled row types (mutually exclusive with alternating banding)
    const isStyledRow = style?.type === "header" || style?.type === "summary" || style?.type === "spacer";

    if (style?.type === "header") classes.push("row-header");
    if (style?.type === "summary") classes.push("row-summary");
    if (style?.type === "spacer") classes.push("row-spacer");
    if (style?.bold) classes.push("row-bold");
    if (style?.italic) classes.push("row-italic");

    // Semantic styling classes
    if (style?.emphasis) classes.push("row-emphasis");
    if (style?.muted) classes.push("row-muted");
    if (style?.accent) classes.push("row-accent");

    // Add depth-based banding class when there are groups (skip for styled rows)
    if (!isStyledRow) {
      if (depth && depth > 0) {
        classes.push(`row-depth-${Math.min(depth, 4)}`);
      } else if (!hasGroups && idx !== undefined) {
        // Default alternating banding when no groups
        if (idx % 2 === 1) classes.push("row-odd");
      }
    }

    return classes.join(" ");
  }

  function getRowStyles(style?: RowStyle, depth?: number): string {
    const styles: string[] = [];

    if (style?.color) styles.push(`color: ${style.color}`);
    if (style?.bg) styles.push(`background-color: ${style.bg}`);
    if (style?.indent) styles.push(`--row-indent: ${style.indent}`);

    // Apply depth-based indentation if no explicit indent
    if (!style?.indent && depth && depth > 0) {
      styles.push(`--row-indent: ${depth}`);
    }

    return styles.join("; ");
  }

  // Get cell style for a specific column from row.cellStyles or column.styleMapping
  function getCellStyle(row: Row, column: ColumnSpec): CellStyle | undefined {
    // Check for pre-computed cellStyles from R serialization
    if (row.cellStyles?.[column.field]) {
      return row.cellStyles[column.field];
    }

    // Check styleMapping on column definition (resolved at render time from metadata)
    if (column.styleMapping) {
      const style: CellStyle = {};
      const meta = row.metadata;

      if (column.styleMapping.bold && meta[column.styleMapping.bold]) {
        style.bold = Boolean(meta[column.styleMapping.bold]);
      }
      if (column.styleMapping.italic && meta[column.styleMapping.italic]) {
        style.italic = Boolean(meta[column.styleMapping.italic]);
      }
      if (column.styleMapping.color && meta[column.styleMapping.color]) {
        style.color = String(meta[column.styleMapping.color]);
      }
      if (column.styleMapping.bg && meta[column.styleMapping.bg]) {
        style.bg = String(meta[column.styleMapping.bg]);
      }
      if (column.styleMapping.badge && meta[column.styleMapping.badge]) {
        style.badge = String(meta[column.styleMapping.badge]);
      }
      if (column.styleMapping.icon && meta[column.styleMapping.icon]) {
        style.icon = String(meta[column.styleMapping.icon]);
      }

      if (Object.keys(style).length > 0) return style;
    }

    return undefined;
  }
</script>

<style>
  /*
   * IMPORTANT: Opacity percentages in color-mix() below must match the shared
   * rendering constants in src/lib/rendering-constants.ts:
   *
   *   5%  = GROUP_HEADER_OPACITY (0.05)
   *   6%  = ROW_ODD_OPACITY (0.06)
   *   8%  = ROW_HOVER_OPACITY / DEPTH_BASE_OPACITY * 2 (0.08)
   *  12%  = ROW_SELECTED_OPACITY / DEPTH_BASE_OPACITY * 3 (0.12)
   *  16%  = DEPTH_BASE_OPACITY * 4 (0.16)
   *  18%  = ROW_SELECTED_HOVER_OPACITY (0.18)
   *
   * CSS color-mix() doesn't support CSS custom properties for the percentage,
   * so these values are hardcoded but should be kept in sync with the constants.
   */

  /* Ensure consistent box-sizing for all elements */
  :global(.webforest-container),
  :global(.webforest-container) *,
  :global(.webforest-container) *::before,
  :global(.webforest-container) *::after {
    box-sizing: border-box;
  }

  :global(.webforest-container) {
    position: relative; /* Needed for toolbar positioning */
    font-family: var(--wf-font-family);
    font-size: var(--wf-font-size-base);
    color: var(--wf-fg);
    background: var(--wf-bg);
    border: 1px solid var(--wf-border);
    border-radius: 8px;
    overflow: hidden;
    display: flex;
    flex-direction: column;
  }

  /* Width modes */
  :global(.webforest-container.width-natural) {
    width: fit-content;
    max-width: 100%;
    margin-left: auto;
    margin-right: auto;
  }

  :global(.webforest-container.width-fill) {
    width: 100%;
    /* Remove border/background from container in fill mode - they go on scalable */
    background: transparent;
    border: none;
    border-radius: 0;
    /* Clip content to container - transform doesn't affect layout box width */
    overflow: hidden;
  }

  :global(.webforest-container.width-fill) .webforest-scalable {
    transform: scale(var(--wf-fill-scale, 1));
    transform-origin: top left;
    /* Don't use flex: 1 in fill mode - we need natural height for scaling */
    flex: none;
    /* Prevent flex stretch from constraining width - need natural content width for scaling */
    align-self: flex-start;
    width: max-content;
    /* No margins in fill mode - we fill the container */
    margin: 0;
    /* Move border/background here so they scale with content */
    background: var(--wf-bg);
    /* Minimal border to avoid scroll issues */
    border: none;
    border-radius: 0;
  }

  /* In fill mode, prevent inner scrollbars - container handles clipping */
  :global(.webforest-container.width-fill) .webforest-main {
    overflow: visible;
  }

  /* Height presets - use max-height so container doesn't fill with empty space */
  :global(.webforest-container.height-small) {
    height: auto;
    max-height: 300px;
    overflow-y: auto;
  }

  :global(.webforest-container.height-medium) {
    height: auto;
    max-height: 500px;
    overflow-y: auto;
  }

  :global(.webforest-container.height-large) {
    height: auto;
    max-height: 900px;
    overflow-y: auto;
  }

  :global(.webforest-container.height-full) {
    height: auto;
    max-height: none;
    overflow: visible;
  }

  /* Override htmlwidgets container height when in full height mode */
  :global(.webforest:has(.webforest-container.height-full)) {
    height: auto !important;
    min-height: 0 !important;
  }

  :global(.webforest-container.height-container) {
    height: 100%;
    max-height: none;
    overflow-y: auto;
  }

  .webforest-scalable {
    display: flex;
    flex-direction: column;
    flex: 1;
    min-height: 0;
  }

  .webforest-main {
    display: flex;
    align-items: flex-start; /* Ensure all items align at top for border consistency */
    overflow: auto;
    flex: 1;
    min-height: 0; /* Allow shrinking below content height for scroll */
  }

  .webforest-table {
    flex-shrink: 0;
  }

  .webforest-table-left {
    display: flex;
    flex-direction: column;
    border-right: 1px solid var(--wf-border);
  }

  .webforest-table-right {
    display: flex;
    flex-direction: column;
    border-left: 1px solid var(--wf-border);
  }

  .webforest-table-row {
    display: flex;
    height: var(--wf-row-height);
    align-items: stretch; /* Let cells stretch to fill height for proper border alignment */
  }

  .webforest-table-row:hover {
    background: color-mix(in srgb, var(--wf-primary) 5%, var(--wf-bg));
  }

  .webforest-table-row.selected {
    background: color-mix(in srgb, var(--wf-primary) 12%, var(--wf-bg));
    box-shadow: inset 3px 0 0 var(--wf-primary);
  }

  .webforest-table-row.selected:hover {
    background: color-mix(in srgb, var(--wf-primary) 18%, var(--wf-bg));
  }

  .webforest-label-col {
    flex: 1;
    min-width: 120px;
    padding: 0 10px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    height: var(--wf-row-height);
    display: flex;
    align-items: center;
    border-bottom: 1px solid var(--wf-border);
  }

  .webforest-col {
    padding: 0 10px;
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    height: var(--wf-row-height);
    display: flex;
    align-items: center;
    border-bottom: 1px solid var(--wf-border);
    flex-shrink: 0;
  }

  /* Text wrapping mode - allows long text to wrap and respects \n newlines */
  .webforest-col.wrap-enabled {
    white-space: pre-line;
    word-wrap: break-word;
    text-overflow: clip;
    min-height: var(--wf-row-height);
    height: auto;
    align-items: flex-start;
    padding-top: 6px;
    padding-bottom: 6px;
  }

  .webforest-canvas {
    flex-shrink: 0;
  }

  .webforest-plot-wrapper {
    position: relative;
    flex-shrink: 0;
  }

  .plot-resize-handle {
    position: absolute;
    right: 0;
    top: 0;
    bottom: 0;
    width: 8px;
    cursor: col-resize;
    background: transparent;
    z-index: 10;
    transform: translateX(50%);
  }

  .plot-resize-handle:hover,
  .plot-resize-handle:active {
    background: var(--wf-primary, #2563eb);
  }

  .webforest-empty {
    padding: 24px;
    text-align: center;
    color: var(--wf-muted);
  }

  /* Row type styles */
  .row-header {
    font-weight: var(--wf-font-weight-bold, 600);
    background: color-mix(in srgb, var(--wf-muted) 10%, var(--wf-bg));
  }

  .row-summary {
    font-weight: var(--wf-font-weight-bold, 600);
    border-top: 2px solid var(--wf-border);
  }

  .row-spacer {
    height: calc(var(--wf-row-height) / 2);
    border-bottom: none;
  }

  .row-spacer .webforest-label-col,
  .row-spacer .webforest-col {
    border-bottom: none;
    visibility: hidden;
  }

  .row-bold {
    font-weight: var(--wf-font-weight-bold, 600);
  }

  .row-italic {
    font-style: italic;
  }

  /* Semantic styling classes */
  .row-emphasis {
    font-weight: var(--wf-font-weight-bold, 600);
    color: var(--wf-fg, #1a1a1a);
  }

  .row-muted {
    color: var(--wf-muted, #94a3b8);
  }

  .row-accent {
    color: var(--wf-accent, #8b5cf6);
  }

  .row-icon {
    margin-right: 6px;
  }

  .row-badge {
    margin-left: 6px;
    padding: 1px 6px;
    font-size: var(--wf-font-size-sm, 0.75rem);
    background: color-mix(in srgb, var(--wf-primary) 15%, var(--wf-bg));
    border-radius: 4px;
    color: var(--wf-primary);
  }

  /* Default alternating banding (when no groups) */
  .row-odd {
    background: color-mix(in srgb, var(--wf-muted) 6%, var(--wf-bg));
  }

  /* Depth-based banding for nested groups */
  .row-depth-1 {
    background: color-mix(in srgb, var(--wf-muted) 8%, var(--wf-bg));
  }

  .row-depth-2 {
    background: color-mix(in srgb, var(--wf-muted) 12%, var(--wf-bg));
  }

  .row-depth-3 {
    background: color-mix(in srgb, var(--wf-muted) 16%, var(--wf-bg));
  }

  .row-depth-4 {
    background: color-mix(in srgb, var(--wf-muted) 20%, var(--wf-bg));
  }

  /* Group header row styles */
  .webforest-group-row {
    display: flex;
    width: 100%;
    height: var(--wf-row-height);
    align-items: center;
    border-bottom: 1px solid var(--wf-border);
    border-left: 3px solid transparent;
    background: color-mix(in srgb, var(--wf-primary) 5%, var(--wf-bg));
    cursor: pointer;
    outline: none;
    transition: border-color 0.15s ease, background 0.15s ease;
  }

  .webforest-group-row:hover {
    background: color-mix(in srgb, var(--wf-primary) 10%, var(--wf-bg));
    border-left-color: var(--wf-primary);
  }

  .webforest-group-row:focus-visible {
    outline: 2px solid var(--wf-primary);
    outline-offset: -2px;
  }

  .webforest-group-row-right {
    width: 100%;
    height: var(--wf-row-height);
    border-bottom: 1px solid var(--wf-border);
    background: color-mix(in srgb, var(--wf-primary) 5%, var(--wf-bg));
  }

  /* SVG row banding */
  .row-band {
    fill: var(--wf-bg, #fff);
    transition: fill 0.1s ease;
  }

  .row-band.band-group {
    fill: color-mix(in srgb, var(--wf-primary) 5%, var(--wf-bg));
  }

  .row-band.band-depth-1 {
    fill: color-mix(in srgb, var(--wf-muted) 8%, var(--wf-bg));
  }

  .row-band.band-depth-2 {
    fill: color-mix(in srgb, var(--wf-muted) 12%, var(--wf-bg));
  }

  .row-band.band-depth-3 {
    fill: color-mix(in srgb, var(--wf-muted) 16%, var(--wf-bg));
  }

  .row-band.band-depth-4 {
    fill: color-mix(in srgb, var(--wf-muted) 20%, var(--wf-bg));
  }

  .row-band.band-odd {
    fill: color-mix(in srgb, var(--wf-muted) 6%, var(--wf-bg));
  }

  .row-band.band-even {
    fill: var(--wf-bg, #fff);
  }

  /* Styled row band types to match HTML row backgrounds */
  .row-band.band-header {
    fill: color-mix(in srgb, var(--wf-muted) 10%, var(--wf-bg));
  }

  .row-band.band-summary {
    fill: var(--wf-bg, #fff);
  }

  .row-band.band-spacer {
    fill: var(--wf-bg, #fff);
  }

  .row-band.row-hovered {
    fill: color-mix(in srgb, var(--wf-primary) 8%, var(--wf-bg));
  }

  .row-band.row-selected {
    fill: color-mix(in srgb, var(--wf-primary) 12%, var(--wf-bg));
  }

  .row-band.row-selected.row-hovered {
    fill: color-mix(in srgb, var(--wf-primary) 18%, var(--wf-bg));
  }
</style>

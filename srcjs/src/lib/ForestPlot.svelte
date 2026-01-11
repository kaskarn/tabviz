<script lang="ts">
  import { tick } from "svelte";
  import type { ForestStore } from "$stores/forestStore.svelte";
  import type { ThemeName } from "$lib/theme-presets";
  import type { WebTheme, ColumnSpec, ColumnDef, ColumnOptions, Row, DisplayRow, GroupHeaderRow, DataRow, CellStyle } from "$types";
  import RowInterval from "$components/forest/RowInterval.svelte";
  import EffectAxis from "$components/forest/EffectAxis.svelte";
  import SummaryDiamond from "$components/forest/SummaryDiamond.svelte";
  import PlotHeader from "$components/forest/PlotHeader.svelte";
  import PlotFooter from "$components/forest/PlotFooter.svelte";
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

  // Check if we have column groups (need two-row header)
  const hasColumnGroups = $derived(
    leftColumnDefs.some(c => c.isGroup) || rightColumnDefs.some(c => c.isGroup)
  );
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

  // Compute row Y positions and heights for SVG overlay (must match CSS grid)
  // Returns arrays indexed by displayRow index
  const rowLayout = $derived.by(() => {
    const positions: number[] = [];
    const heights: number[] = [];
    let y = 0;
    for (const dr of displayRows) {
      const h = (dr.type === "data" && dr.row.style?.type === "spacer")
        ? layout.rowHeight / 2
        : layout.rowHeight;
      positions.push(y);
      heights.push(h);
      y += h;
    }
    return { positions, heights, totalHeight: y };
  });

  // Total height of rows area for SVG sizing
  const rowsAreaHeight = $derived(rowLayout.totalHeight);

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

  // Helper to get colspan for a column definition (1 for regular columns, N for groups)
  function getColspan(col: ColumnDef): number {
    if (!col.isGroup) return 1;
    return col.columns.reduce((sum, c) => sum + getColspan(c), 0);
  }

  // Helper to get flat leaf columns from a column definition
  function getLeafColumns(col: ColumnDef): ColumnSpec[] {
    if (!col.isGroup) return [col];
    return col.columns.flatMap(c => getLeafColumns(c));
  }

  // Calculate the maximum depth of column groups (0 = no groups, 1 = one level, etc.)
  function getMaxGroupDepth(cols: ColumnDef[]): number {
    let maxDepth = 0;
    for (const col of cols) {
      if (col.isGroup) {
        const childDepth = 1 + getMaxGroupDepth(col.columns);
        maxDepth = Math.max(maxDepth, childDepth);
      }
    }
    return maxDepth;
  }

  // Get the depth of a specific column (how many levels from root)
  function getColumnDepth(col: ColumnDef): number {
    if (!col.isGroup) return 0;
    return 1 + Math.max(0, ...col.columns.map(c => getColumnDepth(c)));
  }

  // Calculate maximum header depth (number of header rows needed)
  const headerDepth = $derived(
    Math.max(1, 1 + getMaxGroupDepth([...leftColumnDefs, ...rightColumnDefs]))
  );

  // Flatten column structure into render items with position info
  // Each item has: col, gridColumnStart, colspan, rowStart, rowSpan
  interface HeaderCell {
    col: ColumnDef;
    gridColumnStart: number;
    colspan: number;
    rowStart: number;
    rowSpan: number;
    isGroupHeader: boolean;
  }

  const headerCells = $derived.by((): HeaderCell[] => {
    const cells: HeaderCell[] = [];
    let colIndex = 2; // Start at 2 (1 = label column)

    function processColumn(col: ColumnDef, depth: number) {
      const colspan = getColspan(col);
      const startCol = colIndex;

      if (col.isGroup) {
        // Group header: spans its children horizontally, only 1 row
        cells.push({
          col,
          gridColumnStart: startCol,
          colspan,
          rowStart: depth + 1, // 1-based
          rowSpan: 1,
          isGroupHeader: true,
        });
        // Process children at next depth
        for (const child of col.columns) {
          processColumn(child, depth + 1);
        }
      } else {
        // Leaf column: spans from current depth to bottom
        cells.push({
          col,
          gridColumnStart: startCol,
          colspan: 1,
          rowStart: depth + 1,
          rowSpan: headerDepth - depth,
          isGroupHeader: false,
        });
        colIndex++;
      }
    }

    // Process left columns
    for (const col of leftColumnDefs) {
      processColumn(col, 0);
    }

    // Skip plot column (handled separately)
    if (includeForest) {
      colIndex++;
    }

    // Process right columns
    for (const col of rightColumnDefs) {
      processColumn(col, 0);
    }

    return cells;
  });

  // Compute grid column index for plot header
  const plotGridColumn = $derived(
    1 + leftColumns.length + 1 // 1 for label + left columns + 1 for plot
  );

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

  // Compute CSS grid template columns for unified layout
  // Order: label | left columns | plot | right columns
  const gridTemplateColumns = $derived.by(() => {
    const parts: string[] = [];

    // Label column
    const labelWidth = columnWidthsSnapshot["__label__"];
    parts.push(labelWidth ? `${labelWidth}px` : "minmax(120px, 1fr)");

    // Left columns
    for (const col of leftColumns) {
      parts.push(getColWidth(col));
    }

    // Plot column (if included)
    if (includeForest) {
      parts.push(`${layout.forestWidth}px`);
    }

    // Right columns
    for (const col of rightColumns) {
      parts.push(getColWidth(col));
    }

    return parts.join(" ");
  });

  // Total column count for grid (label + left + plot + right)
  const totalColumns = $derived(
    1 + leftColumns.length + (includeForest ? 1 : 0) + rightColumns.length
  );

  // Plot column index (0-based, for grid-column positioning)
  const plotColumnIndex = $derived(1 + leftColumns.length + 1); // 1-based for CSS grid

  // Ref to measure plot column position for SVG overlay
  let plotHeaderRef: HTMLDivElement | undefined = $state();
  let plotColumnLeft = $state(0);

  // Update plot column position when ref changes or column widths change
  $effect(() => {
    // Reference these to re-run when columns/plot resize
    const _ = columnWidthsSnapshot;
    const __ = layout.forestWidth;
    if (plotHeaderRef) {
      // Wait for DOM to update before measuring
      tick().then(() => {
        if (plotHeaderRef) {
          plotColumnLeft = plotHeaderRef.offsetLeft;
        }
      });
    }
  });

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

  // Column resize state and handlers
  let resizingColumn = $state<string | null>(null);
  let columnStartX = 0;
  let columnStartWidth = 0;

  function startColumnResize(e: PointerEvent, columnId: string, currentWidth: number) {
    if (!spec?.interaction.enableResize) return;
    e.preventDefault();
    e.stopPropagation();
    resizingColumn = columnId;
    columnStartX = e.clientX;
    columnStartWidth = currentWidth;
    document.addEventListener("pointermove", onColumnResize);
    document.addEventListener("pointerup", stopColumnResize);
  }

  function onColumnResize(e: PointerEvent) {
    if (!resizingColumn) return;
    const delta = e.clientX - columnStartX;
    const newWidth = Math.max(40, columnStartWidth + delta); // Min width 40px
    store.setColumnWidth(resizingColumn, newWidth);
  }

  function stopColumnResize() {
    resizingColumn = null;
    document.removeEventListener("pointermove", onColumnResize);
    document.removeEventListener("pointerup", stopColumnResize);
  }

  // Row hover handler - sets both hover state and tooltip position
  function handleRowHover(rowId: string, event: MouseEvent) {
    store.setHovered(rowId);
    // Set tooltip position for potential tooltip display
    store.setTooltip(rowId, { x: event.clientX, y: event.clientY });
  }

  function handleRowLeave() {
    store.setHovered(null);
    store.setTooltip(null, null);
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
      --wf-header-row-height: ${theme.spacing.headerHeight / headerDepth}px;
      --wf-header-depth: ${headerDepth};
      --wf-padding: ${theme.spacing.padding}px;
      --wf-cell-padding-x: ${theme.spacing.cellPaddingX}px;
      --wf-cell-padding-y: ${theme.spacing.cellPaddingY}px;
      --wf-axis-gap: ${theme.spacing.axisGap ?? 12}px;
      --wf-axis-height: ${layout.axisHeight}px;
      --wf-group-padding: ${theme.spacing.groupPadding ?? 8}px;
      --wf-plot-width: ${layout.forestWidth}px;
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

      <!-- Snippet for rendering cell content based on column type -->
      {#snippet renderCellContent(row: DataRow['row'], column: ColumnSpec)}
        {@const cellStyle = getCellStyle(row, column)}
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
      {/snippet}

      <!-- CSS Grid layout: label | left cols | plot | right cols -->
      <div class="webforest-main" style:grid-template-columns={gridTemplateColumns}>
        <!-- Header cells (supports hierarchical column groups) -->
        <!-- Label header (spans all header rows) -->
        <div
          class="grid-cell header-cell label-header"
          style:grid-row="1 / span {headerDepth}"
        >
          <span class="header-text">{labelHeader}</span>
          {#if spec?.interaction.enableResize}
            <!-- svelte-ignore a11y_no_static_element_interactions -->
            <div
              class="resize-handle"
              onpointerdown={(e) => startColumnResize(e, "__label__", columnWidthsSnapshot["__label__"] ?? 150)}
            ></div>
          {/if}
        </div>

        <!-- Column headers (groups and leaf columns) -->
        {#each headerCells as cell (cell.col.id)}
          {#if cell.isGroupHeader}
            <!-- Group header -->
            <div
              class="grid-cell header-cell column-group-header"
              style:grid-column="{cell.gridColumnStart} / span {cell.colspan}"
              style:grid-row="{cell.rowStart} / span {cell.rowSpan}"
            >
              <span class="header-text">{cell.col.header}</span>
            </div>
          {:else}
            <!-- Leaf column header -->
            {@const column = cell.col as ColumnSpec}
            <div
              class="grid-cell header-cell"
              style:grid-column="{cell.gridColumnStart}"
              style:grid-row="{cell.rowStart} / span {cell.rowSpan}"
              style:text-align={column.headerAlign ?? column.align}
            >
              <span class="header-text">{column.header}</span>
              {#if spec?.interaction.enableResize}
                <!-- svelte-ignore a11y_no_static_element_interactions -->
                <div
                  class="resize-handle"
                  onpointerdown={(e) => startColumnResize(e, column.id, columnWidthsSnapshot[column.id] ?? (typeof column.width === 'number' ? column.width : 80))}
                ></div>
              {/if}
            </div>
          {/if}
        {/each}

        <!-- Plot header (spans all header rows) -->
        {#if includeForest}
          <div
            bind:this={plotHeaderRef}
            class="grid-cell header-cell plot-header"
            style:grid-column={plotGridColumn}
            style:grid-row="1 / span {headerDepth}"
          >
            {#if spec?.interaction.enableResize}
              <!-- svelte-ignore a11y_no_static_element_interactions -->
              <div
                class="resize-handle"
                onpointerdown={startPlotResize}
              ></div>
            {/if}
          </div>
        {/if}

        <!-- Data rows -->
        {#each displayRows as displayRow, i (getDisplayRowKey(displayRow, i))}
          {@const isGroupHeader = displayRow.type === "group_header"}
          {@const row = isGroupHeader ? null : displayRow.row}
          {@const rowDepth = displayRow.depth}
          {@const selected = row ? isSelected(row.id) : false}
          {@const rowClasses = row ? getRowClasses(row.style, rowDepth, i, hasGroups) : ""}
          {@const isSpacerRow = row?.style?.type === "spacer"}
          {@const gridRow = headerDepth + 1 + i}

          <!-- Label cell -->
          <div
            class="grid-cell data-cell label-cell {rowClasses}"
            class:group-row={isGroupHeader}
            class:selected
            class:hovered={row && hoveredRowId === row.id}
            class:spacer-row={isSpacerRow}
            style:grid-row={gridRow}
            style:padding-left={isGroupHeader ? `${rowDepth * 12}px` : (row?.style?.indent ?? rowDepth) ? `${(row?.style?.indent ?? rowDepth) * 12}px` : undefined}
            role={isGroupHeader ? "button" : undefined}
            tabindex={isGroupHeader ? 0 : undefined}
            onclick={isGroupHeader ? () => store.toggleGroup(displayRow.group.id) : row ? () => store.selectRow(row.id) : undefined}
            onkeydown={isGroupHeader ? (e) => (e.key === "Enter" || e.key === " ") && store.toggleGroup(displayRow.group.id) : undefined}
            onmouseenter={row ? (e) => handleRowHover(row.id, e) : undefined}
            onmouseleave={row ? () => handleRowLeave() : undefined}
          >
            {#if isGroupHeader}
              <GroupHeader
                group={displayRow.group}
                rowCount={displayRow.rowCount}
                {theme}
              />
            {:else if row}
              {#if row.style?.icon}<span class="row-icon">{row.style.icon}</span>{/if}
              {row.label}
              {#if row.style?.badge}<span class="row-badge">{row.style.badge}</span>{/if}
            {/if}
          </div>

          <!-- Left column cells -->
          {#each leftColumns as column (column.id)}
            <div
              class="grid-cell data-cell {rowClasses}"
              class:group-row={isGroupHeader}
              class:selected
              class:hovered={row && hoveredRowId === row.id}
              class:spacer-row={isSpacerRow}
              class:wrap-enabled={column.wrap}
              style:grid-row={gridRow}
              style:text-align={column.align}
              onmouseenter={row ? (e) => handleRowHover(row.id, e) : undefined}
              onmouseleave={row ? () => handleRowLeave() : undefined}
              onclick={row ? () => store.selectRow(row.id) : undefined}
            >
              {#if row}
                {@render renderCellContent(row, column)}
              {/if}
            </div>
          {/each}

          <!-- Plot cell (empty - SVG overlays this) -->
          {#if includeForest}
            <div
              class="grid-cell data-cell plot-cell {rowClasses}"
              class:group-row={isGroupHeader}
              class:selected
              class:hovered={row && hoveredRowId === row.id}
              class:spacer-row={isSpacerRow}
              style:grid-row={gridRow}
              onmouseenter={row ? (e) => handleRowHover(row.id, e) : undefined}
              onmouseleave={row ? () => handleRowLeave() : undefined}
              onclick={row ? () => store.selectRow(row.id) : undefined}
            ></div>
          {/if}

          <!-- Right column cells -->
          {#each rightColumns as column (column.id)}
            <div
              class="grid-cell data-cell {rowClasses}"
              class:group-row={isGroupHeader}
              class:selected
              class:hovered={row && hoveredRowId === row.id}
              class:spacer-row={isSpacerRow}
              class:wrap-enabled={column.wrap}
              style:grid-row={gridRow}
              style:text-align={column.align}
              onmouseenter={row ? (e) => handleRowHover(row.id, e) : undefined}
              onmouseleave={row ? () => handleRowLeave() : undefined}
              onclick={row ? () => store.selectRow(row.id) : undefined}
            >
              {#if row}
                {@render renderCellContent(row, column)}
              {/if}
            </div>
          {/each}
        {/each}

        <!-- Axis row (spans under plot column) -->
        {#if includeForest}
          {@const axisRowNum = headerDepth + 1 + displayRows.length}
          <div class="grid-cell axis-spacer" style:grid-column="1 / {plotColumnIndex}" style:grid-row={axisRowNum}></div>
          <div class="grid-cell axis-cell" style:grid-row={axisRowNum}></div>
          {#if rightColumns.length > 0}
            <div class="grid-cell axis-spacer" style:grid-column="{plotColumnIndex + 1} / -1" style:grid-row={axisRowNum}></div>
          {/if}
        {/if}

        <!-- SVG overlay for plot markers (positioned over plot column, inside grid for correct positioning) -->
        {#if includeForest && layout.forestWidth > 0}
        {@const axisGap = theme?.spacing.axisGap ?? 12}
        <svg
          class="plot-overlay"
          width={layout.forestWidth}
          height={rowsAreaHeight + layout.axisHeight}
          viewBox="0 0 {layout.forestWidth} {rowsAreaHeight + layout.axisHeight}"
          style:top="{layout.headerHeight}px"
          style:left="{plotColumnLeft}px"
        >
          <!-- Null value reference line -->
          <line
            x1={xScale(layout.nullValue)}
            x2={xScale(layout.nullValue)}
            y1={0}
            y2={rowsAreaHeight}
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
                y1={0}
                y2={rowsAreaHeight}
                stroke={annotation.color ?? "var(--wf-accent)"}
                stroke-width={annotation.width ?? 1.5}
                stroke-opacity={annotation.opacity ?? 0.6}
                stroke-dasharray={annotation.style === "dashed" ? "6,4" : annotation.style === "dotted" ? "2,2" : "none"}
              />
              {#if annotation.label}
                {@const yOffset = annotationLabelOffsets[annotation.id] ?? 0}
                <text
                  x={xScale(annotation.x)}
                  y={-4 + yOffset}
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

          <!-- Row intervals (markers) -->
          {#each displayRows as displayRow, i (getDisplayRowKey(displayRow, i))}
            {#if displayRow.type === "data"}
              {@const rowY = rowLayout.positions[i] ?? i * layout.rowHeight}
              {@const rowH = rowLayout.heights[i] ?? layout.rowHeight}
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

          <!-- Overall summary diamond (positioned at end of rows) -->
          {#if spec.data.overall && layout.showOverallSummary &&
               typeof spec.data.overall.point === 'number' && !Number.isNaN(spec.data.overall.point) &&
               typeof spec.data.overall.lower === 'number' && !Number.isNaN(spec.data.overall.lower) &&
               typeof spec.data.overall.upper === 'number' && !Number.isNaN(spec.data.overall.upper)}
            <SummaryDiamond
              point={spec.data.overall.point}
              lower={spec.data.overall.lower}
              upper={spec.data.overall.upper}
              yPosition={rowsAreaHeight + layout.rowHeight / 2}
              {xScale}
              {layout}
              {theme}
            />
          {/if}

          <!-- Axis at bottom (with axisGap spacing from rows) -->
          <g transform="translate(0, {rowsAreaHeight + axisGap})">
            <EffectAxis {xScale} {layout} {theme} axisLabel={spec.data.axisLabel} position="bottom" plotHeight={layout.plotHeight} />
          </g>
        </svg>
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
    const classes: string[] = [];

    // Styled row types (mutually exclusive with alternating banding)
    const isStyledRow = style?.type === "header" || style?.type === "summary" || style?.type === "spacer";

    if (style?.type === "header") classes.push("row-header");
    if (style?.type === "summary") classes.push("row-summary");
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

  /* CSS Grid layout for unified table + plot */
  .webforest-main {
    display: grid;
    position: relative;
    overflow: auto;
    flex: 1;
    min-height: 0;
  }

  /* Base grid cell styles */
  .grid-cell {
    padding: var(--wf-cell-padding-y) var(--wf-cell-padding-x);
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    display: flex;
    align-items: center;
    border-bottom: 1px solid var(--wf-border);
    background: var(--wf-bg);
  }

  /* Header cells - use row height for multi-row headers */
  .header-cell {
    min-height: var(--wf-header-row-height);
    font-weight: var(--wf-font-weight-medium, 500);
    border-bottom: 1px solid var(--wf-border);
    background: var(--wf-bg);
    position: relative;
  }

  /* Label header gets thicker bottom border (spans all rows, so border is at bottom) */
  .label-header {
    border-bottom: 2px solid var(--wf-border);
  }

  /* Column group header styling */
  .column-group-header {
    justify-content: center;
    font-weight: var(--wf-font-weight-bold, 600);
    text-align: center;
    padding-left: var(--wf-group-padding, 8px);
    padding-right: var(--wf-group-padding, 8px);
    border-bottom: none;
    position: relative;
  }

  /* Inset border for column group headers - creates visual separation between groups */
  .column-group-header::after {
    content: "";
    position: absolute;
    bottom: 0;
    left: var(--wf-group-padding, 8px);
    right: var(--wf-group-padding, 8px);
    height: 1px;
    background: var(--wf-border);
  }

  /* Last row of headers gets thicker border */
  .header-cell:not(.column-group-header):not(.label-header):not(.plot-header) {
    border-bottom: 2px solid var(--wf-border);
  }

  /* Plot header also gets thicker border */
  .plot-header {
    border-bottom: 2px solid var(--wf-border);
  }

  .header-text {
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  /* Resize handle on right edge of header cells */
  .resize-handle {
    position: absolute;
    right: 0;
    top: 0;
    bottom: 0;
    width: 6px;
    cursor: col-resize;
    background: transparent;
    z-index: 10;
  }

  .resize-handle:hover,
  .resize-handle:active {
    background: var(--wf-primary, #2563eb);
  }

  /* Data cells */
  .data-cell {
    height: var(--wf-row-height);
  }

  /* Label column (first column) */
  .label-cell {
    min-width: 120px;
  }

  /* Plot cell (empty - SVG overlays this) */
  .plot-cell {
    padding: 0;
    position: relative;
  }

  /* Plot header cell */
  .plot-header {
    padding: 0;
  }

  /* Axis row cells - use full axis height (gap + content) */
  .axis-spacer {
    height: var(--wf-axis-height);
    border-bottom: none;
    background: var(--wf-bg);
    padding: 0;
  }

  .axis-cell {
    height: var(--wf-axis-height);
    border-bottom: none;
    background: var(--wf-bg);
    padding: 0;
  }

  /* Text wrapping mode - allows long text to wrap and respects \n newlines */
  .wrap-enabled {
    white-space: pre-line;
    word-wrap: break-word;
    text-overflow: clip;
    min-height: var(--wf-row-height);
    height: auto;
    align-items: flex-start;
    padding-top: 6px;
    padding-bottom: 6px;
  }

  /* SVG overlay positioned absolutely over plot column */
  .plot-overlay {
    position: absolute;
    pointer-events: none;
  }

  .plot-overlay :global(.interactive) {
    pointer-events: auto;
  }

  /* Row hover effect - apply to all cells in a row via CSS sibling selectors */
  /* We handle this via JavaScript by tracking hover state on rows */

  /* Group row styling */
  .group-row {
    background: color-mix(in srgb, var(--wf-primary) 5%, var(--wf-bg));
    cursor: pointer;
  }

  .group-row:hover {
    background: color-mix(in srgb, var(--wf-primary) 10%, var(--wf-bg));
  }

  /* Hovered row styling */
  .data-cell.hovered {
    background: color-mix(in srgb, var(--wf-primary) 8%, var(--wf-bg));
    cursor: pointer;
  }

  /* Selected row styling */
  .data-cell.selected {
    background: color-mix(in srgb, var(--wf-primary) 12%, var(--wf-bg));
  }

  .data-cell.selected.hovered {
    background: color-mix(in srgb, var(--wf-primary) 18%, var(--wf-bg));
  }

  .data-cell.selected:first-child {
    box-shadow: inset 3px 0 0 var(--wf-primary);
  }

  /* Spacer row styling */
  .spacer-row {
    height: calc(var(--wf-row-height) / 2);
    border-bottom: none;
    visibility: hidden;
  }

  .spacer-row.plot-cell {
    visibility: visible; /* Keep plot cell visible for spacing */
  }

  .webforest-empty {
    padding: 24px;
    text-align: center;
    color: var(--wf-muted);
  }

  /* Row type styles (applied to data-cell elements) */
  .row-header {
    font-weight: var(--wf-font-weight-bold, 600);
    background: color-mix(in srgb, var(--wf-muted) 10%, var(--wf-bg));
  }

  .row-summary {
    font-weight: var(--wf-font-weight-bold, 600);
    border-top: 2px solid var(--wf-border);
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

</style>

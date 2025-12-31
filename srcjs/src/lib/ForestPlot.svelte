<script lang="ts">
  import { slide } from "svelte/transition";
  import type { ForestStore } from "$stores/forestStore.svelte";
  import type { WebTheme, ColumnSpec, Row, DisplayRow, GroupHeaderRow, DataRow } from "$types";
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

  interface Props {
    store: ForestStore;
  }

  let { store }: Props = $props();

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

  // Check if the data has any groups
  const hasGroups = $derived((spec?.data.groups?.length ?? 0) > 0);

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
  function getColWidth(column: ColumnSpec): string {
    const dynamicWidth = store.getColumnWidth(column.id);
    const width = dynamicWidth ?? column.width;
    return width ? `${width}px` : "auto";
  }

  // Helper to get label column width
  function getLabelWidth(): string | undefined {
    const width = store.getColumnWidth("__label__");
    return width ? `${width}px` : undefined;
  }

  // Helper to get label column flex
  function getLabelFlex(): string {
    return store.getColumnWidth("__label__") ? "none" : "1";
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

  // CSS variable style string
  const cssVars = $derived.by(() => {
    if (!theme) return "";
    return `
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
      --wf-point-size: ${theme.shapes.pointSize}px;
      --wf-line-width: ${theme.shapes.lineWidth}px;
      --wf-border-radius: ${theme.shapes.borderRadius}px;
      --wf-container-border-radius: ${theme.layout.containerBorderRadius}px;
    `.trim();
  });
</script>

<div class="webforest-container" style={cssVars}>
  {#if spec}
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
              >
                {#if row.style?.icon}<span class="row-icon">{row.style.icon}</span>{/if}
                {row.label}
                {#if row.style?.badge}<span class="row-badge">{row.style.badge}</span>{/if}
              </div>
              {#each leftColumns as column (column.id)}
                <div
                  class="webforest-col"
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
                  {:else if column.type === "numeric"}
                    {formatNumber(row.metadata[column.field] as number)}
                  {:else if column.type === "interval"}
                    {formatInterval(row.point, row.lower, row.upper)}
                  {:else}
                    {row.metadata[column.field] ?? ""}
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
        >
          <!-- Header border -->
          <line
            x1={0}
            x2={layout.forestWidth}
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
              y={layout.headerHeight + i * layout.rowHeight}
              width={layout.forestWidth}
              height={layout.rowHeight}
              class="row-band {getRowBandClass(displayRow, i, hasGroups)}"
              class:row-hovered={displayRow.type === 'data' && displayRow.row.id === hoveredRowId}
              class:row-selected={displayRow.type === 'data' && selectedRowIds.has(displayRow.row.id)}
              style:fill={displayRow.type === 'data' && displayRow.row.style?.bg ? displayRow.row.style.bg : undefined}
            />
          {/each}

          <!-- Row gridlines (extending table borders into plot) -->
          {#each displayRows as _, i}
            <line
              x1={0}
              x2={layout.forestWidth}
              y1={layout.headerHeight + (i + 1) * layout.rowHeight}
              y2={layout.headerHeight + (i + 1) * layout.rowHeight}
              stroke="var(--wf-border, #e2e8f0)"
              stroke-width="1"
              shape-rendering="crispEdges"
            />
          {/each}

          <!-- Null value reference line (spans full plot height) -->
          <line
            x1={xScale(layout.nullValue)}
            x2={xScale(layout.nullValue)}
            y1={layout.headerHeight}
            y2={layout.headerHeight + displayRows.length * layout.rowHeight}
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
                y2={layout.headerHeight + displayRows.length * layout.rowHeight}
                stroke={annotation.color ?? "var(--wf-accent)"}
                stroke-width="1.5"
                stroke-dasharray={annotation.style === "dashed" ? "6,4" : annotation.style === "dotted" ? "2,2" : "none"}
              />
              {#if annotation.label}
                <text
                  x={xScale(annotation.x)}
                  y={layout.headerHeight - 4}
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
                <RowInterval
                  row={displayRow.row}
                  yPosition={i * layout.rowHeight + layout.rowHeight / 2}
                  {xScale}
                  {layout}
                  {theme}
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
            {#if spec.data.overall && layout.showOverallSummary}
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
                  <div
                    class="webforest-col"
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
                    {:else if column.type === "numeric"}
                      {formatNumber(row.metadata[column.field] as number)}
                    {:else if column.type === "interval"}
                      {formatInterval(row.point, row.lower, row.upper)}
                    {:else}
                      {row.metadata[column.field] ?? ""}
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

    <!-- Tooltip -->
    <Tooltip row={tooltipRow} position={tooltipPosition} {theme} />
  {:else}
    <div class="webforest-empty">No data</div>
  {/if}
</div>

<script lang="ts" module>
  import type { Row, ColumnSpec, RowStyle, DisplayRow } from "$types";

  // Get CSS class for SVG row banding
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

    if (hasGroups && displayRow.depth > 0) {
      return `band-depth-${Math.min(displayRow.depth, 4)}`;
    }
    // Default alternating: odd rows get subtle background
    return idx % 2 === 1 ? "band-odd" : "band-even";
  }

  function formatNumber(value: number | undefined): string {
    if (value === undefined || value === null) return "";
    return value.toFixed(2);
  }

  function formatInterval(point?: number, lower?: number, upper?: number): string {
    // Handle NA/undefined values gracefully (for header/spacer rows)
    if (point === undefined || point === null || Number.isNaN(point)) {
      return "";
    }
    if (lower === undefined || lower === null || upper === undefined || upper === null ||
        Number.isNaN(lower) || Number.isNaN(upper)) {
      return point.toFixed(2);
    }
    return `${point.toFixed(2)} (${lower.toFixed(2)}, ${upper.toFixed(2)})`;
  }

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

    if (style?.type === "header") classes.push("row-header");
    if (style?.type === "summary") classes.push("row-summary");
    if (style?.type === "spacer") classes.push("row-spacer");
    if (style?.bold) classes.push("row-bold");
    if (style?.italic) classes.push("row-italic");

    // Add depth-based banding class when there are groups
    if (depth && depth > 0) {
      classes.push(`row-depth-${Math.min(depth, 4)}`);
    } else if (!hasGroups && idx !== undefined) {
      // Default alternating banding when no groups
      if (idx % 2 === 1) classes.push("row-odd");
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
</script>

<style>
  /* Ensure consistent box-sizing for all elements */
  .webforest-container,
  .webforest-container *,
  .webforest-container *::before,
  .webforest-container *::after {
    box-sizing: border-box;
  }

  .webforest-container {
    font-family: var(--wf-font-family);
    font-size: var(--wf-font-size-base);
    color: var(--wf-fg);
    background: var(--wf-bg);
    border: 1px solid var(--wf-border);
    border-radius: 8px;
    overflow: hidden;
    max-height: 100vh;
    display: flex;
    flex-direction: column;
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

  .row-bold {
    font-weight: var(--wf-font-weight-bold, 600);
  }

  .row-italic {
    font-style: italic;
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
    fill: color-mix(in srgb, var(--wf-primary) 8%, var(--wf-bg));
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

<script lang="ts">
  import type { ColumnDef, ColumnSpec, ColumnGroup } from "$types";
  import type { ForestStore } from "$stores/forestStore.svelte";

  interface Props {
    columnDefs: ColumnDef[];
    showLabel?: boolean;
    labelHeader?: string;
    store?: ForestStore;
    enableResize?: boolean;
  }

  let {
    columnDefs,
    showLabel = false,
    labelHeader = "Label",
    store,
    enableResize = false,
  }: Props = $props();

  // Compute if we have any groups (need two-row header)
  const hasGroups = $derived(columnDefs.some((c) => c.isGroup));

  // Create reactive dependency on columnWidths to trigger re-render when widths change
  const columnWidthsSnapshot = $derived(store ? { ...store.columnWidths } : {});

  // Get flat list of leaf columns
  function getLeafColumns(cols: ColumnDef[]): ColumnSpec[] {
    const result: ColumnSpec[] = [];
    for (const col of cols) {
      if (col.isGroup) {
        result.push(...getLeafColumns(col.columns));
      } else {
        result.push(col);
      }
    }
    return result;
  }

  // Get colspan for a column def
  function getColspan(col: ColumnDef): number {
    if (!col.isGroup) return 1;
    return getLeafColumns(col.columns).length;
  }

  const leafColumns = $derived(getLeafColumns(columnDefs));

  // Calculate explicit grid column start positions for each column def
  // This is needed because CSS Grid auto-placement doesn't handle mixed
  // column-spanning and row-spanning items correctly
  const columnStartPositions = $derived.by(() => {
    const positions = new Map<string, number>();
    let currentCol = showLabel ? 2 : 1; // Start after label if present
    for (const col of columnDefs) {
      positions.set(col.id, currentCol);
      currentCol += getColspan(col);
    }
    return positions;
  });

  // Get the grid-column start position for a column def
  function getGridColumnStart(col: ColumnDef): number {
    return columnStartPositions.get(col.id) ?? 1;
  }

  // Helper to get column width (dynamic or default)
  // Only returns numeric widths - "auto" columns return undefined
  // Uses columnWidthsSnapshot to ensure Svelte 5 reactivity
  function getColWidth(column: ColumnSpec): number | undefined {
    const storeWidth = columnWidthsSnapshot[column.id];
    if (typeof storeWidth === "number") return storeWidth;
    if (typeof column.width === "number") return column.width;
    return undefined;
  }

  // Get label column width (uses special key "__label__")
  // Uses columnWidthsSnapshot to ensure Svelte 5 reactivity
  function getLabelWidth(): number | undefined {
    return columnWidthsSnapshot["__label__"];
  }

  // Check if column has explicit (non-auto) width - used for truncation CSS
  function hasExplicitWidth(column: ColumnSpec): boolean {
    return typeof column.width === "number";
  }

  // Start resize for label column
  function startLabelResize(e: PointerEvent) {
    if (!store || !enableResize) return;
    e.preventDefault();
    e.stopPropagation();
    resizing = { id: "__label__" } as ColumnSpec;
    startX = e.clientX;
    startWidth = getLabelWidth() ?? 150;
    document.addEventListener("pointermove", onResize);
    document.addEventListener("pointerup", stopResize);
  }

  // Generate grid template columns for hierarchical layout
  const gridTemplateColumns = $derived.by(() => {
    if (!hasGroups) return "";
    const parts: string[] = [];
    if (showLabel) {
      const labelW = getLabelWidth();
      parts.push(labelW ? `${labelW}px` : "minmax(120px, 1fr)");
    }
    for (const col of leafColumns) {
      const width = getColWidth(col);
      if (width) {
        parts.push(`${width}px`);
      } else {
        parts.push("auto");
      }
    }
    return parts.join(" ");
  });

  // Resize state and handlers
  let resizing = $state<ColumnSpec | null>(null);
  let startX = 0;
  let startWidth = 0;

  function startResize(e: PointerEvent, column: ColumnSpec) {
    if (!store || !enableResize) return;
    e.preventDefault();
    e.stopPropagation();
    resizing = column;
    startX = e.clientX;
    startWidth = getColWidth(column) ?? 80;
    document.addEventListener("pointermove", onResize);
    document.addEventListener("pointerup", stopResize);
  }

  function onResize(e: PointerEvent) {
    if (!resizing || !store) return;
    const delta = e.clientX - startX;
    store.setColumnWidth(resizing.id, startWidth + delta);
  }

  function stopResize() {
    resizing = null;
    document.removeEventListener("pointermove", onResize);
    document.removeEventListener("pointerup", stopResize);
  }
</script>

{#if hasGroups}
  <!-- Two-row header for hierarchical columns using CSS Grid -->
  <div class="webforest-header-grid" style:grid-template-columns={gridTemplateColumns}>
    <!-- Row 1: Label + Group headers -->
    {#if showLabel}
      <div
        class="webforest-label-col header-cell group-row"
        style:grid-row="1 / 3"
        style:width={getLabelWidth() ? `${getLabelWidth()}px` : undefined}
      >
        <span class="header-text">{labelHeader}</span>
        {#if enableResize && store}
          <!-- svelte-ignore a11y_no_static_element_interactions -->
          <div
            class="resize-handle"
            onpointerdown={startLabelResize}
          ></div>
        {/if}
      </div>
    {/if}
    {#each columnDefs as col (col.id)}
      {#if col.isGroup}
        <div
          class="webforest-col header-cell group-header group-row"
          style:grid-column="{getGridColumnStart(col)} / span {getColspan(col)}"
        >
          {col.header}
        </div>
      {:else}
        <div
          class="webforest-col header-cell group-row"
          style:grid-column={getGridColumnStart(col)}
          style:grid-row="1 / 3"
          style:text-align={col.headerAlign ?? col.align}
        >
          <span class="header-text">{col.header}</span>
          {#if enableResize && store}
            <!-- svelte-ignore a11y_no_static_element_interactions -->
            <div
              class="resize-handle"
              onpointerdown={(e) => startResize(e, col)}
            ></div>
          {/if}
        </div>
      {/if}
    {/each}

    <!-- Row 2: Sub-column headers -->
    {#each columnDefs as col (col.id)}
      {#if col.isGroup}
        {#each col.columns as subCol (subCol.id)}
          {#if !subCol.isGroup}
            <div
              class="webforest-col header-cell column-row"
              style:text-align={subCol.headerAlign ?? subCol.align}
            >
              <span class="header-text">{subCol.header}</span>
              {#if enableResize && store}
                <!-- svelte-ignore a11y_no_static_element_interactions -->
                <div
                  class="resize-handle"
                  onpointerdown={(e) => startResize(e, subCol)}
                ></div>
              {/if}
            </div>
          {/if}
        {/each}
      {/if}
    {/each}
  </div>
{:else}
  <!-- Single-row header for flat columns -->
  <div class="webforest-table-header">
    {#if showLabel}
      <div
        class="webforest-label-col"
        style:width={getLabelWidth() ? `${getLabelWidth()}px` : undefined}
        style:flex={getLabelWidth() ? 'none' : '1'}
      >
        <span class="header-text">{labelHeader}</span>
        {#if enableResize && store}
          <!-- svelte-ignore a11y_no_static_element_interactions -->
          <div
            class="resize-handle"
            onpointerdown={startLabelResize}
          ></div>
        {/if}
      </div>
    {/if}
    {#each leafColumns as column (column.id)}
      <div
        class="webforest-col"
        class:explicit-width={hasExplicitWidth(column)}
        style:width={getColWidth(column) ? `${getColWidth(column)}px` : "auto"}
        style:text-align={column.headerAlign ?? column.align}
      >
        <span class="header-text">{column.header}</span>
        {#if enableResize && store}
          <!-- svelte-ignore a11y_no_static_element_interactions -->
          <div
            class="resize-handle"
            onpointerdown={(e) => startResize(e, column)}
          ></div>
        {/if}
      </div>
    {/each}
  </div>
{/if}

<style>
  .webforest-table-header {
    display: flex;
    height: var(--wf-header-height);
    align-items: center;
    /* Removed padding: 0 4px - was causing width mismatch with data rows */
    background: var(--wf-bg);
    border-bottom: 1px solid var(--wf-border);
    font-weight: 600;
    font-size: var(--wf-font-size-base);
    color: var(--wf-secondary);
  }

  .webforest-header-grid {
    display: grid;
    grid-template-rows: calc(var(--wf-header-height) / 2) calc(var(--wf-header-height) / 2);
    /* Removed padding: 0 4px - was causing width mismatch with data rows */
    background: var(--wf-bg);
    border-bottom: 1px solid var(--wf-border);
    font-weight: 600;
    font-size: var(--wf-font-size-base);
    color: var(--wf-secondary);
  }

  .header-cell {
    display: flex;
    align-items: center;
  }

  .group-row {
    border-bottom: 1px solid var(--wf-border);
  }

  .column-row {
    /* No bottom border on column row - parent has it */
  }

  .group-header {
    justify-content: center;
    font-weight: 700;
    padding-left: var(--wf-group-padding, 8px);
    padding-right: var(--wf-group-padding, 8px);
  }

  .webforest-label-col {
    flex: 1;
    min-width: 120px;
    padding: 0 10px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    position: relative;
  }

  .webforest-col {
    padding: 0 10px;
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
    position: relative;
    flex-shrink: 0;  /* Prevent shrinking below set width */
  }

  .header-text {
    /* Allow headers to show full text - column widths should be sized by measurement */
    display: block;
  }

  /* Truncate headers only for columns with explicit (non-auto) width */
  .explicit-width .header-text {
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .resize-handle {
    position: absolute;
    right: 0;
    top: 0;
    bottom: 0;
    width: 4px;
    cursor: col-resize;
    background: transparent;
    z-index: 10;
  }

  .resize-handle:hover,
  .resize-handle:active {
    background: var(--wf-primary, #2563eb);
  }
</style>

<!--
  ForestPlot — top-level renderer for a single (non-split) tabviz widget.

  Phase 0c-C2 audit (2026-05): originally 3526 lines. After
  ForestOverlays extraction (Phase 0c-PR12) the parent is 3329 lines.

  The original spec proposed splitting into ForestHeader / ForestTableBody
  / ForestPlotBody / ForestControls / ForestOverlays + a thin orchestrator
  (<500 lines). Implementation reality required revising that plan:

  - **ForestHeader, ForestControls** dropped: the title/subtitle region
    and the toolbar/settings region are already single-component mounts
    (PlotHeader / ControlToolbar / SettingsPanel). Wrapping them adds
    files without reducing complexity.

  - **ForestOverlays** done: the popover-chain glue + drop indicator +
    tooltip lifted out clean (Phase 0c-PR12).

  - **ForestTableBody + ForestPlotBody** deferred with justification:
    both live inside the same CSS Grid container (`.tabviz-main`) and
    share grid-row / grid-column placements. Extracting them as siblings
    would either (a) require both components to render at the top level
    inside the grid via Svelte fragments + identical grid-placement
    props, or (b) duplicate the grid wrapper which breaks layout. Plus
    they share ~30 derived values and helper methods (gridTemplateColumns,
    layout, xScale, displayRows, bandIndexes, getCellStyle,
    paintCellPreviewToken, etc.) which would all need to be threaded
    via props or context.

    The cleaner refactor — extracting the entire `.tabviz-main` block as
    a single ForestMain component — moves ~950 lines but adds one
    intermediate component with prop drilling for those 30 shared
    values. Net complexity shifts more than it reduces.

    Phase 1.x follow-up: revisit once the createTabviz factory is in
    place; the cleaner state-passing mechanism (via the factory's
    instance API rather than ad-hoc props) may make a fuller decomp
    viable. For now this file lives above the 700-line threshold with
    this justification per the spec's stopping rule.
-->
<script lang="ts">
  import { tick } from "svelte";
  import type { ForestStore } from "$stores/forestStore.svelte";
  import type { ThemeName } from "$lib/theme-presets";
  import type { WebTheme, ColumnSpec, ColumnDef, ColumnOptions, Row, DisplayRow, GroupHeaderRow, DataRow, CellStyle, Annotation, SemanticBundle } from "$types";
  import RowInterval from "$components/forest/RowInterval.svelte";
  import EffectAxis from "$components/forest/EffectAxis.svelte";
  import SummaryDiamond from "$components/forest/SummaryDiamond.svelte";
  import PlotHeader from "$components/forest/PlotHeader.svelte";
  import EdgeResize from "$components/ui/EdgeResize.svelte";
  import PlotFooter from "$components/forest/PlotFooter.svelte";
  import Watermark from "$components/table/Watermark.svelte";
  import GroupHeader from "$components/forest/GroupHeader.svelte";
  import ForestOverlays from "./ForestOverlays.svelte";
  import CellBar from "$components/table/CellBar.svelte";
  import CellPvalue from "$components/table/CellPvalue.svelte";
  import CellSparkline from "$components/table/CellSparkline.svelte";
  import CellContent from "$components/table/CellContent.svelte";
  import CellIcon from "$components/table/CellIcon.svelte";
  import CellBadge from "$components/table/CellBadge.svelte";
  import CellStars from "$components/table/CellStars.svelte";
  import CellPictogram from "$components/table/CellPictogram.svelte";
  import CellRing from "$components/table/CellRing.svelte";
  import CellImg from "$components/table/CellImg.svelte";
  import CellReference from "$components/table/CellReference.svelte";
  import CellRange from "$components/table/CellRange.svelte";
  import CellHeatmap from "$components/table/CellHeatmap.svelte";
  import CellProgress from "$components/table/CellProgress.svelte";
  import ControlToolbar from "$components/ui/ControlToolbar.svelte";
  import SettingsPanel from "$components/ui/SettingsPanel.svelte";
  import SortIndicator from "$components/controls/SortIndicator.svelte";
  import ColumnFilterButton from "$components/controls/ColumnFilterButton.svelte";
  // ColumnFilterPopover, HeaderContextMenu, ColumnTypeMenu, ColumnEditorPopover
  // moved into ForestOverlays (Phase 0c-C2). Tooltip + DropIndicator + EditableCell
  // also moved there.
  import ColumnDragHandle from "$components/controls/ColumnDragHandle.svelte";
  import { isVizType, resolveShowHeader } from "$lib/column-types";
  import { resolveSemanticBundle, activeSemanticToken } from "$lib/semantic-styling";
  import { computeAxisLayout, textRegionHeight } from "$lib/typography-layout";
  import {
    isLayoutDebugEnabled,
    isLayoutOverlayEnabled,
    paintLayoutOverlay,
    reportLayoutMeasurements,
  } from "$lib/debug-layout";
  import { hitTestRowGaps } from "$lib/dnd-utils";
  import VizBar from "$components/viz/VizBar.svelte";
  import VizBoxplot from "$components/viz/VizBoxplot.svelte";
  import VizViolin from "$components/viz/VizViolin.svelte";
  import { scaleLinear, scaleLog } from "d3-scale";
  import { computeBoxplotStats } from "$lib/viz-utils";
  import { VIZ_MARGIN } from "$lib/axis-utils";
  import { zoomable } from "$lib/zoom-interactions";
  import { TEXT_MEASUREMENT } from "$lib/rendering-constants";
  import { buildWidgetCSS } from "$lib/theme-css";
  import {
    formatNumber,
    formatEvents,
    formatInterval,
    addThousandsSep,
    abbreviateNumber,
    truncateString,
  } from "$lib/formatters";

  interface Props {
    store: ForestStore;
    onThemeChange?: (themeName: ThemeName) => void;
  }

  let { store, onThemeChange }: Props = $props();

  // Unique per-widget instance suffix so SVG clipPath IDs don't collide when
  // multiple tabviz widgets render on the same page (e.g. docs gallery).
  // Without this, every widget with the same column.id produces the same
  // `viz-clip-<colId>` and the browser resolves `url(#…)` to the first match
  // — clipping later widgets' markers against earlier widgets' clip rects.
  const instanceId = `w${Math.random().toString(36).slice(2, 10)}`;

  // Reactive derivations from store
  const spec = $derived(store.spec);
  const visibleRows = $derived(store.visibleRows);
  const displayRows = $derived(store.displayRows);
  const rowPaddedAfter = $derived(store.rowPaddedAfter);
  const layout = $derived(store.layout);
  const xScale = $derived(store.xScale);
  const axisComputation = $derived(store.axisComputation);
  const clipBounds = $derived(axisComputation.axisLimits);
  const theme = $derived(spec?.theme);

  // Webfont injection: themes can declare `webFonts: [{family, url}, ...]`
  // and we append a <link rel=stylesheet> per URL on mount + when the
  // theme changes. Dedup by href across multiple widgets on the same
  // page; never remove (a sibling widget may rely on the same font).
  // SSR safety: guard `document` access.
  $effect(() => {
    if (typeof document === "undefined") return;
    const fonts = (theme as { webFonts?: Array<{ family: string; url: string }> } | undefined)?.webFonts;
    if (!Array.isArray(fonts) || fonts.length === 0) return;
    for (const wf of fonts) {
      if (!wf?.url || typeof wf.url !== "string") continue;
      const exists = document.querySelector(
        `link[rel="stylesheet"][href="${wf.url.replace(/"/g, "")}"]`
      );
      if (exists) continue;
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = wf.url;
      link.dataset.tabvizWebfont = wf.family;
      document.head.appendChild(link);
    }
  });
  const bandIndexes = $derived(store.bandIndexes);
  // Column system: all columns in order (forest columns are inline)
  const allColumns = $derived(store.allColumns);
  const allColumnDefs = $derived(store.allColumnDefs);
  const forestColumns = $derived(store.forestColumns);
  const hasForestColumns = $derived(forestColumns.length > 0);
  const vizColumns = $derived(store.vizColumns);
  const hasVizColumns = $derived(vizColumns.length > 0);
  const primaryColumnId = $derived(store.primaryColumnId);

  // Plot-level labels — prefer session edits over the R-supplied values so
  // dblclick/Add-label flows round-trip through the widget without waiting
  // for a round-trip back to the store's exportSpec.
  const labelTitle = $derived(store.getPlotLabel("title"));
  const labelSubtitle = $derived(store.getPlotLabel("subtitle"));
  const labelCaption = $derived(store.getPlotLabel("caption"));
  const labelFootnote = $derived(store.getPlotLabel("footnote"));

  // Header/footer render only when a real label is present. Reserving an
  // empty header slot for an "Add title…" affordance broke intentional
  // spacing between the table and whichever labels WERE set (e.g. title
  // present, subtitle absent). Labels are added via Basics settings tab.
  const labelsEditable = $derived(!!spec?.interaction?.enableEdit);
  const hasPlotHeader = $derived(!!labelTitle || !!labelSubtitle);

  // Check if we have column groups (need two-row header)
  const hasColumnGroups = $derived(
    allColumnDefs.some(c => c.isGroup)
  );
  const tooltipRow = $derived(store.tooltipRow);
  const tooltipPosition = $derived(store.tooltipPosition);
  const hoveredRowId = $derived(store.hoveredRowId);

  // The painter is always-on in the unified select-as-paint model. We read
  // paint state via `store.paintTool` and `store.paintHoverCellField`
  // everywhere — Svelte 5's compiler doesn't rewrite component-local
  // $state references inside helper functions defined in the same script
  // (they end up as bare ReferenceError lookups), but prop access via
  // store.* goes through a getter the compiler always preserves.

  // Zoom & auto-fit state (from store)
  const zoom = $derived(store.zoom);
  const autoFit = $derived(store.autoFit);
  const actualScale = $derived(store.actualScale);
  const maxWidth = $derived(store.maxWidth);
  const maxHeight = $derived(store.maxHeight);
  const showZoomControls = $derived(store.showZoomControls);

  // Create reactive dependency on columnWidths to trigger re-render when widths change
  const columnWidthsSnapshot = $derived({ ...store.columnWidths });

  // Container refs for dimension tracking
  let containerRef: HTMLDivElement | undefined = $state();
  let scalableRef: HTMLDivElement | undefined = $state();

  // Interactive column-editor state: right-click menu → type menu → editor popover.
  // headerContextMenu, columnTypeMenuTarget, columnEditorTarget moved into
  // ForestOverlays (Phase 0c-C2). The parent's column-header click handlers
  // call overlays.openHeaderContextMenu(...) via the bind:this ref below.
  type ForestOverlaysRef = {
    openHeaderContextMenu: (column: ColumnSpec, e: MouseEvent) => void;
  };
  let overlays = $state<ForestOverlaysRef | null>(null);
  // typeMenuMemory + openHeaderContextMenu + handleContextMenuAction +
  // handleTypePick + handleRequestChangeType + handleEditorCommit all
  // moved into ForestOverlays (Phase 0c-C2). Column-header click handlers
  // now call `overlays?.openHeaderContextMenu(column, e)` via the
  // bind:this ref above.

  // Local state for dimensions (measured by ResizeObserver)
  let containerContentWidth = $state(0);
  let scalableNaturalWidth = $state(0);
  let scalableNaturalHeight = $state(0);

  // Natural content width from store (calculated from column specs)
  const naturalContentWidth = $derived(store.naturalContentWidth);

  // Scaled dimensions for container sizing (CSS transform doesn't affect layout)
  // Container should be sized to scaled dimensions so it responds to zoom
  const scaledWidth = $derived(scalableNaturalWidth * actualScale);
  const scaledHeight = $derived(scalableNaturalHeight * actualScale);

  // Centering margin: center the scaled content within the container,
  // independent of auto-fit (v0.25.0+). Previously gated to auto-fit only,
  // which left non-auto-fit widgets sitting at the left of the container
  // even when content was narrower than the available width — visually
  // surprising under high `containerPadding`. The margin is the offset
  // INSIDE the padding box, so high padding doesn't shift the math.
  const centeringMargin = $derived.by(() => {
    if (containerContentWidth <= 0 || scaledWidth <= 0) return 0;
    const margin = (containerContentWidth - scaledWidth) / 2;
    return Math.max(0, margin);
  });

  // ResizeObserver - track container and scalable dimensions, report to store
  $effect(() => {
    if (!containerRef || !scalableRef) return;

    // Report container element ID for persistence
    if (containerRef.id) {
      store.setContainerElementId(containerRef.id);
    }

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (entry.target === containerRef) {
          containerContentWidth = entry.contentRect.width;
          store.setContainerDimensions(
            entry.contentRect.width,
            entry.contentRect.height
          );
        } else if (entry.target === scalableRef) {
          scalableNaturalWidth = entry.contentRect.width;
          scalableNaturalHeight = entry.contentRect.height;
          store.setScalableNaturalDimensions(
            entry.contentRect.width,
            entry.contentRect.height
          );
        }
      }
    });

    observer.observe(containerRef);
    observer.observe(scalableRef);

    return () => {
      observer.disconnect();
    };
  });

  // ─ Layout debug instrumentation (opt-in via URL flag) ─────────────────
  // Reports DOM-rendered row heights vs layout-engine predictions and
  // (optionally) overlays guide lines at predicted row tops. No effect
  // unless `?tabviz-debug-layout=1` is set on the page URL. Re-runs on
  // every layout / displayRows change so theme tweaks emit fresh
  // measurements without a reload.
  $effect(() => {
    if (!isLayoutDebugEnabled()) return;
    if (!containerRef || !spec) return;
    // Touch dependencies so the effect re-fires on relevant changes.
    void layout.rowHeight;
    void layout.rowHeights.length;
    void layout.headerHeight;
    void displayRows.length;
    void spec.theme.spacing.rowHeight;
    void spec.theme.spacing.cellPaddingY;
    void spec.theme.spacing.rowGroupPadding;

    // Defer to next paint so the DOM has the new sizes.
    const handle = window.requestAnimationFrame(() => {
      if (!containerRef) return;
      reportLayoutMeasurements({
        containerEl: containerRef,
        layout,
        displayRows,
        themeSpacing: {
          rowHeight: spec.theme.spacing.rowHeight,
          cellPaddingY: spec.theme.spacing.cellPaddingY,
          rowGroupPadding: spec.theme.spacing.rowGroupPadding ?? 0,
          rowBorderWidth: spec.theme.row.borderWidth ?? 1,
          headerHeight: spec.theme.spacing.headerHeight,
        },
      });
    });

    let cleanupOverlay: (() => void) | null = null;
    if (isLayoutOverlayEnabled()) {
      const overlayHandle = window.requestAnimationFrame(() => {
        if (!containerRef) return;
        cleanupOverlay = paintLayoutOverlay(
          containerRef,
          layout,
          // Rows region starts after header band and any title block —
          // approximate via the first primary cell's offset.
          (() => {
            const first = containerRef.querySelector<HTMLElement>('[data-display-index="0"]');
            const r = first?.getBoundingClientRect();
            const cr = containerRef.getBoundingClientRect();
            return r && cr ? r.top - cr.top : 0;
          })(),
        );
      });
      return () => {
        window.cancelAnimationFrame(handle);
        window.cancelAnimationFrame(overlayHandle);
        cleanupOverlay?.();
      };
    }
    return () => window.cancelAnimationFrame(handle);
  });

  // Check if export is enabled (default true)
  const enableExport = $derived(spec?.interaction?.enableExport !== false);

  // Get available themes for theme switcher (null = disabled, object = custom themes)
  const enableThemes = $derived(spec?.interaction?.enableThemes);

  // Keyboard shortcuts for zoom control
  function handleKeydown(event: KeyboardEvent) {
    // Only handle if modifier key is pressed
    if (!event.metaKey && !event.ctrlKey) return;
    // Don't interfere with input fields
    if ((event.target as HTMLElement)?.tagName === 'INPUT') return;

    switch (event.key) {
      case '=':
      case '+':
        event.preventDefault();
        store.zoomIn();
        break;
      case '-':
        event.preventDefault();
        store.zoomOut();
        break;
      case '0':
        event.preventDefault();
        store.resetZoom();
        break;
      case '1':
        event.preventDefault();
        store.fitToWidth();
        break;
    }
  }

  // Check if the data has any groups

  // Row Y positions and heights for SVG overlay (annotations / row
  // intervals). Reads the same `layout.rowHeights` / `rowPositions` the
  // CSS grid uses, so wrap-grown rows and group-header padding stay in
  // lockstep with the visible row edges.
  const rowLayout = $derived.by(() => {
    const heights = layout.rowHeights;
    const positions = layout.rowPositions;
    const totalHeight = positions.length > 0
      ? positions[positions.length - 1] + heights[heights.length - 1]
      : 0;
    return { positions, heights, totalHeight };
  });

  // Total height of rows area for SVG sizing
  const rowsAreaHeight = $derived(rowLayout.totalHeight);

  // Helper to compute Y offsets for annotation labels to avoid collisions.
  // For each label, pick the lowest tier whose occupied labels are all at
  // least MIN_LABEL_SPACING away — handles 3+ adjacent collisions.
  function computeAnnotationLabelOffsets(annotations: Annotation[]): Record<string, number> {
    const labeledAnnotations = annotations
      .filter((a): a is Annotation & { type: "reference_line"; label: string } => a.type === "reference_line" && !!a.label)
      .map(a => ({ id: a.id, x: xScale(a.x), label: a.label }))
      .sort((a, b) => a.x - b.x);

    // Center-anchored labels: a ~100px label extends 50px each side of its anchor.
    const MIN_LABEL_SPACING = 120;
    const STAGGER_OFFSET = 16;

    const offsets: Record<string, number> = {};
    const tiers: number[][] = [];
    for (const current of labeledAnnotations) {
      let placed = false;
      for (let tier = 0; tier < tiers.length; tier++) {
        if (tiers[tier].every(x => Math.abs(current.x - x) >= MIN_LABEL_SPACING)) {
          tiers[tier].push(current.x);
          offsets[current.id] = tier * STAGGER_OFFSET;
          placed = true;
          break;
        }
      }
      if (!placed) {
        tiers.push([current.x]);
        offsets[current.id] = (tiers.length - 1) * STAGGER_OFFSET;
      }
    }

    return offsets;
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

  // Compute group header background color based on nesting level
  // Uses solid colors (pre-blended with background) to avoid transparency artifacts
  function getGroupBackground(level: number, theme: WebTheme | undefined): string {
    const rg = theme?.rowGroup;
    const primary = theme?.accent?.default ?? "#0891b2";
    const bg = theme?.surface?.base ?? "#ffffff";

    // Get explicit background if set, otherwise compute from primary
    const tier = level === 1 ? rg?.L1 : level === 2 ? rg?.L2 : rg?.L3;
    if (tier?.bg) return tier.bg;

    // Blend primary with background at different opacities per level
    // This produces solid colors that look the same as rgba but without transparency artifacts
    const opacities = [0.15, 0.10, 0.06];
    const opacity = opacities[Math.min(level - 1, 2)];

    // Parse hex colors
    const parseHex = (hex: string) => {
      const h = hex.replace("#", "");
      return {
        r: parseInt(h.substring(0, 2), 16),
        g: parseInt(h.substring(2, 4), 16),
        b: parseInt(h.substring(4, 6), 16),
      };
    };

    const p = parseHex(primary);
    const b = parseHex(bg);

    // Blend: result = primary * opacity + background * (1 - opacity)
    const blend = (fg: number, bg: number) => Math.round(fg * opacity + bg * (1 - opacity));

    const r = blend(p.r, b.r);
    const g = blend(p.g, b.g);
    const bl = blend(p.b, b.b);

    return `rgb(${r}, ${g}, ${bl})`;
  }

  // Calculate maximum header depth (number of header rows needed)
  const headerDepth = $derived.by(() => {
    return Math.max(1, 1 + getMaxGroupDepth(allColumnDefs));
  });

  // True if any leaf column's header renders, or any column group exists.
  // When false, the entire header band (and its height contribution) is dropped.
  const anyHeaderVisible = $derived(
    hasColumnGroups ||
    allColumns.some(c => resolveShowHeader(c.showHeader, c.header))
  );
  const effectiveHeaderDepth = $derived(anyHeaderVisible ? headerDepth : 0);

  // Flatten column structure into render items with position info
  // Each item has: col, gridColumnStart, colspan, rowStart, rowSpan, isForest
  interface HeaderCell {
    col: ColumnDef;
    gridColumnStart: number;
    colspan: number;
    rowStart: number;
    rowSpan: number;
    isGroupHeader: boolean;
    isForest: boolean;  // True for forest columns
  }

  const headerCells = $derived.by((): HeaderCell[] => {
    const cells: HeaderCell[] = [];
    // Grid-columns are 1-indexed; the primary column is allColumns[0] and
    // occupies grid-column 1 just like any other column.
    let colIndex = 1;

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
          isForest: false,
        });
        // Process children at next depth
        for (const child of col.columns) {
          processColumn(child, depth + 1);
        }
      } else {
        // Leaf column: spans from current depth to bottom
        const isVizColumn = !col.isGroup && vizColumnTypes.includes(col.type);
        cells.push({
          col,
          gridColumnStart: startCol,
          colspan: 1,
          rowStart: depth + 1,
          rowSpan: headerDepth - depth,
          isGroupHeader: false,
          isForest: isVizColumn,  // Treat all viz columns like forest for header styling
        });
        colIndex++;
      }
    }

    // Process all columns in order
    for (const col of allColumnDefs) {
      processColumn(col, 0);
    }

    return cells;
  });

  // Helper to get column width (dynamic or default)
  // Returns "max-content" for auto-width columns (sizes to content, won't shrink)
  // Returns "{n}px" for fixed-width columns
  // Uses columnWidthsSnapshot to ensure Svelte 5 reactivity
  /**
   * Effective render width for a non-forest viz column (viz_bar /
   * viz_boxplot / viz_violin). Applies the aspect-ratio scale (Phase
   * 7E Lever 1B) unless the user has manually resized the column.
   * Forest columns use their own `layout.forestWidth` path
   * (lever-laddered already); this helper covers the other viz types
   * whose scale + SVG overlay both need aspect-aware widths.
   */
  function effectiveVizWidth(col: ColumnSpec): number {
    // Priority: user-resized dynamic width (drag) > author's explicit
    // `col.width` > `layout.forestWidth` fallback. Matches the
    // gridTemplateColumns derivation so scale + grid-template + d3
    // ranges agree. (Earlier draft put `col.width` first, which could
    // ignore a user resize on a column that had an authored width —
    // unified now.)
    const dynamicWidth = columnWidthsSnapshot[col.id];
    const userResized = store.userResizedIds?.has?.(col.id) ?? false;
    let base: number;
    if (typeof dynamicWidth === "number") {
      base = dynamicWidth;
    } else if (typeof col.width === "number") {
      base = col.width;
    } else {
      base = layout.forestWidth;
    }
    const scale = layout.aspectNonForestScale ?? 1;
    if (userResized || Math.abs(scale - 1) < 1e-6) return base;
    return base * scale;
  }

  /**
   * Effective on-screen pixel width for any column (forest / viz / data).
   * Mirrors the priority + scale rules of `gridTemplateColumns` and
   * `getColWidth` so drag-resize math, layout positioning, and any
   * other consumer that needs the actual rendered width agrees with
   * what the user sees.
   *
   * Centralized here to avoid drift; previously inlined in the
   * `onpointerdown` resize handlers, which broke when an aspect
   * target scaled non-flex columns — drag delta was applied to the
   * UNscaled width while the visual was scaled, so a 50px drag
   * produced 0 visual change after resize commit.
   */
  function effectiveColumnWidth(col: ColumnSpec): number {
    if (col.type === "forest") {
      if (typeof col.width === "number") return col.width;
      if (typeof col.options?.forest?.width === "number") return col.options.forest.width;
      const userResized = store.userResizedIds?.has?.(col.id) ?? false;
      const dynamicWidth = columnWidthsSnapshot[col.id];
      if (userResized && typeof dynamicWidth === "number") return dynamicWidth;
      return layout.forestWidth;
    }
    if (vizColumnTypes.includes(col.type)) {
      return effectiveVizWidth(col);
    }
    // Non-viz data column: parse the same priority + scale as
    // `getColWidth()`.
    const dynamicWidth = columnWidthsSnapshot[col.id];
    const userResized = store.userResizedIds?.has?.(col.id) ?? false;
    let base: number;
    if (typeof dynamicWidth === "number") base = dynamicWidth;
    else if (typeof col.width === "number") base = col.width;
    else return 80; // fallback for "auto"-string columns awaiting measurement
    const scale = layout.aspectNonForestScale ?? 1;
    if (userResized || Math.abs(scale - 1) < 1e-6) return base;
    return base * scale;
  }

  function getColWidth(column: ColumnSpec): string {
    // Phase 7E Lever 1B: scale measured / explicit widths by the aspect
    // factor when an aspect target expanded the layout past flex
    // saturation. Forest columns have their own (layout-driven) path so
    // aren't multiplied here. User-resized columns are pinned at the
    // exact resize value (the aspect scale only applies to columns the
    // user hasn't manually resized).
    const scale = layout.aspectNonForestScale ?? 1;
    const userResized = store.userResizedIds?.has?.(column.id) ?? false;
    const apply = (w: number): string => {
      if (userResized || Math.abs(scale - 1) < 1e-6) return `${w}px`;
      return `${w * scale}px`;
    };
    const dynamicWidth = columnWidthsSnapshot[column.id];
    if (typeof dynamicWidth === "number") return apply(dynamicWidth);
    if (typeof column.width === "number") return apply(column.width);
    return "max-content";
  }

  // Helper: width of the primary (leftmost) column, for legacy callers that
  // still want a "label width". Returns undefined if the primary column is
  // not yet measured or is missing.
  function getLabelWidth(): string | undefined {
    if (!primaryColumnId) return undefined;
    const width = columnWidthsSnapshot[primaryColumnId];
    return width ? `${width}px` : undefined;
  }

  function getLabelFlex(): string {
    if (!primaryColumnId) return "1";
    return columnWidthsSnapshot[primaryColumnId] ? "none" : "1";
  }

  // Viz column types that need fixed widths
  const vizColumnTypes = ["forest", "viz_bar", "viz_boxplot", "viz_violin"];
  const editableColumnTypes = new Set(["text", "numeric", "percent", "events", "pvalue", "interval", "date"]);
  const isEditableColumn = (col: ColumnSpec) => editableColumnTypes.has(col.type);

  // ===========================================================================
  // Whole-row drag-to-reorder (no visible grip handle)
  //
  // pointerdown on the row's label cell starts a drag candidate; document-level
  // pointermove/pointerup track the gesture. Under the threshold the candidate
  // is abandoned and the element's normal onclick fires (toggleGroup / selectRow).
  // Over the threshold, a drag is committed on pointerup and the pending click
  // is swallowed by a one-shot capturing listener.
  // ===========================================================================
  const ROW_DRAG_THRESHOLD = 6;
  let rowDragSuppressClick = false;
  let rowDragMoveHandler: ((e: PointerEvent) => void) | null = null;
  let rowDragUpHandler: (() => void) | null = null;
  // Tracks the row (or group) most recently dropped, used to briefly flash
  // the destination so the reorder feels confirmed rather than abrupt.
  let recentlyDroppedId = $state<string | null>(null);
  let recentlyDroppedTimer: ReturnType<typeof setTimeout> | null = null;

  function startRowPointerDown(
    e: PointerEvent,
    kind: "row" | "row_group",
    id: string,
    scopeKey: string,
  ) {
    if (e.button !== 0) return;
    if (!spec?.interaction.enableReorderRows) return;
    // Don't hijack pointerdowns that originated on a nested control (e.g. a
    // dblclick target, badge link, etc.).
    const target = e.target as HTMLElement;
    if (target.closest("button, input, select, textarea, a, .resize-handle")) return;

    // Kill the browser's native drag-selection behavior so the user doesn't
    // see text highlighted while dragging. user-select: none on the cell
    // handles the hover case; preventDefault here handles the active drag.
    e.preventDefault();
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
    if (typeof window !== "undefined") window.getSelection?.()?.removeAllRanges?.();

    store.beginDrag({ kind, id, scopeKey, startX: e.clientX, startY: e.clientY });
    store.dragState!.threshold = ROW_DRAG_THRESHOLD;
    rowDragSuppressClick = false;
    document.body.classList.add("tabviz-dragging-rows");

    rowDragMoveHandler = (ev: PointerEvent) => {
      const drag = store.dragState;
      if (!drag) return;
      // During active drag, reassert suppression of text selection in case a
      // modifier key or drag outside the widget reawakens it.
      if (drag.active) window.getSelection?.()?.removeAllRanges?.();
      const allowed = getAllowedRowIndices(kind, scopeKey);
      const hit = (allowed.length > 0)
        ? hitTestRowGaps(ev.clientX, ev.clientY, allowed, (di) => containerRef?.querySelector<HTMLElement>(`[data-display-index="${di}"]`) ?? null)
        : null;
      store.updateDrag(ev.clientX, ev.clientY, hit ? hit.index : null);
      if (store.dragState?.active) rowDragSuppressClick = true;
    };

    rowDragUpHandler = () => {
      if (rowDragMoveHandler) document.removeEventListener("pointermove", rowDragMoveHandler);
      if (rowDragUpHandler) document.removeEventListener("pointerup", rowDragUpHandler);
      rowDragMoveHandler = null;
      rowDragUpHandler = null;
      document.body.classList.remove("tabviz-dragging-rows");
      store.endDrag((state) => {
        if (state.indicatorIndex == null) return;
        if (state.kind === "row") store.moveRowItem(state.id, state.indicatorIndex);
        else if (state.kind === "row_group") store.moveRowGroupItem(state.id, state.indicatorIndex);
        // Flash the dropped row briefly so the user sees where it landed.
        recentlyDroppedId = state.id;
        if (recentlyDroppedTimer) clearTimeout(recentlyDroppedTimer);
        recentlyDroppedTimer = setTimeout(() => { recentlyDroppedId = null; }, 600);
      });
      if (rowDragSuppressClick) {
        const swallow = (ev: MouseEvent) => {
          ev.stopPropagation();
          ev.preventDefault();
          window.removeEventListener("click", swallow, true);
        };
        window.addEventListener("click", swallow, true);
      }
    };

    document.addEventListener("pointermove", rowDragMoveHandler);
    document.addEventListener("pointerup", rowDragUpHandler);
  }

  function getAllowedRowIndices(kind: "row" | "row_group", scopeKey: string): number[] {
    const rows = store.displayRows;
    const indices: number[] = [];
    if (kind === "row") {
      const siblingIds = new Set(store.siblingsForRowScope(scopeKey));
      rows.forEach((dr, i) => {
        if (dr.type === "data" && siblingIds.has(dr.row.id)) indices.push(i);
      });
    } else {
      const siblingIds = new Set(store.siblingsForRowGroupScope(scopeKey));
      rows.forEach((dr, i) => {
        if (dr.type === "group_header" && siblingIds.has(dr.group.id)) indices.push(i);
      });
    }
    return indices;
  }

  // computeColumnBand + computeRowBand moved into ForestOverlays
  // (Phase 0c-C2). They're used only by the drop-indicator render.

  // Compute CSS grid template columns: columns in order (primary column first).
  const gridTemplateColumns = $derived.by(() => {
    const parts: string[] = [];

    // All columns in order, viz columns get fixed widths
    for (const col of allColumns) {
      if (vizColumnTypes.includes(col.type)) {
        // Forest columns are structural: width is layout-driven (the
        // lever ladder + `layout.forestWidth`), not content-measured.
        // The auto-width measurer still writes to `columnWidths` for
        // forest (a header-min sizing) but the layout's value is the
        // authoritative one — explicit `col.width` (from R) wins
        // first, then `col.options.forest.width`, then layout. Dynamic
        // (interactive resize) widths apply only when the user
        // actually drag-resizes the column.
        const dynamicWidth = columnWidthsSnapshot[col.id];
        const userResized = store.userResizedIds?.has?.(col.id) ?? false;
        let vizWidth: number;

        if (col.type === "forest") {
          if (typeof col.width === "number") {
            vizWidth = col.width;
          } else if (typeof col.options?.forest?.width === "number") {
            vizWidth = col.options.forest.width;
          } else if (userResized && typeof dynamicWidth === "number") {
            vizWidth = dynamicWidth;
          } else {
            vizWidth = layout.forestWidth;
          }
        } else {
          // Non-forest viz columns: route through the shared
          // `effectiveVizWidth()` helper so the grid template, d3
          // scale ranges, and SVG overlay viewBoxes all agree on the
          // post-aspect-scale width.
          vizWidth = effectiveVizWidth(col);
        }
        parts.push(`${vizWidth}px`);
      } else {
        parts.push(getColWidth(col));
      }
    }

    return parts.join(" ");
  });

  // CSS Grid template rows: pin every row track to the height the layout
  // engine declared. This makes the DOM the FOLLOWER and the layout engine
  // the SOURCE OF TRUTH — instead of the previous "grid-auto-rows: auto"
  // which let the browser size rows by content + padding (so layout
  // predictions and DOM rendering disagreed under heavy padding,
  // mismatched line-heights, etc).
  //
  // Track order: [headerRowHeight × effectiveHeaderDepth, ...rowHeights]
  // where rowHeights already accounts for spacers (1/2) and group-header
  // padding (rowGroupPadding) per displayRow. Padding still goes inside
  // each cell — it eats content area, not row height. Heavy padding
  // therefore clips text rather than silently growing the row.
  const gridTemplateRows = $derived.by(() => {
    // Use `layout.headerHeight` (auto-grown to fit the font + breathing
    // when the theme value is too small for multi-tier headers) rather
    // than the raw `theme.spacing.headerHeight`.
    const headerRowH = anyHeaderVisible
      ? layout.headerHeight / headerDepth
      : 0;
    const headers = anyHeaderVisible
      ? Array(effectiveHeaderDepth).fill(`${headerRowH}px`)
      : [];
    const rows = layout.rowHeights.map((h) => `${h}px`);
    // The viz / forest axis is rendered as an absolutely-positioned SVG
    // overlay on top of the grid, but the grid's last row reserves the
    // axis-area space (see `axisRowNum` placeholder cells). Without an
    // explicit track the row collapses to 0 and the SVG overlay extends
    // past the container's content height — clipping the axis labels in
    // embedded views (Quarto, RStudio Viewer, Shiny). The track equals
    // `layout.axisHeight` (= axisGap + axisRegionHeight, both themable).
    const axisTrack = layout.axisHeight > 0 ? [`${layout.axisHeight}px`] : [];
    return [...headers, ...rows, ...axisTrack].join(" ");
  });

  // Total column count for grid (positional — leftmost column is the primary)
  const totalColumns = $derived(allColumns.length);

  // Get grid column indices for viz columns (1-based for CSS grid)
  // Returns array of { gridCol, column } for each viz column
  const vizColumnGridIndices = $derived.by((): { gridCol: number; column: typeof allColumns[0] }[] => {
    const result: { gridCol: number; column: typeof allColumns[0] }[] = [];
    for (let i = 0; i < allColumns.length; i++) {
      if (vizColumnTypes.includes(allColumns[i].type)) {
        result.push({ gridCol: 1 + i, column: allColumns[i] });
      }
    }
    return result;
  });

  // Refs to measure forest column positions for SVG overlays
  // Maps column id to { element, left }
  let forestColumnRefs = $state<Map<string, HTMLDivElement>>(new Map());
  let forestColumnPositions = $state<Map<string, number>>(new Map());

  // Ref to measure actual header height (primary column header)
  let labelHeaderRef: HTMLDivElement | undefined = $state();
  let measuredHeaderHeight = $state(0);

  // Svelte action: capture the primary header node for height measurement.
  function primaryHeaderRef(node: HTMLDivElement, isPrimary: boolean) {
    if (isPrimary) labelHeaderRef = node;
    return {
      update(next: boolean) {
        if (next) labelHeaderRef = node;
        else if (labelHeaderRef === node) labelHeaderRef = undefined;
      },
      destroy() {
        if (labelHeaderRef === node) labelHeaderRef = undefined;
      }
    };
  }

  // Update forest column positions and header height when refs change or layout changes
  $effect(() => {
    // Reference these to re-run when columns/plot resize. The aspect-
    // ratio scale (Phase 7E Lever 1B) widens non-flex columns without
    // changing layout.forestWidth in some regimes, so it needs its own
    // dependency hook here — otherwise viz overlays render at the new
    // width but their `left` positions stay at the old grid offsets.
    const _ = columnWidthsSnapshot;
    const __ = layout.forestWidth;
    const ___ = layout.aspectNonForestScale;
    const ____ = headerDepth;

    // Wait for DOM to update before measuring
    tick().then(() => {
      // Measure forest column positions
      const newPositions = new Map<string, number>();
      for (const [id, el] of forestColumnRefs) {
        if (el) {
          newPositions.set(id, el.offsetLeft);
        }
      }
      forestColumnPositions = newPositions;
      // Measure header height
      if (labelHeaderRef) {
        measuredHeaderHeight = labelHeaderRef.offsetHeight;
      }
    });
  });

  // Svelte action to register forest column refs
  function forestColumnRef(node: HTMLDivElement, id: string) {
    forestColumnRefs.set(id, node);
    forestColumnRefs = new Map(forestColumnRefs); // Trigger reactivity

    return {
      destroy() {
        forestColumnRefs.delete(id);
        forestColumnRefs = new Map(forestColumnRefs);
      }
    };
  }

  // Use measured header height if available, otherwise fall back to theme value.
  // When no header is shown at all, the band collapses to 0.
  const actualHeaderHeight = $derived(
    !anyHeaderVisible ? 0 : (measuredHeaderHeight > 0 ? measuredHeaderHeight : layout.headerHeight)
  );

  // Compute shared scales for viz columns (so all rows share the same scale)
  const vizColumnScales = $derived.by(() => {
    const scales = new Map<string, ReturnType<typeof scaleLinear<number, number>>>();
    // Use consistent padding for all viz column scales
    const vizPadding = VIZ_MARGIN;

    for (const vc of vizColumns) {
      const col = vc.column;
      const padding = vizPadding;

      if (col.type === "viz_bar") {
        const opts = col.options?.vizBar;
        if (!opts) continue;

        // Aspect-aware render width (Phase 7E Lever 1B).
        const vizWidth = effectiveVizWidth(col);

        // If axisRange is specified, use it; otherwise compute from all rows
        let domainMin = opts.axisRange?.[0];
        let domainMax = opts.axisRange?.[1];

        if (domainMin == null || domainMax == null) {
          const allValues: number[] = [];
          for (const dRow of displayRows) {
            if (dRow.type === "data") {
              for (const effect of opts.effects) {
                const val = dRow.row.metadata[effect.value] as number | undefined;
                if (val != null && !Number.isNaN(val)) {
                  allValues.push(val);
                }
              }
            }
          }
          if (allValues.length > 0) {
            domainMin = domainMin ?? Math.min(0, ...allValues);
            domainMax = domainMax ?? Math.max(...allValues) * 1.1;
          } else {
            domainMin = domainMin ?? 0;
            domainMax = domainMax ?? 100;
          }
        }

        const [zMin, zMax] = store.getEffectiveDomain(col.id, [domainMin, domainMax]);
        const scale = opts.scale === "log"
          ? scaleLog().domain([Math.max(0.01, zMin), zMax]).range([padding, vizWidth - padding])
          : scaleLinear().domain([zMin, zMax]).range([padding, vizWidth - padding]);
        scales.set(col.id, scale);

      } else if (col.type === "viz_boxplot") {
        const opts = col.options?.vizBoxplot;
        if (!opts) continue;

        const vizWidth = effectiveVizWidth(col);

        let domainMin = opts.axisRange?.[0];
        let domainMax = opts.axisRange?.[1];

        if (domainMin == null || domainMax == null) {
          const allValues: number[] = [];
          for (const dRow of displayRows) {
            if (dRow.type === "data") {
              for (const effect of opts.effects) {
                // Array data mode
                if (effect.data) {
                  const data = dRow.row.metadata[effect.data] as number[] | undefined;
                  if (data && Array.isArray(data)) {
                    const stats = computeBoxplotStats(data);
                    allValues.push(stats.min, stats.max);
                    if (opts.showOutliers !== false) allValues.push(...stats.outliers);
                  }
                }
                // Pre-computed stats mode
                else if (effect.min && effect.max) {
                  const min = dRow.row.metadata[effect.min] as number;
                  const max = dRow.row.metadata[effect.max] as number;
                  if (min != null && !Number.isNaN(min)) allValues.push(min);
                  if (max != null && !Number.isNaN(max)) allValues.push(max);
                }
              }
            }
          }
          if (allValues.length > 0) {
            const dataMin = Math.min(...allValues);
            const dataMax = Math.max(...allValues);
            const range = dataMax - dataMin;
            domainMin = domainMin ?? dataMin - range * 0.05;
            domainMax = domainMax ?? dataMax + range * 0.05;
          } else {
            domainMin = domainMin ?? 0;
            domainMax = domainMax ?? 100;
          }
        }

        const [zMin, zMax] = store.getEffectiveDomain(col.id, [domainMin, domainMax]);
        const scale = opts.scale === "log"
          ? scaleLog().domain([Math.max(0.01, zMin), zMax]).range([padding, vizWidth - padding])
          : scaleLinear().domain([zMin, zMax]).range([padding, vizWidth - padding]);
        scales.set(col.id, scale);

      } else if (col.type === "viz_violin") {
        const opts = col.options?.vizViolin;
        if (!opts) continue;

        const vizWidth = effectiveVizWidth(col);

        let domainMin = opts.axisRange?.[0];
        let domainMax = opts.axisRange?.[1];

        if (domainMin == null || domainMax == null) {
          const allValues: number[] = [];
          for (const dRow of displayRows) {
            if (dRow.type === "data") {
              for (const effect of opts.effects) {
                const data = dRow.row.metadata[effect.data] as number[] | undefined;
                if (data && Array.isArray(data)) {
                  allValues.push(...data.filter(v => v != null && !Number.isNaN(v)));
                }
              }
            }
          }
          if (allValues.length > 0) {
            domainMin = domainMin ?? Math.min(...allValues);
            domainMax = domainMax ?? Math.max(...allValues);
            // Add padding for KDE tails
            const range = domainMax - domainMin;
            domainMin = domainMin - range * 0.1;
            domainMax = domainMax + range * 0.1;
          } else {
            domainMin = domainMin ?? 0;
            domainMax = domainMax ?? 100;
          }
        }

        const [zMin, zMax] = store.getEffectiveDomain(col.id, [domainMin, domainMax]);
        const scale = opts.scale === "log"
          ? scaleLog().domain([Math.max(0.01, zMin), zMax]).range([padding, vizWidth - padding])
          : scaleLinear().domain([zMin, zMax]).range([padding, vizWidth - padding]);
        scales.set(col.id, scale);
      }
    }

    return scales;
  });

  // Compute per-column scales for forest columns (to handle custom widths and dynamic resizing)
  const forestColumnScales = $derived.by(() => {
    const scales = new Map<string, ReturnType<typeof scaleLinear<number, number>> | ReturnType<typeof scaleLog<number, number>>>();
    // Use consistent padding for all viz column scales
    const forestPadding = VIZ_MARGIN;

    for (const fc of forestColumns) {
      const col = fc.column;
      const forestOpts = col.options?.forest;
      // Forest columns are layout-driven (lever ladder + theme defaults),
      // not content-measured — same priority order as `gridTemplateColumns`
      // and `getColWidth` (Phase 7E forest fix). Without this, the d3
      // scale's range stayed stuck at the header-min auto-width
      // (`columnWidthsSnapshot[col.id]`) when the aspect slider moved,
      // squishing circles + CI lines into the left half of a wider
      // viewBox. Manually resizing a column "fixed" it because that
      // mutated columnWidths and triggered a re-derivation that
      // happened to refresh the scale range too.
      const userResized = store.userResizedIds?.has?.(col.id) ?? false;
      const dynamicWidth = columnWidthsSnapshot[col.id];
      let colWidth: number;
      if (typeof col.width === "number") {
        colWidth = col.width;
      } else if (typeof forestOpts?.width === "number") {
        colWidth = forestOpts.width;
      } else if (userResized && typeof dynamicWidth === "number") {
        colWidth = dynamicWidth;
      } else {
        colWidth = layout.forestWidth;
      }
      const isLog = forestOpts?.scale === "log";

      // Use the global domain from axisComputation, then let any per-column
      // pan/zoom override replace it. Store the override on a 1:1 basis so
      // two forest columns with identical data can be inspected independently.
      const baseDomain = axisComputation.axisLimits as [number, number];
      const domain = store.getEffectiveDomain(col.id, baseDomain);
      const rangeStart = forestPadding;
      const rangeEnd = Math.max(colWidth - forestPadding, rangeStart + 50);

      if (isLog) {
        const safeDomain: [number, number] = [
          Math.max(domain[0], 0.01),
          Math.max(domain[1], 0.02),
        ];
        scales.set(col.id, scaleLog().domain(safeDomain).range([rangeStart, rangeEnd]));
      } else {
        scales.set(col.id, scaleLinear().domain(domain).range([rangeStart, rangeEnd]));
      }
    }

    return scales;
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
    // Live preview during drag — no op-log emission. Commit on pointerup.
    // Previously every pointermove recorded `resize_column(...)` which
    // spammed the recorder with dozens of entries for a single drag.
    store.previewColumnWidth(resizingColumn, newWidth);
  }

  function stopColumnResize(e: PointerEvent) {
    if (resizingColumn) {
      const delta = e.clientX - columnStartX;
      const newWidth = Math.max(40, columnStartWidth + delta);
      // One recorded `resize_column()` per drag gesture — the settled
      // width on release rather than every intermediate pixel.
      store.setColumnWidth(resizingColumn, newWidth);
    }
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

  // Cell-aware hover wrapper. Used by every cell mouseenter/leave handler so
  // paint-mode cell-scope preview can target a specific cell. Falls through
  // to handleRowHover/handleRowLeave for the row-level hover behavior.
  function handleCellEnter(rowId: string, field: string, event: MouseEvent) {
    handleRowHover(rowId, event);
    if (store.paintTool?.scope === "cell") {
      store.setPaintHoverCellField(`${rowId}:${field}`);
    }
  }
  function handleCellLeave() {
    handleRowLeave();
    store.setPaintHoverCellField(null);
  }

  /**
   * Paint-aware row / cell click handler. When the paint tool is active
   * with `scope = "row"`, clicking a row toggles the active semantic flag
   * on it instead of selecting it. Cell-scope paint routes through
   * `handleCellClick(row, field)` below.
   *
   * When no paint tool is active, falls through to the normal row-select
   * behavior so authoring mode is the opt-in branch.
   */
  // Click handler: always paint with the active token (row/cell scope).
  // Selection is unified with paint — clicking a row IS painting it with
  // whichever token is active in the toolbar TokenPicker.
  // Replace-if-different / toggle-if-same semantics live on the store
  // (paintRowWithActiveToken / paintCellWithActiveToken).
  function handleRowClick(row: { id: string }) {
    if (store.paintTool.scope !== "row") {
      // Painter is currently in cell scope; row clicks fall through to
      // cell-scope click via the cell handler. Don't do anything here.
      return;
    }
    store.paintRowWithActiveToken(row.id);
  }
  function handleCellClick(row: { id: string }, field: string) {
    if (store.paintTool.scope === "cell") {
      store.paintCellWithActiveToken(row.id, field);
    } else {
      // In row scope, a click on any cell paints the row.
      store.paintRowWithActiveToken(row.id);
    }
  }

  // Hover-preview helpers. These read store.paintTool / store.hoveredRowId /
  // store.paintHoverCellField via prop access (which the Svelte 5 compiler
  // preserves) so the bundle resolution sees the would-be token without
  // committing it. Must live in the instance script — module-script helpers
  // can't access the `store` prop.
  function paintRowPreviewToken(row: Row | null): string | null {
    const tool = store.paintTool;
    if (!row || !tool) return null;
    if (tool.scope !== "row") return null;
    if (store.hoveredRowId !== row.id) return null;
    return tool.token;
  }
  function paintCellPreviewToken(row: Row | null, field: string): string | null {
    const tool = store.paintTool;
    if (!row || !tool) return null;
    if (tool.scope !== "cell") return null;
    if (store.paintHoverCellField !== `${row.id}:${field}`) return null;
    return tool.token;
  }
  function getCellStyle(row: Row, column: ColumnSpec): CellStyle | undefined {
    const previewToken = paintCellPreviewToken(row, column.field);
    const baseStyle = getCellStyleBase(row, column);
    if (previewToken) {
      return { ...(baseStyle ?? {}), [previewToken]: true } as CellStyle;
    }
    return baseStyle;
  }

  // Cell-level semantic bundle. Resolves the bundle for whichever token
  // wins precedence on the cell's flags (data + painter + hover preview),
  // returning null if no token is active on the cell. Emitted onto the
  // cell via inline CSS vars so cell-scope painting actually renders —
  // without this the painter writes to styleEdits.cells but nothing
  // reaches the DOM.
  function getCellSemBundle(row: Row | null | undefined, column: ColumnSpec): SemanticBundle | null {
    if (!row || !theme) return null;
    const cellStyle = getCellStyle(row, column);
    return resolveSemanticBundle(cellStyle, theme);
  }
  // Effective viz color for inline visualizations (bars, sparklines).
  // Mirrors the marker cascade on the forest plot: cell-paint > row-paint
  // > component default. Reads `markerFill` off whichever semantic bundle
  // is active — that field is what the resolver populates with the
  // accent / muted / emphasis tone for the matching token. Tokens
  // without a markerFill (bold, fill) return null so the component falls
  // through to its own brand default.
  function effectiveVizColor(row: Row | null | undefined, column: ColumnSpec): string | null {
    if (!row || !theme) return null;
    const cellBundle = getCellSemBundle(row, column);
    if (cellBundle?.markerFill) return cellBundle.markerFill;
    if (!row.style) return null;
    const rowBundle = resolveSemanticBundle(row.style, theme);
    return rowBundle?.markerFill ?? null;
  }
  function getCellActiveToken(row: Row | null | undefined, column: ColumnSpec): string | null {
    if (!row) return null;
    return activeSemanticToken(getCellStyle(row, column));
  }
  // Compose the row-level inline `style=` string with cell-level bundle
  // overrides. Same CSS-var keys as the row-level emit; later writes win,
  // so cell paint shadows row paint when both are present.
  function getCellInlineCss(bundle: SemanticBundle | null, baseRowStyles: string): string {
    if (!bundle) return baseRowStyles;
    const parts: string[] = [];
    if (baseRowStyles) parts.push(baseRowStyles);
    if (bundle.fg != null)         parts.push(`--tv-semantic-fg: ${bundle.fg}`);
    if (bundle.fontWeight != null) parts.push(`--tv-semantic-weight: ${bundle.fontWeight}`);
    if (bundle.fontStyle != null)  parts.push(`--tv-semantic-style: ${bundle.fontStyle}`);
    if (bundle.border != null)     parts.push(`border-bottom: 1px solid ${bundle.border}`);
    return parts.join("; ");
  }

  // CSS variable style string (includes shared rendering constants for consistency)
  // Build the widget CSS variables. The portable theme-only portion is
  // produced by `buildThemeCSS()` in $lib/theme-css and cached by theme
  // identity; this `$derived` therefore only re-runs the cheap widget-
  // instance composition when layout/zoom changes while the theme is stable.
  // To inspect or export the resolved theme as CSS, call `getThemeCSS(theme)`
  // from `$lib/theme-css`.
  const cssVars = $derived(
    buildWidgetCSS(theme ?? null, {
      maxWidth: maxWidth ?? null,
      maxHeight: maxHeight ?? null,
      anyHeaderVisible,
      headerHeight: layout.headerHeight,
      headerDepth,
      effectiveHeaderDepth,
      axisHeight: layout.axisHeight,
      forestWidth: layout.forestWidth,
      actualScale,
      zoom,
    })
  );

</script>

<svelte:window onkeydown={handleKeydown} />

<div
  bind:this={containerRef}
  class="tabviz-container"
  class:auto-fit={autoFit}
  class:has-aspect-pin={store.targetAspect != null}
  class:has-max-width={maxWidth !== null}
  class:has-max-height={maxHeight !== null}
  class:zoomed={zoom !== 1.0}
  class:paint-active={!!store.paintTool}
  data-paint-scope={store.paintTool?.scope ?? undefined}
  data-paint-token={store.paintTool?.token ?? undefined}
  data-zoom="{Math.round(actualScale * 100)}%"
  style="{cssVars}; {autoFit && scaledHeight > 0 ? `height: ${scaledHeight + 2 * (theme?.spacing.containerPadding ?? 16) + (theme?.spacing.bottomMargin ?? 0)}px` : ''}"
>
  {#if spec}
    <!-- Control toolbar (always outside scalable so it doesn't scale with zoom) -->
    <ControlToolbar {store} {enableExport} {enableThemes} {onThemeChange} />

    <!-- Settings panel (slide-in from right; mounted alongside the toolbar so
         its absolute positioning is contained by the widget root). -->
    <SettingsPanel {store} />

    <!-- Scalable content wrapper (header + main + footer) -->
    <div bind:this={scalableRef} class="tabviz-scalable" style:margin-left="{centeringMargin}px">
      <!-- Plot header (title, subtitle) - only when there's a title/subtitle -->
      {#if hasPlotHeader}
        <PlotHeader
          title={labelTitle}
          subtitle={labelSubtitle}
          enableEdit={labelsEditable}
          onedit={(field, anchor) => store.startEdit({
            rowId: "",
            field: "",
            labelField: field,
            x: anchor.getBoundingClientRect().left,
            y: anchor.getBoundingClientRect().top,
          })}
          titleSubtitleGap={theme?.spacing.titleSubtitleGap ?? 13}
          onpreviewgap={(v) => store.previewThemeField("spacing", "titleSubtitleGap", v)}
          oncommitgap={(v) => store.setThemeField("spacing", "titleSubtitleGap", v)}
        />
      {/if}

      <!-- Snippet for rendering cell content based on column type -->
      {#snippet renderCellContent(rowArg: DataRow['row'], column: ColumnSpec)}
        {@const cellStyle = getCellStyle(rowArg, column)}
        {@const editedFields = store.cellEdits.cells[rowArg.id]}
        {@const metadata = editedFields ? { ...rowArg.metadata, ...editedFields } : rowArg.metadata}
        {@const row = editedFields ? { ...rowArg, metadata } : rowArg}
        {#if column.type === "bar"}
          <CellBar
            value={metadata[column.field] as number}
            maxValue={getMaxValueForColumn(visibleRows, column)}
            options={column.options?.bar}
            naText={column.options?.naText}
            colorOverride={effectiveVizColor(row, column)}
          />
        {:else if column.type === "pvalue"}
          <CellPvalue
            value={metadata[column.field] as number}
            options={column.options?.pvalue}
            naText={column.options?.naText}
            {cellStyle}
          />
        {:else if column.type === "sparkline"}
          <CellSparkline
            data={metadata[column.field] as number[]}
            options={column.options?.sparkline}
            naText={column.options?.naText}
            colorOverride={effectiveVizColor(row, column)}
          />
        {:else if column.type === "icon"}
          <CellIcon
            value={metadata[column.field]}
            options={column.options?.icon}
            naText={column.options?.naText}
          />
        {:else if column.type === "badge"}
          <CellBadge
            value={metadata[column.field]}
            options={column.options?.badge}
            naText={column.options?.naText}
            {cellStyle}
            colorOverride={effectiveVizColor(rowArg, column)}
          />
        {:else if column.type === "stars"}
          <CellStars
            value={metadata[column.field] as number}
            options={column.options?.stars}
            naText={column.options?.naText}
          />
        {:else if column.type === "pictogram"}
          <CellPictogram
            value={metadata[column.field] as number}
            options={column.options?.pictogram}
            naText={column.options?.naText}
            {cellStyle}
            colorOverride={effectiveVizColor(rowArg, column)}
            glyphSelector={column.options?.pictogram?.glyphField
              ? metadata[column.options.pictogram.glyphField] as string
              : null}
          />
        {:else if column.type === "ring"}
          <CellRing
            value={metadata[column.field] as number}
            options={column.options?.ring}
            naText={column.options?.naText}
            {cellStyle}
            colorOverride={effectiveVizColor(rowArg, column)}
          />
        {:else if column.type === "img"}
          <CellImg
            value={metadata[column.field] as string}
            options={column.options?.img}
            naText={column.options?.naText}
          />
        {:else if column.type === "reference"}
          <CellReference
            value={metadata[column.field] as string}
            metadata={metadata}
            options={column.options?.reference}
            naText={column.options?.naText}
          />
        {:else if column.type === "range"}
          <CellRange
            value={metadata[column.field]}
            metadata={metadata}
            options={column.options?.range}
            naText={column.options?.naText}
          />
        {:else if column.type === "heatmap"}
          <CellHeatmap
            value={metadata[column.field] as number}
            options={column.options?.heatmap}
            minValue={getMinValueForColumn(visibleRows, column)}
            maxValue={getMaxValueForColumn(visibleRows, column)}
            naText={column.options?.naText}
            {theme}
          />
        {:else if column.type === "progress"}
          <CellProgress
            value={metadata[column.field] as number}
            options={column.options?.progress}
            naText={column.options?.naText}
            colorOverride={effectiveVizColor(row, column)}
          />
        {:else if column.type === "numeric"}
          <CellContent value={formatNumber(metadata[column.field] as number, column.options)} {cellStyle} />
        {:else if column.type === "custom" && column.options?.events}
          <CellContent value={formatEvents(row, column.options)} {cellStyle} />
        {:else if column.type === "interval"}
          <CellContent value={formatInterval(
            column.options?.interval?.point ? metadata[column.options.interval.point] as number : undefined,
            column.options?.interval?.lower ? metadata[column.options.interval.lower] as number : undefined,
            column.options?.interval?.upper ? metadata[column.options.interval.upper] as number : undefined,
            column.options
          )} {cellStyle} />
        {:else}
          {@const rawText = String(metadata[column.field] ?? "")}
          {@const maxChars = column.type === "text" ? column.options?.text?.maxChars : null}
          {@const displayText = maxChars ? truncateString(rawText, maxChars) : rawText}
          <CellContent value={displayText} title={rawText} {cellStyle} />
        {/if}
      {/snippet}

      <!-- CSS Grid layout: columns in order (leftmost = primary) -->
      <div
        class="tabviz-main"
        style:grid-template-columns={gridTemplateColumns}
        style:grid-template-rows={gridTemplateRows}
      >
        {#if spec?.watermark}
          <Watermark
            text={spec.watermark}
            color={spec.watermarkColor}
            opacity={spec.watermarkOpacity}
            {theme}
          />
        {/if}
        <!-- Header cells (supports hierarchical column groups).
             Skipped entirely when no column's header is visible. -->
        {#if anyHeaderVisible}
        {#each headerCells as cell (cell.col.id)}
          {#if cell.isGroupHeader}
            <!-- Group header. dblclick toggles rename when editing is on; no
                 keyboard parity because the edit path is also exposed via the
                 right-click context menu on the primary cell. -->
            <!-- svelte-ignore a11y_no_static_element_interactions -->
            <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
            <div
              class="grid-cell header-cell column-group-header"
              class:editable={spec?.interaction.enableEdit}
              role={spec?.interaction.enableEdit ? "button" : undefined}
              tabindex={spec?.interaction.enableEdit ? 0 : undefined}
              data-header-id={cell.col.id}
              style:grid-column="{cell.gridColumnStart} / span {cell.colspan}"
              style:grid-row="{cell.rowStart} / span {cell.rowSpan}"
              ondblclick={spec?.interaction.enableEdit
                ? () => store.startEdit({ rowId: "", field: "", groupId: cell.col.id })
                : undefined}
              onkeydown={spec?.interaction.enableEdit ? (e) => {
                if (e.key === "Enter" || e.key === "F2") {
                  e.preventDefault();
                  store.startEdit({ rowId: "", field: "", groupId: cell.col.id });
                }
              } : undefined}
            >
              {#if spec?.interaction.enableReorderColumns}
                <ColumnDragHandle {store} kind="column_group" id={cell.col.id} root={containerRef} />
              {/if}
              <span class="header-text">{store.cellEdits.groups[cell.col.id] ?? cell.col.header}</span>
            </div>
          {:else if cell.isForest}
            <!-- Viz column header (forest, bar, boxplot, violin) -->
            {@const column = cell.col as ColumnSpec}
            {@const vizDefaultWidth = column.type === "forest"
              ? (column.options?.forest?.width ?? layout.forestWidth)
              : (typeof column.width === "number" ? column.width : layout.forestWidth)}
            {@const canSortViz = !!spec?.interaction.enableSort && column.sortable !== false}
            {@const vizSortDir = store.sortConfig?.column === column.field ? store.sortConfig.direction : "none"}
            <!-- svelte-ignore a11y_no_static_element_interactions -->
            <!-- svelte-ignore a11y_click_events_have_key_events -->
            <div
              use:forestColumnRef={column.id}
              class="grid-cell header-cell plot-header"
              class:sortable={canSortViz}
              data-header-id={column.id}
              style:grid-column="{cell.gridColumnStart}"
              style:grid-row="{cell.rowStart} / span {cell.rowSpan}"
              style:text-align={column.headerAlign ?? column.align}
              oncontextmenu={(e) => overlays?.openHeaderContextMenu(column, e)}
              onclick={canSortViz ? (e) => {
                const target = e.target as HTMLElement;
                if (target.closest('.resize-handle') || target.closest('.drag-handle')) return;
                store.toggleSort(column.field);
              } : undefined}
            >
              {#if spec?.interaction.enableReorderColumns}
                <ColumnDragHandle {store} kind="column" id={column.id} root={containerRef} />
              {/if}
              {#if resolveShowHeader(column.showHeader, column.header)}
                <span class="header-text">{column.header}</span>
              {/if}
              {#if canSortViz && vizSortDir !== "none"}
                <SortIndicator direction={vizSortDir} />
              {/if}
              {#if spec?.interaction.enableResize}
                <!-- svelte-ignore a11y_no_static_element_interactions -->
                <div
                  class="resize-handle"
                  onpointerdown={(e) => startColumnResize(e, column.id, effectiveColumnWidth(column))}
                ></div>
              {/if}
            </div>
          {:else}
            <!-- Leaf column header -->
            {@const column = cell.col as ColumnSpec}
            {@const canSort = !!spec?.interaction.enableSort && column.sortable}
            {@const sortDir = store.sortConfig?.column === column.field ? store.sortConfig.direction : "none"}
            {@const isPrimaryHeader = column.id === primaryColumnId}
            <!-- svelte-ignore a11y_no_static_element_interactions -->
            <!-- svelte-ignore a11y_click_events_have_key_events -->
            <div
              use:primaryHeaderRef={isPrimaryHeader}
              class="grid-cell header-cell"
              class:sortable={canSort}
              class:primary-header={isPrimaryHeader}
              class:wrap-enabled={column.wrap}
              data-header-id={column.id}
              style:grid-column="{cell.gridColumnStart}"
              style:grid-row="{cell.rowStart} / span {cell.rowSpan}"
              style:text-align={column.headerAlign ?? column.align}
              oncontextmenu={(e) => overlays?.openHeaderContextMenu(column, e)}
              onclick={canSort ? (e) => {
                const target = e.target as HTMLElement;
                if (target.closest('.resize-handle') || target.closest('.drag-handle')) return;
                store.toggleSort(column.field);
              } : undefined}
            >
              {#if spec?.interaction.enableReorderColumns}
                <ColumnDragHandle {store} kind="column" id={column.id} root={containerRef} />
              {/if}
              {#if resolveShowHeader(column.showHeader, column.header)}
                <span class="header-text">{column.header}</span>
              {/if}
              {#if canSort && sortDir !== "none"}
                <SortIndicator direction={sortDir} />
              {/if}
              {#if (spec?.interaction.enableFilters || spec?.interaction.showFilters) && !vizColumnTypes.includes(column.type)}
                <ColumnFilterButton {store} field={column.field} header={column.header} />
              {/if}
              {#if spec?.interaction.enableResize}
                <!-- svelte-ignore a11y_no_static_element_interactions -->
                <div
                  class="resize-handle"
                  onpointerdown={(e) => startColumnResize(e, column.id, effectiveColumnWidth(column))}
                ></div>
              {/if}
            </div>
          {/if}
        {/each}
        {/if}

        <!-- Data rows -->
        {#each displayRows as displayRow, i (getDisplayRowKey(displayRow, i))}
          {@const isGroupHeader = displayRow.type === "group_header"}
          {@const row = isGroupHeader ? null : displayRow.row}
          {@const rowDepth = displayRow.depth}
          <!--
            Paint-mode hover preview. When the paint tool is in row scope
            and this row is hovered, mix the active token into the row's
            style for the bundle / class / styles derivations below — the
            renderer produces the would-be visual without committing the
            flag. Cell-scope preview is handled separately at cell level
            via getCellStyle().

            INLINED (was paintRowPreviewToken(row) function call): Svelte 5
            $derived dynamic-tracks reads inside expressions, but function
            calls into the instance script have a history of opaque deps
            in this codebase (see feedback_svelte5_closure.md — closure
            captures don't always rewrite). Inlining the reactive reads
            ensures the @const re-evaluates whenever store.paintTool or
            store.hoveredRowId changes — fixes "preview stuck on muted
            regardless of selected token" where the @const was caching a
            stale tool.token.
          -->
          {@const rowPreviewToken = (row && store.paintTool.scope === "row" && store.hoveredRowId === row.id) ? store.paintTool.token : null}
          {@const effectiveRowStyle = row?.style && rowPreviewToken
            ? ({ ...row.style, [rowPreviewToken]: true } as typeof row.style)
            : row?.style}
          {@const rowClasses = row ? getRowClasses(effectiveRowStyle, bandIndexes[i]) : (bandIndexes[i] === 1 ? "row-odd" : "")}
          {@const semBundle = row && theme ? resolveSemanticBundle(effectiveRowStyle, theme) : null}
          {@const rowStyles = row ? getRowStyles(effectiveRowStyle, rowDepth, semBundle) : ""}
          {@const isSpacerRow = row?.style?.type === "spacer"}
          {@const gridRow = effectiveHeaderDepth + 1 + i}
          {@const groupTier = isGroupHeader && theme
            ? (rowDepth === 0 ? theme.rowGroup.L1
               : rowDepth === 1 ? theme.rowGroup.L2
               : theme.rowGroup.L3)
            : null}
          <!--
            Group header background. When banding is already painting THIS
            row (bandIndexes[i] !== null — banding cycles at this group's
            depth), the band owns the bg and we skip the explicit L1.bg
            paint. Without that guard, every default-themed table double-
            paints: banding cycle + group_tier.bg stack on the same row,
            and the L1 bar feels redundant against the banded cycle. When
            banding isn't covering this row, the explicit groupTier.bg
            wins (panel edits stay visible), with a derived tint as the
            final fallback.
          -->
          {@const groupBg = isGroupHeader
            ? (bandIndexes[i] != null
                ? undefined
                : (groupTier?.bg ?? getGroupBackground(rowDepth + 1, theme)))
            : undefined}
          {@const groupLevelBorder = isGroupHeader && theme
            ? (rowDepth + 1 === 1
                ? theme.rowGroup.L1.borderBottom
                : rowDepth + 1 === 2
                  ? theme.rowGroup.L2.borderBottom
                  : theme.rowGroup.L3.borderBottom)
            : false}
          <!--
            Single effective background precedence: per-row inline bg > group
            header tint > semantic-bundle bg. Packed into one derived value so
            the later `style:background-color={effectiveBg}` doesn't clobber
            `style={rowStyles}` when undefined — Svelte's `style:` directive
            sets/removes the property independently of the style string, so
            emitting `undefined` here would wipe any bg set via rowStyles.
          -->
          {@const effectiveBg = row?.style?.bg ?? groupBg ?? semBundle?.bg ?? undefined}

          {@const isDragSource = !!(store.dragState?.active && (
            (store.dragState.kind === "row" && !isGroupHeader && row && store.dragState.id === row.id) ||
            (store.dragState.kind === "row_group" && isGroupHeader && store.dragState.id === displayRow.group.id)
          ))}
          {@const justDropped = !!recentlyDroppedId && (
            (!isGroupHeader && row && recentlyDroppedId === row.id) ||
            (isGroupHeader && recentlyDroppedId === displayRow.group.id)
          )}

          <!-- Column cells: all columns in order. The leftmost (primary) column
               doubles as the drag surface for whole-row reorder and carries the
               group-header / icon / badge chrome. -->
          {#each allColumns as column (column.id)}
            {@const isPrimary = column.id === primaryColumnId}
            <!-- Cell-level semantic bundle. Computed per-cell so cell-scope
                 painting + per-cell hover preview actually flow into the DOM.
                 The vars override the row-level CSS vars (later wins under
                 inline-style merge), so a row-painted+cell-painted combo
                 shows the cell's token. -->
            {@const cellSemBundle = row ? getCellSemBundle(row, column) : null}
            {@const cellActiveTok = row ? getCellActiveToken(row, column) : null}
            {@const cellSemCss    = getCellInlineCss(cellSemBundle, rowStyles)}
            {@const cellSemBg     = cellSemBundle?.bg ?? null}
            {#if isPrimary}
              <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
              <div
                class={`grid-cell data-cell primary-cell ${rowClasses}${cellActiveTok ? ` cell-active-${cellActiveTok}` : ""}`}
                class:group-row={isGroupHeader}
                class:row-padded-after={!isGroupHeader && rowPaddedAfter[i]}
                class:group-row-bordered={groupLevelBorder}
                class:spacer-row={isSpacerRow}
                class:reorderable={spec?.interaction.enableReorderRows}
                class:drag-source={isDragSource}
                class:just-dropped={justDropped}
                class:paint-preview={!!rowPreviewToken || (!!row && !!paintCellPreviewToken(row, column.field))}
                data-display-index={i}
                data-row-id={row ? row.id : undefined}
                data-field={row ? column.field : undefined}
                style:grid-row={gridRow}
                style:background-color={cellSemBg ?? effectiveBg}
                style:padding-left={(() => {
                  // Indent per nesting level — sourced from
                  // `theme.rowGroup.indentPerLevel` (default 16) so the
                  // live widget matches the SVG exporter's depth indent.
                  // Was hardcoded `* 12` here, which silently disagreed with
                  // the export when authors raised the theme value.
                  const indentPx = theme?.rowGroup?.indentPerLevel ?? 16;
                  if (isGroupHeader) return `${rowDepth * indentPx}px`;
                  const lvl = row?.style?.indent ?? rowDepth;
                  return lvl ? `${lvl * indentPx}px` : undefined;
                })()}
                style={cellSemCss || undefined}
                role={isGroupHeader ? "button" : undefined}
                tabindex={isGroupHeader ? 0 : undefined}
                onpointerdown={spec?.interaction.enableReorderRows ? (e) => {
                  if (isGroupHeader) startRowPointerDown(e, "row_group", displayRow.group.id, displayRow.group.parentId ?? "__root__");
                  else if (row) startRowPointerDown(e, "row", row.id, row.groupId ?? "__root__");
                } : undefined}
                onclick={isGroupHeader ? () => store.toggleGroup(displayRow.group.id) : row ? () => handleCellClick(row, column.field) : undefined}
                ondblclick={!isGroupHeader && row && spec?.interaction.enableEdit && isEditableColumn(column) ? () => store.startEdit({ rowId: row.id, field: column.field }) : undefined}
                onkeydown={isGroupHeader ? (e) => (e.key === "Enter" || e.key === " ") && store.toggleGroup(displayRow.group.id) : undefined}
                onmouseenter={row ? (e) => handleCellEnter(row.id, column.field, e) : undefined}
                onmouseleave={row ? () => handleCellLeave() : undefined}
              >
                {#if isGroupHeader}
                  <GroupHeader
                    group={displayRow.group}
                    rowCount={spec?.interaction.showGroupCounts ? displayRow.rowCount : undefined}
                    level={displayRow.depth + 1}
                    {theme}
                  />
                {:else if row}
                  {#if row.style?.icon}<span class="row-icon">{row.style.icon}</span>{/if}
                  {@render renderCellContent(row, column)}
                  {#if row.style?.badge}<span class="row-badge">{row.style.badge}</span>{/if}
                {/if}
              </div>
            {:else if vizColumnTypes.includes(column.type)}
              <!-- Viz cell (empty - SVG overlays this). Click/hover are row-
                   level affordances; the primary-cell owns keyboard selection
                   for the row, so this cell is presentational. -->
              <!-- svelte-ignore a11y_no_static_element_interactions -->
              <!-- svelte-ignore a11y_click_events_have_key_events -->
              <div
                class={`grid-cell data-cell plot-cell ${rowClasses}${cellActiveTok ? ` cell-active-${cellActiveTok}` : ""}`}
                class:group-row={isGroupHeader}
                class:row-padded-after={!isGroupHeader && rowPaddedAfter[i]}
                class:group-row-bordered={groupLevelBorder}
                class:spacer-row={isSpacerRow}
                class:paint-preview={!!rowPreviewToken || (!!row && !!paintCellPreviewToken(row, column.field))}
                role="presentation"
                style:grid-row={gridRow}
                style:background-color={cellSemBg ?? effectiveBg}
                style={cellSemCss || undefined}
                onmouseenter={row ? (e) => handleCellEnter(row.id, column.field, e) : undefined}
                onmouseleave={row ? () => handleCellLeave() : undefined}
                onclick={row ? () => handleCellClick(row, column.field) : undefined}
              ></div>
            {:else}
              <!-- Regular column cell. Click/hover are row-level affordances;
                   the primary-cell owns keyboard selection for the row, so
                   this cell is presentational. dblclick-to-edit has no
                   keyboard parity — the edit flow is also exposed via the
                   context menu on the primary cell. -->
              {@const editableHere = !!(row && spec?.interaction.enableEdit && !isGroupHeader && isEditableColumn(column))}
              {@const cellBg = row ? (getCellStyle(row, column)?.bg ?? null) : null}
              <!-- svelte-ignore a11y_no_static_element_interactions -->
              <!-- svelte-ignore a11y_click_events_have_key_events -->
              <div
                class={`grid-cell data-cell ${rowClasses}${cellActiveTok ? ` cell-active-${cellActiveTok}` : ""}`}
                class:group-row={isGroupHeader}
                class:row-padded-after={!isGroupHeader && rowPaddedAfter[i]}
                class:group-row-bordered={groupLevelBorder}
                class:spacer-row={isSpacerRow}
                class:wrap-enabled={column.wrap}
                class:editable={editableHere}
                class:paint-preview={!!rowPreviewToken || (!!row && !!paintCellPreviewToken(row, column.field))}
                role="presentation"
                data-row-id={row ? row.id : undefined}
                data-field={column.field}
                style:grid-row={gridRow}
                style:background-color={cellBg ?? cellSemBg ?? effectiveBg}
                style:text-align={column.align}
                style:justify-content={column.align === "center" ? "center" : column.align === "right" ? "flex-end" : "flex-start"}
                style={cellSemCss || undefined}
                onmouseenter={row ? (e) => handleCellEnter(row.id, column.field, e) : undefined}
                onmouseleave={row ? () => handleCellLeave() : undefined}
                onclick={row ? () => handleCellClick(row, column.field) : undefined}
                ondblclick={editableHere && row ? () => store.startEdit({ rowId: row.id, field: column.field }) : undefined}
              >
                {#if row}
                  {@render renderCellContent(row, column)}
                {/if}
              </div>
            {/if}
          {/each}
        {/each}

        <!-- Axis row: one axis cell per viz column -->
        {#if hasVizColumns}
          {@const axisRowNum = effectiveHeaderDepth + 1 + displayRows.length}
          {#each allColumns as column, idx (column.id)}
            {#if vizColumnTypes.includes(column.type)}
              <div class="grid-cell axis-cell" style:grid-column={1 + idx} style:grid-row={axisRowNum}></div>
            {:else}
              <div class="grid-cell axis-spacer" style:grid-column={1 + idx} style:grid-row={axisRowNum}></div>
            {/if}
          {/each}
        {/if}

        <!-- SVG overlays: one per forest column -->
        {#each forestColumns as fc (fc.column.id)}
          {@const forestOpts = fc.column.options?.forest}
          {@const dynamicForestWidth = columnWidthsSnapshot[fc.column.id]}
          {@const forestUserResized = store.userResizedIds?.has?.(fc.column.id) ?? false}
          {@const forestWidth = typeof fc.column.width === "number"
            ? fc.column.width
            : (typeof forestOpts?.width === "number"
              ? forestOpts.width
              : (forestUserResized && typeof dynamicForestWidth === "number"
                ? dynamicForestWidth
                : layout.forestWidth))}
          {@const forestLeft = forestColumnPositions.get(fc.column.id) ?? 0}
          {@const axisGap = theme?.spacing.axisGap ?? TEXT_MEASUREMENT.DEFAULT_AXIS_GAP}
          {@const nullValue = forestOpts?.nullValue ?? layout.nullValue}
          {@const axisLabel = forestOpts?.axisLabel ?? "Effect"}
          {@const isLog = forestOpts?.scale === "log"}
          {@const colScale = forestColumnScales.get(fc.column.id) ?? xScale}
          {@const fcClipId = `viz-clip-${instanceId}-${fc.column.id}`}
          <svg
            class="plot-overlay"
            width={forestWidth}
            height={rowsAreaHeight + layout.axisHeight}
            viewBox="0 0 {forestWidth} {rowsAreaHeight + layout.axisHeight}"
            style:top="{actualHeaderHeight}px"
            style:left="{forestLeft}px"
            use:zoomable={{
              columnId: fc.column.id,
              isLog,
              getDomain: () => colScale.domain() as [number, number],
              getPixelRange: () => [VIZ_MARGIN, Math.max(forestWidth - VIZ_MARGIN, VIZ_MARGIN + 50)],
              onChange: (d) => store.setAxisZoom(fc.column.id, d),
              onReset: () => store.resetAxisZoom(fc.column.id),
              enabled: true,
            }}
          >
            <defs>
              <clipPath id={fcClipId}>
                <rect x={VIZ_MARGIN} y={0} width={Math.max(forestWidth - 2 * VIZ_MARGIN, 0)} height={rowsAreaHeight} />
              </clipPath>
            </defs>
            <g clip-path="url(#{fcClipId})">
            <!-- Null value reference line -->
            <line
              x1={colScale(nullValue)}
              x2={colScale(nullValue)}
              y1={0}
              y2={rowsAreaHeight}
              stroke="var(--tv-muted)"
              stroke-width="1"
              stroke-dasharray="4,4"
            />

            <!-- Custom annotations (reference lines) - column-level only -->
            {#if true}
              {@const allAnnotations = forestOpts?.annotations ?? []}
              {@const annotationLabelOffsets = computeAnnotationLabelOffsets(allAnnotations)}
              {#each allAnnotations as annotation (annotation.id)}
              {#if annotation.type === "reference_line"}
                <line
                  x1={colScale(annotation.x)}
                  x2={colScale(annotation.x)}
                  y1={0}
                  y2={rowsAreaHeight}
                  stroke={annotation.color ?? "var(--tv-divider-strong, var(--tv-border))"}
                  stroke-width={annotation.width ?? 1.5}
                  stroke-opacity={annotation.opacity ?? 0.6}
                  stroke-dasharray={annotation.style === "dashed" ? "6,4" : annotation.style === "dotted" ? "2,2" : ""}
                />
                {#if annotation.label}
                  {@const yOffset = annotationLabelOffsets[annotation.id] ?? 0}
                  {@const annoTypo = { fontSizeSm: theme!.text.label.size, lineHeight: 1.5 }}
                  {@const annoAxisGeom = computeAxisLayout(annoTypo, !!forestOpts?.axisLabel, theme!.plot.tickMarkLength)}
                  {@const annoLabelBaseline = annoAxisGeom.axisRegionHeight + textRegionHeight(theme!.text.label.size, 1.5) - 4}
                  <text
                    x={colScale(annotation.x)}
                    y={rowsAreaHeight + axisGap + annoLabelBaseline + yOffset}
                    text-anchor="middle"
                    fill={annotation.color ?? "var(--tv-text-muted)"}
                    font-size="var(--tv-font-size-sm)"
                    font-weight="500"
                  >
                    {annotation.label}
                  </text>
                {/if}
              {/if}
              {/each}
            {/if}

            <!-- Custom annotations: per-row glyphs (forest_annotation()) -->
            {#if forestOpts?.annotations && forestOpts.annotations.length > 0}
              {@const customAnns = forestOpts.annotations.filter(a => a.type === "custom") as Array<Extract<Annotation, {type: "custom"}>>}
              {@const pointCol = forestOpts.point ?? forestOpts.effects?.[0]?.pointCol ?? null}
              {#each customAnns as customAnn (customAnn.id)}
                {#each displayRows as displayRow, ri (getDisplayRowKey(displayRow, ri))}
                  {#if displayRow.type === "data" && pointCol && (displayRow.row.label === customAnn.rowId || displayRow.row.id === customAnn.rowId)}
                    {@const ptVal = displayRow.row.metadata[pointCol]}
                    {#if typeof ptVal === "number" && !Number.isNaN(ptVal)}
                      {@const annRowY = (rowLayout.positions[ri] ?? ri * layout.rowHeight) + (rowLayout.heights[ri] ?? layout.rowHeight) / 2}
                      {@const markerX = colScale(ptVal)}
                      {@const offset = customAnn.position === "before" ? -14 : customAnn.position === "after" ? 14 : 0}
                      {@const annX = markerX + offset}
                      {@const sz = 5 * (customAnn.size ?? 1)}
                      {#if customAnn.shape === "circle"}
                        <circle cx={annX} cy={annRowY} r={sz} fill={customAnn.color} stroke="white" stroke-width="0.5" />
                      {:else if customAnn.shape === "square"}
                        <rect x={annX - sz} y={annRowY - sz} width={2*sz} height={2*sz} fill={customAnn.color} stroke="white" stroke-width="0.5" />
                      {:else if customAnn.shape === "triangle"}
                        <polygon points={`${annX},${annRowY - sz} ${annX - sz},${annRowY + sz} ${annX + sz},${annRowY + sz}`} fill={customAnn.color} stroke="white" stroke-width="0.5" />
                      {:else if customAnn.shape === "star"}
                        <polygon points={(() => { const pts=[]; for(let k=0;k<10;k++){const r=k%2===0?sz*1.2:sz*0.5; const a=Math.PI/2 + k*Math.PI/5; pts.push(`${annX + r*Math.cos(a)},${annRowY - r*Math.sin(a)}`);} return pts.join(" "); })()} fill={customAnn.color} stroke="white" stroke-width="0.5" />
                      {/if}
                    {/if}
                  {/if}
                {/each}
              {/each}
            {/if}

            <!-- Row intervals (markers) -->
            {#each displayRows as displayRow, i (getDisplayRowKey(displayRow, i))}
              {#if displayRow.type === "data"}
                {@const rowY = rowLayout.positions[i] ?? i * layout.rowHeight}
                {@const rowH = rowLayout.heights[i] ?? layout.rowHeight}
                {@const vizCellStyle = getCellStyle(displayRow.row, fc.column)}
                <RowInterval
                  row={displayRow.row}
                  yPosition={rowY + rowH / 2}
                  xScale={colScale}
                  layout={{...layout, forestWidth: forestWidth}}
                  {theme}
                  clipBounds={colScale.domain() as [number, number]}
                  {isLog}
                  weightCol={spec.data.weightCol}
                  forestColumnOptions={forestOpts}
                  cellStyle={vizCellStyle ?? null}
                  onRowClick={() => {
                    // Marker click in cell scope paints the viz cell so
                    // clicking the diamond and clicking the cell behave
                    // consistently. Row scope keeps the existing
                    // row-paint behavior.
                    if (store.paintTool.scope === "cell") {
                      handleCellClick(displayRow.row, fc.column.field);
                    } else {
                      handleRowClick(displayRow.row);
                    }
                  }}
                  onRowHover={(hovered, event) => {
                    store.setHovered(hovered ? displayRow.row.id : null);
                    if (hovered && event) {
                      store.setTooltip(displayRow.row.id, { x: event.clientX, y: event.clientY });
                    } else {
                      store.setTooltip(null, null);
                    }
                    // Cell-scope paint preview: hovering the marker should
                    // show the would-be cell paint on the marker (parity
                    // with hovering the cell DOM elsewhere in the row).
                    if (store.paintTool.scope === "cell") {
                      store.setPaintHoverCellField(
                        hovered ? `${displayRow.row.id}:${fc.column.field}` : null
                      );
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
                xScale={colScale}
                layout={{...layout, forestWidth: forestWidth}}
                {theme}
              />
            {/if}
            </g>

            <!-- Axis at bottom (not clipped; ticks reflect zoom via colScale) -->
            {#if forestOpts?.showAxis !== false}
              <g transform="translate(0, {rowsAreaHeight + axisGap})">
                <EffectAxis xScale={colScale} layout={{...layout, forestWidth: forestWidth}} {theme} axisLabel={axisLabel} position="bottom" plotHeight={layout.plotHeight} baseTicks={store.getAxisZoom(fc.column.id) ? undefined : axisComputation.ticks} />
              </g>
            {/if}
          </svg>
        {/each}

        <!-- SVG overlays: viz_bar columns -->
        {#each vizColumns.filter(vc => vc.column.type === "viz_bar") as vc (vc.column.id)}
          {@const vizOpts = vc.column.options?.vizBar}
          {@const vizWidth = effectiveVizWidth(vc.column)}
          {@const vizLeft = forestColumnPositions.get(vc.column.id) ?? 0}
          {@const axisGap = theme?.spacing.axisGap ?? TEXT_MEASUREMENT.DEFAULT_AXIS_GAP}
          {@const sharedScale = vizColumnScales.get(vc.column.id)}
          {@const vcClipId = `viz-clip-${instanceId}-${vc.column.id}`}
          {@const vcIsLog = vizOpts?.scale === "log"}
          {#if vizOpts}
            <svg
              class="plot-overlay"
              width={vizWidth}
              height={rowsAreaHeight + layout.axisHeight}
              viewBox="0 0 {vizWidth} {rowsAreaHeight + layout.axisHeight}"
              style:top="{actualHeaderHeight}px"
              style:left="{vizLeft}px"
              use:zoomable={{
                columnId: vc.column.id,
                isLog: vcIsLog,
                getDomain: () => (sharedScale ? (sharedScale.domain() as [number, number]) : [0, 1]),
                getPixelRange: () => [VIZ_MARGIN, Math.max(vizWidth - VIZ_MARGIN, VIZ_MARGIN + 50)],
                onChange: (d) => store.setAxisZoom(vc.column.id, d),
                onReset: () => store.resetAxisZoom(vc.column.id),
                enabled: !!sharedScale,
              }}
            >
              <defs>
                <clipPath id={vcClipId}>
                  <rect x={VIZ_MARGIN} y={0} width={Math.max(vizWidth - 2 * VIZ_MARGIN, 0)} height={rowsAreaHeight} />
                </clipPath>
              </defs>
              <g clip-path="url(#{vcClipId})">
              <!-- Reference-line annotations (drawn behind bars) -->
              {#if sharedScale}
                {@const vcAnnotations = vizOpts.annotations ?? []}
                {#each vcAnnotations as annotation (annotation.id)}
                  {#if annotation.type === "reference_line"}
                    <line
                      x1={sharedScale(annotation.x)}
                      x2={sharedScale(annotation.x)}
                      y1={0}
                      y2={rowsAreaHeight}
                      stroke={annotation.color ?? "var(--tv-divider-strong, var(--tv-border))"}
                      stroke-width={annotation.width ?? 1}
                      stroke-opacity={annotation.opacity ?? 0.6}
                      stroke-dasharray={annotation.style === "dashed" ? "4,4" : annotation.style === "dotted" ? "2,2" : ""}
                    />
                  {/if}
                {/each}
              {/if}
              <!-- Bar charts for each row -->
              {#each displayRows as displayRow, i (getDisplayRowKey(displayRow, i))}
                {#if displayRow.type === "data"}
                  {@const rowY = rowLayout.positions[i] ?? i * layout.rowHeight}
                  {@const rowH = rowLayout.heights[i] ?? layout.rowHeight}
                  <VizBar
                    row={displayRow.row}
                    yPosition={rowY + rowH / 2}
                    rowHeight={rowH}
                    width={vizWidth}
                    options={vizOpts}
                    {theme}
                    {sharedScale}
                  />
                {/if}
              {/each}
              </g>

              <!-- Axis at bottom (unclipped; ticks reflect current domain) -->
              {#if vizOpts.showAxis !== false && sharedScale}
                <g transform="translate(0, {rowsAreaHeight + axisGap})">
                  <EffectAxis
                    xScale={sharedScale}
                    layout={{ ...layout, forestWidth: vizWidth, nullValue: 0 }}
                    {theme}
                    axisLabel={vizOpts.axisLabel ?? "Value"}
                    position="bottom"
                    plotHeight={rowsAreaHeight}
                    baseTicks={store.getAxisZoom(vc.column.id) ? undefined : (vizOpts.axisTicks ?? undefined)}
                    gridlines={vizOpts.axisGridlines}
                  />
                </g>
              {/if}
            </svg>
          {/if}
        {/each}

        <!-- SVG overlays: viz_boxplot columns -->
        {#each vizColumns.filter(vc => vc.column.type === "viz_boxplot") as vc (vc.column.id)}
          {@const vizOpts = vc.column.options?.vizBoxplot}
          {@const vizWidth = effectiveVizWidth(vc.column)}
          {@const vizLeft = forestColumnPositions.get(vc.column.id) ?? 0}
          {@const axisGap = theme?.spacing.axisGap ?? TEXT_MEASUREMENT.DEFAULT_AXIS_GAP}
          {@const sharedScale = vizColumnScales.get(vc.column.id)}
          {@const vcClipId = `viz-clip-${instanceId}-${vc.column.id}`}
          {@const vcIsLog = vizOpts?.scale === "log"}
          {#if vizOpts}
            <svg
              class="plot-overlay"
              width={vizWidth}
              height={rowsAreaHeight + layout.axisHeight}
              viewBox="0 0 {vizWidth} {rowsAreaHeight + layout.axisHeight}"
              style:top="{actualHeaderHeight}px"
              style:left="{vizLeft}px"
              use:zoomable={{
                columnId: vc.column.id,
                isLog: vcIsLog,
                getDomain: () => (sharedScale ? (sharedScale.domain() as [number, number]) : [0, 1]),
                getPixelRange: () => [VIZ_MARGIN, Math.max(vizWidth - VIZ_MARGIN, VIZ_MARGIN + 50)],
                onChange: (d) => store.setAxisZoom(vc.column.id, d),
                onReset: () => store.resetAxisZoom(vc.column.id),
                enabled: !!sharedScale,
              }}
            >
              <defs>
                <clipPath id={vcClipId}>
                  <rect x={VIZ_MARGIN} y={0} width={Math.max(vizWidth - 2 * VIZ_MARGIN, 0)} height={rowsAreaHeight} />
                </clipPath>
              </defs>
              <g clip-path="url(#{vcClipId})">
              <!-- Reference-line annotations (drawn behind boxes) -->
              {#if sharedScale}
                {@const vcAnnotations = vizOpts.annotations ?? []}
                {#each vcAnnotations as annotation (annotation.id)}
                  {#if annotation.type === "reference_line"}
                    <line
                      x1={sharedScale(annotation.x)}
                      x2={sharedScale(annotation.x)}
                      y1={0}
                      y2={rowsAreaHeight}
                      stroke={annotation.color ?? "var(--tv-divider-strong, var(--tv-border))"}
                      stroke-width={annotation.width ?? 1}
                      stroke-opacity={annotation.opacity ?? 0.6}
                      stroke-dasharray={annotation.style === "dashed" ? "4,4" : annotation.style === "dotted" ? "2,2" : ""}
                    />
                  {/if}
                {/each}
              {/if}
              <!-- Boxplots for each row -->
              {#each displayRows as displayRow, i (getDisplayRowKey(displayRow, i))}
                {#if displayRow.type === "data"}
                  {@const rowY = rowLayout.positions[i] ?? i * layout.rowHeight}
                  {@const rowH = rowLayout.heights[i] ?? layout.rowHeight}
                  <VizBoxplot
                    row={displayRow.row}
                    yPosition={rowY + rowH / 2}
                    rowHeight={rowH}
                    width={vizWidth}
                    options={vizOpts}
                    {theme}
                    {sharedScale}
                  />
                {/if}
              {/each}
              </g>

              <!-- Axis at bottom (unclipped; ticks reflect current domain) -->
              {#if vizOpts.showAxis !== false && sharedScale}
                <g transform="translate(0, {rowsAreaHeight + axisGap})">
                  <EffectAxis
                    xScale={sharedScale}
                    layout={{ ...layout, forestWidth: vizWidth, nullValue: 0 }}
                    {theme}
                    axisLabel={vizOpts.axisLabel ?? "Value"}
                    position="bottom"
                    plotHeight={rowsAreaHeight}
                    baseTicks={store.getAxisZoom(vc.column.id) ? undefined : (vizOpts.axisTicks ?? undefined)}
                    gridlines={vizOpts.axisGridlines}
                  />
                </g>
              {/if}
            </svg>
          {/if}
        {/each}

        <!-- SVG overlays: viz_violin columns -->
        {#each vizColumns.filter(vc => vc.column.type === "viz_violin") as vc (vc.column.id)}
          {@const vizOpts = vc.column.options?.vizViolin}
          {@const vizWidth = effectiveVizWidth(vc.column)}
          {@const vizLeft = forestColumnPositions.get(vc.column.id) ?? 0}
          {@const axisGap = theme?.spacing.axisGap ?? TEXT_MEASUREMENT.DEFAULT_AXIS_GAP}
          {@const sharedScale = vizColumnScales.get(vc.column.id)}
          {@const vcClipId = `viz-clip-${instanceId}-${vc.column.id}`}
          {@const vcIsLog = vizOpts?.scale === "log"}
          {#if vizOpts}
            <svg
              class="plot-overlay"
              width={vizWidth}
              height={rowsAreaHeight + layout.axisHeight}
              viewBox="0 0 {vizWidth} {rowsAreaHeight + layout.axisHeight}"
              style:top="{actualHeaderHeight}px"
              style:left="{vizLeft}px"
              use:zoomable={{
                columnId: vc.column.id,
                isLog: vcIsLog,
                getDomain: () => (sharedScale ? (sharedScale.domain() as [number, number]) : [0, 1]),
                getPixelRange: () => [VIZ_MARGIN, Math.max(vizWidth - VIZ_MARGIN, VIZ_MARGIN + 50)],
                onChange: (d) => store.setAxisZoom(vc.column.id, d),
                onReset: () => store.resetAxisZoom(vc.column.id),
                enabled: !!sharedScale,
              }}
            >
              <defs>
                <clipPath id={vcClipId}>
                  <rect x={VIZ_MARGIN} y={0} width={Math.max(vizWidth - 2 * VIZ_MARGIN, 0)} height={rowsAreaHeight} />
                </clipPath>
              </defs>
              <g clip-path="url(#{vcClipId})">
              <!-- Reference-line annotations (drawn behind violins) -->
              {#if sharedScale}
                {@const vcAnnotations = vizOpts.annotations ?? []}
                {#each vcAnnotations as annotation (annotation.id)}
                  {#if annotation.type === "reference_line"}
                    <line
                      x1={sharedScale(annotation.x)}
                      x2={sharedScale(annotation.x)}
                      y1={0}
                      y2={rowsAreaHeight}
                      stroke={annotation.color ?? "var(--tv-divider-strong, var(--tv-border))"}
                      stroke-width={annotation.width ?? 1}
                      stroke-opacity={annotation.opacity ?? 0.6}
                      stroke-dasharray={annotation.style === "dashed" ? "4,4" : annotation.style === "dotted" ? "2,2" : ""}
                    />
                  {/if}
                {/each}
              {/if}
              <!-- Violins for each row -->
              {#each displayRows as displayRow, i (getDisplayRowKey(displayRow, i))}
                {#if displayRow.type === "data"}
                  {@const rowY = rowLayout.positions[i] ?? i * layout.rowHeight}
                  {@const rowH = rowLayout.heights[i] ?? layout.rowHeight}
                  <VizViolin
                    row={displayRow.row}
                    yPosition={rowY + rowH / 2}
                    rowHeight={rowH}
                    width={vizWidth}
                    options={vizOpts}
                    {theme}
                    {sharedScale}
                  />
                {/if}
              {/each}
              </g>

              <!-- Axis at bottom (unclipped; ticks reflect current domain) -->
              {#if vizOpts.showAxis !== false && sharedScale}
                <g transform="translate(0, {rowsAreaHeight + axisGap})">
                  <EffectAxis
                    xScale={sharedScale}
                    layout={{ ...layout, forestWidth: vizWidth, nullValue: 0 }}
                    {theme}
                    axisLabel={vizOpts.axisLabel ?? "Value"}
                    position="bottom"
                    plotHeight={rowsAreaHeight}
                    baseTicks={store.getAxisZoom(vc.column.id) ? undefined : (vizOpts.axisTicks ?? undefined)}
                    gridlines={vizOpts.axisGridlines}
                  />
                </g>
              {/if}
            </svg>
          {/if}
        {/each}

        <!-- Spacing drag handles. v0.24+: thin strips on key seams that
             let the user drag to resize themed gaps without opening the
             settings panel. Cursor turns to ns-resize on hover, a faint
             primary-color bar fades in. Hot zones are 6 px tall and only
             render when interaction.enableEdit is on. -->
        {#if labelsEditable && theme}
          {@const headerHeightPx = layout.headerHeight}
          {@const rowGroupPadding = theme.spacing.rowGroupPadding ?? 0}
          <!-- Header height: bottom edge of the column-header band -->
          <EdgeResize
            value={theme.spacing.headerHeight}
            min={0}
            max={120}
            onpreview={(v) => store.previewThemeField("spacing", "headerHeight", v)}
            oncommit={(v) => store.setThemeField("spacing", "headerHeight", v)}
            label="Header height"
            top={`${headerHeightPx}px`}
          />
          <!-- Row height: bottom edge of the *visible* data band (excludes
               the trailing rowGroupPadding when the row is padded-after,
               so the rowHeight handle and rowGroupPadding handle land on
               distinct seams). -->
          {#each displayRows as displayRow, i (getDisplayRowKey(displayRow, i))}
            {#if displayRow.type === "data" && displayRow.row.style?.type !== "spacer"}
              {@const trailingPad = rowPaddedAfter[i] ? rowGroupPadding : 0}
              {@const rowVisibleBottom = headerHeightPx + layout.rowPositions[i] + layout.rowHeights[i] - trailingPad}
              <EdgeResize
                value={theme.spacing.rowHeight}
                min={16}
                max={120}
                onpreview={(v) => store.previewThemeField("spacing", "rowHeight", v)}
                oncommit={(v) => store.setThemeField("spacing", "rowHeight", v)}
                label="Row height"
                top={`${rowVisibleBottom}px`}
              />
              {#if rowPaddedAfter[i]}
                <!-- Row group padding handle: top edge of the following
                     group_header (= bottom of the empty separator strip).
                     Drag to grow / shrink the gap. -->
                {@const groupTop = headerHeightPx + layout.rowPositions[i] + layout.rowHeights[i]}
                <EdgeResize
                  value={rowGroupPadding}
                  min={0}
                  max={60}
                  onpreview={(v) => store.previewThemeField("spacing", "rowGroupPadding", v)}
                  oncommit={(v) => store.setThemeField("spacing", "rowGroupPadding", v)}
                  label="Row group padding"
                  top={`${groupTop}px`}
                />
              {/if}
            {/if}
          {/each}
        {/if}
      </div>

      <!-- Pagination controls (only when spec.paginate is set) -->
      {#if store.totalPages > 1}
        {@const pageLabel = spec?.paginate?.pageLabel ?? "x_of_y"}
        {@const showLabel = pageLabel !== false && !store.continuousMode}
        <div class="pager-controls" role="navigation" aria-label="Pagination">
          <button
            type="button"
            class="pager-btn"
            disabled={store.continuousMode || store.currentPage <= 1}
            onclick={() => store.prevPage()}
            aria-label="Previous page"
            data-tooltip="Previous page"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">
              <path d="M10 4 L6 8 L10 12" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
          </button>
          {#if showLabel}
            <span class="pager-label">
              {#if pageLabel === "x"}
                {store.currentPage}
              {:else}
                Page {store.currentPage} of {store.totalPages}
              {/if}
            </span>
          {:else if store.continuousMode}
            <span class="pager-label pager-label-continuous">{store.totalPages} pages</span>
          {/if}
          <button
            type="button"
            class="pager-btn"
            disabled={store.continuousMode || store.currentPage >= store.totalPages}
            onclick={() => store.nextPage()}
            aria-label="Next page"
            data-tooltip="Next page"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">
              <path d="M6 4 L10 8 L6 12" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
          </button>
          <button
            type="button"
            class="pager-mode-btn"
            class:active={store.continuousMode}
            onclick={() => store.setContinuousMode(!store.continuousMode)}
            aria-pressed={store.continuousMode}
            data-tooltip={store.continuousMode ? "Switch to paginated view" : "Switch to continuous view"}
          >
            {store.continuousMode ? "Paginated" : "Continuous"}
          </button>
        </div>
      {/if}

      <!-- Plot footer (caption, footnote) -->
      <PlotFooter
        caption={labelCaption}
        footnote={labelFootnote}
        enableEdit={labelsEditable}
        onedit={(field, anchor) => store.startEdit({
          rowId: "",
          field: "",
          labelField: field,
          x: anchor.getBoundingClientRect().left,
          y: anchor.getBoundingClientRect().top,
        })}
        footerGap={theme?.spacing.footerGap ?? 8}
        onpreviewfootergap={(v) => store.previewThemeField("spacing", "footerGap", v)}
        oncommitfootergap={(v) => store.setThemeField("spacing", "footerGap", v)}
      />
    </div>

    <!-- Tooltip + DropIndicator + EditableCell + ColumnFilterPopover +
         HeaderContextMenu + ColumnTypeMenu + ColumnEditorPopover. All
         encapsulated by ForestOverlays as of Phase 0c-C2. -->
    <ForestOverlays bind:this={overlays} {store} {containerRef} />
  {:else}
    <div class="tabviz-empty">No data</div>
  {/if}
</div>

<script lang="ts" module>
  import type { RowStyle } from "$types";
  import { activeSemanticToken as activeSemanticTokenMod } from "$lib/semantic-styling";

  // Note: formatNumber, formatEvents, formatInterval, addThousandsSep, abbreviateNumber are imported from $lib/formatters

  function getMaxValueForColumn(rows: Row[], column: ColumnSpec): number {
    // Use explicit maxValue from options if provided
    if (column.options?.bar?.maxValue) {
      return column.options.bar.maxValue;
    }
    if (column.options?.heatmap?.maxValue != null) {
      return column.options.heatmap.maxValue;
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

  function getMinValueForColumn(rows: Row[], column: ColumnSpec): number {
    // Use explicit minValue from options if provided
    if (column.options?.heatmap?.minValue != null) {
      return column.options.heatmap.minValue;
    }
    // Otherwise compute from data
    let min = Infinity;
    for (const row of rows) {
      const val = row.metadata[column.field];
      if (typeof val === "number" && val < min) {
        min = val;
      }
    }
    return min === Infinity ? 0 : min;
  }

  function getRowClasses(
    style?: RowStyle,
    bandIndex?: 0 | 1 | null
  ): string {
    const classes: string[] = [];

    if (style?.type === "header") classes.push("row-header");
    if (style?.type === "summary") classes.push("row-summary");
    if (style?.bold) classes.push("row-bold");
    if (style?.italic) classes.push("row-italic");

    // Semantic classes — kept for host-page CSS hooks. The widget's own
    // styling now reads from per-row CSS custom properties (see
    // getRowStyles), letting bundles override fg / bg / border / weight /
    // style in one place instead of N hardcoded rules.
    if (style?.emphasis)  classes.push("row-emphasis");
    if (style?.muted)     classes.push("row-muted");
    if (style?.accent)    classes.push("row-accent");
    if (style?.fill)      classes.push("row-fill");
    if (style?.emphasis || style?.muted || style?.accent ||
        style?.bold || style?.fill) {
      classes.push("row-has-semantic");
    }
    // Active-token class — reflects which token actually wins precedence
    // (loud→quiet: fill > accent > emphasis > bold > muted).
    // Used by styling rules that only apply when a token is THE active one,
    // so e.g. the muted-opacity overlay doesn't bleed onto rows that also
    // have a louder token painted (preview merge, multi-flag data columns).
    const active = activeSemanticTokenMod(style);
    if (active) classes.push(`row-active-${active}`);

    // Banding: the store decides which display rows get banded (respecting
    // styled-row exclusions and the mode/level grammar), so we just paint.
    if (bandIndex === 1) classes.push("row-odd");

    return classes.join(" ");
  }

  /**
   * Build the inline `style=` string for a data row. Bundle is resolved by
   * the caller (in an `@const` so Svelte tracks the per-field reads on
   * `theme.semantics.*`); passing it in means this function stays
   * non-reactive and the template's dependency graph is explicit.
   */
  function getRowStyles(
    style: RowStyle | undefined,
    depth: number | undefined,
    bundle: SemanticBundle | null,
  ): string {
    const styles: string[] = [];

    if (style?.color) styles.push(`color: ${style.color}`);
    // NB: background-color is handled at the call site via `effectiveBg` +
    // `style:background-color` so per-row bg / group-header tint / semantic
    // bundle bg all flow through one precedence ladder without fighting the
    // `style=` attribute. Leaving it here would make the `style:` directive
    // (with `undefined`) overwrite this value.
    if (style?.indent) styles.push(`--row-indent: ${style.indent}`);

    // Apply depth-based indentation if no explicit indent
    if (!style?.indent && depth && depth > 0) {
      styles.push(`--row-indent: ${depth}`);
    }

    if (bundle) {
      if (bundle.fg != null)         styles.push(`--tv-semantic-fg: ${bundle.fg}`);
      if (bundle.fontWeight != null) styles.push(`--tv-semantic-weight: ${bundle.fontWeight}`);
      if (bundle.fontStyle != null)  styles.push(`--tv-semantic-style: ${bundle.fontStyle}`);
      // Border paints a bottom rule — emitted as a real CSS property so it
      // shows up on every cell in the row (no single row-level element).
      if (bundle.border != null)     styles.push(`border-bottom: 1px solid ${bundle.border}`);
    }

    return styles.join("; ");
  }

  // Get cell style for a specific column from row.cellStyles or column.styleMapping.
  // Pure module-level helper — no instance / store access. The paint-preview
  // wrapper that mixes in the active token lives in the instance script
  // (it needs `store`); this base lookup is the underlying read.
  function getCellStyleBase(row: Row, column: ColumnSpec): CellStyle | undefined {
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
   *  12%  = ROW_HOVER_OPACITY (0.12)
   *
   * CSS color-mix() doesn't support CSS custom properties for the percentage,
   * so these values are hardcoded but should be kept in sync with the constants.
   */

  /* Ensure consistent box-sizing for all elements */
  :global(.tabviz-container),
  :global(.tabviz-container) *,
  :global(.tabviz-container) *::before,
  :global(.tabviz-container) *::after {
    box-sizing: border-box;
  }

  :global(.tabviz-container) {
    position: relative; /* Needed for toolbar positioning */
    font-family: var(--tv-font-family);
    font-size: var(--tv-font-size-base);
    color: var(--tv-fg);
    background: var(--tv-bg);
    border: var(--tv-container-border, none);
    border-radius: var(--tv-container-border-radius, 8px);
    /* Note: overflow is set in auto-fit/non-auto-fit specific rules below */
    display: flex;
    flex-direction: column;
    /* Isolate the widget's layout/style/paint from the surrounding page so
       interactions inside the widget don't trigger page-wide reflows, and
       vice versa. `content-visibility: auto` lets the browser skip rendering
       work when the widget is scrolled off-screen (e.g. embedded in a long
       Quarto report). `contain-intrinsic-size` provides a size hint that
       prevents layout-shift on first paint. */
    contain: layout style paint;
    content-visibility: auto;
    contain-intrinsic-size: auto 600px;
  }

  /* Paint-tool hover affordance. Under the always-on painter (v0.26+)
     the historical row-scope dashed outline + crosshair cursor read as
     noisy chrome since `.paint-active` is permanent — they fired on
     every row hover. Dropped them; the `.paint-preview` opacity (set
     when previewing the would-be commit) already conveys "this is the
     click target". The cell-scope outline is kept because it usefully
     marks a single cell within a row as the click target — a more
     localized cue than the row preview can provide. */
  :global(.tabviz-container.paint-active[data-paint-scope="cell"]) .data-cell:hover {
    outline: 1px solid color-mix(in srgb, var(--tv-accent, #2563eb) 70%, transparent);
    outline-offset: -1px;
  }

  /* ============================================================================
     Auto-fit Scaling
     ============================================================================ */

  /* Auto-fit mode (default): scale down if content exceeds container.
     Padding split into longhand so `--tv-bottom-margin` (theme spacing)
     can extend padding-bottom without re-declaring the whole shorthand. */
  :global(.tabviz-container.auto-fit) {
    width: 100%;
    padding-top: var(--tv-container-padding, 16px);
    padding-left: var(--tv-container-padding, 16px);
    padding-right: var(--tv-container-padding, 16px);
    padding-bottom: calc(var(--tv-container-padding, 16px) + var(--tv-bottom-margin, 0px));
    /* Hide overflow - container is explicitly sized to scaled dimensions */
    overflow: hidden;
  }

  :global(.tabviz-container.auto-fit) .tabviz-scalable {
    transform: scale(var(--tv-actual-scale, 1));
    transform-origin: top left;
    flex: none;
    width: max-content;
    /* Centering is applied via inline margin-left style */
  }

  /* Aspect-pin (Phase 7E): the lever ladder produces a wider/taller
     layout than canvas when an aspect target is pinned. Under auto-fit,
     the store's actualScale shrinks-to-fit (using both width and
     height) so the entire layout stays in-bounds — no scrollbar, the
     content just gets smaller. Without auto-fit, the container's
     `:not(.auto-fit)` rule already provides overflow:auto for manual
     zoom-and-scroll. So we don't need a dedicated has-aspect-pin
     override here anymore. */

  /* No auto-fit: render at zoom level, scrollbars if needed */
  :global(.tabviz-container:not(.auto-fit)) {
    overflow: auto;
    padding-top: var(--tv-container-padding, 16px);
    padding-left: var(--tv-container-padding, 16px);
    padding-right: var(--tv-container-padding, 16px);
    padding-bottom: calc(var(--tv-container-padding, 16px) + var(--tv-bottom-margin, 0px));
  }

  :global(.tabviz-container:not(.auto-fit)) .tabviz-scalable {
    transform: scale(var(--tv-zoom, 1));
    transform-origin: top left;
    width: max-content;
  }

  /* Max-width constraint - centers content */
  :global(.tabviz-container.has-max-width) {
    max-width: var(--tv-max-width);
    margin-left: auto;
    margin-right: auto;
  }

  /* Max-height constraint - enables vertical scroll */
  :global(.tabviz-container.has-max-height) {
    max-height: var(--tv-max-height);
    overflow-y: auto !important; /* Override auto-fit's overflow: hidden */
  }

  /* Override htmlwidgets container height */
  :global(.tabviz:has(.tabviz-container)) {
    height: auto !important;
    min-height: 0 !important;
  }

  /* In auto-fit mode, prevent inner scrollbars - container handles overflow */
  :global(.tabviz-container.auto-fit) .tabviz-main {
    overflow: visible;
    width: max-content; /* Allow grid to expand to natural width */
  }

  .tabviz-scalable {
    display: flex;
    flex-direction: column;
    flex: 1;
    /* No inner padding here by design. theme.spacing.containerPadding
       already wraps the whole widget on .tabviz-container (the outer
       padding knob). An additional interactive gutter from theme.spacing
       .padding would compound with containerPadding and give the user two
       sliders that produce overlapping effects. spacing.padding remains
       an SVG-export-only knob; the interactive widget uses
       containerPadding as its single outer-gutter control. */
    min-height: 0;
  }

  /* CSS Grid layout for unified table + plot */
  .tabviz-main {
    display: grid;
    position: relative;
    overflow: auto;
    flex: 1;
    min-height: 0;
    /* Isolate the giant grid's layout/paint from the toolbar / overlays
       siblings. `paint` is safe alongside overflow:auto (overflow already
       clips). */
    contain: layout style paint;
  }

  /* Top border frames column headers (symmetric with header bottom border) */
  .tabviz-main {
    border-top: 2px solid var(--tv-header-rule, var(--tv-border));
  }

  /* Base grid cell styles */
  .grid-cell {
    padding: 0 var(--tv-cell-padding-x);
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    display: flex;
    align-items: center;
    border-bottom: var(--tv-row-border-width, 1px) solid var(--tv-border);
    color: var(--tv-cell-fg, var(--tv-fg));
    /* Row background: `--tv-row-bg` (theme.row.base.bg) with fallback to
       the container bg. Separate from `--tv-bg` so users can tint rows
       distinct from the outer container without flipping the whole widget. */
    background: var(--tv-row-bg, var(--tv-bg));
  }

  /* Header cells - use row height for multi-row headers. Background is
     the dedicated `--tv-header-bg` (theme.colors.headerBg) so users can
     tint the header row distinctly from data rows. Cascades from
     --tv-row-bg so existing themes render identically. */
  .header-cell {
    min-height: var(--tv-header-row-height);
    font-family: var(--tv-text-header-family, var(--tv-font-family));
    font-weight: var(--tv-text-header-weight, var(--tv-font-weight-bold, 600));
    font-style: var(--tv-text-header-italic, normal);
    font-size: var(--tv-text-header-size, calc(var(--tv-font-size-base, 0.875rem) * var(--tv-header-font-scale, 1.05)));
    border-bottom: var(--tv-header-border-width, 2px) solid var(--tv-header-rule, var(--tv-border));
    background: var(--tv-header-bg, var(--tv-row-bg, var(--tv-bg)));
    color: var(--tv-header-fg, var(--tv-cell-fg, var(--tv-fg)));
    position: relative;
  }

  .header-cell.sortable {
    cursor: pointer;
    user-select: none;
  }
  .header-cell.sortable:hover {
    /* Tint over base bg rather than swapping in the divider color —
       JAMA's divider.subtle is pure black, which made the hover bg
       unreadable against the unchanged dark text (GH #4). The 12%
       mix mirrors .group-row:hover / .data-cell.editable:hover. */
    background: color-mix(in srgb, var(--tv-accent, #2563eb) 12%, var(--tv-bg));
  }

  /* Primary (leftmost) column header uses the header border width */
  .primary-header {
    border-bottom: var(--tv-header-border-width, 2px) solid var(--tv-header-rule, var(--tv-border));
  }

  /* Column group header styling */
  .column-group-header {
    justify-content: center;
    font-weight: var(--tv-font-weight-bold, 600);
    text-align: center;
    padding-left: var(--tv-group-padding, 8px);
    padding-right: var(--tv-group-padding, 8px);
  }

  /* Last row of headers uses the header border width */
  .header-cell:not(.column-group-header):not(.primary-header):not(.plot-header) {
    border-bottom: var(--tv-header-border-width, 2px) solid var(--tv-header-rule, var(--tv-border));
  }

  /* Plot header also uses the header border width */
  .plot-header {
    border-bottom: var(--tv-header-border-width, 2px) solid var(--tv-header-rule, var(--tv-border));
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
    background: var(--tv-accent, #2563eb);
  }

  /* Data cells */
  /* Row height is declared on the grid container via `grid-template-rows`
     (see `gridTemplateRows` derived). Cells stretch to the row track via
     the grid's default `align-self: stretch`. Setting `height` here would
     fight the track height and reintroduce the layout-engine vs DOM
     disagreement that pre-v0.21.x intermittent misalignments came from. */
  .data-cell {
    /* (intentionally empty — kept as a hook for v0.22+ semantic styling) */
  }

  /* Primary (leftmost) column cell — row identifier, drag surface.
     The first-column variant (theme.variants.firstColumnStyle = "bold")
     drives bg, fg, weight, and a right-edge rule via CSS vars emitted
     in the cssVars block. When the variant is "default", these are
     transparent / inherit and the cell looks like any other. */
  .primary-cell {
    min-width: 120px;
    background-color: var(--tv-first-col-bg, transparent);
    color: var(--tv-first-col-fg, inherit);
    font-weight: var(--tv-first-col-weight, inherit);
    border-right: 1px solid var(--tv-first-col-rule, transparent);
  }
  .primary-cell.reorderable {
    cursor: grab;
    touch-action: none;
    user-select: none;
    -webkit-user-select: none;
  }
  .primary-cell.reorderable:active {
    cursor: grabbing;
  }

  .primary-cell.drag-source {
    opacity: 0.55;
    transition: opacity 120ms ease-out;
    box-shadow: inset 3px 0 0 var(--tv-accent, #2563eb);
  }

  .primary-cell.just-dropped {
    animation: tabviz-row-drop-flash 560ms ease-out 1;
  }
  @keyframes tabviz-row-drop-flash {
    0%   { background-color: color-mix(in srgb, var(--tv-accent, #2563eb) 28%, transparent); }
    100% { background-color: transparent; }
  }

  /* Plot cell (empty - SVG overlays this) */
  .plot-cell {
    padding: 0;
    position: relative;
  }

  /* Plot header cell — pad horizontally by VIZ_MARGIN so header text aligns
     with the plot region's left edge (where the axis begins). */
  .plot-header {
    padding: 0 var(--tv-viz-margin, 12px);
  }

  /* Axis row cells - use full axis height (gap + content) */
  .axis-spacer {
    height: var(--tv-axis-height);
    border-bottom: none;
    background: var(--tv-bg);
    padding: 0;
  }

  .axis-cell {
    height: var(--tv-axis-height);
    border-bottom: none;
    background: var(--tv-bg);
    padding: 0;
  }

  /* Text wrapping mode — pre-line preserves \n and lets long text wrap.
     Grid-template-rows owns the row height (forestStore measures wrapped
     line counts and grows the track), so we just opt out of nowrap /
     ellipsis here. align-items: center keeps text vertically centered
     within the grown track. */
  .wrap-enabled {
    white-space: pre-line;
    overflow-wrap: anywhere;
    text-overflow: clip;
  }
  .wrap-enabled :global(.cell-content) {
    white-space: inherit;
    overflow-wrap: inherit;
    min-width: 0;
  }
  .wrap-enabled :global(.cell-value) {
    white-space: inherit;
    overflow-wrap: inherit;
    min-width: 0;
  }

  /* SVG overlay positioned absolutely over plot column */
  .plot-overlay {
    position: absolute;
    /* pointer-events: auto enables wheel/drag pan + dblclick reset on empty
       axis space. Row-level interactions still work via child components that
       set their own pointer-events. */
    pointer-events: auto;
    overflow: visible; /* Allow axis label to extend beyond plot column */
    cursor: grab;
  }
  .plot-overlay:active {
    cursor: grabbing;
  }

  .plot-overlay :global(.interactive) {
    pointer-events: auto;
  }

  /* Note: a previous rule disabled `pointer-events` on `.plot-overlay`
     when `.paint-active` was on, so paint clicks on the forest column
     would fall through to `.plot-cell` and trigger row/cell paint. That
     was written for the transient pre-v0.26 painter (paint mode entered
     explicitly via the toolbar); under the always-on painter (v0.26+)
     `.paint-active` is permanent and the rule killed wheel/drag pan +
     dblclick reset on the SVG overlay everywhere. The forest region's
     pan/zoom interaction is the primary affordance there; paint still
     works on every table cell, so the rule was dropped. */

  /* Row hover effect - apply to all cells in a row via CSS sibling selectors */
  /* We handle this via JavaScript by tracking hover state on rows */

  /* Group row styling - background is set inline per level */
  .group-row {
    cursor: pointer;
  }

  /* Group-header rows: own their bottom border at the cell level so it aligns
     with the row edge (the inner GroupHeader div would float the border above
     the padding). Default: no border. Opt in per level via
     GroupHeaderStyles.levelN_border_bottom — that sets
     .group-row-bordered, which restores a row-edge border at
     --tv-group-border-width.

     Row-group-padding (v0.24.1+) is bottom margin on the LAST data row
     of the previous top-level group via `.row-padded-after` (set by
     the store). Cleaner than putting the padding on the group_header
     itself — the heading's themed bg / borders no longer bleed into
     the separator strip. align-items stays at center; padding-bottom
     subtracts from the available area so content remains anchored at
     the original visible band, with the empty separator below. */
  .grid-cell.group-row {
    border-bottom: 0;
  }
  .grid-cell.row-padded-after {
    padding-bottom: var(--tv-row-group-padding, 0px);
  }
  .grid-cell.group-row-bordered {
    border-bottom: var(--tv-group-border-width, 1px) solid var(--tv-row-group-rule, var(--tv-border));
  }

  .group-row:hover {
    background: color-mix(in srgb, var(--tv-muted) 15%, transparent) !important;
  }

  /* Hovered row styling - uses accent color for better visibility */
  .data-cell.hovered {
    background: color-mix(in srgb, var(--tv-accent) 12%, var(--tv-bg));
    cursor: pointer;
  }

  /* Editable cells: cursor + faint tint on hover so users know to double-click */
  .data-cell.editable:hover {
    background: color-mix(in srgb, var(--tv-accent) 6%, var(--tv-bg));
    cursor: text;
  }
  .data-cell.editable.hovered:hover {
    background: color-mix(in srgb, var(--tv-accent) 12%, color-mix(in srgb, var(--tv-accent) 6%, var(--tv-bg)));
  }

  /* Spacer row styling */
  .spacer-row {
    height: calc(var(--tv-row-height) / 2);
    border-bottom: none;
    visibility: hidden;
  }

  .spacer-row.plot-cell {
    visibility: visible; /* Keep plot cell visible for spacing */
  }

  .tabviz-empty {
    padding: 24px;
    text-align: center;
    color: var(--tv-muted);
  }

  /* Row type styles (applied to data-cell elements) */
  .row-header {
    font-weight: var(--tv-font-weight-bold, 600);
    background: color-mix(in srgb, var(--tv-muted) 10%, var(--tv-bg));
  }

  .row-summary {
    font-weight: var(--tv-font-weight-bold, 600);
    border-top: 2px solid var(--tv-divider-strong, var(--tv-border));
  }

  .row-bold {
    font-weight: var(--tv-font-weight-bold, 600);
  }

  /* Paint preview — always-on hover affordance in the unified select-as-
     paint model. The renderer mixes the active paint token's bundle into
     the row/cell style so the would-be visual paints; we dim it a bit so
     the user sees "this is what you'll get on click" without it feeling
     already-committed. cursor: pointer signals the row/cell is the click
     target. */
  .data-cell.paint-preview {
    opacity: 0.65;
    cursor: pointer;
    transition: opacity 0.08s ease;
  }

  .row-italic {
    font-style: italic;
  }

  /*
   * Semantic styling — driven by per-row CSS custom properties set from the
   * resolved SemanticBundle. Each of the `--tv-semantic-*` vars is either the
   * bundle's value or empty when the bundle leaves that field `null`, which
   * makes the `var(name, FALLBACK)` below inherit whatever the row would
   * have rendered without a semantic flag.
   *
   * The three `.row-emphasis` / `.row-muted` / `.row-accent` classes are
   * kept for host-page CSS hooks but no longer drive styling themselves.
   */
  :global(.tabviz-container .data-cell.row-has-semantic),
  :global(.tabviz-container .data-cell[class*="cell-active-"]) {
    color: var(--tv-semantic-fg, inherit);
    font-weight: var(--tv-semantic-weight, inherit);
    font-style: var(--tv-semantic-style, inherit);
  }

  /* Muted token: lighter, reduced prominence. The fg already shifts to
     content.muted via the bundle; the opacity here adds a true "fade
     into the background" feel that single-color shifts don't provide.
     Gated on `.row-active-muted` / `.cell-active-muted` (each set only
     when muted is the highest-precedence flag on its scope) so a hover
     preview of a louder token on a muted-painted target doesn't keep
     dimming it. */
  :global(.tabviz-container .data-cell.row-active-muted),
  :global(.tabviz-container .data-cell.cell-active-muted) {
    opacity: 0.6;
  }

  .row-icon {
    margin-right: 6px;
  }

  .row-badge {
    margin-left: 6px;
    padding: 1px 6px;
    font-size: var(--tv-font-size-sm, 0.75rem);
    background: color-mix(in srgb, var(--tv-accent) 15%, var(--tv-bg));
    border-radius: 4px;
    color: var(--tv-accent);
  }

  /* Alternating row banding */
  .row-odd {
    background: var(--tv-alt-bg);
  }

  /* Pagination controls — sit between the plot body and the footer.
     Styled as muted chrome so they read as widget UI rather than content. */
  .pager-controls {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 6px 12px;
    border-top: 1px solid var(--tv-border, #e2e8f0);
    color: var(--tv-text-muted, #64748b);
    font-size: var(--tv-font-size-sm, 0.75rem);
    user-select: none;
  }
  .pager-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 24px;
    height: 24px;
    padding: 0;
    border: 1px solid var(--tv-border, #e2e8f0);
    background: var(--tv-bg, #fff);
    color: var(--tv-text, #1f2937);
    border-radius: 4px;
    cursor: pointer;
    transition: background 120ms ease, border-color 120ms ease, color 120ms ease;
  }
  .pager-btn:hover:not(:disabled) {
    background: color-mix(in srgb, var(--tv-accent, #2563eb) 8%, var(--tv-bg, #fff));
    border-color: var(--tv-accent, #2563eb);
    color: var(--tv-accent, #2563eb);
  }
  .pager-btn:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }
  .pager-label {
    min-width: 88px;
    text-align: center;
    font-variant-numeric: tabular-nums;
  }
  .pager-label-continuous {
    font-style: italic;
  }
  .pager-mode-btn {
    margin-left: auto;
    padding: 3px 10px;
    border: 1px solid var(--tv-border, #e2e8f0);
    background: var(--tv-bg, #fff);
    color: var(--tv-text-muted, #64748b);
    border-radius: 4px;
    font-size: var(--tv-font-size-sm, 0.75rem);
    cursor: pointer;
    transition: background 120ms ease, color 120ms ease, border-color 120ms ease;
  }
  .pager-mode-btn:hover {
    background: color-mix(in srgb, var(--tv-accent, #2563eb) 8%, var(--tv-bg, #fff));
    border-color: var(--tv-accent, #2563eb);
    color: var(--tv-accent, #2563eb);
  }
  .pager-mode-btn.active {
    background: var(--tv-accent, #2563eb);
    color: var(--tv-bg, #fff);
    border-color: var(--tv-accent, #2563eb);
  }

</style>

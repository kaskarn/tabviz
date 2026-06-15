<!--
  TabvizPlot — top-level renderer for a single (non-split) tabviz widget.

  Phase 0c-C2 audit (2026-05): originally 3526 lines. After
  TabvizOverlays extraction (Phase 0c-PR12) the parent is 3329 lines.

  The original spec proposed splitting into ForestHeader / ForestTableBody
  / TabvizPlotBody / ForestControls / TabvizOverlays + a thin orchestrator
  (<500 lines). Implementation reality required revising that plan:

  - **ForestHeader, ForestControls** dropped: the title/subtitle region
    and the toolbar/settings region are already single-component mounts
    (PlotHeader / ControlToolbar / SettingsPanel). Wrapping them adds
    files without reducing complexity.

  - **TabvizOverlays** done: the popover-chain glue + drop indicator +
    tooltip lifted out clean (Phase 0c-PR12).

  - **ForestTableBody + TabvizPlotBody** deferred with justification:
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
  import { tick, onMount } from "svelte";
  import type { TabvizStore } from "$stores/tabvizStore.svelte";
  import { buildTheme } from "$lib/theme/theme-adapter";
  import type { ThemeName } from "$lib/theme/theme-presets";
  import type { WebTheme, ColumnSpec, ColumnDef, Row, DisplayRow, DataRow, CellStyle, Annotation, SemanticBundle } from "$types";
  import RowInterval from "$components/forest/RowInterval.svelte";
  import EffectAxis from "$components/forest/EffectAxis.svelte";
  import SummaryDiamond from "$components/forest/SummaryDiamond.svelte";
  import PlotHeader from "$components/forest/PlotHeader.svelte";
  import EdgeResize from "$components/ui/EdgeResize.svelte";
  import { elementScale } from "$lib/scale-factor";
  import PlotFooter from "$components/forest/PlotFooter.svelte";
  import Watermark from "$components/table/Watermark.svelte";
  import GroupHeader from "$components/forest/GroupHeader.svelte";
  import TabvizOverlays from "./TabvizOverlays.svelte";
  import RowEdgeHandles from "../components/controls/RowEdgeHandles.svelte";
  import CellContent from "$components/table/CellContent.svelte";
  import ControlToolbar from "$components/ui/ControlToolbar.svelte";
  import SettingsPanel from "$components/ui/SettingsPanel.svelte";
  import SortIndicator from "$components/controls/SortIndicator.svelte";
  import ColumnFilterButton from "$components/controls/ColumnFilterButton.svelte";
  // ColumnFilterPopover, HeaderContextMenu, ColumnTypeMenu, ColumnEditorPopover
  // moved into TabvizOverlays (Phase 0c-C2). Tooltip + DropIndicator + EditableCell
  // also moved there.
  import ColumnDragHandle from "$components/controls/ColumnDragHandle.svelte";
  import { resolveShowHeader } from "$lib/column-types";
  import { resolveSemanticBundle, activeSemanticToken } from "$lib/semantic-styling";
  import { resolveRowKind } from "$lib/layout/row-kind";
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
  import {
    computeVizBarDomain,
    computeVizBoxplotDomain,
    computeVizViolinDomain,
  } from "$lib/viz-domain-utils";
  import { VIZ_MARGIN } from "$lib/axis-utils";
  import { buildScale, safeLogDomain, forestScaleRange, type ForestScale } from "$lib/layout/forest-scale";
  import { renderMarkdown } from "$lib/markdown";
  import { panelContentKey } from "$lib/layout/table-metrics";
  import { zoomable } from "$lib/zoom-interactions";
  import { TEXT_MEASUREMENT } from "$lib/rendering-constants";
  import { buildWidgetCSS } from "$lib/theme/theme-css";
  import { getCssVars, readSurfaceBg, readAccentDefault, readVarPx, readLabelSize } from "$lib/theme/consumer-bridge";
  import { resolveForestLegend, legendGlyphSvg } from "$lib/legend";
  import { renderCell as schemaRenderCell } from "../schema/dispatch";
  import { computeEffectiveBanks } from "../schema/banks";
  import { NUMERIC_COLUMN_TYPES } from "../schema/columns";
  import {
    createLifecycleState,
    dispatchLifecycle,
    type LifecycleState,
  } from "../schema/lifecycle-dispatch";
  import type { WidgetContext } from "../schema/render-types";
  import RenderTree from "../components/RenderTree.svelte";

  interface Props {
    store: TabvizStore;
    onThemeChange?: (themeName: ThemeName) => void;
  }

  const { store, onThemeChange }: Props = $props();

  // Unique per-widget instance suffix so SVG clipPath IDs don't collide when
  // multiple tabviz widgets render on the same page (e.g. docs gallery).
  // Without this, every widget with the same column.id produces the same
  // `viz-clip-<colId>` and the browser resolves `url(#…)` to the first match
  // — clipping later widgets' markers against earlier widgets' clip rects.
  const instanceId = `w${Math.random().toString(36).slice(2, 10)}`;

  // Reactive derivations from store
  const spec = $derived(store.spec);
  // Resolved interaction surface (4-tier defaults chain) — never read
  // spec.interaction directly; it is the sparse explicit tier only.
  const interaction = $derived(store.interaction);
  const visibleIndices = $derived(store.visibleIndices);
  const displayRows = $derived(store.displayRows);

  // Per-column aggregates over the visible row set. Bar/heatmap
  // renderers read these via ctx.columnSummary. Memoized once per
  // render so a 1k-row × 10-column table costs O(N) per render, not
  // O(N × cells) (schema-sprint Phase 4c).
  const columnSummaries = $derived.by((): Map<string, { min: number; max: number }> => {
    const map = new Map<string, { min: number; max: number }>();
    const rows = spec?.data.rows;
    if (!rows) return map;
    const canonicalRows = rows;
    const cols = spec?.columns ?? [];
    function walk(defs: typeof cols): void {
      for (const d of defs) {
        const grp = d as { isGroup?: boolean; columns?: typeof cols };
        if (grp.isGroup && grp.columns) { walk(grp.columns); continue; }
        const col = d as ColumnSpec;
        if (col.type !== "bar" && col.type !== "heatmap") continue;
        let min = Infinity;
        let max = -Infinity;
        for (const i of visibleIndices) {
          const v = canonicalRows[i].metadata[col.field];
          if (typeof v === "number" && Number.isFinite(v)) {
            if (v < min) min = v;
            if (v > max) max = v;
          }
        }
        map.set(col.id, {
          min: min === Infinity ? 0 : min,
          max: max === -Infinity ? 0 : max,
        });
      }
    }
    walk(cols);
    return map;
  });

  // Effective banks for the active spec — author-supplied entries
  // merged with schema-contributed entries (footnotes, axes, legends,
  // conditions, levelSets). Renderers read conditions out of this via
  // ctx.banks; cell-style resolution looks up condition vectors here
  // (schema-sprint Phase 5).
  const effectiveBanks = $derived.by(() => spec ? computeEffectiveBanks(spec) : null);

  // Canonical-row-id → index map. Phase 1's index-based view model
  // guarantees spec.data.rows is referentially stable for the spec's
  // lifetime; the map only rebuilds on setSpec. Used to resolve
  // styleMapping conditions against banks.conditions[name].values[i].
  const rowIdToIndex = $derived.by((): Map<string, number> => {
    const map = new Map<string, number>();
    const rows = spec?.data.rows ?? [];
    for (let i = 0; i < rows.length; i++) map.set(rows[i].id, i);
    return map;
  });

  const rowPaddedAfter = $derived(store.rowPaddedAfter);
  const layout = $derived(store.layout);
  // Per-context forest axes (one per forest column) + the primary column's axis
  // for the single-value consumers (plot annotations). See the axis slice.
  const forestAxes = $derived(store.forestAxes);
  const primaryForestAxis = $derived(store.primaryForestAxis);
  const theme = $derived(spec?.theme);

  // ── Accessibility contrast override (round-2 a11y B2) ─────────────────
  // The authored theme.inputs.mode is the AUTHOR's choice; a low-vision
  // VIEWER must be able to force high-contrast without it being baked into
  // the artifact. `osHc` tracks the OS prefers-contrast / forced-colors
  // signal; `store.contrastOverride` is the in-widget toggle ("auto" honors
  // the OS, "more" forces). When active we re-resolve the theme with
  // mode="high-contrast" for the PAINT cssVars only — no spec mutation, no
  // export change.
  let osHc = $state(false);
  onMount(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mqs = [
      window.matchMedia("(prefers-contrast: more)"),
      window.matchMedia("(forced-colors: active)"),
    ];
    const update = () => { osHc = mqs.some((m) => m.matches); };
    update();
    mqs.forEach((m) => m.addEventListener("change", update));
    return () => mqs.forEach((m) => m.removeEventListener("change", update));
  });
  const hcActive = $derived(
    store.contrastOverride === "more" || (store.contrastOverride === "auto" && osHc),
  );
  const effectiveTheme = $derived.by(() => {
    if (!hcActive || !theme?.authoringInputs ||
        theme.authoringInputs.mode === "high-contrast") return theme;
    return buildTheme({ ...theme.authoringInputs, mode: "high-contrast" }, {
      name: theme.name ?? "custom",
      roleOverrides: theme.roleOverrides ?? {},
      pins: theme.pins ?? {},
      skipValidation: true,
    }) as typeof theme;
  });

  // ── V4 shell/paper scope attributes (wire-audit Pass 1a, C35) ──────────
  // The scope root carries the FULL data-attribute set theme-runtime.css
  // keys on — not just the shell pair. data-mode / data-polarity drive the
  // HC-fidelity rules (caret, ring chips, bar width) that were dead until
  // these attrs were emitted.
  const v4Inputs = $derived(
    (theme as { authoringInputs?: import("../types/theme-inputs").ThemeInputs } | undefined)
      ?.authoringInputs,
  );
  const scopeShellMode = $derived(v4Inputs?.shell_mode ?? "flush");
  // Texture always lives on the shell (spacing rework 2026-06-05): the
  // shell wraps the whole figure, and under flush/float its transparent
  // bg still paints background-image — the texture shows wherever the
  // opaque paper doesn't cover (caption band, footer, margins). The old
  // data-paper-texture fallthrough is gone.
  const scopeShellTexture = $derived(v4Inputs?.shell_texture ?? "none");
  const scopeMode = $derived(v4Inputs?.mode ?? "standard");
  const scopePolarity = $derived(v4Inputs?.polarity ?? "light");
  const scopeDensity = $derived(v4Inputs?.density ?? "comfortable");
  // B12 (2c-i): title treatment drives the [data-title-style] CSS rules.
  const scopeTitleStyle = $derived(v4Inputs?.effects?.title_style ?? "normal");
  // Glass material (5a): "frosted"/"aurora" turn the shell into a pane.
  // GATED on standard mode (adversarial effects review H2): glass kept
  // its backdrop-blur + translucent tint under reduced-transparency —
  // the exact thing RT exists to remove — and under high-contrast. Both
  // accessibility modes get the opaque shell.
  const scopeGlass = $derived(
    (v4Inputs?.mode ?? "standard") === "standard"
      ? (v4Inputs?.effects?.glass ?? "none")
      : "none",
  );
  const shellGlow = $derived((v4Inputs?.effects?.glow_intensity ?? "none") !== "none");
  const shellStrip = $derived(
    (v4Inputs?.effects?.gradient_shell_intensity ?? "none") !== "none" ||
    v4Inputs?.effects?.caption_style === "stripe" ||
    v4Inputs?.effects?.caption_style === "both",
  );
  // B17 (wire-audit 1c): caption chip — labels.tag rendered as a boxed
  // stamp on the shell when effects.caption_style === "chip". NOT
  // labels.caption: that is footer prose (PlotFooter renders it) and
  // reusing it double-rendered the text — caught by the screenshot
  // harness on first run.
  const captionChip = $derived(
    v4Inputs?.effects?.caption_style === "chip" ||
    v4Inputs?.effects?.caption_style === "both"
      // Merged read: session tag edits (Labels tab) overlay spec.labels.
      ? (store.getPlotLabel("tag") ?? "TABLE")
      : null,
  );
  // Fallback "TABLE": a theme that opts into the chip renders the lab's
  // default stamp when the spec carries no `tag` — previously the chip
  // silently vanished, which read as a broken setting in the studio
  // (R2 effects F5). Authors override via tabviz(tag=).
  // C40 (reworked 2026-06-05): the ONLY height layer left outside
  // `.tabviz-scalable` is the shell's own padding — caption chip, strip,
  // and the paper (with its padding) all moved INSIDE the measured
  // subtree, so the ResizeObserver covers them and the old hand-tuned
  // `shellExtrasPad` constant (a chip-height approximation that
  // undercounted by ~3px and ignored label-size theming) is gone.
  // Read the resolved cssVar — one source, consumed once (no recipe
  // re-resolution that could drift from the paint).
  // One hoisted record per theme — getCssVars' cascade is memoized but
  // the per-call clone is not, and the annotation template was calling
  // it 4x per annotation per render (R2 spacing #7).
  const themeCssVars = $derived(theme ? getCssVars(theme) : {});
  const annStroke = $derived(theme ? readSurfaceBg(themeCssVars) : "white");
  // Series key for multi-effect forests (R3 viz B1: effect labels were
  // captured and never rendered — the flagship plot had no legend).
  const legendEntries = $derived(resolveForestLegend(spec, theme ?? null));
  const shellPad = $derived(readVarPx(themeCssVars, "--tv-shell-padding", 0));

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

  // Lifecycle hooks (schema-sprint Phase 7). State persists across
  // renders so the dispatcher can diff against the previous column
  // set; the $effect re-runs on every change to allColumnDefs (which
  // includes group wrappers, so adding/removing wrapping groups also
  // fires the right child-column hooks).
  const lifecycleState: LifecycleState = createLifecycleState();
  $effect(() => {
    if (!containerRef) return;
    const widget: WidgetContext = {
      root: containerRef,
      columns: allColumns as ColumnSpec[],
      // Mutation goes through the store proper (insertColumn / hideColumn
      // / etc.); the lifecycle hook's update channel is informational
      // only here. Schema authors who need to push column updates can
      // call back through their own store reference.
      update: () => {},
    };
    dispatchLifecycle(lifecycleState, allColumnDefs, widget);
  });
  const forestColumns = $derived(store.forestColumns);
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
  const labelsEditable = $derived(!!interaction.enableEdit);
  const hasPlotHeader = $derived(!!labelTitle || !!labelSubtitle);

  // Check if we have column groups (need two-row header)
  const hasColumnGroups = $derived(
    allColumnDefs.some(c => c.isGroup)
  );

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

  // Create reactive dependency on columnWidths to trigger re-render when widths change
  const columnWidthsSnapshot = $derived({ ...store.columnWidths });

  // Container refs for dimension tracking.
  //
  // containerRef — CANONICALLY THE OUTER ROOT (`.tabviz-container.tabviz-scope`),
  // locked per wire-audit-plan D2 (Round 2 C3 flip). It is simultaneously:
  //   - the click/keyboard target for paint mode
  //   - the dnd hit-test root (ColumnDragHandle `root={containerRef}` × 3)
  //   - the overlay coordinate origin (TabvizOverlays)
  //   - the ResizeObserver / IntersectionObserver target
  //   - the widget.root for dispatchLifecycle + reportLayoutMeasurements
  //   - the DOM-id source for store.setContainerElementId
  // All of these want the event/measurement anchor, NOT the content rect.
  // When the V4 shell/paper wrap lands (wire-audit-plan Pass 1a), containerRef
  // STAYS here; add a separate `paperRef` bound to `.tv-paper` if a consumer
  // needs the clean content rect. Do not repoint containerRef.
  let containerRef: HTMLDivElement | undefined = $state();
  let scalableRef: HTMLDivElement | undefined = $state();

  // Interactive column-editor state: right-click menu → type menu → editor popover.
  // headerContextMenu, columnTypeMenuTarget, columnEditorTarget moved into
  // TabvizOverlays (Phase 0c-C2). The parent's column-header click handlers
  // call overlays.openHeaderContextMenu(...) via the bind:this ref below.
  type TabvizOverlaysRef = {
    openHeaderContextMenu: (column: ColumnSpec, e: MouseEvent) => void;
  };
  let overlays = $state<TabvizOverlaysRef | null>(null);
  // typeMenuMemory + openHeaderContextMenu + handleContextMenuAction +
  // handleTypePick + handleRequestChangeType + handleEditorCommit all
  // moved into TabvizOverlays (Phase 0c-C2). Column-header click handlers
  // now call `overlays?.openHeaderContextMenu(column, e)` via the
  // bind:this ref above.

  // Local state for dimensions (measured by ResizeObserver)
  let containerContentWidth = $state(0);
  let scalableNaturalWidth = $state(0);
  let scalableNaturalHeight = $state(0);


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
    // Center within the SHELL's content box (the scalable's containing
    // block) — the shell's own padding is not available room.
    const margin = (containerContentWidth - 2 * shellPad - scaledWidth) / 2;
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


    // SYNCHRONOUS first measurement (sizing audit 2026-06-11): the
    // observer's first callback lands a frame late, so content-sized
    // tables (D19) painted left-aligned and then JUMPED to center when
    // centeringMargin finally had a containerContentWidth. Measuring
    // here — inside the effect, before the first paint — kills the
    // flash; the observer remains the steady-state source.
    if (containerRef.clientWidth > 0) {
      containerContentWidth = containerRef.clientWidth;
      store.setContainerDimensions(containerRef.clientWidth, containerRef.clientHeight);
    }
    // offsetWidth/Height: the LAYOUT box (a persisted zoom's CSS scale
    // would distort getBoundingClientRect; the observer's contentRect is
    // also unscaled, so the two sources agree).
    if (scalableRef.offsetWidth > 0) {
      scalableNaturalWidth = scalableRef.offsetWidth;
      scalableNaturalHeight = scalableRef.offsetHeight;
      store.setScalableNaturalDimensions(scalableRef.offsetWidth, scalableRef.offsetHeight);
    }

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

  // ── Measure-then-commit row heights ─────────────────────────────────────
  // Content-driven height (sizing-model §6): the estimator predicts row content
  // height for V8/first-paint; on the browser we measure the REAL rendered
  // height per row and commit it back, so rows are exact (wrapped text at true
  // font metrics, arbitrary cell content). Grid tracks are pinned to
  // layout.rowHeights, so we read each cell's scrollHeight (content extent,
  // which exceeds the pinned track when content is taller) — NOT offsetHeight
  // (the pinned track itself, which would feed back a no-op). The store's
  // shallow-equal guard (sameHeightMap) settles the measure→commit→re-measure
  // loop; rows only grow (Math.max), never oscillate.
  $effect(() => {
    if (!containerRef || !spec) return;
    // Re-measure when the things that change rendered height change.
    void displayRows.length;
    void layout.rowHeights.length;
    // Body size affects measured heights; depend on the v4 token (the
    // v3 theme.text path is retiring — W4 arc 2). getCssVars is cached.
    void getCssVars(spec.theme)["--tv-text-body-size"];
    void store.columnWidths;
    void store.expandedRows; // panels opening/closing change rendered heights

    const handle = window.requestAnimationFrame(() => {
      if (!containerRef) return;
      const cells = containerRef.querySelectorAll<HTMLElement>("[data-row-id]");
      const measured: Record<string, number> = {};
      for (const cell of cells) {
        const id = cell.dataset.rowId;
        if (!id) continue;
        // B2 FIX (wire-audit, 2026-06-05): commit ONLY when content truly
        // OVERFLOWS the pinned track (scrollHeight > clientHeight). For a
        // non-overflowing cell, scrollHeight just reports the track back —
        // and for `row-padded-after` rows the track includes the trailing
        // rowGroupPadding, so committing it re-added the pad every cycle:
        // a ~12px/frame unbounded ratchet (the homepage hero grew ~2000px
        // of inter-group whitespace in 2s of page lifetime). The +1 absorbs
        // integer rounding between the two metrics.
        const h = cell.scrollHeight;
        if (h > cell.clientHeight + 1 && h > 0) {
          measured[id] = Math.max(measured[id] ?? 0, h);
        }
      }
      // Details panels measure under a distinct key (panelContentKey) so their
      // content-driven height doesn't collide with the owner row's.
      const panels = containerRef.querySelectorAll<HTMLElement>("[data-panel-row-id]");
      for (const p of panels) {
        const rid = p.dataset.panelRowId;
        if (!rid) continue;
        // Same overflow-only rule as cells (B2 fix).
        const h = p.scrollHeight;
        if (h > p.clientHeight + 1 && h > 0) {
          const key = panelContentKey(rid);
          measured[key] = Math.max(measured[key] ?? 0, h);
        }
      }
      store.setMeasuredRowHeights(measured);
    });
    return () => window.cancelAnimationFrame(handle);
  });

  // Check if export is enabled (default true)
  const enableExport = $derived(interaction.enableExport);
  // Forest/viz domain zoom — conservative default OFF (interactivity-UX
  // arc P0): an author opts in via interaction.enableAxisZoom.
  const enableAxisZoom = $derived(interaction.enableAxisZoom);
  // Arrange tool armed (P2): the session mode AND the capability gate —
  // a Shiny-pushed spec that drops enableArrange disarms a live mode.
  const arrangeArmed = $derived(store.arrangeMode && interaction.enableArrange);

  // Get available themes for theme switcher (null = disabled, object = custom themes)
  const enableThemes = $derived(interaction.enableThemes);

  // Keyboard shortcuts for zoom control.
  //
  // CONTAINMENT (review pass): this is a window-level listener, so without
  // a gate every widget on a multi-widget page (Quarto!) would zoom in
  // lockstep AND the preventDefaults would hijack the browser's page-zoom
  // (Cmd+/-) and tab-switch (Cmd+1) shortcuts page-wide. Only act when the
  // pointer is over this widget or focus is inside it — the same scoping
  // the wheel gesture gets for free by living on the container.
  function handleKeydown(event: KeyboardEvent) {
    // Only handle if modifier key is pressed
    if (!event.metaKey && !event.ctrlKey) return;
    // Don't interfere with editable fields
    const target = event.target as HTMLElement | null;
    const tag = target?.tagName;
    if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || target?.isContentEditable) return;
    if (!containerRef) return;
    const engaged = containerRef.matches(":hover") || containerRef.contains(document.activeElement);
    if (!engaged) return;

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

  // Cmd/Ctrl+wheel over the widget adjusts WIDGET zoom (the standard
  // zoomable-canvas idiom; interactivity-UX arc P0). Plain wheel always
  // scrolls the page. Forest-overlay domain zoom (when enabled) consumes
  // its modifier-wheel before this sees it via stopPropagation. Gated on
  // showZoomControls so an author who hides zoom UI disables the gesture
  // too. preventDefault stops the browser's page-zoom while over the
  // widget — same trade every map widget makes.
  const WIDGET_WHEEL_FACTOR = 1 / 300;
  function handleContainerWheel(event: WheelEvent) {
    if (!store.showZoomControls) return;
    if (!event.metaKey && !event.ctrlKey) return;
    // Pinch/Ctrl+wheel over chrome surfaces (settings panel, toolbar) must
    // not rescale the table behind them mid-edit.
    const t = event.target as HTMLElement | null;
    if (t?.closest(".settings-panel, .control-toolbar, .zoom-dropdown")) return;
    event.preventDefault();
    store.setZoom(store.zoom * Math.exp(-event.deltaY * WIDGET_WHEEL_FACTOR));
  }

  // Check if the data has any groups

  // Row Y positions and heights for SVG overlay (annotations / row
  // intervals). Reads the same `layout.rowHeights` / `rowPositions` the
  // CSS grid uses, so wrap-grown rows and group-header padding stay in
  // lockstep with the visible row edges.
  const rowLayout = $derived.by(() => {
    const heights = layout.rowHeights;
    const positions = layout.rowPositions;
    const markerCenters = layout.rowMarkerCenters;
    const totalHeight = positions.length > 0
      ? positions[positions.length - 1] + heights[heights.length - 1]
      : 0;
    return { positions, heights, markerCenters, totalHeight };
  });

  // Total height of rows area for SVG sizing
  const rowsAreaHeight = $derived(rowLayout.totalHeight);

  // Helper to compute Y offsets for annotation labels to avoid collisions.
  // For each label, pick the lowest tier whose occupied labels are all at
  // least MIN_LABEL_SPACING away — handles 3+ adjacent collisions.
  function computeAnnotationLabelOffsets(annotations: Annotation[]): Record<string, number> {
    const labeledAnnotations = annotations
      .filter((a): a is Annotation & { type: "reference_line"; label: string } => a.type === "reference_line" && !!a.label)
      .map(a => ({ id: a.id, x: primaryForestAxis.scale(a.x), label: a.label }))
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
  function getDisplayRowKey(dr: DisplayRow, _idx: number): string {
    if (dr.type === "group_header") {
      return `group_${dr.group.id}`;
    }
    if (dr.type === "panel") {
      return `panel_${dr.rowId}`;
    }
    return dr.row.id;
  }

  // Helper to get colspan for a column definition (1 for regular columns, N for groups)
  function getColspan(col: ColumnDef): number {
    if (!col.isGroup) return 1;
    return col.columns.reduce((sum, c) => sum + getColspan(c), 0);
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


  // Compute group header background color based on nesting level
  // Uses solid colors (pre-blended with background) to avoid transparency artifacts
  function getGroupBackground(level: number, theme: WebTheme | undefined): string {
    const rg = theme?.rowGroup;
    const cv = themeCssVars;
    const primary = readAccentDefault(cv);
    const bg = readSurfaceBg(cv);

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
   * Effective render width for any plot column (forest / viz_bar /
   * viz_boxplot / viz_violin). Width comes from the multi-flex
   * distribution (`layout.flexWidths`) — forest is just a high-weight
   * plot column among the rest, with no special path. This helper drives
   * the columns whose d3 scale + SVG overlay both need the resolved width.
   */
  function effectiveVizWidth(col: ColumnSpec): number {
    // Priority: weighted distribution (layout.flexWidths) > user-resized
    // dynamic width (drag) > author's explicit `col.width` > fallback.
    // Matches the gridTemplateColumns derivation so scale + grid-template
    // + d3 ranges agree.
    const flexed = layout.flexWidths?.[col.id];
    if (typeof flexed === "number") return flexed;
    const dynamicWidth = columnWidthsSnapshot[col.id];
    if (typeof dynamicWidth === "number") return dynamicWidth;
    if (typeof col.width === "number") return col.width;
    return 200;
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
    // Uniform: every column's width is its entry in the multi-flex distribution
    // (forest is no longer special — explicit/authored/resized widths are already
    // pinned into flexWidths upstream).
    const flexed = layout.flexWidths?.[col.id];
    if (typeof flexed === "number") return flexed;
    const dynamicWidth = columnWidthsSnapshot[col.id];
    if (typeof dynamicWidth === "number") return dynamicWidth;
    if (typeof col.width === "number") return col.width;
    return 80; // fallback for "auto"-string columns awaiting measurement
  }

  function getColWidth(column: ColumnSpec): string {
    // Multi-flex: width comes from the weighted distribution (layout.flexWidths).
    const flexed = layout.flexWidths?.[column.id];
    if (typeof flexed === "number") return `${flexed}px`;
    const dynamicWidth = columnWidthsSnapshot[column.id];
    if (typeof dynamicWidth === "number") return `${dynamicWidth}px`;
    if (typeof column.width === "number") return `${column.width}px`;
    return "max-content";
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
    if (!interaction.enableReorderRows) return;
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

  // computeColumnBand + computeRowBand moved into TabvizOverlays
  // (Phase 0c-C2). They're used only by the drop-indicator render.

  // Compute CSS grid template columns: columns in order (primary column first).
  const gridTemplateColumns = $derived.by(() => {
    const parts: string[] = [];

    // All columns in order; plot columns (forest + viz_*) get their
    // resolved multi-flex width. Width is layout-driven (the weighted
    // distribution `layout.flexWidths`), not content-measured — and the
    // distribution already encodes explicit `col.width` /
    // `col.options.forest.width` pins, so forest needs no special path.
    // Every plot column routes through the shared `effectiveVizWidth()`
    // helper so the grid template, d3 scale ranges, and SVG overlay
    // viewBoxes all agree on the same width.
    for (const col of allColumns) {
      if (vizColumnTypes.includes(col.type)) {
        parts.push(`${effectiveVizWidth(col)}px`);
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
    // Reference these to re-run when columns/plot resize. The multi-flex
    // distribution can shift any plot column's width (aspect reshape,
    // user resize, container resize), so this hook depends on the whole
    // flexWidths map — otherwise viz overlays render at the new width but
    // their `left` positions stay at the old grid offsets.
    const _ = columnWidthsSnapshot;
    const __ = layout.flexWidths;
    const ___ = headerDepth;

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
    const scales = new Map<string, ForestScale>();

    for (const vc of vizColumns) {
      const col = vc.column;

      // Pull current page's data rows once per loop iteration; the
      // domain helpers below are shape-agnostic.
      const dataRows = displayRows
        .filter((d) => d.type === "data")
        .map((d) => d.row);

      // Shared helper: domain → effective domain (pan/zoom override) →
      // d3 scale at the column's effective width. Keeps the three viz
      // branches symmetrical and matches svg-generator's compute path
      // by construction (schema-sprint Phase 4d).
      function buildVizScale(
        scaleKind: "linear" | "log" | undefined,
        domain: { min: number; max: number },
      ): ForestScale {
        const vizWidth = effectiveVizWidth(col);
        const [zMin, zMax] = store.getEffectiveDomain(col.id, [domain.min, domain.max]);
        const type = scaleKind === "log" ? "log" : "linear";
        const dom = type === "log" ? safeLogDomain([zMin, zMax]) : [zMin, zMax] as [number, number];
        return buildScale(type, dom, forestScaleRange(vizWidth));
      }

      if (col.type === "viz_bar") {
        const opts = col.options?.vizBar;
        if (!opts) continue;
        scales.set(col.id, buildVizScale(opts.scale, computeVizBarDomain(dataRows, opts)));
      } else if (col.type === "viz_boxplot") {
        const opts = col.options?.vizBoxplot;
        if (!opts) continue;
        scales.set(col.id, buildVizScale(opts.scale, computeVizBoxplotDomain(dataRows, opts)));
      } else if (col.type === "viz_violin") {
        const opts = col.options?.vizViolin;
        if (!opts) continue;
        scales.set(col.id, buildVizScale(opts.scale, computeVizViolinDomain(dataRows, opts)));
      }
    }

    return scales;
  });

  // Per-column forest scales now come from the axis slice's per-context
  // resolver (`store.forestAxes`) — each column resolves its own
  // domain/width/zoom. See lib/layout/forest-scale.ts + the axis slice.


  // Column resize state and handlers — the seam grammar (P2): preview per
  // move, ONE commit on release, Escape cancels (restores the start width,
  // no op-log entry), double-click autosizes back to content width, a live
  // px readout follows the drag.
  let resizingColumn = $state<string | null>(null);
  let columnStartX = 0;
  let columnStartWidth = 0;
  let columnLastWidth = 0;
  let columnResizeScale = 1;
  let columnReadout = $state<{ x: number; y: number; text: string } | null>(null);
  // Track whether a drag actually moved — a plain click on the handle (no
  // movement) must not commit a width pin.
  let columnDragMoved = false;
  // Pin state BEFORE the drag: Escape-cancel must restore it exactly
  // (previewColumnWidth marks the column user-resized as a side effect;
  // a cancelled gesture must not leave that phantom permanent pin).
  let columnWasUserResized = false;

  function startColumnResize(e: PointerEvent, columnId: string, currentWidth: number) {
    if (!interaction.enableResize) return;
    e.preventDefault();
    e.stopPropagation();
    resizingColumn = columnId;
    columnStartX = e.clientX;
    columnStartWidth = currentWidth;
    columnLastWidth = currentWidth;
    columnDragMoved = false;
    columnWasUserResized = store.userResizedIds.has(columnId);
    // Client→layout px: the header lives inside the CSS-scaled subtree.
    columnResizeScale = elementScale(e.currentTarget as HTMLElement);
    document.addEventListener("pointermove", onColumnResize);
    document.addEventListener("pointerup", stopColumnResize);
    window.addEventListener("keydown", onColumnResizeKey, true);
    window.addEventListener("blur", commitColumnResize);
  }

  function onColumnResize(e: PointerEvent) {
    if (!resizingColumn) return;
    const delta = (e.clientX - columnStartX) / columnResizeScale;
    if (!columnDragMoved && Math.abs(delta) < 2) return;
    columnDragMoved = true;
    const newWidth = Math.max(40, columnStartWidth + delta); // Min width 40px
    columnLastWidth = newWidth;
    // Live preview during drag — no op-log emission. Commit on pointerup.
    store.previewColumnWidth(resizingColumn, newWidth);
    columnReadout = { x: e.clientX, y: e.clientY, text: `${Math.round(newWidth)}px` };
  }

  function teardownColumnResize() {
    resizingColumn = null;
    columnReadout = null;
    document.removeEventListener("pointermove", onColumnResize);
    document.removeEventListener("pointerup", stopColumnResize);
    window.removeEventListener("keydown", onColumnResizeKey, true);
    window.removeEventListener("blur", commitColumnResize);
  }

  function stopColumnResize(_e: PointerEvent) {
    commitColumnResize();
  }

  function commitColumnResize() {
    if (resizingColumn && columnDragMoved) {
      // One recorded `resize_column()` per drag gesture — the settled
      // width on release rather than every intermediate pixel.
      store.setColumnWidth(resizingColumn, columnLastWidth);
    }
    teardownColumnResize();
  }

  function onColumnResizeKey(e: KeyboardEvent) {
    if (e.key !== "Escape" || !resizingColumn) return;
    e.preventDefault();
    e.stopPropagation();
    // Cancel: restore the drag-start width AND the drag-start pin state —
    // no commit, no op-log entry, no phantom user-resize pin.
    if (columnDragMoved) {
      store.cancelPreviewColumnWidth(resizingColumn, columnStartWidth, columnWasUserResized);
    }
    teardownColumnResize();
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

  function paintCellPreviewToken(row: Row | null, field: string): string | null {
    const tool = store.paintTool;
    if (!row || !tool) return null;
    if (tool.scope !== "cell") return null;
    if (store.paintHoverCellField !== `${row.id}:${field}`) return null;
    return tool.token;
  }
  function getCellStyle(row: Row, column: ColumnSpec): CellStyle | undefined {
    const previewToken = paintCellPreviewToken(row, column.field);
    // Resolve canonical row index (stable across sort/filter via
    // Phase 1's index-based view model) so condition vectors line up.
    const rowIndex = rowIdToIndex.get(row.id);
    const baseStyle = getCellStyleBase(row, column, rowIndex, effectiveBanks);
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
  // produced by `buildThemeCSS()` in $lib/theme/theme-css and cached by theme
  // identity; this `$derived` therefore only re-runs the cheap widget-
  // instance composition when layout/zoom changes while the theme is stable.
  // To inspect or export the resolved theme as CSS, call `getThemeCSS(theme)`
  // from `$lib/theme/theme-css`.
  const cssVars = $derived(
    buildWidgetCSS(effectiveTheme ?? null, {
      maxWidth: maxWidth ?? null,
      maxHeight: maxHeight ?? null,
      anyHeaderVisible,
      headerHeight: layout.headerHeight,
      headerDepth,
      effectiveHeaderDepth,
      axisHeight: layout.axisHeight,
      forestWidth: layout.flexWidths?.[forestColumns[0]?.column.id ?? ""] ?? 0,
      actualScale,
      zoom,
    })
  );

</script>

<svelte:window onkeydown={handleKeydown} />

<!-- WIDGET ROOT — `.tabviz-container.tabviz-scope` (D1: sibling class, same node;
     `.tabviz-scope` is the selector namespace theme-runtime.css keys on).

     V4 WRAP CONTRACT (spacing rework 2026-06-05; supersedes Pass 1a):
     the shell wraps the scalable; the paper lives INSIDE the scalable —
       .tabviz-container.tabviz-scope        ← root: cssVars, state classes,
         ControlToolbar                        containerRef, data-* attrs
         SettingsPanel
         .tv-shell                           ← figure frame: outer air, band
           .tabviz-scalable                  ← measured + zoom-scaled subtree
             .tv-caption                     ← chip ⌐ title baseline row
             .shell-strip                    ← caption↔data gradient seam
             .tv-paper                       ← data card (table + pager)
             PlotFooter                      ← figure annotation below card
         TabvizOverlays                      ← stays at root level
     (RowEdgeHandles moved INSIDE the rows region in the interactivity
     arc — that relocation was the coordinate-space fix.)
     Toolbar/panels/overlays are positioned chrome anchored to the root; they
     never move into the shell. Every height contributor except the shell's
     own padding is inside the measured subtree (kills the old shellExtrasPad
     hand-count) and scales WYSIWYG with zoom. `:global(.tabviz-container >
     .control-toolbar ...)` direct-child selectors stay valid; all
     `.tabviz-scalable` selectors are descendant. Keep it that way:
     new selectors touching toolbar/overlay chrome anchor `> X` on the root;
     new selectors touching table content anchor under `.tv-paper`. -->
<div
  bind:this={containerRef}
  class="tabviz-container tabviz-scope"
  class:auto-fit={autoFit}
  class:has-aspect-pin={store.targetAspect != null}
  class:has-max-width={maxWidth !== null}
  class:has-max-height={maxHeight !== null}
  class:zoomed={zoom !== 1.0}
  class:paint-active={!!store.paintTool}
  data-paint-scope={store.paintTool?.scope ?? undefined}
  data-paint-token={store.paintTool?.token ?? undefined}
  data-zoom="{Math.round(actualScale * 100)}%"
  data-shell-mode={scopeShellMode}
  data-shell-texture={scopeShellTexture}
  data-mode={scopeMode}
  data-polarity={scopePolarity}
  data-density={scopeDensity}
  data-title-style={scopeTitleStyle}
  data-shell-surface={scopeGlass === "none" ? "opaque" : "glass"}
  style="{cssVars}; {autoFit && scaledHeight > 0 ? `height: ${scaledHeight + 2 * (theme?.spacing.containerPadding ?? 0) + 2 * shellPad + (theme?.spacing.bottomMargin ?? 0)}px` : ''}"
  onwheel={handleContainerWheel}
>
  {#if spec}
    <!-- Control toolbar (always outside scalable so it doesn't scale with zoom) -->
    <ControlToolbar {store} {enableExport} {enableThemes} {onThemeChange} />

    <!-- Settings panel (slide-in from right; mounted alongside the toolbar so
         its absolute positioning is contained by the widget root). -->
    <SettingsPanel {store} />

    <!-- V4 shell + paper surfaces (spacing rework 2026-06-05; supersedes
         the Pass 1a wrap). The SHELL is the figure's frame: it owns the
         outer air (density-scaled padding) and band chrome (texture /
         glow). Inside it, `.tabviz-scalable` (measured + zoom-scaled)
         carries the lab's caption→seam→data order:
           .tv-caption    chip ⌐ title/subtitle on one baseline row
           .shell-strip   the brand-gradient caption↔data seam
           .tv-paper      the data card (table + pager)
           PlotFooter     figure annotation below the card
         Everything that contributes height is inside the measured
         subtree — the auto-fit formula only adds the shell's padding.
         All four are inert under flush mode (transparent, 0 padding,
         outline borders). -->
    {#if scopeGlass === "aurora"}
      <!-- Borealis blob layer (5a) — behind the glass pane. -->
      <div class="tv-glass-backdrop" aria-hidden="true"></div>
    {/if}
    <!-- min-width under manual zoom: the scalable's LAYOUT box is its
         unscaled natural width (CSS transforms don't affect layout), so
         at zoom>1 the visually-scaled content is wider than the shell's
         block width and the band/card ended mid-content when scrolled
         (geometry audit F4). Sizing the shell to the VISUAL extent keeps
         the frame under all scrolled content. Auto-fit never overflows. -->
    <div
      class="tv-shell"
      class:tv-glow={shellGlow}
      style:min-width={!autoFit && scaledWidth > 0 ? `${scaledWidth + 2 * shellPad}px` : undefined}
    >
    <div bind:this={scalableRef} class="tabviz-scalable" style:margin-left="{centeringMargin}px">
      {#if captionChip || hasPlotHeader}
        <!-- Caption block on the shell surface (lab .sci-cap). With a
             chip, chip + title share one baseline row (lab grid
             "chip title"); the chip never corner-pins. -->
        <div class="tv-caption" class:has-chip={!!captionChip}>
          {#if captionChip}
            <!-- Caption chip (lab "TABLE 2" stamp). Deliberately NOT
                 .tv-shell-text: the chip is opaque (its own bg); the texture
                 knockout's higher-specificity background would override the
                 rubrication bg — caught by the screenshot harness. -->
            <div class="tv-caption-chip">{captionChip}</div>
          {/if}
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
              {arrangeArmed}
            />
          {/if}
        </div>
      {/if}
      {#if shellStrip && (captionChip || hasPlotHeader)}
        <!-- Brand-gradient seam BETWEEN caption and data paper (lab
             .shell-strip — "expresses the shell↔paper split"; it is NOT
             a top cap, the original placement all three spacing-review
             agents flagged). Guarded on a caption EXISTING: with no
             title/chip the strip became a first-child top cap again —
             the exact defect, through a corner case (R2 spacing #4). -->
        <div class="shell-strip" aria-hidden="true"></div>
      {/if}
      <div class="tv-paper">

      <!-- Snippet for rendering cell content based on column type -->
      {#snippet renderCellContent(rowArg: DataRow['row'], column: ColumnSpec)}
        {@const cellStyle = getCellStyle(rowArg, column)}
        {@const editedFields = store.cellEdits.cells[rowArg.id]}
        {@const metadata = editedFields ? { ...rowArg.metadata, ...editedFields } : rowArg.metadata}
        {@const row = editedFields ? { ...rowArg, metadata } : rowArg}
        {@const schemaTree = schemaRenderCell(
          column,
          metadata[column.field],
          {
            cellWidth: 0,
            rowHeight: 0,
            row: metadata,
            target: "browser",
            cellStyle,
            colorOverride: effectiveVizColor(row, column),
            naText: column.options?.naText ?? null,
            theme: theme ?? null,
            columnSummary: columnSummaries.get(column.id) ?? null,
            rowIndex: rowIdToIndex.get(row.id),
            banks: effectiveBanks,
          },
          theme?.nodeRules,
          "dom",
        )}
        {#if schemaTree}
          {#if schemaTree.kind === "component"}
            <!-- Visual cell: RenderComponent owns the cell shape;
                 cellStyle is forwarded into the component's own
                 props. No CellContent wrapper. -->
            <RenderTree node={schemaTree} />
          {:else}
            <!-- Text-composition cell: wrap in CellContent so
                 cellStyle (bold/italic/muted/accent/color/bg/icon/
                 badge/tooltip) applies the same as legacy cells. -->
            <CellContent {cellStyle}>
              <RenderTree node={schemaTree} />
            </CellContent>
          {/if}
        {:else}
          <!-- Final fallback: an unknown column.type (e.g. user-registered
               schema without a renderer, or a wire-shape mismatch).
               Stringify the field value and show it; preserves the
               legacy "default to text" behavior. -->
          {@const rawText = String(metadata[column.field] ?? "")}
          <CellContent value={rawText} title={rawText} {cellStyle} />
        {/if}
      {/snippet}

      <!-- CSS Grid layout: columns in order (leftmost = primary).
           Table semantics (a11y floor, area J): the grid is role="table"
           with display:contents row wrappers — placement is unaffected
           (contents children join the grandparent grid; every cell is
           explicitly placed) while screen readers get real
           row/columnheader/cell structure. Drawing layers (viz overlays,
           axis strip, watermark) are aria-hidden; the semantic content
           of viz columns lives in the paired text/numeric columns.
           Survey + triage: docs/dev/a11y-semantics.md. -->
      <div
        class="tabviz-main"
        role="table"
        aria-label={labelTitle || "Data table"}
        aria-rowcount={effectiveHeaderDepth + displayRows.length}
        aria-colcount={allColumns.length}
        style:grid-template-columns={gridTemplateColumns}
        style:grid-template-rows={gridTemplateRows}
      >
        {#if spec?.watermark && theme}
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
        {@const headerRowStarts = [...new Set(headerCells.map((c) => c.rowStart))].sort((a, b) => a - b)}
        {#each headerRowStarts as hrs (hrs)}
        <div role="row" style="display: contents" aria-rowindex={hrs}>
        {#each headerCells.filter((c) => c.rowStart === hrs) as cell (cell.col.id)}
          {#if cell.isGroupHeader}
            <!-- Group header. dblclick toggles rename when editing is on; no
                 keyboard parity because the edit path is also exposed via the
                 right-click context menu on the primary cell. -->
            <div
              class="grid-cell header-cell column-group-header"
              class:editable={interaction.enableEdit}
              role="columnheader"
              aria-colspan={cell.colspan}
              tabindex={interaction.enableEdit ? 0 : undefined}
              data-header-id={cell.col.id}
              style:grid-column="{cell.gridColumnStart} / span {cell.colspan}"
              style:grid-row="{cell.rowStart} / span {cell.rowSpan}"
              ondblclick={interaction.enableEdit
                ? () => store.startEdit({ rowId: "", field: "", groupId: cell.col.id })
                : undefined}
              onkeydown={interaction.enableEdit ? (e) => {
                if (e.key === "Enter" || e.key === "F2") {
                  e.preventDefault();
                  store.startEdit({ rowId: "", field: "", groupId: cell.col.id });
                }
              } : undefined}
            >
              {#if interaction.enableReorderColumns}
                <ColumnDragHandle {store} kind="column_group" id={cell.col.id} root={containerRef} />
              {/if}
              <span class="header-text">{store.cellEdits.groups[cell.col.id] ?? cell.col.header}</span>
            </div>
          {:else if cell.isForest}
            <!-- Viz column header (forest, bar, boxplot, violin) -->
            {@const column = cell.col as ColumnSpec}
            {@const canSortViz = !!interaction.enableSort && column.sortable !== false}
            {@const vizSortDir = store.sortConfig?.column === column.field ? store.sortConfig.direction : "none"}
            <!-- svelte-ignore a11y_no_static_element_interactions -->
            <div
              use:forestColumnRef={column.id}
              class="grid-cell header-cell plot-header"
              class:sortable={canSortViz}
              role="columnheader"
              aria-sort={canSortViz ? (vizSortDir === "asc" ? "ascending" : vizSortDir === "desc" ? "descending" : "none") : undefined}
              tabindex={canSortViz ? 0 : undefined}
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
              onkeydown={canSortViz ? (e) => {
                // Keyboard sort parity for viz headers (a11y floor, area J).
                if (e.key !== "Enter" && e.key !== " ") return;
                if ((e.target as HTMLElement).closest('.resize-handle, .drag-handle')) return;
                e.preventDefault();
                store.toggleSort(column.field);
              } : undefined}
            >
              {#if interaction.enableReorderColumns}
                <ColumnDragHandle {store} kind="column" id={column.id} root={containerRef} />
              {/if}
              {#if resolveShowHeader(column.showHeader, column.header)}
                <span class="header-text">{column.header}</span>
              {/if}
              {#if canSortViz && vizSortDir !== "none"}
                <SortIndicator direction={vizSortDir} />
              {/if}
              {#if interaction.enableResize}
                <!-- svelte-ignore a11y_no_static_element_interactions -->
                <div
                  class="resize-handle"
                  title="Drag to resize · double-click to autosize"
                  onpointerdown={(e) => startColumnResize(e, column.id, effectiveColumnWidth(column))}
                  ondblclick={(e) => { e.preventDefault(); e.stopPropagation(); store.resetColumnWidth(column.id); }}
                ></div>
              {/if}
            </div>
          {:else}
            <!-- Leaf column header -->
            {@const column = cell.col as ColumnSpec}
            {@const canSort = !!interaction.enableSort && column.sortable}
            {@const sortDir = store.sortConfig?.column === column.field ? store.sortConfig.direction : "none"}
            {@const isPrimaryHeader = column.id === primaryColumnId}
            <!-- svelte-ignore a11y_no_static_element_interactions -->
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
              role="columnheader"
              aria-sort={canSort ? (sortDir === "asc" ? "ascending" : sortDir === "desc" ? "descending" : "none") : undefined}
              tabindex={canSort ? 0 : undefined}
              aria-label={canSort ? `${column.header || column.field} — sortable column` : undefined}
              oncontextmenu={(e) => overlays?.openHeaderContextMenu(column, e)}
              onclick={canSort ? (e) => {
                const target = e.target as HTMLElement;
                if (target.closest('.resize-handle') || target.closest('.drag-handle')) return;
                store.toggleSort(column.field);
              } : undefined}
              onkeydown={canSort ? (e) => {
                // Keyboard sort (a11y floor, area J): Enter/Space toggles —
                // same gesture vocabulary as click, no modifiers.
                if (e.key !== "Enter" && e.key !== " ") return;
                if ((e.target as HTMLElement).closest('.resize-handle, .drag-handle, .filter-btn')) return;
                e.preventDefault();
                store.toggleSort(column.field);
              } : undefined}
            >
              {#if interaction.enableReorderColumns}
                <ColumnDragHandle {store} kind="column" id={column.id} root={containerRef} />
              {/if}
              {#if resolveShowHeader(column.showHeader, column.header)}
                <span class="header-text">{column.header}</span>
              {/if}
              {#if canSort && sortDir !== "none"}
                <SortIndicator direction={sortDir} />
              {/if}
              {#if interaction.enableFilters && !vizColumnTypes.includes(column.type)}
                <ColumnFilterButton {store} field={column.field} header={column.header} />
              {/if}
              {#if interaction.enableResize}
                <!-- svelte-ignore a11y_no_static_element_interactions -->
                <div
                  class="resize-handle"
                  title="Drag to resize · double-click to autosize"
                  onpointerdown={(e) => startColumnResize(e, column.id, effectiveColumnWidth(column))}
                  ondblclick={(e) => { e.preventDefault(); e.stopPropagation(); store.resetColumnWidth(column.id); }}
                ></div>
              {/if}
            </div>
          {/if}
        {/each}
        </div>
        {/each}
        {/if}

        <!-- Data rows -->
        {#each displayRows as displayRow, i (getDisplayRowKey(displayRow, i))}
          <!-- a11y row wrapper (display:contents — invisible to the grid).
               Group headers carry aria-expanded here: `row` supports it
               (treegrid vocabulary); the cell role does not. -->
          <div
            role="row"
            style="display: contents"
            aria-rowindex={effectiveHeaderDepth + 1 + i}
            aria-expanded={displayRow.type === "group_header"
              ? !(displayRow.group.collapsed || store.collapsedGroups.has(displayRow.group.id))
              : undefined}
          >
          {#if displayRow.type === "panel"}
            <!-- Details/disclosure panel: full-width free content (markdown),
                 content-driven height. Measured under panel:<rowId>. -->
            <div
              class="grid-cell tabviz-details-panel"
              role="cell"
              aria-colspan={allColumns.length}
              data-panel-row-id={displayRow.rowId}
              style:grid-row={effectiveHeaderDepth + 1 + i}
              style:grid-column="1 / -1"
            >
              <!-- eslint-disable-next-line svelte/no-at-html-tags -- renderMarkdown escapes first; safe by construction -->
              {@html renderMarkdown(displayRow.content)}
            </div>
          {:else}
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
          {@const rowStyles = row ? getRowStyles(effectiveRowStyle, semBundle) : ""}
          {@const isSpacerRow = !!row && resolveRowKind({ type: "data", row }) === "spacer"}
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
                class:reorderable={interaction.enableReorderRows}
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
                role={!isGroupHeader && row && store.paintTool ? "button" : "cell"}
                tabindex={isGroupHeader || (row && store.paintTool) ? 0 : undefined}
                aria-pressed={!isGroupHeader && row && store.paintTool
                  ? !!cellActiveTok || rowClasses.includes("row-active-")
                  : undefined}
                aria-label={!isGroupHeader && row && store.paintTool
                  ? `Paint row ${row.label ?? row.id} with ${store.paintTool.token}`
                  : undefined}
                onpointerdown={interaction.enableReorderRows ? (e) => {
                  if (isGroupHeader) startRowPointerDown(e, "row_group", displayRow.group.id, displayRow.group.parentId ?? "__root__");
                  else if (row) startRowPointerDown(e, "row", row.id, row.groupId ?? "__root__");
                } : undefined}
                onclick={isGroupHeader ? () => store.toggleGroup(displayRow.group.id) : row ? () => handleCellClick(row, column.field) : undefined}
                ondblclick={!isGroupHeader && row && interaction.enableEdit && isEditableColumn(column) ? () => store.startEdit({ rowId: row.id, field: column.field }) : undefined}
                onkeydown={isGroupHeader
                  ? (e) => (e.key === "Enter" || e.key === " ") && store.toggleGroup(displayRow.group.id)
                  : row
                    ? (e) => {
                        // C54 (wire-audit Pass 4): keyboard paint parity.
                        // The primary cell is the row's single tab stop;
                        // Enter/Space applies the active paint token (same
                        // toggle semantics as click).
                        if (!store.paintTool) return;
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          handleCellClick(row, column.field);
                        }
                      }
                    : undefined}
                onmouseenter={row ? (e) => handleCellEnter(row.id, column.field, e) : undefined}
                onmouseleave={row ? () => handleCellLeave() : undefined}
              >
                {#if isGroupHeader}
                  <GroupHeader
                    group={displayRow.group}
                    rowCount={interaction.showGroupCounts ? displayRow.rowCount : undefined}
                    level={displayRow.depth + 1}
                    {theme}
                  />
                {:else if row}
                  {#if row.details}
                    <button
                      class="details-toggle"
                      class:open={store.isRowExpanded(row.id)}
                      aria-label="Toggle details"
                      aria-expanded={store.isRowExpanded(row.id)}
                      onclick={(e) => { e.stopPropagation(); if (row) store.toggleRowDetails(row.id); }}
                    >▶</button>
                  {/if}
                  {#if row.style?.icon}<span class="row-icon">{row.style.icon}</span>{/if}
                  {@render renderCellContent(row, column)}
                  {#if row.style?.badge}<span class="row-badge">{row.style.badge}</span>{/if}
                {/if}
              </div>
            {:else if vizColumnTypes.includes(column.type)}
              <!-- Viz cell (empty - SVG overlays this). Click/hover are row-
                   level affordances; the primary-cell owns keyboard selection
                   for the row, so this cell is presentational. -->
              <!-- svelte-ignore a11y_click_events_have_key_events -->
              <!-- svelte-ignore a11y_interactive_supports_focus -->
              <div
                class={`grid-cell data-cell plot-cell ${rowClasses}${cellActiveTok ? ` cell-active-${cellActiveTok}` : ""}`}
                class:group-row={isGroupHeader}
                class:row-padded-after={!isGroupHeader && rowPaddedAfter[i]}
                class:group-row-bordered={groupLevelBorder}
                class:spacer-row={isSpacerRow}
                class:paint-preview={!!rowPreviewToken || (!!row && !!paintCellPreviewToken(row, column.field))}
                role="cell"
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
              {@const editableHere = !!(row && interaction.enableEdit && !isGroupHeader && isEditableColumn(column))}
              {@const cellBg = row ? (getCellStyle(row, column)?.bg ?? null) : null}
              <!-- svelte-ignore a11y_click_events_have_key_events -->
              <!-- svelte-ignore a11y_interactive_supports_focus -->
              <div
                class={`grid-cell data-cell ${rowClasses}${cellActiveTok ? ` cell-active-${cellActiveTok}` : ""}`}
                class:numeric-cell={NUMERIC_COLUMN_TYPES.has(column.type)}
                class:group-row={isGroupHeader}
                class:row-padded-after={!isGroupHeader && rowPaddedAfter[i]}
                class:group-row-bordered={groupLevelBorder}
                class:spacer-row={isSpacerRow}
                class:wrap-enabled={column.wrap}
                class:editable={editableHere}
                class:paint-preview={!!rowPreviewToken || (!!row && !!paintCellPreviewToken(row, column.field))}
                role="cell"
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
          {/if}
          </div>
        {/each}

        <!-- Axis row: one axis cell per viz column -->
        {#if hasVizColumns}
          {@const axisRowNum = effectiveHeaderDepth + 1 + displayRows.length}
          {#each allColumns as column, idx (column.id)}
            {#if vizColumnTypes.includes(column.type)}
              <div class="grid-cell axis-cell" aria-hidden="true" style:grid-column={1 + idx} style:grid-row={axisRowNum}></div>
            {:else}
              <div class="grid-cell axis-spacer" aria-hidden="true" style:grid-column={1 + idx} style:grid-row={axisRowNum}></div>
            {/if}
          {/each}
        {/if}

        <!-- Outer table frame (D26, border_preset=frame/boxed): a 4-side
             border spanning the TABLE region only — header top → last data
             row bottom — and STOPPING ABOVE THE AXIS (the axis is plot
             scaffold, not table; grid-row ends at axisRowNum). Drawn as a
             grid-overlay with box-shadow inset so it adds ZERO layout space
             (a real border would shift content + break flush parity), exactly
             like the export's frame rect (svg-generator: mainY → rowsY+
             rowsHeight). Gated by --tv-table-border-width (0 ⇒ invisible).
             pointer-events:none — purely decorative. -->
        {#if displayRows.length > 0}
          <div
            class="table-frame"
            aria-hidden="true"
            style:grid-row="1 / {effectiveHeaderDepth + 1 + displayRows.length}"
            style:grid-column="1 / -1"
          ></div>
        {/if}

        <!-- SVG overlays: one per forest column -->
        {#each forestColumns as fc (fc.column.id)}
          {@const forestOpts = fc.column.options?.forest}
          {@const forestWidth = effectiveVizWidth(fc.column)}
          {@const forestLeft = forestColumnPositions.get(fc.column.id) ?? 0}
          {@const axisGap = theme?.spacing.axisGap ?? TEXT_MEASUREMENT.DEFAULT_AXIS_GAP}
          {@const nullValue = forestOpts?.nullValue ?? layout.nullValue}
          {@const axisLabel = forestOpts?.axisLabel ?? "Effect"}
          {@const isLog = forestOpts?.scale === "log"}
          {@const colScale = forestAxes.get(fc.column.id)?.scale ?? primaryForestAxis.scale}
          {@const fcClipId = `viz-clip-${instanceId}-${fc.column.id}`}
          <svg
            class="plot-overlay"
            aria-hidden="true"
            width={forestWidth}
            height={rowsAreaHeight + layout.axisHeight}
            viewBox="0 0 {forestWidth} {rowsAreaHeight + layout.axisHeight}"
            style:top="{actualHeaderHeight}px"
            style:left="{forestLeft}px"
            use:zoomable={{
              columnId: fc.column.id,
              isLog,
              getDomain: () => colScale.domain() as [number, number],
              getPixelRange: () => forestScaleRange(forestWidth),
              onChange: (d) => store.setAxisZoom(fc.column.id, d),
              onReset: () => store.resetAxisZoom(fc.column.id),
              enabled: enableAxisZoom,
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
              stroke="var(--tv-text-subtle)"
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
                  stroke={annotation.color ?? "var(--tv-border)"}
                  stroke-width={annotation.width ?? 1.5}
                  stroke-opacity={annotation.opacity ?? 0.6}
                  stroke-dasharray={annotation.style === "dashed" ? "6,4" : annotation.style === "dotted" ? "2,2" : ""}
                />
                {#if annotation.label}
                  {@const yOffset = annotationLabelOffsets[annotation.id] ?? 0}
                  {@const annoLabelSize = readLabelSize(getCssVars(theme))}
                  {@const annoTypo = { fontSizeSm: annoLabelSize, lineHeight: 1.5 }}
                  {@const annoAxisGeom = computeAxisLayout(annoTypo, !!forestOpts?.axisLabel, theme!.plot.tickMarkLength)}
                  {@const annoLabelBaseline = annoAxisGeom.axisRegionHeight + textRegionHeight(annoLabelSize, 1.5) - 4}
                  <text
                    x={colScale(annotation.x)}
                    y={rowsAreaHeight + axisGap + annoLabelBaseline + yOffset}
                    text-anchor="middle"
                    fill={annotation.color ?? "var(--tv-axis-label-fg, var(--tv-text-muted))"}
                    font-size={annoLabelSize}
                    font-weight="var(--tv-text-label-weight, 500)"
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
                      {@const annRowY = rowLayout.markerCenters?.[ri] ?? ((rowLayout.positions[ri] ?? ri * layout.rowHeight) + (rowLayout.heights[ri] ?? layout.rowHeight) / 2)}
                      {@const markerX = colScale(ptVal)}
                      {@const offset = customAnn.position === "before" ? -14 : customAnn.position === "after" ? 14 : 0}
                      {@const annX = markerX + offset}
                      {@const sz = 5 * (customAnn.size ?? 1)}
                      {#if customAnn.shape === "circle"}
                        <circle cx={annX} cy={annRowY} r={sz} fill={customAnn.color} stroke={annStroke} stroke-width="0.5" />
                      {:else if customAnn.shape === "square"}
                        <rect x={annX - sz} y={annRowY - sz} width={2*sz} height={2*sz} fill={customAnn.color} stroke={annStroke} stroke-width="0.5" />
                      {:else if customAnn.shape === "triangle"}
                        <polygon points={`${annX},${annRowY - sz} ${annX - sz},${annRowY + sz} ${annX + sz},${annRowY + sz}`} fill={customAnn.color} stroke={annStroke} stroke-width="0.5" />
                      {:else if customAnn.shape === "star"}
                        <polygon points={(() => { const pts=[]; for(let k=0;k<10;k++){const r=k%2===0?sz*1.2:sz*0.5; const a=Math.PI/2 + k*Math.PI/5; pts.push(`${annX + r*Math.cos(a)},${annRowY - r*Math.sin(a)}`);} return pts.join(" "); })()} fill={customAnn.color} stroke={annStroke} stroke-width="0.5" />
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
                {@const markerY = rowLayout.markerCenters?.[i] ?? rowY + rowH / 2}
                {@const vizCellStyle = getCellStyle(displayRow.row, fc.column)}
                <RowInterval
                  row={displayRow.row}
                  yPosition={markerY}
                  xScale={colScale}
                  plotWidth={forestWidth}
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
                plotWidth={forestWidth}
              />
            {/if}
            </g>

            <!-- Axis at bottom (not clipped; ticks reflect zoom via colScale) -->
            {#if forestOpts?.showAxis !== false}
              <g transform="translate(0, {rowsAreaHeight + axisGap})">
                <EffectAxis xScale={colScale} layout={layout} plotWidth={forestWidth} {theme} axisLabel={axisLabel} position="bottom" plotHeight={layout.plotHeight} baseTicks={store.getAxisZoom(fc.column.id) ? undefined : forestAxes.get(fc.column.id)?.ticks} />
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
            aria-hidden="true"
              width={vizWidth}
              height={rowsAreaHeight + layout.axisHeight}
              viewBox="0 0 {vizWidth} {rowsAreaHeight + layout.axisHeight}"
              style:top="{actualHeaderHeight}px"
              style:left="{vizLeft}px"
              use:zoomable={{
                columnId: vc.column.id,
                isLog: vcIsLog,
                getDomain: () => (sharedScale ? (sharedScale.domain() as [number, number]) : [0, 1]),
                getPixelRange: () => forestScaleRange(vizWidth),
                onChange: (d) => store.setAxisZoom(vc.column.id, d),
                onReset: () => store.resetAxisZoom(vc.column.id),
                enabled: enableAxisZoom && !!sharedScale,
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
                      stroke={annotation.color ?? "var(--tv-border)"}
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
                  {@const markerY = rowLayout.markerCenters?.[i] ?? rowY + rowH / 2}
                  <VizBar
                    row={displayRow.row}
                    yPosition={markerY}
                    rowHeight={rowH}
                    options={vizOpts}
                    {theme}
                    sharedScale={sharedScale!}
                  />
                {/if}
              {/each}
              </g>

              <!-- Axis at bottom (unclipped; ticks reflect current domain) -->
              {#if vizOpts.showAxis !== false && sharedScale}
                <g transform="translate(0, {rowsAreaHeight + axisGap})">
                  <EffectAxis
                    xScale={sharedScale}
                    layout={{ ...layout, nullValue: 0 }} plotWidth={vizWidth}
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
            aria-hidden="true"
              width={vizWidth}
              height={rowsAreaHeight + layout.axisHeight}
              viewBox="0 0 {vizWidth} {rowsAreaHeight + layout.axisHeight}"
              style:top="{actualHeaderHeight}px"
              style:left="{vizLeft}px"
              use:zoomable={{
                columnId: vc.column.id,
                isLog: vcIsLog,
                getDomain: () => (sharedScale ? (sharedScale.domain() as [number, number]) : [0, 1]),
                getPixelRange: () => forestScaleRange(vizWidth),
                onChange: (d) => store.setAxisZoom(vc.column.id, d),
                onReset: () => store.resetAxisZoom(vc.column.id),
                enabled: enableAxisZoom && !!sharedScale,
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
                      stroke={annotation.color ?? "var(--tv-border)"}
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
                  {@const markerY = rowLayout.markerCenters?.[i] ?? rowY + rowH / 2}
                  <VizBoxplot
                    row={displayRow.row}
                    yPosition={markerY}
                    rowHeight={rowH}
                    options={vizOpts}
                    {theme}
                    sharedScale={sharedScale!}
                  />
                {/if}
              {/each}
              </g>

              <!-- Axis at bottom (unclipped; ticks reflect current domain) -->
              {#if vizOpts.showAxis !== false && sharedScale}
                <g transform="translate(0, {rowsAreaHeight + axisGap})">
                  <EffectAxis
                    xScale={sharedScale}
                    layout={{ ...layout, nullValue: 0 }} plotWidth={vizWidth}
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
            aria-hidden="true"
              width={vizWidth}
              height={rowsAreaHeight + layout.axisHeight}
              viewBox="0 0 {vizWidth} {rowsAreaHeight + layout.axisHeight}"
              style:top="{actualHeaderHeight}px"
              style:left="{vizLeft}px"
              use:zoomable={{
                columnId: vc.column.id,
                isLog: vcIsLog,
                getDomain: () => (sharedScale ? (sharedScale.domain() as [number, number]) : [0, 1]),
                getPixelRange: () => forestScaleRange(vizWidth),
                onChange: (d) => store.setAxisZoom(vc.column.id, d),
                onReset: () => store.resetAxisZoom(vc.column.id),
                enabled: enableAxisZoom && !!sharedScale,
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
                      stroke={annotation.color ?? "var(--tv-border)"}
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
                  {@const markerY = rowLayout.markerCenters?.[i] ?? rowY + rowH / 2}
                  <VizViolin
                    row={displayRow.row}
                    yPosition={markerY}
                    rowHeight={rowH}
                    options={vizOpts}
                    {theme}
                    sharedScale={sharedScale!}
                  />
                {/if}
              {/each}
              </g>

              <!-- Axis at bottom (unclipped; ticks reflect current domain) -->
              {#if vizOpts.showAxis !== false && sharedScale}
                <g transform="translate(0, {rowsAreaHeight + axisGap})">
                  <EffectAxis
                    xScale={sharedScale}
                    layout={{ ...layout, nullValue: 0 }} plotWidth={vizWidth}
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

        <!-- ARRANGE MODE seams (interactivity-UX arc P2). All layout
             gestures live behind the arrange tool: arming it reveals
             every seam with a visible handle + px readout. Two gesture
             families share the seam grammar but write different tiers:
               · structural spacing (header height, group gaps) → THEME
                 spacing (travels with the theme)
               · row body heights → per-KIND figure pins (RowEdgeHandles
                 below; figure state, rides spec.figureLayout)
             The old per-row `spacing.rowHeight` seam is gone — overall
             row height is density's job; per-kind pins own row seams. -->
        {#if arrangeArmed && theme}
          {@const headerHeightPx = layout.headerHeight}
          {@const rowGroupPadding = theme.spacing.rowGroupPadding ?? 0}
          <!-- Header height: bottom edge of the column-header band -->
          <EdgeResize
            value={theme.spacing.headerHeight}
            min={0}
            max={120}
            armed
            onpreview={(v) => store.previewThemeField("spacing", "headerHeight", v)}
            oncommit={(v) => store.setThemeField("spacing", "headerHeight", v)}
            label="Header height"
            top={`${headerHeightPx}px`}
          />
          {#each displayRows as displayRow, i (getDisplayRowKey(displayRow, i))}
            {#if displayRow.type === "data" && displayRow.row.style?.type !== "spacer" && rowPaddedAfter[i]}
              <!-- Row group padding handle: top edge of the following
                   group_header (= bottom of the empty separator strip).
                   Drag to grow / shrink the gap. -->
              {@const groupTop = headerHeightPx + layout.rowPositions[i] + layout.rowHeights[i]}
              <EdgeResize
                value={rowGroupPadding}
                min={0}
                max={60}
                armed
                onpreview={(v) => store.previewThemeField("spacing", "rowGroupPadding", v)}
                oncommit={(v) => store.setThemeField("spacing", "rowGroupPadding", v)}
                label="Row group padding"
                top={`${groupTop}px`}
              />
            {/if}
          {/each}
          <!-- Per-row-kind height handles: VISIBLE bottom edge of every row.
               Mounted HERE — the same coordinate space as the spacing
               seams (rows-region positions + header offset), which is
               what the old root-level mount never had. trailingPads keeps
               handles off the group-gap seam at track bottoms (and the
               trailing pad out of the pinned kind height). -->
          <RowEdgeHandles
            {store}
            rowPositions={layout.rowPositions ?? []}
            rowHeights={layout.rowHeights ?? []}
            {displayRows}
            trailingPads={displayRows.map((_, i) => (rowPaddedAfter[i] ? rowGroupPadding : 0))}
            topOffset={layout.headerHeight}
            enabled={arrangeArmed}
          />
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

      {#if legendEntries.length > 0}
        <!-- Series legend — inside the paper, under the table, so the
             key travels with the data card. Shared resolver with the
             SVG export (lib/legend.ts) keeps key == marks. -->
        <div class="tv-legend" role="list" aria-label="Series legend">
          {#each legendEntries as entry (entry.label)}
            <span class="tv-legend-entry" role="listitem">
              <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
                <!-- eslint-disable-next-line svelte/no-at-html-tags -- shape glyph from our own literal generator -->
                {@html legendGlyphSvg(entry.shape, 6, 6, 9, entry.color)}
              </svg>
              <span class="tv-legend-label">{entry.label}</span>
            </span>
          {/each}
        </div>
      {/if}
      </div><!-- /.tv-paper -->

      <!-- Plot footer (caption, footnote) — figure annotation BELOW the
           data card, on the shell surface (lab .sci-foot). -->
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
        {arrangeArmed}
      />
    </div><!-- /.tabviz-scalable -->
    </div><!-- /.tv-shell -->

    <!-- Live px readout riding the column-resize drag (seam grammar P2).
         position: fixed in viewport coords — the root container carries no
         transform (only .tabviz-scalable does), so fixed works here. -->
    {#if columnReadout}
      <div
        class="column-resize-readout"
        style="left: {columnReadout.x + 12}px; top: {columnReadout.y - 28}px;"
        aria-hidden="true"
      >{columnReadout.text}</div>
    {/if}

    <!-- Tooltip + DropIndicator + EditableCell + ColumnFilterPopover +
         HeaderContextMenu + ColumnTypeMenu + ColumnEditorPopover. All
         encapsulated by TabvizOverlays as of Phase 0c-C2. -->
    <TabvizOverlays bind:this={overlays} {store} {containerRef} />

  {:else}
    <div class="tabviz-empty">No data</div>
  {/if}
</div>



<script lang="ts" module>
  import type { RowStyle } from "$types";
  import { activeSemanticToken as activeSemanticTokenMod } from "$lib/semantic-styling";
  import { resolveStyleMapping } from "$lib/style-mapping-resolve";
  import type { EffectiveBanks } from "../schema/banks";

  // Note: formatNumber, formatEvents, formatInterval, addThousandsSep, abbreviateNumber are imported from $lib/formatters

  function getRowClasses(
    style?: RowStyle,
    bandIndex?: 0 | 1 | null
  ): string {
    const classes: string[] = [];

    // row-header / row-summary are kind-named CSS hooks; derive via RowKind.
    const styleKind = resolveRowKind({ type: "data", row: { style } });
    if (styleKind === "header") classes.push("row-header");
    if (styleKind === "summary") classes.push("row-summary");
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
    bundle: SemanticBundle | null,
  ): string {
    const styles: string[] = [];

    if (style?.color) styles.push(`color: ${style.color}`);
    // NB: background-color is handled at the call site via `effectiveBg` +
    // `style:background-color` so per-row bg / group-header tint / semantic
    // bundle bg all flow through one precedence ladder without fighting the
    // `style=` attribute. Leaving it here would make the `style:` directive
    // (with `undefined`) overwrite this value.
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

  // Get cell style for a specific column from row.cellStyles or
  // column.styleMapping. Delegates the styleMapping resolution to the
  // shared `lib/style-mapping-resolve` helper (schema-sprint Phase 5),
  // which handles all four MappedValue kinds + the legacy bare-string
  // field form. Conditions are looked up against `banks`, indexed by
  // `rowIndex` into the canonical `spec.data.rows[]`.
  function getCellStyleBase(
    row: Row,
    column: ColumnSpec,
    rowIndex: number | undefined,
    banks: EffectiveBanks | null | undefined,
  ): CellStyle | undefined {
    // Pre-computed cellStyles from R serialization win outright.
    if (row.cellStyles?.[column.field]) {
      return row.cellStyles[column.field];
    }
    if (column.styleMapping) {
      return resolveStyleMapping(row, rowIndex, column, banks);
    }
    return undefined;
  }
</script>

<style>
  /*
   * Opacity percentages in color-mix() below are CSS-local by necessity:
   * color-mix() doesn't accept a CSS custom property for the percentage, so
   * they can't be driven from a token or a TS constant. The two values are:
   *   5%  group-header row background tint (primary)
   *  12%  hovered row tint
   * (The former TS "mirror" constants were unconsumed dead weight — removed
   * 2026-06-15. These CSS values are now the single source.)
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
    font-family: var(--tv-text-body-family);
    font-size: var(--tv-text-body-size);
    /* Schema render-tree token aliases (WYSIWYG review pass). RenderTree
       consumes --tabviz-* vars that NOTHING used to emit, so every
       schema-dispatched fragment (badge/stars/ring text, minor/muted
       compositions) fell back to literals (12px/#888/inherit) in the DOM
       while the SVG export resolved the same tokens through the theme —
       a "typography inconsistent" smoking gun. These aliases mirror the
       export's token table (svg-generator makeTokenResolvers); keep the
       two in lockstep. Also gives --tv-text-cell-size its DOM consumer. */
    --tabviz-text-major: var(--tv-text-body-size, 14px);
    --tabviz-text-base: var(--tv-text-cell-size, var(--tv-text-body-size, 14px));
    --tabviz-text-minor: var(--tv-text-label-size, 10.5px);
    --tabviz-fg-primary: var(--tv-text);
    --tabviz-fg-secondary: var(--tv-text-muted);
    --tabviz-fg-muted: var(--tv-text-subtle, #888);
    --tabviz-fg-accent: var(--tv-accent);
    --tabviz-font-base: var(--tv-text-body-family);
    --tabviz-font-display: var(--tv-text-title-family, var(--tv-text-body-family));
    --tabviz-font-number: var(--tv-text-numeric-family, var(--tv-text-body-family));
    --tabviz-bg-muted: var(--tv-cell-border, rgba(0, 0, 0, 0.05));
    --tabviz-bg-base: transparent;
    --tabviz-font-mono: ui-monospace, SFMono-Regular, monospace;
    /* Approximates the export's theme.accent.tintSubtle (no cssVar emits
       that value directly); 12% accent over transparent is close enough
       for the render-tree fragments that consume it. */
    --tabviz-bg-accent: color-mix(in srgb, var(--tv-accent, #2563eb) 12%, transparent);
    /* Hover aliases: ~30 widget-chrome rules consume --tv-hover-bg /
       --tv-hover, which nothing emitted (hardcoded slate fallbacks broke
       dark themes). Sourcing them from the manifest's --tv-row-hover-bg
       (previously emitted-but-unconsumed) closes both gaps. KNOWN ISSUE:
       popovers portaled to document.body (zoom dropdown etc.) sit outside
       .tabviz-container and still resolve the literal fallbacks. */
    --tv-hover-bg: var(--tv-row-hover-bg, #e2e8f0);
    --tv-hover: var(--tv-row-hover-bg, #f1f5f9);
    color: var(--tv-text);
    background: var(--tv-surface-bg);
    border: var(--tv-container-border, none);
    border-radius: var(--tv-container-border-radius, var(--tv-radius-lg, 8px));
    /* Phase D gradient surface moved to .tv-shell (theme-runtime.css):
       on the container it was fully occluded by opaque raised bands
       (effects review M5). */
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
     Padding split into longhand so `--tv-spacing-bottom-margin` (theme spacing)
     can extend padding-bottom without re-declaring the whole shorthand.
     Fallbacks are 0 to AGREE with the density substrate (container_padding
     is 0 in every preset — the SHELL owns the figure's air since the
     spacing rework; containerPadding is a page-gutter escape hatch). The
     old 16px fallbacks never fired with a resolved theme present and
     contradicted the substrate — a triple-source incoherence. */
  :global(.tabviz-container.auto-fit) {
    width: 100%;
    padding-top: var(--tv-spacing-container-padding, 0px);
    padding-left: var(--tv-spacing-container-padding, 0px);
    padding-right: var(--tv-spacing-container-padding, 0px);
    padding-bottom: calc(var(--tv-spacing-container-padding, 0px) + var(--tv-spacing-bottom-margin, 0px));
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
    padding-top: var(--tv-spacing-container-padding, 0px);
    padding-left: var(--tv-spacing-container-padding, 0px);
    padding-right: var(--tv-spacing-container-padding, 0px);
    padding-bottom: calc(var(--tv-spacing-container-padding, 0px) + var(--tv-spacing-bottom-margin, 0px));
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

  .tv-legend {
    display: flex;
    flex-wrap: wrap;
    gap: 4px 16px;
    align-items: center;
    justify-content: flex-end;
    padding: 6px var(--tv-spacing-cell-padding-x, 10px) 2px;
    font-size: var(--tv-text-label-size, 11px);
    color: var(--tv-text-muted, #64748b);
  }
  .tv-legend-entry {
    display: inline-flex;
    align-items: center;
    gap: 5px;
  }
  .tv-legend svg { flex: none; }

  .tabviz-scalable {
    display: flex;
    flex-direction: column;
    flex: 1;
    /* No inner padding here by design. The figure's air is owned by the
       SHELL (density-scaled --tv-shell-padding) with an inner mat on the
       paper (--tv-paper-padding); theme.spacing.containerPadding remains
       a page-gutter escape hatch on .tabviz-container (0 by default).
       An additional gutter here would compound with those and give the
       user overlapping sliders. spacing.padding remains an
       SVG-export-only knob. */
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

  /* Outer table top edge — bound to theme.borders.TABLE. Frames the
     header at the very top. The table BOTTOM edge is painted on the
     axis-cell's border-top so the frame sits below the last data row
     and above the axis ticks (rather than at the bottom of
     .tabviz-main, which would put it below the axis).
     Major is reserved for INTERNAL major rules only (header bottom,
     group/summary breaks). Table default thickness 0 = no frame. */
  /* Outer table frame (D26): box-shadow inset draws all 4 edges at the
     overlay's grid bounds (header top → last data row bottom, all columns)
     with ZERO layout impact — supersedes the old `.tabviz-main` border-top,
     which drew only the top edge AND reserved 2px of layout the export's
     overlay rect never did. Table frames are always `single` style across
     presets (borders.ts), so an inset shadow is exact. */
  .table-frame {
    /* position:absolute takes the frame OUT of grid track sizing. A spanning
       IN-FLOW grid item (grid-column: 1/-1) defeats the grid's
       `width: max-content` shrink-wrap and stretches it to the container (the
       wysiwyg width divergence caught 2026-06-13). An ABSOLUTELY-positioned
       grid item still uses its grid area (the grid-row/grid-column set on the
       element) as its containing block, so `inset:0` fills exactly the table
       region with ZERO effect on track sizing. */
    position: absolute;
    inset: 0;
    pointer-events: none;
    box-shadow: inset 0 0 0 var(--tv-table-border-width, 0) var(--tv-border-table-color, transparent);
    z-index: 2;
  }

  /* Base grid cell styles. Row + column dividers both obey
     theme.borders.layout via the row/col border-style tokens
     (`solid` or `none` depending on layout). Colors come from
     theme.borders.minor. */
  .grid-cell {
    padding: 0 var(--tv-spacing-cell-padding-x);
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    display: flex;
    align-items: center;
    border-bottom-width: var(--tv-row-border-width, 1px);
    border-bottom-style: var(--tv-border-row-style, solid);
    border-bottom-color: var(--tv-border-minor-color, var(--tv-cell-border, var(--tv-border)));
    border-right-width: var(--tv-row-border-width, 1px);
    border-right-style: var(--tv-border-col-style, none);
    border-right-color: var(--tv-border-minor-color, var(--tv-cell-border, var(--tv-border)));
    color: var(--tv-text);
    /* Row background: --tv-row-base-bg (v4), falling back to container bg.
       Separate from --tv-surface-bg so users can tint rows distinct from the
       outer container without flipping the whole widget. */
    background: var(--tv-row-base-bg, var(--tv-surface-bg));
  }

  /* Header cells - use row height for multi-row headers. Background is
     the dedicated `--tv-header-bg` (theme.colors.headerBg) so users can
     tint the header row distinctly from data rows. */
  .header-cell {
    min-height: var(--tv-header-row-height);
    font-family: var(--tv-text-header-family, var(--tv-text-body-family));
    font-weight: var(--tv-text-header-weight, var(--tv-font-weight-bold, 600));
    font-style: normal; /* the header-italic token was never emitted since Coh.22 removed italics from v4 typography */
    font-size: var(--tv-text-header-size, calc(var(--tv-text-body-size, 0.875rem) * var(--tv-header-font-scale, 1.05)));
    border-bottom-width: var(--tv-header-border-width, 2px);
    border-bottom-style: var(--tv-border-major-style, solid);
    border-bottom-color: var(--tv-border-major-color, var(--tv-header-rule, var(--tv-border)));
    background: var(--tv-header-bg, var(--tv-row-base-bg, var(--tv-surface-bg)));
    color: var(--tv-header-fg, var(--tv-text));
    position: relative;
    /* Fill sub-pixel hairline gaps between adjacent cells when the
       header has a non-default bg (e.g. bold variant's primary-deep
       fill). At fractional column widths, CSS Grid rounds cell edges
       independently and the page bg bleeds through as bright vertical
       lines. A 0.5px outline of the same bg color over-paints those
       hairlines. Has no visible effect when neighboring cells share
       the same bg (the outline blends in). */
    box-shadow: 0 0 0 0.5px var(--tv-header-bg, transparent);
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
    background: color-mix(in srgb, var(--tv-accent, #2563eb) 12%, var(--tv-surface-bg));
  }

  /* Primary (leftmost) column header — MAJOR bottom (same as leaf headers). */
  .primary-header {
    border-bottom-width: var(--tv-header-border-width, 2px);
    border-bottom-style: var(--tv-border-major-style, solid);
    border-bottom-color: var(--tv-border-major-color, var(--tv-header-rule, var(--tv-border)));
  }

  /* Column group header — bottom is MINOR (the bar above the leaf
     header row), since the major break belongs to the leaf-header
     bottom one row down. */
  .column-group-header {
    justify-content: center;
    font-weight: var(--tv-font-weight-bold, 600);
    text-align: center;
    padding-left: var(--tv-spacing-column-group-padding, 8px);
    padding-right: var(--tv-spacing-column-group-padding, 8px);
    border-bottom-width: var(--tv-row-border-width, 1px);
    border-bottom-style: var(--tv-border-row-style, solid);
    border-bottom-color: var(--tv-border-minor-color, var(--tv-border));
  }

  /* Leaf header row — MAJOR bottom. */
  .header-cell:not(.column-group-header):not(.primary-header):not(.plot-header) {
    border-bottom-width: var(--tv-header-border-width, 2px);
    border-bottom-style: var(--tv-border-major-style, solid);
    border-bottom-color: var(--tv-border-major-color, var(--tv-header-rule, var(--tv-border)));
  }

  /* Plot header — MAJOR bottom. */
  .plot-header {
    border-bottom-width: var(--tv-header-border-width, 2px);
    border-bottom-style: var(--tv-border-major-style, solid);
    border-bottom-color: var(--tv-border-major-color, var(--tv-header-rule, var(--tv-border)));
  }

  .header-text {
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  /* Column resize handle: a 10px hit zone at the column boundary (P2 —
     the old 6px target was sub-pointer-size; the review pass trimmed the
     first cut's 14px so it clears the ColumnDragHandle grip at right:10px
     with zero hit-zone overlap), with a thin 2px visual edge line so the
     affordance doesn't read as chrome. The zone sits fully INSIDE the
     cell: `.grid-cell` clips
     (overflow: hidden for text ellipsis), so a straddling overhang would
     be clipped out of hit-testing. */
  .resize-handle {
    position: absolute;
    right: 0;
    top: 0;
    bottom: 0;
    width: 10px;
    cursor: col-resize;
    background: transparent;
    touch-action: none;
    z-index: 10;
  }

  .resize-handle::after {
    content: "";
    position: absolute;
    right: 0;
    top: 0;
    bottom: 0;
    width: 2px;
    background: var(--tv-accent, #2563eb);
    opacity: 0;
    transition: opacity 0.12s ease;
    pointer-events: none;
  }

  .resize-handle:hover::after,
  .resize-handle:active::after {
    opacity: 0.7;
  }

  .column-resize-readout {
    position: fixed;
    padding: 1px 6px;
    font-family: var(--tv-text-body-family, system-ui);
    font-size: 10px;
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
    color: var(--tv-surface-bg, #fff);
    background: var(--tv-accent, #2563eb);
    border-radius: 3px;
    pointer-events: none;
    z-index: 10005;
  }

  /* Data cells */
  /* Row height is declared on the grid container via `grid-template-rows`
     (see `gridTemplateRows` derived). Cells stretch to the row track via
     the grid's default `align-self: stretch`. Setting `height` here would
     fight the track height and reintroduce the layout-engine vs DOM
     disagreement that pre-v0.21.x intermittent misalignments came from. */
  /* `.data-cell` had a placeholder ruleset here for "extend in v0.22+
     semantic styling"; empty rulesets warn under svelte-check and offer
     no override surface vs. just writing the selector when needed. The
     hook lives in the `.grid-cell.data-cell` selector elsewhere. */

  /* Phase 12: numeric-flavored cells pick `theme.text.numeric` for their
     font family + figure style. Falls back to the body family + tabular
     figures when the theme doesn't pin numeric (resolver guarantees the
     wire field is always present). */
  .numeric-cell {
    font-family: var(--tv-text-numeric-family, var(--tv-text-body-family));
    font-feature-settings: var(--tv-text-numeric-figures, "tnum");
  }

  /* Primary (leftmost) column cell — row identifier, drag surface.
     The first-column variant (theme.variants.firstColumnStyle = "bold")
     drives bg, fg, weight, and a right-edge rule via CSS vars emitted
     in the cssVars block. When the variant is "default", these are
     transparent / inherit and the cell looks like any other. */
  /* Primary (leftmost) cell. Owns the "first column rule" (a separator
     between the label column and the rest), which is only painted when
     the theme's `firstColumnStyle` is "bold" — otherwise --tv-first-col-rule
     resolves to `transparent`.

     When the borders layout is "vertical"/"grid" (--tv-border-col-style:
     solid), every cell paints a right border in --tv-border-minor-color
     via .grid-cell. The primary cell's first-col-rule shouldn't double
     up with that. Solution: when first-col-rule is transparent (the
     default for non-bold variants), don't override .grid-cell's border-
     right; only override when first-col-rule has a real color. We do
     this with border-right-COLOR only, leaving width/style from
     .grid-cell unless the variant explicitly opts in. */
  .primary-cell {
    min-width: 120px;
    background-color: var(--tv-first-col-bg, transparent);
    color: var(--tv-first-col-fg, inherit);
    font-weight: var(--tv-first-col-weight, inherit);
    /* --tv-first-col-rule resolves to the strong rule when first_column_style
       is "bold", else to the standard MINOR divider color (so col1 matches
       every other column under cols/grid). The resolver now always emits a
       concrete color (it used to emit "transparent" when not bold, which made
       the col1/col2 divider vanish under boxed — fixed 2026-06-13); the var()
       fallbacks below are defense-in-depth for hand-authored partial themes. */
    border-right-color: var(--tv-first-col-rule, var(--tv-border-minor-color, var(--tv-border)));
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

  /* Axis row cells — full axis height (gap + content). The row
     hosts EITHER an `.axis-cell` (per column that owns an axis,
     e.g. the forest column) OR an `.axis-spacer` (per column that
     doesn't). The table-frame bottom edge needs to span ALL
     columns — so both classes paint the same border-top using
     the table-frame vars. */
  .axis-spacer,
  .axis-cell {
    height: var(--tv-axis-height);
    border-bottom: none;
    background: var(--tv-surface-bg);
    padding: 0;
    border-top-width: var(--tv-table-border-width, 0);
    border-top-style: var(--tv-table-border-style, none);
    border-top-color: var(--tv-border-table-color, transparent);
    /* Cells default to a right border under cols/grid layout; the
       axis row sits visually outside the table, so suppress that
       too — otherwise the bottom-frame line would have stray
       column-divider continuations into the axis area. */
    border-right-style: none;
  }

  /* Text wrapping mode — pre-line preserves \n and lets long text wrap.
     Grid-template-rows owns the row height (tabvizStore measures wrapped
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
    padding-bottom: var(--tv-spacing-row-group-padding, 0px);
  }
  .grid-cell.group-row-bordered {
    border-bottom: var(--tv-group-border-width, 1px) solid var(--tv-row-group-rule, var(--tv-border));
  }

  .group-row:hover {
    background: color-mix(in srgb, var(--tv-text-subtle) 15%, transparent) !important;
  }

  /* Hovered row styling - uses accent color for better visibility */
  .data-cell.hovered {
    background: color-mix(in srgb, var(--tv-accent) 12%, var(--tv-surface-bg));
    cursor: pointer;
  }

  /* Editable cells: cursor + faint tint on hover so users know to double-click */
  .data-cell.editable:hover {
    background: color-mix(in srgb, var(--tv-accent) 6%, var(--tv-surface-bg));
    cursor: text;
  }
  .data-cell.editable.hovered:hover {
    background: color-mix(in srgb, var(--tv-accent) 12%, color-mix(in srgb, var(--tv-accent) 6%, var(--tv-surface-bg)));
  }

  /* Spacer row styling */
  .spacer-row {
    height: calc(var(--tv-spacing-row-height) / 2);
    border-bottom: none;
    visibility: hidden;
  }

  .spacer-row.plot-cell {
    visibility: visible; /* Keep plot cell visible for spacing */
  }

  .tabviz-empty {
    padding: 24px;
    text-align: center;
    color: var(--tv-text-subtle);
  }

  /* Row type styles (applied to data-cell elements) */
  .row-header {
    font-weight: var(--tv-font-weight-bold, 600);
    background: color-mix(in srgb, var(--tv-text-subtle) 10%, var(--tv-surface-bg));
  }

  .row-summary {
    font-weight: var(--tv-font-weight-bold, 600);
    border-top: 2px solid var(--tv-border);
  }
  /* Summary rows visually span all columns (one "Overall" value
     across the row). Column dividers on data cells would slice the
     summary into segments, which reads as broken. Suppress them. */
  .grid-cell.row-summary {
    border-right-style: none;
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
   * resolved SemanticBundle. Each semantic var (fg/weight/style/…) is either the
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

  /* Phase D — emphasis row picks up the optional box-shadow + glow stack.
     Both default to none / transparent so themes that don't opt into
     effects see no visual change. HC mode drops both via token.modes.hc
     at resolve time. */
  :global(.tabviz-container .data-cell.row-active-emphasis) {
    box-shadow:
      var(--tv-shadow-emphasis, 0 0 0 transparent),
      0 0 var(--tv-glow-blur, 0) var(--tv-glow-spread, 0) var(--tv-glow-color, transparent);
  }

  /* Hero-row inset bar (wire-audit 1c, lab .is-highlight; rgc table-craft):
     the first cell of an emphasis row carries a 3px accent bar. Covers BOTH
     paths — paint-tool emphasis (.row-active-emphasis) AND data-driven
     emphasis from a style-mapping column (.cell-emphasis), the common case
     in an authored table (the teal "this row matters" rail in rgc Ledger).
     Composed with the emphasis/glow stack — every component is a composable
     no-op when its tokens are unset ("none" in a multi-shadow list is
     invalid CSS and silently drops the whole declaration; the resolver
     emits "0 0 0 transparent" for the same reason). */
  :global(.tabviz-container .data-cell.row-active-emphasis:first-child),
  :global(.tabviz-container .data-cell.cell-emphasis:first-child) {
    box-shadow:
      inset 3px 0 0 var(--tv-row-emphasis-bar, transparent),
      var(--tv-shadow-emphasis, 0 0 0 transparent),
      0 0 var(--tv-glow-blur, 0) var(--tv-glow-spread, 0) var(--tv-glow-color, transparent);
  }

  /* Phase D — alternating row dividers honour the hair border-width when
     a theme pins it (rare; most themes keep the default 0.5px hairline). */
  :global(.tabviz-container .data-row.row-odd) {
    border-top-width: var(--tv-border-width-hair, 0.5px);
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
    font-size: var(--tv-text-label-size, 0.75rem);
    background: color-mix(in srgb, var(--tv-accent) 15%, var(--tv-surface-bg, var(--tv-surface-bg)));
    border-radius: 4px;
    color: var(--tv-accent);
  }

  /* Alternating row banding */
  .row-odd {
    background: var(--tv-row-alt-bg);
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
    font-size: var(--tv-text-label-size, 0.75rem);
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
    background: var(--tv-surface-bg, var(--tv-surface-bg, #fff));
    color: var(--tv-text, #1f2937);
    border-radius: 4px;
    cursor: pointer;
    transition: background 120ms ease, border-color 120ms ease, color 120ms ease;
  }
  .pager-btn:hover:not(:disabled) {
    background: color-mix(in srgb, var(--tv-accent, #2563eb) 8%, var(--tv-surface-bg, var(--tv-surface-bg, #fff)));
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
    background: var(--tv-surface-bg, var(--tv-surface-bg, #fff));
    color: var(--tv-text-muted, #64748b);
    border-radius: 4px;
    font-size: var(--tv-text-label-size, 0.75rem);
    cursor: pointer;
    transition: background 120ms ease, color 120ms ease, border-color 120ms ease;
  }
  .pager-mode-btn:hover {
    background: color-mix(in srgb, var(--tv-accent, #2563eb) 8%, var(--tv-surface-bg, var(--tv-surface-bg, #fff)));
    border-color: var(--tv-accent, #2563eb);
    color: var(--tv-accent, #2563eb);
  }
  .pager-mode-btn.active {
    background: var(--tv-accent, #2563eb);
    color: var(--tv-surface-bg, var(--tv-surface-bg, #fff));
    border-color: var(--tv-accent, #2563eb);
  }

  /* Details / disclosure panel — full-width free content under its data row. */
  .tabviz-details-panel {
    grid-column: 1 / -1;
    padding: 8px 12px 10px;
    background: var(--tv-row-alt-bg, #f8fafc);
    border-bottom: 1px solid var(--tv-border, #e2e8f0);
    color: var(--tv-text, #1a1a1a);
    font-size: var(--tv-text-label-size, 0.8125rem);
    line-height: 1.5;
    overflow-wrap: anywhere;
  }
  .tabviz-details-panel :global(p) { margin: 0 0 0.4em; }
  .tabviz-details-panel :global(p:last-child) { margin-bottom: 0; }
  .tabviz-details-panel :global(h1),
  .tabviz-details-panel :global(h2),
  .tabviz-details-panel :global(h3) { margin: 0.2em 0 0.3em; font-size: 1em; font-weight: 600; }
  .tabviz-details-panel :global(ul),
  .tabviz-details-panel :global(ol) { margin: 0.2em 0; padding-left: 1.4em; }
  .tabviz-details-panel :global(code) {
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    font-size: 0.92em;
    background: var(--tv-border, #e2e8f0);
    padding: 0.05em 0.3em;
    border-radius: 3px;
  }
  .tabviz-details-panel :global(a) { color: var(--tv-accent, #2563eb); }

  /* Disclosure toggle on an expandable row's primary cell. */
  .details-toggle {
    border: none;
    background: transparent;
    cursor: pointer;
    padding: 0 4px 0 0;
    color: var(--tv-text-muted, #64748b);
    font-size: 0.7rem;
    line-height: 1;
    display: inline-block;
    transition: transform 0.12s ease;
  }
  .details-toggle.open { transform: rotate(90deg); }

</style>

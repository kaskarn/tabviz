import type { SplitForestPayload, NavTreeNode, WebSpec, WebTheme, ColumnDef, ColumnSpec } from "$types";
import { createTabvizStore } from "./tabvizStore.svelte";
import { type ThemeName } from "$lib/theme/theme-presets";
import { ops } from "$lib/op-recorder";
import { assertValidSpec } from "$spec/validate.ts";
import { computeSharedWidths as computeSharedColumnWidths, type SubsetSpec } from "$lib/split-shared";

/**
 * Flatten a `WebSpec.columns` array into its leaf `ColumnSpec` entries —
 * descends into `ColumnGroup` children. The split-widget code paths that
 * compute shared widths or snapshot original widths operate per-leaf, so
 * groups are transparent here.
 */
function leafColumns(cols: ColumnDef[] | undefined): ColumnSpec[] {
  if (!cols) return [];
  const out: ColumnSpec[] = [];
  for (const c of cols) {
    if ("isGroup" in c && c.isGroup) {
      out.push(...leafColumns(c.columns));
    } else {
      out.push(c as ColumnSpec);
    }
  }
  return out;
}


/**
 * Store for managing split forest navigation and display state.
 * Wraps multiple TabvizStore instances, one for each split.
 */
/**
 * Internal payload shape after `setPayload` reconstitutes any
 * hoisted-base wire format. Once stored, every spec under `payload.specs`
 * is a fully-merged WebSpec — the union with SplitSubviewOverride lives
 * only on the wire-format side (SplitForestPayload).
 */
type MergedSplitPayload = Omit<SplitForestPayload, "specs"> & {
  specs: Record<string, WebSpec>;
};

export function createSplitTabvizStore() {
  // Core state
  let payload = $state<MergedSplitPayload | null>(null);
  let activeKey = $state<string | null>(null);
  // Provenance of the most-recent activeKey change. Read by the Shiny binding
  // when emitting input$<id>_active_plot so dashboards can disambiguate their
  // own selectPlot pushes from user clicks.
  let activeKeySource = $state<"user" | "proxy">("user");
  let searchQuery = $state("");
  let expandedNodes = $state<Set<string>>(new Set());
  let sidebarCollapsed = $state(false);
  let sharedColumnWidths = $state(false);
  // Snapshot of each spec's original per-column widths at payload load time
  // — lets us restore on toggle-off without re-fetching from the server.
  // Keyed as specKey → colId → original width (undefined = auto).
  let originalWidths: Map<string, Map<string, number | "auto" | undefined>> = new Map();

  // Theme persistence — stores the user-selected theme so leaf navigation
  // can re-apply it. We track BOTH the resolved object (preferred) and the
  // preset name (fallback). The local THEME_PRESETS table is v1-shaped and
  // can't be fed to the v2 renderer; we only fall through to it if no v2
  // theme object was supplied.
  let userTheme = $state<ThemeName | null>(null);
  let userThemeObject = $state<WebTheme | null>(null);

  // Full theme snapshot captured from the active forest store before each
  // navigation. Lifts cascade edits, overrides, and themeEdits above the
  // subview tier so they persist across selectSpec() calls -- without this,
  // editing theme on subview B and switching to A wipes B's edits because
  // setSpec() resets themeEdits/themeOverrides.
  type ThemeSnapshot = ReturnType<NonNullable<ReturnType<typeof createTabvizStore>["captureThemeSnapshot"]>>;
  let themeSnapshot = $state<ThemeSnapshot | null>(null);

  // Container dimensions
  let containerWidth = $state(800);
  let containerHeight = $state(600);

  // Sidebar width (includes margin)
  const SIDEBAR_WIDTH = 216;  // 200px sidebar + 8px margin each side
  const SIDEBAR_COLLAPSED_WIDTH = 44;  // 36px + margins

  // Create a single store for the active spec
  // We reuse this store and update its spec when navigation changes
  const activeStore = createTabvizStore();

  // Derived: filtered nav tree (for search)
  const filteredNavTree = $derived.by((): NavTreeNode[] => {
    if (!payload) return [];
    if (!searchQuery.trim()) return payload.navTree;
    return filterTree(payload.navTree, searchQuery.toLowerCase());
  });

  // Derived: all leaf keys (for keyboard navigation)
  const allLeafKeys = $derived.by((): string[] => {
    if (!payload) return [];
    return collectLeafKeys(payload.navTree);
  });

  // Derived: current index in leaf keys
  const currentIndex = $derived.by((): number => {
    if (!activeKey) return -1;
    return allLeafKeys.indexOf(activeKey);
  });

  // Derived: split variable names (for section headers)
  const splitVars = $derived.by((): string[] => {
    return payload?.splitVars ?? [];
  });

  // Derived: effective sidebar width
  const effectiveSidebarWidth = $derived.by((): number => {
    return sidebarCollapsed ? SIDEBAR_COLLAPSED_WIDTH : SIDEBAR_WIDTH;
  });

  // Actions
  function setPayload(p: SplitForestPayload) {
    // Hoisted-base wire format: R serializes shared blocks (theme, columns,
    // interaction, ...) once at the payload root; per-subview entries carry
    // only data + labels. Reconstitute full WebSpecs here so everything
    // downstream (column-width snapshot, store activation, TabvizPlot mount)
    // sees the familiar shape. Older payloads carry full specs and skip
    // this step; both formats work.
    if (p.base) {
      const base = p.base;
      const merged: Record<string, WebSpec> = {};
      for (const [key, override] of Object.entries(p.specs)) {
        // Stamp the payload-root wire version onto each reconstituted pane:
        // R hoists `version` to the payload root (not into `base`), and the
        // per-pane override carries only data/labels — so a merged spec would
        // otherwise lack `version` and fail the ingress wall below.
        merged[key] = { ...base, ...(override as Partial<WebSpec>), version: p.version } as WebSpec;
      }
      payload = { ...p, specs: merged };
    } else {
      // No hoisted base — wire specs are already full WebSpecs.
      payload = p as MergedSplitPayload;
    }
    // Ingress wall (mirrors createTabviz): every reconstituted pane spec is
    // validated BEFORE the column-width snapshot derefs `spec.columns`, so a
    // malformed pane throws the clear SpecValidationError (keyed by pane name)
    // instead of crashing cryptically in leafColumns().
    for (const [key, spec] of Object.entries(payload.specs)) {
      try {
        assertValidSpec(spec);
      } catch (e) {
        if (e instanceof Error) e.message = `split pane "${key}": ${e.message}`;
        throw e;
      }
    }
    // Snapshot original per-spec column widths. When the R arg
    // `shared_column_widths = TRUE` was passed, the widths stamped by the
    // server are captured here as the "baseline" — toggling off after
    // load restores nothing (they were already aligned), but subsequent
    // toggle-on/off operations from a user-modified state do the right
    // thing.
    originalWidths = new Map();
    for (const [key, spec] of Object.entries(payload.specs)) {
      const colMap = new Map<string, number | "auto" | undefined>();
      for (const col of leafColumns(spec.columns)) {
        colMap.set(col.id, col.width ?? undefined);
      }
      originalWidths.set(key, colMap);
    }
    sharedColumnWidths = p.sharedColumnWidths ?? false;
    // Default to first leaf spec
    const firstLeaf = findFirstLeaf(p.navTree);
    if (firstLeaf) {
      selectSpec(firstLeaf);
    }
  }

  /**
   * Compute the shared per-column-id width across every spec. Routes through
   * the CANONICAL `lib/split-shared.computeSharedWidths` — the exact font-aware,
   * rank+top-K estimator the V8/R build-time path uses (`split_table()` /
   * `tabviz(shared_column_widths = TRUE)`) — instead of the old font-blind
   * `maxChars * 8` heuristic, so the interactive toggle lands on the SAME
   * numbers the exported figure does (it previously diverged). The font is
   * left to the estimator's default for now; exact non-Inter-theme parity
   * would pass each subset's resolved body family (see D-note).
   */
  function computeSharedWidths(): Map<string, number> {
    const result = new Map<string, number>();
    if (!payload) return result;

    const specs = Object.values(payload.specs);
    if (specs.length === 0) return result;

    const subsets: SubsetSpec[] = specs.map((s) => {
      const cols = leafColumns(s.columns);
      const rows = Array.isArray(s.data) ? s.data : [];
      // Row-major spec data → the column-major vectors the estimator wants.
      const dataColumns: Record<string, unknown[]> = {};
      for (const col of cols) {
        const field = col.field;
        if (field && !(field in dataColumns)) {
          dataColumns[field] = rows.map((row) => (row as Record<string, unknown>)[field]);
        }
      }
      return {
        data: { columns: dataColumns, rowStyleTypes: null },
        columns: cols.map((c) => ({
          id: c.id,
          type: c.type,
          field: c.field ?? null,
          header: c.header ?? null,
          width: typeof c.width === "number" ? c.width : null,
          options: c.options as Record<string, unknown> | undefined,
        })),
      };
    });

    const { widths } = computeSharedColumnWidths({ subsets });
    for (const [id, w] of Object.entries(widths)) result.set(id, w);
    return result;
  }

  // INVARIANT (hoisted-base wire format): when `p.base` was present, every
  // entry in `payload.specs` was produced by `{ ...base, ...override }` — a
  // shallow spread. `base.columns` is therefore the SAME array reference on
  // every merged spec. The N-times outer loop below writes to the same
  // column objects N times; the result is idempotent and correct, but the
  // work is wasted for shared-base payloads. Detecting + skipping the
  // duplicate writes would complicate the code; we keep the simple form.
  //
  // Legacy wire format (no `p.base`): each spec has independent columns;
  // the per-spec iteration writes each column exactly once. No
  // cross-contamination because the column objects aren't shared.
  //
  // Both paths are correct. Audited 2026-05-14.
  function setSharedColumnWidths(enabled: boolean) {
    if (!payload) return;
    sharedColumnWidths = enabled;

    if (enabled) {
      const widths = computeSharedWidths();
      for (const spec of Object.values(payload.specs)) {
        for (const col of leafColumns(spec.columns)) {
          const w = widths.get(col.id);
          if (w != null) col.width = w;
        }
      }
    } else {
      for (const [key, spec] of Object.entries(payload.specs)) {
        const orig = originalWidths.get(key);
        if (!orig) continue;
        for (const col of leafColumns(spec.columns)) {
          col.width = orig.get(col.id);
        }
      }
    }

    // Re-apply the active spec so the activeStore picks up new widths and
    // rerenders. NOTE (interactivity arc P0): setSpec now RECONCILES
    // user-resized column widths across spec swaps instead of wiping them,
    // and split subsets share column ids — so toggling shared widths does
    // NOT override columns the user resized by hand (their pin beats the
    // stamped width in the flex distribution). That's the figure-state
    // contract working as designed; the opLog still resets, so push the
    // split-level op record AFTER the reset.
    if (activeKey) {
      const spec = payload.specs[activeKey];
      if (spec) activeStore.setSpec(spec);
    }
    // Record into the active sub-plot's log so the "View source" panel
    // surfaces it alongside any other edits. `tbl` in the emitted R code
    // is a SplitForest when split_by was used, so the call is valid.
    activeStore.recordOp(ops.setSharedColumnWidths(enabled));
  }

  function selectSpec(key: string, source: "user" | "proxy" = "user") {
    if (!payload) return;

    // Snapshot the active store's theme state BEFORE switching specs --
    // setSpec() clears themeEdits/themeOverrides, so cascade edits would
    // be lost without this. Skipped on initial load (no prior activeKey).
    if (activeKey && activeStore.spec) {
      themeSnapshot = activeStore.captureThemeSnapshot();
    }

    activeKey = key;
    activeKeySource = source;
    const spec = payload.specs[key];
    if (spec) {
      activeStore.setSpec(spec);
      // Restore order matters: snapshot reapplication wins over the
      // theme-name/object fallback because it carries the full edit history
      // (cascades + overrides + themeEdits). Fallbacks only fire if no
      // snapshot exists yet (e.g. theme was switched via the picker before
      // any navigation).
      if (themeSnapshot) {
        activeStore.applyThemeSnapshot(themeSnapshot);
      } else if (userThemeObject) {
        activeStore.setThemeObject(userThemeObject);
      } else if (userTheme) {
        activeStore.setTheme(userTheme);
      }
      // Update dimensions accounting for sidebar
      activeStore.setDimensions(containerWidth - effectiveSidebarWidth, containerHeight);
    }
    // Expand path to selection and collapse siblings for focused view
    focusOnPath(key);
  }

  function setDimensions(width: number, height: number) {
    containerWidth = width;
    containerHeight = height;
    // Update active store dimensions
    activeStore.setDimensions(width - effectiveSidebarWidth, height);
  }

  function toggleSidebar() {
    sidebarCollapsed = !sidebarCollapsed;
    // Update active store dimensions with new sidebar width
    activeStore.setDimensions(containerWidth - effectiveSidebarWidth, containerHeight);
  }

  function setSearch(query: string) {
    searchQuery = query;
  }

  function toggleExpanded(key: string) {
    const newExpanded = new Set(expandedNodes);
    if (newExpanded.has(key)) {
      newExpanded.delete(key);
    } else {
      newExpanded.add(key);
    }
    expandedNodes = newExpanded;
  }

  function focusOnPath(key: string) {
    // Only keep the path to the active key expanded, collapse everything else
    const parts = key.split("__");
    const newExpanded = new Set<string>();
    let path = "";
    for (let i = 0; i < parts.length - 1; i++) {
      path = path ? `${path}__${parts[i]}` : parts[i];
      newExpanded.add(path);
    }
    expandedNodes = newExpanded;
  }


  function selectNext() {
    if (currentIndex >= 0 && currentIndex < allLeafKeys.length - 1) {
      selectSpec(allLeafKeys[currentIndex + 1]);
    }
  }

  function selectPrevious() {
    if (currentIndex > 0) {
      selectSpec(allLeafKeys[currentIndex - 1]);
    }
  }

  function setTheme(themeName: ThemeName) {
    userTheme = themeName;
    userThemeObject = null;
    // Theme-picker is an intent to start fresh -- discard any cascade
    // snapshot from before the switch.
    themeSnapshot = null;
    activeStore.setTheme(themeName);
  }

  // Apply a v2 WebTheme directly. ThemeSwitcher prefers this path whenever
  // it can resolve the theme key against `availableThemes`, since the local
  // preset-name fallback is v1-shaped and would crash the renderer.
  function setThemeObject(theme: WebTheme, themeName?: ThemeName) {
    userThemeObject = theme;
    userTheme = themeName ?? null;
    themeSnapshot = null;
    activeStore.setThemeObject(theme);
  }

  return {
    // Getters
    get payload() { return payload; },
    get activeKey() { return activeKey; },
    get activeKeySource() { return activeKeySource; },
    get activeStore() { return activeStore; },
    get navTree() { return filteredNavTree; },
    get searchQuery() { return searchQuery; },
    get expandedNodes() { return expandedNodes; },
    get splitVars() { return splitVars; },
    get sidebarWidth() { return effectiveSidebarWidth; },
    get sidebarCollapsed() { return sidebarCollapsed; },
    get sharedColumnWidths() { return sharedColumnWidths; },

    // Actions
    setPayload,
    selectSpec,
    setDimensions,
    setSearch,
    toggleExpanded,
    toggleSidebar,
    selectNext,
    selectPrevious,
    setTheme,
    setThemeObject,
    setSharedColumnWidths,
  };
}

export type SplitTabvizStore = ReturnType<typeof createSplitTabvizStore>;

// ============================================================================
// Helper functions
// ============================================================================

/**
 * Filter tree nodes by search query (case-insensitive).
 * Includes parent nodes if any descendant matches.
 */
function filterTree(nodes: NavTreeNode[], query: string): NavTreeNode[] {
  const result: NavTreeNode[] = [];

  for (const node of nodes) {
    const labelMatches = node.label.toLowerCase().includes(query);

    if (node.children && node.children.length > 0) {
      const filteredChildren = filterTree(node.children, query);
      if (filteredChildren.length > 0 || labelMatches) {
        result.push({
          ...node,
          children: filteredChildren.length > 0 ? filteredChildren : node.children,
        });
      }
    } else if (labelMatches) {
      result.push(node);
    }
  }

  return result;
}

/**
 * Find the first leaf node (no children) in the tree.
 */
function findFirstLeaf(nodes: NavTreeNode[]): string | null {
  for (const node of nodes) {
    if (!node.children || node.children.length === 0) {
      return node.key;
    }
    const childLeaf = findFirstLeaf(node.children);
    if (childLeaf) return childLeaf;
  }
  return null;
}

/**
 * Collect all leaf keys in tree order.
 */
function collectLeafKeys(nodes: NavTreeNode[]): string[] {
  const keys: string[] = [];

  function traverse(nodes: NavTreeNode[]) {
    for (const node of nodes) {
      if (!node.children || node.children.length === 0) {
        keys.push(node.key);
      } else {
        traverse(node.children);
      }
    }
  }

  traverse(nodes);
  return keys;
}

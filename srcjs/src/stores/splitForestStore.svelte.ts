import type { SplitForestPayload, NavTreeNode, WebSpec } from "$types";
import { createForestStore, type ForestStore } from "./forestStore.svelte";
import { type ThemeName } from "$lib/theme-presets";
import { ops } from "$lib/op-recorder";

// Column types whose width is driven by the visualization itself, not its
// data text content. We skip these when estimating shared widths — their
// auto-sizing is already driven by the plot, not string length.
const VIZ_COLUMN_TYPES = new Set([
  "viz_bar",
  "viz_boxplot",
  "viz_violin",
  "forest",
  "viz_forest",
]);

/**
 * Estimate a px width from a column's header + data content. Mirrors the
 * R-side heuristic in `R/split_table.R` so the interactive toggle lands on
 * numbers consistent with what `tabviz(shared_column_widths = TRUE)` produces.
 * Not meant to be pixel-perfect — tight enough for slide alignment.
 */
function estimateColumnWidth(header: string | undefined, values: unknown[]): number {
  let maxChars = (header ?? "").length;
  for (const v of values) {
    const s = v == null ? "" : String(v);
    if (s.length > maxChars) maxChars = s.length;
  }
  return Math.max(40, Math.min(480, maxChars * 8 + 24));
}

/**
 * Store for managing split forest navigation and display state.
 * Wraps multiple ForestStore instances, one for each split.
 */
export function createSplitForestStore() {
  // Core state
  let payload = $state<SplitForestPayload | null>(null);
  let activeKey = $state<string | null>(null);
  let searchQuery = $state("");
  let expandedNodes = $state<Set<string>>(new Set());
  let sidebarCollapsed = $state(false);
  let sharedColumnWidths = $state(false);
  // Snapshot of each spec's original per-column widths at payload load time
  // — lets us restore on toggle-off without re-fetching from the server.
  // Keyed as specKey → colId → original width (undefined = auto).
  let originalWidths: Map<string, Map<string, number | "auto" | undefined>> = new Map();

  // Theme persistence - stores user-selected theme across navigation
  let userTheme = $state<ThemeName | null>(null);

  // Container dimensions
  let containerWidth = $state(800);
  let containerHeight = $state(600);

  // Sidebar width (includes margin)
  const SIDEBAR_WIDTH = 216;  // 200px sidebar + 8px margin each side
  const SIDEBAR_COLLAPSED_WIDTH = 44;  // 36px + margins

  // Create a single store for the active spec
  // We reuse this store and update its spec when navigation changes
  const activeStore = createForestStore();

  // Derived: filtered nav tree (for search)
  const filteredNavTree = $derived.by((): NavTreeNode[] => {
    if (!payload) return [];
    if (!searchQuery.trim()) return payload.navTree;
    return filterTree(payload.navTree, searchQuery.toLowerCase());
  });

  // Derived: active spec
  const activeSpec = $derived.by((): WebSpec | null => {
    if (!activeKey || !payload) return null;
    return payload.specs[activeKey] ?? null;
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
    payload = p;
    // Snapshot original per-spec column widths. When the R arg
    // `shared_column_widths = TRUE` was passed, the widths stamped by the
    // server are captured here as the "baseline" — toggling off after
    // load restores nothing (they were already aligned), but subsequent
    // toggle-on/off operations from a user-modified state do the right
    // thing.
    originalWidths = new Map();
    for (const [key, spec] of Object.entries(p.specs)) {
      const colMap = new Map<string, number | "auto" | undefined>();
      for (const col of spec.columns ?? []) {
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
   * Compute max shared width per column id across every spec, using the
   * R-style char heuristic on original (pre-stamp) widths + data content.
   */
  function computeSharedWidths(): Map<string, number> {
    const result = new Map<string, number>();
    if (!payload) return result;

    const specs = Object.values(payload.specs);
    if (specs.length === 0) return result;

    // Use the first spec's column list as the canonical order.
    for (const col of specs[0].columns ?? []) {
      if (VIZ_COLUMN_TYPES.has(col.type)) continue;
      // If any spec has an explicit numeric width, respect the max of those.
      let explicitMax: number | null = null;
      for (const s of specs) {
        const match = s.columns?.find(c => c.id === col.id);
        if (match && typeof match.width === "number") {
          explicitMax = explicitMax == null ? match.width : Math.max(explicitMax, match.width);
        }
      }

      // Content-based estimate: max header / data chars across all specs.
      let contentMax = 0;
      const header = col.header ?? undefined;
      for (const s of specs) {
        const match = s.columns?.find(c => c.id === col.id);
        const field = match?.field;
        const values: unknown[] = [];
        if (field && Array.isArray(s.data)) {
          for (const row of s.data) {
            values.push((row as Record<string, unknown>)[field]);
          }
        }
        contentMax = Math.max(contentMax, estimateColumnWidth(header, values));
      }

      const width = explicitMax != null ? Math.max(explicitMax, contentMax) : contentMax;
      result.set(col.id, width);
    }

    return result;
  }

  function setSharedColumnWidths(enabled: boolean) {
    if (!payload) return;
    sharedColumnWidths = enabled;

    if (enabled) {
      const widths = computeSharedWidths();
      for (const spec of Object.values(payload.specs)) {
        for (const col of spec.columns ?? []) {
          const w = widths.get(col.id);
          if (w != null) col.width = w;
        }
      }
    } else {
      for (const [key, spec] of Object.entries(payload.specs)) {
        const orig = originalWidths.get(key);
        if (!orig) continue;
        for (const col of spec.columns ?? []) {
          col.width = orig.get(col.id);
        }
      }
    }

    // Re-apply the active spec so the activeStore picks up new widths and
    // rerenders. setSpec clears its column-width cache internally (including
    // its opLog), so push the split-level op record AFTER the reset.
    if (activeKey) {
      const spec = payload.specs[activeKey];
      if (spec) activeStore.setSpec(spec);
    }
    // Record into the active sub-plot's log so the "View source" panel
    // surfaces it alongside any other edits. `tbl` in the emitted R code
    // is a SplitForest when split_by was used, so the call is valid.
    activeStore.recordOp(ops.setSharedColumnWidths(enabled));
  }

  function toggleSharedColumnWidths() {
    setSharedColumnWidths(!sharedColumnWidths);
  }

  function selectSpec(key: string) {
    if (!payload) return;

    activeKey = key;
    const spec = payload.specs[key];
    if (spec) {
      activeStore.setSpec(spec);
      // Apply stored theme if user has selected one
      if (userTheme) {
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

  function expandPathToKey(key: string) {
    // Add path nodes to existing expanded set (for manual expansion)
    const parts = key.split("__");
    const newExpanded = new Set(expandedNodes);
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
    activeStore.setTheme(themeName);
  }

  function resetTheme() {
    userTheme = null;
    // Re-apply original spec theme
    if (activeKey && payload) {
      const spec = payload.specs[activeKey];
      if (spec) {
        activeStore.setSpec(spec);
        activeStore.setDimensions(containerWidth - effectiveSidebarWidth, containerHeight);
      }
    }
  }

  return {
    // Getters
    get payload() { return payload; },
    get activeKey() { return activeKey; },
    get activeSpec() { return activeSpec; },
    get activeStore() { return activeStore; },
    get navTree() { return filteredNavTree; },
    get searchQuery() { return searchQuery; },
    get expandedNodes() { return expandedNodes; },
    get splitVars() { return splitVars; },
    get sidebarWidth() { return effectiveSidebarWidth; },
    get sidebarCollapsed() { return sidebarCollapsed; },
    get userTheme() { return userTheme; },
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
    resetTheme,
    setSharedColumnWidths,
    toggleSharedColumnWidths,
  };
}

export type SplitForestStore = ReturnType<typeof createSplitForestStore>;

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

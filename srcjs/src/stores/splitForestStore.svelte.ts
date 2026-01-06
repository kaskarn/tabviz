import type { SplitForestPayload, NavTreeNode, WebSpec } from "$types";
import { createForestStore, type ForestStore } from "./forestStore.svelte";
import { type ThemeName } from "$lib/theme-presets";

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
    // Default to first leaf spec
    const firstLeaf = findFirstLeaf(p.navTree);
    if (firstLeaf) {
      selectSpec(firstLeaf);
    }
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

<script lang="ts">
  import type { SplitForestStore } from "$stores/splitForestStore.svelte";
  import type { NavTreeNode } from "$types";

  interface Props {
    store: SplitForestStore;
  }

  let { store }: Props = $props();

  const navTree = $derived(store.navTree);
  const activeKey = $derived(store.activeKey);
  const expandedNodes = $derived(store.expandedNodes);
  const searchQuery = $derived(store.searchQuery);
  const splitVars = $derived(store.splitVars);
  const collapsed = $derived(store.sidebarCollapsed);

  function handleSearch(event: Event) {
    const target = event.target as HTMLInputElement;
    store.setSearch(target.value);
  }

  function handleKeydown(event: KeyboardEvent) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      store.selectNext();
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      store.selectPrevious();
    }
  }

  function formatHeader(name: string): string {
    return name
      .replace(/_/g, " ")
      .replace(/\b\w/g, (c) => c.toUpperCase());
  }
</script>

{#if collapsed}
  <div class="sidebar-collapsed">
    <button
      class="toggle-btn"
      onclick={() => store.toggleSidebar()}
      title="Expand navigation"
    >
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
        <path d="M7 4L12 9L7 14" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    </button>
  </div>
{:else}
  <aside class="split-sidebar" role="navigation" aria-label="Subgroup navigation">
    <div class="sidebar-header">
      <span class="sidebar-title">Subgroups</span>
      <button
        class="toggle-btn"
        onclick={() => store.toggleSidebar()}
        title="Collapse navigation"
      >
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
          <path d="M11 4L6 9L11 14" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </button>
    </div>

    <div class="sidebar-search">
      <input
        type="text"
        placeholder="Search..."
        value={searchQuery}
        oninput={handleSearch}
        onkeydown={handleKeydown}
        class="search-input"
      />
    </div>

    <nav class="sidebar-nav">
      {#if splitVars.length > 0}
        <div class="section-header">{formatHeader(splitVars[0])}</div>
      {/if}

      <ul class="tree-list">
        {#each navTree as node, i}
          {@render treeNode(node, 0, i === navTree.length - 1)}
        {/each}
      </ul>
    </nav>
  </aside>
{/if}

{#snippet treeNode(node: NavTreeNode, depth: number, isLast: boolean)}
  {@const hasChildren = node.children && node.children.length > 0}
  {@const isExpanded = expandedNodes.has(node.key)}
  {@const isActive = activeKey === node.key}
  {@const isLeaf = !hasChildren}

  <li class="tree-item" class:is-last={isLast}>
    <div class="tree-row" style="--depth: {depth}">
      {#if depth > 0}
        <span class="tree-line"></span>
      {/if}
      <button
        class="node-btn"
        class:active={isActive}
        class:parent={hasChildren}
        onclick={() => {
          if (isLeaf) {
            store.selectSpec(node.key);
          } else {
            store.toggleExpanded(node.key);
          }
        }}
        onkeydown={handleKeydown}
      >
        {#if hasChildren}
          <span class="tree-toggle" class:expanded={isExpanded}>
            {#if isExpanded}
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                <rect x="1" y="1" width="10" height="10" rx="2" stroke="currentColor" stroke-width="1.2"/>
                <line x1="3" y1="6" x2="9" y2="6" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>
              </svg>
            {:else}
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                <rect x="1" y="1" width="10" height="10" rx="2" stroke="currentColor" stroke-width="1.2"/>
                <line x1="6" y1="3" x2="6" y2="9" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>
                <line x1="3" y1="6" x2="9" y2="6" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>
              </svg>
            {/if}
          </span>
        {/if}
        <span class="label">{node.label}</span>
      </button>
    </div>

    {#if hasChildren && isExpanded}
      <div class="children-wrapper">
        {#if splitVars.length > depth + 1}
          <div class="section-header nested" style="--depth: {depth}">{formatHeader(splitVars[depth + 1])}</div>
        {/if}
        <ul class="tree-list nested">
          {#each node.children as child, i}
            {@render treeNode(child, depth + 1, i === node.children.length - 1)}
          {/each}
        </ul>
      </div>
    {/if}
  </li>
{/snippet}

<style>
  .sidebar-collapsed {
    width: 36px;
    flex-shrink: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    padding-top: 10px;
    background: transparent;
  }

  .split-sidebar {
    width: 200px;
    flex-shrink: 0;
    background: var(--wf-bg, #fff);
    border-radius: 8px;
    box-shadow: 0 1px 3px rgba(0,0,0,0.08), 0 4px 12px rgba(0,0,0,0.05);
    display: flex;
    flex-direction: column;
    overflow: hidden;
    font-family: var(--wf-font-family, system-ui, -apple-system, sans-serif);
    font-size: 13px;
    margin: 0 8px 8px 8px;
    max-height: calc(100% - 8px);
    align-self: flex-start;
  }

  .sidebar-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 10px 10px 6px;
  }

  .sidebar-title {
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: var(--wf-muted, #64748b);
  }

  .toggle-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 26px;
    height: 26px;
    border: none;
    background: var(--wf-bg, #fff);
    color: var(--wf-muted, #64748b);
    border-radius: 6px;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .sidebar-collapsed .toggle-btn {
    box-shadow: 0 1px 3px rgba(0,0,0,0.1), 0 2px 8px rgba(0,0,0,0.06);
  }

  .toggle-btn:hover {
    background: var(--wf-hover, #f1f5f9);
    color: var(--wf-fg, #1e293b);
  }

  .sidebar-search {
    padding: 4px 10px 8px;
  }

  .search-input {
    width: 100%;
    padding: 5px 8px;
    border: 1px solid var(--wf-border, #e2e8f0);
    border-radius: 5px;
    font-size: 12px;
    background: var(--wf-bg, #fff);
    color: var(--wf-fg, #1e293b);
    outline: none;
    transition: border-color 0.15s ease, box-shadow 0.15s ease;
  }

  .search-input:focus {
    border-color: var(--wf-primary, #3b82f6);
    box-shadow: 0 0 0 2px color-mix(in srgb, var(--wf-primary, #3b82f6) 15%, transparent);
  }

  .search-input::placeholder {
    color: var(--wf-muted, #94a3b8);
  }

  .sidebar-nav {
    flex: 1;
    overflow-y: auto;
    padding: 0 6px 8px;
  }

  .section-header {
    font-size: 10px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: var(--wf-muted, #64748b);
    padding: 6px 6px 3px;
  }

  .section-header.nested {
    margin-left: calc(var(--depth, 0) * 14px + 18px);
    padding-top: 8px;
  }

  .tree-list {
    list-style: none;
    margin: 0;
    padding: 0;
  }

  .tree-item {
    position: relative;
  }

  /* Vertical connector line for children */
  .tree-list.nested {
    position: relative;
  }

  .tree-list.nested::before {
    content: "";
    position: absolute;
    left: 11px;
    top: 0;
    bottom: 12px;
    width: 1px;
    background: var(--wf-border, #e2e8f0);
  }

  .tree-row {
    display: flex;
    align-items: center;
    position: relative;
  }

  /* Horizontal connector line */
  .tree-line {
    position: absolute;
    left: 11px;
    width: 10px;
    height: 1px;
    background: var(--wf-border, #e2e8f0);
  }

  .node-btn {
    display: flex;
    align-items: center;
    gap: 4px;
    width: 100%;
    padding: 4px 8px;
    margin-left: calc(var(--depth, 0) * 14px);
    border: none;
    background: transparent;
    text-align: left;
    cursor: pointer;
    color: var(--wf-fg, #1e293b);
    border-radius: 5px;
    transition: all 0.1s ease;
  }

  .node-btn:hover {
    background: var(--wf-hover, #f1f5f9);
  }

  .node-btn.active {
    background: color-mix(in srgb, var(--wf-primary, #3b82f6) 12%, var(--wf-bg, #fff));
    color: var(--wf-primary, #3b82f6);
    font-weight: 600;
  }

  .tree-toggle {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 14px;
    height: 14px;
    flex-shrink: 0;
    color: var(--wf-muted, #94a3b8);
  }

  .node-btn:hover .tree-toggle {
    color: var(--wf-fg, #1e293b);
  }

  .label {
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .children-wrapper {
    /* Contains nested section header + list */
  }
</style>

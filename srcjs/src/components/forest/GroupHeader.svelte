<script lang="ts">
  import type { Group, WebTheme } from "$types";

  interface Props {
    group: Group;
    rowCount?: number;
    theme: WebTheme | undefined;
    level?: number;  // 1 = top-level, 2 = second-level, etc.
  }

  let { group, rowCount, theme, level = 1 }: Props = $props();

  // Get level-specific styles from theme
  // Note: Background is NOT applied here - it's handled by ForestPlot.svelte
  // at the row level via getGroupBackground() for proper solid-color rendering
  function getLevelStyles(level: number, theme: WebTheme | undefined) {
    const rg = theme?.rowGroup;
    if (!rg) return { fontSize: undefined, fontWeight: undefined, italic: false, borderBottom: false };

    const tier = level === 1 ? rg.L1 : level === 2 ? rg.L2 : rg.L3;
    return {
      fontSize: tier?.text?.size,
      fontWeight: tier?.text?.weight,
      italic: tier?.text?.italic ?? false,
      borderBottom: tier?.borderBottom ?? false,
    };
  }

  const levelStyles = $derived(getLevelStyles(level, theme));
</script>

<!-- Click handling moved to parent row for full-row interactivity -->
<!-- Background is applied to the full row by ForestPlot.svelte -->
<!-- Border is applied at the parent `.grid-cell.group-row-bordered` so it
     aligns with the row edge rather than floating above the cell's bottom
     padding (driven by GroupHeaderStyles.levelN_border_bottom in the parent). -->
<div
  class="group-header"
  class:italic={levelStyles.italic}
  aria-expanded={!group.collapsed}
  style:font-size={levelStyles.fontSize}
  style:font-weight={levelStyles.fontWeight}
>
  <span class="group-chevron" class:collapsed={group.collapsed}>
    <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
      <path d="M2 4L6 8L10 4" stroke="currentColor" stroke-width="1.5" fill="none" />
    </svg>
  </span>
  <span class="group-label">{group.label}</span>
  {#if rowCount !== undefined}
    <span class="group-count">({rowCount})</span>
  {/if}
</div>

<style>
  .group-header {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 4px 0;
    user-select: none;
    color: var(--tv-fg, #1a1a1a);
  }

  .group-header.italic {
    font-style: italic;
  }

  .group-chevron {
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    min-width: 12px;
    transition: transform 0.15s ease;
    color: var(--tv-secondary, #64748b);
  }

  .group-chevron.collapsed {
    transform: rotate(-90deg);
  }

  .group-label {
    flex: 1;
  }

  .group-count {
    font-weight: var(--tv-font-weight-normal, 400);
    color: var(--tv-muted, #94a3b8);
    font-size: var(--tv-font-size-sm, 0.75rem);
  }
</style>

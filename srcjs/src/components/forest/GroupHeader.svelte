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
  function getLevelStyles(level: number, theme: WebTheme | undefined) {
    const gh = theme?.groupHeaders;
    if (!gh) return { fontSize: undefined, fontWeight: undefined, background: undefined, borderBottom: false };

    if (level === 1) {
      return {
        fontSize: gh.level1FontSize,
        fontWeight: gh.level1FontWeight,
        background: gh.level1Background ?? computeBackground(theme, 0.08),
        borderBottom: gh.level1BorderBottom,
      };
    } else if (level === 2) {
      return {
        fontSize: gh.level2FontSize,
        fontWeight: gh.level2FontWeight,
        background: gh.level2Background ?? computeBackground(theme, 0.05),
        borderBottom: gh.level2BorderBottom,
      };
    } else {
      return {
        fontSize: gh.level3FontSize,
        fontWeight: gh.level3FontWeight,
        background: gh.level3Background ?? computeBackground(theme, 0.03),
        borderBottom: gh.level3BorderBottom,
      };
    }
  }

  // Compute background from primary color with opacity
  function computeBackground(theme: WebTheme | undefined, opacity: number): string {
    const primary = theme?.colors?.primary ?? "#0891b2";
    // Convert hex to rgba
    const hex = primary.replace("#", "");
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${opacity})`;
  }

  const levelStyles = $derived(getLevelStyles(level, theme));
</script>

<!-- Click handling moved to parent row for full-row interactivity -->
<!-- Background is applied to the full row by ForestPlot.svelte -->
<div
  class="group-header"
  class:has-border={levelStyles.borderBottom}
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
    color: var(--wf-fg, #1a1a1a);
  }

  .group-header.has-border {
    border-bottom: 1px solid var(--wf-border, #e2e8f0);
  }

  .group-chevron {
    display: flex;
    align-items: center;
    justify-content: center;
    transition: transform 0.15s ease;
    color: var(--wf-secondary, #64748b);
  }

  .group-chevron.collapsed {
    transform: rotate(-90deg);
  }

  .group-label {
    flex: 1;
  }

  .group-count {
    font-weight: var(--wf-font-weight-normal, 400);
    color: var(--wf-muted, #94a3b8);
    font-size: var(--wf-font-size-sm, 0.75rem);
  }
</style>

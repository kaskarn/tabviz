<script lang="ts">
  import type { Group, WebTheme } from "$types";

  interface Props {
    group: Group;
    rowCount?: number;
    theme: WebTheme | undefined;
  }

  let { group, rowCount, theme }: Props = $props();
</script>

<!-- Click handling moved to parent row for full-row interactivity -->
<div class="group-header" aria-expanded={!group.collapsed}>
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
    padding: 4px 10px;
    user-select: none;
    font-weight: var(--wf-font-weight-bold, 600);
    color: var(--wf-fg, #1a1a1a);
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

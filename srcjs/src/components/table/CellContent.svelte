<script lang="ts">
  import type { CellStyle } from "$types";

  interface Props {
    value: unknown;
    cellStyle?: CellStyle;
  }

  let { value, cellStyle }: Props = $props();

  const hasBadge = $derived(!!cellStyle?.badge);
  const hasIcon = $derived(!!cellStyle?.icon);
  const isBold = $derived(cellStyle?.bold ?? false);
  const isItalic = $derived(cellStyle?.italic ?? false);
  const textColor = $derived(cellStyle?.color ?? null);
  const bgColor = $derived(cellStyle?.bg ?? null);
</script>

<span
  class="cell-content"
  class:cell-bold={isBold}
  class:cell-italic={isItalic}
  style:color={textColor}
  style:background-color={bgColor}
>
  {#if hasIcon}<span class="cell-icon">{cellStyle?.icon}</span>{/if}
  <span class="cell-value">{value ?? ""}</span>
  {#if hasBadge}<span class="cell-badge">{cellStyle?.badge}</span>{/if}
</span>

<style>
  .cell-content {
    display: inline-flex;
    align-items: center;
    gap: 4px;
  }

  .cell-bold {
    font-weight: var(--wf-font-weight-bold, 600);
  }

  .cell-italic {
    font-style: italic;
  }

  .cell-icon {
    margin-right: 2px;
  }

  .cell-badge {
    margin-left: 4px;
    padding: 1px 6px;
    font-size: var(--wf-font-size-sm, 0.75rem);
    background: color-mix(in srgb, var(--wf-primary) 15%, var(--wf-bg));
    border-radius: 4px;
    color: var(--wf-primary);
  }
</style>

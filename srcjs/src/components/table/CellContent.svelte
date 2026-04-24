<script lang="ts">
  import type { CellStyle } from "$types";

  interface Props {
    value: unknown;
    cellStyle?: CellStyle;
    title?: string;
  }

  let { value, cellStyle, title }: Props = $props();

  const hasBadge = $derived(!!cellStyle?.badge);
  const hasIcon = $derived(!!cellStyle?.icon);
  const isBold = $derived(cellStyle?.bold ?? false);
  const isItalic = $derived(cellStyle?.italic ?? false);
  const textColor = $derived(cellStyle?.color ?? null);
  const bgColor = $derived(cellStyle?.bg ?? null);
  // Semantic styling
  const isEmphasis = $derived(cellStyle?.emphasis ?? false);
  const isMuted = $derived(cellStyle?.muted ?? false);
  const isAccent = $derived(cellStyle?.accent ?? false);
</script>

<span
  class="cell-content"
  class:cell-bold={isBold}
  class:cell-italic={isItalic}
  class:cell-emphasis={isEmphasis}
  class:cell-muted={isMuted}
  class:cell-accent={isAccent}
  style:color={textColor}
  style:background-color={bgColor}
  title={cellStyle?.tooltip ?? title ?? String(value ?? "")}
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

  /* Semantic styling — reads from per-token bundle vars emitted by
     ForestPlot.svelte (cssVars), so editing `theme.semantics.*.fg/bg` in the
     Settings panel immediately updates every painted cell. Each var
     cascades from the corresponding palette slot when the bundle entry is
     null, preserving pre-v0.20.1 visuals. */
  .cell-emphasis {
    font-weight: var(--wf-font-weight-bold, 600);
    color: var(--wf-semantic-emphasis-fg, var(--wf-fg, #1a1a1a));
    background-color: var(--wf-semantic-emphasis-bg, transparent);
  }

  .cell-muted {
    color: var(--wf-semantic-muted-fg, var(--wf-muted, #94a3b8));
    background-color: var(--wf-semantic-muted-bg, transparent);
  }

  .cell-accent {
    color: var(--wf-semantic-accent-fg, var(--wf-accent, #8b5cf6));
    background-color: var(--wf-semantic-accent-bg, transparent);
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

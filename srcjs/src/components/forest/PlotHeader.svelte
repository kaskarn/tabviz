<script lang="ts">
  import type { Snippet } from "svelte";

  interface Props {
    title?: string | null;
    subtitle?: string | null;
    controls?: Snippet;
  }

  let { title, subtitle, controls }: Props = $props();
</script>

{#if title || subtitle}
  <div class="header-area" class:has-both={title && subtitle}>
    <div class="title-area">
      {#if title}
        <h2 class="plot-title">{title}</h2>
      {/if}
      {#if subtitle}
        <p class="plot-subtitle">{subtitle}</p>
      {/if}
    </div>
    {#if controls}
      <div class="controls-area">
        {@render controls()}
      </div>
    {/if}
  </div>
{/if}

<style>
  .header-area {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 12px;
    padding: 12px 8px 4px 2px;
  }

  /* Separator line only when both title AND subtitle exist */
  .header-area.has-both {
    border-bottom: 1px solid var(--wf-border, #e2e8f0);
    padding-bottom: 8px;
    margin-bottom: 4px;
  }

  .title-area {
    flex: 1;
    min-width: 0;
  }

  .controls-area {
    flex-shrink: 0;
    display: flex;
    align-items: center;
    gap: 4px;
    padding-top: 2px;
  }

  .plot-title {
    margin: 0;
    padding: 0 0 0.15rem 0;
    border: none;
    font-size: var(--wf-font-size-lg, 1rem);
    font-weight: var(--wf-font-weight-bold, 600);
    color: var(--wf-fg, #1a1a1a);
    line-height: 1.3;
    white-space: normal;
    word-wrap: break-word;
  }

  .plot-subtitle {
    margin: 4px 0 0;
    font-size: var(--wf-font-size-base, 0.875rem);
    font-weight: var(--wf-font-weight-normal, 400);
    color: var(--wf-secondary, #64748b);
    line-height: 1.4;
    white-space: normal;
    word-wrap: break-word;
  }
</style>

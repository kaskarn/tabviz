<script lang="ts">
  interface Props {
    caption?: string | null;
    footnote?: string | null;
  }

  let { caption, footnote }: Props = $props();
</script>

{#if caption || footnote}
  <div class="plot-footer">
    {#if caption}
      <p class="plot-caption">{caption}</p>
    {/if}
    {#if footnote}
      <p class="plot-footnote">{footnote}</p>
    {/if}
  </div>
{/if}

<style>
  .plot-footer {
    padding: 8px 12px 12px 2px;
    border-top: 1px solid var(--wf-border, #e2e8f0);
  }

  .plot-caption {
    margin: 0;
    font-size: var(--wf-font-size-sm, 0.75rem);
    font-weight: var(--wf-font-weight-normal, 400);
    color: var(--wf-secondary, #64748b);
    line-height: 1.4;
    white-space: normal;
    word-wrap: break-word;
  }

  .plot-footnote {
    margin: 4px 0 0;
    font-size: var(--wf-font-size-sm, 0.75rem);
    font-weight: var(--wf-font-weight-normal, 400);
    color: var(--wf-muted, #94a3b8);
    font-style: italic;
    line-height: 1.4;
    white-space: normal;
    word-wrap: break-word;
  }
</style>

<script lang="ts">
  interface Props {
    title?: string | null;
    subtitle?: string | null;
  }

  let { title, subtitle }: Props = $props();
</script>

{#if title || subtitle}
  <div class="title-area">
    {#if title}
      <h2 class="plot-title">{title}</h2>
    {/if}
    {#if subtitle}
      <p class="plot-subtitle">{subtitle}</p>
    {/if}
  </div>
{/if}

<style>
  .title-area {
    padding: 12px 12px 8px;
  }

  .plot-title {
    margin: 0;
    font-size: var(--wf-font-size-lg, 1rem);
    font-weight: var(--wf-font-weight-bold, 600);
    color: var(--wf-fg, #1a1a1a);
    line-height: 1.3;
  }

  .plot-subtitle {
    margin: 4px 0 0;
    font-size: var(--wf-font-size-base, 0.875rem);
    font-weight: var(--wf-font-weight-normal, 400);
    color: var(--wf-secondary, #64748b);
    line-height: 1.4;
  }
</style>

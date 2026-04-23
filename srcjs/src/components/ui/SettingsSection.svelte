<script lang="ts">
  interface Props {
    title: string;
    description?: string;
    children: import("svelte").Snippet;
  }

  let { title, description, children }: Props = $props();
</script>

<section class="settings-section">
  <header class="section-header">
    <h3>{title}</h3>
    {#if description}
      <p class="description">{description}</p>
    {/if}
  </header>
  <div class="section-body">
    {@render children()}
  </div>
</section>

<style>
  .settings-section {
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding: 14px 0;
  }

  .settings-section + :global(.settings-section) {
    border-top: 1px solid color-mix(in srgb, var(--wf-border, #e2e8f0) 60%, transparent);
  }

  .section-header {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  h3 {
    margin: 0;
    font-size: 0.8125rem;
    font-weight: 600;
    letter-spacing: 0.01em;
    color: var(--wf-fg, #1a1a1a);
  }

  .description {
    margin: 0;
    font-size: 0.75rem;
    line-height: 1.4;
    color: color-mix(in srgb, var(--wf-secondary, #64748b) 95%, transparent);
  }

  .section-body {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
</style>

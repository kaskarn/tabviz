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
    gap: 6px;
    padding: 8px 0;
  }

  .settings-section + :global(.settings-section) {
    border-top: 1px solid color-mix(in srgb, var(--wf-border, #e2e8f0) 60%, transparent);
  }

  .section-header {
    display: flex;
    flex-direction: column;
    gap: 1px;
  }

  h3 {
    margin: 0;
    font-size: 0.75rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: color-mix(in srgb, var(--wf-secondary, #64748b) 85%, var(--wf-fg, #1a1a1a));
  }

  .description {
    margin: 0;
    font-size: 0.6875rem;
    line-height: 1.3;
    color: color-mix(in srgb, var(--wf-secondary, #64748b) 85%, transparent);
  }

  .section-body {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
</style>

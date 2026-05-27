<script lang="ts">
  import Tooltip from "$components/primitives/v2/Tooltip.svelte";

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
      <Tooltip text={description}>
        <span class="info" aria-label={description}>?</span>
      </Tooltip>
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
    border-top: 1px solid color-mix(in srgb, var(--tv-border, #e2e8f0) 60%, transparent);
  }

  .section-header {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  h3 {
    margin: 0;
    font-size: 0.75rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: color-mix(in srgb, var(--tv-text-muted, #64748b) 85%, var(--tv-fg, #1a1a1a));
  }

  /* Info-circle tooltip — same idiom as the v2 Field / Section / Accordion
     hint chips for consistency across the settings panel. */
  .info {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 12px;
    height: 12px;
    border-radius: 50%;
    color: var(--v2-ink-3, #8a8478);
    font-family: var(--v2-font-sans, system-ui);
    font-size: 9px;
    font-weight: 600;
    line-height: 1;
    cursor: help;
    box-shadow: inset 0 0 0 1px var(--v2-rule, #d6d0c1);
    transition: color var(--v2-dur-snap, 80ms) ease,
                box-shadow var(--v2-dur-snap, 80ms) ease;
  }
  .info:hover {
    color: var(--v2-ink, #15140e);
    box-shadow: inset 0 0 0 1px var(--v2-ink-2, #4a463c);
  }

  .section-body {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
</style>

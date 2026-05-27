<script lang="ts">
  interface Props {
    /** Section title (e.g. "Typography"). */
    title: string;
    /** Short teaser of what this tab will contain. */
    teaser: string;
  }

  let { title, teaser }: Props = $props();
</script>

<div class="stub">
  <div class="badge">Coming soon</div>
  <h3>{title}</h3>
  <p>{teaser}</p>
</div>

<style>
  .stub {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 8px;
    padding: 18px 4px;
    color: var(--tv-text-muted, #64748b);
  }

  .badge {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 2px 10px;
    font-size: 0.7rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--tv-accent, #2563eb);
    background: color-mix(in srgb, var(--tv-accent, #2563eb) 10%, transparent);
    border-radius: 999px;
  }

  h3 {
    margin: 0;
    font-size: 0.95rem;
    font-weight: 600;
    color: var(--tv-fg, #1a1a1a);
  }

  p {
    margin: 0;
    font-size: 0.8125rem;
    line-height: 1.45;
    max-width: 44ch;
  }
</style>

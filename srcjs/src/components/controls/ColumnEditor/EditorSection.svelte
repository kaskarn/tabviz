<script lang="ts">
  import { untrack, type Snippet } from "svelte";

  interface Props {
    title: string;
    /** When false, the section starts collapsed and renders a chevron. */
    defaultOpen?: boolean;
    /** Hide entirely when the section has no visible children. */
    empty?: boolean;
    children: Snippet;
  }

  let { title, defaultOpen = true, empty = false, children }: Props = $props();
  // Read once: defaultOpen seeds the initial state, then user toggles own it.
  let open = $state(untrack(() => defaultOpen));
</script>

{#if !empty}
  <section class="editor-section" class:open>
    <button
      type="button"
      class="section-toggle"
      onclick={() => (open = !open)}
      aria-expanded={open}
    >
      <svg
        class="chevron"
        width="10"
        height="10"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2.5"
        stroke-linecap="round"
        aria-hidden="true"
      >
        <polyline points="9 18 15 12 9 6" />
      </svg>
      <span class="title">{title}</span>
    </button>
    {#if open}
      <div class="section-body">
        {@render children()}
      </div>
    {/if}
  </section>
{/if}

<style>
  .editor-section {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .editor-section + :global(.editor-section) {
    border-top: 1px solid color-mix(in srgb, var(--tv-border, #e2e8f0) 60%, transparent);
    padding-top: 6px;
  }

  .section-toggle {
    display: flex;
    align-items: center;
    gap: 5px;
    padding: 2px 0;
    background: transparent;
    border: none;
    cursor: pointer;
    font-family: inherit;
    color: var(--tv-text-muted, #64748b);
    font-size: 10px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    width: 100%;
    text-align: left;
  }

  .section-toggle:hover {
    color: var(--tv-fg, #1a1a1a);
  }

  .chevron {
    transition: transform 120ms ease;
    flex-shrink: 0;
  }

  .editor-section.open .chevron {
    transform: rotate(90deg);
  }

  .title {
    flex: 1;
    min-width: 0;
  }

  .section-body {
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding: 2px 0 4px;
  }
</style>

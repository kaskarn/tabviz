<!--
  AccordionSection — collapsible card with title, optional hint, and
  optional override-count badge. The body slot renders when open.

  Aesthetic: 4px-radius card, 8px vertical padding, +/− glyph on the
  right of the header. No animations beyond a subtle 80ms ease on the
  caret. Mirrors the rgc-design Section component (controls.jsx:4-16)
  but recolored to tabviz tokens.
-->
<script lang="ts">
  import type { Snippet } from "svelte";

  interface Props {
    title: string;
    hint?: string;
    /** Count of overridden options below default. Renders as a chip. */
    overrideCount?: number;
    open?: boolean;
    children?: Snippet;
  }

  let {
    title,
    hint,
    overrideCount,
    open = $bindable(true),
    children,
  }: Props = $props();
</script>

<section class="acc-section">
  <button
    class="acc-header"
    type="button"
    aria-expanded={open}
    onclick={() => (open = !open)}
  >
    <span class="acc-title">{title}</span>
    {#if overrideCount != null && overrideCount > 0 && !open}
      <span class="acc-badge" title="{overrideCount} overridden">
        {overrideCount}
      </span>
    {/if}
    <span class="acc-caret" aria-hidden="true">{open ? "−" : "+"}</span>
  </button>
  {#if hint && open}
    <p class="acc-hint">{hint}</p>
  {/if}
  {#if open}
    <div class="acc-body">
      {@render children?.()}
    </div>
  {/if}
</section>

<style>
  .acc-section {
    border-bottom: 1px solid var(--tv-border, #d6d2c6);
  }
  .acc-section:last-child { border-bottom: none; }

  .acc-header {
    display: flex;
    align-items: center;
    width: 100%;
    padding: 8px 0 6px;
    background: transparent;
    border: none;
    cursor: pointer;
    font-family: inherit;
    font-size: 12px;
    color: var(--tv-fg, #1f1f1f);
    text-align: left;
  }
  .acc-header:hover { color: var(--tv-accent, #b53a1f); }
  .acc-header:focus-visible {
    outline: 2px solid var(--tv-accent, #b53a1f);
    outline-offset: 2px;
  }

  .acc-title {
    flex: 1;
    font-weight: 500;
    letter-spacing: 0.01em;
  }
  .acc-badge {
    margin-right: 8px;
    padding: 1px 6px;
    border-radius: 9px;
    background: var(--tv-hover-bg, rgba(0, 0, 0, 0.06));
    color: var(--tv-text-muted, #7a7466);
    font-size: 10px;
    font-variant-numeric: tabular-nums;
  }
  .acc-caret {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 14px;
    height: 14px;
    color: var(--tv-text-muted, #7a7466);
    font-size: 14px;
    line-height: 1;
    transition: color 80ms ease;
  }

  .acc-hint {
    margin: 0 0 6px;
    font-size: 11px;
    font-style: italic;
    color: var(--tv-text-muted, #7a7466);
  }

  .acc-body {
    padding: 2px 0 12px;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
</style>

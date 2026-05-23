<!--
  Accordion — collapsible version of Section. Same header anatomy
  + a leading caret that flips on open. Body height animates in a
  single CSS transition (no JS measurement) using grid-rows trick.

  Use for the schema-cascade sections of the column editor —
  "Numeric options", "Interval options", etc. — that the author may
  fold away once tuned.

  Caret is on the LEFT of the row (where the glyph-column lives in
  Section). When both a caret and a glyph are present, glyph moves
  to a small position next to the title (since the caret reserves
  the leading slot).
-->
<script lang="ts">
  import type { Snippet } from "svelte";
  import { glyph as glyphChar, type GlyphToken } from "$lib/ui-glyphs";

  interface Props {
    title: string;
    hint?: string;
    glyph?: GlyphToken;
    count?: number | null;
    open?: boolean;
    /** Mute when all options are at default. */
    dim?: boolean;
    /** Free-form snippet rendered in the header's right slot. Use this
     *  for per-item summaries (color chip, font signature, token preview)
     *  when count isn't the right shape. */
    summary?: Snippet;
    children?: Snippet;
  }

  let {
    title,
    hint,
    glyph,
    count,
    open = $bindable(true),
    dim,
    summary,
    children,
  }: Props = $props();
</script>

<section class="acc" class:open class:dim>
  <button
    type="button"
    class="head"
    aria-expanded={open}
    onclick={() => (open = !open)}
  >
    <span class="caret" aria-hidden="true">{open ? "▾" : "▸"}</span>
    <div class="head-text">
      <h3 class="head-title">
        {#if glyph}<span class="head-glyph" aria-hidden="true">{glyphChar(glyph)}</span>{/if}
        {title}
      </h3>
      {#if hint}<span class="head-hint">{hint}</span>{/if}
    </div>
    {#if summary}
      <span class="head-summary">{@render summary()}</span>
    {:else if count != null && count > 0}
      <span class="head-count" title="{count} overridden">
        <span class="count-dot"></span>
        {count}
      </span>
    {/if}
  </button>
  <div class="body-wrap">
    <div class="body">
      {@render children?.()}
    </div>
  </div>
</section>

<style>
  .acc {
    display: flex;
    flex-direction: column;
    border-bottom: 1px solid var(--v2-rule-soft, #e6e0d1);
  }
  .acc:last-of-type { border-bottom: 0; }
  .acc.dim .head-title { color: var(--v2-ink-3, #8a8478); }

  .head {
    appearance: none;
    border: 0;
    background: transparent;
    width: 100%;
    text-align: left;
    cursor: pointer;
    display: grid;
    grid-template-columns: 14px 1fr auto;
    align-items: baseline;
    gap: var(--v2-gap-mid, 8px);
    padding: var(--v2-gap-mid, 8px) 0 var(--v2-gap-small, 6px);
    color: inherit;
    font-family: inherit;
  }
  .head:hover .caret { color: var(--v2-ink, #15140e); }
  .head:focus-visible {
    outline: 1px solid var(--v2-focus-ring, #15140e);
    outline-offset: 2px;
  }

  .caret {
    grid-column: 1;
    align-self: center;
    font-size: 10px;
    color: var(--v2-ink-3, #8a8478);
    line-height: 1;
    transition: color var(--v2-dur-snap, 80ms) var(--v2-ease);
    width: 14px;
    text-align: center;
  }

  .head-text {
    grid-column: 2;
    display: inline-flex;
    align-items: baseline;
    gap: 10px;
    min-width: 0;
    overflow: hidden;
  }
  .head-title {
    margin: 0;
    font-family: var(--v2-font-mono, ui-monospace, monospace);
    font-size: var(--v2-text-micro, 9.5px);
    font-weight: 600;
    letter-spacing: var(--v2-track-flag, 0.14em);
    text-transform: uppercase;
    color: var(--v2-ink, #15140e);
    line-height: 1.4;
    display: inline-flex;
    align-items: baseline;
    gap: 5px;
    flex: none;
  }
  .head-glyph {
    color: var(--v2-ink-3, #8a8478);
    font-family: var(--v2-font-mono, ui-monospace, monospace);
    font-size: 11px;
    line-height: 1;
    letter-spacing: 0;
  }
  .head-hint {
    font-family: var(--v2-font-sans, system-ui, sans-serif);
    font-size: var(--v2-text-small, 10.5px);
    color: var(--v2-ink-3, #8a8478);
    font-style: italic;
    text-transform: none;
    letter-spacing: 0;
    line-height: 1.4;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    min-width: 0;
  }
  .head-count {
    grid-column: 3;
    display: inline-flex;
    align-items: center;
    gap: 4px;
    font-family: var(--v2-font-mono, ui-monospace, monospace);
    font-size: var(--v2-text-small, 10.5px);
    color: var(--v2-ink-2, #4a463c);
    font-variant-numeric: tabular-nums;
  }
  .head-summary {
    grid-column: 3;
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-family: var(--v2-font-sans, system-ui, sans-serif);
    font-size: var(--v2-text-small, 10.5px);
    color: var(--v2-ink-3, #8a8478);
    overflow: hidden;
    max-width: 50%;
    white-space: nowrap;
    text-overflow: ellipsis;
  }
  .count-dot {
    width: 5px;
    height: 5px;
    border-radius: 50%;
    background: var(--v2-hot, #b53a1f);
  }

  /* ── Body — grid-rows animation trick for height collapse ─── */
  .body-wrap {
    display: grid;
    grid-template-rows: 0fr;
    transition: grid-template-rows var(--v2-dur-flow, 160ms) var(--v2-ease);
  }
  .acc.open .body-wrap { grid-template-rows: 1fr; }
  .body {
    min-height: 0;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    gap: var(--v2-gap-hair, 2px);
  }
  .acc.open .body {
    padding: 2px 0 var(--v2-gap-mid, 8px);
  }
</style>

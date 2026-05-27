<!--
  Section — a always-open titled block. Used for the top-level
  structural sections of the column editor: DATA, HEADER & LAYOUT.
  Schema-cascade sections (Numeric options, Interval options, …)
  use Accordion instead (collapsible).

  Header anatomy:
    │ glyph │  TITLE                 hint           │ count │
    ┃ <hairline rule> ┃
    │  body slot                                             │

  Title is rendered in tracked uppercase micro-caps (11px) for the
  editorial flag look. The optional `count` chip on the right is for
  override-count indicators ("3 overridden"). Hint, when given, sits
  inline after the title in muted italic, optical-flush with title
  baseline.

  No collapse here — that's Accordion's job.
-->
<script lang="ts">
  import type { Snippet } from "svelte";
  import { glyph as glyphChar, type GlyphToken } from "$lib/ui-glyphs";
  import Tooltip from "./Tooltip.svelte";

  interface Props {
    title: string;
    hint?: string;
    glyph?: GlyphToken;
    /** Override-count chip on the right. Hidden when 0 or null. */
    count?: number | null;
    /** Mute the section — used when its options are all defaults. */
    dim?: boolean;
    children?: Snippet;
  }

  let { title, hint, glyph, count, dim, children }: Props = $props();
</script>

<section class="section" class:dim>
  <header class="head">
    {#if glyph}
      <span class="head-glyph" aria-hidden="true">{glyphChar(glyph)}</span>
    {/if}
    <div class="head-text">
      <h3 class="head-title">{title}</h3>
      {#if hint}
        <Tooltip text={hint}>
          <button type="button" class="info" aria-label={hint}>?</button>
        </Tooltip>
      {/if}
    </div>
    {#if count != null && count > 0}
      <span class="head-count" title="{count} overridden">
        <span class="count-dot"></span>
        {count}
      </span>
    {/if}
  </header>
  <div class="body">
    {@render children?.()}
  </div>
</section>

<style>
  .section {
    display: flex;
    flex-direction: column;
  }
  .section.dim .head-title { color: var(--v2-ink-3, #8a8478); }
  .section.dim .body { opacity: 0.75; }

  .head {
    display: grid;
    grid-template-columns: auto 1fr auto;
    align-items: baseline;
    gap: var(--v2-gap-mid, 8px);
    padding: var(--v2-gap-wide, 12px) 0 var(--v2-gap-small, 6px);
    border-bottom: 1px solid var(--v2-rule, #d6d0c1);
  }
  .head-glyph {
    grid-column: 1;
    font-family: var(--v2-font-mono, ui-monospace, monospace);
    font-size: 11px;
    color: var(--v2-ink-3, #8a8478);
    line-height: 1;
    align-self: center;
    width: 14px;
    text-align: center;
  }
  .head-text {
    grid-column: 2;
    display: inline-flex;
    /* center, not baseline — the info-circle (12px round chip) baselines
       awkwardly with the 9.5px uppercase title (chip floats above the
       title's text). Center-aligning lines them up cleanly. */
    align-items: center;
    gap: 6px;
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
    flex: none;
  }
  /* Info-circle tooltip for the section hint. Same shape as Field's. */
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
    transition: color var(--v2-dur-snap, 80ms) var(--v2-ease),
                box-shadow var(--v2-dur-snap, 80ms) var(--v2-ease);
  }
  .info:hover,
  .info:focus-visible {
    color: var(--v2-ink, #15140e);
    box-shadow: inset 0 0 0 1px var(--v2-ink-2, #4a463c);
    outline: none;
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
  .count-dot {
    width: 5px;
    height: 5px;
    border-radius: 50%;
    background: var(--v2-hot, #b53a1f);
  }

  .body {
    display: flex;
    flex-direction: column;
    gap: var(--v2-gap-hair, 2px);
    padding: var(--v2-gap-small, 6px) 0;
  }
</style>

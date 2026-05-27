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
    /** Fires on user-toggle (click on header). Parents enforcing
     *  single-open accordion semantics own the truth and pass `open`
     *  back; without this they can't detect a peer toggle. */
    onchange?: (next: boolean) => void;
    children?: Snippet;
  }

  import Tooltip from "./Tooltip.svelte";

  let {
    title,
    hint,
    glyph,
    count,
    open = $bindable(true),
    dim,
    summary,
    onchange,
    children,
  }: Props = $props();

  function toggle() {
    const next = !open;
    open = next;
    onchange?.(next);
  }
</script>

<section class="acc" class:open class:dim>
  <button
    type="button"
    class="head"
    aria-expanded={open}
    onclick={toggle}
  >
    <span class="caret" aria-hidden="true">{open ? "▾" : "▸"}</span>
    <div class="head-text">
      <h3 class="head-title">
        {#if glyph}<span class="head-glyph" aria-hidden="true">{glyphChar(glyph)}</span>{/if}
        {title}
        {#if hint}
          <!-- Nested-button-in-button is invalid HTML (the head is a
               <button>), so we keep a <span> trigger here. The Tooltip
               primitive doesn't need an interactive trigger — it
               listens on pointerenter/leave and focusin/focusout, all
               of which work on spans. -->
          <Tooltip text={hint}>
            <span class="info" aria-label={hint}>?</span>
          </Tooltip>
        {/if}
      </h3>
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
    /* Stronger divider — the user's audit flagged "lack of contrast
       in group headings"; bumping from --v2-rule-soft (#e6e0d1) to
       --v2-rule (#d6d0c1) helps separate each section bar from the
       field rows below it without going full inky-bold. */
    border-bottom: 1px solid var(--v2-rule, #d6d0c1);
  }
  .acc:last-of-type { border-bottom: 0; }
  .acc.dim .head-title { color: var(--v2-ink-2, #4a463c); }

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
    /* center, not baseline — Tooltip's ? chip lined up below the title
       baseline awkwardly; centering aligns title + chip cleanly. */
    align-items: center;
    gap: 6px;
    min-width: 0;
    overflow: hidden;
  }
  .head-title {
    margin: 0;
    font-family: var(--v2-font-mono, ui-monospace, monospace);
    /* Bumped from text-micro (9.5px) to a hair larger + heavier weight
       so the section bar carries enough optical weight to distinguish
       it from individual Field labels (~11.5px sans). */
    font-size: 10.5px;
    font-weight: 700;
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
  /* Info-circle tooltip for the accordion hint. Same shape as Field /
     Section variants — uniform `?` affordance. */
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
  .head-summary {
    grid-column: 3;
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-family: var(--v2-font-sans, system-ui, sans-serif);
    font-size: var(--v2-text-small, 10.5px);
    color: var(--v2-ink-3, #8a8478);
    overflow: hidden;
    /* Was max-width: 50% — clipped color chips and longer summaries
       on narrow panels. The 200px reserve covers caret + title + glyph;
       summary uses the rest. */
    max-width: calc(100% - 200px);
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
    /* Match Section's 6px-top body padding so collapsed vs static
       sections share rhythm. Bottom keeps a slightly larger 8px gap
       to give the closing divider some air before the next head. */
    padding: var(--v2-gap-small, 6px) 0 var(--v2-gap-mid, 8px);
  }
</style>

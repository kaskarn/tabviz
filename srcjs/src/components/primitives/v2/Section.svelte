<!--
  Section — an always-open titled block. Used for the top-level
  structural sections of the column editor and the settings panel
  (DATA, HEADER & LAYOUT, Identity, Layout, Borders, …). Schema-
  cascade sub-sections (Numeric options, Interval options, …) use
  Accordion instead (collapsible row, summary snippet, …).

  Header anatomy:
    │ glyph │  TITLE                 hint           │ count │
    ┃ <hairline rule> ┃
    │  body slot                                             │

  Title is rendered in tracked small-caps (real `smcp` feature for
  proportionally correct caps). The optional `count` chip on the
  right is for override-count indicators ("3 overridden"). Hint,
  when given, sits inline after the title in muted italic-serif "i".

  No collapse — accordions are an explicit Accordion call, never a
  Section variant. (We tried it briefly and removed it because
  collapsed-by-default sections impeded option discovery.)
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

  const { title, hint, glyph, count, dim, children }: Props = $props();
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
          <span class="info" aria-label={hint}>i</span>
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
    position: relative;
  }
  .section.dim .head-title { color: var(--v2-ink-3, #8a8478); }
  .section.dim .body { opacity: 0.75; }

  /* Editorial section header — hanging-indent glyph in a 20px gutter,
     title's first letter aligns with every field's label baseline below.
     A hairline rule sits under the title with breathing room; ornament
     belongs to the body, not the rule. */
  .head {
    display: grid;
    grid-template-columns: 20px 1fr auto;
    align-items: baseline;
    gap: var(--v2-gap-mid, 8px);
    padding: var(--v2-gap-wide, 12px) 0 0;
  }
  .head::after {
    /* Hairline rule under the head, spanning the title column only —
       leaves the gutter glyph hanging in negative space. */
    content: "";
    grid-column: 2 / -1;
    height: 1px;
    background: var(--v2-rule-soft, #e6e0d1);
    margin-top: 6px;
  }
  .head-glyph {
    grid-column: 1;
    font-family: var(--v2-font-mono, ui-monospace, monospace);
    font-size: 12px;
    color: var(--v2-ink-3, #8a8478);
    line-height: 1;
    align-self: center;
    text-align: center;
  }
  .head-text {
    grid-column: 2;
    display: inline-flex;
    align-items: baseline;
    gap: 8px;
    min-width: 0;
    overflow: hidden;
  }
  .head-title {
    margin: 0;
    font-family: var(--v2-font-sans, system-ui);
    font-size: var(--v2-text-micro, 9.5px);
    font-weight: 600;
    /* Real small-caps via font-feature-settings — proportionally
       correct vs CSS uppercase transform. */
    font-feature-settings: "smcp" 1, "c2sc" 1;
    text-transform: lowercase;
    letter-spacing: var(--v2-track-flag, 0.14em);
    color: var(--v2-ink, #15140e);
    line-height: 1.4;
    flex: none;
  }
  /* Editorial info mark — italic serif "i", no chip. Matches Field's. */
  .info {
    display: inline-block;
    appearance: none;
    background: transparent;
    border: 0;
    padding: 0;
    color: var(--v2-ink-3, #8a8478);
    font-family: var(--v2-font-serif, "EB Garamond", "Palatino", Georgia, serif);
    font-style: italic;
    font-size: 13px;
    font-weight: 400;
    line-height: 1;
    cursor: help;
    transition: color var(--v2-dur-snap, 80ms) var(--v2-ease);
    align-self: center;
  }
  .info:hover,
  .info:focus-visible {
    color: var(--v2-ink, #15140e);
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

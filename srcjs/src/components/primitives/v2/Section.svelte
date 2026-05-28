<!--
  Section — titled block for top-level structural sections of the
  settings panel. Two modes:

  - **Static** (default): always-open titled block, used historically
    for column-editor structural sections.
  - **Collapsible**: when `collapsible` is true, the header becomes
    a clickable button that toggles the body. Parents coordinate
    "one-open-at-a-time" behavior via the `open` + `onopen`
    interface: callers pass `open={openId === id}` and an
    `onopen={() => openId = id}` handler that sets the parent's
    state when the user clicks the head. Closing the only-open
    section is a no-op (always at least one open) — pass a
    different id from `onopen` only on user clicks that REQUEST
    opening, never on close.

  Title is rendered in tracked small-caps for the editorial flag
  look. Optional `count` chip (override count) sits on the right.
-->
<script lang="ts">
  import type { Snippet } from "svelte";
  import { getContext, onMount, onDestroy } from "svelte";
  import { slide } from "svelte/transition";
  import { glyph as glyphChar, type GlyphToken } from "$lib/ui-glyphs";
  import Tooltip from "./Tooltip.svelte";

  // Accordion-group context shape — set by SettingsPanel (or any
  // parent wanting one-open-at-a-time behaviour across descendants).
  // The Section auto-registers under `title` and reads `openId` to
  // decide its open state. No manual `open`/`onopen` plumbing needed
  // when the parent provides this context.
  interface AccordionGroupCtx {
    get openId(): string;
    setOpen(id: string): void;
    register(id: string): void;
  }
  const accGroup = getContext<AccordionGroupCtx | undefined>("v2-accordion-group");

  interface Props {
    title: string;
    hint?: string;
    glyph?: GlyphToken;
    /** Override-count chip on the right. Hidden when 0 or null. */
    count?: number | null;
    /** Mute the section — used when its options are all defaults. */
    dim?: boolean;
    /** Force collapsible mode regardless of context. */
    collapsible?: boolean;
    /** Open state — used when collapsible without an accordion group. */
    open?: boolean;
    /** Called when the user clicks the head to OPEN this section. */
    onopen?: () => void;
    children?: Snippet;
  }

  let {
    title, hint, glyph, count, dim,
    collapsible, open = true, onopen,
    children,
  }: Props = $props();

  // When an accordion-group context is present, Section becomes
  // collapsible automatically. The `title` doubles as the registration
  // id (callers don't need to pass a separate id since titles within
  // one tab are already unique).
  const isCollapsible = $derived(collapsible ?? !!accGroup);
  const groupOpen = $derived(accGroup ? accGroup.openId === title : true);
  const effectiveOpen = $derived(accGroup ? groupOpen : open);

  $effect(() => {
    if (accGroup) accGroup.register(title);
  });

  function handleHeadClick() {
    if (!isCollapsible) return;
    if (accGroup) {
      // Re-clicking the already-open section is a no-op (always one open).
      if (!groupOpen) accGroup.setOpen(title);
    } else if (!open) {
      onopen?.();
    }
  }
</script>

<section class="section" class:dim class:collapsible={isCollapsible} class:closed={isCollapsible && !effectiveOpen}>
  <svelte:element
    this={isCollapsible ? "button" : "header"}
    class="head"
    type={isCollapsible ? "button" : undefined}
    role={isCollapsible ? "button" : undefined}
    aria-expanded={isCollapsible ? (effectiveOpen ? "true" : "false") : undefined}
    onclick={isCollapsible ? handleHeadClick : undefined}
  >
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
    {#if isCollapsible}
      <span class="head-caret" aria-hidden="true">{effectiveOpen ? "▾" : "▸"}</span>
    {:else if count != null && count > 0}
      <span class="head-count" title="{count} overridden">
        <span class="count-dot"></span>
        {count}
      </span>
    {/if}
  </svelte:element>
  {#if !isCollapsible || effectiveOpen}
    <div class="body" transition:slide={{ duration: 160 }}>
      {@render children?.()}
    </div>
  {/if}
</section>

<style>
  .section {
    display: flex;
    flex-direction: column;
    position: relative;
  }
  .section.dim .head-title { color: var(--v2-ink-3, #8a8478); }
  .section.dim .body { opacity: 0.75; }

  /* Between-section breathing room — no dingbat. The earlier ❦ ornament
     was promiscuous: at small font sizes it read as `·` and applied to
     every sibling Section including nested sub-sections inside a tab,
     adding noise. The hairline rule under each head + the head's own
     padding-top carries the separation; the dingbat is reserved for
     "first-class section break" moments that callers opt into via the
     yet-to-be-added <SectionBreak/> primitive. */

  /* Editorial section header — hanging-indent glyph in a 20px gutter,
     title's first letter aligns with every field's label baseline below.
     A hairline rule sits under the title with breathing room; ornament
     belongs to the body, not the rule. In collapsible mode the head
     becomes a clickable button — the existing visual remains, just
     with cursor + caret-on-right. */
  .head {
    display: grid;
    grid-template-columns: 20px 1fr auto;
    align-items: baseline;
    gap: var(--v2-gap-mid, 8px);
    padding: var(--v2-gap-wide, 12px) 0 0;
    appearance: none;
    background: transparent;
    border: 0;
    color: inherit;
    font: inherit;
    width: 100%;
    text-align: left;
  }
  .section.collapsible .head {
    cursor: pointer;
  }
  .section.collapsible .head:hover .head-title {
    color: var(--v2-ink, #15140e);
  }
  .section.closed .head { padding-bottom: 0; }
  .section.closed .head::after { margin-bottom: var(--v2-gap-small, 6px); }
  .head-caret {
    grid-column: 3;
    align-self: center;
    font-size: 10px;
    color: var(--v2-ink-3, #8a8478);
    line-height: 1;
    width: 14px;
    text-align: center;
    transition: color var(--v2-dur-snap, 80ms) var(--v2-ease);
  }
  .section.collapsible .head:hover .head-caret {
    color: var(--v2-ink, #15140e);
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

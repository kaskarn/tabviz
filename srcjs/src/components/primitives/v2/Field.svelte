<!--
  Field — labeled control row, the unit of one option in the editor.

  Layout (4 columns):
    │ ●  │ label                  │ control       │  hint  │
    │ 8  │ 84-100 (flex-shrink)   │ 1fr           │ auto   │

  Column 1 (gutter): override dot — 6px hot circle when `pinned`,
                     otherwise empty. Always reserved width so labels
                     don't dance when override state toggles.
  Column 2: label — sans, ink-2 muted, 11.5px. Optional `mono` flag
                    for technical names (field paths).
  Column 3: control slot — flex-grows.
  Column 4: hint — italic, ink-3, optional.

  Reset affordance: clicking the dot column triggers `onreset` if set.
  The hot dot becomes a hover-affordance "reset to default" target,
  which is dense + invisible until needed.
-->
<script lang="ts">
  import type { Snippet } from "svelte";
  import { glyph as glyphChar, type GlyphToken } from "$lib/ui-glyphs";
  import Tooltip from "./Tooltip.svelte";

  interface Props {
    label: string;
    hint?: string;
    /** Inline glyph next to label (e.g. type indicator). */
    glyph?: GlyphToken;
    /** Render label in mono — for code-y option names. */
    mono?: boolean;
    /** True when value differs from schema default — shows hot dot. */
    pinned?: boolean;
    /** Hand control width to caller via min-content vs flex. */
    tight?: boolean;
    /** Click handler on the gutter dot — usually a reset-to-default. */
    onreset?: () => void;
    /** id for label `for=` association. */
    forId?: string;
    children?: Snippet;
  }

  let { label, hint, glyph, mono, pinned, tight, onreset, forId, children }: Props = $props();
</script>

<!--
  Hint behavior: rendered as a `?` info-circle next to the label with
  the hint text in a native `title=` tooltip. The previous always-
  visible inline hint chewed a second grid row per field and dominated
  vertical space; users mostly skim past hint prose, so progressive
  disclosure on hover/focus is a better default. Native title is the
  baseline; a Tooltip primitive can replace it later for richer surfaces.
-->
<div class="field" class:tight>
  <button
    class="gutter"
    type="button"
    aria-label={pinned ? "Reset to default" : "Default value (no override)"}
    disabled={!pinned}
    onclick={() => pinned && onreset?.()}
    tabindex={pinned && onreset ? 0 : -1}
  >
    <span class="dot" class:on={pinned}></span>
  </button>

  <label class="label" for={forId} class:mono>
    {#if glyph}
      <span class="label-glyph" aria-hidden="true">{glyphChar(glyph)}</span>
    {/if}
    <!-- title= surfaces the full label on hover when ellipsis truncates
         the visible text. No CSS-only overflow detection; rely on the
         browser to do the right thing (it always shows the title). -->
    <span class="label-text" title={label}>{label}</span>
    {#if hint}
      <Tooltip text={hint}>
        <span class="info" aria-label={hint}>?</span>
      </Tooltip>
    {/if}
  </label>

  <div class="control">
    {@render children?.()}
  </div>
</div>

<style>
  /* Single-row layout: [gutter] [label (+? if hinted)] [control].
     Label column is a fixed width — not `minmax(72px, max-content)`
     as before — so labels of varying length all line up across the
     section (e.g. "Fill" / "Stroke (emphasis)" / "Sig. digits" in the
     same accordion). Without a fixed track each row picked its own
     label width, making the controls visually staircase to the right.
     100px fits the longest labels we have today + leaves room for the
     `?` info chip; truncate with ellipsis on overflow. */
  .field {
    display: grid;
    grid-template-columns: 8px 100px 1fr;
    grid-template-rows: var(--v2-row-h, 24px);
    align-items: center;
    column-gap: var(--v2-gap-mid, 8px);
    row-gap: 0;
  }
  .field.tight {
    /* When the control wants its native width (Pill, Toggle), let it
       sit at its intrinsic width and free up the rest of the row. */
    grid-template-columns: 8px 100px max-content 1fr;
  }

  /* ── Gutter (override dot / reset button) ───────────────── */
  .gutter {
    appearance: none;
    border: 0;
    background: transparent;
    padding: 0;
    width: 8px;
    height: 100%;
    cursor: default;
    display: grid;
    place-items: center;
  }
  .gutter:not(:disabled) { cursor: pointer; }
  .gutter:focus-visible {
    outline: 1px solid var(--v2-focus-ring, #15140e);
    outline-offset: -1px;
  }
  .dot {
    width: 5px;
    height: 5px;
    border-radius: 50%;
    background: transparent;
    transition: background var(--v2-dur-snap, 80ms) var(--v2-ease);
  }
  .dot.on {
    background: var(--v2-hot, #b53a1f);
  }
  .gutter:hover .dot.on {
    /* On hover, the dot becomes a tiny X-mark — reset affordance.
       We do this with a pseudo overlay so the dot itself stays put. */
    background: var(--v2-ink, #15140e);
  }

  /* ── Label ───────────────────────────────────────────────── */
  .label {
    display: inline-flex;
    align-items: center;
    gap: var(--v2-gap-small, 6px);
    font-size: var(--v2-text-body, 11.5px);
    color: var(--v2-ink-2, #4a463c);
    line-height: 1.2;
    user-select: none;
    white-space: nowrap;
    overflow: hidden;
    min-width: 0;
  }
  .label .label-text {
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .label.mono { font-family: var(--v2-font-mono, ui-monospace, monospace); }
  .label-glyph {
    font-family: var(--v2-font-mono, ui-monospace, monospace);
    font-size: 11px;
    color: var(--v2-ink-3, #8a8478);
    width: 14px;
    text-align: center;
    line-height: 1;
  }
  .label-text { line-height: 1; }

  /* ── Control slot ────────────────────────────────────────── */
  .control {
    display: flex;
    align-items: center;
    gap: var(--v2-gap-small, 6px);
    min-width: 0;
  }

  /* ── Info-circle (replaces inline hint) ────────────────────
     Small `?` chip after the label. The native title attribute
     surfaces the hint on hover; styling is intentionally muted so
     the `?` reads as auxiliary, not a clickable control. */
  .info {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 12px;
    height: 12px;
    border-radius: 50%;
    background: transparent;
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
</style>

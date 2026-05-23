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

<div class="field" class:tight class:has-hint={!!hint}>
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
    <span class="label-text">{label}</span>
  </label>

  <div class="control">
    {@render children?.()}
  </div>

  {#if hint}
    <span class="hint">{hint}</span>
  {/if}
</div>

<style>
  .field {
    display: grid;
    grid-template-columns: 8px minmax(72px, max-content) 1fr;
    grid-template-rows: var(--v2-row-h, 24px) auto;
    align-items: center;
    column-gap: var(--v2-gap-mid, 8px);
    row-gap: 0;
  }
  .field.has-hint {
    grid-template-columns: 8px minmax(72px, max-content) 1fr auto;
  }
  .field.tight {
    /* When the control wants its native width (e.g. a Pill), let the
       hint slide closer instead of flex-stretching the control. */
    grid-template-columns: 8px minmax(72px, max-content) max-content;
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

  /* ── Hint ────────────────────────────────────────────────── */
  .hint {
    font-size: var(--v2-text-small, 10.5px);
    color: var(--v2-ink-3, #8a8478);
    font-style: italic;
    line-height: 1.2;
    white-space: nowrap;
  }
</style>

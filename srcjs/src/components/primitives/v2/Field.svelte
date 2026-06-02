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

  const { label, hint, glyph, mono, pinned, tight, onreset, forId, children }: Props = $props();
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
        <span class="info" aria-label={hint}>i</span>
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
  /* Tightened spine: label column 72px (was 100px). Most labels in
     the panel are ≤8 chars ("Primary", "Subtitle", "Caption", "Color"
     etc.), which fit comfortably at 72px even with the small-caps
     scale. Long labels truncate with ellipsis as before; the title
     attribute surfaces the full text on hover. */
  .field {
    display: grid;
    grid-template-columns: 8px 72px 1fr;
    grid-template-rows: minmax(var(--v2-row-h, 22px), auto);
    align-items: center;
    column-gap: var(--v2-gap-mid, 8px);
    row-gap: 0;
  }
  .field.tight {
    grid-template-columns: 8px 72px max-content 1fr;
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
  /* Override mark — a small ink-stamped square with a soft halo. When
     unset it's truly absent (opacity 0 + scaled-down) and animates
     in/out with a 180ms ease for the hello/goodbye feel. */
  .dot {
    width: 4px;
    height: 4px;
    background: transparent;
    opacity: 0;
    transform: scale(0.5);
    transition:
      opacity 180ms var(--v2-ease, ease-out),
      transform 180ms var(--v2-ease, ease-out),
      background-color var(--v2-dur-snap, 80ms) var(--v2-ease),
      box-shadow 180ms var(--v2-ease, ease-out);
  }
  .dot.on {
    opacity: 1;
    transform: scale(1);
    background: var(--v2-hot, #b53a1f);
    box-shadow: 0 0 0 2px color-mix(in srgb, var(--v2-hot, #b53a1f) 22%, transparent);
  }
  .gutter:hover .dot.on {
    background: var(--v2-ink, #15140e);
    box-shadow: 0 0 0 2px color-mix(in srgb, var(--v2-ink, #15140e) 22%, transparent);
  }

  /* ── Label ───────────────────────────────────────────────
     Right-justified to the gutter so the label baseline and the
     control baseline meet at a clean vertical spine. Hint mark
     trails the label inline; the whole label group sits at the
     right edge of the 100px column. */
  .label {
    display: inline-flex;
    align-items: center;
    justify-content: flex-end;
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

  /* ── Editorial info mark ────────────────────────────────
     A serif italic "i" — no chip, no outline. Reads like a
     footnote marker in a journal article. Hover brings it to
     full ink. Pure typographic affordance. */
  .info {
    display: inline-block;
    color: var(--v2-ink-3, #8a8478);
    font-family: var(--v2-font-serif, "EB Garamond", "Palatino", "Georgia", serif);
    font-style: italic;
    font-size: 12px;
    font-weight: 400;
    line-height: 1;
    cursor: help;
    transition: color var(--v2-dur-snap, 80ms) var(--v2-ease);
    user-select: none;
    margin-left: 2px;
  }
  .info:hover,
  .info:focus-visible {
    color: var(--v2-ink, #15140e);
    outline: none;
  }
</style>

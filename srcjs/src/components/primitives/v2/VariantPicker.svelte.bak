<!--
  VariantPicker — horizontal card row for selecting a schema variant
  (a curated rendering recipe). Each card shows label + preview snippet
  + optional description as tooltip; the active card inverts to
  ink-on-cream so the choice is unmistakable.

  Distinct from Pill: Pill is for one-line enum picking (compact);
  VariantPicker is for *visual* choices where seeing a small preview
  of each option dramatically helps. Renders 2-5 cards in a flex row;
  beyond that the row scrolls horizontally.

  The preview field is a free-form short string (label-style). Multi-
  line previews use `\n` and are rendered with `white-space: pre-line`.
-->
<script lang="ts">
  import type { VariantSpec } from "../../../schema/types";

  interface Props {
    value?: string | null;
    variants: VariantSpec[];
    ariaLabel?: string;
    disabled?: boolean;
    onchange?: (next: string) => void;
  }

  let {
    value = $bindable(null),
    variants,
    ariaLabel = "variant",
    disabled = false,
    onchange,
  }: Props = $props();

  // Resolve active id — defaults to the first variant when value is null.
  const activeId = $derived(value ?? variants[0]?.id ?? null);

  function pick(id: string) {
    if (disabled) return;
    if (id === activeId) return;
    value = id;
    onchange?.(id);
  }
</script>

<div class="vp" role="radiogroup" aria-label={ariaLabel}>
  {#each variants as v (v.id)}
    {@const active = v.id === activeId}
    <button
      type="button"
      role="radio"
      class="card"
      class:active
      aria-checked={active}
      title={v.description ?? v.label}
      {disabled}
      onclick={() => pick(v.id)}
    >
      <span class="preview">{v.preview ?? v.label}</span>
      <span class="label">{v.label}</span>
    </button>
  {/each}
</div>

<style>
  .vp {
    display: flex;
    gap: 6px;
    overflow-x: auto;
    padding: 2px 0;
    /* The horizontal scrollbar should be invisible in chrome but
       still scrollable via wheel/drag. */
    scrollbar-width: thin;
  }

  .card {
    appearance: none;
    border: 0;
    background: var(--v2-paper-edge, #fff);
    box-shadow: inset 0 0 0 1px var(--v2-rule, #d6d0c1);
    border-radius: var(--v2-r-soft, 3px);
    padding: 10px 10px 8px;
    min-width: 100px;
    max-width: 160px;
    flex: 1 1 auto;
    cursor: pointer;
    display: flex;
    flex-direction: column;
    gap: 6px;
    text-align: left;
    color: var(--v2-ink, #15140e);
    font: inherit;
    transition:
      box-shadow var(--v2-dur-snap, 80ms) var(--v2-ease, ease),
      background var(--v2-dur-snap, 80ms) var(--v2-ease, ease);
  }
  .card:hover:not(.active) {
    box-shadow: inset 0 0 0 1px var(--v2-ink-2, #4a463c);
  }
  .card.active {
    background: var(--v2-active-bg, #15140e);
    color: var(--v2-active-fg, #faf7f0);
    box-shadow: none;
  }
  .card:focus-visible {
    outline: 1px solid var(--v2-focus-ring, #15140e);
    outline-offset: 2px;
  }
  .card:disabled { opacity: 0.4; cursor: not-allowed; }

  /* Preview area — fixed height so cards align even when previews
     have different line counts. The 'pre-line' rule respects `\n` in
     the preview string for genuinely multi-line recipes. */
  .preview {
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 28px;
    font-family: var(--v2-font-mono, ui-monospace, monospace);
    font-size: var(--v2-text-body, 11.5px);
    line-height: 1.25;
    white-space: pre-line;
    text-align: center;
    color: inherit;
  }
  .label {
    font-family: var(--v2-font-mono, ui-monospace, monospace);
    font-size: 9px;
    text-transform: uppercase;
    letter-spacing: var(--v2-track-flag, 0.14em);
    color: var(--v2-ink-3, #8a8478);
    border-top: 1px solid var(--v2-rule-soft, #e6e0d1);
    padding-top: 5px;
  }
  .card.active .label {
    color: var(--v2-active-fg, #faf7f0);
    opacity: 0.6;
    border-top-color: rgba(250, 247, 240, 0.15);
  }
</style>

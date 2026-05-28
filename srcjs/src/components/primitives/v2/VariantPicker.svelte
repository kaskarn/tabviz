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
  /* Equal-width 3+ column grid — matches the LayoutControl cards
     (Density / Header / Marks). Auto-fit so 2-card or 4-card variant
     lists still distribute evenly. Min track 72px lets 4 cards fit
     in the editor's 200px control area. No horizontal scroll. */
  .vp {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(72px, 1fr));
    gap: 6px;
    width: 100%;
    padding: 0;
  }

  .card {
    appearance: none;
    border: 1px solid var(--v2-rule-soft, #e6e0d1);
    background: var(--v2-paper-edge, #fff);
    border-radius: var(--v2-r-hair, 2px);
    padding: 6px 4px 4px;
    min-width: 0;
    cursor: pointer;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 3px;
    color: var(--v2-ink, #15140e);
    font: inherit;
    transition:
      border-color var(--v2-dur-snap, 80ms) var(--v2-ease, ease),
      background var(--v2-dur-snap, 80ms) var(--v2-ease, ease);
  }
  .card:hover:not(.active) {
    border-color: var(--v2-rule, #d6d0c1);
  }
  .card.active {
    border-color: var(--v2-ink, #15140e);
    box-shadow: inset 0 0 0 0.5px var(--v2-ink, #15140e);
  }
  .card:focus-visible {
    outline: 1px solid var(--v2-focus-ring, #15140e);
    outline-offset: 2px;
  }
  .card:disabled { opacity: 0.4; cursor: not-allowed; }

  /* Preview snippet — kept as a text string for now (changing
     VariantSpec to require an SVG would touch every schema). Uniform
     22px box so cards align even when previews wrap. The mono font +
     pre-line preserve `\n` for recipe-style previews. */
  .preview {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 22px;
    width: 100%;
    font-family: var(--v2-font-mono, ui-monospace, monospace);
    font-size: 10px;
    line-height: 1.1;
    white-space: pre-line;
    text-align: center;
    color: var(--v2-ink-2, #4a463c);
    overflow: hidden;
  }
  .label {
    font-family: var(--v2-font-sans, system-ui, sans-serif);
    font-size: 9.5px;
    font-feature-settings: "smcp" 1, "c2sc" 1;
    text-transform: lowercase;
    letter-spacing: 0.08em;
    color: var(--v2-ink-3, #8a8478);
    line-height: 1;
  }
  .card.active .label { color: var(--v2-ink, #15140e); }
  .card.active .preview { color: var(--v2-ink, #15140e); }
</style>

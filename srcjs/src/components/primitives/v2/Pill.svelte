<!--
  Pill — unified discrete-choice control. Replaces v1 Toggle + Segmented.

  Boolean is the 2-segment degenerate case:
    <Pill bind:value segments={[{value:false,label:"off"},{value:true,label:"on"}]} />

  Three-or-more segments behave as a segmented radiogroup. The control
  is always one shape — a pill — and the active segment inverts (ink
  background, cream foreground). Inactive segments are bare text; the
  affordance is only revealed on hover.

  Glyphs ride first-class via `segments[i].glyph` (a GlyphToken). If
  every segment carries a glyph the pill renders in icon-only mode at
  a tighter width; if any segment lacks a glyph the pill renders
  label-only.

  Visual rules:
  - No box around inactive content; hover reveals a soft tint
  - Active segment inverts; its content stays mono if `mono` prop true
  - Override dot (small hot circle) appears in the gutter when
    `pinned` prop is true — for use when wrapped by Field
  - Disabled drops opacity, locks pointer
-->
<script lang="ts" generics="T extends string | number | boolean | null">
  import { glyph as glyphChar } from "$lib/ui-glyphs";
  import type { PillSegment } from "./types";

  interface Props {
    value: T;
    segments: PillSegment<T>[];
    ariaLabel?: string;
    /** Mono font for content. Defaults to false (sans). */
    mono?: boolean;
    /** Render glyph-only when every segment carries one. */
    iconOnly?: boolean;
    disabled?: boolean;
    onchange?: (next: T) => void;
  }

  let {
    value = $bindable(),
    segments,
    ariaLabel,
    mono = false,
    iconOnly,
    disabled = false,
    onchange,
  }: Props = $props();

  // Auto-detect icon-only: every segment has a glyph and no label,
  // OR caller forced it.
  const allHaveGlyph = $derived(segments.every((s) => s.glyph != null));
  const allLackLabel = $derived(segments.every((s) => !s.label));
  const renderIconOnly = $derived(iconOnly ?? (allHaveGlyph && allLackLabel));

  function select(v: T) {
    if (disabled) return;
    if (v === value) return;
    value = v;
    onchange?.(v);
  }

  // Radiogroup keyboard contract (a11y review): arrow keys move + select,
  // roving tabindex keeps ONE tab stop per pill. Without this each
  // segment was a separate Tab stop and arrows did nothing — neither is
  // what role="radio" promises a screen-reader user.
  const activeIndex = $derived(Math.max(0, segments.findIndex((s) => s.value === value)));
  function handleKeydown(e: KeyboardEvent, i: number) {
    let next: number | null = null;
    if (e.key === "ArrowRight" || e.key === "ArrowDown") next = (i + 1) % segments.length;
    else if (e.key === "ArrowLeft" || e.key === "ArrowUp") next = (i - 1 + segments.length) % segments.length;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = segments.length - 1;
    if (next == null) return;
    e.preventDefault();
    select(segments[next].value);
    const root = (e.currentTarget as HTMLElement).parentElement;
    (root?.children[next] as HTMLElement | undefined)?.focus();
  }
</script>

<div
  class="pill"
  class:disabled
  class:mono
  class:icon-only={renderIconOnly}
  role="radiogroup"
  aria-label={ariaLabel}
>
  {#each segments as seg, i (i)}
    {@const active = value === seg.value}
    <button
      type="button"
      role="radio"
      class="seg"
      class:active
      aria-checked={active}
      tabindex={i === activeIndex ? 0 : -1}
      title={seg.title}
      {disabled}
      onclick={() => select(seg.value)}
      onkeydown={(e) => handleKeydown(e, i)}
    >
      {#if seg.glyph}
        <span class="seg-glyph" aria-hidden="true">{glyphChar(seg.glyph)}</span>
      {/if}
      {#if seg.label}
        <span class="seg-label">{seg.label}</span>
      {/if}
    </button>
  {/each}
</div>

<style>
  .pill {
    display: inline-flex;
    align-items: stretch;
    height: var(--v2-control-h, 22px);
    background: var(--v2-paper-2, #f3efe5);
    border-radius: var(--v2-r-pill, 11px);
    padding: 1px;
    gap: 1px;
    user-select: none;
    /* Subtle inner shadow gives the pill a sunken-into-paper feel. */
    box-shadow: inset 0 0 0 1px var(--v2-rule-soft, #e6e0d1);
  }
  .pill.disabled { opacity: 0.4; pointer-events: none; }
  .pill.mono { font-family: var(--v2-font-mono, ui-monospace, monospace); }

  .seg {
    appearance: none;
    border: 0;
    background: transparent;
    padding: 0 10px;
    min-width: 24px;
    border-radius: calc(var(--v2-r-pill, 11px) - 1px);
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 5px;
    font: inherit;
    font-family: inherit;
    font-size: var(--v2-text-body, 11.5px);
    color: var(--v2-ink-2, #4a463c);
    cursor: pointer;
    transition:
      background var(--v2-dur-snap, 80ms) var(--v2-ease, ease),
      color      var(--v2-dur-snap, 80ms) var(--v2-ease, ease);
    white-space: nowrap;
  }
  .pill.icon-only .seg {
    padding: 0;
    min-width: 26px;
  }
  .seg:hover:not(.active) {
    background: var(--v2-hover-tint, rgba(21,20,14,0.05));
    color: var(--v2-ink, #15140e);
  }
  .seg.active {
    background: var(--v2-active-bg, #15140e);
    color: var(--v2-active-fg, #faf7f0);
  }
  .seg:focus-visible {
    outline: 1px solid var(--v2-focus-ring, #15140e);
    outline-offset: 1px;
  }

  .seg-glyph {
    font-family: var(--v2-font-mono, ui-monospace, monospace);
    font-size: 12px;
    line-height: 1;
    /* Slight optical lift — glyphs sit a hair below center otherwise. */
    transform: translateY(-0.5px);
  }
  .pill.icon-only .seg-glyph {
    font-size: 13px;
  }
  .seg-label {
    line-height: 1;
  }
  @media (prefers-reduced-motion: reduce) {
    .seg { transition: none; }
  }
</style>

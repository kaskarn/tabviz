<!--
  Swatch — color input. Modeled on rgc-design's Color: chip + hex
  + INLINE palette swatches when provided. The palette is the
  primary affordance for theme-anchored work — burying it behind a
  dropdown was wrong.

  Anatomy:
    [●][#b53a1f      ][□ □ □ □ □ □ □ □]
     chip  hex input    inline swatches (when provided)

  - Chip is the click target for the native OS color picker
  - Hex input is the canonical source of truth (any CSS hex form)
  - Inline swatches click to pick; the active swatch gets a 3-px
    ink halo (paper offset) so it reads at a glance

  No dropdown trigger. If the host wants the older dropdown UX they
  can render a custom shell — this primitive picks the inline pattern
  because it's faster (one click vs click-open-click) and shows the
  available choices without disclosure.
-->
<script lang="ts">
  import { untrack } from "svelte";
  import type { ThemeSwatch } from "./types";

  interface Props {
    value?: string | null;
    /** Theme-anchored palette. Rendered inline when present. */
    swatches?: ThemeSwatch[];
    /** Show the "unset" diagonal-stripe chip in the inline palette. */
    allowUnset?: boolean;
    placeholder?: string;
    disabled?: boolean;
    id?: string;
    /** Fires whenever value changes — palette pick, native picker, hex
     *  commit. Parents that don't use `bind:value` MUST pass this. */
    onchange?: (next: string | null) => void;
  }

  let {
    value = $bindable(null),
    swatches = [],
    allowUnset = true,
    placeholder = "#…",
    disabled = false,
    id,
    onchange,
  }: Props = $props();

  // Set value AND fire onchange. Called only from user-action mutation
  // points (hex commit, palette pick, native picker). A $effect that
  // watches `value` would also fire when the parent reassigns it,
  // causing onchange→commit→prop-update loops at call sites that don't
  // use `bind:` (most do not). Pill primitive uses the same pattern.
  function emit(next: string | null) {
    if (next === value) return;
    value = next;
    onchange?.(next);
  }

  // Local in-flight hex while the user is typing. Sync FROM value but
  // not back — without untrack, raw is also a dep of the effect, so
  // typing fires the effect, sees raw !== String(value), and clobbers
  // the keystroke. Same bug pattern as Knob; same fix.
  let raw = $state(value ?? "");
  $effect(() => {
    const next = value ?? "";
    untrack(() => {
      if (next !== raw) raw = next;
    });
  });

  function isValidHex(s: string): boolean {
    return /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(s.trim());
  }
  function commit() {
    const t = raw.trim();
    if (t === "") { emit(null); return; }
    if (isValidHex(t)) emit(t.startsWith("#") ? t : `#${t}`);
    else raw = value ?? "";
  }
  function pick(c: string | null) {
    emit(c);
    raw = c ?? "";
  }
  function onKey(e: KeyboardEvent) {
    if (e.key === "Enter") (e.target as HTMLInputElement).blur();
  }

  function normalizeForNative(v: string | null): string {
    if (!v) return "#000000";
    if (/^#[0-9a-f]{6}$/i.test(v)) return v;
    const m3 = /^#([0-9a-f])([0-9a-f])([0-9a-f])$/i.exec(v);
    if (m3) return `#${m3[1]}${m3[1]}${m3[2]}${m3[2]}${m3[3]}${m3[3]}`;
    return "#000000";
  }

  function onNative(e: Event) {
    pick((e.target as HTMLInputElement).value);
  }

  const displayed = $derived(isValidHex(value ?? "") ? value : null);
  const hasPalette = $derived(swatches.length > 0);
</script>

<!--
  Two-row editorial layout:
    Row 1 — chip + hex, sitting at the row baseline.
    Row 2 — palette strip beneath, left-aligned with the chip so the
            active swatch reads as a "tab beneath" the chip.

  Always two rows when a palette is provided. The previous one-row
  chip|hex|palette layout did not fit the panel reliably; this
  intentional 2-row shape is taller but predictable and reads like a
  composed unit rather than a wrap accident.
-->
<div class="swatch" class:disabled class:has-palette={hasPalette}>
  <div class="primary-row">
    <!-- Chip — clicking opens the OS-native picker via the overlaid input. -->
    <span class="chip" class:unset={!displayed} style:background={displayed ?? "transparent"} aria-hidden="true">
      <input
        type="color"
        class="native"
        value={normalizeForNative(value)}
        onchange={onNative}
        {disabled}
        tabindex="-1"
        aria-label="Open native color picker"
      />
    </span>

    <!-- Hex input — canonical source of truth. -->
    <input
      type="text"
      class="hex"
      bind:value={raw}
      onblur={commit}
      onkeydown={onKey}
      {placeholder}
      {disabled}
      {id}
      spellcheck="false"
      aria-label="Hex color value"
    />
  </div>

  {#if hasPalette}
    <div class="palette-row">
      {#each swatches as s (s.token)}
        <button
          type="button"
          class="sw"
          class:active={value === s.color}
          style:background={s.color}
          title={s.token}
          aria-label={`Pick ${s.token}`}
          onclick={() => pick(s.color)}
          {disabled}
        ></button>
      {/each}
      {#if allowUnset}
        <button
          type="button"
          class="sw unset-sw"
          class:active={value == null}
          title="unset — inherit"
          aria-label="Unset — inherit from theme"
          onclick={() => pick(null)}
          {disabled}
        ></button>
      {/if}
    </div>
  {/if}
</div>

<style>
  /* Two-row card. Row 1 carries chip + hex at control-h; row 2 carries
     the palette strip. The card claims its column's full width so the
     primary row left-aligns at the same x as every other Field control,
     and the palette strip below shares that same leading edge. */
  .swatch {
    display: grid;
    /* minmax(0, 1fr) prevents the grid track from being inflated by
       the palette row's intrinsic content width — without it, the
       1fr column sizes to max-content of either row, which lets the
       palette overflow the panel even when the parent has a finite
       width. */
    grid-template-columns: minmax(0, 1fr);
    grid-auto-rows: min-content;
    row-gap: 4px;
    flex: 1;
    min-width: 0;
    align-self: center;
    /* Defense in depth: if a future caller pushes a longer-than-
       expected palette through, clip it instead of bleeding outside
       the panel. The wrap below also helps. */
    overflow: hidden;
  }
  .swatch.disabled { opacity: 0.4; pointer-events: none; }

  .primary-row {
    display: flex;
    align-items: center;
    gap: var(--v2-gap-small, 6px);
    height: var(--v2-control-h, 22px);
  }

  /* ── Chip ────────────────────────────────────────────────
     Larger (22px) than the original 18px — at this size the
     chip reads as a sample swatch rather than an icon, which
     matches the editorial color-stamp aesthetic. */
  .chip {
    position: relative;
    width: 22px;
    height: 22px;
    border-radius: var(--v2-r-soft, 3px);
    box-shadow:
      inset 0 0 0 1px var(--v2-rule, #d6d0c1),
      0 1px 0 var(--v2-paper-2, #f3efe5);
    flex: none;
    cursor: pointer;
    transition:
      box-shadow var(--v2-dur-snap, 80ms) var(--v2-ease),
      transform var(--v2-dur-snap, 80ms) var(--v2-ease);
  }
  .chip:hover {
    box-shadow:
      inset 0 0 0 1px var(--v2-ink-2, #4a463c),
      0 1px 0 var(--v2-paper-2, #f3efe5);
  }
  .chip:active { transform: scale(0.96); }
  .chip.unset {
    background-image: repeating-linear-gradient(
      45deg,
      var(--v2-paper-edge, #fff) 0 4px,
      var(--v2-paper-2, #f3efe5) 4px 8px
    ) !important;
  }
  .native {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    opacity: 0;
    cursor: pointer;
    border: 0;
    padding: 0;
  }

  /* ── Hex ─────────────────────────────────────────────────
     Grows to fill the rest of the primary row. Mono + tabular
     numerics + tiny letter-spacing so hex codes typeset like a
     caption. Right-aligned text so the trailing characters stay
     visible if the user narrows the panel. */
  .hex {
    flex: 1 1 auto;
    min-width: 56px;
    height: var(--v2-control-h, 22px);
    padding: 0 8px;
    border: 0;
    border-radius: var(--v2-r-soft, 3px);
    background: var(--v2-paper-edge, #fff);
    box-shadow: inset 0 0 0 1px var(--v2-rule, #d6d0c1);
    font-family: var(--v2-font-mono, ui-monospace, monospace);
    font-size: var(--v2-text-body, 11.5px);
    font-variant-numeric: tabular-nums;
    letter-spacing: 0.02em;
    color: var(--v2-ink, #15140e);
    text-align: right;
    outline: none;
    transition: box-shadow var(--v2-dur-snap, 80ms) var(--v2-ease);
  }
  .hex:hover  { box-shadow: inset 0 0 0 1px var(--v2-ink-2, #4a463c); }
  .hex:focus  { box-shadow: inset 0 0 0 1px var(--v2-rule-strong, #15140e); }
  .hex::placeholder {
    color: var(--v2-ink-3, #8a8478);
    font-style: italic;
  }

  /* ── Palette strip ───────────────────────────────────────
     Always on its own row, sitting under chip+hex. Left-aligned
     so the leftmost swatch shares an x-baseline with the chip
     above it. Flex-wrap lets the strip break to additional rows
     in pathologically narrow panels (rather than clip). */
  .palette-row {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 3px;
    /* Subtle indent so the palette reads as a follower, not a
       sibling, of the primary row. The ~28px matches chip+gap. */
    padding-left: 28px;
  }
  .sw {
    appearance: none;
    border: 0;
    padding: 0;
    width: 12px;
    height: 12px;
    flex: none;
    border-radius: 2px;
    box-shadow: inset 0 0 0 1px var(--v2-rule, #d6d0c1);
    cursor: pointer;
    transition:
      transform var(--v2-dur-snap, 80ms) var(--v2-ease),
      box-shadow var(--v2-dur-snap, 80ms) var(--v2-ease);
  }
  .sw:hover { transform: translateY(-1px); }
  .sw.active {
    box-shadow:
      inset 0 0 0 1px var(--v2-paper-edge, #fff),
      0 0 0 1.5px var(--v2-ink, #15140e);
    transform: translateY(-1px);
  }
  .sw:focus-visible {
    outline: 1px solid var(--v2-focus-ring, #15140e);
    outline-offset: 2px;
  }
  .unset-sw {
    background-image: repeating-linear-gradient(
      45deg,
      var(--v2-paper-edge, #fff) 0 2.5px,
      var(--v2-paper-2, #f3efe5) 2.5px 5px
    );
  }
</style>

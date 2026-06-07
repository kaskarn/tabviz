<!--
  AnchorRow — the flagship shared Tier-1 control (settings-overhaul P1).

  ONE implementation for both hosts (T1 decision: shared components
  everywhere; the LayoutControl-mirror drift class must be impossible):
    - settings (layout="compact"): a 1-row Field — swatch chip + mono hex
      + caret; the LCH editor expands inline. Accordion-of-one is the
      HOST's job (pass `expanded` + `onexpand`).
    - studio rail (layout="roomy"): the LCH editor is always open.

  The LCH editor: three v2 Sliders whose tracks PAINT their axis —
    L: dark→light at the row's current C/H
    C: achromatic→saturated at the row's current L/H
    H: the hue wheel at the row's current L/C (C floored so the wheel
       reads on near-achromatic anchors)
  — with the resolved anchor color on every thumb. Drag previews through
  the C53 channel (onpreview, no history); release commits (oncommit).

  Optional-anchor affordances: `mirrored` shows the inherits-tag; a set
  optional anchor gets the clear-↻ (onclear).
-->
<script lang="ts">
  import type { OklchTriple } from "$types/theme-inputs";
  import { oklchToHex, hexToOklch } from "$lib/oklch";
  import Field from "$components/primitives/v2/Field.svelte";
  import Slider from "$components/primitives/v2/Slider.svelte";
  import TextInput from "$components/primitives/v2/TextInput.svelte";

  interface Props {
    label: string;
    hint?: string;
    triple: OklchTriple;
    /** Host layout: "compact" = collapsed row + inline expand (settings);
     *  "roomy" = LCH editor always open (studio rail). */
    layout?: "compact" | "roomy";
    /** Compact-host expand state (accordion-of-one lives in the host). */
    expanded?: boolean;
    onexpand?: (open: boolean) => void;
    /** True when this anchor inherits (optional anchor, unset). */
    mirrored?: boolean;
    /** True when the anchor differs from the active preset. */
    pinned?: boolean;
    /** Reset to the preset value (gutter dot). */
    onreset?: () => void;
    /** Clear an optional anchor back to inheriting. */
    onclear?: () => void;
    /** Commit (history step). */
    oncommit: (next: OklchTriple) => void;
    /** Drag-tick preview (C53 — no history, no re-measure). */
    onpreview?: (next: OklchTriple) => void;
  }

  const {
    label,
    hint,
    triple,
    layout = "compact",
    expanded = false,
    onexpand,
    mirrored = false,
    pinned = false,
    onreset,
    onclear,
    oncommit,
    onpreview,
  }: Props = $props();

  const open = $derived(layout === "roomy" || expanded);
  const hex = $derived(oklchToHex(triple));

  // ── Axis gradients: the track teaches what each position means. ─────
  function stops(make: (t: number) => OklchTriple, n = 9): string {
    const out: string[] = [];
    for (let i = 0; i < n; i++) out.push(oklchToHex(make(i / (n - 1))));
    return `linear-gradient(to right, ${out.join(", ")})`;
  }
  const trackL = $derived(stops((t) => ({ L: t, C: triple.C, H: triple.H })));
  const trackC = $derived(stops((t) => ({ L: triple.L, C: t * 0.4, H: triple.H })));
  const trackH = $derived(stops(
    (t) => ({ L: triple.L, C: Math.max(triple.C, 0.08), H: t * 360 }),
    13,
  ));

  function setAxis(axis: "L" | "C" | "H", v: number, commit: boolean): void {
    const next = { ...triple, [axis]: v };
    if (commit) oncommit(next);
    else (onpreview ?? oncommit)(next);
  }

  function commitHex(h: string): void {
    const t = hexToOklch(h);
    if (t) oncommit(t);
  }

  function fmt(axis: "L" | "C" | "H", v: number): string {
    return axis === "H" ? `${Math.round(v)}°` : axis === "L" ? v.toFixed(2) : v.toFixed(3);
  }
</script>

<div class="anchor-row" class:mirrored>
  <Field {label} {hint} {pinned} {onreset}>
    <span class="control">
      <button
        type="button"
        class="chip"
        style:background={hex}
        aria-label="{label} color {hex}"
        aria-expanded={layout === "compact" ? open : undefined}
        onclick={() => layout === "compact" && onexpand?.(!expanded)}
      ></button>
      <TextInput
        value={hex}
        ariaLabel="{label} hex"
        oncommit={commitHex}
      />
      {#if mirrored}
        <span class="tag" title="Inherits — edit to pin">↻</span>
      {:else if onclear}
        <button type="button" class="clear" title="Clear (inherit again)" onclick={onclear}>↻</button>
      {/if}
      {#if layout === "compact"}
        <button
          type="button"
          class="caret"
          aria-label={open ? "Collapse {label} editor" : "Expand {label} editor"}
          aria-expanded={open}
          onclick={() => onexpand?.(!expanded)}
        >{open ? "⌃" : "⌄"}</button>
      {/if}
    </span>
  </Field>

  {#if open}
    <div class="lch" class:dim={mirrored}>
      {#each [
        { axis: "L", min: 0, max: 1, step: 0.005, track: trackL },
        { axis: "C", min: 0, max: 0.4, step: 0.002, track: trackC },
        { axis: "H", min: 0, max: 360, step: 1, track: trackH },
      ] as const as ax (ax.axis)}
        <div class="lch-row">
          <span class="axis-name">{ax.axis}</span>
          <Slider
            value={triple[ax.axis]}
            min={ax.min}
            max={ax.max}
            step={ax.step}
            track={ax.track}
            thumbColor={hex}
            valueWidth={4}
            valueText={fmt(ax.axis, triple[ax.axis])}
            ariaLabel="{label} {ax.axis === 'L' ? 'lightness' : ax.axis === 'C' ? 'chroma' : 'hue'}"
            onchange={(v) => setAxis(ax.axis, v, false)}
            oncommit={(v) => setAxis(ax.axis, v, true)}
          />
        </div>
      {/each}
    </div>
  {/if}
</div>

<style>
  .anchor-row { display: flex; flex-direction: column; }
  .control {
    display: flex;
    align-items: center;
    gap: var(--v2-gap-small, 6px);
    width: 100%;
    min-width: 0;
  }
  .chip {
    flex: none;
    width: var(--v2-control-h, 22px);
    height: var(--v2-control-h, 22px);
    border: 0;
    border-radius: var(--v2-r-soft, 3px);
    box-shadow: inset 0 0 0 1px var(--v2-rule, #d6d0c1);
    cursor: pointer;
    padding: 0;
  }
  .chip:focus-visible {
    outline: 1px solid var(--v2-focus-ring, #15140e);
    outline-offset: 1px;
  }
  .tag, .clear {
    flex: none;
    width: 18px;
    height: var(--v2-control-h, 22px);
    display: inline-flex;
    align-items: center;
    justify-content: center;
    font-size: 12px;
    color: var(--v2-ink-3, #8a8478);
    background: transparent;
    border: 0;
    padding: 0;
    border-radius: var(--v2-r-hair, 2px);
  }
  .clear { cursor: pointer; }
  .clear:hover { color: var(--v2-ink, #15140e); background: var(--v2-hover-tint, rgba(21,20,14,0.05)); }
  .caret {
    flex: none;
    width: 18px;
    height: var(--v2-control-h, 22px);
    border: 0;
    background: transparent;
    padding: 0;
    font-size: 10px;
    color: var(--v2-ink-3, #8a8478);
    cursor: pointer;
    border-radius: var(--v2-r-hair, 2px);
  }
  .caret:hover { color: var(--v2-ink, #15140e); background: var(--v2-hover-tint, rgba(21,20,14,0.05)); }
  .caret:focus-visible {
    outline: 1px solid var(--v2-focus-ring, #15140e);
    outline-offset: 1px;
  }
  .lch {
    display: flex;
    flex-direction: column;
    gap: var(--v2-gap-hair, 2px);
    /* Hanging indent: gutter (8px) + gap (8px) so the editor aligns
       under the label column, reading as the row's continuation. */
    padding: 2px 0 4px 16px;
  }
  .lch.dim { opacity: 0.55; }
  .lch-row {
    display: grid;
    grid-template-columns: 14px 1fr;
    align-items: center;
    column-gap: var(--v2-gap-mid, 8px);
  }
  .axis-name {
    font-family: var(--v2-font-mono, ui-monospace, monospace);
    font-size: 10px;
    font-weight: 700;
    color: var(--v2-ink-3, #8a8478);
  }
</style>

<!--
  Tier-1 anchor authoring (B9, wire-audit Pass 4a) — LCH-NATIVE.

  Each anchor row is three inline L / C / H sliders (the substrate's
  native vocabulary, mirroring rgc_v4 playground.jsx::ColorAnchor) with
  the hex swatch demoted to a sibling deep-dive (click → OklchPicker
  popover for eyedropper / 2D field work).

  Five rows: paper / ink / brand / accent / ink2 (the B7 rubrication
  anchor — its missing 5th row was a Round-2 discipline-rule debt).

  Slider drags fire `onpreview` (cascade re-resolve, no history push, no
  column re-measure per C53); pointer-up fires `onchange` (the commit).
-->
<script lang="ts">
  import type { ThemeInputs, OklchTriple } from "$types/theme-inputs";
  import { oklchToHex, hexToOklch } from "$lib/oklch";
  import OklchPicker from "../../../studio/OklchPicker.svelte";
  import { tintFromBrand } from "$lib/theme/theme-presets-inputs";

  const {
    inputs,
    onchange,
    onpreview,
  }: {
    inputs: ThemeInputs;
    onchange: (next: ThemeInputs) => void;
    /** Drag-time preview (C53). Falls back to onchange when absent. */
    onpreview?: (next: ThemeInputs) => void;
  } = $props();

  type AnchorKey = "paper" | "ink" | "brand" | "accent" | "ink2";
  let open = $state<AnchorKey | null>(null);

  const anchors = $derived(inputs.anchors);

  function withAnchor(key: AnchorKey, triple: OklchTriple): ThemeInputs {
    return { ...inputs, anchors: { ...inputs.anchors, [key]: triple } };
  }

  function setAxis(key: AnchorKey, axis: "L" | "C" | "H", value: number, commit: boolean): void {
    const base = key === "accent"
      ? (anchors.accent ?? anchors.brand)
      : key === "ink2"
        ? (anchors.ink2 ?? anchors.accent ?? anchors.brand)
        : anchors[key];
    const next = withAnchor(key, { ...base, [axis]: value });
    if (commit) onchange(next);
    else (onpreview ?? onchange)(next);
  }

  function setHex(key: AnchorKey, newHex: string): void {
    onchange(withAnchor(key, hexToOklch(newHex)));
  }

  function clearOptional(key: "accent" | "ink2"): void {
    const next = { ...inputs.anchors };
    delete (next as Record<string, unknown>)[key];
    onchange({ ...inputs, anchors: next });
  }

  const AXES = [
    { axis: "L" as const, min: 0, max: 1, step: 0.005 },
    { axis: "C" as const, min: 0, max: 0.4, step: 0.002 },
    { axis: "H" as const, min: 0, max: 360, step: 1 },
  ];

  const ROWS = [
    { key: "paper" as const, label: "Paper", hint: "Light-end neutral", optional: false },
    { key: "ink" as const, label: "Ink", hint: "Dark-end neutral", optional: false },
    { key: "brand" as const, label: "Brand", hint: "Identity hue", optional: false },
    { key: "accent" as const, label: "Accent", hint: "Engagement hue", optional: true },
    { key: "ink2" as const, label: "Ink 2", hint: "Rubrication (seeds accent ramp)", optional: true },
  ];

  function rowTriple(key: AnchorKey): OklchTriple {
    if (key === "accent") return anchors.accent ?? anchors.brand;
    if (key === "ink2") return anchors.ink2 ?? anchors.accent ?? anchors.brand;
    return anchors[key];
  }

  function isMirror(key: AnchorKey): boolean {
    if (key === "accent") return !anchors.accent;
    if (key === "ink2") return !anchors.ink2;
    return false;
  }

  function fmtAxis(axis: "L" | "C" | "H", v: number): string {
    return axis === "H" ? `${Math.round(v)}°` : axis === "L" ? v.toFixed(2) : v.toFixed(3);
  }
</script>

<div class="anchor-controls">
  <!-- C56 (4d): one-move hue alignment toward brand. Undoable — commits
       through the normal onchange/history path. -->
  <div class="match-brand">
    <button type="button" onclick={() => onchange(tintFromBrand(inputs, "medium"))}
            title="Nudge paper / ink / accent / ink2 hues toward brand (L unchanged)">
      Match brand
    </button>
  </div>
  {#each ROWS as row (row.key)}
    {@const triple = rowTriple(row.key)}
    {@const mirror = isMirror(row.key)}
    <div class="row" class:active={open === row.key} class:mirror>
      <button
        type="button"
        class="swatch"
        style:background={oklchToHex(triple)}
        onclick={() => (open = open === row.key ? null : row.key)}
        aria-label="Edit {row.label} anchor (hex / 2D picker)"
        aria-expanded={open === row.key}
      ></button>
      <div class="meta">
        <span class="label">{row.label}</span>
        <span class="hint">{row.hint}</span>
      </div>
      {#if row.optional}
        {#if mirror}
          <span class="mirror-tag" title="{row.label} inherits when unset — drag a slider to pin">↻</span>
        {:else}
          <button type="button" class="clear" onclick={() => clearOptional(row.key as "accent" | "ink2")}
                  title="Clear (inherit again)">↻</button>
        {/if}
      {:else}
        <span class="mirror-tag"></span>
      {/if}
    </div>
    <div class="sliders" class:dim={mirror}>
      {#each AXES as ax (ax.axis)}
        <label class="axis">
          <span class="axis-name">{ax.axis}</span>
          <input
            type="range"
            min={ax.min}
            max={ax.max}
            step={ax.step}
            value={triple[ax.axis]}
            oninput={(e) => setAxis(row.key, ax.axis, parseFloat((e.currentTarget as HTMLInputElement).value), false)}
            onchange={(e) => setAxis(row.key, ax.axis, parseFloat((e.currentTarget as HTMLInputElement).value), true)}
            aria-label="{row.label} {ax.axis === 'L' ? 'lightness' : ax.axis === 'C' ? 'chroma' : 'hue'}"
          />
          <span class="axis-val">{fmtAxis(ax.axis, triple[ax.axis])}</span>
        </label>
      {/each}
    </div>
    {#if open === row.key}
      <div class="picker-shelf">
        <OklchPicker
          value={oklchToHex(triple)}
          label={row.label}
          oninput={(v) => setHex(row.key, v)}
          onclose={() => (open = null)}
        />
      </div>
    {/if}
  {/each}
</div>

<style>
  .anchor-controls {
    display: flex;
    flex-direction: column;
    gap: 0;
  }
  .row {
    display: grid;
    grid-template-columns: 28px 1fr auto;
    align-items: center;
    gap: 10px;
    padding: 6px 18px 2px;
    border-radius: 6px;
  }
  .row.active { background: var(--tp-row-active, #f6f3ed); }
  .swatch {
    width: 24px;
    height: 24px;
    border-radius: 4px;
    border: 1px solid var(--tp-swatch-rule, #c8c4bd);
    cursor: pointer;
    padding: 0;
  }
  .meta { display: flex; flex-direction: column; gap: 1px; min-width: 0; }
  .label { font-size: 13px; font-weight: 600; color: var(--tp-fg, #1c1a17); }
  .hint  { font-size: 11px; color: var(--tp-muted, #6b6760); }
  .mirror-tag, .clear {
    width: 22px; height: 22px;
    border-radius: 4px;
    border: 1px solid transparent;
    background: transparent;
    color: var(--tp-muted, #6b6760);
    font-size: 13px;
    cursor: default;
    padding: 0;
    text-align: center;
  }
  .clear { cursor: pointer; }
  .clear:hover { border-color: var(--tp-swatch-rule, #c8c4bd); }

  .sliders {
    display: flex;
    flex-direction: column;
    gap: 2px;
    padding: 0 18px 8px 56px;
    border-bottom: 1px dashed var(--tp-rule, #e8e6e1);
  }
  .sliders.dim { opacity: 0.55; }
  .axis {
    display: grid;
    grid-template-columns: 14px 1fr 44px;
    align-items: center;
    gap: 8px;
  }
  .axis-name {
    font-size: 10px;
    font-weight: 700;
    color: var(--tp-muted, #6b6760);
  }
  .axis input[type="range"] {
    width: 100%;
    height: 18px;
    margin: 0;
    accent-color: var(--tp-fg, #1c1a17);
  }
  .axis-val {
    font-family: ui-monospace, "SF Mono", monospace;
    font-size: 10px;
    color: var(--tp-muted, #6b6760);
    text-align: right;
  }
  .picker-shelf {
    padding: 8px 18px 12px 56px;
    border-bottom: 1px dashed var(--tp-rule, #e8e6e1);
  }
  .match-brand { padding: 4px 18px 8px; }
  .match-brand button {
    font-size: 11px;
    padding: 4px 10px;
    border: 1px solid var(--tp-swatch-rule, #c8c4bd);
    border-radius: 5px;
    background: transparent;
    color: var(--tp-fg, #1c1a17);
    cursor: pointer;
  }
  .match-brand button:hover { background: var(--tp-row-active, #f6f3ed); }
</style>

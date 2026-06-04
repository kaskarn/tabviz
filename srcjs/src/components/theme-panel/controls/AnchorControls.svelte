<!--
  Tier-1 anchor authoring — paper / ink / brand / accent as 4 rows. Each
  row shows the current anchor as a swatch + hex, with a click-to-edit
  popover hosting the existing OklchPicker. Accent has an extra "mirror
  brand" affordance.
-->
<script lang="ts">
  import type { ThemeInputs, OklchTriple } from "$types/theme-inputs";
  import { oklchToHex, hexToOklch } from "$lib/oklch";
  import OklchPicker from "../../../studio/OklchPicker.svelte";

  const {
    inputs,
    onchange,
  }: {
    inputs: ThemeInputs;
    onchange: (next: ThemeInputs) => void;
  } = $props();

  type AnchorKey = "paper" | "ink" | "brand" | "accent";
  let open = $state<AnchorKey | null>(null);

  const anchors = $derived(inputs.anchors);

  function hex(triple: OklchTriple | undefined, fallback: OklchTriple): string {
    return oklchToHex(triple ?? fallback);
  }

  function setAnchor(key: AnchorKey, newHex: string): void {
    const triple = hexToOklch(newHex);
    onchange({
      ...inputs,
      anchors: { ...inputs.anchors, [key]: triple },
    });
  }

  function clearAccent(): void {
    const next = { ...inputs.anchors };
    delete (next as Record<string, unknown>).accent;
    onchange({ ...inputs, anchors: next });
  }

  function fmt(triple: OklchTriple): string {
    return `${triple.L.toFixed(2)} · ${triple.C.toFixed(3)} · ${Math.round(triple.H)}°`;
  }

  const ROWS = [
    { key: "paper" as const, label: "Paper", hint: "Light-end neutral" },
    { key: "ink" as const, label: "Ink", hint: "Dark-end neutral" },
    { key: "brand" as const, label: "Brand", hint: "Identity hue" },
    { key: "accent" as const, label: "Accent", hint: "Engagement hue" },
  ];
</script>

<div class="anchor-controls">
  {#each ROWS as row (row.key)}
    {@const triple = row.key === "accent"
      ? (anchors.accent ?? anchors.brand)
      : anchors[row.key]}
    {@const isAccentMirror = row.key === "accent" && !anchors.accent}
    <div class="row" class:active={open === row.key}>
      <button
        type="button"
        class="swatch"
        style:background={oklchToHex(triple)}
        onclick={() => (open = open === row.key ? null : row.key)}
        aria-label="Edit {row.label} anchor"
        aria-expanded={open === row.key}
      ></button>
      <div class="meta">
        <span class="label">{row.label}</span>
        <span class="hint">{row.hint}</span>
      </div>
      <code class="triple">{fmt(triple)}</code>
      {#if isAccentMirror}
        <span class="mirror" title="Accent mirrors brand when unset">↻</span>
      {:else if row.key === "accent"}
        <button type="button" class="clear" onclick={clearAccent}
                title="Mirror brand">↻</button>
      {/if}
    </div>
    {#if open === row.key}
      <div class="picker-shelf">
        <OklchPicker
          value={oklchToHex(triple)}
          label={row.label}
          oninput={(v) => setAnchor(row.key, v)}
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
    grid-template-columns: 28px 1fr auto auto;
    align-items: center;
    gap: 10px;
    padding: 6px 18px;
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
  .triple {
    font-family: ui-monospace, "JetBrains Mono", "SF Mono", monospace;
    font-size: 10px;
    color: var(--tp-muted, #6b6760);
    white-space: nowrap;
  }
  .mirror, .clear {
    width: 22px; height: 22px;
    border-radius: 4px;
    border: 1px solid transparent;
    background: transparent;
    color: var(--tp-muted, #6b6760);
    font-size: 13px;
    cursor: pointer;
    padding: 0;
  }
  .clear:hover { border-color: var(--tp-swatch-rule, #c8c4bd); }
  .picker-shelf {
    padding: 8px 18px 12px 56px;
    border-bottom: 1px dashed var(--tp-rule, #e8e6e1);
  }
</style>

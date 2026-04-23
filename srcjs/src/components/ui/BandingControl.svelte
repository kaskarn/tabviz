<script lang="ts">
  import type { ForestStore } from "$stores/forestStore.svelte";
  import type { BandingMode } from "$types";
  import { bandingSpecToString } from "$lib/banding";
  import SettingsSection from "./SettingsSection.svelte";

  interface Props {
    store: ForestStore;
  }

  let { store }: Props = $props();

  const banding = $derived(store.effectiveBanding);
  const depth = $derived(store.maxGroupDepth);
  const hasGroups = $derived(depth > 0);
  const currentString = $derived(bandingSpecToString(banding));
  const effectiveLevel = $derived(banding.level ?? depth);
  const startsWithBand = $derived(store.bandingStartsWithBand);

  function setMode(mode: BandingMode) {
    if (mode === "none" || mode === "row") {
      store.setBandingOverride(mode);
      return;
    }
    const level = banding.level ?? depth;
    if (hasGroups) {
      store.setBandingOverride(`group-${level}`);
    } else {
      store.setBandingOverride("row");
    }
  }

  function setLevel(n: number) {
    const clamped = Math.min(Math.max(n, 1), depth);
    store.setBandingOverride(`group-${clamped}`);
  }

  function setPhase(withBand: boolean) {
    store.setBandingStartsWithBand(withBand);
  }
</script>

<SettingsSection
  title="Row banding"
  description="Zebra backgrounds. Group mode paints whole groups as single bands so header + members read as one unit."
>
  <div class="row">
    <span class="row-label">Mode</span>
    <div class="segmented" role="radiogroup" aria-label="Banding mode">
      <button
        type="button" role="radio"
        aria-checked={banding.mode === "none"}
        class:selected={banding.mode === "none"}
        onclick={() => setMode("none")}
      >None</button>
      <button
        type="button" role="radio"
        aria-checked={banding.mode === "row"}
        class:selected={banding.mode === "row"}
        onclick={() => setMode("row")}
      >Row</button>
      <button
        type="button" role="radio"
        aria-checked={banding.mode === "group"}
        class:selected={banding.mode === "group"}
        onclick={() => setMode("group")}
        disabled={!hasGroups}
        title={hasGroups ? "" : "Requires row groups"}
      >Group</button>
    </div>
  </div>

  {#if banding.mode === "group" && hasGroups}
    <div class="row">
      <label class="row-label" for="banding-level">Level</label>
      <div class="range-wrap">
        <input
          id="banding-level"
          type="range"
          min={1}
          max={depth}
          step={1}
          value={effectiveLevel}
          oninput={(e) => setLevel(parseInt((e.target as HTMLInputElement).value, 10))}
        />
        <span class="range-value" aria-live="polite">{effectiveLevel}/{depth}</span>
      </div>
    </div>
  {/if}

  {#if banding.mode !== "none"}
    <div class="row">
      <span class="row-label">Phase</span>
      <div class="segmented compact" role="radiogroup" aria-label="Banding phase">
        <button
          type="button" role="radio"
          aria-checked={!startsWithBand}
          class:selected={!startsWithBand}
          onclick={() => setPhase(false)}
          title="First row/group uses the base color"
        >
          <span class="swatch-pair"><span class="sw a"></span><span class="sw b"></span></span>
          ABAB
        </button>
        <button
          type="button" role="radio"
          aria-checked={startsWithBand}
          class:selected={startsWithBand}
          onclick={() => setPhase(true)}
          title="First row/group is banded"
        >
          <span class="swatch-pair"><span class="sw b"></span><span class="sw a"></span></span>
          BABA
        </button>
      </div>
    </div>
  {/if}

  <div class="meta">
    <span>Active:</span>
    <code>{currentString}</code>
  </div>
</SettingsSection>

<style>
  .row {
    display: grid;
    grid-template-columns: 64px 1fr;
    align-items: center;
    gap: 10px;
  }

  .row-label {
    font-size: 0.75rem;
    font-weight: 500;
    color: var(--wf-secondary, #64748b);
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }

  .segmented {
    display: flex;
    border: 1px solid color-mix(in srgb, var(--wf-primary, #2563eb) 15%, var(--wf-border, #e2e8f0));
    border-radius: 8px;
    overflow: hidden;
    background: var(--wf-bg, #ffffff);
  }

  .segmented button {
    flex: 1;
    padding: 6px 10px;
    font-size: 0.8125rem;
    font-weight: 500;
    border: none;
    background: transparent;
    color: var(--wf-fg, #1a1a1a);
    cursor: pointer;
    transition: background-color 0.15s ease, color 0.15s ease;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
  }

  .segmented.compact button {
    padding: 4px 8px;
    font-size: 0.75rem;
    letter-spacing: 0.04em;
  }

  .segmented button + button {
    border-left: 1px solid color-mix(in srgb, var(--wf-primary, #2563eb) 10%, var(--wf-border, #e2e8f0));
  }

  .segmented button:hover:not(:disabled):not(.selected) {
    background: color-mix(in srgb, var(--wf-primary, #2563eb) 8%, transparent);
  }

  .segmented button.selected {
    background: color-mix(in srgb, var(--wf-primary, #2563eb) 92%, transparent);
    color: var(--wf-bg, #ffffff);
  }

  .segmented button:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  .swatch-pair {
    display: inline-flex;
    height: 10px;
    border-radius: 2px;
    overflow: hidden;
    border: 1px solid color-mix(in srgb, var(--wf-fg, #1a1a1a) 12%, transparent);
  }

  .sw {
    width: 7px;
    height: 100%;
  }

  .sw.a {
    background: var(--wf-bg, #ffffff);
  }

  .sw.b {
    background: var(--wf-alt-bg, #f1f5f9);
  }

  .range-wrap {
    display: grid;
    grid-template-columns: 1fr auto;
    align-items: center;
    gap: 10px;
  }

  .range-wrap input[type="range"] {
    width: 100%;
    accent-color: var(--wf-primary, #2563eb);
  }

  .range-value {
    font-variant-numeric: tabular-nums;
    font-size: 0.75rem;
    color: var(--wf-fg, #1a1a1a);
    min-width: 3em;
    text-align: right;
  }

  .meta {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 0.7rem;
    color: var(--wf-secondary, #64748b);
    padding-top: 6px;
  }

  .meta code {
    font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    background: color-mix(in srgb, var(--wf-primary, #2563eb) 8%, transparent);
    padding: 1px 6px;
    border-radius: 4px;
    color: var(--wf-fg, #1a1a1a);
  }
</style>

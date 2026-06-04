<!--
  Density preset (compact/comfortable/spacious) + continuous factor slider.
-->
<script lang="ts">
  import type { ThemeInputs } from "$types/theme-inputs";

  const {
    inputs,
    onchange,
  }: {
    inputs: ThemeInputs;
    onchange: (next: ThemeInputs) => void;
  } = $props();

  const PRESETS = ["compact", "comfortable", "spacious"] as const;
  const density = $derived(inputs.density ?? "comfortable");
  const factor  = $derived(inputs.densityFactor ?? 1);

  function setDensity(v: (typeof PRESETS)[number]): void {
    onchange({ ...inputs, density: v });
  }
  function setFactor(v: number): void {
    onchange({ ...inputs, densityFactor: v });
  }
</script>

<div class="rows">
  <div class="row">
    <span class="label">Density</span>
    <div class="seg" role="radiogroup" aria-label="Density preset">
      {#each PRESETS as p (p)}
        <button type="button" class:on={density === p} onclick={() => setDensity(p)}>{p}</button>
      {/each}
    </div>
  </div>
  <div class="row">
    <span class="label">Factor</span>
    <div class="factor">
      <input type="range" min="0.5" max="2" step="0.05" value={factor}
             oninput={(e) => setFactor(parseFloat((e.currentTarget as HTMLInputElement).value))}
             aria-label="Density factor" />
      <code>×{factor.toFixed(2)}</code>
    </div>
  </div>
</div>

<style>
  .rows { display: flex; flex-direction: column; gap: 6px; padding: 4px 18px 10px; }
  .row {
    display: grid;
    grid-template-columns: 70px 1fr;
    align-items: center;
    gap: 10px;
  }
  .label { font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; color: var(--tp-muted, #6b6760); }
  .seg {
    display: inline-flex;
    border: 1px solid var(--tp-rule, #d8d4cc);
    border-radius: 4px;
    overflow: hidden;
    background: var(--tp-input-bg, #ffffff);
  }
  .seg button {
    flex: 1;
    border: 0;
    border-right: 1px solid var(--tp-rule, #e8e6e1);
    background: transparent;
    color: var(--tp-fg, #1c1a17);
    padding: 6px 8px;
    font-size: 11px;
    cursor: pointer;
    text-transform: capitalize;
  }
  .seg button:last-child { border-right: 0; }
  .seg button.on { background: var(--tp-fg, #1c1a17); color: var(--tp-input-bg, #ffffff); }
  .factor { display: flex; align-items: center; gap: 8px; }
  .factor input { flex: 1; }
  .factor code {
    font-family: ui-monospace, "JetBrains Mono", "SF Mono", monospace;
    font-size: 11px;
    color: var(--tp-muted, #6b6760);
    min-width: 42px;
    text-align: right;
  }
</style>

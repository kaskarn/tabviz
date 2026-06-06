<!--
  Density preset (compact/comfortable/spacious) + continuous factor slider.
-->
<script lang="ts">
  import type { ThemeInputs } from "$types/theme-inputs";
  import { DENSITY_PX } from "$lib/theme/density-presets";

  const {
    inputs,
    onchange,
    onpreview,
  }: {
    inputs: ThemeInputs;
    onchange: (next: ThemeInputs) => void;
    /** C53 preview channel — drag ticks go here (no measure / no history
     *  step); the pointerup commit goes through onchange. Without it,
     *  every factor-slider tick was a full commit: per-tick re-measure
     *  in the widget, ~30 history steps per drag in the studio
     *  (adversarial UX review H1). */
    onpreview?: (next: ThemeInputs) => void;
  } = $props();

  const PRESETS = ["compact", "comfortable", "spacious"] as const;
  const density = $derived(inputs.density ?? "comfortable");
  const factor  = $derived(inputs.density_factor ?? 1);
  // Effective readout (studio E): preset × factor is abstract — show the
  // concrete row height the combination produces, from the same
  // DENSITY_PX table the resolver projects.
  const effectiveRowPx = $derived(
    Math.round((DENSITY_PX[density]?.rowHeight ?? 24) * factor),
  );

  function setDensity(v: (typeof PRESETS)[number]): void {
    onchange({ ...inputs, density: v });
  }
  function setFactor(v: number, commit: boolean): void {
    const next = { ...inputs, density_factor: v };
    if (commit || !onpreview) onchange(next);
    else onpreview(next);
  }
</script>

<div class="rows">
  <div class="row">
    <span class="label">Density</span>
    <!-- D13 translation note: tabviz "comfortable" = rgc-lab "cozy"
         (middle); tabviz "spacious" = lab "comfortable" (loosest). The
         title attr reaches authors cross-referencing lab screenshots. -->
    <div class="seg" role="radiogroup" aria-label="Density preset"
         title="comfortable = lab 'cozy' (middle) · spacious = lab 'comfortable' (loosest)">
      {#each PRESETS as p (p)}
        <button type="button" role="radio" aria-checked={density === p} class:on={density === p} onclick={() => setDensity(p)}>{p}</button>
      {/each}
    </div>
  </div>
  <div class="row">
    <span class="label">Factor</span>
    <div class="factor">
      <input type="range" min="0.5" max="2" step="0.05" value={factor}
             oninput={(e) => setFactor(parseFloat((e.currentTarget as HTMLInputElement).value), false)}
             onchange={(e) => setFactor(parseFloat((e.currentTarget as HTMLInputElement).value), true)}
             aria-label="Density factor"
             aria-valuetext={`×${factor.toFixed(2)}`} />
      <code>×{factor.toFixed(2)}</code>
    </div>
  </div>
  <div class="row">
    <span class="label"></span>
    <span class="effective">= {effectiveRowPx}px rows</span>
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
  .effective {
    font-family: ui-monospace, "JetBrains Mono", "SF Mono", monospace;
    font-size: 10.5px;
    color: var(--tp-muted, #6b6760);
  }
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

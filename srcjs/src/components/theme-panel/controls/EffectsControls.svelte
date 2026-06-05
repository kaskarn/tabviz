<!--
  EffectsControls — Phase D Tier-1 controls for the EFFECTS axis.

  - Glow intensity (none / subtle / neon) + anchor (brand / accent)
  - Gradient shell intensity (none / subtle / vivid) + angle (deg)
  - Figure depth (none / low / medium / high)

  All effects drop to "none" under HC mode at resolve time; the inputs
  here drive the standard-mode appearance.
-->
<script lang="ts">
  import type { ThemeInputs } from "$types/theme-inputs";

  const {
    inputs,
    onchange,
    onpreview,
  }: {
    inputs: ThemeInputs;
    onchange: (next: ThemeInputs) => void;
    /** C53 preview channel — angle-slider drag ticks (see
     *  DensityControls; adversarial UX review H1). */
    onpreview?: (next: ThemeInputs) => void;
  } = $props();

  const GLOW_INTENSITY = ["none", "subtle", "neon"] as const;
  const HEADER_STYLE   = ["normal", "tint", "fill"] as const;
  const TITLE_STYLE    = ["normal", "bar", "underline"] as const;
  const GLOW_ANCHOR    = ["brand", "accent"] as const;
  const GRAD_INTENSITY = ["none", "subtle", "vivid"] as const;
  // Magnitude vocabulary — deliberately no words shared with the Shell
  // tab's shell_mode (raised/float meant different things in each; R2
  // decision). The row label is "Depth" for the same reason.
  const ELEVATION      = ["none", "low", "medium", "high"] as const;

  const glow      = $derived(inputs.effects?.glow_intensity ?? "none");
  const glowAnch  = $derived(inputs.effects?.glow_anchor ?? "brand");
  const gradInt   = $derived(inputs.effects?.gradient_shell_intensity ?? "none");
  const gradAngle = $derived(inputs.effects?.gradient_shell_angle ?? 90);
  const elev      = $derived(inputs.effects?.elevation ?? "none");
  const headerSty = $derived(inputs.effects?.header_style ?? "normal");
  const titleSty  = $derived(inputs.effects?.title_style ?? "normal");

  function set<K extends keyof NonNullable<ThemeInputs["effects"]>>(
    key: K,
    value: NonNullable<ThemeInputs["effects"]>[K],
    commit = true,
  ): void {
    const next = {
      ...inputs,
      effects: { ...inputs.effects, [key]: value },
    };
    if (commit || !onpreview) onchange(next);
    else onpreview(next);
  }
</script>

<div class="rows">
  <div class="row">
    <span class="label">Header</span>
    <div class="seg" role="radiogroup" aria-label="Header style">
      {#each HEADER_STYLE as h (h)}
        <button type="button" class:on={headerSty === h} onclick={() => set("header_style", h)}>{h}</button>
      {/each}
    </div>
  </div>

  <div class="row">
    <span class="label">Title</span>
    <div class="seg" role="radiogroup" aria-label="Title style">
      {#each TITLE_STYLE as t (t)}
        <button type="button" class:on={titleSty === t} onclick={() => set("title_style", t)}>{t}</button>
      {/each}
    </div>
  </div>

  <div class="row">
    <span class="label">Glow</span>
    <div class="seg" role="radiogroup" aria-label="Glow intensity">
      {#each GLOW_INTENSITY as g (g)}
        <button type="button" class:on={glow === g} onclick={() => set("glow_intensity", g)}>{g}</button>
      {/each}
    </div>
  </div>

  {#if glow !== "none"}
    <div class="row">
      <span class="label">Anchor</span>
      <div class="seg" role="radiogroup" aria-label="Glow anchor">
        {#each GLOW_ANCHOR as a (a)}
          <button type="button" class:on={glowAnch === a} onclick={() => set("glow_anchor", a)}>{a}</button>
        {/each}
      </div>
    </div>
  {/if}

  <div class="row">
    <span class="label">Gradient</span>
    <div class="seg" role="radiogroup" aria-label="Gradient shell intensity">
      {#each GRAD_INTENSITY as g (g)}
        <button type="button" class:on={gradInt === g} onclick={() => set("gradient_shell_intensity", g)}>{g}</button>
      {/each}
    </div>
  </div>

  {#if gradInt !== "none"}
    <div class="row">
      <span class="label">Angle</span>
      <div class="angle">
        <input type="range" min="0" max="360" step="5" value={gradAngle}
               oninput={(e) => set("gradient_shell_angle", parseFloat((e.currentTarget as HTMLInputElement).value), false)}
               onchange={(e) => set("gradient_shell_angle", parseFloat((e.currentTarget as HTMLInputElement).value), true)}
               aria-label="Gradient angle" />
        <code>{Math.round(gradAngle)}°</code>
      </div>
    </div>
  {/if}

  <div class="row">
    <span class="label">Depth</span>
    <div class="seg" role="radiogroup" aria-label="Figure depth">
      {#each ELEVATION as e (e)}
        <button type="button" class:on={elev === e} onclick={() => set("elevation", e)}>{e}</button>
      {/each}
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
  .angle { display: flex; align-items: center; gap: 8px; }
  .angle input { flex: 1; }
  .angle code {
    font-family: ui-monospace, "JetBrains Mono", "SF Mono", monospace;
    font-size: 11px;
    color: var(--tp-muted, #6b6760);
    min-width: 36px;
    text-align: right;
  }
</style>

<!--
  Typography Tier 1 — base size + scale ratio + font stack pickers.
-->
<script lang="ts">
  import type { ThemeInputs } from "$types/theme-inputs";
  import { FONT_PRESETS } from "$lib/font-presets";

  const {
    inputs,
    onchange,
  }: {
    inputs: ThemeInputs;
    onchange: (next: ThemeInputs) => void;
  } = $props();

  const baseSize  = $derived(inputs.type_base_size ?? 14);
  const ratio     = $derived(inputs.type_scale_ratio ?? 1.2);
  const fontBody  = $derived(inputs.fonts?.body  ?? "");
  const fontDisp  = $derived(inputs.fonts?.display ?? "");

  // Build a flat option list for the font dropdown.
  const FONT_OPTIONS = FONT_PRESETS.map((p) => ({
    value: p.stack,
    label: p.hint ? `${p.name} — ${p.hint}` : p.name,
  }));

  // Number.isFinite guards: parseFloat("") during typing is NaN, which
  // used to flow straight into the resolver; oninput->onchange means
  // typing "14" no longer commits at "1" (adversarial UX review H3).
  function setBaseSize(v: number): void {
    if (!Number.isFinite(v)) return;
    onchange({ ...inputs, type_base_size: v });
  }
  function setRatio(v: number): void {
    if (!Number.isFinite(v)) return;
    onchange({ ...inputs, type_scale_ratio: v });
  }
  function setFont(slot: "body" | "display", v: string): void {
    onchange({
      ...inputs,
      fonts: { ...(inputs.fonts ?? {}), [slot]: v || undefined },
    });
  }
</script>

<div class="rows">
  <div class="row two">
    <label class="field">
      <span class="label">Base</span>
      <input type="number" min="10" max="24" step="0.5" value={baseSize}
             onchange={(e) => setBaseSize(parseFloat((e.currentTarget as HTMLInputElement).value))} />
      <span class="suffix">px</span>
    </label>
    <label class="field">
      <span class="label">Ratio</span>
      <input type="number" min="1.05" max="1.6" step="0.025" value={ratio}
             onchange={(e) => setRatio(parseFloat((e.currentTarget as HTMLInputElement).value))} />
    </label>
  </div>
  <div class="row">
    <span class="label">Body</span>
    <select value={fontBody} onchange={(e) => setFont("body", (e.currentTarget as HTMLSelectElement).value)}>
      <option value="">(theme default)</option>
      {#each FONT_OPTIONS as opt (opt.value)}
        <option value={opt.value}>{opt.label}</option>
      {/each}
    </select>
  </div>
  <div class="row">
    <span class="label">Display</span>
    <select value={fontDisp} onchange={(e) => setFont("display", (e.currentTarget as HTMLSelectElement).value)}>
      <option value="">(mirror body)</option>
      {#each FONT_OPTIONS as opt (opt.value)}
        <option value={opt.value}>{opt.label}</option>
      {/each}
    </select>
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
  .row.two { grid-template-columns: 1fr 1fr; }
  .label { font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; color: var(--tp-muted, #6b6760); }
  .field {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    border: 1px solid var(--tp-rule, #d8d4cc);
    border-radius: 4px;
    padding: 0 8px;
    background: var(--tp-input-bg, #ffffff);
  }
  .field input {
    border: 0;
    outline: 0;
    background: transparent;
    color: var(--tp-fg, #1c1a17);
    font: inherit;
    font-size: 12px;
    width: 60px;
    padding: 6px 0;
  }
  .field .suffix {
    font-size: 11px;
    color: var(--tp-muted, #6b6760);
  }
  select {
    border: 1px solid var(--tp-rule, #d8d4cc);
    border-radius: 4px;
    padding: 6px 8px;
    background: var(--tp-input-bg, #ffffff);
    color: var(--tp-fg, #1c1a17);
    font: inherit;
    font-size: 12px;
  }
</style>

<!--
  Polarity (light/dark — L-reflection axis) + accessibility mode
  (standard / HC / RT) as two compact segmented rows. Both Tier 1.
-->
<script lang="ts">
  import type { ThemeInputs, ThemeMode } from "$types/theme-inputs";

  const {
    inputs,
    onchange,
  }: {
    inputs: ThemeInputs;
    onchange: (next: ThemeInputs) => void;
  } = $props();

  const polarity = $derived(inputs.polarity ?? "light");
  const mode = $derived<ThemeMode>(inputs.mode ?? "standard");

  function setPolarity(v: "light" | "dark"): void {
    onchange({ ...inputs, polarity: v });
  }
  function setMode(v: ThemeMode): void {
    onchange({ ...inputs, mode: v });
  }
</script>

<!-- role="radio" + aria-checked on the options: a radiogroup whose
     children are plain buttons reads as an empty group to AT; the
     selected state was visual-only (chrome review D). HC/RT get title
     expansions — the abbreviations are opaque on first contact. -->
<div class="rows">
  <div class="row">
    <span class="label">Polarity</span>
    <div class="seg" role="radiogroup" aria-label="Polarity">
      <button type="button" role="radio" aria-checked={polarity === "light"} class:on={polarity === "light"} onclick={() => setPolarity("light")}>☀ Light</button>
      <button type="button" role="radio" aria-checked={polarity === "dark"}  class:on={polarity === "dark"}  onclick={() => setPolarity("dark")}>🌙 Dark</button>
    </div>
  </div>
  <div class="row">
    <span class="label">Mode</span>
    <div class="seg" role="radiogroup" aria-label="Accessibility mode">
      <button type="button" role="radio" aria-checked={mode === "standard"}             class:on={mode === "standard"}             onclick={() => setMode("standard")}>Standard</button>
      <button type="button" role="radio" aria-checked={mode === "high-contrast"}        class:on={mode === "high-contrast"}        onclick={() => setMode("high-contrast")} title="High contrast">HC</button>
      <button type="button" role="radio" aria-checked={mode === "reduced-transparency"} class:on={mode === "reduced-transparency"} onclick={() => setMode("reduced-transparency")} title="Reduced transparency">RT</button>
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
    padding: 6px 10px;
    font-size: 12px;
    cursor: pointer;
  }
  .seg button:last-child { border-right: 0; }
  .seg button.on { background: var(--tp-fg, #1c1a17); color: var(--tp-input-bg, #ffffff); }
</style>

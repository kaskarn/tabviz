<!--
  Stage 3 — IdentityTab.svelte
  Preset picker · Anchors (Brand/Accent/Decorative) · Polarity · Mode
  · Shell mode · Surface texture · Advanced (Neutral tint, Curves).
-->
<script lang="ts">
  import { studioStore } from "../studio-store.svelte";
  import { PRESETS } from "../../lib/theme/theme-presets-inputs";
  import type { ThemeInputs } from "../../types/theme-inputs";
  import OklchPicker from "../OklchPicker.svelte";

  let pickerOpen = $state<null | "brand" | "accent" | "decorative">(null);

  // Apply a partial update to the working-copy inputs.
  function apply(label: string, patch: Partial<ThemeInputs>): void {
    if (!studioStore.inputs) return;
    studioStore.apply({ ...studioStore.inputs, ...patch }, label);
  }

  const inputs = $derived(studioStore.inputs);

  let advancedOpen = $state(false);

  const SHELL_MODES = ["flush", "raised", "float", "transparent"] as const;
  const TEXTURES = ["none", "ruled", "grid", "dotted", "grain"] as const;
  const MODES = ["standard", "high-contrast", "reduced-transparency"] as const;

  function loadPreset(name: string, presetInputs: ThemeInputs): void {
    // Loading a preset replaces the working copy AND the base (so dirty resets).
    studioStore.init(presetInputs, name);
  }
</script>

<section>
  <h4>Preset</h4>
  <div class="section">
    <div class="subhead">Package presets</div>
    <div class="chip-grid">
      {#each Object.entries(PRESETS) as [name, presetInputs] (name)}
        <button
          type="button"
          class:active={studioStore.baseName === name}
          onclick={() => loadPreset(name, presetInputs as ThemeInputs)}
        >
          <span class="chip-swatch" style:background={(presetInputs as ThemeInputs).brand}></span>
          <span class="chip-name">{name}</span>
        </button>
      {/each}
    </div>
    <div class="subhead muted">Your themes</div>
    <div class="muted-note">
      Saved themes appear here. (Listing wired to R when the gadget is live.)
    </div>
  </div>
</section>

{#if inputs}
  <section>
    <h4>Anchors</h4>
    <div class="anchors">
      <div class="anchor">
        <span class="anchor-name">Brand</span>
        <button
          type="button"
          class="swatch"
          style:background={inputs.brand}
          onclick={() => (pickerOpen = pickerOpen === "brand" ? null : "brand")}
          aria-label="Edit brand color"
        ></button>
        <code>{inputs.brand}</code>
        {#if pickerOpen === "brand"}
          <div class="picker-anchor">
            <OklchPicker
              value={inputs.brand}
              label="Brand"
              oninput={(hex) => apply("Brand color", { brand: hex })}
              onclose={() => (pickerOpen = null)}
            />
          </div>
        {/if}
      </div>
      <div class="anchor">
        <span class="anchor-name">Accent</span>
        <button
          type="button"
          class="swatch"
          style:background={inputs.accent ?? inputs.brand}
          onclick={() => (pickerOpen = pickerOpen === "accent" ? null : "accent")}
          aria-label="Edit accent color"
        ></button>
        <code>{inputs.accent ?? "(mirrors brand)"}</code>
        {#if pickerOpen === "accent"}
          <div class="picker-anchor">
            <OklchPicker
              value={inputs.accent ?? inputs.brand}
              label="Accent"
              oninput={(hex) => apply("Accent color", { accent: hex })}
              onclose={() => (pickerOpen = null)}
            />
          </div>
        {/if}
      </div>
      <div class="anchor">
        <span class="anchor-name">Decorative</span>
        <button
          type="button"
          class="swatch"
          style:background={inputs.decorative ?? "transparent"}
          disabled={!inputs.decorative}
          onclick={() => (pickerOpen = pickerOpen === "decorative" ? null : "decorative")}
          aria-label="Edit decorative color"
        ></button>
        <code>{inputs.decorative ?? "(off)"}</code>
        <button
          type="button"
          class="toggle"
          onclick={() => apply("Toggle decorative", { decorative: inputs.decorative ? null : "#7B9E89" })}
        >{inputs.decorative ? "Remove" : "Add"}</button>
        {#if pickerOpen === "decorative" && inputs.decorative}
          <div class="picker-anchor">
            <OklchPicker
              value={inputs.decorative}
              label="Decorative"
              oninput={(hex) => apply("Decorative color", { decorative: hex })}
              onclose={() => (pickerOpen = null)}
            />
          </div>
        {/if}
      </div>
    </div>
  </section>

  <section>
    <h4>Polarity</h4>
    <div class="row">
      <button
        type="button"
        class:active={(inputs.polarity ?? "light") === "light"}
        onclick={() => apply("Polarity", { polarity: "light" })}
      >☀ Light</button>
      <button
        type="button"
        class:active={inputs.polarity === "dark"}
        onclick={() => apply("Polarity", { polarity: "dark" })}
      >🌙 Dark</button>
    </div>
  </section>

  <section>
    <h4>Mode</h4>
    <div class="row">
      {#each MODES as m (m)}
        <button
          type="button"
          class:active={(inputs.mode ?? "standard") === m}
          onclick={() => apply("Mode", { mode: m })}
        >{m === "high-contrast" ? "HC" : m === "reduced-transparency" ? "RT" : "Standard"}</button>
      {/each}
    </div>
  </section>

  <section>
    <h4>Shell mode</h4>
    <div class="row">
      {#each SHELL_MODES as m (m)}
        <button
          type="button"
          class:active={(inputs.shell_mode ?? "flush") === m}
          onclick={() => apply("Shell mode", { shell_mode: m })}
        >{m}</button>
      {/each}
    </div>
  </section>

  <section>
    <h4>Surface texture</h4>
    <div class="row">
      {#each TEXTURES as t (t)}
        <button
          type="button"
          class:active={(inputs.shell_texture ?? "none") === t}
          onclick={() => apply("Texture", { shell_texture: t })}
        >{t}</button>
      {/each}
    </div>
  </section>

  <section>
    <button type="button" class="disclosure" onclick={() => (advancedOpen = !advancedOpen)}>
      {advancedOpen ? "▾" : "▸"} Advanced
    </button>
    {#if advancedOpen}
      <div class="advanced">
        <h4>Neutral tint</h4>
        <select
          value={typeof inputs.neutral_tint === "string" ? inputs.neutral_tint : "custom"}
          onchange={(e) => apply("Neutral tint", { neutral_tint: (e.currentTarget as HTMLSelectElement).value as "untinted" | "brand" | "accent" | "decorative" })}
        >
          <option value="untinted">Untinted</option>
          <option value="brand">Brand</option>
          <option value="accent">Accent</option>
          <option value="decorative">Decorative</option>
        </select>
        <label>
          Strength {inputs.neutral_tint_strength ?? 0.04}
          <input
            type="range"
            min="0" max="1" step="0.01"
            value={inputs.neutral_tint_strength ?? 0.04}
            oninput={(e) => apply("Tint strength", { neutral_tint_strength: parseFloat((e.currentTarget as HTMLInputElement).value) })}
          />
        </label>
      </div>
    {/if}
  </section>
{/if}

<style>
  section {
    margin-bottom: 16px;
  }
  h4 {
    margin: 0 0 8px;
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    color: #475569;
    letter-spacing: 0.04em;
  }
  .section { background: transparent; }
  .subhead {
    font-size: 10.5px;
    font-weight: 600;
    color: #64748b;
    margin: 8px 0 4px;
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }
  .subhead.muted { color: #94a3b8; }
  .muted-note {
    font-size: 11.5px;
    color: #94a3b8;
    font-style: italic;
  }
  .chip-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(80px, 1fr));
    gap: 4px;
  }
  .chip-grid button {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
    padding: 4px;
    border: 1px solid #e2e8f0;
    background: #fff;
    border-radius: 4px;
    cursor: pointer;
    font-size: 10px;
  }
  .chip-grid button.active {
    border: 2px solid #2563eb;
    padding: 3px;
  }
  .chip-swatch {
    width: 24px;
    height: 16px;
    border-radius: 2px;
    border: 1px solid rgba(0,0,0,0.1);
  }
  .chip-name {
    font-family: ui-monospace, monospace;
    color: #1a1a1a;
  }
  .anchors {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .anchor {
    display: grid;
    grid-template-columns: 80px 36px 1fr auto;
    align-items: center;
    gap: 8px;
    position: relative;
  }
  .swatch {
    width: 36px;
    height: 24px;
    padding: 0;
    border: 1px solid #cbd5e1;
    border-radius: 4px;
    cursor: pointer;
    background-clip: padding-box;
  }
  .swatch:disabled {
    cursor: not-allowed;
    opacity: 0.4;
  }
  .picker-anchor {
    position: absolute;
    top: 100%;
    left: 0;
    z-index: 20;
    margin-top: 4px;
  }
  .anchor-name {
    font-size: 12px;
    color: #475569;
  }
  .anchor code {
    font-family: ui-monospace, monospace;
    font-size: 11px;
    color: #475569;
  }
  .toggle {
    padding: 2px 8px;
    font-size: 10.5px;
    border: 1px solid #cbd5e1;
    background: #fff;
    border-radius: 4px;
    cursor: pointer;
  }
  .row {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
  }
  .row button {
    padding: 4px 10px;
    border: 1px solid #cbd5e1;
    background: #fff;
    border-radius: 4px;
    cursor: pointer;
    font-size: 11px;
  }
  .row button.active {
    background: #2563eb;
    color: #fff;
    border-color: #1d4ed8;
  }
  .disclosure {
    background: transparent;
    border: none;
    padding: 0;
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    color: #64748b;
    cursor: pointer;
    letter-spacing: 0.04em;
  }
  .advanced {
    margin-top: 8px;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .advanced select,
  .advanced input[type="range"] {
    padding: 4px;
    border: 1px solid #cbd5e1;
    border-radius: 4px;
    font-size: 12px;
  }
  .advanced label {
    display: flex;
    flex-direction: column;
    gap: 4px;
    font-size: 12px;
  }
</style>

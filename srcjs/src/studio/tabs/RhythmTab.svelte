<!--
  Stage 3 — RhythmTab.svelte (skeleton)
  Density · density factor · type scale · weights · fonts.
-->
<script lang="ts">
  import { studioStore } from "../studio-store.svelte";
  import type { ThemeInputs } from "../../types/theme-inputs";

  function apply(label: string, patch: Partial<ThemeInputs>): void {
    if (!studioStore.inputs) return;
    studioStore.apply({ ...studioStore.inputs, ...patch }, label);
  }

  const inputs = $derived(studioStore.inputs);

  const DENSITIES = ["compact", "comfortable", "spacious"] as const;
</script>

{#if inputs}
  <section>
    <h4>Density</h4>
    <div class="row">
      {#each DENSITIES as d (d)}
        <button
          type="button"
          class:active={(inputs.density ?? "comfortable") === d}
          onclick={() => apply("Density", { density: d })}
        >{d}</button>
      {/each}
    </div>
    <label>
      Factor {inputs.densityFactor ?? 1}
      <input
        type="range"
        min="0.5" max="2" step="0.05"
        value={inputs.densityFactor ?? 1}
        oninput={(e) => apply("Density factor", { densityFactor: parseFloat((e.currentTarget as HTMLInputElement).value) })}
      />
    </label>
  </section>

  <section>
    <h4>Type scale</h4>
    <label>
      Base size (px)
      <input
        type="number"
        min="10" max="24" step="0.5"
        value={inputs.type_base_size ?? 14}
        oninput={(e) => apply("Type base size", { type_base_size: parseFloat((e.currentTarget as HTMLInputElement).value) })}
      />
    </label>
    <label>
      Scale ratio
      <input
        type="number"
        min="1.05" max="1.6" step="0.025"
        value={inputs.type_scale_ratio ?? 1.2}
        oninput={(e) => apply("Type scale ratio", { type_scale_ratio: parseFloat((e.currentTarget as HTMLInputElement).value) })}
      />
    </label>
  </section>

  <section>
    <h4>Fonts</h4>
    <label>
      Body
      <input
        type="text"
        value={inputs.fonts?.body ?? ""}
        placeholder="system-ui, -apple-system, sans-serif"
        onchange={(e) => apply("Font body", { fonts: { ...inputs.fonts, body: (e.currentTarget as HTMLInputElement).value } })}
      />
    </label>
    <label>
      Display
      <input
        type="text"
        value={inputs.fonts?.display ?? ""}
        placeholder="(mirrors body)"
        onchange={(e) => apply("Font display", { fonts: { ...inputs.fonts, display: (e.currentTarget as HTMLInputElement).value } })}
      />
    </label>
    <label>
      Mono
      <input
        type="text"
        value={inputs.fonts?.mono ?? ""}
        placeholder="ui-monospace, monospace"
        onchange={(e) => apply("Font mono", { fonts: { ...inputs.fonts, mono: (e.currentTarget as HTMLInputElement).value } })}
      />
    </label>
  </section>
{/if}

<style>
  section { margin-bottom: 16px; }
  h4 {
    margin: 0 0 8px;
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    color: #475569;
    letter-spacing: 0.04em;
  }
  .row { display: flex; flex-wrap: wrap; gap: 4px; }
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
  label {
    display: flex;
    flex-direction: column;
    gap: 4px;
    font-size: 12px;
    margin-bottom: 8px;
  }
  input[type="text"],
  input[type="number"],
  input[type="range"] {
    padding: 4px 6px;
    border: 1px solid #cbd5e1;
    border-radius: 4px;
    font-size: 12px;
  }
</style>

<!--
  Stage 3 — EncodingTab.svelte (skeleton)
  Status colors · series · lines · sparklines · highlight · annotations.
  Initial pass: status colors only; the rest come as the resolver wire-up
  for spec-scoped column overrides lands.
-->
<script lang="ts">
  import { studioStore } from "../studio-store.svelte";
  import type { ThemeInputs } from "../../types/theme-inputs";

  function apply(label: string, patch: Partial<ThemeInputs>): void {
    if (!studioStore.inputs) return;
    studioStore.apply({ ...studioStore.inputs, ...patch }, label);
  }

  const inputs = $derived(studioStore.inputs);

  function setStatus(slot: "positive" | "negative" | "warning" | "info", hex: string): void {
    if (!inputs) return;
    apply(`Status ${slot}`, {
      status: { ...inputs.status, [slot]: hex.toUpperCase() },
    });
  }
</script>

{#if inputs}
  <section>
    <h4>Status colors</h4>
    <p class="muted-note">Thresholds (when status applies) live in your <code>col_pvalue()</code> / <code>col_*()</code> calls.</p>
    <div class="status-grid">
      {#each ["positive", "negative", "warning", "info"] as const as slot (slot)}
        <label class="anchor">
          <span class="anchor-name">{slot}</span>
          <input
            type="color"
            value={inputs.status?.[slot] ?? "#000000"}
            oninput={(e) => setStatus(slot, (e.currentTarget as HTMLInputElement).value)}
          />
          <code>{inputs.status?.[slot] ?? "—"}</code>
        </label>
      {/each}
    </div>
  </section>

  <section>
    <h4>Sparklines & ramps</h4>
    <p class="muted-note">Categorical / sequential / diverging schemes apply globally; column constructors override.</p>
    <label>
      Categorical
      <select
        value={inputs.categorical ?? "okabe_ito"}
        onchange={(e) => apply("Categorical scheme", { categorical: (e.currentTarget as HTMLSelectElement).value })}
      >
        {#each ["okabe_ito", "tableau10", "set1", "set2", "dark2", "paired", "wong", "brand_mono"] as s (s)}
          <option value={s}>{s}</option>
        {/each}
      </select>
    </label>
    <label>
      Sequential
      <select
        value={inputs.sequential ?? "viridis"}
        onchange={(e) => apply("Sequential scheme", { sequential: (e.currentTarget as HTMLSelectElement).value })}
      >
        {#each ["viridis", "plasma", "cividis", "inferno", "magma"] as s (s)}
          <option value={s}>{s}</option>
        {/each}
      </select>
    </label>
    <label>
      Diverging
      <select
        value={inputs.diverging ?? "rdbu"}
        onchange={(e) => apply("Diverging scheme", { diverging: (e.currentTarget as HTMLSelectElement).value })}
      >
        {#each ["rdbu", "rdgy", "brbg", "puor"] as s (s)}
          <option value={s}>{s}</option>
        {/each}
      </select>
    </label>
  </section>

  <section class="placeholder-section">
    <h4>Lines & rules · Series · Highlight · Annotations</h4>
    <p class="muted-note">Coming once Tier-3 wire-up for these clusters lands.</p>
  </section>
{/if}

<style>
  section { margin-bottom: 16px; }
  .placeholder-section { opacity: 0.5; }
  h4 {
    margin: 0 0 4px;
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    color: #475569;
    letter-spacing: 0.04em;
  }
  .muted-note {
    margin: 0 0 8px;
    font-size: 11px;
    color: #94a3b8;
    font-style: italic;
  }
  .status-grid {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .anchor {
    display: grid;
    grid-template-columns: 80px 36px 1fr;
    align-items: center;
    gap: 8px;
  }
  .anchor-name {
    font-size: 12px;
    color: #475569;
  }
  .anchor input[type="color"] {
    width: 36px;
    height: 24px;
    padding: 0;
    border: 1px solid #cbd5e1;
    border-radius: 4px;
    cursor: pointer;
  }
  .anchor code {
    font-family: ui-monospace, monospace;
    font-size: 11px;
    color: #475569;
  }
  label {
    display: flex;
    flex-direction: column;
    gap: 4px;
    font-size: 12px;
    margin-bottom: 8px;
  }
  select {
    padding: 4px 6px;
    border: 1px solid #cbd5e1;
    border-radius: 4px;
    font-size: 12px;
  }
</style>

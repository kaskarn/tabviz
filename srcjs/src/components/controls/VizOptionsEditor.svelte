<!--
  VizOptionsEditor — effects-list option editor for viz_bar /
  viz_boxplot / viz_violin columns. Phase 0c-C3 per-type extraction.

  Single component parametrized by `type` because the three viz types
  share the effects-array UI structure; only the per-effect data
  field(s) and the boxplot mode toggle differ.
-->
<script lang="ts">
  import { createVizOptionsSlice, type VizType } from "./option-slices/viz-options.svelte";
  import type { AvailableField, ColumnSpec } from "$types";

  interface Props {
    type: VizType;
    available: AvailableField[];
  }
  let { type, available }: Props = $props();

  const slice = createVizOptionsSlice();

  export function reset(initial = true): void { slice.reset(initial); }
  export function hydrateFromSpec(ex: ColumnSpec): void { slice.hydrateFromSpec(ex); }
  export function build(): Record<string, unknown> { return slice.buildOptions(type); }
  export function isPrimaryValueResolved(): boolean { return slice.isPrimaryValueResolved(type); }
  /**
   * For the parent's id-derivation pass — returns the first effect's
   * primary data field (value for viz_bar; data/median for viz_violin/
   * boxplot). Empty string when no effects exist yet.
   */
  export function getFirstEffectField(): string {
    const e = slice.effects[0];
    if (!e) return "";
    return e.value ?? e.data ?? e.median ?? "";
  }

  // Helper accessors so the template can stay terse.
  let effects = $derived(slice.effects);
</script>

{#if type === "viz_boxplot"}
  <div class="slot-row">
    <span class="slot-label">Data shape</span>
    <select
      class="slot-select"
      value={slice.boxplotMode}
      onchange={(e) => slice.setBoxplotMode((e.currentTarget as HTMLSelectElement).value as "array" | "stats")}
    >
      <option value="array">Array column (raw values)</option>
      <option value="stats">Precomputed stats (min/Q1/median/Q3/max)</option>
    </select>
  </div>
{/if}

<div class="effects-section">
  <div class="effects-header">
    <span class="section-title">Effects ({effects.length})</span>
    <button type="button" class="add-effect" onclick={() => slice.addEffect()}>+ Add effect</button>
  </div>

  {#each effects as eff, idx (idx)}
    <div class="effect-card">
      <div class="effect-top">
        <span class="effect-num">#{idx + 1}</span>
        <input
          type="text"
          class="effect-label"
          placeholder="Label (optional)"
          value={eff.label ?? ""}
          oninput={(e) => slice.updateEffect(idx, { label: (e.currentTarget as HTMLInputElement).value })}
        />
        <div class="effect-actions">
          <button
            type="button"
            class="effect-move"
            disabled={idx === 0}
            title="Move up"
            aria-label="Move effect up"
            onclick={() => slice.moveEffect(idx, -1)}
          >▲</button>
          <button
            type="button"
            class="effect-move"
            disabled={idx === effects.length - 1}
            title="Move down"
            aria-label="Move effect down"
            onclick={() => slice.moveEffect(idx, 1)}
          >▼</button>
          <button
            type="button"
            class="effect-remove"
            title="Remove effect"
            aria-label="Remove effect"
            onclick={() => slice.removeEffect(idx)}
          >×</button>
        </div>
      </div>

      <!-- Data slot(s) per viz type -->
      {#if type === "viz_bar"}
        <div class="slot-row">
          <span class="slot-label">Value</span>
          <select
            class="slot-select"
            value={eff.value ?? ""}
            onchange={(e) => slice.updateEffect(idx, { value: (e.currentTarget as HTMLSelectElement).value })}
          >
            <option value="" disabled>Select a field…</option>
            {#each available as f (f.field)}
              <option value={f.field}>{f.label}</option>
            {/each}
          </select>
        </div>
      {:else if type === "viz_violin"}
        <div class="slot-row">
          <span class="slot-label">Data</span>
          <select
            class="slot-select"
            value={eff.data ?? ""}
            onchange={(e) => slice.updateEffect(idx, { data: (e.currentTarget as HTMLSelectElement).value })}
          >
            <option value="" disabled>Select an array field…</option>
            {#each available as f (f.field)}
              <option value={f.field}>{f.label}</option>
            {/each}
          </select>
        </div>
      {:else if type === "viz_boxplot"}
        {#if slice.boxplotMode === "array"}
          <div class="slot-row">
            <span class="slot-label">Data</span>
            <select
              class="slot-select"
              value={eff.data ?? ""}
              onchange={(e) => slice.updateEffect(idx, { data: (e.currentTarget as HTMLSelectElement).value })}
            >
              <option value="" disabled>Select an array field…</option>
              {#each available as f (f.field)}
                <option value={f.field}>{f.label}</option>
              {/each}
            </select>
          </div>
        {:else}
          {#each (["min","q1","median","q3","max","outliers"] as const) as k (k)}
            <div class="slot-row">
              <span class="slot-label">{k === "outliers" ? "Outliers (optional)" : k.toUpperCase()}</span>
              <select
                class="slot-select"
                value={(eff as Record<string, string | undefined>)[k] ?? ""}
                onchange={(e) => slice.updateEffect(idx, { [k]: (e.currentTarget as HTMLSelectElement).value })}
              >
                <option value="">Select a field…</option>
                {#each available as f (f.field)}
                  <option value={f.field}>{f.label}</option>
                {/each}
              </select>
            </div>
          {/each}
        {/if}
      {/if}

      <!-- Visual overrides (color + opacity) common to all viz types -->
      <div class="effect-visuals">
        <label class="effect-color">
          <span>Color</span>
          <input
            type="color"
            value={eff.color && /^#[0-9a-f]{6}$/i.test(eff.color) ? eff.color : "#3b82f6"}
            oninput={(e) => slice.updateEffect(idx, { color: (e.currentTarget as HTMLInputElement).value })}
            aria-label="Effect color"
          />
          <input
            type="text"
            class="color-hex"
            placeholder="auto"
            value={eff.color ?? ""}
            oninput={(e) => slice.updateEffect(idx, { color: (e.currentTarget as HTMLInputElement).value })}
          />
        </label>
        <label class="effect-opacity">
          <span>Opacity</span>
          <input
            type="number"
            min="0"
            max="1"
            step="0.1"
            placeholder="auto"
            value={eff.opacity ?? ""}
            oninput={(e) => slice.updateEffect(idx, { opacity: (e.currentTarget as HTMLInputElement).value })}
          />
        </label>
      </div>
    </div>
  {/each}

  {#if effects.length === 0}
    <div class="effects-empty">No effects. Click "+ Add effect" to start.</div>
  {/if}
</div>

<style>
  /*
    Mirrors the .effects-* and .effect-* styles that previously lived
    in ColumnEditorPopover. Duplicated per the C3 pattern (per-component
    style scoping); shared CSS lift is a Phase 0c follow-up.
  */
  .slot-row {
    display: grid;
    grid-template-columns: 80px 1fr;
    align-items: center;
    gap: 8px;
    padding: 4px 0;
  }
  .slot-label {
    font-size: 0.75rem;
    color: var(--tv-text-muted, #64748b);
  }
  .slot-select {
    padding: 4px 8px;
    border: 1px solid var(--tv-border, #e2e8f0);
    border-radius: 4px;
    font: inherit;
    font-size: 0.85rem;
    color: var(--tv-fg, #1a1a1a);
    background: var(--tv-bg, #fff);
  }
  .effects-section {
    margin-top: 8px;
    padding-top: 8px;
    border-top: 1px solid var(--tv-border, #e2e8f0);
  }
  .effects-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 6px;
  }
  .section-title {
    font-size: 0.75rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--tv-text-muted, #64748b);
  }
  .add-effect {
    padding: 3px 8px;
    border: 1px solid var(--tv-border, #e2e8f0);
    border-radius: 4px;
    background: var(--tv-bg, #fff);
    color: var(--tv-fg, #1a1a1a);
    font-size: 0.8rem;
    cursor: pointer;
  }
  .add-effect:hover {
    background: color-mix(in srgb, var(--tv-border, #e2e8f0) 30%, transparent);
  }
  .effect-card {
    border: 1px solid var(--tv-border, #e2e8f0);
    border-radius: 6px;
    padding: 6px 8px;
    margin-bottom: 6px;
    background: color-mix(in srgb, var(--tv-bg, #fff) 92%, var(--tv-border, #e2e8f0));
  }
  .effect-top {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-bottom: 6px;
  }
  .effect-num {
    font-size: 0.75rem;
    font-weight: 600;
    color: var(--tv-text-muted, #64748b);
    min-width: 22px;
  }
  .effect-label {
    flex: 1;
    padding: 3px 8px;
    border: 1px solid var(--tv-border, #e2e8f0);
    border-radius: 4px;
    font: inherit;
    font-size: 0.85rem;
  }
  .effect-actions {
    display: flex;
    gap: 2px;
  }
  .effect-move,
  .effect-remove {
    width: 22px;
    height: 22px;
    border: 1px solid var(--tv-border, #e2e8f0);
    border-radius: 4px;
    background: var(--tv-bg, #fff);
    color: var(--tv-text-muted, #64748b);
    font-size: 0.7rem;
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    justify-content: center;
  }
  .effect-move:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }
  .effect-remove:hover {
    color: #b91c1c;
    border-color: #fca5a5;
  }
  .effect-visuals {
    display: flex;
    gap: 12px;
    margin-top: 6px;
  }
  .effect-color,
  .effect-opacity {
    display: flex;
    align-items: center;
    gap: 4px;
    font-size: 0.75rem;
    color: var(--tv-text-muted, #64748b);
  }
  .effect-color input[type="color"] {
    width: 24px;
    height: 24px;
    padding: 0;
    border: 1px solid var(--tv-border, #e2e8f0);
    border-radius: 4px;
    cursor: pointer;
  }
  .color-hex {
    width: 70px;
    padding: 3px 6px;
    border: 1px solid var(--tv-border, #e2e8f0);
    border-radius: 4px;
    font: inherit;
    font-size: 0.8rem;
  }
  .effect-opacity input {
    width: 60px;
    padding: 3px 6px;
    border: 1px solid var(--tv-border, #e2e8f0);
    border-radius: 4px;
    font: inherit;
    font-size: 0.8rem;
  }
  .effects-empty {
    padding: 8px;
    text-align: center;
    color: var(--tv-text-muted, #64748b);
    font-size: 0.8rem;
    font-style: italic;
  }
</style>

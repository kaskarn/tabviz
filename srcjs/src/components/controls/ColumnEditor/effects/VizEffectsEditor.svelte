<script lang="ts">
  import type { AvailableField, ColumnType } from "$types";
  import type { VizEffectRow } from "$lib/column-editor-schema";

  interface Props {
    type: ColumnType;
    effects: VizEffectRow[];
    /** viz_boxplot only: switches between raw-array and precomputed-stats data shapes. */
    boxplotMode?: "array" | "stats";
    available: AvailableField[];
    onAdd: () => void;
    onRemove: (idx: number) => void;
    onMove: (idx: number, delta: number) => void;
    onUpdate: (idx: number, patch: Partial<VizEffectRow>) => void;
    onBoxplotModeChange: (mode: "array" | "stats") => void;
  }

  let {
    type,
    effects,
    boxplotMode = "array",
    available,
    onAdd,
    onRemove,
    onMove,
    onUpdate,
    onBoxplotModeChange,
  }: Props = $props();
</script>

{#if type === "viz_boxplot"}
  <div class="slot-row">
    <span class="slot-label">Data shape</span>
    <select
      class="slot-select"
      value={boxplotMode}
      onchange={(e) =>
        onBoxplotModeChange(
          (e.currentTarget as HTMLSelectElement).value as "array" | "stats",
        )}
    >
      <option value="array">Array column (raw values)</option>
      <option value="stats">Precomputed stats (min/Q1/median/Q3/max)</option>
    </select>
  </div>
{/if}

<div class="effects-section">
  <div class="effects-header">
    <span class="section-title">Effects ({effects.length})</span>
    <button type="button" class="add-effect" onclick={onAdd}>+ Add effect</button>
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
          oninput={(e) =>
            onUpdate(idx, { label: (e.currentTarget as HTMLInputElement).value })}
        />
        <div class="effect-actions">
          <button
            type="button"
            class="effect-move"
            disabled={idx === 0}
            title="Move up"
            aria-label="Move effect up"
            onclick={() => onMove(idx, -1)}
          >▲</button>
          <button
            type="button"
            class="effect-move"
            disabled={idx === effects.length - 1}
            title="Move down"
            aria-label="Move effect down"
            onclick={() => onMove(idx, 1)}
          >▼</button>
          <button
            type="button"
            class="effect-remove"
            title="Remove effect"
            aria-label="Remove effect"
            onclick={() => onRemove(idx)}
          >×</button>
        </div>
      </div>

      {#if type === "viz_bar"}
        <div class="slot-row">
          <span class="slot-label">Value</span>
          <select
            class="slot-select"
            value={eff.value ?? ""}
            onchange={(e) =>
              onUpdate(idx, { value: (e.currentTarget as HTMLSelectElement).value })}
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
            onchange={(e) =>
              onUpdate(idx, { data: (e.currentTarget as HTMLSelectElement).value })}
          >
            <option value="" disabled>Select an array field…</option>
            {#each available as f (f.field)}
              <option value={f.field}>{f.label}</option>
            {/each}
          </select>
        </div>
      {:else if type === "viz_boxplot"}
        {#if boxplotMode === "array"}
          <div class="slot-row">
            <span class="slot-label">Data</span>
            <select
              class="slot-select"
              value={eff.data ?? ""}
              onchange={(e) =>
                onUpdate(idx, { data: (e.currentTarget as HTMLSelectElement).value })}
            >
              <option value="" disabled>Select an array field…</option>
              {#each available as f (f.field)}
                <option value={f.field}>{f.label}</option>
              {/each}
            </select>
          </div>
        {:else}
          {#each ["min", "q1", "median", "q3", "max", "outliers"] as const as k (k)}
            <div class="slot-row">
              <span class="slot-label">
                {k === "outliers" ? "Outliers (optional)" : k.toUpperCase()}
              </span>
              <select
                class="slot-select"
                value={(eff as Record<string, string | undefined>)[k] ?? ""}
                onchange={(e) =>
                  onUpdate(idx, { [k]: (e.currentTarget as HTMLSelectElement).value })}
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

      <div class="effect-visuals">
        <label class="effect-color">
          <span>Color</span>
          <input
            type="color"
            value={eff.color && /^#[0-9a-f]{6}$/i.test(eff.color) ? eff.color : "#3b82f6"}
            oninput={(e) =>
              onUpdate(idx, { color: (e.currentTarget as HTMLInputElement).value })}
            aria-label="Effect color"
          />
          <input
            type="text"
            class="color-hex"
            placeholder="auto"
            value={eff.color ?? ""}
            oninput={(e) =>
              onUpdate(idx, { color: (e.currentTarget as HTMLInputElement).value })}
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
            oninput={(e) =>
              onUpdate(idx, { opacity: (e.currentTarget as HTMLInputElement).value })}
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
  .slot-row {
    display: grid;
    grid-template-columns: 72px 1fr;
    align-items: center;
    gap: 8px;
    padding: 1px 0;
  }
  .slot-label {
    font-size: 11px;
    color: var(--tv-text-muted, #64748b);
    font-weight: 500;
  }
  .slot-select {
    width: 100%;
    min-width: 0;
    padding: 3px 6px;
    border: 1px solid var(--tv-border, #e2e8f0);
    border-radius: 4px;
    background: var(--tv-bg, #ffffff);
    color: var(--tv-fg, #1a1a1a);
    font-size: 12px;
    font-family: inherit;
  }

  .effects-section {
    display: flex;
    flex-direction: column;
    gap: 6px;
    border-top: 1px solid var(--tv-border, #e2e8f0);
    padding-top: 8px;
  }
  .effects-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
  }
  .section-title {
    font-size: 10px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--tv-text-muted, #64748b);
  }
  .add-effect {
    padding: 2px 8px;
    border: 1px solid color-mix(in srgb, var(--tv-accent, #2563eb) 20%, var(--tv-border, #e2e8f0));
    border-radius: 4px;
    background: color-mix(in srgb, var(--tv-accent, #2563eb) 8%, var(--tv-bg, #ffffff));
    color: var(--tv-accent, #2563eb);
    font-size: 11px;
    font-weight: 500;
    cursor: pointer;
    font-family: inherit;
  }
  .add-effect:hover {
    background: color-mix(in srgb, var(--tv-accent, #2563eb) 16%, var(--tv-bg, #ffffff));
  }

  .effect-card {
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding: 6px 8px;
    border: 1px solid var(--tv-border, #e2e8f0);
    border-radius: 6px;
    background: color-mix(in srgb, var(--tv-accent, #2563eb) 3%, var(--tv-bg, #ffffff));
  }
  .effect-top {
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .effect-num {
    font-size: 10px;
    font-weight: 600;
    color: var(--tv-text-muted, #64748b);
    font-variant-numeric: tabular-nums;
    min-width: 18px;
  }
  .effect-label {
    flex: 1;
    min-width: 0;
    padding: 2px 6px;
    border: 1px solid var(--tv-border, #e2e8f0);
    border-radius: 4px;
    background: var(--tv-bg, #ffffff);
    color: var(--tv-fg, #1a1a1a);
    font-size: 11px;
    font-family: inherit;
  }
  .effect-actions {
    display: inline-flex;
    gap: 2px;
  }
  .effect-actions button {
    width: 20px;
    height: 20px;
    padding: 0;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border: 1px solid var(--tv-border, #e2e8f0);
    border-radius: 3px;
    background: var(--tv-bg, #ffffff);
    color: var(--tv-text-muted, #64748b);
    font-size: 10px;
    cursor: pointer;
    font-family: inherit;
  }
  .effect-actions button:hover:not(:disabled) {
    color: var(--tv-accent, #2563eb);
    border-color: color-mix(in srgb, var(--tv-accent, #2563eb) 40%, var(--tv-border, #e2e8f0));
  }
  .effect-actions button:disabled {
    opacity: 0.35;
    cursor: not-allowed;
  }
  .effect-remove {
    color: #dc2626 !important;
    font-size: 14px !important;
    font-weight: 600;
    line-height: 1;
  }
  .effect-remove:hover:not(:disabled) {
    background: rgba(220, 38, 38, 0.08) !important;
    border-color: #dc2626 !important;
  }

  .effect-visuals {
    display: flex;
    gap: 8px;
    align-items: center;
  }
  .effect-color,
  .effect-opacity {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    font-size: 10px;
    color: var(--tv-text-muted, #64748b);
  }
  .effect-color input[type="color"] {
    width: 22px;
    height: 18px;
    padding: 0;
    border: 1px solid var(--tv-border, #e2e8f0);
    border-radius: 3px;
    cursor: pointer;
    background: var(--tv-bg, #ffffff);
  }
  .color-hex {
    width: 70px;
    padding: 2px 4px;
    border: 1px solid var(--tv-border, #e2e8f0);
    border-radius: 3px;
    background: var(--tv-bg, #ffffff);
    color: var(--tv-fg, #1a1a1a);
    font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    font-size: 10px;
  }
  .effect-opacity input[type="number"] {
    width: 52px;
    padding: 2px 4px;
    border: 1px solid var(--tv-border, #e2e8f0);
    border-radius: 3px;
    background: var(--tv-bg, #ffffff);
    color: var(--tv-fg, #1a1a1a);
    font-size: 10px;
    font-family: inherit;
  }

  .effects-empty {
    padding: 10px;
    text-align: center;
    border: 1px dashed var(--tv-border, #e2e8f0);
    border-radius: 6px;
    color: var(--tv-text-muted, #64748b);
    font-size: 11px;
    font-style: italic;
  }
</style>

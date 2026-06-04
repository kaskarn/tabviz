<!--
  GeometryControls — Phase D Tier-1 controls for the GEOMETRY axis.

  Two small grids of numeric inputs:
    Radius:        sm  md  lg  pill   (px)
    Border-width:  hair  thin  regular  thick   (px)

  Defaults are pulled from the resolver (2/6/10/999 px radius,
  0.5/1/1.5/2.5 px border-width). Editing a single field commits a
  partial geometry update.
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

  type RadiusKey = "sm" | "md" | "lg" | "pill";
  type BorderKey = "hair" | "thin" | "regular" | "thick";

  const RADIUS_KEYS: RadiusKey[] = ["sm", "md", "lg", "pill"];
  const BORDER_KEYS: BorderKey[] = ["hair", "thin", "regular", "thick"];

  const DEFAULT_RADIUS: Record<RadiusKey, number> = { sm: 2, md: 6, lg: 10, pill: 999 };
  const DEFAULT_BORDER: Record<BorderKey, number> = { hair: 0.5, thin: 1, regular: 1.5, thick: 2.5 };

  function radius(k: RadiusKey): number {
    return inputs.geometry?.radius?.[k] ?? DEFAULT_RADIUS[k];
  }
  function border(k: BorderKey): number {
    return inputs.geometry?.border_width?.[k] ?? DEFAULT_BORDER[k];
  }

  function setRadius(k: RadiusKey, v: number): void {
    onchange({
      ...inputs,
      geometry: {
        ...inputs.geometry,
        radius: { ...inputs.geometry?.radius, [k]: v },
      },
    });
  }
  function setBorder(k: BorderKey, v: number): void {
    onchange({
      ...inputs,
      geometry: {
        ...inputs.geometry,
        border_width: { ...inputs.geometry?.border_width, [k]: v },
      },
    });
  }
</script>

<div class="rows">
  <div class="grid">
    <span class="label">Radius</span>
    <div class="cells">
      {#each RADIUS_KEYS as k (k)}
        <label class="cell">
          <span class="cell-label">{k}</span>
          <input type="number" min="0" max="999" step="1"
                 value={radius(k)}
                 oninput={(e) => setRadius(k, parseFloat((e.currentTarget as HTMLInputElement).value))} />
          <span class="suffix">px</span>
        </label>
      {/each}
    </div>
  </div>
  <div class="grid">
    <span class="label">Border</span>
    <div class="cells">
      {#each BORDER_KEYS as k (k)}
        <label class="cell">
          <span class="cell-label">{k}</span>
          <input type="number" min="0" max="8" step="0.25"
                 value={border(k)}
                 oninput={(e) => setBorder(k, parseFloat((e.currentTarget as HTMLInputElement).value))} />
          <span class="suffix">px</span>
        </label>
      {/each}
    </div>
  </div>
</div>

<style>
  .rows { display: flex; flex-direction: column; gap: 8px; padding: 4px 18px 10px; }
  .grid {
    display: grid;
    grid-template-columns: 70px 1fr;
    gap: 10px;
    align-items: center;
  }
  .label {
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--tp-muted, #6b6760);
  }
  .cells {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 4px;
  }
  .cell {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    border: 1px solid var(--tp-rule, #d8d4cc);
    border-radius: 4px;
    padding: 0 6px;
    background: var(--tp-input-bg, #ffffff);
    min-width: 0;
  }
  .cell-label {
    font-family: ui-monospace, "JetBrains Mono", "SF Mono", monospace;
    font-size: 9.5px;
    color: var(--tp-muted, #6b6760);
    letter-spacing: 0.04em;
    flex: 0 0 auto;
  }
  .cell input {
    border: 0;
    outline: 0;
    background: transparent;
    color: var(--tp-fg, #1c1a17);
    font: inherit;
    font-size: 11px;
    width: 100%;
    min-width: 0;
    padding: 5px 0;
    text-align: right;
  }
  .cell .suffix {
    font-size: 9.5px;
    color: var(--tp-muted, #6b6760);
    flex: 0 0 auto;
  }
</style>

<!--
  GeometrySamples — Tier 1 · GEOMETRY visualization.

  Two rows of live samples driven from the resolved cssVars:
    Radius:        four rounded-square plates (sm / md / lg / pill)
    Border-width:  four horizontal strokes (hair / thin / regular / thick)

  Each sample is captioned with its --tv-* token name + the resolved
  px value. Reads via inputs (Tier 1) for the displayed values rather
  than the resolved cssVars to keep the live update tight.
-->
<script lang="ts">
  import type { ThemeInputs } from "$types/theme-inputs";
  import { inspectorStore } from "$stores/inspector-store.svelte";
  import type { ResolvedTheme } from "$lib/theme/resolve-theme";

  const {
    inputs,
    resolved,
  }: {
    inputs: ThemeInputs;
    resolved: ResolvedTheme;
  } = $props();

  const DEFAULT_RADIUS = { sm: 2, md: 6, lg: 10, pill: 999 } as const;
  const DEFAULT_BORDER = { hair: 0.5, thin: 1, regular: 1.5, thick: 2.5 } as const;

  type RKey = "sm" | "md" | "lg" | "pill";
  type BKey = "hair" | "thin" | "regular" | "thick";

  const RADIUS_KEYS: RKey[] = ["sm", "md", "lg", "pill"];
  const BORDER_KEYS: BKey[] = ["hair", "thin", "regular", "thick"];

  function r(k: RKey): number { return inputs.geometry?.radius?.[k] ?? DEFAULT_RADIUS[k]; }
  function b(k: BKey): number { return inputs.geometry?.border_width?.[k] ?? DEFAULT_BORDER[k]; }

  function clickRadius(k: RKey): void { inspectorStore.trace(`--tv-radius-${k}`, resolved); }
  function clickBorder(k: BKey): void { inspectorStore.trace(`--tv-border-width-${k}`, resolved); }

  /** Cap radius for the visual preview so pill (999px) doesn't dominate. */
  function previewRadius(px: number): string {
    return `${Math.min(px, 32)}px`;
  }
</script>

<div class="geometry-samples">
  <div class="block">
    <div class="row-label">
      <code>radius.{`{sm,md,lg,pill}`}</code>
      <span class="hint">· corner softness scale</span>
    </div>
    <div class="grid">
      {#each RADIUS_KEYS as k (k)}
        {@const v = r(k)}
        <button type="button" class="sample" onclick={() => clickRadius(k)}
                aria-label={`Trace --tv-radius-${k}`}>
          <span class="plate" style:border-radius={previewRadius(v)}></span>
          <span class="cap">
            <code class="key">{k}</code>
            <span class="val">{v}px</span>
          </span>
        </button>
      {/each}
    </div>
  </div>

  <div class="block">
    <div class="row-label">
      <code>border_width.{`{hair,thin,regular,thick}`}</code>
      <span class="hint">· line weight scale</span>
    </div>
    <div class="grid">
      {#each BORDER_KEYS as k (k)}
        {@const v = b(k)}
        <button type="button" class="sample" onclick={() => clickBorder(k)}
                aria-label={`Trace --tv-border-width-${k}`}>
          <span class="rule" style:border-top-width={`${v}px`}></span>
          <span class="cap">
            <code class="key">{k}</code>
            <span class="val">{v}px</span>
          </span>
        </button>
      {/each}
    </div>
  </div>
</div>

<style>
  .geometry-samples {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }
  .block { display: flex; flex-direction: column; gap: 6px; }
  .row-label {
    display: flex;
    align-items: baseline;
    gap: 8px;
    font-family: ui-monospace, "JetBrains Mono", "SF Mono", monospace;
    font-size: 11.5px;
    color: var(--tp-fg, #1c1a17);
  }
  .row-label .hint {
    font-family: -apple-system, BlinkMacSystemFont, sans-serif;
    font-size: 11px;
    color: var(--tp-muted, #6b6760);
    font-style: italic;
  }
  .grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 8px;
  }
  .sample {
    display: flex;
    flex-direction: column;
    align-items: stretch;
    gap: 6px;
    background: transparent;
    border: 1px solid var(--tp-rule, #e8e6e1);
    border-radius: 6px;
    padding: 10px 12px;
    cursor: pointer;
    color: var(--tp-fg, #1c1a17);
    transition: border-color 80ms ease;
  }
  .sample:hover { border-color: var(--tp-fg, #1c1a17); }
  .plate {
    display: block;
    height: 36px;
    background: var(--tp-fg, #1c1a17);
    border: 1px solid rgba(0, 0, 0, 0.12);
  }
  .rule {
    display: block;
    height: 12px;
    border-top-style: solid;
    border-top-color: var(--tp-fg, #1c1a17);
    align-self: stretch;
    margin-top: 12px;
  }
  .cap {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    font-family: ui-monospace, "JetBrains Mono", "SF Mono", monospace;
    font-size: 10px;
  }
  .key { color: var(--tp-rhs, #5e51a3); }
  .val { color: var(--tp-muted, #6b6760); }
</style>

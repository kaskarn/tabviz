<!--
  RampPlateGrid — Tier 1 reference plates.

  Three ramps (neutral / brand / accent) each rendered as an 11-step grid
  of large square plates. The OKLCH triple is printed *inside* each plate
  in monospace so the reference plate doubles as a working spec sheet.
  Below each solid row sits the alpha-companion row at half height.

  Click any plate → tracks the grade in the inspector via a synthetic
  ramp.N cssVar key (the inspector's lookup falls back gracefully when the
  key isn't in the manifest).
-->
<script lang="ts">
  import type { ResolvedTheme } from "$lib/theme/resolve-theme";
  import { hexToOklch } from "$lib/oklch";
  import { inspectorStore } from "$stores/inspector-store.svelte";

  const { resolved }: { resolved: ResolvedTheme } = $props();

  const ramps = $derived(resolved.ramps);

  type RampKey = "neutral" | "brand" | "accent";

  const ROWS: { key: RampKey; label: string; derivation: string }[] = [
    { key: "neutral", label: "neutral.1–11", derivation: "interpolated paper → ink" },
    { key: "brand",   label: "brand.1–11",   derivation: "brand anchor at chroma peak" },
    { key: "accent",  label: "accent.1–11",  derivation: "accent anchor (or brand fallback)" },
  ];

  function alphaFor(key: RampKey): readonly string[] {
    switch (key) {
      case "neutral": return ramps.neutralAlpha;
      case "brand":   return ramps.brandAlpha;
      case "accent":  return ramps.accentAlpha;
    }
  }

  function fmtTriple(hex: string): string {
    const t = hexToOklch(hex);
    return `${t.L.toFixed(3)} ${t.C.toFixed(3)} ${Math.round(t.H)}`;
  }

  /** APCA-cheap heuristic: dark plates need a light triple label, and
   *  vice-versa. Mirrors rgc's inverted-label trick. */
  function plateIsLight(hex: string): boolean {
    return hexToOklch(hex).L > 0.55;
  }

  function click(key: RampKey, grade: number): void {
    inspectorStore.trace(`--tv-${key}-${grade}`, resolved);
  }
</script>

<div class="ramp-plate-grid">
  {#each ROWS as row (row.key)}
    {@const arr = ramps[row.key]}
    {@const alpha = alphaFor(row.key)}
    <div class="ramp-block">
      <div class="row-label">
        <code>{row.label}</code>
        <span class="derivation">· {row.derivation}</span>
      </div>
      <div class="plates">
        {#each arr.slice(0, 11) as hex, i (i)}
          {@const light = plateIsLight(hex)}
          <button
            type="button"
            class="plate"
            class:on-light={light}
            style:background={hex}
            onclick={() => click(row.key, i + 1)}
            aria-label={`${row.label} grade ${i + 1}`}
            title={`${hex} · ${fmtTriple(hex)}`}
          >
            <span class="grade">{i + 1}</span>
            <span class="triple">{fmtTriple(hex)}</span>
          </button>
        {/each}
      </div>
      <div class="alpha-row" aria-hidden="true">
        {#each alpha.slice(0, 11) as rgba, i (i)}
          <span class="alpha-plate">
            <span class="alpha-wash" style:background={rgba}></span>
            <span class="alpha-label">a{i + 1}</span>
          </span>
        {/each}
      </div>
    </div>
  {/each}
</div>

<style>
  .ramp-plate-grid {
    display: flex;
    flex-direction: column;
    gap: 18px;
  }
  .ramp-block { display: flex; flex-direction: column; gap: 4px; }
  .row-label {
    display: flex;
    align-items: baseline;
    gap: 10px;
    font-family: ui-monospace, "JetBrains Mono", "SF Mono", monospace;
    font-size: 12px;
    color: var(--tp-fg, #1c1a17);
  }
  .derivation {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    font-size: 11px;
    color: var(--tp-muted, #6b6760);
    font-style: italic;
  }
  .plates {
    display: grid;
    grid-template-columns: repeat(11, 1fr);
    gap: 4px;
  }
  .plate {
    aspect-ratio: 1 / 1;
    border: 1px solid rgba(0, 0, 0, 0.08);
    border-radius: 6px;
    padding: 8px 10px;
    cursor: pointer;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    align-items: flex-start;
    font-family: ui-monospace, "JetBrains Mono", "SF Mono", monospace;
    color: rgba(255, 255, 255, 0.96);
    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.18);
    transition: outline 80ms ease;
    outline: 2px solid transparent;
    outline-offset: -2px;
    min-width: 0;
  }
  .plate.on-light {
    color: rgba(20, 18, 16, 0.86);
    text-shadow: 0 1px 1px rgba(255, 255, 255, 0.4);
  }
  .plate:hover { outline-color: var(--tp-fg, #1c1a17); }
  .plate:focus-visible { outline-color: var(--tp-fg, #1c1a17); }
  .grade {
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.04em;
    opacity: 0.95;
  }
  .triple {
    font-size: 9px;
    line-height: 1.1;
    letter-spacing: 0.01em;
    opacity: 0.78;
    word-spacing: 0.05em;
  }
  .alpha-row {
    display: grid;
    grid-template-columns: repeat(11, 1fr);
    gap: 4px;
    background-image:
      linear-gradient(45deg, #d8d4cc 25%, transparent 25%, transparent 75%, #d8d4cc 75%),
      linear-gradient(45deg, #d8d4cc 25%, transparent 25%, transparent 75%, #d8d4cc 75%);
    background-size: 10px 10px;
    background-position: 0 0, 5px 5px;
    border-radius: 4px;
    padding: 0;
  }
  .alpha-plate {
    position: relative;
    aspect-ratio: 2.4 / 1;
    border-radius: 4px;
    overflow: hidden;
  }
  .alpha-wash {
    position: absolute;
    inset: 0;
    border-radius: 4px;
  }
  .alpha-label {
    position: relative;
    z-index: 1;
    display: block;
    font-family: ui-monospace, "JetBrains Mono", "SF Mono", monospace;
    font-size: 9px;
    font-weight: 600;
    color: rgba(20, 18, 16, 0.55);
    padding: 2px 6px;
    letter-spacing: 0.04em;
  }
</style>

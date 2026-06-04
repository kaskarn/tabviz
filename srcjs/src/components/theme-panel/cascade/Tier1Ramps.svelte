<!--
  Tier 1 ramps — neutral / brand / accent as 11-step swatch strips, with
  alpha-companion rows underneath and OKLCH triple labels at the anchor
  endpoints (paper @ grade 1, ink @ grade 11). Click any grade to trace.
-->
<script lang="ts">
  import type { ResolvedTheme } from "$lib/theme/resolve-theme";
  import { hexToOklch } from "$lib/oklch";
  import { inspectorStore } from "$stores/inspector-store.svelte";

  const { resolved }: { resolved: ResolvedTheme } = $props();

  const ramps = $derived(resolved.ramps);

  type RampKey = "neutral" | "brand" | "accent";

  const ROWS: { key: RampKey; label: string; anchor: string }[] = [
    { key: "neutral", label: "neutral", anchor: "paper → ink" },
    { key: "brand",   label: "brand",   anchor: "brand hue" },
    { key: "accent",  label: "accent",  anchor: "accent hue" },
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
    return `${t.L.toFixed(2)} ${t.C.toFixed(2)} ${Math.round(t.H)}°`;
  }

  function clickGrade(key: RampKey, grade: number): void {
    // Pick a representative cssVar for this ramp step. The most useful
    // ones: surface (neutral.1/2), text (neutral.11), brand-solid
    // (brand.9), accent (accent.9). Fallback: open inspector with the
    // ramp identifier alone via a synthetic var name.
    const cssVar = `--tv-${key}-${grade}`;
    // We don't have a manifest entry for raw ramp steps, but the
    // inspector handles the lookup gracefully (no manifest → just shows
    // the value). Forward the hex via a no-op token name.
    inspectorStore.trace(cssVar, resolved);
  }
</script>

<div class="tier1-ramps">
  {#each ROWS as row (row.key)}
    {@const arr = ramps[row.key]}
    {@const alpha = alphaFor(row.key)}
    <div class="ramp-block">
      <header>
        <span class="name">{row.label}</span>
        <span class="anchor">{row.anchor}</span>
      </header>
      <div class="strip">
        {#each arr.slice(0, 11) as hex, i (i)}
          <button type="button" class="step"
                  style:background={hex}
                  onclick={() => clickGrade(row.key, i + 1)}
                  title={`${row.label}[${i + 1}] · ${hex} · ${fmtTriple(hex)}`}
                  aria-label={`${row.label} grade ${i + 1}`}>
          </button>
        {/each}
      </div>
      <div class="alpha-strip" aria-hidden="true">
        {#each alpha.slice(0, 11) as rgba, i (i)}
          <span class="alpha-step" style:background={rgba}></span>
        {/each}
      </div>
      <div class="triples">
        <code>{fmtTriple(arr[0])}</code>
        <span class="dash">→</span>
        <code>{fmtTriple(arr[10])}</code>
      </div>
    </div>
  {/each}
</div>

<style>
  .tier1-ramps {
    display: flex;
    flex-direction: column;
    gap: 14px;
    padding: 4px 18px 18px;
  }
  .ramp-block { display: flex; flex-direction: column; gap: 4px; }
  header {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    padding-bottom: 2px;
  }
  .name {
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    font-weight: 600;
    color: var(--tp-fg, #1c1a17);
  }
  .anchor {
    font-size: 10px;
    color: var(--tp-muted, #6b6760);
    font-style: italic;
  }
  .strip {
    display: grid;
    grid-template-columns: repeat(11, 1fr);
    gap: 1px;
    height: 28px;
    border-radius: 4px;
    overflow: hidden;
    border: 1px solid var(--tp-rule, #e8e6e1);
  }
  .step {
    border: 0;
    padding: 0;
    cursor: pointer;
  }
  .step:hover {
    outline: 2px solid var(--tp-fg, #1c1a17);
    outline-offset: -2px;
    position: relative;
    z-index: 1;
  }
  .alpha-strip {
    display: grid;
    grid-template-columns: repeat(11, 1fr);
    gap: 1px;
    height: 8px;
    border-radius: 3px;
    overflow: hidden;
    background-image:
      linear-gradient(45deg, #d8d4cc 25%, transparent 25%, transparent 75%, #d8d4cc 75%),
      linear-gradient(45deg, #d8d4cc 25%, transparent 25%, transparent 75%, #d8d4cc 75%);
    background-size: 8px 8px;
    background-position: 0 0, 4px 4px;
  }
  .alpha-step { display: block; }
  .triples {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    font-family: ui-monospace, "JetBrains Mono", "SF Mono", monospace;
    font-size: 10px;
    color: var(--tp-muted, #6b6760);
  }
  .dash { opacity: 0.5; }
</style>

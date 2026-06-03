<!--
  Stage 3 — StudioChart.svelte
  Live chart rendering. Re-renders on every studioStore.resolved change.
  Mounts a TabvizPlot bound to the current working theme.
-->
<script lang="ts">
  import { studioStore } from "./studio-store.svelte";

  // The chart spec was passed from R as an initial JSON blob; we render
  // it via a lightweight wrapper. For now this is a placeholder showing
  // the resolved cssVars — wiring the full TabvizPlot through the
  // working-copy theme is a follow-up integration.
  const { spec }: { spec: unknown } = $props();

  // For now the chart area shows a swatch sampler so the developer can
  // verify that edits propagate. The full TabvizPlot mount lands in a
  // subsequent commit once the spec re-serialization path is wired.
  const cssVars = $derived(studioStore.resolved?.cssVars ?? {});
  const sampleVars = $derived([
    "--tv-surface-bg",
    "--tv-row-base-bg",
    "--tv-row-alt-bg",
    "--tv-text",
    "--tv-text-muted",
    "--tv-accent",
    "--tv-cell-border",
    "--tv-text-title-fg",
  ]);
</script>

<div class="studio-chart">
  <div class="placeholder">
    <p class="placeholder-msg">
      Studio chart preview — full chart rendering wires in once spec
      re-serialization is in place. Until then this strip samples the
      current resolved cssVars so edits are visible.
    </p>
    <ul class="swatch-list">
      {#each sampleVars as name (name)}
        <li>
          <span class="chip" style:background={cssVars[name] ?? "transparent"}></span>
          <code>{name}</code>
          <span class="value">{cssVars[name] ?? "—"}</span>
        </li>
      {/each}
    </ul>
  </div>
</div>

<style>
  .studio-chart {
    overflow: auto;
    padding: 16px;
    background: #fafafa;
  }
  .placeholder {
    max-width: 720px;
    margin: 0 auto;
    padding: 24px;
    background: #fff;
    border: 1px dashed #cbd5e1;
    border-radius: 8px;
  }
  .placeholder-msg {
    margin: 0 0 16px;
    color: #475569;
    font-size: 12.5px;
    line-height: 1.5;
  }
  .swatch-list {
    list-style: none;
    padding: 0;
    margin: 0;
    display: grid;
    grid-template-columns: 1fr;
    gap: 6px;
  }
  .swatch-list li {
    display: grid;
    grid-template-columns: 32px 1fr auto;
    align-items: center;
    gap: 10px;
    padding: 4px 8px;
    border: 1px solid #e2e8f0;
    border-radius: 4px;
    background: #fafafa;
  }
  .chip {
    width: 28px;
    height: 18px;
    border: 1px solid rgba(0, 0, 0, 0.08);
    border-radius: 2px;
  }
  code {
    font-family: ui-monospace, monospace;
    font-size: 11.5px;
  }
  .value {
    font-family: ui-monospace, monospace;
    font-size: 11px;
    color: #64748b;
  }
</style>

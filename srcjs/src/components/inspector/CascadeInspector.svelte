<!--
  Stage 3 §2 — Cascade Inspector.

  Docked panel that traces a clicked cssVar through Tier 3 → Tier 2 →
  Tier 1 → OKLCH. Reads from inspectorStore. Browser-only — never
  emitted by the SVG export.
-->
<script lang="ts">
  import { inspectorStore } from "../../stores/inspector-store.svelte";
  import { formatTrace, type TraceStep } from "../../lib/theme/inspect";

  const state = $derived(inspectorStore.state);

  function close(): void {
    inspectorStore.close();
  }

  function stepBadge(step: TraceStep): string {
    return step.tier.toUpperCase();
  }

  function stepValue(step: TraceStep): string {
    // TraceStep variants have different shapes; show the most useful summary.
    if ("value" in step && step.value) return step.value;
    if ("cssVar" in step) return step.cssVar;
    if ("role" in step) return step.role;
    if ("anchor" in step) return step.anchor;
    if ("ramp" in step && "grade" in step) return `${step.ramp}[${step.grade}]`;
    return "";
  }
</script>

{#if state.open}
  <aside class="cascade-inspector" aria-label="Cascade Inspector">
    <header>
      <h3>Cascade Inspector</h3>
      <button type="button" class="close" onclick={close} aria-label="Close inspector">×</button>
    </header>

    {#if state.cssVar}
      <div class="active-token">
        <code>{state.cssVar}</code>
      </div>
    {/if}

    {#if state.trace}
      <ol class="trace">
        {#each state.trace.trace as step (step)}
          <li class="step">
            <span class="badge tier-{step.tier}">{stepBadge(step)}</span>
            <span class="value">{stepValue(step)}</span>
          </li>
        {/each}
      </ol>

      <details class="full-trace">
        <summary>Full trace</summary>
        <pre>{formatTrace(state.trace)}</pre>
      </details>
    {:else}
      <p class="empty">Click a token in the cascade view to trace it.</p>
    {/if}
  </aside>
{/if}

<style>
  .cascade-inspector {
    position: fixed;
    right: 12px;
    bottom: 12px;
    width: 320px;
    max-height: 60vh;
    overflow: auto;
    background: var(--tv-surface-bg, var(--tv-surface-bg, #fff));
    color: var(--tv-text, var(--tv-text, #1a1a1a));
    border: 1px solid var(--tv-cell-border, var(--tv-border, #e2e8f0));
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.12);
    padding: 12px;
    z-index: 9999;
    font-family: var(--tv-text-body-family, system-ui, sans-serif);
    font-size: 12.5px;
  }

  header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 8px;
  }
  h3 {
    margin: 0;
    font-size: 13px;
    font-weight: 600;
  }
  .close {
    background: transparent;
    border: none;
    cursor: pointer;
    font-size: 18px;
    line-height: 1;
    padding: 0 4px;
    color: inherit;
  }

  .active-token code {
    display: block;
    padding: 4px 8px;
    background: var(--tv-row-alt-bg, var(--tv-row-alt-bg, #f8fafc));
    border-radius: 4px;
    font-family: ui-monospace, monospace;
    font-size: 11.5px;
  }

  .trace {
    list-style: none;
    padding: 0;
    margin: 8px 0;
  }
  .step {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 4px 0;
    border-bottom: 1px dotted var(--tv-cell-border, #e2e8f0);
  }
  .badge {
    display: inline-block;
    padding: 1px 6px;
    border-radius: 3px;
    font-size: 10px;
    font-weight: 600;
    background: var(--tv-text-subtle, #94a3b8);
    color: var(--tv-surface-bg, #fff);
    min-width: 64px;
    text-align: center;
  }
  .badge.tier-component  { background: #1d4ed8; color: #fff; }
  .badge.tier-role       { background: #047857; color: #fff; }
  .badge.tier-input      { background: #b45309; color: #fff; }
  .badge.tier-anchor     { background: #6d28d9; color: #fff; }
  .badge.tier-computed   { background: #be185d; color: #fff; }
  .badge.tier-const      { background: #475569; color: #fff; }
  .value {
    font-family: ui-monospace, monospace;
    font-size: 11.5px;
  }

  .empty {
    color: var(--tv-text-muted, #64748b);
    font-style: italic;
    margin: 8px 0 0;
  }

  .full-trace summary {
    cursor: pointer;
    color: var(--tv-text-muted, #64748b);
    font-size: 11px;
    margin-top: 8px;
  }
  .full-trace pre {
    background: var(--tv-row-alt-bg, var(--tv-row-alt-bg, #f8fafc));
    padding: 6px;
    border-radius: 4px;
    font-size: 11px;
    overflow: auto;
  }
</style>

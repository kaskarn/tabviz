<!--
  Stage 3 — StudioInspector.svelte
  Right-rail Inspector container. Wraps the existing CascadeInspector
  but binds it to the studio's resolved theme rather than the embedded
  widget's.
-->
<script lang="ts">
  import { inspectorStore } from "../stores/inspector-store.svelte";
  import { studioStore } from "./studio-store.svelte";
  import { formatTrace, type TraceStep } from "../lib/theme/inspect";

  const state = $derived(inspectorStore.state);

  function close(): void {
    inspectorStore.close();
  }

  function stepValue(step: TraceStep): string {
    if ("value" in step && step.value) return step.value;
    if ("cssVar" in step) return step.cssVar;
    if ("role" in step) return step.role;
    if ("anchor" in step) return step.anchor;
    if ("ramp" in step && "grade" in step) return `${step.ramp}[${step.grade}]`;
    return "";
  }
</script>

{#if state.open}
  <aside class="studio-inspector">
    <header>
      <h3>Inspector</h3>
      <button type="button" class="close" onclick={close} aria-label="Close">×</button>
    </header>

    {#if state.cssVar}
      <div class="active-token">
        <code>{state.cssVar}</code>
        <button type="button" class="escape-hatch" title="Pins the leaf — breaks the cascade">Just change this color</button>
      </div>
    {/if}

    {#if state.trace}
      <ol class="trace">
        {#each state.trace.trace as step, idx (idx)}
          <li class="step">
            <span class="badge tier-{step.tier}">{step.tier}</span>
            <span class="value">{stepValue(step)}</span>
            <span class="actions">
              {#if step.tier === "role"}
                <button type="button" title="Rebind this role to a different ramp/grade">Rebind</button>
              {:else if step.tier === "input" || step.tier === "anchor"}
                <button type="button" title="Open OKLCH picker">Pick…</button>
              {:else if step.tier === "computed"}
                <button type="button" title="Pin this computed value (breaks cascade)">Pin</button>
              {/if}
            </span>
          </li>
        {/each}
      </ol>
    {:else}
      <p class="empty">Click any element in the chart to trace its token.</p>
    {/if}
  </aside>
{/if}

<style>
  .studio-inspector {
    width: 320px;
    border-left: 1px solid #e2e8f0;
    background: #fff;
    overflow-y: auto;
    padding: 12px;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 4px;
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
  .active-token {
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding: 8px;
    background: #f8fafc;
    border-radius: 4px;
  }
  .active-token code {
    font-family: ui-monospace, monospace;
    font-size: 11.5px;
  }
  .escape-hatch {
    align-self: flex-start;
    background: transparent;
    border: 1px dashed #94a3b8;
    border-radius: 4px;
    padding: 3px 8px;
    font-size: 11px;
    color: #475569;
    cursor: pointer;
  }
  .escape-hatch:hover {
    background: #f1f5f9;
    color: #1a1a1a;
  }
  .trace {
    list-style: none;
    padding: 0;
    margin: 0;
  }
  .step {
    display: grid;
    grid-template-columns: 80px 1fr auto;
    align-items: center;
    gap: 8px;
    padding: 6px 0;
    border-bottom: 1px dotted #e2e8f0;
  }
  .badge {
    display: inline-block;
    padding: 2px 6px;
    border-radius: 3px;
    font-size: 10px;
    font-weight: 600;
    text-transform: uppercase;
    color: #fff;
    text-align: center;
    background: #64748b;
  }
  .badge.tier-component { background: #1d4ed8; }
  .badge.tier-role      { background: #047857; }
  .badge.tier-input     { background: #b45309; }
  .badge.tier-anchor    { background: #6d28d9; }
  .badge.tier-computed  { background: #be185d; }
  .badge.tier-const     { background: #475569; }
  .value {
    font-family: ui-monospace, monospace;
    font-size: 11.5px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .actions button {
    padding: 2px 8px;
    font-size: 11px;
    border: 1px solid #cbd5e1;
    background: #fff;
    border-radius: 4px;
    cursor: pointer;
  }
  .actions button:hover {
    background: #f1f5f9;
  }
  .empty {
    color: #94a3b8;
    font-style: italic;
    margin: 0;
  }
</style>

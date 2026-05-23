<!--
  Harness host — the shell that mounts a scenario component and
  renders the state + log inspector panels alongside.

  Layout:

    ┌──────────┬──────────────────────────┬──────────────────────────┐
    │ picker   │  component under test    │  STATE                   │
    │          │                          │                          │
    │          │                          │                          │
    │          │                          ├──────────────────────────┤
    │          │                          │  LOG (newest at bottom)  │
    │          │                          │                          │
    └──────────┴──────────────────────────┴──────────────────────────┘
       180px            1fr                          340px

  Picker on the left lets a human switch scenarios quickly. URL hash
  drives the active scenario for deep-linking and puppeteer routing
  (e.g. `harness.html#toggle`). State + log panes are stacked on the
  right; both reactive to the shared harness store.

  Aesthetic: editorial tool. Warm-paper background, ink type, mono
  for state JSON + log timestamps. Pulls inspiration from the
  rgc-design idiom without copying its colors.
-->
<script lang="ts">
  import { onMount } from "svelte";
  import { harnessState, harnessLog, reset, wireGlobal } from "./harness-store.svelte";
  import { groupedScenarios, findScenario, SCENARIOS } from "./scenarios/_index";

  // Load v2 design tokens so any v2 primitive mounted in the stage
  // picks up the cascade (the stage frame has data-tv-v2 below).
  import "../../src/components/primitives/v2/tokens.css";

  let activeName: string = $state("");

  function syncFromHash() {
    const h = window.location.hash.replace(/^#/, "");
    activeName = findScenario(h)?.name ?? SCENARIOS[0].name;
  }

  function pickScenario(name: string) {
    if (name === activeName) return;
    reset();
    window.location.hash = name;
    activeName = name;
  }

  onMount(() => {
    syncFromHash();
    wireGlobal(pickScenario);
    window.addEventListener("hashchange", syncFromHash);
    return () => window.removeEventListener("hashchange", syncFromHash);
  });

  const active = $derived(findScenario(activeName));
  const groups = $derived(groupedScenarios());
</script>

<div class="harness-shell">
  <!-- Left rail: scenario picker -->
  <aside class="picker">
    <div class="brand">
      <span class="brand-mark">▦</span>
      <span class="brand-text">
        <span class="brand-name">tabviz</span>
        <span class="brand-sub">component harness</span>
      </span>
    </div>
    {#each groups as g (g.group)}
      <div class="picker-group-h">{g.group}</div>
      <div class="picker-list">
        {#each g.scenarios as s (s.name)}
          <button
            class="picker-item"
            class:active={s.name === activeName}
            onclick={() => pickScenario(s.name)}
            title={s.description}
          >
            <span class="picker-dot"></span>
            <span class="picker-name">{s.name}</span>
          </button>
        {/each}
      </div>
    {/each}
  </aside>

  <!-- Center: component under test -->
  <main class="stage">
    {#if active}
      <header class="stage-h">
        <span class="stage-flag">scenario</span>
        <span class="stage-name">{active.name}</span>
        <span class="stage-desc">{active.description}</span>
      </header>
      <div class="stage-frame" data-tv-v2>
        {#key activeName}
          <active.component />
        {/key}
      </div>
    {/if}
  </main>

  <!-- Right: state + log inspector -->
  <aside class="inspect">
    <div class="inspect-pane state-pane">
      <div class="inspect-h">
        <span class="inspect-flag">state</span>
        <button class="inspect-btn" onclick={reset} title="Clear state + log">⟲ reset</button>
      </div>
      <pre class="inspect-body" data-testid="harness-state">{JSON.stringify(harnessState, null, 2) || "{}"}</pre>
    </div>
    <div class="inspect-pane log-pane">
      <div class="inspect-h">
        <span class="inspect-flag">log <span class="inspect-count">{harnessLog.length}</span></span>
      </div>
      <div class="inspect-body log-body" data-testid="harness-log">
        {#each harnessLog as entry, i (i)}
          <div class="log-row">
            <span class="log-t">{String(entry.t).padStart(5, " ")}</span>
            <span class="log-kind">{entry.kind}</span>
            <span class="log-path">{entry.path}</span>
            <span class="log-arrow">→</span>
            <span class="log-after">{JSON.stringify(entry.after)}</span>
          </div>
        {/each}
        {#if harnessLog.length === 0}
          <div class="log-empty">no events yet — interact with the component above</div>
        {/if}
      </div>
    </div>
  </aside>
</div>

<style>
  :global(:root) {
    --h-bg: #ece8df;
    --h-panel: #f6f3eb;
    --h-panel-2: #ffffff;
    --h-line: #d6d2c6;
    --h-line-soft: #e6e2d6;
    --h-ink: #1c1a14;
    --h-muted: #7a7466;
    --h-accent: #1c1a14;
    --h-hot: #b53a1f;
    --h-mono: "IBM Plex Mono", "JetBrains Mono", ui-monospace, SFMono-Regular, monospace;
  }
  :global(html), :global(body), :global(#app) { height: 100%; margin: 0; }
  :global(body) {
    background: var(--h-bg);
    color: var(--h-ink);
    font: 13px/1.45 "IBM Plex Sans", "Inter", "Helvetica Neue", system-ui, sans-serif;
    -webkit-font-smoothing: antialiased;
  }

  .harness-shell {
    display: grid;
    grid-template-columns: 180px 1fr 340px;
    height: 100vh;
    overflow: hidden;
  }

  /* ── Picker ─────────────────────────────────────────────────────── */
  .picker {
    background: var(--h-panel);
    border-right: 1px solid var(--h-line);
    overflow-y: auto;
    padding-bottom: 24px;
  }
  .brand {
    display: flex; align-items: center; gap: 10px;
    padding: 12px 14px;
    border-bottom: 1px solid var(--h-line);
  }
  .brand-mark {
    width: 24px; height: 24px; border-radius: 4px;
    background: var(--h-ink); color: var(--h-bg);
    display: grid; place-items: center;
    font-size: 14px;
  }
  .brand-text { display: flex; flex-direction: column; line-height: 1.1; }
  .brand-name { font-weight: 600; font-size: 13px; letter-spacing: -0.005em; }
  .brand-sub { font-size: 9px; color: var(--h-muted); text-transform: uppercase; letter-spacing: 0.14em; margin-top: 1px; }

  .picker-group-h {
    padding: 14px 14px 4px;
    text-transform: uppercase;
    letter-spacing: 0.16em;
    color: var(--h-muted);
    font-size: 9.5px;
  }
  .picker-list {
    display: flex; flex-direction: column;
    padding: 0 6px;
  }
  .picker-item {
    display: flex; align-items: center; gap: 8px;
    background: transparent; border: 0;
    padding: 5px 8px;
    border-radius: 4px;
    cursor: pointer;
    text-align: left;
    color: var(--h-ink);
    font: inherit;
    transition: background 80ms;
    font-family: var(--h-mono);
    font-size: 11px;
  }
  .picker-item:hover { background: var(--h-panel-2); }
  .picker-item.active {
    background: var(--h-ink);
    color: var(--h-bg);
  }
  .picker-dot {
    width: 4px; height: 4px; border-radius: 50%;
    background: var(--h-muted);
    flex: none;
  }
  .picker-item.active .picker-dot { background: var(--h-hot); }

  /* ── Stage ──────────────────────────────────────────────────────── */
  .stage {
    display: flex; flex-direction: column;
    min-width: 0;
    background:
      radial-gradient(rgba(0,0,0,0.04) 1px, transparent 1px);
    background-size: 18px 18px;
    background-color: var(--h-bg);
  }
  .stage-h {
    display: flex; align-items: baseline; gap: 10px;
    padding: 12px 18px;
    border-bottom: 1px solid var(--h-line);
    background: var(--h-panel);
  }
  .stage-flag {
    font-family: var(--h-mono);
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.14em;
    color: var(--h-muted);
  }
  .stage-name {
    font-size: 14px;
    font-weight: 600;
    letter-spacing: -0.005em;
  }
  .stage-desc {
    font-size: 11.5px;
    color: var(--h-muted);
    margin-left: 4px;
  }
  .stage-frame {
    flex: 1;
    overflow: auto;
    padding: 36px 36px 80px;
    display: flex;
    align-items: flex-start;
    justify-content: center;
  }

  /* ── Inspect ────────────────────────────────────────────────────── */
  .inspect {
    display: flex; flex-direction: column;
    background: var(--h-panel);
    border-left: 1px solid var(--h-line);
    min-width: 0;
  }
  .inspect-pane {
    display: flex; flex-direction: column;
    min-height: 0;
    border-bottom: 1px solid var(--h-line);
  }
  .state-pane { flex: 1 1 50%; }
  .log-pane   { flex: 1 1 50%; border-bottom: 0; }

  .inspect-h {
    display: flex; align-items: center; justify-content: space-between;
    padding: 10px 14px 6px;
  }
  .inspect-flag {
    font-family: var(--h-mono);
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.14em;
    color: var(--h-muted);
  }
  .inspect-count {
    margin-left: 6px;
    color: var(--h-ink);
    background: var(--h-panel-2);
    border: 1px solid var(--h-line);
    border-radius: 4px;
    padding: 0 5px;
    font-size: 9.5px;
  }
  .inspect-btn {
    background: transparent;
    border: 1px solid var(--h-line);
    border-radius: 4px;
    padding: 2px 7px;
    font: inherit;
    font-family: var(--h-mono);
    font-size: 10px;
    color: var(--h-muted);
    cursor: pointer;
    transition: background 80ms, color 80ms;
  }
  .inspect-btn:hover {
    background: var(--h-panel-2);
    color: var(--h-ink);
  }

  .inspect-body {
    flex: 1;
    overflow: auto;
    margin: 0;
    padding: 4px 14px 14px;
    font: 10.5px/1.5 var(--h-mono);
    color: var(--h-ink);
    background: transparent;
    white-space: pre-wrap;
  }
  .log-body { padding-top: 0; }
  .log-row {
    display: grid;
    grid-template-columns: 44px 56px 1fr auto auto;
    gap: 4px;
    padding: 2px 0;
    border-top: 1px solid var(--h-line-soft);
  }
  .log-row:first-child { border-top: 0; }
  .log-t {
    color: var(--h-muted);
    text-align: right;
    font-variant-numeric: tabular-nums;
  }
  .log-kind {
    color: var(--h-hot);
    text-transform: uppercase;
    font-size: 9.5px;
    letter-spacing: 0.1em;
    align-self: center;
  }
  .log-path { color: var(--h-ink); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .log-arrow { color: var(--h-muted); }
  .log-after { color: var(--h-ink); }
  .log-empty {
    color: var(--h-muted);
    font-style: italic;
    padding: 8px 0;
    text-align: center;
  }
</style>

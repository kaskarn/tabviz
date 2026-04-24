<script lang="ts">
  import type { ForestStore } from "$stores/forestStore.svelte";

  interface Props {
    store: ForestStore;
  }

  let { store }: Props = $props();

  let open = $state(false);
  let btnEl: HTMLButtonElement | null = $state(null);
  let popoverEl: HTMLDivElement | null = $state(null);

  // Paint tool state lives in the store so row-level pointerdown handlers
  // in ForestPlot can read it without prop drilling. The button UI here
  // just drives the state via setPaintTool() and renders the current pick.
  const tool = $derived(store.paintTool);
  const active = $derived(tool !== null);

  const tokens: Array<{ id: "emphasis" | "muted" | "accent"; label: string }> = [
    { id: "emphasis", label: "Emphasis" },
    { id: "muted",    label: "Muted"    },
    { id: "accent",   label: "Accent"   },
  ];

  function pickToken(token: "emphasis" | "muted" | "accent") {
    const scope = tool?.scope ?? "row";
    // Re-clicking the active chip exits paint mode — matches dblclick-to-
    // toggle conventions elsewhere and gives Escape a visible counterpart.
    if (tool && tool.token === token && tool.scope === scope) {
      store.setPaintTool(null);
      return;
    }
    store.setPaintTool({ token, scope });
  }

  function pickScope(scope: "row" | "cell") {
    if (!tool) return;
    store.setPaintTool({ token: tool.token, scope });
  }

  function clearAll() {
    store.clearAllPaint();
    open = false;
  }

  function toggle() {
    open = !open;
  }

  function onWindowPointerDown(e: PointerEvent) {
    if (!open) return;
    const t = e.target as Node | null;
    if (!t) return;
    if (btnEl && btnEl.contains(t)) return;
    if (popoverEl && popoverEl.contains(t)) return;
    open = false;
  }

  function onKeydown(e: KeyboardEvent) {
    if (e.key === "Escape") {
      if (open) { open = false; return; }
      if (active) store.setPaintTool(null);
    }
  }

  const tooltip = $derived(
    active
      ? `Painting ${tool!.scope}s as ${tool!.token}`
      : "Paint rows/cells as emphasis / muted / accent",
  );
</script>

<svelte:window onpointerdown={onWindowPointerDown} onkeydown={onKeydown} />

<div class="paint-wrapper">
  <button
    bind:this={btnEl}
    type="button"
    class="paint-btn"
    class:active
    aria-label="Paint semantic class"
    aria-expanded={open}
    data-tooltip={tooltip}
    onclick={toggle}
  >
    <!-- Paint brush icon — stroke-only so color-mix inherits via currentColor. -->
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <path d="M18 3l3 3-10 10-3.5.5.5-3.5 10-10z" />
      <path d="M14 7l3 3" />
      <path d="M8 14l-4.5 7.5" />
    </svg>
  </button>

  {#if open}
    <div
      bind:this={popoverEl}
      class="paint-popover"
      role="dialog"
      aria-label="Paint tool"
    >
      <div class="section">
        <span class="section-title">Token</span>
        <div class="chips">
          {#each tokens as t (t.id)}
            <button
              type="button"
              class="chip chip-{t.id}"
              class:selected={tool?.token === t.id}
              onclick={() => pickToken(t.id)}
            >{t.label}</button>
          {/each}
        </div>
      </div>

      {#if active}
        <div class="section">
          <span class="section-title">Scope</span>
          <div class="segmented">
            <button
              type="button"
              class:selected={tool!.scope === "row"}
              onclick={() => pickScope("row")}
            >Row</button>
            <button
              type="button"
              class:selected={tool!.scope === "cell"}
              onclick={() => pickScope("cell")}
            >Cell</button>
          </div>
        </div>
      {/if}

      <div class="section footer-section">
        {#if store.hasPaintEdits}
          <button type="button" class="ghost-btn" onclick={clearAll}>
            Clear paint
          </button>
        {/if}
        {#if active}
          <button type="button" class="ghost-btn" onclick={() => store.setPaintTool(null)}>
            Exit paint mode
          </button>
        {/if}
      </div>

      <p class="hint">
        {#if active}
          Click a {tool!.scope} to toggle its {tool!.token} flag.
          Press Esc to exit.
        {:else}
          Pick a token, then click rows or cells to stamp it on.
        {/if}
      </p>
    </div>
  {/if}
</div>

<style>
  .paint-wrapper {
    position: relative;
    display: inline-flex;
  }

  .paint-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 22px;
    height: 22px;
    padding: 0;
    border: 1px solid color-mix(in srgb, var(--wf-primary, #2563eb) 18%, var(--wf-border, #e2e8f0));
    border-radius: 6px;
    background: var(--wf-bg, #ffffff);
    color: var(--wf-secondary, #64748b);
    cursor: pointer;
    transition: background-color 0.15s ease, color 0.15s ease, border-color 0.15s ease;
  }

  .paint-btn:hover,
  .paint-btn:focus-visible {
    color: var(--wf-primary, #2563eb);
    outline: none;
  }

  .paint-btn.active {
    background: color-mix(in srgb, var(--wf-primary, #2563eb) 85%, transparent);
    color: var(--wf-bg, #ffffff);
    border-color: var(--wf-primary, #2563eb);
  }

  .paint-popover {
    position: absolute;
    top: calc(100% + 6px);
    right: 0;
    z-index: 10002;
    min-width: 200px;
    padding: 10px;
    background: var(--wf-bg, #ffffff);
    border: 1px solid color-mix(in srgb, var(--wf-primary, #2563eb) 15%, var(--wf-border, #e2e8f0));
    border-radius: 8px;
    box-shadow: 0 8px 24px -4px color-mix(in srgb, #0f172a 25%, transparent);
    display: flex;
    flex-direction: column;
    gap: 10px;
    font-size: 0.75rem;
    color: var(--wf-fg, #1a1a1a);
  }

  .section {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .footer-section {
    flex-direction: row;
    flex-wrap: wrap;
    gap: 4px;
  }

  .section-title {
    font-size: 0.65rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: var(--wf-secondary, #64748b);
  }

  .chips {
    display: flex;
    gap: 4px;
    flex-wrap: wrap;
  }

  .chip {
    padding: 3px 8px;
    border: 1px solid color-mix(in srgb, var(--wf-primary, #2563eb) 15%, var(--wf-border, #e2e8f0));
    border-radius: 999px;
    background: var(--wf-bg, #ffffff);
    color: var(--wf-fg, #1a1a1a);
    font-size: 0.7rem;
    font-weight: 500;
    cursor: pointer;
    transition: background-color 0.15s ease, color 0.15s ease, border-color 0.15s ease;
  }

  .chip:hover:not(.selected) {
    background: color-mix(in srgb, var(--wf-primary, #2563eb) 8%, transparent);
  }

  .chip.selected {
    background: color-mix(in srgb, var(--wf-primary, #2563eb) 90%, transparent);
    border-color: var(--wf-primary, #2563eb);
    color: var(--wf-bg, #ffffff);
  }

  .segmented {
    display: inline-flex;
    border: 1px solid color-mix(in srgb, var(--wf-primary, #2563eb) 15%, var(--wf-border, #e2e8f0));
    border-radius: 6px;
    overflow: hidden;
  }

  .segmented button {
    padding: 3px 10px;
    border: none;
    background: transparent;
    color: var(--wf-fg, #1a1a1a);
    font-size: 0.7rem;
    font-weight: 500;
    cursor: pointer;
  }

  .segmented button + button {
    border-left: 1px solid color-mix(in srgb, var(--wf-primary, #2563eb) 10%, var(--wf-border, #e2e8f0));
  }

  .segmented button.selected {
    background: color-mix(in srgb, var(--wf-primary, #2563eb) 90%, transparent);
    color: var(--wf-bg, #ffffff);
  }

  .ghost-btn {
    padding: 3px 8px;
    border: 1px solid color-mix(in srgb, var(--wf-border, #e2e8f0) 80%, transparent);
    border-radius: 6px;
    background: transparent;
    color: var(--wf-secondary, #64748b);
    font-size: 0.7rem;
    cursor: pointer;
    transition: background-color 0.15s ease, color 0.15s ease;
  }

  .ghost-btn:hover {
    background: color-mix(in srgb, var(--wf-primary, #2563eb) 8%, transparent);
    color: var(--wf-fg, #1a1a1a);
  }

  .hint {
    margin: 0;
    font-size: 0.65rem;
    line-height: 1.35;
    color: var(--wf-secondary, #64748b);
  }
</style>

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
      class:is-active={active}
      role="dialog"
      aria-label="Paint tool"
    >
      {#if active}
        <!-- Loud exit — top of the popover, accent color, X icon. Beta
             feedback: users struggled to find their way out of paint
             mode. Make the exit unmistakable even on a first glance. -->
        <button
          type="button"
          class="exit-btn"
          onclick={() => store.setPaintTool(null)}
          title="Stop painting (Esc)"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
          Exit paint mode
        </button>
      {/if}

      <!-- Token row: three chips are self-describing, no "Token" label
           needed — makes the popover less cluttered. Chips are full-width
           in the row so tap targets stay generous. -->
      <div class="row row-tokens" role="radiogroup" aria-label="Paint token">
        <div class="chips">
          {#each tokens as t (t.id)}
            <button
              type="button"
              class="chip chip-{t.id}"
              class:selected={tool?.token === t.id}
              onclick={() => pickToken(t.id)}
              role="radio"
              aria-checked={tool?.token === t.id}
            >{t.label}</button>
          {/each}
        </div>
      </div>

      {#if active}
        <!-- Scope as a two-state pill switch. Clicking either side selects
             it; the thumb slides to the active side. Replaces the earlier
             segmented-buttons UI which felt visually indistinct from the
             token chips above. -->
        <div class="row row-scope">
          <span class="row-label">Scope</span>
          <button
            type="button"
            class="scope-switch"
            class:on-cell={tool!.scope === "cell"}
            onclick={() => pickScope(tool!.scope === "row" ? "cell" : "row")}
            role="switch"
            aria-checked={tool!.scope === "cell"}
            aria-label={`Scope: ${tool!.scope}`}
          >
            <span class="scope-label" class:active={tool!.scope === "row"}>Row</span>
            <span class="scope-label" class:active={tool!.scope === "cell"}>Cell</span>
            <span class="scope-thumb"></span>
          </button>
        </div>
      {/if}

      {#if store.hasPaintEdits}
        <button type="button" class="clear-btn" onclick={clearAll}>
          Clear all paint
        </button>
      {/if}

      <p class="hint">
        {#if active}
          Click a {tool!.scope} to toggle its {tool!.token} flag.
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

  /*
   * Active paint mode: use the accent palette slot (not primary) at
   * full saturation with forced-white text and a soft glow. Makes
   * "tool is on" visually louder than the ambient primary-tinted chrome
   * so users can spot the exit target without hunting.
   */
  .paint-btn.active {
    background: var(--wf-accent, #8b5cf6);
    color: #ffffff;
    border-color: var(--wf-accent, #8b5cf6);
    box-shadow: 0 0 0 2px color-mix(in srgb, var(--wf-accent, #8b5cf6) 30%, transparent);
  }

  .paint-btn.active:hover {
    background: color-mix(in srgb, var(--wf-accent, #8b5cf6) 88%, #000000);
  }

  .paint-popover {
    position: absolute;
    top: calc(100% + 6px);
    right: 0;
    z-index: 10002;
    min-width: 200px;
    padding: 8px;
    background: var(--wf-bg, #ffffff);
    border: 1px solid color-mix(in srgb, var(--wf-primary, #2563eb) 15%, var(--wf-border, #e2e8f0));
    border-radius: 8px;
    box-shadow: 0 8px 24px -4px color-mix(in srgb, #0f172a 25%, transparent);
    display: flex;
    flex-direction: column;
    gap: 6px;
    font-size: 0.75rem;
    color: var(--wf-fg, #1a1a1a);
  }

  /* Inline `Token / Scope` rows — label + control on one line, same
     idiom as the advanced-settings compact fields. Tighter than the
     previous stacked layout. */
  .row {
    display: grid;
    grid-template-columns: 48px 1fr;
    align-items: center;
    gap: 8px;
    padding: 1px 0;
  }

  .row-label {
    font-size: 0.65rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: var(--wf-secondary, #64748b);
  }

  /* Loud exit — accent-outlined with X icon, top of the popover. Uses
     the theme's accent color for BOTH the border and the text, with a
     subtle accent-tinted bg, so it stays readable across every shipped
     theme (the old hardcoded `color: #ffffff` vanished against white
     backgrounds on themes where the accent tint resolved lightly). */
  .exit-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 5px;
    padding: 5px 10px;
    border: 1.5px solid var(--wf-accent, #8b5cf6);
    border-radius: 6px;
    background: color-mix(in srgb, var(--wf-accent, #8b5cf6) 12%, transparent);
    color: var(--wf-accent, #8b5cf6);
    font-size: 0.72rem;
    font-weight: 600;
    letter-spacing: 0.01em;
    cursor: pointer;
    transition: background-color 0.15s ease, transform 0.1s ease;
  }

  .exit-btn:hover {
    background: color-mix(in srgb, var(--wf-accent, #8b5cf6) 22%, transparent);
  }

  .exit-btn:active {
    transform: translateY(1px);
  }

  .exit-btn:focus-visible {
    outline: 2px solid color-mix(in srgb, var(--wf-accent, #8b5cf6) 40%, transparent);
    outline-offset: 2px;
  }

  .chips {
    display: flex;
    gap: 3px;
    flex-wrap: wrap;
  }

  .chip {
    padding: 2px 8px;
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
    background: color-mix(in srgb, var(--wf-primary, #2563eb) 18%, var(--wf-bg, #ffffff));
    border-color: var(--wf-primary, #2563eb);
    color: var(--wf-primary, #2563eb);
    font-weight: 600;
  }

  /* Row/Cell switch — a pill with two labels and a sliding thumb. Users
     see both options at once; clicking either side flips the thumb to
     that side. Clearer than the old segmented-buttons that blended in
     with the token chips above them. */
  .scope-switch {
    position: relative;
    display: inline-grid;
    grid-template-columns: 1fr 1fr;
    padding: 0;
    width: 96px;
    height: 22px;
    border: 1px solid color-mix(in srgb, var(--wf-primary, #2563eb) 15%, var(--wf-border, #e2e8f0));
    border-radius: 999px;
    background: color-mix(in srgb, var(--wf-primary, #2563eb) 6%, transparent);
    cursor: pointer;
    overflow: hidden;
    font-family: inherit;
  }

  .scope-thumb {
    position: absolute;
    top: 1px;
    left: 1px;
    width: calc(50% - 1px);
    height: calc(100% - 2px);
    background: color-mix(in srgb, var(--wf-primary, #2563eb) 90%, transparent);
    border-radius: 999px;
    transition: transform 0.18s cubic-bezier(0.2, 0.8, 0.2, 1);
    z-index: 0;
  }

  .scope-switch.on-cell .scope-thumb {
    transform: translateX(100%);
  }

  .scope-label {
    position: relative;
    z-index: 1;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    font-size: 0.7rem;
    font-weight: 500;
    color: var(--wf-secondary, #64748b);
    transition: color 0.18s ease;
    user-select: none;
  }

  .scope-label.active {
    color: var(--wf-bg, #ffffff);
    font-weight: 600;
  }

  .scope-switch:focus-visible {
    outline: 2px solid color-mix(in srgb, var(--wf-primary, #2563eb) 40%, transparent);
    outline-offset: 2px;
  }

  .clear-btn {
    align-self: stretch;
    padding: 3px 8px;
    border: 1px solid color-mix(in srgb, var(--wf-border, #e2e8f0) 80%, transparent);
    border-radius: 6px;
    background: transparent;
    color: var(--wf-secondary, #64748b);
    font-size: 0.7rem;
    cursor: pointer;
    transition: background-color 0.15s ease, color 0.15s ease;
  }

  .clear-btn:hover {
    background: color-mix(in srgb, var(--wf-accent, #8b5cf6) 8%, transparent);
    color: var(--wf-fg, #1a1a1a);
  }

  .hint {
    margin: 2px 0 0;
    font-size: 0.64rem;
    line-height: 1.3;
    color: var(--wf-secondary, #64748b);
  }
</style>

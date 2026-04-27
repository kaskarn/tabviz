<script lang="ts">
  // Always-visible token + scope picker for the unified painter.
  //
  // The painter is always-on: every row click applies the active token
  // (via store.paintRowWithActiveToken / paintCellWithActiveToken), and
  // every row hover shows a translucent preview of the would-be commit.
  //
  // UI: a single 22px icon button trigger, click opens a popover with
  // the 4-token grid and Row/Cell scope toggle. Trigger shows a paint
  // icon overlaid with the active token's swatch so users can read the
  // current state without expanding.
  import type { ForestStore } from "$stores/forestStore.svelte";
  import { autoPosition } from "$lib/dropdown-position";
  import Portal from "$lib/Portal.svelte";

  interface Props {
    store: ForestStore;
  }
  let { store }: Props = $props();

  type Token = "muted" | "bold" | "accent" | "fill";
  const TOKENS: Array<{ id: Token; label: string; tip: string }> = [
    { id: "muted",  label: "Mute",   tip: "Reduced prominence (translucent)" },
    { id: "bold",   label: "Bold",   tip: "Just a weight bump — no color change" },
    { id: "accent", label: "Accent", tip: "Bold + accent color (default)" },
    { id: "fill",   label: "Fill",   tip: "Bold + pastel row tint" },
  ];

  const tool = $derived(store.paintTool);
  const activeToken = $derived(tool.token as Token);
  const activeScope = $derived(tool.scope);
  const activeMeta  = $derived(TOKENS.find((t) => t.id === activeToken) ?? TOKENS[2]);

  const theme = $derived(store.spec?.theme);
  function swatchFor(token: Token): string {
    const bundle = (theme?.row as unknown as Record<string, { bg?: string | null; fg?: string | null; markerFill?: string | null }> | undefined)?.[token];
    return bundle?.bg ?? bundle?.fg ?? bundle?.markerFill ?? theme?.accent?.default ?? "#8B5CF6";
  }

  let menuOpen = $state(false);
  let triggerEl: HTMLButtonElement | null = $state(null);
  let popoverEl: HTMLDivElement | null = $state(null);

  function pickToken(t: Token) {
    store.setPaintTool({ token: t, scope: activeScope });
  }
  function pickScope(scope: "row" | "cell") {
    store.setPaintTool({ token: activeToken, scope });
  }
  function toggleMenu() {
    menuOpen = !menuOpen;
  }
  function onWindowPointerDown(e: PointerEvent) {
    if (!menuOpen) return;
    const t = e.target as Node | null;
    if (!t) return;
    if (triggerEl && triggerEl.contains(t)) return;
    if (popoverEl && popoverEl.contains(t)) return;
    menuOpen = false;
  }
  function onKeydown(e: KeyboardEvent) {
    if (e.key === "Escape" && menuOpen) {
      e.preventDefault();
      menuOpen = false;
    }
  }
</script>

<svelte:window onpointerdown={onWindowPointerDown} onkeydown={onKeydown} />

<div class="token-picker">
  <!-- Single icon-button trigger. Paint-brush icon overlaid with the
       active token's swatch in the lower-right so the user can read the
       current paint state without opening the popover. -->
  <button
    bind:this={triggerEl}
    type="button"
    class="trigger"
    class:open={menuOpen}
    onclick={toggleMenu}
    aria-haspopup="dialog"
    aria-expanded={menuOpen}
    data-tooltip={`Paint: ${activeMeta.label} (${activeScope})`}
    aria-label={`Paint tool: ${activeMeta.label}, scope ${activeScope}`}
  >
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <path d="M19.5 3.5L21 5l-9 9-3-3 9-9z"/>
      <path d="M9 11l-4 4a3 3 0 0 0 0 4 3 3 0 0 0 4 0l4-4"/>
      <path d="M3 21l3-1"/>
    </svg>
    <span class="active-dot" style:background={swatchFor(activeToken)}></span>
  </button>

  {#if menuOpen}
    <Portal>
      <div bind:this={popoverEl} class="popover" role="dialog" aria-label="Paint tool" use:autoPosition={{ triggerEl: triggerEl as HTMLElement | null }}>
        <div class="section-label">Token</div>
        <div class="token-grid" role="listbox" aria-label="Paint token">
          {#each TOKENS as t (t.id)}
            <button
              type="button"
              role="option"
              aria-selected={activeToken === t.id}
              class="token-cell"
              class:selected={activeToken === t.id}
              onclick={() => pickToken(t.id)}
              title={t.tip}
            >
              <span class="dot" style:background={swatchFor(t.id)}></span>
              <span class="label">{t.label}</span>
            </button>
          {/each}
        </div>

        <div class="section-label scope-label-row">Apply to</div>
        <button
          type="button"
          class="scope-switch"
          class:on-cell={activeScope === "cell"}
          onclick={() => pickScope(activeScope === "row" ? "cell" : "row")}
          role="switch"
          aria-checked={activeScope === "cell"}
          aria-label={`Scope: ${activeScope}`}
        >
          <span class="scope-text" class:active={activeScope === "row"}>Row</span>
          <span class="scope-text" class:active={activeScope === "cell"}>Cell</span>
          <span class="scope-thumb"></span>
        </button>
      </div>
    </Portal>
  {/if}
</div>

<style>
  .token-picker {
    display: inline-flex;
    align-items: center;
    position: relative;
  }

  /* 22px icon-button trigger — matches sibling toolbar buttons. The
     toolbar's global rule strips border + background so the trigger
     blends into the floating glass pill; only the muted icon color
     and active-token swatch dot remain. */
  .trigger {
    position: relative;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 22px;
    height: 22px;
    padding: 0;
    border: 1px solid var(--tv-border, #e2e8f0);
    border-radius: 6px;
    background: var(--tv-bg, #ffffff);
    color: var(--tv-secondary, #64748b);
    cursor: pointer;
    transition: background-color 0.15s ease, color 0.15s ease;
  }
  .trigger:hover {
    background: var(--tv-border, #e2e8f0);
    color: var(--tv-fg, #1a1a1a);
  }
  .trigger:focus-visible {
    outline: none;
  }
  .trigger svg {
    flex-shrink: 0;
  }
  .active-dot {
    position: absolute;
    bottom: 1px;
    right: 1px;
    width: 7px;
    height: 7px;
    border-radius: 999px;
    border: 1px solid var(--tv-bg, #ffffff);
    box-shadow: 0 0 0 0.5px color-mix(in srgb, var(--tv-fg, #1a1a1a) 30%, transparent);
  }

  /* Popover — Portal-rendered to escape the .tabviz-container's
     overflow:hidden clip. autoPosition sets position:fixed dynamically
     using the trigger's viewport rect. */
  .popover {
    /* position: fixed set dynamically by autoPosition */
    z-index: 10003;
    width: 220px;
    padding: 8px;
    background: var(--tv-bg, #ffffff);
    border: 1px solid color-mix(in srgb, var(--tv-brand, var(--tv-primary, #2563eb)) 18%, var(--tv-border, #e2e8f0));
    border-radius: 8px;
    box-shadow: 0 8px 24px -4px color-mix(in srgb, #0f172a 25%, transparent);
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .section-label {
    font-size: 0.62rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: var(--tv-secondary, #64748b);
    padding: 0 2px;
  }
  .scope-label-row {
    margin-top: 2px;
  }

  .token-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 2px;
  }
  .token-cell {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 5px 6px;
    border: 1px solid transparent;
    border-radius: 5px;
    background: transparent;
    color: var(--tv-fg, #1a1a1a);
    font-size: 0.7rem;
    font-weight: 500;
    text-align: left;
    cursor: pointer;
    transition: background-color 0.1s ease, border-color 0.1s ease;
  }
  .token-cell:hover {
    background: color-mix(in srgb, var(--tv-brand, var(--tv-primary, #2563eb)) 8%, transparent);
  }
  .token-cell.selected {
    background: color-mix(in srgb, var(--tv-brand, var(--tv-primary, #2563eb)) 14%, var(--tv-bg, #ffffff));
    border-color: color-mix(in srgb, var(--tv-brand, var(--tv-primary, #2563eb)) 35%, transparent);
    color: var(--tv-brand, var(--tv-primary, #2563eb));
    font-weight: 600;
  }
  .dot {
    flex: 0 0 auto;
    width: 10px;
    height: 10px;
    border-radius: 999px;
    border: 1px solid color-mix(in srgb, var(--tv-fg, #1a1a1a) 25%, transparent);
  }
  .label {
    line-height: 1;
  }

  /* Row/Cell scope pill */
  .scope-switch {
    position: relative;
    display: inline-grid;
    grid-template-columns: 1fr 1fr;
    padding: 0;
    width: 100%;
    height: 24px;
    border: 1px solid color-mix(in srgb, var(--tv-brand, var(--tv-primary, #2563eb)) 15%, var(--tv-border, #e2e8f0));
    border-radius: 999px;
    background: color-mix(in srgb, var(--tv-brand, var(--tv-primary, #2563eb)) 6%, transparent);
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
    background: color-mix(in srgb, var(--tv-brand, var(--tv-primary, #2563eb)) 90%, transparent);
    border-radius: 999px;
    transition: transform 0.18s cubic-bezier(0.2, 0.8, 0.2, 1);
    z-index: 0;
  }
  .scope-switch.on-cell .scope-thumb {
    transform: translateX(100%);
  }
  .scope-text {
    position: relative;
    z-index: 1;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    font-size: 0.68rem;
    font-weight: 500;
    color: var(--tv-secondary, #64748b);
    transition: color 0.18s ease;
    user-select: none;
  }
  .scope-text.active {
    color: var(--tv-bg, #ffffff);
    font-weight: 600;
  }
  .scope-switch:focus-visible {
    outline: 2px solid color-mix(in srgb, var(--tv-brand, var(--tv-primary, #2563eb)) 40%, transparent);
    outline-offset: 2px;
  }
</style>

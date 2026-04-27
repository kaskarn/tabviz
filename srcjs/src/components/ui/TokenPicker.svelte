<script lang="ts">
  // Always-visible token + scope picker for the unified painter.
  //
  // Replaces the toggleable PaintModeButton. The painter is always-on:
  // every row click applies the active token (via store.paintRowWith
  // ActiveToken / paintCellWithActiveToken), and every row hover shows
  // a translucent preview of the would-be commit.
  //
  // UI: a chip showing the active token with a colored swatch, plus a
  // small Row/Cell pill toggle. Clicking the chip opens a 5-token
  // dropdown. No "exit paint" affordance — there's nothing to exit;
  // the picker is the live state.
  import type { ForestStore } from "$stores/forestStore.svelte";

  interface Props {
    store: ForestStore;
  }
  let { store }: Props = $props();

  type Token = "muted" | "bold" | "accent" | "highlight" | "fill";
  const TOKENS: Array<{ id: Token; label: string; tip: string }> = [
    { id: "muted",     label: "Mute",      tip: "Lighter, reduced prominence" },
    { id: "bold",      label: "Bold",      tip: "Just a weight bump — no color change" },
    { id: "accent",    label: "Accent",    tip: "Bold + accent color (default)" },
    { id: "highlight", label: "Highlight", tip: "Bold + pale highlighter background" },
    { id: "fill",      label: "Fill",      tip: "Bold + strong row fill" },
  ];

  // Active tool from store. Always set in the unified-painter model.
  const tool = $derived(store.paintTool);
  const activeToken = $derived(tool.token as Token);
  const activeScope = $derived(tool.scope);
  const activeMeta  = $derived(TOKENS.find((t) => t.id === activeToken) ?? TOKENS[2]);

  // Swatch color per token — small visual cue in the chip + dropdown.
  // Pulls from the resolved theme's row.{token}.bg or the active accent
  // when the bundle has no bg (bold has none — falls through to accent).
  const theme = $derived(store.spec?.theme);
  function swatchFor(token: Token): string {
    const bundle = (theme?.row as unknown as Record<string, { bg?: string | null; fg?: string | null; markerFill?: string | null }> | undefined)?.[token];
    return bundle?.bg ?? bundle?.fg ?? bundle?.markerFill ?? theme?.accent?.default ?? "#8B5CF6";
  }

  let menuOpen = $state(false);
  let chipEl: HTMLButtonElement | null = $state(null);
  let popoverEl: HTMLDivElement | null = $state(null);

  function pickToken(t: Token) {
    store.setPaintTool({ token: t, scope: activeScope });
    menuOpen = false;
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
    if (chipEl && chipEl.contains(t)) return;
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
  <!-- Active-token chip. Click to open the 5-token menu. The colored
       dot reflects the bundle's bg (or fg/markerFill fallback) so the
       user gets an at-a-glance preview of what painting will produce. -->
  <button
    bind:this={chipEl}
    type="button"
    class="chip"
    class:open={menuOpen}
    onclick={toggleMenu}
    aria-haspopup="listbox"
    aria-expanded={menuOpen}
    title={activeMeta.tip}
  >
    <span class="dot" style:background={swatchFor(activeToken)}></span>
    <span class="label">{activeMeta.label}</span>
    <svg class="chev" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <polyline points="6 9 12 15 18 9" />
    </svg>
  </button>

  <!-- Row/Cell scope pill. Click side to flip. Selected side = thumb. -->
  <button
    type="button"
    class="scope-switch"
    class:on-cell={activeScope === "cell"}
    onclick={() => pickScope(activeScope === "row" ? "cell" : "row")}
    role="switch"
    aria-checked={activeScope === "cell"}
    aria-label={`Scope: ${activeScope}`}
    title={`Click to apply to a whole ${activeScope === "row" ? "cell" : "row"}`}
  >
    <span class="scope-label" class:active={activeScope === "row"}>Row</span>
    <span class="scope-label" class:active={activeScope === "cell"}>Cell</span>
    <span class="scope-thumb"></span>
  </button>

  {#if menuOpen}
    <div bind:this={popoverEl} class="menu" role="listbox" aria-label="Paint token">
      {#each TOKENS as t (t.id)}
        <button
          type="button"
          role="option"
          aria-selected={activeToken === t.id}
          class="menu-item"
          class:selected={activeToken === t.id}
          onclick={() => pickToken(t.id)}
          title={t.tip}
        >
          <span class="dot" style:background={swatchFor(t.id)}></span>
          <span class="label">{t.label}</span>
          <span class="tip">{t.tip}</span>
        </button>
      {/each}
    </div>
  {/if}
</div>

<style>
  .token-picker {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    position: relative;
  }

  /* Active-token chip */
  .chip {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    padding: 0 8px;
    height: 22px;
    border: 1px solid color-mix(in srgb, var(--tv-primary, #2563eb) 18%, var(--tv-border, #e2e8f0));
    border-radius: 6px;
    background: var(--tv-bg, #ffffff);
    color: var(--tv-fg, #1a1a1a);
    font-size: 0.72rem;
    font-weight: 500;
    cursor: pointer;
    transition: background-color 0.12s ease, border-color 0.12s ease;
  }
  .chip:hover,
  .chip:focus-visible,
  .chip.open {
    border-color: var(--tv-primary, #2563eb);
    outline: none;
  }
  .dot {
    flex: 0 0 auto;
    width: 10px;
    height: 10px;
    border-radius: 999px;
    border: 1px solid color-mix(in srgb, var(--tv-fg, #1a1a1a) 25%, transparent);
  }
  .chip .label {
    line-height: 1;
  }
  .chev {
    color: var(--tv-secondary, #64748b);
    transition: transform 0.18s ease;
    flex-shrink: 0;
  }
  .chip.open .chev {
    transform: rotate(180deg);
  }

  /* Row/Cell scope pill — same shape as the historical paint popover. */
  .scope-switch {
    position: relative;
    display: inline-grid;
    grid-template-columns: 1fr 1fr;
    padding: 0;
    width: 78px;
    height: 22px;
    border: 1px solid color-mix(in srgb, var(--tv-primary, #2563eb) 15%, var(--tv-border, #e2e8f0));
    border-radius: 999px;
    background: color-mix(in srgb, var(--tv-primary, #2563eb) 6%, transparent);
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
    background: color-mix(in srgb, var(--tv-primary, #2563eb) 90%, transparent);
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
    font-size: 0.65rem;
    font-weight: 500;
    color: var(--tv-secondary, #64748b);
    transition: color 0.18s ease;
    user-select: none;
  }
  .scope-label.active {
    color: var(--tv-bg, #ffffff);
    font-weight: 600;
  }
  .scope-switch:focus-visible {
    outline: 2px solid color-mix(in srgb, var(--tv-primary, #2563eb) 40%, transparent);
    outline-offset: 2px;
  }

  /* Token menu (drops below the chip). */
  .menu {
    position: absolute;
    top: calc(100% + 4px);
    left: 0;
    z-index: 10003;
    min-width: 220px;
    padding: 4px;
    background: var(--tv-bg, #ffffff);
    border: 1px solid color-mix(in srgb, var(--tv-primary, #2563eb) 18%, var(--tv-border, #e2e8f0));
    border-radius: 8px;
    box-shadow: 0 8px 24px -4px color-mix(in srgb, #0f172a 25%, transparent);
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .menu-item {
    display: grid;
    grid-template-columns: auto auto 1fr;
    align-items: center;
    gap: 6px;
    width: 100%;
    padding: 5px 8px;
    border: none;
    border-radius: 4px;
    background: transparent;
    color: var(--tv-fg, #1a1a1a);
    font-size: 0.72rem;
    text-align: left;
    cursor: pointer;
    transition: background-color 0.1s ease;
  }
  .menu-item:hover {
    background: color-mix(in srgb, var(--tv-primary, #2563eb) 8%, transparent);
  }
  .menu-item.selected {
    background: color-mix(in srgb, var(--tv-primary, #2563eb) 14%, var(--tv-bg, #ffffff));
    color: var(--tv-primary, #2563eb);
    font-weight: 600;
  }
  .menu-item .label {
    font-weight: 500;
  }
  .menu-item.selected .label {
    font-weight: 600;
  }
  .menu-item .tip {
    color: var(--tv-secondary, #64748b);
    font-weight: 400;
    font-size: 0.65rem;
    text-align: right;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
</style>

<!--
  TabSelect — a small button-and-popover tab selector. Replaces the native
  <select> in SettingsPanel so the tab chooser matches the widget's visual
  language (themed surfaces, hover states, no OS dropdown chrome). The
  listbox is portaled to document.body to escape ancestor clipping.
-->
<script lang="ts">
  import Portal from "$lib/Portal.svelte";

  interface TabOption {
    id: string;
    label: string;
  }

  interface Props {
    options: TabOption[];
    value: string;
    onchange: (id: string) => void;
    /** Accessible label for the trigger when no visible label is provided. */
    ariaLabel?: string;
  }

  let { options, value, onchange, ariaLabel = "Select section" }: Props = $props();

  let open = $state(false);
  let triggerEl: HTMLButtonElement | null = $state(null);
  let popoverEl: HTMLDivElement | null = $state(null);

  const selected = $derived(options.find((o) => o.id === value) ?? options[0]);

  // Compute popover position from the trigger's bounding rect. Re-run on
  // every open so resize / scroll between opens doesn't leave a stale
  // anchor. Inside the popover we use viewport-relative fixed positioning.
  let popoverStyle = $state("");
  $effect(() => {
    if (!open || !triggerEl) return;
    const r = triggerEl.getBoundingClientRect();
    const top = r.bottom + 4;
    const left = r.left;
    const minWidth = r.width;
    popoverStyle = `top:${top}px; left:${left}px; min-width:${minWidth}px;`;
  });

  function toggle() {
    open = !open;
  }

  function pick(id: string) {
    onchange(id);
    open = false;
    triggerEl?.focus();
  }

  function onWindowPointerDown(e: PointerEvent) {
    if (!open) return;
    const t = e.target as Node | null;
    if (!t) return;
    if (triggerEl && triggerEl.contains(t)) return;
    if (popoverEl && popoverEl.contains(t)) return;
    open = false;
  }

  function onKeydown(e: KeyboardEvent) {
    if (!open) {
      if (
        (e.key === "ArrowDown" || e.key === "Enter" || e.key === " ") &&
        document.activeElement === triggerEl
      ) {
        e.preventDefault();
        open = true;
      }
      return;
    }
    if (e.key === "Escape") {
      e.preventDefault();
      open = false;
      triggerEl?.focus();
      return;
    }
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      const idx = options.findIndex((o) => o.id === value);
      const step = e.key === "ArrowDown" ? 1 : -1;
      const next = options[(idx + step + options.length) % options.length];
      if (next) onchange(next.id);
    }
  }
</script>

<svelte:window onpointerdown={onWindowPointerDown} onkeydown={onKeydown} />

<button
  bind:this={triggerEl}
  type="button"
  class="tab-trigger"
  class:open
  aria-haspopup="listbox"
  aria-expanded={open}
  aria-label={ariaLabel}
  onclick={toggle}
>
  <span class="tab-trigger-label">{selected?.label ?? ""}</span>
  <svg class="chev" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <polyline points="6 9 12 15 18 9" />
  </svg>
</button>

{#if open}
  <Portal>
    <div
      bind:this={popoverEl}
      class="tab-popover"
      role="listbox"
      tabindex="-1"
      style={popoverStyle}
    >
      {#each options as opt (opt.id)}
        <button
          type="button"
          role="option"
          aria-selected={opt.id === value}
          class="tab-option"
          class:active={opt.id === value}
          onclick={() => pick(opt.id)}
        >{opt.label}</button>
      {/each}
    </div>
  </Portal>
{/if}

<style>
  .tab-trigger {
    display: inline-flex;
    align-items: center;
    justify-content: space-between;
    gap: 6px;
    flex: 1;
    min-width: 0;
    padding: 4px 8px;
    border: 1px solid color-mix(in srgb, var(--tv-primary, #2563eb) 20%, transparent);
    border-radius: 6px;
    background: var(--tv-bg, #ffffff);
    color: var(--tv-fg, #1a1a1a);
    font-size: 0.8125rem;
    font-weight: 500;
    cursor: pointer;
    transition: border-color 0.15s ease, background-color 0.15s ease;
  }

  .tab-trigger:hover,
  .tab-trigger:focus-visible,
  .tab-trigger.open {
    border-color: var(--tv-primary, #2563eb);
    outline: none;
  }

  .tab-trigger-label {
    flex: 1;
    min-width: 0;
    text-align: left;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .chev {
    flex-shrink: 0;
    color: var(--tv-secondary, #64748b);
    transition: transform 0.18s ease;
  }

  .tab-trigger.open .chev {
    transform: rotate(180deg);
  }

  .tab-popover {
    position: fixed;
    z-index: 10070;
    min-width: 140px;
    max-height: 320px;
    overflow-y: auto;
    padding: 4px;
    background: var(--tv-bg, #ffffff);
    border: 1px solid color-mix(in srgb, var(--tv-primary, #2563eb) 18%, var(--tv-border, #e2e8f0));
    border-radius: 8px;
    box-shadow:
      0 12px 32px -8px color-mix(in srgb, #0f172a 25%, transparent),
      0 2px 6px -2px color-mix(in srgb, var(--tv-primary, #2563eb) 20%, transparent);
    animation: pop-in 0.14s ease-out;
  }

  @keyframes pop-in {
    from { transform: translateY(-4px); opacity: 0; }
    to   { transform: translateY(0);    opacity: 1; }
  }

  .tab-option {
    display: block;
    width: 100%;
    padding: 6px 10px;
    border: none;
    border-radius: 4px;
    background: transparent;
    color: var(--tv-fg, #1a1a1a);
    font-size: 0.8125rem;
    font-weight: 500;
    text-align: left;
    cursor: pointer;
    transition: background-color 0.1s ease, color 0.1s ease;
  }

  .tab-option + .tab-option {
    margin-top: 1px;
  }

  .tab-option:hover:not(.active) {
    background: color-mix(in srgb, var(--tv-primary, #2563eb) 8%, transparent);
  }

  .tab-option.active {
    background: color-mix(in srgb, var(--tv-primary, #2563eb) 15%, var(--tv-bg, #ffffff));
    color: var(--tv-primary, #2563eb);
  }

  .tab-option:focus-visible {
    outline: 2px solid color-mix(in srgb, var(--tv-primary, #2563eb) 50%, transparent);
    outline-offset: -2px;
  }
</style>

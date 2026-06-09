<!--
  Dropdown — a custom-styled single-select listbox (UX redesign 2026-06-08).

  Replaces the native `<select>` (Select.svelte), whose OPEN list rendered as
  the OS-native menu and shattered the panel's editorial chrome ("web 0.0",
  maintainer). This one's open list lives inside the v2 token system, so the
  whole surface stays coherent. Drop-in API-compatible with Select
  (value / options / onchange / ariaLabel / placeholder / disabled /
  renderOptionStyle) so call sites swap mechanically.

  Real listbox semantics: button[aria-haspopup=listbox] trigger + a
  role=listbox popover; keyboard nav (↑/↓/Home/End/Enter/Esc), type-ahead,
  outside-click + Esc to close, flips above when there's no room below.
-->
<script lang="ts" generics="T extends string | number">
  interface Props {
    value?: T | null;
    options: { value: T; label: string; style?: string }[];
    placeholder?: string;
    disabled?: boolean;
    ariaLabel?: string;
    id?: string;
    /** Render each option's label in its own font (FontFamily preview). */
    renderOptionStyle?: boolean;
    onchange?: (next: T) => void;
  }
  let {
    value = $bindable(null),
    options,
    placeholder,
    disabled = false,
    ariaLabel,
    id,
    renderOptionStyle = false,
    onchange,
  }: Props = $props();

  let open = $state(false);
  let flipUp = $state(false);
  let active = $state(-1); // keyboard-focused index while open
  let triggerEl = $state<HTMLButtonElement | null>(null);
  let listEl = $state<HTMLUListElement | null>(null);

  const selectedIndex = $derived(options.findIndex((o) => o.value === value));
  const selectedLabel = $derived(
    selectedIndex >= 0 ? options[selectedIndex]!.label : (placeholder ?? ""),
  );
  const selectedStyle = $derived(
    renderOptionStyle && selectedIndex >= 0 ? options[selectedIndex]!.style : undefined,
  );

  function openList(): void {
    if (disabled) return;
    // Flip above when the trigger sits low in the viewport.
    const r = triggerEl?.getBoundingClientRect();
    flipUp = !!r && (window.innerHeight - r.bottom) < Math.min(240, options.length * 26 + 12);
    active = selectedIndex >= 0 ? selectedIndex : 0;
    open = true;
  }
  function closeList(focusTrigger = true): void {
    open = false;
    if (focusTrigger) triggerEl?.focus();
  }
  function commit(i: number): void {
    const opt = options[i];
    if (!opt) return;
    value = opt.value;
    onchange?.(opt.value);
    closeList();
  }

  function onTriggerKey(e: KeyboardEvent): void {
    if (disabled) return;
    if (!open) {
      if (e.key === "ArrowDown" || e.key === "ArrowUp" || e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        openList();
      }
      return;
    }
  }

  let typeahead = "";
  let typeaheadTimer: ReturnType<typeof setTimeout> | null = null;
  function onListKey(e: KeyboardEvent): void {
    if (e.key === "ArrowDown") { e.preventDefault(); active = Math.min(options.length - 1, active + 1); }
    else if (e.key === "ArrowUp") { e.preventDefault(); active = Math.max(0, active - 1); }
    else if (e.key === "Home") { e.preventDefault(); active = 0; }
    else if (e.key === "End") { e.preventDefault(); active = options.length - 1; }
    else if (e.key === "Enter" || e.key === " ") { e.preventDefault(); if (active >= 0) commit(active); }
    else if (e.key === "Escape" || e.key === "Tab") { closeList(e.key !== "Tab"); }
    else if (e.key.length === 1) {
      // type-ahead: jump to the next option whose label starts with the buffer
      typeahead += e.key.toLowerCase();
      if (typeaheadTimer) clearTimeout(typeaheadTimer);
      typeaheadTimer = setTimeout(() => (typeahead = ""), 600);
      const hit = options.findIndex((o) => o.label.toLowerCase().startsWith(typeahead));
      if (hit >= 0) active = hit;
    }
  }

  // Keep the active option scrolled into view.
  $effect(() => {
    if (open && active >= 0 && listEl) {
      const el = listEl.children[active] as HTMLElement | undefined;
      el?.scrollIntoView({ block: "nearest" });
    }
  });
  // Focus the list when it opens.
  $effect(() => { if (open) listEl?.focus(); });

  function onOutside(e: PointerEvent): void {
    if (!open) return;
    const t = e.target as Node;
    if (!triggerEl?.contains(t) && !listEl?.contains(t)) closeList(false);
  }
</script>

<svelte:window onpointerdown={onOutside} />

<div class="dd" class:disabled>
  <button
    type="button"
    class="dd-trigger"
    bind:this={triggerEl}
    {id}
    {disabled}
    aria-haspopup="listbox"
    aria-expanded={open}
    aria-label={ariaLabel}
    onclick={() => (open ? closeList(false) : openList())}
    onkeydown={onTriggerKey}
  >
    <span class="dd-value" style={selectedStyle} class:placeholder={selectedIndex < 0}>{selectedLabel}</span>
    <span class="dd-caret" class:up={open} aria-hidden="true"></span>
  </button>

  {#if open}
    <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
    <ul
      class="dd-list"
      class:up={flipUp}
      role="listbox"
      tabindex="-1"
      aria-label={ariaLabel}
      bind:this={listEl}
      onkeydown={onListKey}
    >
      {#each options as opt, i (String(opt.value))}
        <!-- svelte-ignore a11y_click_events_have_key_events -->
        <li
          role="option"
          aria-selected={opt.value === value}
          class="dd-opt"
          class:active={i === active}
          class:selected={opt.value === value}
          style={renderOptionStyle ? opt.style : undefined}
          onpointerenter={() => (active = i)}
          onclick={() => commit(i)}
        >
          <span class="dd-opt-label">{opt.label}</span>
          {#if opt.value === value}<span class="dd-check" aria-hidden="true">✓</span>{/if}
        </li>
      {/each}
    </ul>
  {/if}
</div>

<style>
  .dd { position: relative; flex: 1; min-width: 0; }
  .dd-trigger {
    display: flex;
    align-items: center;
    gap: 6px;
    width: 100%;
    height: var(--v2-control-h, 22px);
    padding: 0 8px;
    border: 0;
    border-radius: var(--v2-r-soft, 3px);
    background: var(--v2-paper-edge, #fff);
    box-shadow: inset 0 0 0 1px var(--v2-rule, #d6d0c1);
    font-family: var(--v2-font-mono, ui-monospace, monospace);
    font-size: var(--v2-text-body, 11.5px);
    color: var(--v2-ink, #15140e);
    cursor: pointer;
    text-align: left;
    transition: box-shadow var(--v2-dur-snap, 80ms) var(--v2-ease, ease);
  }
  .dd-trigger:hover { box-shadow: inset 0 0 0 1px var(--v2-ink-2, #4a463c); }
  .dd-trigger:focus-visible { outline: none; box-shadow: inset 0 0 0 1.5px var(--v2-rule-strong, #15140e); }
  .dd.disabled .dd-trigger { opacity: 0.4; cursor: not-allowed; }
  .dd-value { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .dd-value.placeholder { color: var(--v2-ink-3, #8a8478); }
  .dd-caret {
    flex: none;
    width: 7px; height: 7px;
    border-right: 1.5px solid var(--v2-ink-3, #8a8478);
    border-bottom: 1.5px solid var(--v2-ink-3, #8a8478);
    transform: translateY(-1px) rotate(45deg);
    transition: transform var(--v2-dur-snap, 80ms) var(--v2-ease, ease);
  }
  .dd-caret.up { transform: translateY(1px) rotate(225deg); }

  .dd-list {
    position: absolute;
    left: 0; right: 0;
    top: calc(100% + 4px);
    z-index: 10020;
    margin: 0; padding: 4px;
    list-style: none;
    max-height: 240px;
    overflow-y: auto;
    background: var(--v2-paper, #fbf9f3);
    border-radius: var(--v2-r-soft, 4px);
    box-shadow:
      0 0 0 1px var(--v2-rule, #d6d0c1),
      0 8px 22px -8px rgba(20, 18, 12, 0.28);
    outline: none;
    animation: dd-in 0.12s var(--v2-ease, cubic-bezier(0.2, 0.8, 0.2, 1));
  }
  .dd-list.up { top: auto; bottom: calc(100% + 4px); }
  @keyframes dd-in { from { opacity: 0; transform: translateY(-3px); } to { opacity: 1; transform: none; } }

  .dd-opt {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 4px 8px;
    min-height: 24px;
    border-radius: var(--v2-r-hair, 2px);
    font-family: var(--v2-font-mono, ui-monospace, monospace);
    font-size: var(--v2-text-body, 11.5px);
    color: var(--v2-ink, #15140e);
    cursor: pointer;
  }
  .dd-opt-label { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .dd-opt.active { background: var(--v2-hover-tint, rgba(21, 20, 14, 0.06)); }
  .dd-opt.selected { color: var(--v2-ink, #15140e); font-weight: 600; }
  .dd-opt.selected.active { background: color-mix(in srgb, var(--v2-accent, #2563eb) 12%, transparent); }
  .dd-check { flex: none; color: var(--v2-accent, #2563eb); font-size: 11px; }
</style>

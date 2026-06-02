<!--
  TabSelect — settings-panel section selector. Editorial-aesthetic
  dropdown that matches the v2 surface idiom (ink-on-cream, square
  corners, mono labels, glyph badges). One legibility-first click each
  way — open dropdown / pick section — replacing the prior glyph-only
  TabBar which felt cryptic at 7 abstract icons.

  The listbox portals to document.body to escape any contain:layout /
  transform on the widget container; coords come from the trigger's
  getBoundingClientRect at open time.
-->
<script lang="ts" module>
  import type { GlyphToken } from "$lib/ui-glyphs";

  export interface TabOption {
    id: string;
    label: string;
    /** Glyph token rendered before the label in trigger and listbox. */
    glyph?: GlyphToken;
    /** Optional second-line description rendered under the label in the
     *  listbox only (kept off the trigger so it stays compact). */
    description?: string;
    /**
     * "advanced" tabs render with a softened ink and a thin divider
     * appears before the first advanced entry — implicit visual
     * hierarchy for terminal detail surfaces (Tokens / Marks) so they
     * don't compete with the primary tabs (Labels / Theme / Layout).
     */
    kind?: "normal" | "advanced";
  }
</script>

<script lang="ts">
  import Portal from "$lib/Portal.svelte";
  import { glyph as glyphChar } from "$lib/ui-glyphs";

  interface Props {
    options: TabOption[];
    value: string;
    onchange: (id: string) => void;
    /** Accessible label for the trigger when no visible label is provided. */
    ariaLabel?: string;
  }

  const { options, value, onchange, ariaLabel = "Select section" }: Props = $props();

  let open = $state(false);
  let triggerEl: HTMLButtonElement | null = $state(null);
  let popoverEl: HTMLDivElement | null = $state(null);

  const selected = $derived(options.find((o) => o.id === value) ?? options[0]);

  // Index of the first "advanced" option — drives a single divider above it.
  const firstAdvancedIdx = $derived(options.findIndex((o) => o.kind === "advanced"));

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
  data-tv-v2
  aria-haspopup="listbox"
  aria-expanded={open}
  aria-label={ariaLabel}
  onclick={toggle}
>
  {#if selected?.glyph}
    <span class="trig-glyph" aria-hidden="true">{glyphChar(selected.glyph)}</span>
  {/if}
  <span class="trig-label">{selected?.label ?? ""}</span>
  <svg class="chev" width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
    <path d="M2 3.5 L5 6.5 L8 3.5" stroke="currentColor" stroke-width="1.4" fill="none" stroke-linecap="round" stroke-linejoin="round" />
  </svg>
</button>

{#if open}
  <Portal>
    <div
      bind:this={popoverEl}
      class="tab-popover"
      data-tv-v2
      role="listbox"
      tabindex="-1"
      style={popoverStyle}
    >
      {#each options as opt, i (opt.id)}
        {#if firstAdvancedIdx > 0 && i === firstAdvancedIdx}
          <div class="tab-divider" role="separator" aria-hidden="true"></div>
        {/if}
        <button
          type="button"
          role="option"
          aria-selected={opt.id === value}
          class="tab-option"
          class:active={opt.id === value}
          class:advanced={opt.kind === "advanced"}
          onclick={() => pick(opt.id)}
        >
          {#if opt.glyph}
            <span class="opt-glyph" aria-hidden="true">{glyphChar(opt.glyph)}</span>
          {/if}
          <span class="opt-text">
            <span class="opt-label">{opt.label}</span>
            {#if opt.description}
              <span class="opt-desc">{opt.description}</span>
            {/if}
          </span>
        </button>
      {/each}
    </div>
  </Portal>
{/if}

<style>
  /* ── Trigger (the visible chip in the panel bar) ─────────── */
  .tab-trigger {
    display: inline-flex;
    align-items: center;
    gap: var(--v2-gap-small, 6px);
    flex: 1;
    min-width: 0;
    height: 26px;
    padding: 0 8px;
    border: 0;
    border-radius: var(--v2-r-soft, 3px);
    background: var(--v2-paper-edge, #ffffff);
    box-shadow: inset 0 0 0 1px var(--v2-rule, #d6d0c1);
    color: var(--v2-ink, #15140e);
    font: inherit;
    font-family: var(--v2-font-mono, ui-monospace, monospace);
    font-size: var(--v2-text-body, 11.5px);
    text-align: left;
    cursor: pointer;
    transition: box-shadow var(--v2-dur-snap, 80ms) var(--v2-ease);
  }
  .tab-trigger:hover {
    box-shadow: inset 0 0 0 1px var(--v2-ink-2, #4a463c);
  }
  .tab-trigger.open,
  .tab-trigger:focus-visible {
    box-shadow: inset 0 0 0 1px var(--v2-rule-strong, #15140e);
    outline: none;
  }

  .trig-glyph {
    font-family: var(--v2-font-mono, ui-monospace, monospace);
    font-size: 12px;
    color: var(--v2-ink-3, #8a8478);
    width: 14px;
    text-align: center;
    line-height: 1;
    flex: none;
  }

  .trig-label {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .chev {
    flex: none;
    color: var(--v2-ink-3, #8a8478);
    transition: transform 0.18s var(--v2-ease);
  }
  .tab-trigger.open .chev { transform: rotate(180deg); }

  /* ── Popover (the listbox) ───────────────────────────────── */
  .tab-popover {
    position: fixed;
    z-index: 10070;
    min-width: 200px;
    max-height: 340px;
    overflow-y: auto;
    padding: 3px;
    background: var(--v2-paper, #faf7f0);
    border: 0;
    border-radius: var(--v2-r-soft, 3px);
    box-shadow:
      inset 0 0 0 1px var(--v2-rule, #d6d0c1),
      0 8px 24px -4px rgba(15, 23, 42, 0.16);
    animation: pop-in 0.12s var(--v2-ease, ease-out);
  }

  @keyframes pop-in {
    from { transform: translateY(-2px); opacity: 0; }
    to   { transform: translateY(0);    opacity: 1; }
  }

  /* ── Option row ──────────────────────────────────────────── */
  .tab-option {
    display: flex;
    align-items: flex-start;
    gap: var(--v2-gap-small, 6px);
    width: 100%;
    padding: 5px 8px;
    border: 0;
    border-radius: var(--v2-r-soft, 3px);
    background: transparent;
    color: var(--v2-ink, #15140e);
    font-family: var(--v2-font-sans, system-ui, sans-serif);
    font-size: var(--v2-text-body, 11.5px);
    text-align: left;
    cursor: pointer;
    transition: background var(--v2-dur-snap, 80ms) var(--v2-ease);
  }
  .tab-option:hover:not(.active) { background: var(--v2-paper-2, #f3efe5); }
  .tab-option.active {
    background: var(--v2-ink, #15140e);
    color: var(--v2-paper, #faf7f0);
  }
  .tab-option.advanced { color: var(--v2-ink-3, #8a8478); }
  .tab-option.advanced.active { color: var(--v2-paper, #faf7f0); }
  .tab-option:focus-visible {
    outline: 1px solid var(--v2-focus-ring, #15140e);
    outline-offset: -1px;
  }

  .opt-glyph {
    font-family: var(--v2-font-mono, ui-monospace, monospace);
    font-size: 12px;
    width: 14px;
    text-align: center;
    line-height: 1.25;
    flex: none;
    color: var(--v2-ink-3, #8a8478);
  }
  .tab-option.active .opt-glyph { color: inherit; opacity: 0.85; }

  .opt-text {
    display: flex;
    flex-direction: column;
    gap: 1px;
    min-width: 0;
    flex: 1;
  }
  .opt-label {
    font-weight: 500;
    line-height: 1.15;
  }
  .opt-desc {
    font-size: var(--v2-text-small, 10.5px);
    color: var(--v2-ink-3, #8a8478);
    line-height: 1.25;
    font-style: italic;
  }
  .tab-option.active .opt-desc { color: inherit; opacity: 0.8; font-style: italic; }

  /* ── Divider above first 'advanced' entry ────────────────── */
  .tab-divider {
    margin: 3px 4px;
    height: 1px;
    background: var(--v2-rule, #d6d0c1);
  }
</style>

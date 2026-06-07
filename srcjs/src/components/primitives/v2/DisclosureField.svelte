<!--
  DisclosureField — a Field whose control is a summary chip + caret, and
  which renders an indented child block when open (settings-overhaul P1).

  The panel's load-bearing collapse primitive: "collapsed ≠ blind" — the
  summary carries the current value(s) so a closed group still reads
  (`Effects  subtle · low  ⌄`). Disclosure depth ≤ 1 is LAW (overhaul T2
  decision): never nest a DisclosureField inside another one.

  Composes the Field spine (gutter / label / control) so disclosure rows
  sit on the exact same grid as plain Fields. The child block hangs at an
  8px indent and re-uses the same spine inside.
-->
<script lang="ts">
  import type { Snippet } from "svelte";

  interface Props {
    label: string;
    /** Current-value summary shown while collapsed (e.g. "subtle · low").
     *  Keep it short; mono-set. */
    summary?: string;
    open?: boolean;
    /** True when any child value differs from its default — hot dot. */
    pinned?: boolean;
    /** Reset-all-children handler for the gutter dot. */
    onreset?: () => void;
    ontoggle?: (open: boolean) => void;
    children?: Snippet;
  }

  let {
    label,
    summary,
    open = $bindable(false),
    pinned,
    onreset,
    ontoggle,
    children,
  }: Props = $props();

  function toggle(): void {
    open = !open;
    ontoggle?.(open);
  }
</script>

<div class="disclosure" class:open>
  <div class="head">
    <button
      class="gutter"
      type="button"
      aria-label={pinned ? "Reset group to defaults" : "Default values (no overrides)"}
      disabled={!pinned}
      onclick={() => pinned && onreset?.()}
    >
      {#if pinned}<span class="dot"></span>{/if}
    </button>
    <button
      type="button"
      class="row"
      aria-expanded={open}
      onclick={toggle}
    >
      <span class="label">{label}</span>
      {#if summary && !open}<span class="summary">{summary}</span>{/if}
      <span class="caret" aria-hidden="true">{open ? "⌃" : "⌄"}</span>
    </button>
  </div>
  {#if open}
    <div class="body">
      {@render children?.()}
    </div>
  {/if}
</div>

<style>
  .disclosure {
    display: flex;
    flex-direction: column;
  }
  .head {
    display: grid;
    grid-template-columns: 8px 1fr;
    column-gap: var(--v2-gap-mid, 8px);
    align-items: center;
    min-height: var(--v2-row-h, 22px);
  }
  .gutter {
    appearance: none;
    border: 0;
    background: transparent;
    padding: 0;
    width: 8px;
    height: var(--v2-row-h, 22px);
    display: inline-flex;
    align-items: center;
    justify-content: center;
    cursor: default;
  }
  .gutter:not(:disabled) { cursor: pointer; }
  .dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: var(--v2-hot, #b53a1f);
  }
  .row {
    appearance: none;
    border: 0;
    background: transparent;
    padding: 0;
    min-height: var(--v2-row-h, 22px);
    display: flex;
    align-items: center;
    gap: var(--v2-gap-mid, 8px);
    cursor: pointer;
    text-align: left;
    border-radius: var(--v2-r-hair, 2px);
  }
  .row:hover { background: var(--v2-hover-tint, rgba(21, 20, 14, 0.05)); }
  .row:focus-visible {
    outline: 1px solid var(--v2-focus-ring, #15140e);
    outline-offset: 1px;
  }
  .label {
    font-family: var(--v2-font-sans, system-ui);
    font-size: var(--v2-text-body, 11.5px);
    color: var(--v2-ink-2, #4a463c);
  }
  .summary {
    margin-left: auto;
    font-family: var(--v2-font-mono, ui-monospace, monospace);
    font-size: var(--v2-text-small, 10.5px);
    color: var(--v2-ink-3, #8a8478);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .caret {
    flex: none;
    margin-left: var(--v2-gap-small, 6px);
    font-size: 10px;
    color: var(--v2-ink-3, #8a8478);
  }
  .row:not(:has(.summary)) .caret,
  .disclosure.open .caret {
    margin-left: auto;
  }
  .body {
    /* Hanging indent — one gutter width — so children read as a
       continuation of the spine, not a nested panel. */
    padding: 2px 0 4px 8px;
    display: flex;
    flex-direction: column;
    gap: var(--v2-gap-hair, 2px);
  }
</style>

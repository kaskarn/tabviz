<!--
  EditThemeCluster — the "Edit theme" top-tab's inner cluster (D21 IA:
  {Edit theme: Identity | Plots | Styling}). Holds the inner tab row +
  the Identity / Plots panes (Styling lands Phase 5). The inner chrome
  appears only because a SECOND inner tab now exists (Phase 4) — one
  inner tab would need none.

  All three inner surfaces write THEME inputs (travel: Reset theme), so
  the cluster is a pure navigation shell over store-wired tabs.
-->
<script lang="ts">
  import type { TabvizStore } from "$stores/tabvizStore.svelte";
  import IdentityTab from "./IdentityTab.svelte";
  import PlotsTab from "./PlotsTab.svelte";

  interface Props { store: TabvizStore; }
  const { store }: Props = $props();

  type Inner = "identity" | "plots";
  let inner = $state<Inner>("identity");
  const INNER: ReadonlyArray<{ id: Inner; label: string }> = [
    { id: "identity", label: "identity" },
    { id: "plots", label: "plots" },
  ];
</script>

<div class="cluster">
  <div class="inner-strip" role="tablist" aria-label="Edit theme sections">
    {#each INNER as t (t.id)}
      <button type="button" role="tab" class="inner-tab"
              class:active={inner === t.id}
              aria-selected={inner === t.id}
              tabindex={inner === t.id ? 0 : -1}
              onclick={() => (inner = t.id)}>{t.label}</button>
    {/each}
  </div>
  {#if inner === "identity"}
    <IdentityTab {store} />
  {:else}
    <PlotsTab {store} />
  {/if}
</div>

<style>
  .cluster {
    display: flex;
    flex-direction: column;
  }
  .inner-strip {
    display: flex;
    gap: 4px;
    padding: 6px 0 0;
  }
  .inner-tab {
    appearance: none;
    border: 1px solid transparent;
    background: transparent;
    padding: 3px 9px;
    border-radius: var(--v2-r-pill, 999px);
    font-family: var(--v2-font-sans, system-ui, sans-serif);
    font-size: var(--v2-text-micro, 9.5px);
    font-weight: 600;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--v2-ink-3, #8a8478);
    cursor: pointer;
  }
  .inner-tab:hover { color: var(--v2-ink, #15140e); }
  .inner-tab.active {
    color: var(--v2-paper, #faf7f0);
    background: var(--v2-ink, #15140e);
    border-color: var(--v2-ink, #15140e);
  }
  .inner-tab:focus-visible {
    outline: 1px solid var(--v2-focus-ring, #15140e);
    outline-offset: 1px;
  }
</style>

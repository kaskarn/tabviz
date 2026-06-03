<!--
  Stage 3 — SettingsRail.svelte
  Tab bar (Identity / Rhythm / Encoding / Advanced) + active tab content.
  Each tab is its own component to keep the file size manageable.
-->
<script lang="ts">
  import IdentityTab from "./tabs/IdentityTab.svelte";
  import RhythmTab from "./tabs/RhythmTab.svelte";
  import EncodingTab from "./tabs/EncodingTab.svelte";
  import AdvancedTab from "./tabs/AdvancedTab.svelte";

  type TabName = "Identity" | "Rhythm" | "Encoding" | "Advanced";
  let active = $state<TabName>("Identity");

  const TABS: TabName[] = ["Identity", "Rhythm", "Encoding", "Advanced"];
</script>

<aside class="settings-rail">
  <div class="tabs" role="tablist">
    {#each TABS as t (t)}
      <button
        type="button"
        role="tab"
        aria-selected={active === t}
        class:active={active === t}
        onclick={() => (active = t)}
      >{t}</button>
    {/each}
  </div>

  <div class="tab-content" role="tabpanel">
    {#if active === "Identity"}
      <IdentityTab />
    {:else if active === "Rhythm"}
      <RhythmTab />
    {:else if active === "Encoding"}
      <EncodingTab />
    {:else}
      <AdvancedTab />
    {/if}
  </div>
</aside>

<style>
  .settings-rail {
    border-right: 1px solid #e2e8f0;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    background: #fff;
  }
  .tabs {
    display: flex;
    border-bottom: 1px solid #e2e8f0;
    background: #fafafa;
  }
  .tabs button {
    flex: 1;
    padding: 10px 4px;
    border: none;
    border-bottom: 2px solid transparent;
    background: transparent;
    cursor: pointer;
    font-size: 12px;
    font-weight: 500;
    color: #475569;
  }
  .tabs button.active {
    border-bottom-color: #2563eb;
    color: #1a1a1a;
  }
  .tabs button:hover:not(.active) {
    color: #1a1a1a;
    background: #f1f5f9;
  }
  .tab-content {
    overflow-y: auto;
    flex: 1;
    padding: 12px;
  }
</style>

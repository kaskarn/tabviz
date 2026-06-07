<!--
  QuickStrip — the first ~150px of the rebuilt settings panel
  (settings-overhaul P2): orientation (which theme, is it edited) + the
  two declared-everyday flips (polarity, density) + nothing else. Pinned
  above the THEME band; never scrolls away.
-->
<script lang="ts">
  import type { TabvizStore } from "$stores/tabvizStore.svelte";
  import type { ThemeInputs } from "$types/theme-inputs";
  import { EnumRow } from "$components/theme-controls";

  interface Props { store: TabvizStore; }
  const { store }: Props = $props();

  const theme = $derived(store.spec?.theme);
  const inputs = $derived(
    (theme as { authoringInputs?: ThemeInputs } | undefined)?.authoringInputs ?? null,
  );

  function patch<K extends keyof ThemeInputs>(key: K, value: ThemeInputs[K]): void {
    if (!inputs) return;
    store.setAuthoringInputs({ ...inputs, [key]: value });
  }
</script>

{#if inputs}
  <div class="quick-strip">
    <div class="echo">
      <span class="preset">{store.baseThemeName}</span>
      {#if store.hasThemeEdits}
        <span class="edited" title="Theme inputs differ from the loaded preset">· edited</span>
      {/if}
    </div>
    <EnumRow
      label="Polarity"
      value={inputs.polarity ?? "light"}
      segments={[
        { value: "light", label: "☀ light" },
        { value: "dark", label: "🌙 dark" },
      ]}
      onchange={(v) => patch("polarity", v as ThemeInputs["polarity"])}
    />
    <EnumRow
      label="Density"
      value={inputs.density ?? "comfortable"}
      segments={[
        { value: "compact", label: "compact" },
        { value: "comfortable", label: "comfortable" },
        { value: "spacious", label: "spacious" },
      ]}
      onchange={(v) => patch("density", v as ThemeInputs["density"])}
    />
  </div>
{/if}

<style>
  .quick-strip {
    padding: 8px 12px 6px;
    border-bottom: 1px solid var(--v2-rule-soft, #e6e0d1);
    display: flex;
    flex-direction: column;
    gap: var(--v2-gap-hair, 2px);
  }
  .echo {
    display: flex;
    align-items: baseline;
    gap: var(--v2-gap-small, 6px);
    padding-bottom: 4px;
  }
  .preset {
    font-family: var(--v2-font-mono, ui-monospace, monospace);
    font-size: var(--v2-text-body, 11.5px);
    color: var(--v2-ink, #15140e);
  }
  .edited {
    font-size: var(--v2-text-small, 10.5px);
    color: var(--v2-hot, #b53a1f);
  }
</style>

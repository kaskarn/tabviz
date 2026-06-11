<!--
  ComponentsBand — settings-panel host of ComponentsEditor (compact).
  Re-routes travel with the THEME (the band sits in the theme half).
-->
<script lang="ts">
  import type { TabvizStore } from "$stores/tabvizStore.svelte";
  import { resolveTheme } from "$lib/theme/resolve-theme";
  import { createWire } from "$lib/theme/theme-wire";
  import ComponentsEditor from "./ComponentsEditor.svelte";

  interface Props { store: TabvizStore; }
  const { store }: Props = $props();

  const theme = $derived(store.spec?.theme as {
    authoringInputs?: import("../../../types/theme-inputs").ThemeInputs;
    roleOverrides?: Record<string, { ramp: string; grade: number }>;
    components?: Record<string, Record<string, Record<string, string>>>;
    name?: string;
  } | undefined);

  const resolved = $derived.by(() => {
    const inputs = theme?.authoringInputs;
    if (!inputs) return null;
    try {
      return resolveTheme({
        ...createWire(inputs, theme?.name ?? "custom"),
        roleOverrides: (theme?.roleOverrides ?? {}) as never,
        components: theme?.components,
      });
    } catch {
      return null;
    }
  });
</script>

{#if resolved}
  <ComponentsEditor
    roles={resolved.roles}
    cssVars={resolved.cssVars as Record<string, string>}
    components={theme?.components}
    onset={(c, s, ch, r) => store.setComponentChannel(c, s, ch, r)}
    onclear={(c, s, ch) => store.clearComponentChannel(c, s, ch)}
    layout="compact"
  />
{/if}

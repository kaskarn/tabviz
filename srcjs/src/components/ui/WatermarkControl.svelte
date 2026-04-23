<script lang="ts">
  import type { ForestStore } from "$stores/forestStore.svelte";
  import SettingsSection from "./SettingsSection.svelte";
  import TextField from "./TextField.svelte";

  interface Props {
    store: ForestStore;
  }

  let { store }: Props = $props();

  const watermark = $derived(store.spec?.watermark ?? "");

  function setWatermark(value: string) {
    store.setWatermark(value);
  }
</script>

<SettingsSection
  title="Watermark"
  description="Diagonal text rendered behind the rows region — typically a status label like DRAFT or CONFIDENTIAL. Leave empty for no watermark."
>
  <TextField
    label="Text"
    hint={watermark ? "Clear the field to remove" : "e.g. DRAFT, CONFIDENTIAL, PREVIEW"}
    placeholder="(none)"
    value={watermark}
    onchange={setWatermark}
  />
</SettingsSection>

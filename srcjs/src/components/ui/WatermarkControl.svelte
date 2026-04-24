<script lang="ts">
  import type { ForestStore } from "$stores/forestStore.svelte";
  import SettingsSection from "./SettingsSection.svelte";
  import TextField from "./TextField.svelte";
  import ColorField from "./ColorField.svelte";
  import NumberField from "./NumberField.svelte";

  interface Props {
    store: ForestStore;
  }

  let { store }: Props = $props();

  const watermark = $derived(store.spec?.watermark ?? "");
  const fallbackColor = $derived(store.spec?.theme?.colors?.foreground ?? "#1a1a1a");
  const color    = $derived(store.spec?.watermarkColor   ?? fallbackColor);
  const opacity  = $derived(store.spec?.watermarkOpacity ?? 0.07);
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
    oninput={(v) => store.previewWatermark(v)}
    onchange={(v) => store.setWatermark(v)}
  />
  <ColorField
    label="Color"
    hint="Inherits foreground by default"
    value={color}
    onchange={(v) => store.setWatermarkColor(v)}
  />
  <NumberField
    label="Opacity"
    hint="0 (invisible) – 1 (opaque)"
    value={opacity}
    min={0}
    max={1}
    step={0.05}
    onchange={(v) => store.setWatermarkOpacity(v)}
  />
</SettingsSection>

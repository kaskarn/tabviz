<script lang="ts">
  import type { ForestStore } from "$stores/forestStore.svelte";
  import WatermarkControl from "./WatermarkControl.svelte";
  import SettingsSection from "./SettingsSection.svelte";
  import TextField from "./TextField.svelte";

  interface Props {
    store: ForestStore;
  }

  let { store }: Props = $props();

  // Plot-level labels live on spec.labels; the store merges session edits
  // so these inputs read the same value the header/footer render, and
  // writing through setLabel() keeps both places in lock-step.
  const title    = $derived(store.getPlotLabel("title")    ?? "");
  const subtitle = $derived(store.getPlotLabel("subtitle") ?? "");
  const caption  = $derived(store.getPlotLabel("caption")  ?? "");
  const footnote = $derived(store.getPlotLabel("footnote") ?? "");
</script>

<!--
  Labels tab: plot-level annotation text + watermark.
  Banding moved to the Layout tab in C2 (banding is a structural choice,
  not an annotation).
-->
<SettingsSection
  title="Labels"
  description="Title, subtitle, caption, and footnote — also editable by double-clicking on the widget."
>
  <TextField
    label="Title"
    placeholder="(none)"
    value={title}
    oninput={(v) => store.previewLabel("title", v)}
    onchange={(v) => store.setLabel("title", v)}
  />
  <TextField
    label="Subtitle"
    placeholder="(none)"
    value={subtitle}
    oninput={(v) => store.previewLabel("subtitle", v)}
    onchange={(v) => store.setLabel("subtitle", v)}
  />
  <TextField
    label="Caption"
    placeholder="(none)"
    value={caption}
    oninput={(v) => store.previewLabel("caption", v)}
    onchange={(v) => store.setLabel("caption", v)}
  />
  <TextField
    label="Footnote"
    placeholder="(none)"
    value={footnote}
    oninput={(v) => store.previewLabel("footnote", v)}
    onchange={(v) => store.setLabel("footnote", v)}
  />
</SettingsSection>
<WatermarkControl {store} />

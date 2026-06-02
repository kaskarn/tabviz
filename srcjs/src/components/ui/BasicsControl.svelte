<script lang="ts">
  import type { TabvizStore } from "$stores/tabvizStore.svelte";
  import Section from "$components/primitives/v2/Section.svelte";
  import TextField from "./TextField.svelte";

  interface Props {
    store: TabvizStore;
  }

  const { store }: Props = $props();

  // Plot-level labels live on spec.labels; the store merges session edits
  // so these inputs read the same value the header/footer render, and
  // writing through setLabel() keeps both places in lock-step.
  const title    = $derived(store.getPlotLabel("title")    ?? "");
  const subtitle = $derived(store.getPlotLabel("subtitle") ?? "");
  const caption  = $derived(store.getPlotLabel("caption")  ?? "");
  const footnote = $derived(store.getPlotLabel("footnote") ?? "");
</script>

<!--
  Labels section: plot-level annotation text. Watermark moved out so
  SettingsPanel can compose Labels → Layout → Watermark on the merged
  "Layout" tab (the dedicated Labels tab was removed since they
  belonged together — title/caption sit at the same conceptual layer
  as density/banding for a viewer composing the plot).
-->
<Section
  title="Labels"
  glyph="section.text"
  hint="Title, subtitle, caption, and footnote — also editable by double-clicking on the widget."
>
  <!-- Title + Subtitle render in serif so authors WYSIWYG-author in
       the same family the chart will set them in. Caption + Footnote
       stay sans (those are casual metadata, often typed in flow).
       Cmd/Ctrl+Enter commits; plain Enter inserts a newline. -->
  <TextField
    label="Title"
    placeholder="(none)"
    value={title}
    lines={2}
    family="serif"
    oninput={(v) => store.previewLabel("title", v)}
    onchange={(v) => store.setLabel("title", v)}
  />
  <TextField
    label="Subtitle"
    placeholder="(none)"
    value={subtitle}
    lines={2}
    family="serif"
    oninput={(v) => store.previewLabel("subtitle", v)}
    onchange={(v) => store.setLabel("subtitle", v)}
  />
  <TextField
    label="Caption"
    placeholder="(none)"
    value={caption}
    lines={3}
    family="sans"
    oninput={(v) => store.previewLabel("caption", v)}
    onchange={(v) => store.setLabel("caption", v)}
  />
  <TextField
    label="Footnote"
    placeholder="(none)"
    value={footnote}
    lines={3}
    family="sans"
    oninput={(v) => store.previewLabel("footnote", v)}
    onchange={(v) => store.setLabel("footnote", v)}
  />
</Section>

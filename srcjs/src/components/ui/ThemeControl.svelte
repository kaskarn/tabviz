<script lang="ts">
  // v2 Theme tab.
  // Edits the *resolved* tier-2 + tier-3 chrome roles plus the data slot
  // anchors and status colors. The frontend has no JS resolver, so editing
  // tier-1 inputs would never propagate. Editing the resolved fields the
  // renderer actually reads is the pragmatic v1.0 surface — the source-export
  // back-derives a tier-1 web_theme(inputs = ...) call when it makes sense
  // and falls through to set_theme_field() paths otherwise.
  import type { ForestStore } from "$stores/forestStore.svelte";
  import SettingsSection from "./SettingsSection.svelte";
  import ColorField from "./ColorField.svelte";
  import FontFamilyPicker from "./FontFamilyPicker.svelte";

  interface Props {
    store: ForestStore;
  }
  let { store }: Props = $props();

  const theme = $derived(store.spec?.theme);
  const inputs = $derived(theme?.inputs);

  function setPath(path: (string | number)[], value: unknown) {
    store.setThemeField(path, value);
  }

  // Series anchor list — drives marker fills via `theme.series[i].fill`.
  function setSeriesFill(idx: number, hex: string) {
    setPath(["series", idx, "fill"], hex);
    // Mirror onto the inputs.seriesAnchors panel state so other readers stay
    // consistent (and source-export sees the change as an inputs edit).
    if (inputs?.seriesAnchors) {
      const next = (inputs.seriesAnchors as string[]).slice();
      next[idx] = hex;
      setPath(["inputs", "seriesAnchors"], next);
    }
  }
  function addSeries() {
    const anchors = (inputs?.seriesAnchors as string[] | undefined) ?? [];
    const next = anchors.slice();
    next.push(theme?.accent?.default ?? "#888888");
    setPath(["inputs", "seriesAnchors"], next);
    // The renderer reads theme.series[i].fill; append a parallel slot.
    const series = (theme?.series ?? []) as Array<Record<string, string>>;
    setPath(["series", series.length, "fill"], next[next.length - 1]);
    setPath(["series", series.length, "stroke"], next[next.length - 1]);
  }
  function removeSeries(idx: number) {
    const anchors = (inputs?.seriesAnchors as string[] | undefined) ?? [];
    if (anchors.length <= 1) return;
    const next = anchors.slice();
    next.splice(idx, 1);
    setPath(["inputs", "seriesAnchors"], next);
    // Trim theme.series too.
    const series = (theme?.series ?? []) as unknown[];
    const trimmed = series.slice();
    trimmed.splice(idx, 1);
    setPath(["series"], trimmed);
  }
</script>

{#if theme}
  <SettingsSection title="Surfaces" description="Base, banding partner, and raised tones for the table chrome.">
    <ColorField label="Background"  value={theme.surface?.base   ?? "#ffffff"} onchange={(v) => setPath(["surface","base"],   v)} />
    <ColorField label="Banding partner" hint="Used by alt-row banding and subtler regions"
                value={theme.surface?.muted  ?? "#f8fafc"} onchange={(v) => setPath(["surface","muted"],  v)} />
    <ColorField label="Raised"      value={theme.surface?.raised ?? "#ffffff"} onchange={(v) => setPath(["surface","raised"], v)} />
  </SettingsSection>

  <SettingsSection title="Content" description="Text tones. Primary is body; secondary is subtitles/captions; muted is axis labels and footnotes.">
    <ColorField label="Primary"   value={theme.content?.primary   ?? "#000000"} onchange={(v) => setPath(["content","primary"],   v)} />
    <ColorField label="Secondary" value={theme.content?.secondary ?? "#444444"} onchange={(v) => setPath(["content","secondary"], v)} />
    <ColorField label="Muted"     value={theme.content?.muted     ?? "#888888"} onchange={(v) => setPath(["content","muted"],     v)} />
    <ColorField label="Inverse"   hint="Text on dark fills (bold-mode header)"
                value={theme.content?.inverse ?? "#ffffff"} onchange={(v) => setPath(["content","inverse"], v)} />
  </SettingsSection>

  <SettingsSection title="Dividers" description="Cell hairlines and stronger rules under header / group rows.">
    <ColorField label="Subtle" value={theme.divider?.subtle ?? "#e2e8f0"} onchange={(v) => setPath(["divider","subtle"], v)} />
    <ColorField label="Strong" value={theme.divider?.strong ?? "#94a3b8"} onchange={(v) => setPath(["divider","strong"], v)} />
  </SettingsSection>

  <SettingsSection title="Accent" description="Selection, hover, and other interaction tones.">
    <ColorField label="Accent"          value={theme.accent?.default     ?? "#8b5cf6"} onchange={(v) => setPath(["accent","default"],     v)} />
    <ColorField label="Accent (muted)"  hint="Hover / selected row fill" value={theme.accent?.muted ?? "#dde1e7"} onchange={(v) => setPath(["accent","muted"], v)} />
    <ColorField label="Accent tint"     hint="L1 group bar background"  value={theme.accent?.tintSubtle ?? "#e1e5ea"} onchange={(v) => setPath(["accent","tintSubtle"], v)} />
  </SettingsSection>

  <SettingsSection title="Status" description="Semantic indicator colors.">
    <ColorField label="Positive" value={theme.status?.positive ?? "#3F7D3F"} onchange={(v) => setPath(["status","positive"], v)} />
    <ColorField label="Negative" value={theme.status?.negative ?? "#B33A3A"} onchange={(v) => setPath(["status","negative"], v)} />
    <ColorField label="Warning"  value={theme.status?.warning  ?? "#C68A2E"} onchange={(v) => setPath(["status","warning"],  v)} />
    <ColorField label="Info"     value={theme.status?.info     ?? theme.accent?.default ?? "#2C4F7C"} onchange={(v) => setPath(["status","info"], v)} />
  </SettingsSection>

  <SettingsSection title="Summary diamond" description="Pooled-effect mark.">
    <ColorField label="Fill"   value={theme.summary?.fill   ?? "#0891b2"} onchange={(v) => setPath(["summary","fill"],   v)} />
    <ColorField label="Stroke" value={theme.summary?.stroke ?? "#0e7490"} onchange={(v) => setPath(["summary","stroke"], v)} />
  </SettingsSection>

  <SettingsSection title="Series" description="Per-effect anchor colors for forest points, bars, and other inline marks.">
    {#if Array.isArray(theme.series)}
      {#each theme.series as slot, i (i)}
        <div class="series-row">
          <ColorField
            label={`Series ${i + 1}`}
            value={slot?.fill ?? "#888888"}
            onchange={(v) => setSeriesFill(i, v)}
          />
          <button class="series-remove" onclick={() => removeSeries(i)} aria-label="Remove series">×</button>
        </div>
      {/each}
    {/if}
    <button class="series-add" onclick={addSeries}>+ Add series</button>
  </SettingsSection>

  <SettingsSection title="Fonts" description="Body is the primary face; display is for titles; mono is optional.">
    <FontFamilyPicker label="Body"    value={inputs?.fontBody    ?? "system-ui"} onchange={(v) => setPath(["inputs","fontBody"],    v)} />
    <FontFamilyPicker label="Display" value={inputs?.fontDisplay ?? inputs?.fontBody ?? "system-ui"} onchange={(v) => setPath(["inputs","fontDisplay"], v)} />
    <FontFamilyPicker label="Mono"    value={inputs?.fontMono    ?? ""} onchange={(v) => setPath(["inputs","fontMono"], v)} />
  </SettingsSection>
{/if}

<style>
  .series-row {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }
  .series-row > :global(*:first-child) {
    flex: 1;
  }
  .series-remove {
    width: 1.75rem;
    height: 1.75rem;
    border: 1px solid var(--tv-border);
    background: transparent;
    color: var(--tv-secondary);
    border-radius: 4px;
    cursor: pointer;
    font-size: 1.1rem;
    line-height: 1;
  }
  .series-remove:hover {
    border-color: var(--tv-accent);
    color: var(--tv-accent);
  }
  .series-add {
    margin-top: 0.25rem;
    padding: 0.35rem 0.6rem;
    border: 1px dashed var(--tv-border);
    background: transparent;
    color: var(--tv-secondary);
    border-radius: 4px;
    cursor: pointer;
    font-size: 0.85rem;
    width: 100%;
  }
  .series-add:hover {
    border-style: solid;
    border-color: var(--tv-accent);
    color: var(--tv-accent);
  }
</style>

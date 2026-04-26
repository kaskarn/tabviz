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

  // Surface "Background" should refresh both surface.base and the row
  // base bg (which is what the renderer actually paints). Same for muted
  // (alt-row) and divider (cell border).
  function setBackground(hex: string) {
    setPath(["surface", "base"], hex);
    setPath(["row", "base", "bg"], hex);
  }
  function setBandingPartner(hex: string) {
    setPath(["surface", "muted"], hex);
    setPath(["row", "alt", "bg"], hex);
  }
  function setForeground(hex: string) {
    setPath(["content", "primary"], hex);
    setPath(["cell", "fg"], hex);
    setPath(["row", "base", "fg"], hex);
    setPath(["row", "alt",  "fg"], hex);
  }
  function setBorder(hex: string) {
    setPath(["divider", "subtle"], hex);
    setPath(["cell", "border"], hex);
  }
  // Write to whichever header variant is currently active so panel edits
  // reflect immediately. Without this, "Header bg" edits the light slot
  // even when the user is on the bold variant — the live render keeps
  // showing the bold variant's untouched bg.
  function activeHeaderVariant(): "light" | "bold" {
    return theme?.variants?.headerStyle === "bold" ? "bold" : "light";
  }
  function setHeaderBg(hex: string) {
    setPath(["header", activeHeaderVariant(), "bg"], hex);
  }
  function setHeaderFg(hex: string) {
    setPath(["header", activeHeaderVariant(), "fg"], hex);
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
  <SettingsSection title="Surfaces" description="Row backgrounds and the banding partner. Without a JS resolver, the panel writes both the surface role and the row binding so the change is visible immediately.">
    <ColorField label="Background"  value={theme.row?.base?.bg ?? theme.surface?.base ?? "#ffffff"} onchange={setBackground} />
    <ColorField label="Banding partner" hint="Alt-row background"
                value={theme.row?.alt?.bg ?? theme.surface?.muted ?? "#f8fafc"} onchange={setBandingPartner} />
  </SettingsSection>

  <SettingsSection title="Content" description="Text tones. Primary is body; secondary is subtitles/captions; muted is axis labels and footnotes.">
    <ColorField label="Foreground" hint="Body and cell text" value={theme.cell?.fg ?? theme.content?.primary ?? "#000000"} onchange={setForeground} />
    <ColorField label="Secondary"  value={theme.content?.secondary ?? "#444444"} onchange={(v) => setPath(["content","secondary"], v)} />
    <ColorField label="Muted"      hint="Axis labels, footnotes" value={theme.content?.muted     ?? "#888888"} onchange={(v) => setPath(["content","muted"],     v)} />
    <ColorField label="Inverse"    hint="Text on dark fills (bold-mode header)"
                value={theme.content?.inverse ?? "#ffffff"} onchange={(v) => setPath(["content","inverse"], v)} />
  </SettingsSection>

  <SettingsSection title="Header" description="Column-header band. Variant chosen on the Layout tab; these fields edit the *active* variant's colors so the change is visible immediately.">
    <ColorField label="Header background"
                value={(theme.variants?.headerStyle === "bold" ? theme.header?.bold?.bg : theme.header?.light?.bg) ?? "#f8fafc"}
                onchange={setHeaderBg} />
    <ColorField label="Header text"
                value={(theme.variants?.headerStyle === "bold" ? theme.header?.bold?.fg : theme.header?.light?.fg) ?? "#000000"}
                onchange={setHeaderFg} />
  </SettingsSection>

  <SettingsSection title="Dividers" description="Cell hairlines and stronger rules under header / group rows.">
    <ColorField label="Subtle" hint="Cell borders" value={theme.cell?.border ?? theme.divider?.subtle ?? "#e2e8f0"} onchange={setBorder} />
    <ColorField label="Strong" hint="Header rule, group rules" value={theme.divider?.strong ?? "#94a3b8"} onchange={(v) => setPath(["divider","strong"], v)} />
  </SettingsSection>

  <SettingsSection title="Accent" description="Drives the row-accent semantic, hover/selected fills, and L1 group bar.">
    <ColorField label="Accent"
                value={theme.accent?.default ?? "#8b5cf6"}
                onchange={(v) => {
                  setPath(["accent", "default"], v);
                  setPath(["row", "accent", "fg"], v);
                  setPath(["row", "accent", "markerFill"], v);
                }} />
    <ColorField label="Hover / selected fill" value={theme.accent?.muted ?? "#dde1e7"}
                onchange={(v) => {
                  setPath(["accent", "muted"], v);
                  setPath(["row", "hover", "bg"], v);
                  setPath(["row", "selected", "bg"], v);
                }} />
    <ColorField label="L1 group bar"     value={theme.accent?.tintSubtle ?? theme.row_group?.L1?.bg ?? "#e1e5ea"}
                onchange={(v) => {
                  setPath(["accent", "tintSubtle"], v);
                  setPath(["rowGroup", "L1", "bg"], v);
                }} />
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

  <SettingsSection title="Fonts" description="Body is the primary face for cells, headers, labels; display is for titles.">
    <FontFamilyPicker
      label="Body"
      value={theme.text?.body?.family ?? inputs?.fontBody ?? "system-ui"}
      onchange={(v) => {
        // Write to every text role's family AND mirror onto inputs for source export.
        setPath(["inputs", "fontBody"], v);
        for (const role of ["body", "cell", "label", "tick", "footnote", "caption", "subtitle"]) {
          setPath(["text", role, "family"], v);
        }
      }}
    />
    <FontFamilyPicker
      label="Display"
      value={theme.text?.title?.family ?? inputs?.fontDisplay ?? inputs?.fontBody ?? "system-ui"}
      onchange={(v) => {
        setPath(["inputs", "fontDisplay"], v);
        setPath(["text", "title", "family"], v);
      }}
    />
    <FontFamilyPicker
      label="Mono"
      value={inputs?.fontMono ?? ""}
      onchange={(v) => setPath(["inputs", "fontMono"], v)}
    />
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

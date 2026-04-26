<script lang="ts">
  // v2 Theme tab — identity-first restructure (sprint 4 of theming-v2 polish).
  //
  // Section order: Brand · Fonts · Text colors · Surfaces · Header · Accent
  //   · Dividers · Series (compact) · Status. The Summary section is gone;
  //   the pooled-effect diamond reads from series[0] now.
  //
  // Brand is a multi-write knob: editing it mirrors to inputs.brandDeep,
  //   series[0].fill, and header.bold.bg / header.bold.rule, *unless* the
  //   user has overridden those paths (per-field dot indicator + reset).
  //
  // The frontend has no JS resolver, so for resolved leaf paths the panel
  //   continues to write the rendered slot directly (see surface/header
  //   multi-writes below) — same pattern as the prior version.
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
  function setDerived(path: (string | number)[], value: unknown) {
    store.setThemeFieldDerived(path, value);
  }
  function isOver(path: (string | number)[]): boolean {
    return store.isOverridden(path);
  }
  function clearOver(path: (string | number)[]) {
    store.clearOverride(path);
  }

  // ── Brand multi-write ────────────────────────────────────────────────
  // The Brand color is the visible identity knob. Editing it cascades into
  // brandDeep, series[0].fill, and the bold-mode header band — but only
  // for paths the user hasn't pinned. setThemeFieldDerived is a no-op
  // when the path is already overridden, so a user-pinned brandDeep
  // survives Brand re-edits.
  function applyBrand(hex: string) {
    setPath(["inputs", "brand"], hex);
    setDerived(["inputs", "brandDeep"], hex);
    setDerived(["series", 0, "fill"], hex);
    setDerived(["header", "bold", "bg"], hex);
    setDerived(["header", "bold", "rule"], hex);
  }
  function applyBrandDeep(hex: string) {
    setPath(["inputs", "brandDeep"], hex);
    // header.bold.bg / .rule cascade off brand_deep on the R side; mirror
    // here unless the user has pinned them.
    setDerived(["header", "bold", "bg"], hex);
    setDerived(["header", "bold", "rule"], hex);
  }
  function resetBrandDeep() {
    clearOver(["inputs", "brandDeep"]);
    const brand = (inputs?.brand as string | undefined) ?? "#0891B2";
    applyBrandDeep(brand);
  }
  function resetSeriesPrimary() {
    clearOver(["series", 0, "fill"]);
    const brand = (inputs?.brand as string | undefined) ?? "#0891B2";
    setDerived(["series", 0, "fill"], brand);
  }
  function resetHeaderBoldBg() {
    clearOver(["header", "bold", "bg"]);
    const deep = (inputs?.brandDeep as string | undefined) ?? (inputs?.brand as string | undefined) ?? "#0891B2";
    setDerived(["header", "bold", "bg"], deep);
  }

  // ── Surface multi-write (resolved leaves) ────────────────────────────
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

  // ── Header (variant-aware) ───────────────────────────────────────────
  function activeHeaderVariant(): "light" | "bold" {
    return theme?.variants?.headerStyle === "bold" ? "bold" : "light";
  }
  function setHeaderBg(hex: string) {
    setPath(["header", activeHeaderVariant(), "bg"], hex);
  }
  function setHeaderFg(hex: string) {
    setPath(["header", activeHeaderVariant(), "fg"], hex);
  }

  // ── Series (compact list) ────────────────────────────────────────────
  function setSeriesFill(idx: number, hex: string) {
    setPath(["series", idx, "fill"], hex);
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
    const series = (theme?.series ?? []) as unknown[];
    const trimmed = series.slice();
    trimmed.splice(idx, 1);
    setPath(["series"], trimmed);
  }
</script>

{#if theme}
  <SettingsSection title="Brand" description="The single identity knob. Cascades to the deep companion, the primary-effect mark, and the bold-mode header band — except where you've pinned a downstream value (●).">
    <div class="brand-row">
      <ColorField
        label="Brand"
        value={(inputs?.brand as string | undefined) ?? theme.accent?.default ?? "#0891B2"}
        onchange={applyBrand}
      />
      <ColorField
        label="Brand (deep)"
        hint="Bold-mode header band; rule lines under header"
        value={(inputs?.brandDeep as string | undefined) ?? (inputs?.brand as string | undefined) ?? "#06657E"}
        onchange={applyBrandDeep}
        overridden={isOver(["inputs", "brandDeep"])}
        onreset={resetBrandDeep}
      />
    </div>
  </SettingsSection>

  <SettingsSection title="Fonts" description="Body is the primary face for cells, headers, labels; display is for plot titles only.">
    <FontFamilyPicker
      label="Body"
      value={theme.text?.body?.family ?? inputs?.fontBody ?? "system-ui"}
      onchange={(v) => {
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

  <SettingsSection title="Text colors" description="Primary is body; secondary is subtitles/captions; muted is axis labels and footnotes.">
    <ColorField label="Foreground" hint="Body and cell text" value={theme.cell?.fg ?? theme.content?.primary ?? "#000000"} onchange={setForeground} />
    <ColorField label="Secondary"  value={theme.content?.secondary ?? "#444444"} onchange={(v) => setPath(["content","secondary"], v)} />
    <ColorField label="Muted"      hint="Axis labels, footnotes" value={theme.content?.muted ?? "#888888"} onchange={(v) => setPath(["content","muted"], v)} />
    <ColorField label="Inverse"    hint="Text on dark fills (bold-mode header)" value={theme.content?.inverse ?? "#ffffff"} onchange={(v) => setPath(["content","inverse"], v)} />
  </SettingsSection>

  <SettingsSection title="Surfaces" description="Row backgrounds and the banding partner. The panel writes both the surface role and the row binding so the change is visible immediately.">
    <ColorField label="Background"      value={theme.row?.base?.bg ?? theme.surface?.base ?? "#ffffff"} onchange={setBackground} />
    <ColorField label="Banding partner" hint="Alt-row background" value={theme.row?.alt?.bg ?? theme.surface?.muted ?? "#f8fafc"} onchange={setBandingPartner} />
  </SettingsSection>

  <SettingsSection title="Header" description="Column-header band. Variant chosen on the Layout tab; these fields edit the active variant's colors so the change is visible immediately.">
    <ColorField label="Header background"
                value={(theme.variants?.headerStyle === "bold" ? theme.header?.bold?.bg : theme.header?.light?.bg) ?? "#f8fafc"}
                onchange={setHeaderBg}
                overridden={theme.variants?.headerStyle === "bold" && isOver(["header", "bold", "bg"])}
                onreset={theme.variants?.headerStyle === "bold" ? resetHeaderBoldBg : undefined} />
    <ColorField label="Header text"
                value={(theme.variants?.headerStyle === "bold" ? theme.header?.bold?.fg : theme.header?.light?.fg) ?? "#000000"}
                onchange={setHeaderFg} />
  </SettingsSection>

  <SettingsSection title="Accent" description="Independent identity knob — drives the row-accent semantic, hover/selected fills, and the L1 group bar. Brand and Accent are deliberately independent.">
    <div class="brand-row">
      <ColorField
        label="Accent"
        value={(inputs?.accent as string | undefined) ?? theme.accent?.default ?? "#8B5CF6"}
        onchange={(v) => {
          setPath(["inputs", "accent"], v);
          setPath(["accent", "default"], v);
          setPath(["row", "accent", "fg"], v);
          setPath(["row", "accent", "markerFill"], v);
        }} />
      <ColorField
        label="Accent (deep)"
        hint="Reserved for future deep-accent surfaces"
        value={(inputs?.accentDeep as string | undefined) ?? (inputs?.accent as string | undefined) ?? "#6D28D9"}
        onchange={(v) => setPath(["inputs", "accentDeep"], v)}
        overridden={isOver(["inputs", "accentDeep"])}
        onreset={() => {
          clearOver(["inputs", "accentDeep"]);
          const a = (inputs?.accent as string | undefined) ?? "#8B5CF6";
          setDerived(["inputs", "accentDeep"], a);
        }} />
    </div>
    <ColorField label="Hover / selected fill" value={theme.accent?.muted ?? "#dde1e7"}
                onchange={(v) => {
                  setPath(["accent", "muted"], v);
                  setPath(["row", "hover", "bg"], v);
                  setPath(["row", "selected", "bg"], v);
                }} />
    <ColorField label="L1 group bar" value={theme.accent?.tintSubtle ?? "#e1e5ea"}
                onchange={(v) => {
                  setPath(["accent", "tintSubtle"], v);
                  setPath(["rowGroup", "L1", "bg"], v);
                }} />
  </SettingsSection>

  <SettingsSection title="Dividers" description="Cell hairlines and stronger rules under header / group rows.">
    <ColorField label="Subtle" hint="Cell borders" value={theme.cell?.border ?? theme.divider?.subtle ?? "#e2e8f0"} onchange={setBorder} />
    <ColorField label="Strong" hint="Header rule, group rules" value={theme.divider?.strong ?? "#94a3b8"} onchange={(v) => setPath(["divider","strong"], v)} />
  </SettingsSection>

  <SettingsSection title="Series" description="Per-effect anchor colors. Series 1 is the primary-effect anchor — it also drives the pooled-effect diamond. Per-series stroke / muted / emphasis bundle on the Marks tab.">
    {#if Array.isArray(theme.series)}
      {#each theme.series as slot, i (i)}
        <div class="series-row">
          <ColorField
            label={`Series ${i + 1}`}
            value={slot?.fill ?? "#888888"}
            onchange={(v) => setSeriesFill(i, v)}
            overridden={i === 0 ? isOver(["series", 0, "fill"]) : undefined}
            onreset={i === 0 ? resetSeriesPrimary : undefined}
          />
          <button class="series-remove" onclick={() => removeSeries(i)} aria-label="Remove series">×</button>
        </div>
      {/each}
    {/if}
    <button class="series-add" onclick={addSeries}>+ Add series</button>
  </SettingsSection>

  <SettingsSection title="Status" description="Semantic indicator colors.">
    <ColorField label="Positive" value={theme.status?.positive ?? "#3F7D3F"} onchange={(v) => setPath(["status","positive"], v)} />
    <ColorField label="Negative" value={theme.status?.negative ?? "#B33A3A"} onchange={(v) => setPath(["status","negative"], v)} />
    <ColorField label="Warning"  value={theme.status?.warning  ?? "#C68A2E"} onchange={(v) => setPath(["status","warning"], v)} />
    <ColorField label="Info"     value={theme.status?.info     ?? theme.accent?.default ?? "#2C4F7C"} onchange={(v) => setPath(["status","info"], v)} />
  </SettingsSection>
{/if}

<style>
  .brand-row {
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
  }
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

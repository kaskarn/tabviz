<script lang="ts">
  // v2 Theme tab — round 2 (cascade-completion polish).
  //
  // Section order: Identity (Brand + Brand-deep + Accent) · Fonts · Text colors
  //   · Surfaces · Header · Plot · Selection & accents · Dividers · Series
  //   · Status.
  //
  // Brand and Accent are both multi-write knobs:
  //   Brand cascades to inputs.brandDeep, series[0].fill, header.bold.bg/.rule,
  //   text.title.fg, plot.axisLabel.fg / .tickLabel.fg, divider.subtle (8%
  //   brand-tinted), cell.border, and rowGroup.L1.bg (15% brand-tint when
  //   header_style=bold; under light it stays on accent.tintSubtle and is
  //   driven by Accent instead).
  //   Accent cascades to accent.default/.muted/.tintSubtle, row.accent.*,
  //   row.hover.bg, row.selected.bg, and rowGroup.L1.bg under light-mode
  //   header.
  //   Each downstream path is gated by setThemeFieldDerived (skip-if-pinned).
  //
  // The frontend has no JS resolver, so for resolved leaf paths the panel
  //   continues to write the rendered slot directly. Brand-mix expressions
  //   use CSS `color-mix(in oklch, ...)` which modern browsers resolve at
  //   render time — matches the R-side OKLCH derivation closely enough that
  //   a re-resolve isn't needed to feel responsive.
  import type { ForestStore } from "$stores/forestStore.svelte";
  import SettingsSection from "./SettingsSection.svelte";
  import ColorField from "./ColorField.svelte";
  import FontFamilyPicker from "./FontFamilyPicker.svelte";
  import { oklchDarken, oklchMix, oklchChroma } from "$lib/oklch";

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

  // ── Cascade helpers ─────────────────────────────────────────────────
  // Mirrors R-side `oklch_*` recipes from R/utils-theme-resolve.R. The
  // panel runs these client-side so Brand/Accent edits propagate through
  // every derived field without a server round-trip — values written to
  // the wire are concrete hex (picker-compatible), not color-mix() strings.
  function neutralBaseline(): string {
    const n = inputs?.neutral as string[] | undefined;
    return n?.[2] ?? "#cbd5e1";
  }
  function surfaceBaseline(): string {
    return theme?.surface?.base ?? "#ffffff";
  }
  function contentInverseBaseline(): string {
    return theme?.content?.inverse ?? "#ffffff";
  }
  function brandTintedSubtleDivider(brandDeepHex: string): string {
    // Resolver: oklch_mix(neutral_baseline_30%_to_n4, brand_deep, 0.12).
    // n4 isn't accessible client-side; nudge from neutral[3] toward brand.
    return oklchMix(neutralBaseline(), brandDeepHex, 0.12);
  }
  function brandTintedSurfaceMuted(brandDeepHex: string): string {
    // Resolver: surface.muted = oklch_mix(n[3], brand_deep, 0.03) — the
    // chrome surface used for the light-mode header band. 3% picks up
    // the brand identity without overwhelming the chrome neutral.
    return oklchMix(neutralBaseline(), brandDeepHex, 0.03);
  }
  function brandTintedAltSurface(brandDeepHex: string): string {
    // Resolver: row.alt.bg = oklch_mix(surface.base, surface.muted, 0.5) —
    // the alt-row banding is HALF-strength of muted from base, so it reads
    // as subtler than the header band.
    return oklchMix(surfaceBaseline(), brandTintedSurfaceMuted(brandDeepHex), 0.5);
  }
  function brandTintedL1Bg(brandDeepHex: string): string {
    // Resolver: oklch_mix(surface.base, brand_deep, 0.15) under bold-mode.
    return oklchMix(surfaceBaseline(), brandDeepHex, 0.15);
  }
  function strongOnDarkRule(brandDeepHex: string): string {
    // Resolver: divider.strong_on_dark = oklch_mix(content.inverse, brand_deep, 0.40).
    return oklchMix(contentInverseBaseline(), brandDeepHex, 0.40);
  }
  function accentMutedHex(accentHex: string): string {
    return oklchMix(accentHex, surfaceBaseline(), 0.88);
  }
  function accentTintSubtleHex(accentHex: string): string {
    return oklchMix(accentHex, surfaceBaseline(), 0.90);
  }
  function accentTintMediumHex(accentHex: string): string {
    return oklchMix(accentHex, surfaceBaseline(), 0.75);
  }
  // Per-anchor 7-field SlotBundle derivation — mirrors R's derive_slot_bundle.
  function deriveSlotBundle(anchorHex: string) {
    const surface = surfaceBaseline();
    const fill = anchorHex;
    const stroke = oklchDarken(anchorHex, 0.10);
    const fillMuted = oklchMix(anchorHex, surface, 0.65);
    const strokeMuted = oklchDarken(fillMuted, 0.10);
    const fillEmphasis = oklchChroma(oklchDarken(anchorHex, 0.05), 0.04);
    const strokeEmphasis = oklchDarken(anchorHex, 0.20);
    return { fill, stroke, fillMuted, strokeMuted, fillEmphasis, strokeEmphasis };
    // text_fg defaults to content.primary; brand changes don't perturb it.
  }

  // ── Brand multi-write ────────────────────────────────────────────────
  // Brand changes cascade through every R-side derivation that reads
  // brand or brand_deep. Each downstream path is gated by
  // setThemeFieldDerived so user-pinned fields are preserved.
  function applyBrand(hex: string) {
    setPath(["inputs", "brand"], hex);
    // brand_deep defaults to a 15% OKLCH-darkened brand (matches R-side
    // resolve_inputs_mirrors). If user pinned brand_deep, downstream paths
    // follow the pin instead of the freshly-derived dark.
    const brandDeep = isOver(["inputs", "brandDeep"])
      ? ((inputs?.brandDeep as string | undefined) ?? oklchDarken(hex, 0.15))
      : oklchDarken(hex, 0.15);
    setDerived(["inputs", "brandDeep"], brandDeep);
    cascadeBrand(hex);
    cascadeBrandDeep(brandDeep);
  }
  function applyBrandDeep(hex: string) {
    setPath(["inputs", "brandDeep"], hex);
    cascadeBrandDeep(hex);
  }
  /** Brand drives the primary-effect series anchor (full 7-field bundle). */
  function cascadeBrand(brand: string) {
    const bundle = deriveSlotBundle(brand);
    setDerived(["series", 0, "fill"],            bundle.fill);
    setDerived(["series", 0, "stroke"],          bundle.stroke);
    setDerived(["series", 0, "fillMuted"],       bundle.fillMuted);
    setDerived(["series", 0, "strokeMuted"],     bundle.strokeMuted);
    setDerived(["series", 0, "fillEmphasis"],    bundle.fillEmphasis);
    setDerived(["series", 0, "strokeEmphasis"],  bundle.strokeEmphasis);
    // Mirror onto inputs.seriesAnchors[0] so source-export sees the edit.
    const anchors = (inputs?.seriesAnchors as string[] | undefined)?.slice() ?? [];
    if (anchors.length > 0 && anchors[0] !== brand) {
      anchors[0] = brand;
      setDerived(["inputs", "seriesAnchors"], anchors);
    }
  }
  /** Brand-deep drives every Tier-3 binding the R resolver reads brand_deep into. */
  function cascadeBrandDeep(brandDeep: string) {
    const strongRule = strongOnDarkRule(brandDeep);
    setDerived(["header", "bold", "bg"], brandDeep);
    setDerived(["header", "bold", "rule"], strongRule);
    setDerived(["columnGroup", "bold", "bg"], brandDeep);
    setDerived(["columnGroup", "bold", "rule"], strongRule);
    setDerived(["divider", "strongOnDark"], strongRule);
    setDerived(["text", "title", "fg"], brandDeep);
    setDerived(["plot", "axisLabel", "fg"], brandDeep);
    setDerived(["plot", "tickLabel", "fg"], brandDeep);
    const tintedSubtle = brandTintedSubtleDivider(brandDeep);
    setDerived(["divider", "subtle"], tintedSubtle);
    setDerived(["cell", "border"], tintedSubtle);
    // surface.muted is the chrome-surface tone used for the light-mode
    // header band (and other muted chrome). row.alt.bg is HALF-strength
    // of that — keeps banding clearly subtler than the header. Mirror
    // both, plus header.light.bg which would otherwise freeze on its
    // resolved-at-load value (the frontend has no JS resolver).
    const tintedMuted = brandTintedSurfaceMuted(brandDeep);
    const tintedAlt   = brandTintedAltSurface(brandDeep);
    setDerived(["surface", "muted"], tintedMuted);
    setDerived(["header", "light", "bg"], tintedMuted);
    setDerived(["columnGroup", "light", "bg"], tintedMuted);
    setDerived(["firstColumn", "bold", "bg"], tintedMuted);
    setDerived(["row", "alt", "bg"], tintedAlt);
    // L1.bg is variant-aware. Bold header → brand-mix, light header → accent
    // (the Accent multi-write covers light-mode L1 below).
    if (theme?.variants?.headerStyle === "bold") {
      setDerived(["rowGroup", "L1", "bg"], brandTintedL1Bg(brandDeep));
    }
  }

  function resetBrandDeep() {
    clearOver(["inputs", "brandDeep"]);
    const brand = (inputs?.brand as string | undefined) ?? "#0891B2";
    // The default derived value: 15% darker than brand. Re-apply the full
    // brand_deep cascade so all downstream fields refresh in lockstep.
    applyBrandDeep(oklchDarken(brand, 0.15));
  }
  function resetSeriesPrimary() {
    clearOver(["series", 0, "fill"]);
    const brand = (inputs?.brand as string | undefined) ?? "#0891B2";
    cascadeBrand(brand);
  }
  function resetTitleFg() {
    clearOver(["text", "title", "fg"]);
    const brandDeep = (inputs?.brandDeep as string | undefined) ?? (inputs?.brand as string | undefined) ?? "#0891B2";
    setDerived(["text", "title", "fg"], brandDeep);
  }
  function resetAxisLabelFg() {
    clearOver(["plot", "axisLabel", "fg"]);
    const brandDeep = (inputs?.brandDeep as string | undefined) ?? (inputs?.brand as string | undefined) ?? "#0891B2";
    setDerived(["plot", "axisLabel", "fg"], brandDeep);
  }
  function resetTickLabelFg() {
    clearOver(["plot", "tickLabel", "fg"]);
    const brandDeep = (inputs?.brandDeep as string | undefined) ?? (inputs?.brand as string | undefined) ?? "#0891B2";
    setDerived(["plot", "tickLabel", "fg"], brandDeep);
  }
  function resetSubtleDivider() {
    clearOver(["divider", "subtle"]);
    clearOver(["cell", "border"]);
    const brandDeep = (inputs?.brandDeep as string | undefined) ?? (inputs?.brand as string | undefined) ?? "#0891B2";
    const tinted = brandTintedSubtleDivider(brandDeep);
    setDerived(["divider", "subtle"], tinted);
    setDerived(["cell", "border"], tinted);
  }
  function resetL1Bg() {
    clearOver(["rowGroup", "L1", "bg"]);
    const value = theme?.variants?.headerStyle === "bold"
      ? brandTintedL1Bg((inputs?.brandDeep as string | undefined) ?? oklchDarken((inputs?.brand as string | undefined) ?? "#0891B2", 0.15))
      : ((theme?.accent?.tintSubtle as string | undefined) ?? accentTintSubtleHex((inputs?.accent as string | undefined) ?? "#8B5CF6"));
    setDerived(["rowGroup", "L1", "bg"], value);
  }
  function resetHeaderBoldBg() {
    clearOver(["header", "bold", "bg"]);
    const deep = (inputs?.brandDeep as string | undefined) ?? (inputs?.brand as string | undefined) ?? "#0891B2";
    setDerived(["header", "bold", "bg"], deep);
  }

  // ── Accent multi-write ──────────────────────────────────────────────
  // Same shape as Brand: cascade through every R-side derivation that
  // reads accent or accent_deep, gated by setThemeFieldDerived.
  function applyAccent(hex: string) {
    setPath(["inputs", "accent"], hex);
    // accent_deep mirrors accent darkened by 15% (matches resolver).
    const accentDeep = isOver(["inputs", "accentDeep"])
      ? ((inputs?.accentDeep as string | undefined) ?? oklchDarken(hex, 0.15))
      : oklchDarken(hex, 0.15);
    setDerived(["inputs", "accentDeep"], accentDeep);
    cascadeAccent(hex);
  }
  function cascadeAccent(accent: string) {
    const muted       = accentMutedHex(accent);
    const tintSubtle  = accentTintSubtleHex(accent);
    const tintMedium  = accentTintMediumHex(accent);
    setDerived(["accent", "default"],     accent);
    setDerived(["accent", "muted"],       muted);
    setDerived(["accent", "tintSubtle"],  tintSubtle);
    setDerived(["accent", "tintMedium"],  tintMedium);
    setDerived(["row", "accent", "fg"],         accent);
    setDerived(["row", "accent", "markerFill"], accent);
    setDerived(["row", "hover", "bg"],     muted);
    setDerived(["row", "selected", "bg"],  muted);
    // status.info defaults to accent when NA on the R side.
    if (!inputs?.statusInfo) {
      setDerived(["status", "info"], accent);
    }
    // Light-mode L1 is accent-derived. Bold-mode L1 follows brand instead
    // (handled by Brand multi-write).
    if (theme?.variants?.headerStyle !== "bold") {
      setDerived(["rowGroup", "L1", "bg"], tintSubtle);
    }
  }

  // ── Inverse content cascade ─────────────────────────────────────────
  // content.inverse lands on bold-mode header text and is the light-tone
  // input to divider.strong_on_dark. Editing it from the panel must
  // refresh both the bold header band's fg AND the rule mix that contrasts
  // against the band — otherwise the inverse field reads as broken.
  function setInverseContent(hex: string) {
    setPath(["content", "inverse"], hex);
    setDerived(["header", "bold", "fg"], hex);
    setDerived(["columnGroup", "bold", "fg"], hex);
    // strong_on_dark mixes inverse and brand_deep; recompute and re-feed
    // header.bold.rule + column_group.bold.rule.
    const brandDeep = (inputs?.brandDeep as string | undefined)
      ?? oklchDarken((inputs?.brand as string | undefined) ?? "#0891B2", 0.15);
    const strongRule = oklchMix(hex, brandDeep, 0.40);
    setDerived(["divider", "strongOnDark"], strongRule);
    setDerived(["header", "bold", "rule"], strongRule);
    setDerived(["columnGroup", "bold", "rule"], strongRule);
  }

  // ── Strong-divider cascade ──────────────────────────────────────────
  // R-side: header.light.rule, column_group.light.rule, row_group.L1.rule,
  // and the entire forest plot scaffold (axis_line, tick_mark, reference)
  // all default to divider.strong. The panel's Strong field has to mirror
  // those leaves or the edit silently does nothing.
  function setStrongDivider(hex: string) {
    setPath(["divider", "strong"], hex);
    setDerived(["header", "light", "rule"], hex);
    setDerived(["columnGroup", "light", "rule"], hex);
    setDerived(["rowGroup", "L1", "rule"], hex);
    setDerived(["plot", "axisLine"], hex);
    setDerived(["plot", "tickMark"], hex);
    setDerived(["plot", "reference"], hex);
  }

  // ── Surface multi-write (resolved leaves) ────────────────────────────
  function setBackground(hex: string) {
    setPath(["surface", "base"], hex);
    setPath(["row", "base", "bg"], hex);
  }
  function setBandingPartner(hex: string) {
    // Banding partner targets row.alt.bg specifically. surface.muted is
    // the chrome-header tone now — separate concept.
    setPath(["row", "alt", "bg"], hex);
  }
  function setForeground(hex: string) {
    setPath(["content", "primary"], hex);
    setPath(["cell", "fg"], hex);
    setPath(["row", "base", "fg"], hex);
    setPath(["row", "alt",  "fg"], hex);
    // R-side default: header.light.fg, columnGroup.light.fg, firstColumn.bold.fg,
    // rowGroup.L1.fg all read content.primary. Mirror them via setDerived so a
    // user pin survives.
    setDerived(["header", "light", "fg"], hex);
    setDerived(["columnGroup", "light", "fg"], hex);
    setDerived(["firstColumn", "bold", "fg"], hex);
    setDerived(["rowGroup", "L1", "fg"], hex);
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
  <SettingsSection title="Identity" description="Brand and Accent are the two-knob identity. Editing either cascades to all the places it lands (header band, series, title, axis labels, hover, group bar, …) — except where you've pinned a downstream value (●).">
    <div class="identity-row">
      <ColorField
        label="Brand"
        value={(inputs?.brand as string | undefined) ?? theme.accent?.default ?? "#0891B2"}
        onchange={applyBrand}
      />
      <ColorField
        label="Brand (deep)"
        hint="Bold-mode header band; title; axis labels; subtle borders"
        value={(inputs?.brandDeep as string | undefined) ?? (inputs?.brand as string | undefined) ?? "#06657E"}
        onchange={applyBrandDeep}
        overridden={isOver(["inputs", "brandDeep"])}
        onreset={resetBrandDeep}
      />
      <ColorField
        label="Accent"
        hint="Hover, selected, L1 group bar (light-mode header)"
        value={(inputs?.accent as string | undefined) ?? theme.accent?.default ?? "#8B5CF6"}
        onchange={applyAccent}
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

  <SettingsSection title="Text colors" description="Primary is body; secondary is subtitles/captions; muted is footnotes.">
    <ColorField label="Foreground" hint="Body and cell text" value={theme.cell?.fg ?? theme.content?.primary ?? "#000000"} onchange={setForeground} />
    <ColorField label="Secondary"  value={theme.content?.secondary ?? "#444444"} onchange={(v) => setPath(["content","secondary"], v)} />
    <ColorField label="Muted"      hint="Footnotes" value={theme.content?.muted ?? "#888888"} onchange={(v) => setPath(["content","muted"], v)} />
    <ColorField label="Inverse"    hint="Text on dark fills (bold-mode header). Cascades to header.bold.fg and the strong_on_dark rule mix." value={theme.content?.inverse ?? "#ffffff"} onchange={setInverseContent} />
  </SettingsSection>

  <SettingsSection title="Surfaces" description="Row backgrounds and the banding partner. The panel writes both the surface role and the row binding so the change is visible immediately.">
    <ColorField label="Background"      value={theme.row?.base?.bg ?? theme.surface?.base ?? "#ffffff"} onchange={setBackground} />
    <ColorField label="Banding partner" hint="Alt-row background" value={theme.row?.alt?.bg ?? theme.surface?.muted ?? "#f8fafc"} onchange={setBandingPartner} />
  </SettingsSection>

  <SettingsSection title="Header" description="Column-header band. Variant chosen on the Layout tab; these fields edit the active variant's colors.">
    <ColorField label="Header background"
                value={(theme.variants?.headerStyle === "bold" ? theme.header?.bold?.bg : theme.header?.light?.bg) ?? "#f8fafc"}
                onchange={setHeaderBg}
                overridden={theme.variants?.headerStyle === "bold" && isOver(["header", "bold", "bg"])}
                onreset={theme.variants?.headerStyle === "bold" ? resetHeaderBoldBg : undefined} />
    <ColorField label="Header text"
                value={(theme.variants?.headerStyle === "bold" ? theme.header?.bold?.fg : theme.header?.light?.fg) ?? "#000000"}
                onchange={setHeaderFg} />
  </SettingsSection>

  <SettingsSection title="Plot" description="Title and forest-axis text colors. Default to Brand-deep; pin per-field to break from the cascade.">
    <ColorField label="Title color"
                value={(theme.text?.title?.fg as string | undefined) ?? (inputs?.brandDeep as string | undefined) ?? "#1A1A1A"}
                onchange={(v) => setPath(["text", "title", "fg"], v)}
                overridden={isOver(["text", "title", "fg"])}
                onreset={resetTitleFg} />
    <ColorField label="Axis label color"
                value={(theme.plot?.axisLabel?.fg as string | undefined) ?? (inputs?.brandDeep as string | undefined) ?? "#1A1A1A"}
                onchange={(v) => setPath(["plot", "axisLabel", "fg"], v)}
                overridden={isOver(["plot", "axisLabel", "fg"])}
                onreset={resetAxisLabelFg} />
    <ColorField label="Axis tick color"
                value={(theme.plot?.tickLabel?.fg as string | undefined) ?? (inputs?.brandDeep as string | undefined) ?? "#1A1A1A"}
                onchange={(v) => setPath(["plot", "tickLabel", "fg"], v)}
                overridden={isOver(["plot", "tickLabel", "fg"])}
                onreset={resetTickLabelFg} />
  </SettingsSection>

  <SettingsSection title="Selection & accents" description="Per-row interaction tones plus the L1 group-bar fill.">
    <ColorField label="Hover / selected fill" value={theme.accent?.muted ?? "#dde1e7"}
                onchange={(v) => {
                  setPath(["accent", "muted"], v);
                  setPath(["row", "hover", "bg"], v);
                  setPath(["row", "selected", "bg"], v);
                }} />
    <ColorField label="L1 group bar"
                hint={theme.variants?.headerStyle === "bold" ? "Brand-deep mix in bold-header mode" : "Accent tint in light-header mode"}
                value={(theme.rowGroup?.L1?.bg as string | undefined) ?? theme.accent?.tintSubtle ?? "#e1e5ea"}
                onchange={(v) => setPath(["rowGroup", "L1", "bg"], v)}
                overridden={isOver(["rowGroup", "L1", "bg"])}
                onreset={resetL1Bg} />
  </SettingsSection>

  <SettingsSection title="Dividers" description="Cell hairlines and the strong rules under header / group rows.">
    <ColorField label="Subtle" hint="Cell borders (default: 8% Brand-deep tint)"
                value={theme.cell?.border ?? theme.divider?.subtle ?? "#e2e8f0"}
                onchange={(v) => {
                  setPath(["divider", "subtle"], v);
                  setPath(["cell", "border"], v);
                }}
                overridden={isOver(["divider", "subtle"]) || isOver(["cell", "border"])}
                onreset={resetSubtleDivider} />
    <ColorField label="Strong" hint="Header rule (light variant), group rules, axis line, tick marks"
                value={theme.divider?.strong ?? "#94a3b8"}
                onchange={setStrongDivider} />
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
  .identity-row {
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

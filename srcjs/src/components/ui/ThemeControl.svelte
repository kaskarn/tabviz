<script lang="ts">
  // Theme tab — primary/secondary identity + accent engagement.
  //
  // T1 inputs (identity, 2-tier mirror chain): primary, primary_deep,
  // secondary, secondary_deep. NA secondary mirrors primary; each _deep
  // auto-derives via oklch_darken(seed, 0.15) when not pinned, except
  // secondary_deep mirrors primary_deep when secondary itself is NA.
  //
  // T1 inputs (engagement, orthogonal): accent, accent_deep. Reserved for
  // layered emphasis (hover, selected, semantic row callouts, status.info
  // fallback). Does NOT enter the identity mirror chain.
  //
  // Cascade summary (mirrors R/utils-theme-resolve.R contract):
  //   primary  → primary_deep (auto unless pinned), text.title.fg,
  //              header.bold.bg, header.bold.rule (component-local mix
  //              against bg), series[0] anchor.
  //   secondary → secondary_deep (auto unless pinned). Owns structure:
  //              columnGroup.bold.bg + rule, rowGroup.L1/L2/L3.bg
  //              (column + row groupings as a coordinated family), AND
  //              chrome texture: surface.muted, divider.subtle,
  //              divider.strong, cell.border, row.alt.bg,
  //              firstColumn.bold.bg. Mirrors primary by default.
  //   accent   → accent_deep (auto), accent.default/.muted/.tint_*,
  //              row.accent.*, row.hover.bg, row.selected.bg, status.info
  //              (fallback), semantic.fill, row.fill.bg.
  //
  // Tertiary was retired 2026-04-29 — its sole job (chrome texture)
  // collapsed onto secondary. See vignettes/theming.Rmd decision log.
  //
  // Each downstream path is gated by setThemeFieldDerived (skip-if-pinned).
  // When primary changes and secondary is mirroring (not pinned), secondary
  // is also rewritten via setDerived, then secondary's cascade runs.

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
  // panel runs these client-side so identity-tier edits propagate through
  // every derived field without a server round-trip.
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
  function lightestNeutral(): string {
    return (theme?.surface as { raised?: string } | undefined)?.raised ?? "#ffffff";
  }
  // Secondary-tinted chrome surfaces (resolver: surface.muted, divider.subtle,
  // divider.strong, alt-row banding all read from the secondary_deep seed
  // via the mirror chain). Chrome owned by secondary post-2026-04-29.
  function chromeTintedSubtleDivider(secondaryDeepHex: string): string {
    return oklchMix(neutralBaseline(), secondaryDeepHex, 0.10);
  }
  function chromeTintedSurfaceMuted(secondaryDeepHex: string): string {
    return oklchMix(neutralBaseline(), secondaryDeepHex, 0.04);
  }
  function chromeTintedAltSurface(secondaryDeepHex: string): string {
    return oklchMix(surfaceBaseline(), chromeTintedSurfaceMuted(secondaryDeepHex), 0.5);
  }
  function chromeTintedStrongDivider(secondaryDeepHex: string): string {
    // R-side: divider.strong = oklch_mix(n[4], secondary_deep, 0.05). n[4]
    // isn't accessible client-side; nudge from neutral[3] toward secondary
    // at 5%. Strong rules stay close to neutral so structural rules don't
    // read as accidental tints.
    return oklchMix(neutralBaseline(), secondaryDeepHex, 0.05);
  }
  // Secondary-tinted L1 row group bg (resolver: oklch_mix(surface.base,
  // secondary_deep, 0.12)). Mirrors column-group bold — structural
  // groupings live consistently on secondary. Strength tracks
  // header_style: 16% under "light" (subtle), 24% under "tint"/"bold"
  // (strong). Mirrors R-side resolve_components — single rule from a
  // single T1 input.
  function l1MixStrength(): number {
    return theme?.variants?.headerStyle === "light" ? 0.16 : 0.24;
  }
  function secondaryTintedL1Bg(secondaryDeepHex: string): string {
    return oklchMix(surfaceBaseline(), secondaryDeepHex, l1MixStrength());
  }
  // Component-local bold-band rule: oklch_mix(content.inverse, <bg>, 0.4).
  // Used for header.bold.rule (against primary_deep) and column_group.bold.rule
  // (against secondary_deep) — each cluster contrasts against its own bg.
  function boldBandRule(bgHex: string): string {
    return oklchMix(contentInverseBaseline(), bgHex, 0.40);
  }

  // Engagement (accent) helpers — unchanged.
  function accentMutedHex(accentHex: string): string {
    return oklchMix(accentHex, surfaceBaseline(), 0.88);
  }
  function semanticFilledTintHex(accentHex: string): string {
    return oklchMix(accentHex, lightestNeutral(), 0.80);
  }
  function accentTintSubtleHex(accentHex: string): string {
    return oklchMix(accentHex, surfaceBaseline(), 0.90);
  }
  function accentTintMediumHex(accentHex: string): string {
    return oklchMix(accentHex, surfaceBaseline(), 0.75);
  }
  // Per-anchor 7-field SlotBundle derivation — mirrors R's derive_slot_bundle.
  // Switches on inputs.slotStyle: "fill_with_darker_stroke" (default) keeps
  // the prior convention; "flat_fill" pairs stroke with fill (no contrast);
  // "outlined" makes fill lean toward surface and stroke carry the anchor.
  function currentSlotStyle(): "fill_with_darker_stroke" | "flat_fill" | "outlined" {
    return inputs?.slotStyle ?? "fill_with_darker_stroke";
  }
  function deriveSlotBundle(anchorHex: string) {
    const surface = surfaceBaseline();
    const fillMuted = oklchMix(anchorHex, surface, 0.65);
    const style = currentSlotStyle();
    if (style === "flat_fill") {
      const emphasis = oklchChroma(oklchDarken(anchorHex, 0.05), 0.04);
      return {
        fill: anchorHex,
        stroke: anchorHex,
        fillMuted,
        strokeMuted: fillMuted,
        fillEmphasis: emphasis,
        strokeEmphasis: emphasis,
      };
    }
    if (style === "outlined") {
      return {
        fill: oklchMix(anchorHex, surface, 0.15),
        stroke: anchorHex,
        fillMuted: oklchMix(anchorHex, surface, 0.08),
        strokeMuted: oklchDarken(fillMuted, 0.10),
        fillEmphasis: oklchMix(anchorHex, surface, 0.30),
        strokeEmphasis: oklchDarken(anchorHex, 0.20),
      };
    }
    // "fill_with_darker_stroke" — default convention.
    return {
      fill: anchorHex,
      stroke: oklchDarken(anchorHex, 0.10),
      fillMuted,
      strokeMuted: oklchDarken(fillMuted, 0.10),
      fillEmphasis: oklchChroma(oklchDarken(anchorHex, 0.05), 0.04),
      strokeEmphasis: oklchDarken(anchorHex, 0.20),
    };
  }

  // Read current values with fallback chain for the mirror semantics.
  function currentPrimary(): string {
    return (inputs?.primary as string | undefined) ?? "#0891B2";
  }
  function currentPrimaryDeep(): string {
    return (inputs?.primaryDeep as string | undefined)
      ?? oklchDarken(currentPrimary(), 0.15);
  }
  function currentSecondary(): string {
    return (inputs?.secondary as string | undefined) ?? currentPrimary();
  }
  function currentSecondaryDeep(): string {
    return (inputs?.secondaryDeep as string | undefined)
      ?? (isOver(["inputs", "secondary"])
        ? oklchDarken(currentSecondary(), 0.15)
        : currentPrimaryDeep());
  }

  // ── Primary cascade ─────────────────────────────────────────────────
  function applyPrimary(hex: string) {
    setPath(["inputs", "primary"], hex);
    // primary_deep auto-derives unless pinned.
    const primaryDeep = isOver(["inputs", "primaryDeep"])
      ? ((inputs?.primaryDeep as string | undefined) ?? oklchDarken(hex, 0.15))
      : oklchDarken(hex, 0.15);
    setDerived(["inputs", "primaryDeep"], primaryDeep);
    cascadePrimary(hex);
    cascadePrimaryDeep(primaryDeep);
    // Mirror chain: if secondary is not pinned, follow primary.
    if (!isOver(["inputs", "secondary"])) {
      setDerived(["inputs", "secondary"], hex);
      const secondaryDeep = isOver(["inputs", "secondaryDeep"])
        ? ((inputs?.secondaryDeep as string | undefined) ?? primaryDeep)
        : primaryDeep;
      setDerived(["inputs", "secondaryDeep"], secondaryDeep);
      cascadeSecondaryDeep(secondaryDeep);
    }
  }
  function applyPrimaryDeep(hex: string) {
    setPath(["inputs", "primaryDeep"], hex);
    cascadePrimaryDeep(hex);
    // If secondary_deep is mirroring primary_deep (which it does in mono
    // when secondary itself is mirroring), follow.
    if (!isOver(["inputs", "secondaryDeep"]) && !isOver(["inputs", "secondary"])) {
      setDerived(["inputs", "secondaryDeep"], hex);
      cascadeSecondaryDeep(hex);
    }
  }
  /** Primary drives the primary-effect series anchor. */
  function cascadePrimary(primary: string) {
    const bundle = deriveSlotBundle(primary);
    setDerived(["series", 0, "fill"],            bundle.fill);
    setDerived(["series", 0, "stroke"],          bundle.stroke);
    setDerived(["series", 0, "fillMuted"],       bundle.fillMuted);
    setDerived(["series", 0, "strokeMuted"],     bundle.strokeMuted);
    setDerived(["series", 0, "fillEmphasis"],    bundle.fillEmphasis);
    setDerived(["series", 0, "strokeEmphasis"],  bundle.strokeEmphasis);
    const anchors = (inputs?.seriesAnchors as string[] | undefined)?.slice() ?? [];
    if (anchors.length > 0 && anchors[0] !== primary) {
      anchors[0] = primary;
      setDerived(["inputs", "seriesAnchors"], anchors);
    }
  }
  /** Primary-deep drives the leaf-header bold + tint bands, the title, and
   * container chrome. Tint bg is a 12% mix of primary_deep into the
   * surface base — mirrors R/utils-theme-resolve.R's tint variant. */
  function cascadePrimaryDeep(primaryDeep: string) {
    setDerived(["text", "title", "fg"], primaryDeep);
    setDerived(["header", "bold", "bg"], primaryDeep);
    setDerived(["header", "bold", "rule"], boldBandRule(primaryDeep));
    setDerived(["header", "tint", "bg"], oklchMix(surfaceBaseline(), primaryDeep, 0.12));
  }

  // ── Secondary cascade ───────────────────────────────────────────────
  function applySecondary(hex: string) {
    setPath(["inputs", "secondary"], hex);
    const secondaryDeep = isOver(["inputs", "secondaryDeep"])
      ? ((inputs?.secondaryDeep as string | undefined) ?? oklchDarken(hex, 0.15))
      : oklchDarken(hex, 0.15);
    setDerived(["inputs", "secondaryDeep"], secondaryDeep);
    cascadeSecondaryDeep(secondaryDeep);
  }
  function applySecondaryDeep(hex: string) {
    setPath(["inputs", "secondaryDeep"], hex);
    cascadeSecondaryDeep(hex);
  }
  /** Secondary-deep drives structural groupings AND chrome texture.
   * Structure: column-group bold band, row-group L1/L2/L3 bg. Chrome:
   * surface.muted, divider tints, alt-row banding, cell.border,
   * firstColumn.bold.bg. Mono themes are unchanged (secondary mirrors
   * primary); two-color themes get coordinated structural + chrome color
   * in a single axis. Post-2026-04-29: chrome migrated here from the
   * retired tertiary cascade. */
  function cascadeSecondaryDeep(secondaryDeep: string) {
    // Structural groupings.
    setDerived(["columnGroup", "bold", "bg"], secondaryDeep);
    setDerived(["columnGroup", "bold", "rule"], boldBandRule(secondaryDeep));
    setDerived(["columnGroup", "tint", "bg"], oklchMix(surfaceBaseline(), secondaryDeep, 0.12));
    const l1Bg = secondaryTintedL1Bg(secondaryDeep);
    setDerived(["rowGroup", "L1", "bg"], l1Bg);
    setDerived(["rowGroup", "L2", "bg"], l1Bg);
    setDerived(["rowGroup", "L3", "bg"], l1Bg);
    // Chrome texture.
    const tintedSubtle = chromeTintedSubtleDivider(secondaryDeep);
    const tintedStrong = chromeTintedStrongDivider(secondaryDeep);
    const tintedMuted  = chromeTintedSurfaceMuted(secondaryDeep);
    const tintedAlt    = chromeTintedAltSurface(secondaryDeep);
    setDerived(["divider", "subtle"], tintedSubtle);
    setDerived(["divider", "strong"], tintedStrong);
    setDerived(["cell", "border"], tintedSubtle);
    setDerived(["surface", "muted"], tintedMuted);
    setDerived(["firstColumn", "bold", "bg"], tintedMuted);
    setDerived(["row", "alt", "bg"], tintedAlt);
  }

  // Reset helpers — clear pin, restore mirrored value, re-cascade.
  function resetPrimaryDeep() {
    clearOver(["inputs", "primaryDeep"]);
    applyPrimaryDeep(oklchDarken(currentPrimary(), 0.15));
  }
  function resetSecondary() {
    clearOver(["inputs", "secondary"]);
    clearOver(["inputs", "secondaryDeep"]);
    // Re-apply primary which will re-mirror secondary down the chain.
    applyPrimary(currentPrimary());
  }
  function resetSecondaryDeep() {
    clearOver(["inputs", "secondaryDeep"]);
    applySecondaryDeep(oklchDarken(currentSecondary(), 0.15));
  }
  function resetSeriesPrimary() {
    clearOver(["series", 0, "fill"]);
    cascadePrimary(currentPrimary());
  }
  function resetTitleFg() {
    clearOver(["text", "title", "fg"]);
    setDerived(["text", "title", "fg"], currentPrimaryDeep());
  }
  function resetHeaderBoldBg() {
    clearOver(["header", "bold", "bg"]);
    setDerived(["header", "bold", "bg"], currentPrimaryDeep());
  }
  function resetSubtleDivider() {
    clearOver(["divider", "subtle"]);
    clearOver(["cell", "border"]);
    const tinted = chromeTintedSubtleDivider(currentSecondaryDeep());
    setDerived(["divider", "subtle"], tinted);
    setDerived(["cell", "border"], tinted);
  }
  function resetL1Bg() {
    clearOver(["rowGroup", "L1", "bg"]);
    setDerived(["rowGroup", "L1", "bg"], secondaryTintedL1Bg(currentSecondaryDeep()));
  }

  // ── Accent cascade (engagement, orthogonal to identity) ─────────────
  function applyAccent(hex: string) {
    setPath(["inputs", "accent"], hex);
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
    const filledTint  = semanticFilledTintHex(accent);
    setDerived(["accent", "default"],     accent);
    setDerived(["accent", "muted"],       muted);
    setDerived(["accent", "tintSubtle"],  tintSubtle);
    setDerived(["accent", "tintMedium"],  tintMedium);
    setDerived(["row", "accent", "fg"],         accent);
    setDerived(["row", "accent", "markerFill"], accent);
    setDerived(["row", "hover", "bg"],     muted);
    setDerived(["row", "selected", "bg"],  muted);
    if (!inputs?.statusInfo) {
      setDerived(["status", "info"], accent);
    }
    setDerived(["semantic", "fill"],     filledTint);
    setDerived(["row", "fill", "bg"],    filledTint);
  }

  // ── Inverse content cascade ─────────────────────────────────────────
  // content.inverse lands on bold-mode bands (header + column-group). Both
  // bold rules are component-local mixes against their own bg, so editing
  // inverse must refresh both rules.
  function setInverseContent(hex: string) {
    setPath(["content", "inverse"], hex);
    setDerived(["header", "bold", "fg"], hex);
    setDerived(["columnGroup", "bold", "fg"], hex);
    setDerived(["header", "bold", "rule"], oklchMix(hex, currentPrimaryDeep(), 0.40));
    setDerived(["columnGroup", "bold", "rule"], oklchMix(hex, currentSecondaryDeep(), 0.40));
  }

  // ── Strong-divider passthrough ──────────────────────────────────────
  // R-side: header.light.rule, column_group.light.rule, row_group.L1.rule,
  // and forest plot scaffold (axis_line, tick_mark, reference) all default
  // to divider.strong. The panel's Strong field has to mirror those leaves.
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
    setPath(["row", "alt", "bg"], hex);
  }
  function setForeground(hex: string) {
    setPath(["content", "primary"], hex);
    setPath(["cell", "fg"], hex);
    setPath(["row", "base", "fg"], hex);
    setPath(["row", "alt",  "fg"], hex);
    setDerived(["header", "light", "fg"], hex);
    setDerived(["columnGroup", "light", "fg"], hex);
    setDerived(["firstColumn", "bold", "fg"], hex);
    setDerived(["rowGroup", "L1", "fg"], hex);
  }

  // ── Header (variant-aware) ───────────────────────────────────────────
  function activeHeaderVariant(): "light" | "tint" | "bold" {
    const v = theme?.variants?.headerStyle;
    if (v === "bold" || v === "tint") return v;
    return "light";
  }
  function setHeaderBg(hex: string) {
    setPath(["header", activeHeaderVariant(), "bg"], hex);
  }
  function setHeaderFg(hex: string) {
    setPath(["header", activeHeaderVariant(), "fg"], hex);
  }

  // header_style and slot_style live in the Layout tab now (the structural
  // variants natural home — alongside density and first_column_style).
  // Their cascade-mirror logic moved to V2LayoutControl.svelte.

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
  <!-- ── Zone 1 — Identity (T1 keystone) ──────────────────────────── -->
  <div class="zone zone-identity">
    <div class="zone-header">
      <span class="zone-tag">Zone 1</span>
      <span class="zone-title">Identity — keystone inputs</span>
    </div>
    <p class="zone-description">
      Two identity tiers (secondary mirrors primary when NA) plus orthogonal
      accent. Everything else in this panel cascades from these.
      Structural variants (slot style, header style) live on the Layout tab.
      Pinned values show a reset (●).
    </p>

    <SettingsSection title="Identity colors" description="Set just primary for a mono theme; pin secondary to unlock a coordinated 2-color identity (column groups, row groups, glyph defaults, AND chrome texture all light up under secondary). Each tier's `_deep` companion lives in Roles below — it auto-darkens by 15% from the seed and can be pinned there if the auto-derivation isn't quite right.">
      <div class="identity-row">
        <ColorField
          label="Primary"
          hint="Identity hero — title text, bold-mode header band, series[0]"
          value={(inputs?.primary as string | undefined) ?? theme.accent?.default ?? "#0891B2"}
          onchange={applyPrimary}
        />
        <ColorField
          label="Secondary"
          hint="Structural axis — column-group bold band, row-group bars, glyph defaults, AND chrome texture (banding, hairlines, gridlines). Mirrors Primary when not pinned."
          value={(inputs?.secondary as string | undefined) ?? currentPrimary()}
          onchange={applySecondary}
          overridden={isOver(["inputs", "secondary"])}
          onreset={resetSecondary}
        />
        <ColorField
          label="Accent"
          hint="Engagement — hover, selected, semantic row callouts, status.info fallback. Orthogonal to identity."
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
  </div>

  <!-- ── Zone 2 — Roles (T2 derived, with overrides) ──────────────── -->
  <div class="zone zone-roles">
    <div class="zone-header">
      <span class="zone-tag">Zone 2</span>
      <span class="zone-title">Roles — derived semantic tokens</span>
    </div>
    <p class="zone-description">
      Each token here is computed from Zone 1 inputs by the resolver. Editing
      pins the value (resolver stops re-deriving on input change); the reset
      (●) returns it to the cascade. Hints describe the default derivation.
    </p>

    <SettingsSection title="Deep companions" description="Auto-derived as oklch_darken(seed, 0.15) from each identity tier. Drive bold-mode bands, structural tints, and chrome texture. Pin here if the auto-derivation isn't quite right.">
      <div class="identity-row">
        <ColorField
          label="Primary (deep)"
          hint="Bold-mode header band; title color"
          value={(inputs?.primaryDeep as string | undefined) ?? oklchDarken(currentPrimary(), 0.15)}
          onchange={applyPrimaryDeep}
          overridden={isOver(["inputs", "primaryDeep"])}
          onreset={resetPrimaryDeep}
        />
        <ColorField
          label="Secondary (deep)"
          hint="Column-group bold band; row-group L1 tint; chrome texture (surface.muted, dividers, banding)"
          value={(inputs?.secondaryDeep as string | undefined) ?? currentSecondaryDeep()}
          onchange={applySecondaryDeep}
          overridden={isOver(["inputs", "secondaryDeep"])}
          onreset={resetSecondaryDeep}
        />
      </div>
    </SettingsSection>

    <SettingsSection title="Text colors" description="Primary is body; secondary is subtitles/captions; muted is footnotes.">
      <ColorField label="Foreground" hint="Body and cell text" value={theme.cell?.fg ?? theme.content?.primary ?? "#000000"} onchange={setForeground} />
      <ColorField label="Secondary"  value={theme.content?.secondary ?? "#444444"} onchange={(v) => setPath(["content","secondary"], v)} />
      <ColorField label="Muted"      hint="Footnotes" value={theme.content?.muted ?? "#888888"} onchange={(v) => setPath(["content","muted"], v)} />
      <ColorField label="Inverse"    hint="Text on dark bands (bold-mode header + column-group). Cascades to both clusters' fg and the per-cluster rule mix." value={theme.content?.inverse ?? "#ffffff"} onchange={setInverseContent} />
    </SettingsSection>

    <SettingsSection title="Surfaces" description="Row backgrounds and the banding partner. The panel writes both the surface role and the row binding so the change is visible immediately.">
      <ColorField label="Background"      value={theme.row?.base?.bg ?? theme.surface?.base ?? "#ffffff"} onchange={setBackground} />
      <ColorField label="Banding partner" hint="Alt-row background (secondary-tinted via surface.muted)" value={theme.row?.alt?.bg ?? theme.surface?.muted ?? "#f8fafc"} onchange={setBandingPartner} />
    </SettingsSection>

    <SettingsSection title="Selection & accents" description="Per-row interaction tones plus the L1 group-bar fill.">
      <ColorField label="Hover / selected fill" value={theme.accent?.muted ?? "#dde1e7"}
                  onchange={(v) => {
                    setPath(["accent", "muted"], v);
                    setPath(["row", "hover", "bg"], v);
                    setPath(["row", "selected", "bg"], v);
                  }} />
      <ColorField label="L1 group bar"
                  hint="Secondary-deep tint into surface base (16% under header_style=light, 24% under tint/bold). Coordinates with column-group bold band."
                  value={(theme.rowGroup?.L1?.bg as string | undefined) ?? "#e1e5ea"}
                  onchange={(v) => setPath(["rowGroup", "L1", "bg"], v)}
                  overridden={isOver(["rowGroup", "L1", "bg"])}
                  onreset={resetL1Bg} />
    </SettingsSection>

    <SettingsSection title="Dividers" description="Cell hairlines and the strong rules under header / group rows.">
      <ColorField label="Subtle" hint="Cell borders (default: 10% Secondary-deep tint)"
                  value={theme.cell?.border ?? theme.divider?.subtle ?? "#e2e8f0"}
                  onchange={(v) => {
                    setPath(["divider", "subtle"], v);
                    setPath(["cell", "border"], v);
                  }}
                  overridden={isOver(["divider", "subtle"]) || isOver(["cell", "border"])}
                  onreset={resetSubtleDivider} />
      <ColorField label="Strong" hint="Header rule (light variant), group rules, axis line, tick marks (default: 5% Secondary-deep tint)"
                  value={theme.divider?.strong ?? "#94a3b8"}
                  onchange={setStrongDivider} />
    </SettingsSection>

    <SettingsSection title="Status" description="Semantic indicator colors.">
      <ColorField label="Positive" value={theme.status?.positive ?? "#3F7D3F"} onchange={(v) => setPath(["status","positive"], v)} />
      <ColorField label="Negative" value={theme.status?.negative ?? "#B33A3A"} onchange={(v) => setPath(["status","negative"], v)} />
      <ColorField label="Warning"  value={theme.status?.warning  ?? "#C68A2E"} onchange={(v) => setPath(["status","warning"], v)} />
      <ColorField label="Info"     value={theme.status?.info     ?? theme.accent?.default ?? "#2C4F7C"} onchange={(v) => setPath(["status","info"], v)} />
    </SettingsSection>
  </div>

  <!-- ── Zone 3 — Components (T3 bindings) ────────────────────────── -->
  <div class="zone zone-components">
    <div class="zone-header">
      <span class="zone-tag">Zone 3</span>
      <span class="zone-title">Components — per-binding overrides</span>
    </div>
    <p class="zone-description">
      Cluster-level bindings consumed directly by the renderer. Each field
      writes into a specific component slot; defaults flow from Zone 2.
    </p>

    <SettingsSection title="Header" description="Column-header band. Variant chosen above (light / tint / bold); these fields edit the active variant's colors.">
      <ColorField label="Header background"
                  value={(theme.header as { light?: { bg?: string }; tint?: { bg?: string }; bold?: { bg?: string } } | undefined)?.[activeHeaderVariant()]?.bg ?? "#f8fafc"}
                  onchange={setHeaderBg}
                  overridden={activeHeaderVariant() === "bold" && isOver(["header", "bold", "bg"])}
                  onreset={activeHeaderVariant() === "bold" ? resetHeaderBoldBg : undefined} />
      <ColorField label="Header text"
                  value={(theme.header as { light?: { fg?: string }; tint?: { fg?: string }; bold?: { fg?: string } } | undefined)?.[activeHeaderVariant()]?.fg ?? "#000000"}
                  onchange={setHeaderFg} />
    </SettingsSection>

    <SettingsSection title="Plot" description="Title and forest-axis text colors. Title defaults to Primary-deep; pin per-field to break from the cascade.">
      <ColorField label="Title color"
                  value={(theme.text?.title?.fg as string | undefined) ?? currentPrimaryDeep()}
                  onchange={(v) => setPath(["text", "title", "fg"], v)}
                  overridden={isOver(["text", "title", "fg"])}
                  onreset={resetTitleFg} />
      <ColorField label="Axis label color"
                  value={(theme.plot?.axisLabel?.fg as string | undefined) ?? theme.content?.muted ?? "#1A1A1A"}
                  onchange={(v) => setPath(["plot", "axisLabel", "fg"], v)} />
      <ColorField label="Axis tick color"
                  value={(theme.plot?.tickLabel?.fg as string | undefined) ?? theme.content?.muted ?? "#1A1A1A"}
                  onchange={(v) => setPath(["plot", "tickLabel", "fg"], v)} />
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
  </div>
{/if}

<style>
  /* Three-zone redesign: Identity (T1) → Roles (T2) → Components (T3).
     Each zone gets a tagged header and a subtle accent rule above so
     the cascade tier is visually obvious without resorting to tabs. */
  .zone {
    padding-top: 6px;
  }
  .zone + .zone {
    margin-top: 14px;
    padding-top: 10px;
    border-top: 2px solid color-mix(in srgb, var(--tv-accent, #2563eb) 18%, var(--tv-border, #e2e8f0));
  }
  .zone-header {
    display: flex;
    align-items: baseline;
    gap: 8px;
    margin-bottom: 2px;
  }
  .zone-tag {
    font-size: 0.625rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--tv-accent, #2563eb);
    padding: 1px 6px;
    border: 1px solid color-mix(in srgb, var(--tv-accent, #2563eb) 30%, var(--tv-border, #e2e8f0));
    border-radius: 4px;
    background: color-mix(in srgb, var(--tv-accent, #2563eb) 6%, var(--tv-bg, #fff));
  }
  .zone-title {
    font-size: 0.875rem;
    font-weight: 600;
    color: var(--tv-fg, #1a1a1a);
  }
  .zone-description {
    margin: 0 0 6px 0;
    font-size: 0.6875rem;
    line-height: 1.4;
    color: color-mix(in srgb, var(--tv-text-muted, #64748b) 85%, transparent);
  }

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
    color: var(--tv-text-muted);
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
    color: var(--tv-text-muted);
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

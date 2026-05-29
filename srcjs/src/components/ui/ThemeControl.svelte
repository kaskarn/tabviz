<!--
  ThemeControl — settings-panel Theme tab (V3).

  Replaces the V2 panel that bypassed the V3 cascade. Binds to
  `spec.theme.authoringInputs` (the V3 ThemeInputs round-tripped by the
  adapter) and routes every edit through `store.setAuthoringInputs()`,
  which rebuilds the resolved theme via the adapter and writes it back.

  Sections, mirroring docs/dev/settings-panel-v3-design.md:
    Identity     — open;   mode, brand, accent, decorative, neutral tint
    Structure    — open;   density, header style, first column style
    Data palettes — closed; categorical / sequential / diverging
    Typography   — closed; body/display/numeric/mono font stacks
    Status colors — closed; positive/negative/warning/info

  Advanced tab (T2 token / T3 cluster pins) is a follow-up — for now,
  pinning happens R-side via `set_*` modifiers and stays out of the UI.
-->
<script lang="ts">
  import type { TabvizStore } from "$stores/tabvizStore.svelte";
  import type { ThemeInputs } from "$types/theme-inputs";
  import { FONT_PRESETS } from "$lib/font-presets";
  import { CATEGORICAL_SCHEMES, SEQUENTIAL_SCHEMES, DIVERGING_SCHEMES } from "$lib/data-schemes";
  import ColorField from "./ColorField.svelte";
  import Section from "$components/primitives/v2/Section.svelte";
  import Accordion from "$components/primitives/v2/Accordion.svelte";
  import Field from "$components/primitives/v2/Field.svelte";
  import FontFamily from "$components/primitives/v2/FontFamily.svelte";
  import type { FontEntry } from "$components/primitives/v2/FontFamily.svelte";
  import Pill from "$components/primitives/v2/Pill.svelte";
  import Picker from "$components/primitives/v2/Picker.svelte";
  import Knob from "$components/primitives/v2/Knob.svelte";
  import {
    PAPER_SWATCHES, INK_SWATCHES, ACCENT_SWATCHES,
    NEUTRAL_SWATCHES, STATUS_SWATCHES, colors,
  } from "./swatch-palettes";

  interface Props { store: TabvizStore; }
  let { store }: Props = $props();

  const theme  = $derived(store.spec?.theme);
  const inputs = $derived(
    (theme as { authoringInputs?: ThemeInputs } | undefined)?.authoringInputs ?? null
  );

  // Coalesce rapid input edits into a single rebuild. The adapter +
  // re-render path is fast enough that the debounce is mostly to avoid
  // burning compute on color-picker hover scrubs.
  let pendingPatch: Partial<ThemeInputs> = {};
  let debounceTimer: ReturnType<typeof setTimeout> | null = null;
  function commit(patch: Partial<ThemeInputs>): void {
    pendingPatch = { ...pendingPatch, ...patch };
    if (debounceTimer != null) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      const next = pendingPatch;
      pendingPatch = {};
      debounceTimer = null;
      store.setAuthoringInputs(next);
    }, 150);
  }
  // Immediate commit — for terminal events (toggles, dropdowns) where
  // the debounce just slows perceived response.
  function commitNow(patch: Partial<ThemeInputs>): void {
    if (debounceTimer != null) { clearTimeout(debounceTimer); debounceTimer = null; }
    const merged = { ...pendingPatch, ...patch };
    pendingPatch = {};
    store.setAuthoringInputs(merged);
  }

  // Decorative slot — empty until clicked. Tracked locally so the
  // ColorField only renders after activation; the brand seed is used
  // as the initial value so the user has a starting point.
  let decorativeActive = $derived(inputs?.decorative != null);

  // Pill segments
  const MODE_SEG = [
    { value: "light" as const, label: "Light" },
    { value: "dark"  as const, label: "Dark" },
  ];
  const DENSITY_SEG = [
    { value: "compact"     as const, label: "Compact" },
    { value: "comfortable" as const, label: "Cozy" },
    { value: "spacious"    as const, label: "Spacious" },
  ];
  const HEADER_SEG = [
    { value: "light" as const, label: "Light" },
    { value: "tint"  as const, label: "Tint" },
    { value: "bold"  as const, label: "Bold" },
  ];
  const FIRSTCOL_SEG = [
    { value: "default" as const, label: "Default" },
    { value: "tint"    as const, label: "Tint" },
    { value: "bold"    as const, label: "Bold" },
  ];
  const NEUTRAL_TINT_SEG = [
    { value: "untinted"   as const, label: "—" },
    { value: "brand"      as const, label: "Brand" },
    { value: "accent"     as const, label: "Accent" },
    { value: "decorative" as const, label: "Decor." },
  ];

  // Data scheme pickers
  const catItems = Object.keys(CATEGORICAL_SCHEMES).map((name) => ({ value: name, label: name }));
  // brand_mono is also valid for categorical — it derives from the brand ramp.
  catItems.push({ value: "brand_mono", label: "brand_mono" });
  const seqItems = Object.keys(SEQUENTIAL_SCHEMES).map((name) => ({ value: name, label: name }));
  const divItems = Object.keys(DIVERGING_SCHEMES).map((name) => ({ value: name, label: name }));

  const fontRoster: FontEntry[] = FONT_PRESETS.map((p) => ({
    value: p.stack,
    label: p.hint ? `${p.name} — ${p.hint}` : p.name,
  }));

  function neutralTintMode(): "untinted" | "brand" | "accent" | "decorative" {
    const t = inputs?.neutral_tint ?? "untinted";
    if (typeof t === "string") {
      if (t === "untinted" || t === "brand" || t === "accent" || t === "decorative") return t;
    }
    return "untinted";
  }
  const tintStrength = $derived(inputs?.neutral_tint_strength ?? 0.04);
  const tintActive   = $derived(neutralTintMode() !== "untinted");
</script>

{#if theme && inputs}
  <div class="theme-ctrl" data-tv-v2>

    <!-- ── Identity ─────────────────────────────────────────────────── -->
    <Section title="Identity" glyph="section.identity"
      hint="Brand drives chrome + identity. Accent drives engagement (hover, selected, callouts). Decorative is an optional second editorial color.">
      <!-- Mode toggle — foundational, top of section. -->
      <Field label="Mode">
        <Pill
          value={inputs.mode ?? "light"}
          segments={MODE_SEG}
          ariaLabel="Light/dark mode"
          onchange={(v) => commitNow({ mode: v as "light" | "dark" })}
        />
      </Field>

      <Field label="Brand" hint="Title, bold header, series[0]">
        <ColorField label="" value={inputs.brand}
          onchange={(v) => commit({ brand: v })}
          swatches={colors(ACCENT_SWATCHES)} />
      </Field>

      <Field label="Accent" hint="Hover, selected, callouts">
        <ColorField label="" value={inputs.accent ?? inputs.brand}
          onchange={(v) => commit({ accent: v })}
          swatches={colors(ACCENT_SWATCHES)} />
      </Field>

      <Field label="Decorative" hint="Optional 2nd color (editorial themes)">
        {#if decorativeActive}
          <ColorField label="" value={inputs.decorative ?? inputs.brand}
            onchange={(v) => commit({ decorative: v })}
            swatches={colors(ACCENT_SWATCHES)} />
        {:else}
          <button type="button" class="decorative-add"
            onclick={() => commitNow({ decorative: inputs.brand })}>+ add</button>
        {/if}
      </Field>

      <Field label="Neutral tint" hint="Optional hue blended into the paper/ink ramp">
        <Pill
          value={neutralTintMode()}
          segments={NEUTRAL_TINT_SEG}
          ariaLabel="Neutral tint source"
          onchange={(v) => commitNow({ neutral_tint: v as "untinted" | "brand" | "accent" | "decorative" })}
        />
      </Field>

      <Field label="Tint strength" hint="Subtle (0.04) ↔ editorial (~1.0)">
        <Knob
          value={tintStrength}
          min={0}
          max={1}
          step={0.01}
          track
          disabled={!tintActive}
          onchange={(v) => v != null && commit({ neutral_tint_strength: v })}
        />
      </Field>
    </Section>

    <!-- ── Structure ────────────────────────────────────────────────── -->
    <Section title="Structure" glyph="section.layout"
      hint="Theme structural identity. Banding + borders are per-instance — see Layout tab.">
      <Field label="Density">
        <Pill
          value={inputs.density ?? "comfortable"}
          segments={DENSITY_SEG}
          ariaLabel="Density preset"
          onchange={(v) => commitNow({ density: v as "compact" | "comfortable" | "spacious" })}
        />
      </Field>

      <Field label="Header style">
        <Pill
          value={(theme.variants?.headerStyle ?? "light") as "light" | "tint" | "bold"}
          segments={HEADER_SEG}
          ariaLabel="Header variant"
          onchange={(v) => store.setThemeField(["variants", "headerStyle"], v)}
        />
      </Field>

      <Field label="First column">
        <Pill
          value={(theme.variants?.firstColumnStyle ?? "default") as "default" | "tint" | "bold"}
          segments={FIRSTCOL_SEG}
          ariaLabel="First column variant"
          onchange={(v) => store.setThemeField(["variants", "firstColumnStyle"], v)}
        />
      </Field>
    </Section>

    <div class="zone-ornament">⌘</div>

    <!-- ── Data palettes ────────────────────────────────────────────── -->
    <Accordion title="Data palettes" hint="Categorical / sequential / diverging scheme refs" open={false}>
      <Field label="Categorical">
        <Picker
          value={inputs.categorical ?? "okabe_ito"}
          items={catItems}
          ariaLabel="Categorical scheme"
          onchange={(v) => v != null && commitNow({ categorical: v })}
        />
      </Field>
      <Field label="Sequential">
        <Picker
          value={inputs.sequential ?? "viridis"}
          items={seqItems}
          ariaLabel="Sequential scheme"
          onchange={(v) => v != null && commitNow({ sequential: v })}
        />
      </Field>
      <Field label="Diverging">
        <Picker
          value={inputs.diverging ?? "rdbu"}
          items={divItems}
          ariaLabel="Diverging scheme"
          onchange={(v) => v != null && commitNow({ diverging: v })}
        />
      </Field>
    </Accordion>

    <!-- ── Typography ──────────────────────────────────────────────── -->
    <Accordion title="Typography" hint="Font stacks (body / display / numeric / mono)" open={false}>
      <div class="font-grid">
        <div class="specimen-card">
          <div class="specimen-label">body</div>
          <div class="specimen-sample" style:font-family={theme.text?.body?.family ?? "system-ui"}>Aa 123</div>
          <FontFamily
            value={inputs.fonts?.body ?? theme.text?.body?.family ?? null}
            roster={fontRoster}
            onchange={(v) => commit({ fonts: { ...(inputs.fonts ?? {}), body: v ?? undefined } })}
          />
        </div>
        <div class="specimen-card">
          <div class="specimen-label">display</div>
          <div class="specimen-sample" style:font-family={theme.text?.title?.family ?? "serif"}>Aa 123</div>
          <FontFamily
            value={inputs.fonts?.display ?? theme.text?.title?.family ?? null}
            roster={fontRoster}
            onchange={(v) => commit({ fonts: { ...(inputs.fonts ?? {}), display: v ?? undefined } })}
          />
        </div>
        <div class="specimen-card">
          <div class="specimen-label">numeric</div>
          <div class="specimen-sample" style:font-family={theme.text?.numeric?.family ?? "system-ui"}>Aa 123</div>
          <FontFamily
            value={theme.text?.numeric?.family ?? null}
            roster={fontRoster}
            onchange={(v) => store.setThemeField(["text", "numeric", "family"], v)}
          />
        </div>
        <div class="specimen-card">
          <div class="specimen-label">mono</div>
          <div class="specimen-sample" style:font-family={inputs.fonts?.mono ?? "ui-monospace"}>Aa 123</div>
          <FontFamily
            value={inputs.fonts?.mono ?? null}
            roster={fontRoster}
            onchange={(v) => commit({ fonts: { ...(inputs.fonts ?? {}), mono: v ?? undefined } })}
          />
        </div>
      </div>
    </Accordion>

    <!-- ── Status colors ───────────────────────────────────────────── -->
    <Accordion title="Status colors" hint="Tufte-minimal defaults" open={false}>
      <Field label="Positive">
        <ColorField label="" value={inputs.status?.positive ?? theme.status?.positive ?? "#3F7D3F"}
          onchange={(v) => commit({ status: { ...(inputs.status ?? {}), positive: v } })}
          swatches={colors(STATUS_SWATCHES)} />
      </Field>
      <Field label="Negative">
        <ColorField label="" value={inputs.status?.negative ?? theme.status?.negative ?? "#B33A3A"}
          onchange={(v) => commit({ status: { ...(inputs.status ?? {}), negative: v } })}
          swatches={colors(STATUS_SWATCHES)} />
      </Field>
      <Field label="Warning">
        <ColorField label="" value={inputs.status?.warning ?? theme.status?.warning ?? "#C68A2E"}
          onchange={(v) => commit({ status: { ...(inputs.status ?? {}), warning: v } })}
          swatches={colors(STATUS_SWATCHES)} />
      </Field>
      <Field label="Info">
        <ColorField label="" value={inputs.status?.info ?? theme.status?.info ?? "#1F77B4"}
          onchange={(v) => commit({ status: { ...(inputs.status ?? {}), info: v } })}
          swatches={colors(STATUS_SWATCHES)} />
      </Field>
    </Accordion>

    <div class="zone-ornament">⌘</div>

    <!-- ── Advanced overrides ──────────────────────────────────────
         T2 token pins. Each pin overrides the cascade-derived value at
         a specific path. Pins survive authoring rebuilds (brand swap,
         mode toggle); Reset reverts to derived. -->
    <Accordion title="Advanced — overrides" hint="Pin individual chrome colors. Pins survive brand/mode changes." open={false}>
      <!-- Surfaces (paper family) -->
      <Field label="paper" hint="Background"
        pinned={store.isOverridden(["surface", "base"])}
        onreset={() => store.clearOverride(["surface", "base"])}>
        <ColorField label="" value={theme.surface?.base ?? "#ffffff"}
          onchange={(v) => store.setThemeField(["surface", "base"], v)}
          swatches={colors(PAPER_SWATCHES)} />
      </Field>
      <Field label="paper_alt" hint="Alternating-row tint"
        pinned={store.isOverridden(["row", "alt", "bg"])}
        onreset={() => store.clearOverride(["row", "alt", "bg"])}>
        <ColorField label="" value={(theme.row?.alt?.bg as string | undefined) ?? theme.surface?.muted ?? "#f6f6f6"}
          onchange={(v) => store.setThemeField(["row", "alt", "bg"], v)}
          swatches={colors(PAPER_SWATCHES)} />
      </Field>
      <Field label="paper_sunken" hint="Muted surface"
        pinned={store.isOverridden(["surface", "muted"])}
        onreset={() => store.clearOverride(["surface", "muted"])}>
        <ColorField label="" value={theme.surface?.muted ?? "#ececec"}
          onchange={(v) => store.setThemeField(["surface", "muted"], v)}
          swatches={colors(PAPER_SWATCHES)} />
      </Field>
      <Field label="paper_raised" hint="Lifted surface"
        pinned={store.isOverridden(["surface", "raised"])}
        onreset={() => store.clearOverride(["surface", "raised"])}>
        <ColorField label="" value={theme.surface?.raised ?? "#fafafa"}
          onchange={(v) => store.setThemeField(["surface", "raised"], v)}
          swatches={colors(PAPER_SWATCHES)} />
      </Field>

      <!-- Ink (content) -->
      <Field label="ink" hint="Primary text / cell fg"
        pinned={store.isOverridden(["content", "primary"])}
        onreset={() => store.clearOverride(["content", "primary"])}>
        <ColorField label="" value={theme.content?.primary ?? "#1f1f1f"}
          onchange={(v) => store.setThemeField(["content", "primary"], v)}
          swatches={colors(INK_SWATCHES)} />
      </Field>
      <Field label="ink_muted" hint="Muted text"
        pinned={store.isOverridden(["content", "muted"])}
        onreset={() => store.clearOverride(["content", "muted"])}>
        <ColorField label="" value={theme.content?.muted ?? "#4a4a4a"}
          onchange={(v) => store.setThemeField(["content", "muted"], v)}
          swatches={colors(INK_SWATCHES)} />
      </Field>
      <Field label="ink_subtle" hint="Subtle text / ticks"
        pinned={store.isOverridden(["content", "secondary"])}
        onreset={() => store.clearOverride(["content", "secondary"])}>
        <ColorField label="" value={theme.content?.secondary ?? "#6e6e6e"}
          onchange={(v) => store.setThemeField(["content", "secondary"], v)}
          swatches={colors(INK_SWATCHES)} />
      </Field>

      <!-- Rules (dividers) -->
      <Field label="rule_subtle" hint="Cell hairlines"
        pinned={store.isOverridden(["divider", "subtle"])}
        onreset={() => store.clearOverride(["divider", "subtle"])}>
        <ColorField label="" value={theme.divider?.subtle ?? "#e0e0e0"}
          onchange={(v) => {
            store.setThemeField(["divider", "subtle"], v);
            store.setThemeField(["cell", "border"], v);
          }}
          swatches={colors(NEUTRAL_SWATCHES)} />
      </Field>
      <Field label="rule_strong" hint="Header rule, axis line"
        pinned={store.isOverridden(["divider", "strong"])}
        onreset={() => store.clearOverride(["divider", "strong"])}>
        <ColorField label="" value={theme.divider?.strong ?? "#808080"}
          onchange={(v) => store.setThemeField(["divider", "strong"], v)}
          swatches={colors(NEUTRAL_SWATCHES)} />
      </Field>

      <!-- Accent roles -->
      <Field label="accent" hint="Engagement default"
        pinned={store.isOverridden(["accent", "default"])}
        onreset={() => store.clearOverride(["accent", "default"])}>
        <ColorField label="" value={theme.accent?.default ?? "#c8553d"}
          onchange={(v) => store.setThemeField(["accent", "default"], v)}
          swatches={colors(ACCENT_SWATCHES)} />
      </Field>
      <Field label="accent_subtle" hint="Hover/selected tint"
        pinned={store.isOverridden(["accent", "muted"])}
        onreset={() => store.clearOverride(["accent", "muted"])}>
        <ColorField label="" value={theme.accent?.muted ?? "#f0ddd9"}
          onchange={(v) => {
            store.setThemeField(["accent", "muted"], v);
            store.setThemeField(["row", "hover", "bg"], v);
            store.setThemeField(["row", "selected", "bg"], v);
          }}
          swatches={colors(ACCENT_SWATCHES)} />
      </Field>
    </Accordion>

  </div>
{:else if theme}
  <!-- Legacy theme without V3 authoring inputs round-trip; the engine
       fix in theme-adapter.ts populates this on every freshly built
       theme, so users only hit this branch with hand-rolled wire blobs. -->
  <div class="theme-ctrl-legacy" data-tv-v2>
    <p>This theme was built without V3 authoring inputs and can't be edited in the panel. Switch to a preset to use the new theme controls.</p>
  </div>
{/if}

<style>
  .theme-ctrl {
    display: flex;
    flex-direction: column;
    gap: 0;
  }
  .theme-ctrl-legacy {
    padding: 12px;
    color: var(--v2-ink-3, #8a8478);
    font-size: var(--v2-text-small, 10.5px);
    line-height: 1.4;
  }

  .zone-ornament {
    font-family: var(--v2-font-serif, "EB Garamond", "Palatino", Georgia, serif);
    font-size: 14px;
    color: var(--v2-ink-3, #8a8478);
    text-align: center;
    padding: 18px 0 6px;
    line-height: 1;
    user-select: none;
  }

  .decorative-add {
    appearance: none;
    border: 1px dashed var(--v2-rule, #d6d0c1);
    background: transparent;
    padding: 4px 10px;
    font: inherit;
    font-family: var(--v2-font-mono, ui-monospace, monospace);
    font-size: var(--v2-text-small, 10.5px);
    color: var(--v2-ink-3, #8a8478);
    cursor: pointer;
    border-radius: var(--v2-r-hair, 2px);
  }
  .decorative-add:hover {
    color: var(--v2-ink, #15140e);
    border-color: var(--v2-ink-3, #8a8478);
  }

  /* Typography specimen grid — 2×2 of font sample cards. */
  .font-grid {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
    gap: var(--v2-gap-small, 6px);
    padding: 4px 0 4px 28px;
  }
  .specimen-card {
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding: 6px 8px;
    min-width: 0;
    background: var(--v2-paper-edge, #ffffff);
    border: 1px solid var(--v2-rule-soft, #e6e0d1);
    border-radius: var(--v2-r-hair, 2px);
    transition: border-color var(--v2-dur-snap, 80ms) var(--v2-ease);
  }
  .specimen-card:hover {
    border-color: var(--v2-rule, #d6d0c1);
  }
  .specimen-label {
    font-family: var(--v2-font-sans, system-ui);
    font-size: var(--v2-text-micro, 9.5px);
    font-feature-settings: "smcp" 1, "c2sc" 1;
    text-transform: lowercase;
    letter-spacing: var(--v2-track-flag, 0.14em);
    color: var(--v2-ink-3, #8a8478);
    font-weight: 500;
    line-height: 1;
  }
  .specimen-sample {
    font-size: 20px;
    line-height: 1.0;
    color: var(--v2-ink, #15140e);
    padding: 2px 0 4px;
    font-variant-numeric: tabular-nums;
    letter-spacing: 0.01em;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
</style>

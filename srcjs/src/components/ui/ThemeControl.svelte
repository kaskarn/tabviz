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
  import { buildRamps } from "$lib/theme-resolve";
  import ColorField from "./ColorField.svelte";
  import Section from "$components/primitives/v2/Section.svelte";
  import Accordion from "$components/primitives/v2/Accordion.svelte";
  import Field from "$components/primitives/v2/Field.svelte";
  import FontFamily from "$components/primitives/v2/FontFamily.svelte";
  import type { FontEntry } from "$components/primitives/v2/FontFamily.svelte";
  import Pill from "$components/primitives/v2/Pill.svelte";
  import Picker from "$components/primitives/v2/Picker.svelte";
  import Knob from "$components/primitives/v2/Knob.svelte";
  import { ACCENT_SWATCHES, STATUS_SWATCHES, colors } from "./swatch-palettes";

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

  // Live 12-step ramps for the visualization strips. Recomputed on every
  // input change. T2 token → ramp step mapping comes from theme-resolve;
  // when the user hovers a step we surface "what consumes this step" so
  // designers can see the cascade flow at a glance.
  const ramps = $derived(inputs ? buildRamps(inputs) : null);
  // Step usage labels. Order matters — pick the most "anchoring" use per
  // step so the tooltip stays single-line. Sourced from theme-resolve's
  // resolveToken switch.
  const NEUTRAL_USAGE: Record<number, string> = {
    1: "paper", 2: "paper_alt", 3: "paper_sunken",
    6: "(reserve)", 7: "(reserve)", 8: "ink_disabled",
    10: "ink_subtle", 11: "ink_muted", 12: "ink",
  };
  const BRAND_USAGE: Record<number, string> = {
    2: "brand_subtle", 5: "series[4]", 7: "series[2]",
    9: "brand · series[0]", 10: "brand_hover", 11: "brand_active",
  };
  const ACCENT_USAGE: Record<number, string> = {
    2: "accent_subtle", 7: "series[3]", 9: "accent · series[1]",
    10: "accent_hover", 11: "accent_active",
  };
  const DECORATIVE_USAGE: Record<number, string> = {
    2: "decorative_subtle", 9: "decorative", 11: "decorative_chrome",
  };
  function tipFor(usage: Record<number, string>, step: number, hex: string): string {
    const u = usage[step];
    return u ? `step ${step} · ${hex} → ${u}` : `step ${step} · ${hex}`;
  }

  // Live ramp arrays for color-picker swatches. Picking a neutral-ramp
  // step for `paper` writes the current step's hex into the override —
  // the field is still "frozen at that hex" not "bound to the ramp slot"
  // (true ref-binding is tracked as a follow-up). What this delivers
  // today: the swatch row exposes the cascade's own colors first, so
  // designers don't have to enter hex by hand to stay on-palette.
  const neutralSwatches = $derived(ramps?.neutral ?? []);
  const brandSwatches   = $derived(ramps?.brand ?? []);
  const accentSwatches  = $derived(ramps?.accent ?? []);
  const decorativeSwatches = $derived(ramps?.decorative ?? null);

  // Active variant + bag for the cluster-pin Advanced section. Derived
  // up here because `{@const}` must be an immediate child of a control
  // tag in Svelte 5; putting them in the script gives flat markup.
  const hStyle = $derived(((theme as { variants?: { headerStyle?: string } } | undefined)?.variants?.headerStyle ?? "light") as "light" | "tint" | "bold");
  const fcStyle = $derived(((theme as { variants?: { firstColumnStyle?: string } } | undefined)?.variants?.firstColumnStyle ?? "default") as "default" | "bold");
  type ClusterVariant = { bg?: string | null; fg?: string | null; rule?: string | null } | null;
  const hVar = $derived(((theme?.header as unknown as Record<string, ClusterVariant> | undefined)?.[hStyle]) ?? null);
  const cgVar = $derived(((theme?.columnGroup as unknown as Record<string, ClusterVariant> | undefined)?.[hStyle]) ?? null);
  const fcVar = $derived(((theme?.firstColumn as unknown as Record<string, ClusterVariant> | undefined)?.[fcStyle]) ?? null);

  // T2 token → set of resolved-blob paths it derives. Sourced from
  // theme-adapter.ts: when the user pins a T2 token in the Advanced
  // panel, the cascade-equivalent move is to write to *every* path the
  // adapter wrote with that token. Otherwise pinning `paper` only
  // recolors `surface.base` while `row.base.bg` (also derived from
  // `paper`) stays the old hex — which is the bug Antoine saw with a
  // partially-recolored table.
  const T2_PATHS: Record<string, (string | number)[][]> = {
    paper: [
      ["surface", "base"],
      ["surface", "raised"],
      ["header", "light", "bg"],
      ["columnGroup", "light", "bg"],
      ["row", "base", "bg"],
    ],
    paper_alt: [
      ["row", "alt", "bg"],
      ["rowGroup", "L2", "bg"],
      ["firstColumn", "bold", "bg"],
    ],
    paper_sunken: [["surface", "muted"]],
    ink: [
      ["content", "primary"],
      ["header", "light", "fg"],
      ["header", "tint", "fg"],
      ["columnGroup", "light", "fg"],
      ["columnGroup", "tint", "fg"],
      ["rowGroup", "L1", "fg"],
      ["row", "base", "fg"],
      ["row", "alt", "fg"],
      ["row", "hover", "fg"],
      ["row", "selected", "fg"],
      ["cell", "fg"],
      ["firstColumn", "bold", "fg"],
      ["text", "title", "fg"],
      ["text", "body", "fg"],
      ["text", "cell", "fg"],
      ["text", "numeric", "fg"],
    ],
    ink_muted: [
      ["content", "muted"],
      ["rowGroup", "L2", "fg"],
      ["text", "subtitle", "fg"],
      ["text", "label", "fg"],
      ["text", "caption", "fg"],
    ],
    ink_subtle: [
      ["content", "secondary"],
      ["rowGroup", "L3", "fg"],
      ["text", "tick", "fg"],
      ["text", "footnote", "fg"],
    ],
    rule_subtle: [
      ["divider", "subtle"],
      ["cell", "border"],
      ["rowGroup", "L2", "rule"],
      ["firstColumn", "bold", "rule"],
      ["plot", "gridline"],
      ["borders", "minor", "color"],
    ],
    rule_strong: [
      ["divider", "strong"],
      ["header", "light", "rule"],
      ["header", "tint", "rule"],
      ["columnGroup", "light", "rule"],
      ["columnGroup", "tint", "rule"],
      ["columnGroup", "bold", "rule"],
      ["rowGroup", "L1", "rule"],
      ["plot", "axisLine"],
      ["plot", "tickMark"],
      ["plot", "reference"],
      ["borders", "major", "color"],
      ["borders", "table", "color"],
    ],
    accent: [["accent", "default"]],
    accent_subtle: [
      ["accent", "muted"],
      ["accent", "tintSubtle"],
      ["semantic", "fill"],
      ["row", "hover", "bg"],
      ["row", "selected", "bg"],
      ["row", "fill", "bg"],
    ],
  };

  function pinT2(token: string, value: string): void {
    const paths = T2_PATHS[token];
    if (!paths) return;
    for (const p of paths) store.setThemeField(p, value);
  }
  function clearT2(token: string): void {
    const paths = T2_PATHS[token];
    if (!paths) return;
    for (const p of paths) store.clearOverride(p);
  }
  // A T2 token reads as "pinned" if any of its derived paths is overridden.
  function isT2Pinned(token: string): boolean {
    const paths = T2_PATHS[token];
    if (!paths) return false;
    return paths.some((p) => store.isOverridden(p));
  }
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

      <!-- Ramp visualization — hover a step for "step N · hex → consumer".
           Shows the 12-step cascade source so designers see how brand and
           neutral inputs map to UI elements without spelunking docs. -->
      {#if ramps}
        <div class="ramp-strips">
          <div class="ramp-row">
            <span class="ramp-label">neutral</span>
            <div class="ramp" role="list">
              {#each ramps.neutral as hex, i (i)}
                <span class="ramp-step" role="listitem"
                  style:background-color={hex}
                  title={tipFor(NEUTRAL_USAGE, i + 1, hex)}></span>
              {/each}
            </div>
          </div>
          <div class="ramp-row">
            <span class="ramp-label">brand</span>
            <div class="ramp" role="list">
              {#each ramps.brand as hex, i (i)}
                <span class="ramp-step" role="listitem"
                  style:background-color={hex}
                  title={tipFor(BRAND_USAGE, i + 1, hex)}></span>
              {/each}
            </div>
          </div>
          <div class="ramp-row">
            <span class="ramp-label">accent</span>
            <div class="ramp" role="list">
              {#each ramps.accent as hex, i (i)}
                <span class="ramp-step" role="listitem"
                  style:background-color={hex}
                  title={tipFor(ACCENT_USAGE, i + 1, hex)}></span>
              {/each}
            </div>
          </div>
          {#if ramps.decorative}
            <div class="ramp-row">
              <span class="ramp-label">decorative</span>
              <div class="ramp" role="list">
                {#each ramps.decorative as hex, i (i)}
                  <span class="ramp-step" role="listitem"
                    style:background-color={hex}
                    title={tipFor(DECORATIVE_USAGE, i + 1, hex)}></span>
                {/each}
              </div>
            </div>
          {/if}
        </div>
      {/if}
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
      <!-- Surfaces (paper family) — swatches come from the live neutral ramp. -->
      <Field label="paper" hint="Background"
        pinned={isT2Pinned("paper")}
        onreset={() => clearT2("paper")}>
        <ColorField label="" value={theme.surface?.base ?? "#ffffff"}
          onchange={(v) => pinT2("paper", v)}
          swatches={neutralSwatches} />
      </Field>
      <Field label="paper_alt" hint="Alternating-row tint"
        pinned={isT2Pinned("paper_alt")}
        onreset={() => clearT2("paper_alt")}>
        <ColorField label="" value={(theme.row?.alt?.bg as string | undefined) ?? theme.surface?.muted ?? "#f6f6f6"}
          onchange={(v) => pinT2("paper_alt", v)}
          swatches={neutralSwatches} />
      </Field>
      <Field label="paper_sunken" hint="Muted surface"
        pinned={isT2Pinned("paper_sunken")}
        onreset={() => clearT2("paper_sunken")}>
        <ColorField label="" value={theme.surface?.muted ?? "#ececec"}
          onchange={(v) => pinT2("paper_sunken", v)}
          swatches={neutralSwatches} />
      </Field>

      <!-- Ink (content) — also neutral ramp. -->
      <Field label="ink" hint="Primary text / cell fg"
        pinned={isT2Pinned("ink")}
        onreset={() => clearT2("ink")}>
        <ColorField label="" value={theme.content?.primary ?? "#1f1f1f"}
          onchange={(v) => pinT2("ink", v)}
          swatches={neutralSwatches} />
      </Field>
      <Field label="ink_muted" hint="Muted text"
        pinned={isT2Pinned("ink_muted")}
        onreset={() => clearT2("ink_muted")}>
        <ColorField label="" value={theme.content?.muted ?? "#4a4a4a"}
          onchange={(v) => pinT2("ink_muted", v)}
          swatches={neutralSwatches} />
      </Field>
      <Field label="ink_subtle" hint="Subtle text / ticks"
        pinned={isT2Pinned("ink_subtle")}
        onreset={() => clearT2("ink_subtle")}>
        <ColorField label="" value={theme.content?.secondary ?? "#6e6e6e"}
          onchange={(v) => pinT2("ink_subtle", v)}
          swatches={neutralSwatches} />
      </Field>

      <!-- Rules (dividers) — neutral ramp. -->
      <Field label="rule_subtle" hint="Cell hairlines"
        pinned={isT2Pinned("rule_subtle")}
        onreset={() => clearT2("rule_subtle")}>
        <ColorField label="" value={theme.divider?.subtle ?? "#e0e0e0"}
          onchange={(v) => pinT2("rule_subtle", v)}
          swatches={neutralSwatches} />
      </Field>
      <Field label="rule_strong" hint="Header rule, axis line"
        pinned={isT2Pinned("rule_strong")}
        onreset={() => clearT2("rule_strong")}>
        <ColorField label="" value={theme.divider?.strong ?? "#808080"}
          onchange={(v) => pinT2("rule_strong", v)}
          swatches={neutralSwatches} />
      </Field>

      <!-- Accent roles — swatches from the live accent ramp. -->
      <Field label="accent" hint="Engagement default"
        pinned={isT2Pinned("accent")}
        onreset={() => clearT2("accent")}>
        <ColorField label="" value={theme.accent?.default ?? "#c8553d"}
          onchange={(v) => pinT2("accent", v)}
          swatches={accentSwatches} />
      </Field>
      <Field label="accent_subtle" hint="Hover/selected tint"
        pinned={isT2Pinned("accent_subtle")}
        onreset={() => clearT2("accent_subtle")}>
        <ColorField label="" value={theme.accent?.muted ?? "#f0ddd9"}
          onchange={(v) => pinT2("accent_subtle", v)}
          swatches={accentSwatches} />
      </Field>
    </Accordion>

    <!-- ── Cluster pins ─────────────────────────────────────────────
         T3 cluster pins. Header / column group / first column show only
         the currently-active variant — switching the variant in Structure
         brings up a different row set. Less visual noise than rendering
         all 9 cells of each cluster. -->
    <Accordion title="Advanced — cluster pins" hint="Pin individual cluster fields. Header / column group / first column show the active variant." open={false}>
      <!-- Cluster pin swatches: header bold + columnGroup bold = brand
           ramp (the variant's bg is brand step 9); other variants and
           row group / plot scaffold = neutral. Active-variant routing
           keeps the swatch set on-palette for the visible variant. -->
      {@const headerSwatches = hStyle === "bold" ? brandSwatches : neutralSwatches}
      {@const cgSwatches = hStyle === "bold" ? brandSwatches : neutralSwatches}

      <div class="advanced-subhead">Header — {hStyle}</div>
      <Field label="bg"
        pinned={store.isOverridden(["header", hStyle, "bg"])}
        onreset={() => store.clearOverride(["header", hStyle, "bg"])}>
        <ColorField label="" value={hVar?.bg ?? "#ffffff"}
          onchange={(v) => store.setThemeField(["header", hStyle, "bg"], v)}
          swatches={headerSwatches} />
      </Field>
      <Field label="fg"
        pinned={store.isOverridden(["header", hStyle, "fg"])}
        onreset={() => store.clearOverride(["header", hStyle, "fg"])}>
        <ColorField label="" value={hVar?.fg ?? "#1f1f1f"}
          onchange={(v) => store.setThemeField(["header", hStyle, "fg"], v)}
          swatches={neutralSwatches} />
      </Field>
      <Field label="rule"
        pinned={store.isOverridden(["header", hStyle, "rule"])}
        onreset={() => store.clearOverride(["header", hStyle, "rule"])}>
        <ColorField label="" value={hVar?.rule ?? "#808080"}
          onchange={(v) => store.setThemeField(["header", hStyle, "rule"], v)}
          swatches={neutralSwatches} />
      </Field>

      <div class="advanced-subhead">Column group — {hStyle}</div>
      <Field label="bg"
        pinned={store.isOverridden(["columnGroup", hStyle, "bg"])}
        onreset={() => store.clearOverride(["columnGroup", hStyle, "bg"])}>
        <ColorField label="" value={cgVar?.bg ?? "#ffffff"}
          onchange={(v) => store.setThemeField(["columnGroup", hStyle, "bg"], v)}
          swatches={cgSwatches} />
      </Field>
      <Field label="fg"
        pinned={store.isOverridden(["columnGroup", hStyle, "fg"])}
        onreset={() => store.clearOverride(["columnGroup", hStyle, "fg"])}>
        <ColorField label="" value={cgVar?.fg ?? "#1f1f1f"}
          onchange={(v) => store.setThemeField(["columnGroup", hStyle, "fg"], v)}
          swatches={neutralSwatches} />
      </Field>
      <Field label="rule"
        pinned={store.isOverridden(["columnGroup", hStyle, "rule"])}
        onreset={() => store.clearOverride(["columnGroup", hStyle, "rule"])}>
        <ColorField label="" value={cgVar?.rule ?? "#808080"}
          onchange={(v) => store.setThemeField(["columnGroup", hStyle, "rule"], v)}
          swatches={neutralSwatches} />
      </Field>

      <div class="advanced-subhead">First column — {fcStyle}</div>
      <Field label="bg"
        pinned={store.isOverridden(["firstColumn", fcStyle, "bg"])}
        onreset={() => store.clearOverride(["firstColumn", fcStyle, "bg"])}>
        <ColorField label="" value={fcVar?.bg ?? "#ffffff"}
          onchange={(v) => store.setThemeField(["firstColumn", fcStyle, "bg"], v)}
          swatches={neutralSwatches} />
      </Field>
      <Field label="fg"
        pinned={store.isOverridden(["firstColumn", fcStyle, "fg"])}
        onreset={() => store.clearOverride(["firstColumn", fcStyle, "fg"])}>
        <ColorField label="" value={fcVar?.fg ?? "#1f1f1f"}
          onchange={(v) => store.setThemeField(["firstColumn", fcStyle, "fg"], v)}
          swatches={neutralSwatches} />
      </Field>

      <div class="advanced-subhead">Row group tiers</div>
      <Field label="L1 bg" hint="Top-level group bar (brand step 2 default)"
        pinned={store.isOverridden(["rowGroup", "L1", "bg"])}
        onreset={() => store.clearOverride(["rowGroup", "L1", "bg"])}>
        <ColorField label="" value={(theme.rowGroup?.L1?.bg as string | undefined) ?? "#e8e6e1"}
          onchange={(v) => store.setThemeField(["rowGroup", "L1", "bg"], v)}
          swatches={brandSwatches} />
      </Field>
      <Field label="L2 bg"
        pinned={store.isOverridden(["rowGroup", "L2", "bg"])}
        onreset={() => store.clearOverride(["rowGroup", "L2", "bg"])}>
        <ColorField label="" value={(theme.rowGroup?.L2?.bg as string | undefined) ?? "#efedea"}
          onchange={(v) => store.setThemeField(["rowGroup", "L2", "bg"], v)}
          swatches={neutralSwatches} />
      </Field>
      <Field label="L3 bg"
        pinned={store.isOverridden(["rowGroup", "L3", "bg"])}
        onreset={() => store.clearOverride(["rowGroup", "L3", "bg"])}>
        <ColorField label="" value={(theme.rowGroup?.L3?.bg as string | undefined) ?? "#f5f3f1"}
          onchange={(v) => store.setThemeField(["rowGroup", "L3", "bg"], v)}
          swatches={neutralSwatches} />
      </Field>

      <div class="advanced-subhead">Row interactions</div>
      <Field label="hover bg"
        pinned={store.isOverridden(["row", "hover", "bg"])}
        onreset={() => store.clearOverride(["row", "hover", "bg"])}>
        <ColorField label="" value={(theme.row?.hover?.bg as string | undefined) ?? "#f0ddd9"}
          onchange={(v) => store.setThemeField(["row", "hover", "bg"], v)}
          swatches={accentSwatches} />
      </Field>
      <Field label="selected bg"
        pinned={store.isOverridden(["row", "selected", "bg"])}
        onreset={() => store.clearOverride(["row", "selected", "bg"])}>
        <ColorField label="" value={(theme.row?.selected?.bg as string | undefined) ?? "#f0ddd9"}
          onchange={(v) => store.setThemeField(["row", "selected", "bg"], v)}
          swatches={accentSwatches} />
      </Field>

      <div class="advanced-subhead">Plot scaffold</div>
      <Field label="axis line"
        pinned={store.isOverridden(["plot", "axisLine"])}
        onreset={() => store.clearOverride(["plot", "axisLine"])}>
        <ColorField label="" value={theme.plot?.axisLine ?? "#808080"}
          onchange={(v) => store.setThemeField(["plot", "axisLine"], v)}
          swatches={neutralSwatches} />
      </Field>
      <Field label="tick mark"
        pinned={store.isOverridden(["plot", "tickMark"])}
        onreset={() => store.clearOverride(["plot", "tickMark"])}>
        <ColorField label="" value={theme.plot?.tickMark ?? "#808080"}
          onchange={(v) => store.setThemeField(["plot", "tickMark"], v)}
          swatches={neutralSwatches} />
      </Field>
      <Field label="gridline"
        pinned={store.isOverridden(["plot", "gridline"])}
        onreset={() => store.clearOverride(["plot", "gridline"])}>
        <ColorField label="" value={theme.plot?.gridline ?? "#e0e0e0"}
          onchange={(v) => store.setThemeField(["plot", "gridline"], v)}
          swatches={neutralSwatches} />
      </Field>
      <Field label="reference"
        pinned={store.isOverridden(["plot", "reference"])}
        onreset={() => store.clearOverride(["plot", "reference"])}>
        <ColorField label="" value={theme.plot?.reference ?? "#808080"}
          onchange={(v) => store.setThemeField(["plot", "reference"], v)}
          swatches={neutralSwatches} />
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

  /* Ramp visualization strips — under Identity, one row per ramp. Each
     row is `[label  step×12]`; cells are flush-stacked with a hairline
     bottom border for legibility on near-white steps. */
  .ramp-strips {
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding: 10px 0 4px 28px;
  }
  .ramp-row {
    display: grid;
    grid-template-columns: 70px 1fr;
    align-items: center;
    gap: 8px;
  }
  .ramp-label {
    font-family: var(--v2-font-sans, system-ui);
    font-size: var(--v2-text-micro, 9.5px);
    font-feature-settings: "smcp" 1, "c2sc" 1;
    text-transform: lowercase;
    letter-spacing: var(--v2-track-flag, 0.14em);
    color: var(--v2-ink-3, #8a8478);
    line-height: 1;
  }
  .ramp {
    display: grid;
    grid-template-columns: repeat(12, 1fr);
    height: 14px;
    border: 1px solid var(--v2-rule-soft, #e6e0d1);
    border-radius: var(--v2-r-hair, 2px);
    overflow: hidden;
  }
  .ramp-step {
    width: 100%;
    height: 100%;
    transition: transform 80ms var(--v2-ease, ease-out);
    cursor: help;
  }
  .ramp-step:hover {
    transform: scaleY(1.4);
    z-index: 1;
    position: relative;
  }

  /* Inline subheading inside the Advanced accordion — groups T3 cluster
     pins by area (Header / Row / Plot etc.) without nested accordions. */
  .advanced-subhead {
    font-family: var(--v2-font-sans, system-ui);
    font-size: var(--v2-text-micro, 9.5px);
    font-feature-settings: "smcp" 1, "c2sc" 1;
    text-transform: lowercase;
    letter-spacing: var(--v2-track-flag, 0.14em);
    color: var(--v2-ink-3, #8a8478);
    font-weight: 500;
    line-height: 1;
    padding: 12px 0 4px 28px;
    user-select: none;
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

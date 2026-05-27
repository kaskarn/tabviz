<!--
  ThemeControl — settings-panel Theme tab.

  Was 753 lines (cascade logic + boilerplate per color × 30+); now
  ~280 with the cascade logic extracted to theme-cascade.ts and the
  markup rationalized onto v2 primitives.

  Three zones (Identity / Roles / Components) mirror R-side cascade
  tiers (T1 inputs → T2 derived → T3 component slots). Identity stays
  always-open (the keystone); roles and components collapse onto
  v2 Accordions since they're cascade-derived and usually viewed
  one-section-at-a-time when fine-tuning.

  Wiring rationalization:
  - All cascade logic in `theme-cascade.ts` (pure, unit-testable)
  - This file binds store accessors into a CascadeCtx and renders
  - ColorField (v2-skinned Swatch wrapper) used uniformly
  - FontFamily primitive replaces the FontFamilyPicker bespoke wrapper
-->
<script lang="ts">
  import type { TabvizStore } from "$stores/tabvizStore.svelte";
  import { FONT_PRESETS } from "$lib/font-presets";
  import ColorField from "./ColorField.svelte";
  import Section from "$components/primitives/v2/Section.svelte";
  import Accordion from "$components/primitives/v2/Accordion.svelte";
  import Field from "$components/primitives/v2/Field.svelte";
  import FontFamily from "$components/primitives/v2/FontFamily.svelte";
  import type { FontEntry } from "$components/primitives/v2/FontFamily.svelte";
  import { oklchDarken } from "$lib/oklch";
  import * as C from "./theme-cascade";
  import {
    PAPER_SWATCHES, INK_SWATCHES, ACCENT_SWATCHES,
    NEUTRAL_SWATCHES, STATUS_SWATCHES, SERIES_SWATCHES, colors,
  } from "./swatch-palettes";

  interface Props { store: TabvizStore; }
  let { store }: Props = $props();

  const theme  = $derived(store.spec?.theme);
  const inputs = $derived(theme?.inputs);

  // CascadeCtx — rebuilt every render so cascade helpers always see
  // the latest theme+inputs read state. Logic lives in theme-cascade.
  const ctx = $derived<C.CascadeCtx>({
    setPath:    (p, v) => store.setThemeField(p, v),
    setDerived: (p, v) => store.setThemeFieldDerived(p, v),
    clearOver:  (p)    => store.clearOverride(p),
    isOver:     (p)    => store.isOverridden(p),
    theme:  theme as never,
    inputs: inputs as never,
  });

  // Convert the broader FontPreset list to FontFamily's FontEntry shape.
  const fontRoster: FontEntry[] = FONT_PRESETS.map((p) => ({
    value: p.stack,
    label: p.hint ? `${p.name} — ${p.hint}` : p.name,
  }));

  // Header-variant-aware overridden gate for the bg field — only the
  // bold variant is pin-derived; light/tint don't have a default to
  // reset to in this UI.
  function headerBgOverridden(): boolean {
    return C.activeHeaderVariant(ctx) === "bold" && ctx.isOver(["header", "bold", "bg"]);
  }
  function headerBgReset() {
    if (C.activeHeaderVariant(ctx) === "bold") C.resetHeaderBoldBg(ctx);
  }
</script>

{#if theme}
  <div class="theme-ctrl" data-tv-v2>

    <!-- ── Identity (T1 keystone) ─────────────────────────────────── -->
    <Section
      title="Identity"
      glyph="section.identity"
      hint="Primary + secondary form the mirror chain. Everything chrome inherits from these."
    >
      <Field label="Primary" hint="Title, bold header, series[0]">
        <ColorField label="" value={(inputs?.primary as string | undefined) ?? theme.accent?.default ?? "#0891B2"}
          onchange={(v) => C.applyPrimary(ctx, v)}
          swatches={colors(ACCENT_SWATCHES)} />
      </Field>
      <Field label="Secondary" hint="Structure + chrome texture" pinned={ctx.isOver(["inputs", "secondary"])}
        onreset={() => C.resetSecondary(ctx)}>
        <ColorField label="" value={(inputs?.secondary as string | undefined) ?? C.currentPrimary(ctx)}
          onchange={(v) => C.applySecondary(ctx, v)}
          swatches={colors(NEUTRAL_SWATCHES)} />
      </Field>
    </Section>

    <!-- ── Engagement (orthogonal axis: hover / selected / semantic) ── -->
    <Section
      title="Engagement"
      glyph="section.engagement"
      hint="Accent owns hover, selected, callouts — orthogonal to identity."
    >
      <Field label="Accent" hint="Hover, selected, semantic callouts">
        <ColorField label="" value={(inputs?.accent as string | undefined) ?? theme.accent?.default ?? "#8B5CF6"}
          onchange={(v) => C.applyAccent(ctx, v)}
          swatches={colors(ACCENT_SWATCHES)} />
      </Field>
    </Section>

    <!-- ── Typography (families as specimens) ───────────────────────
         A 2×2 grid where each cell IS the specimen — clicking the
         dropdown swaps the family and the "Aa 123" sample updates
         live. Beats four stacked dropdown rows: the user sees the
         font choice as itself, not as a name. -->
    <Section title="Typography" glyph="section.text" hint="Body for cells, display for titles, numeric for figures, mono for code.">
      <div class="font-grid">
        <div class="specimen-card">
          <div class="specimen-label">Body</div>
          <div class="specimen-sample" style:font-family={theme.text?.body?.family ?? "system-ui"}>Aa 123</div>
          <FontFamily
            value={theme.text?.body?.family ?? (inputs?.fontBody as string | undefined) ?? null}
            roster={fontRoster}
            onchange={(v) => {
              ctx.setPath(["inputs", "fontBody"], v);
              for (const role of ["body", "cell", "label", "tick", "footnote", "caption", "subtitle"]) {
                ctx.setPath(["text", role, "family"], v);
              }
            }}
          />
        </div>
        <div class="specimen-card">
          <div class="specimen-label">Display</div>
          <div class="specimen-sample" style:font-family={theme.text?.title?.family ?? "serif"}>Aa 123</div>
          <FontFamily
            value={theme.text?.title?.family ?? (inputs?.fontDisplay as string | undefined) ?? null}
            roster={fontRoster}
            onchange={(v) => {
              ctx.setPath(["inputs", "fontDisplay"], v);
              ctx.setPath(["text", "title", "family"], v);
            }}
          />
        </div>
        <div class="specimen-card">
          <div class="specimen-label">Numeric</div>
          <div class="specimen-sample" style:font-family={theme.text?.numeric?.family ?? theme.text?.body?.family ?? "system-ui"}>Aa 123</div>
          <FontFamily
            value={theme.text?.numeric?.family ?? null}
            roster={fontRoster}
            onchange={(v) => ctx.setPath(["text", "numeric", "family"], v)}
          />
        </div>
        <div class="specimen-card">
          <div class="specimen-label">Mono</div>
          <div class="specimen-sample" style:font-family={(inputs?.fontMono as string | undefined) ?? "ui-monospace"}>Aa 123</div>
          <FontFamily
            value={(inputs?.fontMono as string | undefined) ?? null}
            roster={fontRoster}
            onchange={(v) => ctx.setPath(["inputs", "fontMono"], v)}
          />
        </div>
      </div>
    </Section>

    <!-- ── Roles (T2 derived; collapsed) ──────────────────────────── -->
    <div class="zone-divider">Roles · derived semantic tokens</div>

    <Accordion title="Deep variants" hint="Darkened shadows of Primary + Secondary. Used for title fg, axis line, bold-mode bands." open={false}>
      <Field label="↳ Primary" pinned={ctx.isOver(["inputs", "primaryDeep"])}
        onreset={() => C.resetPrimaryDeep(ctx)}>
        <ColorField label="" value={(inputs?.primaryDeep as string | undefined) ?? oklchDarken(C.currentPrimary(ctx), 0.15)}
          onchange={(v) => C.applyPrimaryDeep(ctx, v)}
          swatches={colors(ACCENT_SWATCHES)} />
      </Field>
      <Field label="↳ Secondary" pinned={ctx.isOver(["inputs", "secondaryDeep"])}
        onreset={() => C.resetSecondaryDeep(ctx)}>
        <ColorField label="" value={(inputs?.secondaryDeep as string | undefined) ?? C.currentSecondaryDeep(ctx)}
          onchange={(v) => C.applySecondaryDeep(ctx, v)}
          swatches={colors(NEUTRAL_SWATCHES)} />
      </Field>
    </Accordion>

    <Accordion title="Text colors" hint="Body / secondary / muted / inverse" open={false}>
      <Field label="Foreground"><ColorField label="" value={theme.cell?.fg ?? theme.content?.primary ?? "#000000"}
        onchange={(v) => C.setForeground(ctx, v)}
        swatches={colors(INK_SWATCHES)} /></Field>
      <Field label="Secondary"><ColorField label="" value={theme.content?.secondary ?? "#444444"}
        onchange={(v) => ctx.setPath(["content","secondary"], v)}
        swatches={colors(INK_SWATCHES)} /></Field>
      <Field label="Muted"><ColorField label="" value={theme.content?.muted ?? "#888888"}
        onchange={(v) => ctx.setPath(["content","muted"], v)}
        swatches={colors(NEUTRAL_SWATCHES)} /></Field>
      <Field label="Inverse" hint="Text on bold-mode bands"><ColorField label=""
        value={theme.content?.inverse ?? "#ffffff"} onchange={(v) => C.setInverseContent(ctx, v)}
        swatches={colors(PAPER_SWATCHES)} /></Field>
    </Accordion>

    <Accordion title="Surfaces" hint="Row backgrounds + banding partner" open={false}>
      <Field label="Background"><ColorField label="" value={theme.row?.base?.bg ?? theme.surface?.base ?? "#ffffff"}
        onchange={(v) => C.setBackground(ctx, v)}
        swatches={colors(PAPER_SWATCHES)} /></Field>
      <Field label="Banding partner"><ColorField label="" value={theme.row?.alt?.bg ?? theme.surface?.muted ?? "#f8fafc"}
        onchange={(v) => C.setBandingPartner(ctx, v)}
        swatches={colors(PAPER_SWATCHES)} /></Field>
    </Accordion>

    <Accordion title="Selection & accents" open={false}>
      <Field label="Hover / selected"><ColorField label="" value={theme.accent?.muted ?? "#dde1e7"}
        onchange={(v) => {
          ctx.setPath(["accent", "muted"], v);
          ctx.setPath(["row", "hover", "bg"], v);
          ctx.setPath(["row", "selected", "bg"], v);
        }}
        swatches={colors(ACCENT_SWATCHES)} /></Field>
      <Field label="L1 group bar" pinned={ctx.isOver(["rowGroup", "L1", "bg"])}
        onreset={() => C.resetL1Bg(ctx)}>
        <ColorField label="" value={(theme.rowGroup?.L1?.bg as string | undefined) ?? "#e1e5ea"}
          onchange={(v) => ctx.setPath(["rowGroup", "L1", "bg"], v)}
          swatches={colors(PAPER_SWATCHES)} />
      </Field>
    </Accordion>

    <Accordion title="Dividers" hint="Hairlines + structural rules" open={false}>
      <Field label="Subtle" hint="Cell borders"
        pinned={ctx.isOver(["divider", "subtle"]) || ctx.isOver(["cell", "border"])}
        onreset={() => C.resetSubtleDivider(ctx)}>
        <ColorField label="" value={theme.cell?.border ?? theme.divider?.subtle ?? "#e2e8f0"}
          onchange={(v) => {
            ctx.setPath(["divider", "subtle"], v);
            ctx.setPath(["cell", "border"], v);
          }}
          swatches={colors(NEUTRAL_SWATCHES)} />
      </Field>
      <Field label="Strong" hint="Header rule, group rules, axis line">
        <ColorField label="" value={theme.divider?.strong ?? "#94a3b8"}
          onchange={(v) => C.setStrongDivider(ctx, v)}
          swatches={colors(NEUTRAL_SWATCHES)} />
      </Field>
    </Accordion>

    <Accordion title="Status" hint="Semantic indicators" open={false}>
      <Field label="Positive"><ColorField label="" value={theme.status?.positive ?? "#3F7D3F"}
        onchange={(v) => ctx.setPath(["status","positive"], v)}
        swatches={colors(STATUS_SWATCHES)} /></Field>
      <Field label="Negative"><ColorField label="" value={theme.status?.negative ?? "#B33A3A"}
        onchange={(v) => ctx.setPath(["status","negative"], v)}
        swatches={colors(STATUS_SWATCHES)} /></Field>
      <Field label="Warning"><ColorField label="" value={theme.status?.warning ?? "#C68A2E"}
        onchange={(v) => ctx.setPath(["status","warning"], v)}
        swatches={colors(STATUS_SWATCHES)} /></Field>
      <Field label="Info"><ColorField label="" value={theme.status?.info ?? theme.accent?.default ?? "#2C4F7C"}
        onchange={(v) => ctx.setPath(["status","info"], v)}
        swatches={colors(STATUS_SWATCHES)} /></Field>
    </Accordion>

    <!-- ── Components (T3 bindings; collapsed) ────────────────────── -->
    <div class="zone-divider">Components · per-binding overrides</div>

    <Accordion title="Header" hint="Active variant only" open={false}>
      <Field label="Background" pinned={headerBgOverridden()} onreset={headerBgReset}>
        <ColorField label=""
          value={(theme.header as { light?: { bg?: string }; tint?: { bg?: string }; bold?: { bg?: string } } | undefined)?.[C.activeHeaderVariant(ctx)]?.bg ?? "#f8fafc"}
          onchange={(v) => C.setHeaderBg(ctx, v)}
          swatches={colors(PAPER_SWATCHES)} />
      </Field>
      <Field label="Text">
        <ColorField label=""
          value={(theme.header as { light?: { fg?: string }; tint?: { fg?: string }; bold?: { fg?: string } } | undefined)?.[C.activeHeaderVariant(ctx)]?.fg ?? "#000000"}
          onchange={(v) => C.setHeaderFg(ctx, v)}
          swatches={colors(INK_SWATCHES)} />
      </Field>
    </Accordion>

    <Accordion title="Plot" hint="Title + axis text" open={false}>
      <Field label="Title" pinned={ctx.isOver(["text", "title", "fg"])}
        onreset={() => C.resetTitleFg(ctx)}>
        <ColorField label="" value={(theme.text?.title?.fg as string | undefined) ?? C.currentPrimaryDeep(ctx)}
          onchange={(v) => ctx.setPath(["text", "title", "fg"], v)}
          swatches={colors(INK_SWATCHES)} />
      </Field>
      <Field label="Axis label">
        <ColorField label="" value={(theme.plot?.axisLabel?.fg as string | undefined) ?? theme.content?.muted ?? "#1A1A1A"}
          onchange={(v) => ctx.setPath(["plot", "axisLabel", "fg"], v)}
          swatches={colors(INK_SWATCHES)} />
      </Field>
      <Field label="Axis tick">
        <ColorField label="" value={(theme.plot?.tickLabel?.fg as string | undefined) ?? theme.content?.muted ?? "#1A1A1A"}
          onchange={(v) => ctx.setPath(["plot", "tickLabel", "fg"], v)}
          swatches={colors(INK_SWATCHES)} />
      </Field>
    </Accordion>

    <Accordion title="Series" hint="Per-effect anchor; series 1 → primary" open={false}>
      {#if Array.isArray(theme.series)}
        {#each theme.series as slot, i (i)}
          <Field
            label={`Series ${i + 1}`}
            pinned={i === 0 ? ctx.isOver(["series", 0, "fill"]) : undefined}
            onreset={i === 0 ? () => C.resetSeriesPrimary(ctx) : undefined}
          >
            <ColorField label="" value={slot?.fill ?? "#888888"}
              onchange={(v) => C.setSeriesFill(ctx, i, v)}
              swatches={colors(SERIES_SWATCHES)} />
            {#if theme.series.length > 1}
              <button
                type="button"
                class="series-remove"
                aria-label={`Remove series ${i + 1}`}
                onclick={() => C.removeSeries(ctx, i)}
              >×</button>
            {/if}
          </Field>
        {/each}
      {/if}
      <button type="button" class="series-add" onclick={() => C.addSeries(ctx)}>+ Add series</button>
    </Accordion>

  </div>
{/if}

<style>
  .theme-ctrl {
    display: flex;
    flex-direction: column;
    gap: 0;
  }

  /* Zone divider — single thin label between top-level groupings.
     Replaces the bespoke .zone-* / .zone-header / .zone-description
     stack with one tracked-uppercase row. */
  /* Zone divider — a quiet meta-label between groupings of accordions.
     Designed to be LESS LOUD than Section titles (which announce
     content); this is just punctuation. Italic serif, centered, em-dash
     flanked, no rule. Reads like a chapter-break ornament in a journal. */
  .zone-divider {
    font-family: var(--v2-font-serif, "EB Garamond", "Palatino", Georgia, serif);
    font-style: italic;
    font-size: 11px;
    letter-spacing: 0.04em;
    color: var(--v2-ink-3, #8a8478);
    text-align: center;
    padding: 18px 0 4px;
    line-height: 1;
    user-select: none;
  }
  .zone-divider::before { content: "— "; }
  .zone-divider::after  { content: " —"; }

  /* Typography specimen grid — 2×2 grid of family cards. Each card
     shows the live "Aa 123" sample rendered in the family + a small
     picker below. Indented to match the section's hanging title. */
  /* Typography specimen grid — 2×2 of font sample cards. minmax(0,1fr)
     is the critical bit: without it the 1fr tracks size to max-content
     (the giant Aa sample) and overflow happens silently. With it the
     cards size to the available column and the sample clips/scales
     instead. */
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

  /* Series add/remove — small chrome buttons. */
  .series-remove {
    appearance: none;
    border: 0;
    background: transparent;
    width: 18px;
    height: 18px;
    border-radius: 3px;
    color: var(--v2-ink-3, #8a8478);
    font-size: 14px;
    line-height: 1;
    cursor: pointer;
    flex: none;
  }
  .series-remove:hover {
    background: var(--v2-hover-tint, rgba(21,20,14,0.05));
    color: var(--v2-hot, #b53a1f);
  }
  .series-add {
    appearance: none;
    border: 0;
    background: transparent;
    padding: 6px 8px;
    font: inherit;
    font-family: var(--v2-font-mono, ui-monospace, monospace);
    font-size: var(--v2-text-small, 10.5px);
    color: var(--v2-ink-2, #4a463c);
    cursor: pointer;
    border-radius: 3px;
    text-align: left;
    width: 100%;
  }
  .series-add:hover {
    background: var(--v2-hover-tint, rgba(21,20,14,0.05));
    color: var(--v2-ink, #15140e);
  }
</style>

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
      glyph="section.style"
      hint="Primary + secondary mirror chain; accent is orthogonal. Everything else cascades from these."
    >
      <Field label="Primary" hint="Title, bold header, series[0]">
        <ColorField label="" value={(inputs?.primary as string | undefined) ?? theme.accent?.default ?? "#0891B2"}
          onchange={(v) => C.applyPrimary(ctx, v)} />
      </Field>
      <Field label="Secondary" hint="Structure + chrome texture" pinned={ctx.isOver(["inputs", "secondary"])}
        onreset={() => C.resetSecondary(ctx)}>
        <ColorField label="" value={(inputs?.secondary as string | undefined) ?? C.currentPrimary(ctx)}
          onchange={(v) => C.applySecondary(ctx, v)} />
      </Field>
      <Field label="Accent" hint="Hover, selected, semantic callouts">
        <ColorField label="" value={(inputs?.accent as string | undefined) ?? theme.accent?.default ?? "#8B5CF6"}
          onchange={(v) => C.applyAccent(ctx, v)} />
      </Field>
    </Section>

    <!-- ── Fonts ──────────────────────────────────────────────────── -->
    <Section title="Fonts" glyph="type.text" hint="Body for cells/headers/labels; display for plot titles.">
      <Field label="Body">
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
      </Field>
      <Field label="Display">
        <FontFamily
          value={theme.text?.title?.family ?? (inputs?.fontDisplay as string | undefined) ?? null}
          roster={fontRoster}
          onchange={(v) => {
            ctx.setPath(["inputs", "fontDisplay"], v);
            ctx.setPath(["text", "title", "family"], v);
          }}
        />
      </Field>
      <Field label="Mono">
        <FontFamily
          value={(inputs?.fontMono as string | undefined) ?? null}
          roster={fontRoster}
          onchange={(v) => ctx.setPath(["inputs", "fontMono"], v)}
        />
      </Field>
    </Section>

    <!-- ── Roles (T2 derived; collapsed) ──────────────────────────── -->
    <div class="zone-divider">Roles · derived semantic tokens</div>

    <Accordion title="Deep companions" hint="oklch_darken(seed, 0.15)" open={false}>
      <Field label="Primary (deep)" pinned={ctx.isOver(["inputs", "primaryDeep"])}
        onreset={() => C.resetPrimaryDeep(ctx)}>
        <ColorField label="" value={(inputs?.primaryDeep as string | undefined) ?? oklchDarken(C.currentPrimary(ctx), 0.15)}
          onchange={(v) => C.applyPrimaryDeep(ctx, v)} />
      </Field>
      <Field label="Secondary (deep)" pinned={ctx.isOver(["inputs", "secondaryDeep"])}
        onreset={() => C.resetSecondaryDeep(ctx)}>
        <ColorField label="" value={(inputs?.secondaryDeep as string | undefined) ?? C.currentSecondaryDeep(ctx)}
          onchange={(v) => C.applySecondaryDeep(ctx, v)} />
      </Field>
    </Accordion>

    <Accordion title="Text colors" hint="Body / secondary / muted / inverse" open={false}>
      <Field label="Foreground"><ColorField label="" value={theme.cell?.fg ?? theme.content?.primary ?? "#000000"}
        onchange={(v) => C.setForeground(ctx, v)} /></Field>
      <Field label="Secondary"><ColorField label="" value={theme.content?.secondary ?? "#444444"}
        onchange={(v) => ctx.setPath(["content","secondary"], v)} /></Field>
      <Field label="Muted"><ColorField label="" value={theme.content?.muted ?? "#888888"}
        onchange={(v) => ctx.setPath(["content","muted"], v)} /></Field>
      <Field label="Inverse" hint="Text on bold-mode bands"><ColorField label=""
        value={theme.content?.inverse ?? "#ffffff"} onchange={(v) => C.setInverseContent(ctx, v)} /></Field>
    </Accordion>

    <Accordion title="Surfaces" hint="Row backgrounds + banding partner" open={false}>
      <Field label="Background"><ColorField label="" value={theme.row?.base?.bg ?? theme.surface?.base ?? "#ffffff"}
        onchange={(v) => C.setBackground(ctx, v)} /></Field>
      <Field label="Banding partner"><ColorField label="" value={theme.row?.alt?.bg ?? theme.surface?.muted ?? "#f8fafc"}
        onchange={(v) => C.setBandingPartner(ctx, v)} /></Field>
    </Accordion>

    <Accordion title="Selection & accents" open={false}>
      <Field label="Hover / selected"><ColorField label="" value={theme.accent?.muted ?? "#dde1e7"}
        onchange={(v) => {
          ctx.setPath(["accent", "muted"], v);
          ctx.setPath(["row", "hover", "bg"], v);
          ctx.setPath(["row", "selected", "bg"], v);
        }} /></Field>
      <Field label="L1 group bar" pinned={ctx.isOver(["rowGroup", "L1", "bg"])}
        onreset={() => C.resetL1Bg(ctx)}>
        <ColorField label="" value={(theme.rowGroup?.L1?.bg as string | undefined) ?? "#e1e5ea"}
          onchange={(v) => ctx.setPath(["rowGroup", "L1", "bg"], v)} />
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
          }} />
      </Field>
      <Field label="Strong" hint="Header rule, group rules, axis line">
        <ColorField label="" value={theme.divider?.strong ?? "#94a3b8"}
          onchange={(v) => C.setStrongDivider(ctx, v)} />
      </Field>
    </Accordion>

    <Accordion title="Status" hint="Semantic indicators" open={false}>
      <Field label="Positive"><ColorField label="" value={theme.status?.positive ?? "#3F7D3F"}
        onchange={(v) => ctx.setPath(["status","positive"], v)} /></Field>
      <Field label="Negative"><ColorField label="" value={theme.status?.negative ?? "#B33A3A"}
        onchange={(v) => ctx.setPath(["status","negative"], v)} /></Field>
      <Field label="Warning"><ColorField label="" value={theme.status?.warning ?? "#C68A2E"}
        onchange={(v) => ctx.setPath(["status","warning"], v)} /></Field>
      <Field label="Info"><ColorField label="" value={theme.status?.info ?? theme.accent?.default ?? "#2C4F7C"}
        onchange={(v) => ctx.setPath(["status","info"], v)} /></Field>
    </Accordion>

    <!-- ── Components (T3 bindings; collapsed) ────────────────────── -->
    <div class="zone-divider">Components · per-binding overrides</div>

    <Accordion title="Header" hint="Active variant only" open={false}>
      <Field label="Background" pinned={headerBgOverridden()} onreset={headerBgReset}>
        <ColorField label=""
          value={(theme.header as { light?: { bg?: string }; tint?: { bg?: string }; bold?: { bg?: string } } | undefined)?.[C.activeHeaderVariant(ctx)]?.bg ?? "#f8fafc"}
          onchange={(v) => C.setHeaderBg(ctx, v)} />
      </Field>
      <Field label="Text">
        <ColorField label=""
          value={(theme.header as { light?: { fg?: string }; tint?: { fg?: string }; bold?: { fg?: string } } | undefined)?.[C.activeHeaderVariant(ctx)]?.fg ?? "#000000"}
          onchange={(v) => C.setHeaderFg(ctx, v)} />
      </Field>
    </Accordion>

    <Accordion title="Plot" hint="Title + axis text" open={false}>
      <Field label="Title" pinned={ctx.isOver(["text", "title", "fg"])}
        onreset={() => C.resetTitleFg(ctx)}>
        <ColorField label="" value={(theme.text?.title?.fg as string | undefined) ?? C.currentPrimaryDeep(ctx)}
          onchange={(v) => ctx.setPath(["text", "title", "fg"], v)} />
      </Field>
      <Field label="Axis label">
        <ColorField label="" value={(theme.plot?.axisLabel?.fg as string | undefined) ?? theme.content?.muted ?? "#1A1A1A"}
          onchange={(v) => ctx.setPath(["plot", "axisLabel", "fg"], v)} />
      </Field>
      <Field label="Axis tick">
        <ColorField label="" value={(theme.plot?.tickLabel?.fg as string | undefined) ?? theme.content?.muted ?? "#1A1A1A"}
          onchange={(v) => ctx.setPath(["plot", "tickLabel", "fg"], v)} />
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
              onchange={(v) => C.setSeriesFill(ctx, i, v)} />
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
  .zone-divider {
    font-family: var(--v2-font-mono, ui-monospace, monospace);
    font-size: var(--v2-text-micro, 9.5px);
    text-transform: uppercase;
    letter-spacing: var(--v2-track-flag, 0.14em);
    color: var(--v2-ink-3, #8a8478);
    padding: 14px 0 6px;
    border-top: 1px solid var(--v2-rule-soft, #e6e0d1);
    margin-top: 8px;
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

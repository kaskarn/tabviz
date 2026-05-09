<script lang="ts">
  // v2 Spacing tab. Per-token overrides on top of the density preset.
  // Tokens grouped into coherent sections instead of a single flat list
  // behind an "Advanced" dropdown — the dropdown was hiding the entire
  // tab body, which made the Spacing tab feel empty.
  //
  // Two density tokens are NOT surfaced here:
  //  * spacing.padding ("Plot padding") — historical export-only knob
  //    that the interactive widget intentionally does not consume
  //    (containerPadding owns the outer-gutter story; padding would
  //    compound and produce two sliders that fight each other).
  //  * spacing.columnGroupPadding ("Column group pad") — only affects
  //    .column-group-header padding-left/right; for typical headers
  //    that fit within their column-group span, the visual effect is
  //    nil. Niche enough not to warrant a top-level slider.
  // Both stay on the SpacingTokens spec so authors can override via
  // set_spacing() in R.
  import type { ForestStore } from "$stores/forestStore.svelte";
  import SettingsSection from "./SettingsSection.svelte";
  import NumberField from "./NumberField.svelte";

  interface Props {
    store: ForestStore;
  }
  let { store }: Props = $props();

  const spacing = $derived(store.spec?.theme?.spacing);

  // Phase B: when an aspect target is pinned, the live lever ladder
  // overrides `rowHeight` (and, on the SVG path, vertical chrome
  // tokens). Show the LIVE post-ladder value in the panel so what the
  // user sees in the field matches what they see on screen. Only the
  // tokens the lever ladder actually mutates are aspect-driven; others
  // reflect the spec value as before.
  //
  // Aspect-driven tokens map: token name -> getter for live value off
  // store.layout. The widget only mutates rowHeight; svg-generator also
  // scales headerGap/axisGap/footerGap/headerHeight/rowGroupPadding/
  // bottomMargin/titleSubtitleGap, but those are NOT applied in the
  // live widget store today (they stay at the spec value), so listing
  // only rowHeight here matches what the user actually observes in the
  // browser. SVG export honours the full lever ladder via the R-side
  // path; that's a render-time concern, not a panel-display one.
  const ASPECT_DRIVEN_FIELDS = new Set(["rowHeight"]);

  const aspectActive = $derived(store.targetAspect != null);

  function effectiveValue(field: string): number {
    if (aspectActive && ASPECT_DRIVEN_FIELDS.has(field)) {
      const live = store.layout?.[field as keyof typeof store.layout];
      if (typeof live === "number") return Math.round(live * 100) / 100;
    }
    return (spacing?.[field] ?? 0) as number;
  }

  function set(field: string, value: number) {
    // Phase B: editing an aspect-driven field while a target is pinned
    // takes the user value as authoritative — clear targetAspect so the
    // panel and the rendered layout agree on the new value. Without
    // this, the user's edit would be immediately overwritten by the
    // ladder on the next reactive pass.
    if (aspectActive && ASPECT_DRIVEN_FIELDS.has(field)) {
      store.setTargetAspect(null);
    }
    store.setThemeField(["spacing", field], value);
  }

  // Coherent groups instead of one flat list. Ranges chosen to cover
  // both intentional design freedom (e.g. spacious-density themes) and
  // aspect-ratio-driven extremes (the lever ladder can push rowHeight
  // past 100 at ratio < 0.5, header / chrome similarly). Sliders are
  // input devices; the *displayed* value when aspect is pinned reflects
  // the live lever-ladder output (Phase B), so the range needs to
  // accommodate everything the user can produce — not just everything
  // they're likely to pin.
  const sections = [
    {
      title: "Row sizing",
      description: "Vertical room for body and header rows; padding inside cells.",
      tokens: [
        { field: "rowHeight",     label: "Row height",     min: 8,  max: 200, step: 1 },
        { field: "headerHeight",  label: "Header height",  min: 8,  max: 200, step: 1 },
        { field: "cellPaddingX",  label: "Cell padding (X)", min: 0, max: 80,  step: 1 },
      ],
    },
    {
      title: "Outer margins",
      description: "Container gutter and the gap below the plot before captions.",
      tokens: [
        { field: "containerPadding", label: "Container padding", min: 0, max: 80, step: 1 },
        { field: "bottomMargin",     label: "Bottom margin",     min: 0, max: 80, step: 1 },
      ],
    },
    {
      title: "Groups & nesting",
      description: "Spacing between row-groups and indent per nesting level.",
      tokens: [
        { field: "rowGroupPadding", label: "Row group pad",   min: 0, max: 80, step: 1 },
        { field: "indentPerLevel",  label: "Indent per level", min: 0, max: 60, step: 1 },
      ],
    },
    {
      title: "Plot scaffolding",
      description: "Gaps inside and around the plot region — title block to table, between title and subtitle, table to axis, table to footer.",
      tokens: [
        { field: "axisGap",          label: "Axis gap",            min: 0, max: 80, step: 1 },
        { field: "titleSubtitleGap", label: "Title-subtitle gap",  min: 0, max: 80, step: 1 },
        { field: "headerGap",        label: "Header-table gap",    min: 0, max: 80, step: 1 },
        { field: "footerGap",        label: "Footer gap",          min: 0, max: 80, step: 1 },
      ],
    },
  ];
</script>

{#if spacing}
  {#if aspectActive}
    <div class="aspect-banner">
      <span class="aspect-icon" aria-hidden="true">⚭</span>
      Row height is currently driven by the aspect-ratio slider. Editing
      it will clear the aspect target.
    </div>
  {/if}
  {#each sections as section (section.title)}
    <SettingsSection title={section.title} description={section.description}>
      {#each section.tokens as t (t.field)}
        {@const isAspectDriven = aspectActive && ASPECT_DRIVEN_FIELDS.has(t.field)}
        <NumberField
          label={isAspectDriven ? `${t.label} (aspect)` : t.label}
          value={effectiveValue(t.field)}
          min={t.min} max={t.max} step={t.step}
          onchange={(v) => set(t.field, v)}
        />
      {/each}
    </SettingsSection>
  {/each}
{/if}

<style>
  .aspect-banner {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 6px 10px;
    margin-bottom: 10px;
    border-radius: 4px;
    background: color-mix(in srgb, var(--tv-accent, #2563eb) 8%, transparent);
    border-left: 3px solid var(--tv-accent, #2563eb);
    color: var(--tv-fg, #0f172a);
    font-size: 11px;
    font-style: italic;
    line-height: 1.4;
  }
  .aspect-icon {
    font-size: 14px;
    line-height: 1;
  }
</style>

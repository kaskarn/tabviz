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
  // overrides several layout tokens. Show the LIVE post-ladder value
  // in the panel so what the user sees in the field matches what
  // they see on screen — and so that editing the field produces the
  // expected rendered result (WYSIWYG, not "input × chromeScale").
  //
  // Live-store mutations (post-Lever-2C):
  //   - `rowHeight`         scaled by `rowHeightScale`
  //   - `headerHeight`      scaled by `chromeScale`
  //
  // `axisHeight` is also scaled by `chromeScale` in the live store,
  // but it's a composite of `axisGap + axisRegionHeight` (the latter
  // is font-derived and fixed). Editing `axisGap` while aspect is
  // pinned still works directionally, but doesn't get the full
  // WYSIWYG treatment yet — left out of this set for now.
  //
  // For each field in the set, editing the field while a target is
  // pinned clears the target (see `set()` below) so the user's value
  // lands directly instead of being multiplied by the ladder on the
  // next reactive pass.
  const ASPECT_DRIVEN_FIELDS = new Set([
    "rowHeight",
    "headerHeight",
  ]);

  const aspectActive = $derived(store.targetAspect != null);

  // Most spacing tokens live under `theme.spacing.*`, but
  // `indentPerLevel` is read by the renderer from
  // `theme.rowGroup.indentPerLevel` (svg-generator.ts:1529). R-side
  // resolution inherits row_group.indent_per_level from
  // spacing.indent_per_level when the former is NA
  // (utils-theme-resolve.R:487-488), so serialized specs typically
  // carry the same value at both paths — but the live panel must
  // write to where the renderer reads, otherwise edits don't
  // propagate. Override the path here for the outlier; everything
  // else lands at `["spacing", field]`.
  function themePath(field: string): string[] {
    if (field === "indentPerLevel") return ["rowGroup", "indentPerLevel"];
    return ["spacing", field];
  }

  function effectiveValue(field: string): number {
    if (aspectActive && ASPECT_DRIVEN_FIELDS.has(field)) {
      const live = store.layout?.[field as keyof typeof store.layout];
      if (typeof live === "number") return Math.round(live * 100) / 100;
    }
    if (field === "indentPerLevel") {
      const rg = store.spec?.theme?.rowGroup as Record<string, number | undefined> | undefined;
      const inherited = rg?.indentPerLevel
        ?? (spacing?.[field] as number | undefined)
        ?? 0;
      return inherited;
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
    store.setThemeField(themePath(field), value);
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
      Row height and header height are currently driven by the
      aspect-ratio slider. Editing either will clear the aspect target.
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

<!--
  v2 SchemaSweep scenario — visual contact sheet that mounts
  ColumnEditorV2 against every concrete schema in SCHEMA_REGISTRY.
  Purpose: per-schema visual regression. If a schema's cascade,
  variant set, slot list, or option dispatch breaks, this scenario
  surfaces it on inspection of one screenshot.

  Layout: 3 editors per row, scrollable. Each card has the schema's
  key + label as a flag above the editor, plus a tiny "open"
  indicator when the editor has interesting state.

  Cards size to natural editor height (max 640) — the harness viewport
  scrolls. Use --viewport WxH on drive.mjs to get the full contact
  sheet.
-->
<script lang="ts">
  import { SCHEMA_REGISTRY } from "../../../../src/schema/columns";
  import ColumnEditorV2 from "../../../../src/components/column-editor-v2/ColumnEditorV2.svelte";
  import type { AvailableField, ColumnSpec } from "../../../../src/types";
  import type { ThemeSwatch } from "../../../../src/components/primitives/v2/types";
  import type { ColumnSchema } from "../../../../src/schema/types";

  // Same field menu every editor sees — covers the standard
  // FieldCategory range so slot pickers populate uniformly.
  const available: AvailableField[] = [
    { field: "study_id",       label: "study_id",       category: "string" },
    { field: "estimate",       label: "estimate",       category: "numeric" },
    { field: "lower",          label: "lower",          category: "numeric" },
    { field: "upper",          label: "upper",          category: "numeric" },
    { field: "n_events",       label: "n_events",       category: "integer" },
    { field: "n_total",        label: "n_total",        category: "integer" },
    { field: "is_significant", label: "is_significant", category: "logical" },
    { field: "publication_date",label:"publication_date",category: "date" },
    { field: "country",        label: "country",        category: "string" },
    { field: "series",         label: "series",         category: "array-numeric" },
  ];

  const swatches: ThemeSwatch[] = [
    { color: "#15140e", token: "ink" },
    { color: "#b53a1f", token: "accent" },
    { color: "#3d6e8e", token: "blue" },
  ];

  // Every concrete schema, sorted by category-grouping for readability.
  const concrete: ColumnSchema[] = Object.values(SCHEMA_REGISTRY)
    .filter((s) => !s.abstract);

  const CATEGORY_ORDER = ["text", "numeric", "visual", "glyph", "viz"] as const;
  function categoryWeight(c: ColumnSchema["category"] | undefined): number {
    if (!c) return 99;
    const i = (CATEGORY_ORDER as readonly string[]).indexOf(c);
    return i < 0 ? 99 : i;
  }

  const ordered = $derived(
    concrete.slice().sort((a, b) => {
      const w = categoryWeight(a.category) - categoryWeight(b.category);
      return w !== 0 ? w : a.label.localeCompare(b.label);
    }),
  );

  // Per-schema column draft — seeded with the schema's expected
  // bucket so the live preview chip + numeric-decimals reformat path
  // exercises whatever the schema needs.
  function draftFor(s: ColumnSchema): Partial<ColumnSpec> {
    return {
      id: `${s.key}_demo`,
      type: (s.type ?? "text") as ColumnSpec["type"],
      header: s.label,
      align: "left",
      options: s.optionOverrides
        ? ({ [s.bucket ?? s.key]: { ...s.optionOverrides } } as ColumnSpec["options"])
        : {},
      sortable: true,
      isGroup: false,
      field: "",
    } as Partial<ColumnSpec>;
  }

  // Bind one draft per schema, all reactive. Use a plain record so
  // the editor can mutate via bind:column. Seed once at mount —
  // schemas don't change at runtime so a single pass is sufficient
  // and avoids the runes warning about capturing `ordered`.
  const drafts: Record<string, Partial<ColumnSpec>> = $state(
    Object.fromEntries(concrete.map((s) => [s.key, draftFor(s)])),
  );
</script>

<div class="sheet">
  <header class="sheet-h">
    <span class="sheet-flag">schema sweep</span>
    <span class="sheet-count">{ordered.length} schemas</span>
  </header>
  <div class="grid">
    {#each ordered as schema (schema.key)}
      <div class="card">
        <header class="card-h">
          <span class="card-key">{schema.key}</span>
          <span class="card-label">{schema.label}</span>
          {#if schema.category}
            <span class="card-cat">{schema.category}</span>
          {/if}
        </header>
        <div class="card-frame">
          <ColumnEditorV2
            {schema}
            bind:column={drafts[schema.key]}
            {available}
            {swatches}
          />
        </div>
      </div>
    {/each}
  </div>
</div>

<style>
  .sheet {
    display: flex;
    flex-direction: column;
    gap: 14px;
    width: 100%;
  }
  .sheet-h {
    display: flex;
    align-items: baseline;
    gap: 12px;
    padding-bottom: 6px;
    border-bottom: 1px solid var(--v2-rule, #d6d0c1);
  }
  .sheet-flag {
    font-family: var(--v2-font-mono, ui-monospace, monospace);
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: var(--v2-track-flag, 0.14em);
    color: var(--v2-ink-2, #4a463c);
  }
  .sheet-count {
    font-family: var(--v2-font-mono, ui-monospace, monospace);
    font-size: 10px;
    color: var(--v2-ink-3, #8a8478);
    margin-left: auto;
  }

  .grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 20px;
    align-items: flex-start;
  }

  .card {
    display: flex;
    flex-direction: column;
    gap: 6px;
    min-width: 0;
  }
  .card-h {
    display: flex;
    align-items: baseline;
    gap: 8px;
    padding: 0 4px;
  }
  .card-key {
    font-family: var(--v2-font-mono, ui-monospace, monospace);
    font-size: 9.5px;
    text-transform: uppercase;
    letter-spacing: var(--v2-track-flag, 0.14em);
    color: var(--v2-ink, #15140e);
  }
  .card-label {
    font-family: var(--v2-font-sans, system-ui);
    font-size: 11px;
    color: var(--v2-ink-3, #8a8478);
  }
  .card-cat {
    margin-left: auto;
    font-family: var(--v2-font-mono, ui-monospace, monospace);
    font-size: 9px;
    color: var(--v2-ink-3, #8a8478);
    background: var(--v2-paper-2, #f3efe5);
    border-radius: 3px;
    padding: 1px 5px;
    text-transform: uppercase;
    letter-spacing: 0.1em;
  }
  /* Override the editor's max-height so the contact sheet shows the
     full natural height of every editor (visual regression should
     surface every per-schema row, not crop). */
  .card-frame {
    --tv-editor-max-h: none;
    min-width: 0;
  }
</style>

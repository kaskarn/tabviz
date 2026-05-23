<!--
  ColumnPreview — synthetic preview chip rendered at the top of the
  ColumnEditorV2. Shows the column header + 2-3 sample values formatted
  the way the current options would format them.

  This is a *synthetic* preview, not a real renderer pass. It captures
  what the schema's formatValue (if any) does to a small fixture, plus
  the column header text and align. The full WYSIWYG preview that
  drives the table renderer is a future hook (Phase 7).

  The fixtures are picked per schema-bucket — interval shows a typical
  effect estimate; numeric shows a couple decimals; percent shows a
  rate; etc. For schemas without a known fixture, we render a generic
  "..." placeholder.
-->
<script lang="ts">
  import type { ColumnSchema } from "../../../schema/types";
  import type { ColumnSpec } from "../../../types";

  interface Props {
    schema: ColumnSchema;
    column: Partial<ColumnSpec>;
  }

  let { schema, column }: Props = $props();

  // Per-bucket fixture rows. Keep tiny — 2-3 values per type covers
  // small/large/edge variants enough to be readable.
  const FIXTURES: Record<string, string[]> = {
    text:      ["Alpha trial", "Beta replication", "Gamma cohort"],
    numeric:   ["0.85", "−1.24", "12,500"],
    percent:   ["72%", "12.5%", "100%"],
    pvalue:    ["0.04", "<0.001", "0.21"],
    interval:  ["0.85 (0.72, 0.99)", "−1.24 (−2.10, −0.38)"],
    range:     ["18 — 64", "5 — 12"],
    events:    ["12 / 100", "0 / 50"],
    n:         ["1,234", "42"],
    currency:  ["$1,200", "−$80"],
    date:      ["2024-03-15", "2023-11-02"],
    bar:       ["▁▃▆", "▂▄█"],
    sparkline: ["⌇⌇⌇⌇"],
    pictogram: ["★★★☆☆"],
    stars:     ["★★★★☆"],
    ring:      ["◐ 50%"],
    badge:     ["[ active ]"],
    icon:      ["◇"],
    img:       ["▦"],
    forest:    ["—●—"],
  };

  const bucket = $derived(schema.bucket ?? schema.key);
  const fixture = $derived(FIXTURES[bucket] ?? FIXTURES[schema.type ?? ""] ?? ["…"]);

  // Apply numeric.decimals to the sample if it's a numeric column.
  const samples = $derived.by(() => {
    const opts = (column.options ?? {}) as Record<string, Record<string, unknown>>;
    const numOpts = opts.numeric ?? opts[bucket] ?? {};
    const dec = numOpts.decimals as number | undefined;
    if (dec == null || isNaN(dec)) return fixture;
    // Best-effort: re-format any string that parses as a number with
    // the requested decimal count. Non-numeric strings pass through.
    return fixture.map((s) => {
      const n = parseFloat(s.replace(/[, ]/g, ""));
      if (!Number.isFinite(n)) return s;
      return n.toFixed(dec);
    });
  });

  const align = $derived((column.align ?? "left") as "left" | "center" | "right");
  const header = $derived(column.header ?? schema.label);
</script>

<div class="preview" style:--cp-align={align === "left" ? "flex-start" : align === "right" ? "flex-end" : "center"}>
  <div class="preview-h">
    <span class="preview-flag">preview</span>
  </div>
  <div class="table">
    <div class="head-cell">{header}</div>
    {#each samples as v (v)}
      <div class="data-cell">{v}</div>
    {/each}
  </div>
</div>

<style>
  .preview {
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding: 10px 12px;
    background: var(--v2-paper-2, #f3efe5);
    border-radius: var(--v2-r-soft, 3px);
    margin-bottom: 6px;
    --cp-align: flex-start;
  }
  .preview-h {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
  }
  .preview-flag {
    font-family: var(--v2-font-mono, ui-monospace, monospace);
    font-size: 9.5px;
    text-transform: uppercase;
    letter-spacing: var(--v2-track-flag, 0.14em);
    color: var(--v2-ink-3, #8a8478);
  }
  .table {
    display: flex;
    flex-direction: column;
    background: var(--v2-paper-edge, #fff);
    border-radius: var(--v2-r-soft, 3px);
    box-shadow: inset 0 0 0 1px var(--v2-rule-soft, #e6e0d1);
    padding: 6px 10px;
  }
  .head-cell {
    display: flex;
    justify-content: var(--cp-align);
    font-family: var(--v2-font-sans, system-ui);
    font-size: var(--v2-text-body, 11.5px);
    font-weight: 600;
    color: var(--v2-ink, #15140e);
    padding-bottom: 4px;
    border-bottom: 1px solid var(--v2-rule-soft, #e6e0d1);
    margin-bottom: 4px;
  }
  .data-cell {
    display: flex;
    justify-content: var(--cp-align);
    font-family: var(--v2-font-mono, ui-monospace, monospace);
    font-size: var(--v2-text-body, 11.5px);
    color: var(--v2-ink, #15140e);
    padding: 2px 0;
    font-variant-numeric: tabular-nums;
    white-space: pre-line;
  }
</style>

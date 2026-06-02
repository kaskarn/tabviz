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

  const { schema, column }: Props = $props();

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

  // Key fixture lookup off schema.key first (most specific), then
  // bucket (for ancestors that share a bucket — e.g. currency inherits
  // numeric's bucket but has its own visual signature), then type.
  const bucket = $derived(schema.bucket ?? schema.key);
  const fixture = $derived(
    FIXTURES[schema.key] ?? FIXTURES[bucket] ?? FIXTURES[schema.type ?? ""] ?? ["…"],
  );

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

<!--
  Compact preview chip — single inline strip with the header label on
  the left and a comma-separated sample row on the right. Replaces the
  prior multi-row mini-table (4 samples × ~18px + chrome ≈ 140px tall)
  which dominated the popover at the cost of the actual editor knobs
  below it. Authors mostly glance at the preview for "is the format
  right" — one or two examples carries that signal at a tenth the
  vertical footprint.
-->
<div class="preview" style:--cp-align={align === "left" ? "flex-start" : align === "right" ? "flex-end" : "center"}>
  <span class="head-cell">{header}</span>
  <span class="sep" aria-hidden="true">·</span>
  <span class="samples">
    {#each samples.slice(0, 2) as v, i (v + "_" + i)}
      {#if i > 0}<span class="comma">,&nbsp;</span>{/if}<span class="data-cell">{v}</span>
    {/each}
  </span>
</div>

<style>
  .preview {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 4px 8px;
    background: var(--v2-paper-2, #f3efe5);
    border-radius: var(--v2-r-soft, 3px);
    box-shadow: inset 0 0 0 1px var(--v2-rule-soft, #e6e0d1);
    margin-bottom: 4px;
    min-height: 22px;
    overflow: hidden;
    --cp-align: flex-start;
  }
  .head-cell {
    flex: none;
    font-family: var(--v2-font-sans, system-ui);
    font-size: var(--v2-text-body, 11.5px);
    font-weight: 600;
    color: var(--v2-ink, #15140e);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 50%;
  }
  .sep {
    flex: none;
    color: var(--v2-ink-3, #8a8478);
    font-size: var(--v2-text-small, 10.5px);
  }
  .samples {
    flex: 1;
    min-width: 0;
    display: inline-flex;
    align-items: baseline;
    justify-content: var(--cp-align);
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
  }
  .data-cell {
    font-family: var(--v2-font-mono, ui-monospace, monospace);
    font-size: var(--v2-text-body, 11.5px);
    color: var(--v2-ink-2, #4a463c);
    font-variant-numeric: tabular-nums;
  }
  .comma { color: var(--v2-ink-3, #8a8478); }
</style>

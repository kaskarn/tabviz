<script lang="ts">
  import type { RangeColumnOptions, ColumnOptions } from "$types";
  import { formatNumber } from "$lib/formatters";

  interface Props {
    value: unknown;
    metadata: Record<string, unknown>;
    options?: RangeColumnOptions;
    naText?: string;
  }

  let { value, metadata, options, naText }: Props = $props();

  const separator = $derived(options?.separator ?? " – ");
  const decimals = $derived(options?.decimals);
  const digits = $derived(options?.digits);
  const thousandsSep = $derived(options?.thousandsSep);
  const abbreviate = $derived(options?.abbreviate);
  const minField = $derived(options?.minField ?? "");
  const maxField = $derived(options?.maxField ?? "");

  // Get min and max values from metadata using configured field names
  const minValue = $derived.by(() => {
    if (!minField) return null;
    const val = metadata[minField];
    return typeof val === "number" ? val : null;
  });

  const maxValue = $derived.by(() => {
    if (!maxField) return null;
    const val = metadata[maxField];
    return typeof val === "number" ? val : null;
  });

  // Synthesize numeric ColumnOptions so range values share the col_numeric
  // formatting pipeline (decimals / digits / thousandsSep / abbreviate).
  const numOpts: ColumnOptions = $derived({
    numeric: {
      decimals: decimals ?? undefined,
      digits,
      thousandsSep,
      abbreviate,
    },
  });

  function formatValue(val: number | null): string {
    if (val === null) return "";
    // Auto mode: when no decimals or digits set, show integers without decimals,
    // floats with 1 decimal — preserves prior behavior.
    if (
      (decimals === null || decimals === undefined) &&
      digits === undefined &&
      !abbreviate
    ) {
      return Number.isInteger(val) ? String(val) : val.toFixed(1);
    }
    return formatNumber(val, numOpts);
  }

  // Treat the cell as NA if EITHER bound is missing.
  const isNa = $derived(minValue === null || maxValue === null);

  const displayValue = $derived.by(() => {
    if (isNa) return naText ?? "";
    return `${formatValue(minValue)}${separator}${formatValue(maxValue)}`;
  });
</script>

{#if displayValue}
  <span
    class="cell-range"
    title={isNa ? undefined : `${formatValue(minValue)} to ${formatValue(maxValue)}`}
  >
    {displayValue}
  </span>
{/if}

<style>
  .cell-range {
    display: inline-block;
    white-space: nowrap;
    font-variant-numeric: tabular-nums;
  }
</style>

<script lang="ts">
  import type { PvalueColumnOptions, CellStyle } from "$types";
  import { toSuperscript } from "$lib/formatters";

  interface Props {
    value: number | undefined | null;
    options?: PvalueColumnOptions;
    cellStyle?: CellStyle;
    naText?: string;
  }

  const { value, options, cellStyle, naText }: Props = $props();

  // Cell styling from NSE/formulas
  const isBold = $derived(cellStyle?.bold ?? false);
  const isItalic = $derived(cellStyle?.italic ?? false);
  const textColor = $derived(cellStyle?.color ?? null);
  const bgColor = $derived(cellStyle?.bg ?? null);
  const isEmphasis = $derived(cellStyle?.emphasis ?? false);
  const isMuted = $derived(cellStyle?.muted ?? false);
  const isAccent = $derived(cellStyle?.accent ?? false);

  const showStars = $derived(options?.stars ?? false);
  const thresholds = $derived(options?.thresholds ?? [0.05, 0.01, 0.001]);
  const format = $derived(options?.format ?? "auto");
  const digits = $derived(options?.digits ?? 2);
  const expThreshold = $derived(options?.expThreshold ?? 0.001);
  const abbrevThreshold = $derived(options?.abbrevThreshold ?? null);

  const stars = $derived.by(() => {
    if (!showStars || value === undefined || value === null) return "";
    const [t1, t2, t3] = thresholds;
    if (value < t3) return "***";
    if (value < t2) return "**";
    if (value < t1) return "*";
    return "";
  });

  const formattedValue = $derived.by(() => {
    if (value === undefined || value === null) return naText ?? "";

    // Abbreviation threshold: show "<threshold" notation if enabled and value is below
    if (abbrevThreshold !== null && value < abbrevThreshold) {
      return `<${abbrevThreshold}`;
    }

    // Use scientific notation with Unicode superscript for small values
    if (format === "scientific" || (format === "auto" && value < expThreshold)) {
      const exp = Math.floor(Math.log10(value));
      const mantissa = value / Math.pow(10, exp);
      // Format mantissa to specified digits
      const mantissaStr = mantissa.toPrecision(digits);
      return `${mantissaStr}×10${toSuperscript(exp.toString())}`;
    }

    // Decimal format with appropriate precision based on magnitude
    if (value >= 0.1) return value.toFixed(digits);
    if (value >= 0.01) return value.toFixed(digits + 1);
    return value.toFixed(digits + 2);
  });

  const isSignificant = $derived(stars.length > 0);

  // The rgc "green pill" on significant values (table-craft, 2026-06-08):
  // significant_style:"pill" paints a soft status-positive lozenge when the
  // p-value clears the first threshold — independent of whether stars are on.
  const pillStyle = $derived(options?.significantStyle ?? "none");
  const pillSignificant = $derived(
    pillStyle === "pill" && value != null && value < (thresholds[0] ?? 0.05),
  );

  // wire-audit 1b (C37): stars color channel. Rubrication, not status —
  // "accent" rides the (possibly ink2-seeded) accent ramp by default.
  const starsColor = $derived.by(() => {
    switch (options?.starsColor ?? "accent") {
      case "ink2":     return "var(--tv-ink2, var(--tv-accent))";
      case "negative": return "var(--tv-status-negative)";
      case "none":     return "inherit";
      default:         return "var(--tv-accent, #2563eb)";
    }
  });
</script>

<span
  class="cell-pvalue"
  class:significant={isSignificant}
  class:pill={pillSignificant}
  class:cell-bold={isBold}
  class:cell-italic={isItalic}
  class:cell-emphasis={isEmphasis}
  class:cell-muted={isMuted}
  class:cell-accent={isAccent}
  style:color={textColor}
  style:background-color={bgColor}
>
  <span class="pvalue-number">{formattedValue}</span>
  {#if stars}
    <span class="pvalue-stars" style:color={starsColor}>{stars}</span>
  {/if}
</span>

<style>
  .cell-pvalue {
    display: inline-flex;
    align-items: baseline;
    gap: 1px;
    font-variant-numeric: tabular-nums;
  }

  /* Significant-value pill (rgc signature) — a soft positive lozenge.
     margin-block cancels the vertical padding so the pill NEVER grows
     the row's line box (it inflated compact rows by 2px, which the SVG
     export's row estimator can't see — WYSIWYG gate catch 2026-06-11). */
  .cell-pvalue.pill {
    padding: 1px 7px;
    margin-block: -1px;
    border-radius: 999px;
    background: color-mix(in srgb, var(--tv-status-positive, #2f9e6b) 15%, transparent);
    color: color-mix(in srgb, var(--tv-status-positive, #2f9e6b) 78%, var(--tv-text, #15140e));
    font-weight: 600;
  }

  .pvalue-number {
    font-size: inherit;
  }

  .pvalue-stars {
    font-size: 0.9em;
    /* color set inline via starsColor (wire-audit 1b) */
    font-weight: 600;
  }
  /* Significant p-values used to auto-bold the number — removed: rely on
     the explicit `.cell-bold` flag (NSE/formula-driven) so authors decide
     when to emphasize. */

  /* Cell styling from NSE/formulas */
  .cell-bold {
    font-weight: var(--tv-font-weight-bold, 600);
  }

  .cell-italic {
    font-style: italic;
  }

  /* Read the per-token semantic BUNDLE vars (fg + bg), same as CellContent —
     so the paint tool + theme.semantics.* edits reach p-value cells too. Raw
     palette vars are the fallback when a bundle entry is null. */
  .cell-emphasis {
    font-weight: var(--tv-font-weight-bold, 600);
    color: var(--tv-semantic-emphasis-fg, var(--tv-text, #1a1a1a));
    background-color: var(--tv-semantic-emphasis-bg, transparent);
  }

  .cell-muted {
    color: var(--tv-semantic-muted-fg, var(--tv-text-subtle, #94a3b8));
    background-color: var(--tv-semantic-muted-bg, transparent);
  }

  .cell-accent {
    color: var(--tv-semantic-accent-fg, var(--tv-accent, #8b5cf6));
    background-color: var(--tv-semantic-accent-bg, transparent);
  }
</style>

<script lang="ts">
  import type { CellStyle, PictogramColumnOptions } from "$types";
  import { resolveGlyph, type ResolvedGlyph } from "$lib/glyph-registry";

  interface Props {
    value: number | string | undefined | null;
    options?: PictogramColumnOptions;
    naText?: string;
    cellStyle?: CellStyle;
    /** Optional row-level field selector value when glyph is a mapping. */
    glyphSelector?: string | number | null;
  }

  let { value, options, naText, cellStyle, glyphSelector }: Props = $props();

  // ----- option derivations -------------------------------------------------

  const maxGlyphs = $derived(options?.maxGlyphs ?? null);
  const halfGlyphs = $derived(options?.halfGlyphs ?? false);
  const domain = $derived(options?.domain ?? null);
  const layout = $derived(options?.layout ?? "row");
  const size = $derived(options?.size ?? "base");
  const sizeClass = $derived(
    size === "sm" ? "size-sm" : size === "lg" ? "size-lg" : "size-base"
  );
  const layoutClass = $derived(layout === "stack" ? "layout-stack" : "layout-row");

  // Theme-aware defaults: null → CSS var. style_color overrides the filled
  // color (per the per-cell cascade decisions).
  const filledColor = $derived(
    cellStyle?.color ?? options?.color ?? "var(--tv-accent)"
  );
  const emptyColor = $derived(options?.emptyColor ?? "var(--tv-muted)");
  const isMutedRow = $derived(cellStyle?.muted === true);

  // ----- glyph resolution ---------------------------------------------------

  // glyph option: string OR map. When map, glyphField names a row-level field
  // whose value indexes into the map. Resolution happens here; the parent
  // dispatch already passed glyphSelector if relevant.
  const resolvedGlyph: ResolvedGlyph = $derived.by(() => {
    const g = options?.glyph;
    if (g == null) return null;
    if (typeof g === "string") return resolveGlyph(g);
    // map case: pick by selector
    if (glyphSelector == null) return null;
    const key = String(glyphSelector);
    const spec = g[key];
    return resolveGlyph(spec);
  });

  // ----- numeric value handling --------------------------------------------

  const numericValue = $derived(
    typeof value === "number" ? value : value == null ? null : Number(value)
  );

  // Apply domain remap when present (rating mode with non-1:1 input range).
  const remapped = $derived.by(() => {
    if (numericValue == null || !Number.isFinite(numericValue)) return null;
    if (domain && Number.isFinite(domain[0]) && Number.isFinite(domain[1]) && domain[1] > domain[0] && maxGlyphs != null) {
      const clamped = Math.max(domain[0], Math.min(domain[1], numericValue));
      return ((clamped - domain[0]) / (domain[1] - domain[0])) * maxGlyphs;
    }
    return numericValue;
  });

  // Build the glyph display: count mode renders `floor(remapped)` filled
  // glyphs, no ghosts. Rating mode renders maxGlyphs total, with first N
  // filled (or half-filled per halfGlyphs).
  type GlyphSlot = { state: "full" | "half" | "empty" };
  const slots: GlyphSlot[] = $derived.by(() => {
    if (remapped == null) return [];
    const v = Math.max(0, remapped);
    const out: GlyphSlot[] = [];
    if (maxGlyphs == null) {
      // count mode: floor; cap at a sane maximum to avoid runaway rows
      const n = Math.min(Math.floor(v + (halfGlyphs ? 0.5 : 0)), 999);
      for (let i = 0; i < n; i++) out.push({ state: "full" });
    } else {
      for (let i = 1; i <= maxGlyphs; i++) {
        if (i <= v) out.push({ state: "full" });
        else if (halfGlyphs && i - 0.5 <= v) out.push({ state: "half" });
        else out.push({ state: "empty" });
      }
    }
    return out;
  });

  // ----- value label --------------------------------------------------------

  const labelPosition = $derived.by(() => {
    const vl = options?.valueLabel ?? false;
    if (vl === false) return null;
    if (vl === true) return "trailing";
    return vl;
  });
  const labelText = $derived.by(() => {
    if (numericValue == null) return "";
    const fmt = options?.labelFormat ?? "decimal";
    const decimals = options?.labelDecimals ?? 1;
    if (fmt === "integer") return String(Math.round(numericValue));
    return numericValue.toFixed(decimals);
  });

  const titleText = $derived(
    cellStyle?.tooltip ??
    (maxGlyphs != null
      ? `${numericValue ?? "?"} / ${maxGlyphs}`
      : `${numericValue ?? "?"}`)
  );
</script>

{#if numericValue == null || !Number.isFinite(numericValue)}
  {#if naText}
    <span class="pictogram-na">{naText}</span>
  {/if}
{:else if resolvedGlyph}
  <span
    class="cell-pictogram {sizeClass} {layoutClass}"
    class:cell-muted={isMutedRow}
    title={titleText}
  >
    {#if labelPosition === "leading"}
      <span class="pictogram-label">{labelText}</span>
    {/if}
    <span class="glyph-track">
      {#each slots as slot, i (i)}
        {#if resolvedGlyph.kind === "registry"}
          <svg
            class="glyph"
            viewBox={resolvedGlyph.def.viewBox}
            class:half={slot.state === "half"}
            aria-hidden="true"
          >
            {#if slot.state === "full"}
              <path d={resolvedGlyph.def.path} fill={filledColor} stroke="none" />
            {:else if slot.state === "half"}
              <!-- half: render as full underneath, then mask right half with empty -->
              <path d={resolvedGlyph.def.path} fill={filledColor} stroke="none" />
              <rect x="12" y="0" width="12" height="24" fill={emptyColor} opacity="0.7" />
            {:else}
              <path d={resolvedGlyph.def.path} fill="none" stroke={emptyColor} stroke-width="1.5" />
            {/if}
          </svg>
        {:else}
          <span
            class="glyph-literal"
            style:color={slot.state === "empty" ? emptyColor : filledColor}
            style:opacity={slot.state === "half" ? 0.6 : 1}
          >{resolvedGlyph.char}</span>
        {/if}
      {/each}
    </span>
    {#if labelPosition === "trailing"}
      <span class="pictogram-label">{labelText}</span>
    {/if}
  </span>
{/if}

<style>
  .cell-pictogram {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    line-height: 1;
  }
  .cell-pictogram.cell-muted {
    opacity: 0.5;
  }

  .glyph-track {
    display: inline-flex;
    align-items: center;
    gap: 1px;
  }
  .layout-stack .glyph-track {
    flex-direction: column-reverse;
    gap: 0;
  }

  .glyph {
    display: inline-block;
    transition: fill 0.15s ease, stroke 0.15s ease;
  }
  .size-sm .glyph { width: 10px; height: 10px; }
  .size-base .glyph { width: 14px; height: 14px; }
  .size-lg .glyph { width: 20px; height: 20px; }

  .glyph-literal {
    transition: color 0.15s ease, opacity 0.15s ease;
  }
  .size-sm .glyph-literal { font-size: 0.75em; }
  .size-base .glyph-literal { font-size: 0.95em; }
  .size-lg .glyph-literal { font-size: 1.2em; }

  .pictogram-label {
    font-variant-numeric: tabular-nums;
    color: var(--tv-cell-fg, var(--tv-fg));
  }
  .size-sm .pictogram-label { font-size: 0.75em; }
  .size-base .pictogram-label { font-size: 0.85em; }
  .size-lg .pictogram-label { font-size: 1em; }

  .pictogram-na {
    color: var(--tv-muted);
    font-style: italic;
  }
</style>

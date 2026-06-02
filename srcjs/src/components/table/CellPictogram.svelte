<script lang="ts" module>
  // Module-scoped counter for unique clip-path ids across the page. The
  // half-fill glyph (`slot.state === "half"`) uses a <clipPath> by id;
  // without a per-instance id, multiple half-glyph cells on the same page
  // would emit duplicate ids (HTML invalid, and some renderers — notably
  // headless V8 + rsvg in our static-export path — resolve url(#id) to
  // the FIRST match anywhere in the document, causing visual drift).
  let halfClipSeq = 0;
</script>

<script lang="ts">
  import type { CellStyle, PictogramColumnOptions } from "$types";
  import { resolveGlyph, type ResolvedGlyph } from "$lib/glyph-registry";
  import { CELL_GEOMETRY } from "$lib/rendering-constants";

  // One id per component instance (plain `let` runs once at mount; not
  // reactive, no $state — the id is stable across re-renders).
  const halfClipBase = `pic-half-${++halfClipSeq}`;

  interface Props {
    value: number | string | undefined | null;
    options?: PictogramColumnOptions;
    naText?: string;
    cellStyle?: CellStyle;
    /** Optional row-level field selector value when glyph is a mapping. */
    glyphSelector?: string | number | null;
    /** Row/cell semantic markerFill (accent/emphasis/muted) computed by
     * the renderer. Slots in below explicit column-level color but above
     * theme default. */
    colorOverride?: string | null;
  }

  let { value, options, naText, cellStyle, glyphSelector, colorOverride }: Props = $props();

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
  // Glyph box + track gap from the shared geometry source (CELL_GEOMETRY) —
  // the same px the width budget reserves and the SVG renderer draws. Stack
  // layout butts glyphs together (gap 0).
  const glyphPx = $derived(CELL_GEOMETRY.pictogram.glyphPx[size]);
  const trackGapPx = $derived(layout === "stack" ? 0 : CELL_GEOMETRY.pictogram.gap);

  // Theme-aware defaults: null → CSS var. style_color overrides the filled
  // color (per the per-cell cascade decisions). Pictograms read identity
  // secondary by default (with primary fallback in mono themes); accent is
  // reserved for layered emphasis only. colorOverride carries the row/cell
  // semantic markerFill (accent/emphasis/muted) when active — slots in
  // below explicit column-level color but above theme default.
  const filledColor = $derived(
    cellStyle?.color ?? options?.color ?? colorOverride ?? "var(--tv-secondary, var(--tv-primary))"
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
    <span class="glyph-track" style:gap="{trackGapPx}px">
      {#each slots as slot, i (i)}
        {#if resolvedGlyph.kind === "registry"}
          <svg
            class="glyph"
            viewBox={resolvedGlyph.def.viewBox}
            class:half={slot.state === "half"}
            style:width="{glyphPx}px"
            style:height="{glyphPx}px"
            aria-hidden="true"
          >
            {#if slot.state === "full"}
              <path d={resolvedGlyph.def.path} fill={filledColor} stroke="none" />
            {:else if slot.state === "half"}
              <!-- half: empty outline underneath, then a left-half-clipped
                   filled path on top. The clipPath id is per-instance
                   (`halfClipBase`) + per-slot so multiple half-glyphs in
                   the same row don't collide and multiple rows on the
                   page don't share an id. viewBox-aware: parse
                   `${minX} ${minY} ${width} ${height}` and clip to the
                   left HALF of the viewBox so this works for any glyph
                   viewBox (not just "0 0 24 24"). -->
              {@const vb = resolvedGlyph.def.viewBox.split(/\s+/).map(Number)}
              {@const clipId = `${halfClipBase}-${i}`}
              <defs>
                <clipPath id={clipId}>
                  <rect x={vb[0]} y={vb[1]} width={vb[2] / 2} height={vb[3]} />
                </clipPath>
              </defs>
              <path d={resolvedGlyph.def.path} fill="none" stroke={emptyColor} stroke-width="1.5" />
              <path d={resolvedGlyph.def.path} fill={filledColor} stroke="none" clip-path="url(#{clipId})" />
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

  /* Track gap + glyph box are set inline from CELL_GEOMETRY (see <script>);
     the stack layout only needs its flex direction here. */
  .glyph-track {
    display: inline-flex;
    align-items: center;
  }
  .layout-stack .glyph-track {
    flex-direction: column-reverse;
  }

  .glyph {
    display: inline-block;
    transition: fill 0.15s ease, stroke 0.15s ease;
  }

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

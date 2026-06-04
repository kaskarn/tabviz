<script lang="ts">
  // Settings-panel control for per-row-kind heights (Phase 5).
  //
  // Per Stage 1 §34a. Surfaces:
  //   - Current resolved height per kind (px)
  //   - Provenance label ("default" / "theme" / "pin")
  //   - Number input to set a pin (layer 5; absolute px)
  //   - "Reset" button per kind (clears layer 5 pin)
  //   - "Reset all" button (clears all pins)
  //
  // Layer 3 (theme defaults) and layer 4 (constructor) are read-only from
  // this control's perspective — they reflect through to the displayed
  // resolved values, but only the interactive pin (layer 5) is writable
  // here. Theme defaults are set via the resolver inputs; constructor
  // overrides via spec.rowHeights at authoring time.

  import type { TabvizStore } from "$stores/tabvizStore.svelte";
  import type { RowKind } from "$lib/layout/row-kind";
  import {
    resolveRowKindHeight,
    INTRINSIC_KIND_RATIOS,
  } from "$lib/layout/row-kind-heights";
  import Section from "$components/primitives/v2/Section.svelte";

  interface Props {
    store: TabvizStore;
  }

  const { store }: Props = $props();

  // Kinds presented in the UI. Skip `panel` (full-width disclosure region;
  // height is governed by its content) and `header` (not a row-track kind
  // managed by this cascade).
  const KINDS: readonly RowKind[] = ["data", "group_header", "summary", "spacer"];

  const KIND_LABELS: Record<RowKind, string> = {
    data:         "Data",
    group_header: "Group header",
    summary:      "Summary",
    spacer:       "Spacer",
    header:       "Header",
    panel:        "Details panel",
  };

  // Current rowHeight (post-density, post-aspect).
  const rowHeight = $derived(store.layout.rowHeight);
  // Per-kind pin map from the store.
  const pins = $derived(store.rowKindHeights ?? {});
  // Constructor-layer ratios (from spec.rowHeights).
  const ctorRatios = $derived(store.spec?.rowHeights ?? undefined);

  function resolvedHeightPx(kind: RowKind): number {
    return resolveRowKindHeight(kind, rowHeight, pins[kind], {
      constructorOverride: ctorRatios,
      // themeKinds left undefined until layer 3 wiring lands.
    });
  }

  function provenance(kind: RowKind): "pin" | "constructor" | "intrinsic" {
    if (pins[kind] !== undefined) return "pin";
    if (ctorRatios?.[kind] !== undefined) return "constructor";
    return "intrinsic";
  }

  function setPin(kind: RowKind, px: number | null): void {
    store.setRowKindHeight(kind, px);
  }

  function resetAll(): void {
    store.resetRowKindHeights();
  }

  const hasAnyPin = $derived(Object.keys(pins).length > 0);
</script>

<Section
  title="Row kind heights"
  hint="Adjust per-row-kind base height. Drag a row edge in-canvas or set values here. Reset returns to defaults."
>
  <div class="row-kind-heights">
    {#each KINDS as kind (kind)}
      {@const resolved = resolvedHeightPx(kind)}
      {@const prov = provenance(kind)}
      {@const intrinsicRatio = INTRINSIC_KIND_RATIOS[kind]}
      <div class="kind-row">
        <span class="kind-label">{KIND_LABELS[kind]}</span>
        <span class="kind-prov prov-{prov}" title={prov === "pin" ? "Set via pin" : prov === "constructor" ? "Set via constructor row_heights" : `Default (${intrinsicRatio}× rowHeight)`}>
          {prov}
        </span>
        <input
          type="number"
          class="kind-input"
          min="4"
          max="200"
          step="1"
          value={Math.round(resolved)}
          oninput={(e) => {
            const v = parseInt((e.currentTarget as HTMLInputElement).value, 10);
            if (Number.isFinite(v)) setPin(kind, v);
          }}
          aria-label={`${KIND_LABELS[kind]} height in pixels`}
        />
        <span class="kind-unit">px</span>
        <button
          class="kind-reset"
          disabled={pins[kind] === undefined}
          onclick={() => setPin(kind, null)}
          title="Reset to default"
          aria-label={`Reset ${KIND_LABELS[kind]} to default`}
        >
          ×
        </button>
      </div>
    {/each}

    {#if hasAnyPin}
      <button class="reset-all" onclick={resetAll}>
        Reset all pins
      </button>
    {/if}
  </div>
</Section>

<style>
  .row-kind-heights {
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding: 4px 0;
  }
  .kind-row {
    display: grid;
    grid-template-columns: 1fr auto 60px auto auto;
    align-items: center;
    gap: 6px;
    font-size: 12px;
  }
  .kind-label {
    color: var(--tv-text, currentColor);
  }
  .kind-prov {
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    padding: 1px 5px;
    border-radius: 3px;
    opacity: 0.75;
  }
  .prov-pin {
    background: color-mix(in srgb, var(--tv-accent, #3366cc) 18%, transparent);
    color: var(--tv-accent, #3366cc);
  }
  .prov-constructor {
    background: color-mix(in srgb, currentColor 8%, transparent);
    color: var(--tv-text-muted, currentColor);
  }
  .prov-intrinsic {
    color: var(--tv-text-muted, currentColor);
  }
  .kind-input {
    width: 60px;
    padding: 2px 4px;
    text-align: right;
    font: inherit;
    background: transparent;
    border: 1px solid color-mix(in srgb, currentColor 15%, transparent);
    border-radius: 3px;
    color: inherit;
  }
  .kind-unit {
    color: var(--tv-text-muted, currentColor);
    font-size: 11px;
  }
  .kind-reset {
    width: 20px;
    height: 20px;
    padding: 0;
    border: 1px solid color-mix(in srgb, currentColor 15%, transparent);
    border-radius: 3px;
    background: transparent;
    color: inherit;
    cursor: pointer;
    font-size: 14px;
    line-height: 1;
  }
  .kind-reset:disabled {
    opacity: 0.3;
    cursor: not-allowed;
  }
  .kind-reset:not(:disabled):hover {
    background: color-mix(in srgb, currentColor 10%, transparent);
  }
  .reset-all {
    margin-top: 4px;
    padding: 4px 10px;
    border: 1px solid color-mix(in srgb, currentColor 15%, transparent);
    border-radius: 3px;
    background: transparent;
    color: inherit;
    cursor: pointer;
    font: inherit;
    font-size: 11px;
    align-self: flex-start;
  }
  .reset-all:hover {
    background: color-mix(in srgb, currentColor 10%, transparent);
  }
</style>

<!--
  PlotsTab — Layer 3 of the settings redesign (D21; canonical plan:
  docs/dev/settings-redesign.md). PER-SERIES VIZ CONTROL: marker shape,
  fill color, stroke color, one row per series slot used in the CURRENT
  figure. DELIBERATELY FREEFORM — these overrides may break the theme's
  accent/secondary ornament logic (D21 ruling 3, "the once-in-a-blue-
  moon escape hatch"). The cascade-derived series are the default; an
  override overlays a single channel.

  Travel: writes land on `inputs.series_overrides` (theme inputs) →
  theme artifact → Reset theme.

  Consequence-or-absence: ONE row per series slot the figure actually
  renders (the deepest effect stack across its viz columns). A figure
  with no viz column shows the empty state — no dead controls.
-->
<script lang="ts">
  import type { TabvizStore } from "$stores/tabvizStore.svelte";
  import type { ThemeInputs } from "$types/theme-inputs";
  import { EnumRow } from "$components/theme-controls";
  import Field from "$components/primitives/v2/Field.svelte";
  import Swatch from "$components/primitives/v2/Swatch.svelte";

  interface Props { store: TabvizStore; }
  const { store }: Props = $props();

  const theme = $derived(store.spec?.theme);
  const inputs = $derived(
    (theme as { authoringInputs?: ThemeInputs } | undefined)?.authoringInputs ?? null,
  );

  type Shape = "circle" | "square" | "diamond" | "triangle";
  type Override = { fill?: string; stroke?: string; shape?: Shape };

  // ── Series roster: deepest effect stack across the figure's viz
  // columns + the resolved per-slot default fill (for the swatch's
  // "unset = this" affordance) ────────────────────────────────────────
  const seriesRoster = $derived.by(() => {
    const labels: string[] = [];
    let maxSlots = 0;
    for (const c of store.allColumns) {
      let effects: { label?: string | null }[] | null = null;
      if (c.type === "forest") {
        const fx = c.options?.forest?.effects;
        effects = fx && fx.length ? fx : [{ label: null }]; // single inline series
      } else if (c.type === "viz_bar") {
        effects = c.options?.vizBar?.effects ?? null;
      } else if (c.type === "viz_boxplot") {
        effects = c.options?.vizBoxplot?.effects ?? null;
      } else if (c.type === "viz_violin") {
        effects = c.options?.vizViolin?.effects ?? null;
      }
      if (!effects) continue;
      maxSlots = Math.max(maxSlots, effects.length);
      effects.forEach((e, i) => { if (!labels[i] && e.label) labels[i] = e.label; });
    }
    return Array.from({ length: maxSlots }, (_, i) => ({
      slot: i,
      label: labels[i] ?? `Series ${i + 1}`,
    }));
  });

  // Resolved series bundles (for swatch defaults — what "unset" shows).
  const resolvedSeries = $derived(
    (theme as { series?: { fill: string; stroke: string }[] } | undefined)?.series ?? [],
  );

  function overrideAt(slot: number): Override {
    return (inputs?.series_overrides?.[slot] as Override | null | undefined) ?? {};
  }
  function writeOverride(slot: number, channel: keyof Override, value: string | null): void {
    if (!inputs) return;
    const arr = [...(inputs.series_overrides ?? [])];
    while (arr.length <= slot) arr.push(null);
    const cur: Override = { ...(arr[slot] ?? {}) };
    if (value == null) delete cur[channel];
    else (cur[channel] as string) = value;
    arr[slot] = Object.keys(cur).length ? cur : null;
    // Trim trailing nulls so an all-cleared roster serializes empty.
    while (arr.length && arr[arr.length - 1] == null) arr.pop();
    store.setAuthoringInputs({
      ...inputs,
      series_overrides: arr.length ? arr : undefined,
    });
  }

  const SHAPES: Shape[] = ["circle", "square", "diamond", "triangle"];
</script>

{#if inputs}
  <div class="plots-tab">
    {#if seriesRoster.length === 0}
      <p class="empty">No plot series in this figure. Add a forest, bar, box,
        or violin column to style its series here.</p>
    {:else}
      <p class="lede">Per-series marker, fill and stroke. These override the
        theme's series palette — use sparingly.</p>
      {#each seriesRoster as { slot, label } (slot)}
        {@const ov = overrideAt(slot)}
        {@const def = resolvedSeries[slot]}
        <div class="series-block">
          <div class="series-head">{label}</div>
          <div data-pt="shape-{slot}">
            <EnumRow
              label="Shape"
              value={ov.shape ?? "circle"}
              segments={SHAPES.map((s) => ({ value: s, label: s }))}
              onchange={(v) => writeOverride(slot, "shape", v)}
            />
          </div>
          <div data-pt="fill-{slot}">
            <Field label="Fill">
              <Swatch value={ov.fill ?? def?.fill ?? null} allowUnset
                      onchange={(v) => writeOverride(slot, "fill", v)} />
            </Field>
          </div>
          <div data-pt="stroke-{slot}">
            <Field label="Stroke">
              <Swatch value={ov.stroke ?? def?.stroke ?? null} allowUnset
                      onchange={(v) => writeOverride(slot, "stroke", v)} />
            </Field>
          </div>
        </div>
      {/each}
    {/if}
  </div>
{/if}

<style>
  .plots-tab {
    display: flex;
    flex-direction: column;
    gap: var(--v2-gap-hair, 2px);
    padding: 8px 0;
  }
  .lede, .empty {
    margin: 0 0 6px;
    font-size: var(--v2-text-small, 10.5px);
    line-height: 1.4;
    color: var(--v2-ink-3, #8a8478);
  }
  .series-block {
    padding: 6px 0;
    border-top: 1px solid var(--v2-rule-soft, #e6e0d1);
  }
  .series-block:first-of-type { border-top: 0; }
  .series-head {
    font-family: var(--v2-font-sans, system-ui, sans-serif);
    font-size: var(--v2-text-micro, 9.5px);
    font-weight: 600;
    letter-spacing: var(--v2-track-flag, 0.14em);
    text-transform: uppercase;
    color: var(--v2-ink-2, #4a463c);
    padding: 2px 0 4px;
  }
</style>

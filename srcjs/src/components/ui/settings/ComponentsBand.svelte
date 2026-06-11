<!--
  ComponentsBand — the components page (component model Stage 2,
  docs/dev/component-model.md "Components page").

  Region accordions → component rows showing the LIVE channel bindings
  as a spec line; each COLOR channel opens the RoleChipGrid to re-route
  it. Stage 2 surfaces the color channels (col/bg/bar/rule); text
  channels (family/size/weight) join at Stage 3 with their pickers.

  Verb discipline (the three-verb grammar): everything here is
  RE-ROUTE — local to the component, cascade-coherent. Re-tuning roles
  lives in the theme band; pins live in the studio.
-->
<script lang="ts">
  import type { TabvizStore } from "$stores/tabvizStore.svelte";
  import { COMPONENT_ROSTER } from "$lib/theme/component-bindings";
  import { resolveTheme, applyPolarityToInputs } from "$lib/theme/resolve-theme";
  import { createWire } from "$lib/theme/theme-wire";
  import type { RoleName } from "../../../types/theme-roles";
  import RoleChipGrid from "./RoleChipGrid.svelte";

  interface Props { store: TabvizStore; }
  const { store }: Props = $props();

  const COLOR_CHANNELS = new Set(["col", "bg", "bar", "rule"]);

  const theme = $derived(store.spec?.theme as {
    authoringInputs?: import("../../../types/theme-inputs").ThemeInputs;
    roleOverrides?: Record<string, { ramp: string; grade: number }>;
    components?: Record<string, Record<string, Record<string, string>>>;
    name?: string;
  } | undefined);

  // Resolved roles for swatches + live values. Cheap enough at panel
  // cadence (the cascade is memoized per-inputs in the paint path; this
  // local resolve only re-runs when inputs/overrides/components change).
  const resolved = $derived.by(() => {
    const inputs = theme?.authoringInputs;
    if (!inputs) return null;
    try {
      return resolveTheme({
        ...createWire(inputs, theme?.name ?? "custom"),
        roleOverrides: (theme?.roleOverrides ?? {}) as never,
        components: theme?.components,
      });
    } catch {
      return null;
    }
  });

  // region → [{component, rows: [{state, channel, token, boundRole, isRerouted}]}]
  const regions = $derived.by(() => {
    const out = new Map<string, {
      component: string;
      rows: { state: string; channel: string; cssVar: string;
              defaultLabel: string; bound: string | null }[];
    }[]>();
    for (const desc of COMPONENT_ROSTER.values()) {
      const rows: { state: string; channel: string; cssVar: string;
                    defaultLabel: string; bound: string | null }[] = [];
      for (const [state, channels] of desc.states) {
        for (const [channel, token] of channels) {
          if (!COLOR_CHANNELS.has(channel)) continue; // Stage 2: color only
          const bound = theme?.components?.[desc.component]?.[state]?.[channel] ?? null;
          const defaultLabel = token.source.tier === "role"
            ? token.source.role : "(recipe)";
          rows.push({ state, channel, cssVar: token.cssVar, defaultLabel, bound });
        }
      }
      if (rows.length === 0) continue;
      const list = out.get(desc.region) ?? [];
      list.push({ component: desc.component, rows });
      out.set(desc.region, list);
    }
    for (const list of out.values()) {
      list.sort((a, b) => a.component.localeCompare(b.component));
    }
    return out;
  });

  const REGION_ORDER = ["header", "rows", "plot", "frame", "captions"];
  let openRegion = $state<string | null>(null);
  // One open picker at a time, keyed component|state|channel.
  let openPicker = $state<string | null>(null);

  function pickerKey(c: string, s: string, ch: string): string {
    return `${c}|${s}|${ch}`;
  }
  function reroute(component: string, state: string, channel: string, role: RoleName): void {
    store.setComponentChannel(component, state, channel, role);
    openPicker = null;
  }
  function release(component: string, state: string, channel: string): void {
    store.clearComponentChannel(component, state, channel);
    openPicker = null;
  }
  function swatchFor(row: { cssVar: string }): string {
    return resolved?.cssVars?.[row.cssVar] ?? "#999";
  }
</script>

{#if resolved}
  <div class="components-band">
    <div class="band-title">
      <span>Components</span>
      <span class="hint" title="Re-route a component channel to a different role — local to the component, cascade-coherent (follows polarity, anchors, high-contrast). Roles themselves are tuned in the Theme band.">re-route</span>
    </div>
    {#each REGION_ORDER as region (region)}
      {#if regions.has(region)}
        <section class="region">
          <button
            type="button"
            class="region-head"
            aria-expanded={openRegion === region}
            onclick={() => (openRegion = openRegion === region ? null : region)}
          >
            <span class="chev" class:open={openRegion === region}>▸</span>
            {region}
          </button>
          {#if openRegion === region}
            <div class="region-body">
              {#each regions.get(region)! as comp (comp.component)}
                <div class="component">
                  <span class="comp-name">{comp.component}</span>
                  <div class="channels">
                    {#each comp.rows as row (row.state + row.channel)}
                      {@const key = pickerKey(comp.component, row.state, row.channel)}
                      <div class="channel-row" class:rerouted={!!row.bound}>
                        <button
                          type="button"
                          class="channel-btn"
                          aria-expanded={openPicker === key}
                          title={`${row.cssVar} — ${row.bound ?? row.defaultLabel}${row.bound ? " (re-routed)" : ""}`}
                          onclick={() => (openPicker = openPicker === key ? null : key)}
                        >
                          <span class="swatch" style:background={swatchFor(row)}></span>
                          <span class="chan-label">
                            {row.state === "base" ? row.channel : `${row.state}·${row.channel}`}
                          </span>
                          <span class="bound">{row.bound ?? row.defaultLabel}</span>
                        </button>
                        {#if row.bound}
                          <button
                            type="button"
                            class="release"
                            title="Release back to the manifest default"
                            aria-label={`Release ${comp.component} ${row.state} ${row.channel}`}
                            onclick={() => release(comp.component, row.state, row.channel)}
                          >×</button>
                        {/if}
                        {#if openPicker === key}
                          <div class="picker">
                            <RoleChipGrid
                              roles={resolved.roles}
                              value={row.bound}
                              onpick={(r) => reroute(comp.component, row.state, row.channel, r)}
                            />
                          </div>
                        {/if}
                      </div>
                    {/each}
                  </div>
                </div>
              {/each}
            </div>
          {/if}
        </section>
      {/if}
    {/each}
  </div>
{/if}

<style>
  .components-band {
    display: flex;
    flex-direction: column;
    gap: 2px;
    padding: 8px 12px;
    border-top: 1px solid rgba(0, 0, 0, 0.08);
  }
  .band-title {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    opacity: 0.75;
    padding-bottom: 4px;
  }
  .hint {
    font-weight: 400;
    text-transform: none;
    letter-spacing: 0;
    font-size: 10px;
    opacity: 0.7;
    border-bottom: 1px dotted currentColor;
    cursor: help;
  }
  .region-head {
    display: flex;
    align-items: center;
    gap: 6px;
    width: 100%;
    background: none;
    border: none;
    padding: 5px 2px;
    font-size: 12px;
    text-transform: capitalize;
    cursor: pointer;
    text-align: left;
  }
  .chev { transition: transform 120ms; font-size: 10px; }
  .chev.open { transform: rotate(90deg); }
  .region-body { padding: 2px 0 6px 16px; display: flex; flex-direction: column; gap: 6px; }
  .component { display: flex; flex-direction: column; gap: 2px; }
  .comp-name {
    font-family: ui-monospace, SFMono-Regular, monospace;
    font-size: 11px;
    opacity: 0.85;
  }
  .channels { display: flex; flex-direction: column; gap: 1px; }
  .channel-row { position: relative; display: flex; align-items: center; gap: 4px; }
  .channel-btn {
    display: flex;
    align-items: center;
    gap: 6px;
    background: none;
    border: none;
    padding: 2px 4px;
    border-radius: 4px;
    cursor: pointer;
    font-size: 11px;
    flex: 1;
    text-align: left;
  }
  .channel-btn:hover { background: rgba(0, 0, 0, 0.05); }
  .swatch {
    width: 12px;
    height: 12px;
    border-radius: 3px;
    border: 1px solid rgba(0, 0, 0, 0.18);
    flex-shrink: 0;
  }
  .chan-label { width: 92px; opacity: 0.75; }
  .bound { font-family: ui-monospace, SFMono-Regular, monospace; font-size: 10.5px; }
  .rerouted .bound { font-weight: 600; }
  .release {
    background: none;
    border: none;
    cursor: pointer;
    opacity: 0.6;
    font-size: 12px;
    padding: 0 4px;
  }
  .release:hover { opacity: 1; }
  .picker {
    position: absolute;
    top: 100%;
    left: 0;
    z-index: 30;
    background: #fff;
    border: 1px solid rgba(0, 0, 0, 0.15);
    border-radius: 8px;
    box-shadow: 0 6px 24px rgba(0, 0, 0, 0.18);
    width: 320px;
  }
</style>

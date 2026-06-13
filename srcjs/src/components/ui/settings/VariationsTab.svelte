<!--
  VariationsTab — Layer 1 of the settings redesign (D21; canonical plan:
  docs/dev/settings-redesign.md). THEME-BLESSED MODE SELECTION: every
  control here flips a structural variant the theme already knows how to
  render ("do what the theme says should happen in that mode"). Nothing
  freeform — per-series escape hatches live in Plots (L3), wiring in
  Styling (L4).

  Travel (the matrix): every write lands on THEME INPUTS via
  setAuthoringInputs → travels with the theme artifact → reverted by
  Reset theme. Banding moved here from the figure band (Phase 1): it is
  house style now (`inputs.banding`); the runtime figure override
  (Shiny set_banding) survives as API but no panel control writes it —
  handlers CLEAR any override so the theme write is never masked.

  Consequence-or-absence (first principle 1): controls whose target is
  absent from the CURRENT figure do not render — Title needs a title,
  Tag's chip needs a tag label, Series needs a plot column, banding's
  group segment needs groups. The consequence harness
  (tests/browser/settings-consequence.browser.ts) walks every [data-vt]
  control and asserts a visible-pixel delta in the widget.

  The density "advanced control in Styling" signpost caption arrives
  with Phase 5 (pointing at a tab that doesn't exist yet would be a
  broken signpost).
-->
<script lang="ts">
  import type { TabvizStore } from "$stores/tabvizStore.svelte";
  import type { ThemeInputs } from "$types/theme-inputs";
  import { useThemeInputs } from "./theme-inputs.svelte";
  import { EnumRow } from "$components/theme-controls";
  import Field from "$components/primitives/v2/Field.svelte";
  import Slider from "$components/primitives/v2/Slider.svelte";

  interface Props { store: TabvizStore; }
  const { store }: Props = $props();

  const ti = useThemeInputs(() => store);
  const inputs = $derived(ti.inputs);
  const { commit, preview, patch } = ti;

  // Effects is the one nested-key patch Variations needs beyond the
  // generic top-level `patch`; kept local (Variations-only).
  function patchEffects(key: string, value: unknown, commitNow = true): void {
    const next = { ...inputs!, effects: { ...inputs!.effects, [key]: value } } as ThemeInputs;
    if (commitNow) commit(next); else preview(next);
  }

  // ── Banding (theme input; clears any runtime override on write) ──────
  const banding = $derived(store.effectiveBanding);
  const bandingValue = $derived.by(() => {
    if (!banding || banding.mode === "none") return "none";
    return banding.mode === "row" ? "row" : "group";
  });
  const bandingLevel = $derived(
    banding && banding.mode !== "none" && banding.mode !== "row"
      ? (banding.level ?? 1)
      : 1,
  );
  const groupDepth = $derived(store.maxGroupDepth);
  const startsWithBand = $derived(store.bandingStartsWithBand);

  function writeBanding(grammar: string): void {
    // Clear the figure-tier override FIRST: effectiveBanding resolves
    // override > theme, so a Shiny-set override would silently mask the
    // theme write (a dead control — the exact bug class this redesign
    // exists to kill).
    store.setBandingOverride(null);
    patch("banding", grammar);
  }
  function setBandingMode(v: string): void {
    if (v === "group") {
      const lvl = banding && banding.mode !== "none" && banding.mode !== "row"
        ? banding.level : null;
      writeBanding(lvl ? `group-${lvl}` : "group");
    } else {
      writeBanding(v === "none" ? "none" : "row");
    }
  }
  function setBandingStart(v: string): void {
    store.setBandingStartsWithBand(null);
    patch("banding_start", v as ThemeInputs["banding_start"]);
  }

  // ── Consequence gates ────────────────────────────────────────────────
  // Merged reads: session label edits (inline dblclick / Labels tab)
  // overlay spec.labels — a title typed this session arms the Title row.
  const hasTitle = $derived(Boolean(store.getPlotLabel("title")));
  const hasTag = $derived(Boolean(store.getPlotLabel("tag")));
  // slot_style restyles series marks — without a plot column it is inert.
  const hasSeriesMarks = $derived(
    store.allColumns.some((c) =>
      c.type === "forest" || c.type === "sparkline" || c.type.startsWith("viz_")),
  );

  const fx = $derived(inputs?.effects ?? {});
  // gradient_shell paints the SHELL surface; float/transparent modes
  // don't paint the shell at all, so the control would be inert there
  // (found by the consequence harness — every segment 0px at float).
  const shellPainted = $derived(
    (inputs?.shell_mode ?? "flush") === "flush" || inputs?.shell_mode === "raised",
  );

  // ── Roster constants (user-facing words only — no resolver vocabulary) ──
  const POLARITY = ["light", "dark"] as const;
  const DENSITY = ["compact", "comfortable", "spacious"] as const;
  const HEADER = ["light", "tint", "bold"] as const;
  const SHELL = ["flush", "raised", "float", "transparent"] as const;
  const TEXTURE = ["none", "ruled", "grid", "dotted", "grain"] as const;
  const BORDERS = ["none", "hairline", "ruled", "frame", "boxed"] as const;
  const SERIES = [
    { value: "fill_with_darker_stroke", label: "ring" },
    { value: "flat_fill", label: "flat" },
    { value: "outlined", label: "outline" },
  ] as const;
</script>

{#if inputs}
  <div class="variations">
    <!-- ── Mode ─────────────────────────────────────────────────────── -->
    <div data-vt="polarity">
      <EnumRow label="Polarity" value={inputs.polarity ?? "light"}
               segments={POLARITY.map((v) => ({ value: v, label: v }))}
               onchange={(v) => patch("polarity", v as ThemeInputs["polarity"])} />
    </div>
    <div data-vt="density">
      <EnumRow label="Density" value={inputs.density ?? "comfortable"}
               segments={DENSITY.map((v) => ({ value: v, label: v }))}
               onchange={(v) => patch("density", v as ThemeInputs["density"])} />
      <p class="signpost">Fine dial in Edit theme → Styling.</p>
    </div>
    <div data-vt="banding">
      <EnumRow label="Banding" value={bandingValue}
               segments={groupDepth > 0
                 ? [
                     { value: "none", label: "none" },
                     { value: "row", label: "row" },
                     { value: "group", label: "group" },
                   ]
                 : [
                     { value: "none", label: "none" },
                     { value: "row", label: "row" },
                   ]}
               onchange={setBandingMode} />
    </div>
    {#if bandingValue === "group" && groupDepth > 1}
      <div data-vt="banding-level">
        <Field label="Level" hint="Which group depth alternates the band.">
          <Slider value={bandingLevel} min={1} max={groupDepth} step={1}
                  ariaLabel="Banding group level"
                  oncommit={(v) => writeBanding(`group-${v}`)} />
        </Field>
      </div>
    {/if}
    {#if bandingValue !== "none"}
      <div data-vt="banding-start">
        <EnumRow label="Start"
                 hint="Whether the first band is shaded or plain."
                 value={startsWithBand ? "band" : "plain"}
                 segments={[
                   { value: "band", label: "band" },
                   { value: "plain", label: "plain" },
                 ]}
                 onchange={setBandingStart} />
      </div>
    {/if}

    <!-- ── Chrome ───────────────────────────────────────────────────── -->
    <div class="strata">chrome</div>
    <div data-vt="header">
      <EnumRow label="Header" value={inputs.header_style ?? "light"}
               segments={HEADER.map((v) => ({ value: v, label: v }))}
               onchange={(v) => patch("header_style", v as ThemeInputs["header_style"])} />
    </div>
    {#if hasTitle}
      <div data-vt="title">
        <EnumRow label="Title" value={fx.title_style ?? "normal"}
                 segments={["normal", "bar", "underline"].map((v) => ({ value: v, label: v }))}
                 onchange={(v) => patchEffects("title_style", v)} />
      </div>
    {/if}
    <!-- chip stamps labels.tag (default "TABLE" when none is set — never
         inert); stripe draws the brand seam on the shell. Both work on
         every figure, so no consequence gate here. -->
    <div data-vt="tag">
      <EnumRow label="Tag" value={fx.caption_style ?? "none"}
               hint={hasTag ? undefined : "No tag text set — the chip stamps \"TABLE\". Set tag= in R."}
               segments={["none", "chip", "stripe", "both"].map((v) => ({ value: v, label: v }))}
               onchange={(v) => patchEffects("caption_style", v)} />
    </div>
    <div data-vt="shell">
      <EnumRow label="Shell" value={inputs.shell_mode ?? "flush"}
               segments={SHELL.map((v) => ({ value: v, label: v }))}
               onchange={(v) => patch("shell_mode", v as ThemeInputs["shell_mode"])} />
    </div>
    <div data-vt="texture">
      <EnumRow label="Texture" value={inputs.shell_texture ?? "none"}
               segments={TEXTURE.map((v) => ({ value: v, label: v }))}
               onchange={(v) => patch("shell_texture", v as ThemeInputs["shell_texture"])} />
    </div>
    <div data-vt="borders">
      <EnumRow label="Borders" value={inputs.border_preset ?? "hairline"}
               segments={BORDERS.map((v) => ({ value: v, label: v }))}
               onchange={(v) => patch("border_preset", v as ThemeInputs["border_preset"])} />
    </div>
    {#if hasSeriesMarks}
      <div data-vt="series">
        <EnumRow label="Series" value={inputs.slot_style ?? "fill_with_darker_stroke"}
                 hint="How each series derives its fill / stroke pair."
                 segments={SERIES.map((s) => ({ value: s.value, label: s.label }))}
                 onchange={(v) => patch("slot_style", v as ThemeInputs["slot_style"])} />
      </div>
    {/if}

    <!-- ── Effects ──────────────────────────────────────────────────── -->
    <div class="strata">effects</div>
    <div data-vt="glow">
      <EnumRow label="Glow" value={fx.glow_intensity ?? "none"}
               segments={["none", "subtle", "neon"].map((v) => ({ value: v, label: v }))}
               onchange={(v) => patchEffects("glow_intensity", v)} />
    </div>
    {#if (fx.glow_intensity ?? "none") !== "none"}
      <div data-vt="glow-anchor">
        <EnumRow label="Anchor" value={fx.glow_anchor ?? "brand"}
                 segments={["brand", "accent"].map((v) => ({ value: v, label: v }))}
                 onchange={(v) => patchEffects("glow_anchor", v)} />
      </div>
    {/if}
    {#if shellPainted}
      <div data-vt="gradient">
        <EnumRow label="Gradient" value={fx.gradient_shell_intensity ?? "none"}
                 segments={["none", "subtle", "vivid"].map((v) => ({ value: v, label: v }))}
                 onchange={(v) => patchEffects("gradient_shell_intensity", v)} />
      </div>
      {#if (fx.gradient_shell_intensity ?? "none") !== "none"}
        <div data-vt="gradient-angle">
          <Field label="Angle">
            <Slider value={fx.gradient_shell_angle ?? 90} min={0} max={360} step={5}
                    valueText={`${Math.round(fx.gradient_shell_angle ?? 90)}°`}
                    ariaLabel="Gradient angle"
                    onchange={(v) => patchEffects("gradient_shell_angle", v, false)}
                    oncommit={(v) => patchEffects("gradient_shell_angle", v)} />
          </Field>
        </div>
      {/if}
    {/if}
    <div data-vt="shadow">
      <EnumRow label="Shadow" value={fx.elevation ?? "none"}
               segments={["none", "low", "medium", "high"].map((v) => ({ value: v, label: v }))}
               onchange={(v) => patchEffects("elevation", v)} />
    </div>
    <div data-vt="glass">
      <EnumRow label="Glass" hint="Translucent shell (browser only — exports render it opaque)."
               value={fx.glass ?? "none"}
               segments={["none", "frosted", "aurora"].map((v) => ({ value: v, label: v }))}
               onchange={(v) => patchEffects("glass", v)} />
    </div>

    <!-- ── Text ─────────────────────────────────────────────────────── -->
    <div class="strata">text</div>
    <div data-vt="text-size">
      <Field label="Size">
        <Slider value={inputs.type_base_size ?? 14} min={10} max={22} step={0.5} suffix="px"
                ariaLabel="Text base size"
                onchange={(v) => preview({ ...inputs, type_base_size: v })}
                oncommit={(v) => patch("type_base_size", v)} />
      </Field>
    </div>
    <div data-vt="text-scale">
      <Field label="Scaling" hint="Size ratio between text levels (body → headers → title).">
        <Slider value={inputs.type_scale_ratio ?? 1.2} min={1.05} max={1.5} step={0.01}
                valueText={`×${(inputs.type_scale_ratio ?? 1.2).toFixed(2)}`}
                ariaLabel="Text scale ratio"
                onchange={(v) => preview({ ...inputs, type_scale_ratio: v })}
                oncommit={(v) => patch("type_scale_ratio", v)} />
      </Field>
    </div>
  </div>
{/if}

<style>
  .variations {
    display: flex;
    flex-direction: column;
    gap: var(--v2-gap-hair, 2px);
    padding: 8px 0;
  }
  /* Signpost caption (kills redundancy structurally): an L1 control with
     a deeper sibling points at it instead of duplicating it. */
  .signpost {
    margin: 0 0 4px;
    padding-left: 2px;
    font-size: var(--v2-text-small, 10.5px);
    font-style: italic;
    color: var(--v2-ink-3, #8a8478);
  }
  /* Strata eyebrow — tracked micro-cap divider between control groups. */
  .strata {
    margin-top: 8px;
    padding: 6px 0 2px;
    border-top: 1px solid var(--v2-rule-soft, #e6e0d1);
    font-family: var(--v2-font-sans, system-ui, sans-serif);
    font-size: var(--v2-text-micro, 9.5px);
    font-weight: 600;
    letter-spacing: var(--v2-track-flag, 0.14em);
    text-transform: uppercase;
    color: var(--v2-ink-3, #8a8478);
  }
</style>

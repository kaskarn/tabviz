<script lang="ts">
  import type { TabvizStore } from "$stores/tabvizStore.svelte";
  import type { BandingMode } from "$types";
  import Section from "$components/primitives/v2/Section.svelte";
  import SegmentedField from "./SegmentedField.svelte";
  import NumberField from "./NumberField.svelte";

  interface Props {
    store: TabvizStore;
  }

  let { store }: Props = $props();

  const banding = $derived(store.effectiveBanding);
  const depth = $derived(store.maxGroupDepth);
  const hasGroups = $derived(depth > 0);
  const effectiveLevel = $derived(banding.level ?? depth);
  const startsWithBand = $derived(store.bandingStartsWithBand);

  function setMode(mode: BandingMode) {
    if (mode === "none" || mode === "row") {
      store.setBandingOverride(mode);
      return;
    }
    // group
    const level = banding.level ?? depth;
    if (hasGroups) {
      store.setBandingOverride(`group-${level}`);
    } else {
      store.setBandingOverride("row");
    }
  }

  function setLevel(n: number) {
    const clamped = Math.min(Math.max(n, 1), depth);
    store.setBandingOverride(`group-${clamped}`);
  }

  function setPhase(withBand: boolean) {
    store.setBandingStartsWithBand(withBand);
  }
</script>

<!--
  Banding now composes the v2 primitives (SegmentedField / NumberField)
  so it lines up with the rest of the Layout tab. The previous bespoke
  buttons used the legacy --tv-accent (bright blue) styling and read
  as a different design language; v2 inherits the editorial ink-on-
  cream palette and stays compact at 22 px row heights.
-->
<!-- Banding is small (~2 rows of content) — agents called the glyph
     overdressed for the footprint. Drop the section glyph and hint
     stays terse so the section reads as quiet punctuation between
     Borders and the next tab. -->
<Section
  title="Banding"
  hint="Alternate-row backgrounds; Group mode paints whole groups as single bands."
>
  <SegmentedField
    label="Mode"
    value={banding.mode as "none" | "row" | "group"}
    options={hasGroups
      ? [
          { value: "none",  label: "None"  },
          { value: "row",   label: "Row"   },
          { value: "group", label: "Group" },
        ]
      : [
          { value: "none", label: "None" },
          { value: "row",  label: "Row"  },
        ]}
    onchange={(v) => setMode(v)}
  />

  {#if banding.mode === "group" && hasGroups}
    <NumberField
      label="Level"
      value={effectiveLevel}
      min={1}
      max={depth}
      step={1}
      onchange={setLevel}
    />
  {/if}

  {#if banding.mode !== "none"}
    <SegmentedField
      label="Start"
      hint="Does the first row sit on the band or the plain surface?"
      value={startsWithBand ? "band" : "plain"}
      options={[
        { value: "plain", label: "Plain" },
        { value: "band",  label: "Band"  },
      ]}
      onchange={(v) => setPhase(v === "band")}
    />
  {/if}
</Section>

<!--
  v2 Knob scenario — plain, scrub, track modes. Plus suffixes,
  pinned override, disabled. Click the chip and drag horizontally to
  scrub when min/max present.
-->
<script lang="ts">
  import Knob from "../../../../src/components/primitives/v2/Knob.svelte";
  import { harnessState, recordChange } from "../../harness-store.svelte";

  let plain: number | null = $state(42);
  let scrub: number | null = $state(8);
  let track: number | null = $state(48);
  let pct: number | null   = $state(75);
  let pinned: number | null = $state(2);

  $effect(() => {
    const b = harnessState.plain;
    if (b !== plain) { harnessState.plain = plain; recordChange("plain", b, plain, "knob"); }
  });
  $effect(() => {
    const b = harnessState.scrub;
    if (b !== scrub) { harnessState.scrub = scrub; recordChange("scrub", b, scrub, "knob"); }
  });
  $effect(() => {
    const b = harnessState.track;
    if (b !== track) { harnessState.track = track; recordChange("track", b, track, "knob"); }
  });
  $effect(() => {
    const b = harnessState.pct;
    if (b !== pct) { harnessState.pct = pct; recordChange("pct", b, pct, "knob"); }
  });
</script>

<div class="sheet">
  <div class="row">
    <span class="flag">plain</span>
    <Knob bind:value={plain} />
    <span class="mode">no range</span>
  </div>

  <div class="row">
    <span class="flag">scrub</span>
    <Knob bind:value={scrub} min={0} max={20} step={1} suffix="px" />
    <span class="mode">drag chip · range 0–20</span>
  </div>

  <div class="row">
    <span class="flag">track</span>
    <Knob bind:value={track} min={0} max={100} step={1} track suffix="%" />
    <span class="mode">click track · range 0–100</span>
  </div>

  <div class="row">
    <span class="flag">percent</span>
    <Knob bind:value={pct} min={0} max={100} step={5} track suffix="%" />
    <span class="mode">step 5</span>
  </div>

  <div class="row">
    <span class="flag">pinned</span>
    <Knob bind:value={pinned} min={0} max={10} pinned suffix="em" />
    <span class="mode">override dot</span>
  </div>

  <div class="row">
    <span class="flag">disabled</span>
    <Knob value={42} disabled suffix="px" />
    <span class="mode">read-only</span>
  </div>
</div>

<style>
  .sheet {
    display: flex;
    flex-direction: column;
    gap: 14px;
    width: 460px;
  }
  .row {
    display: grid;
    grid-template-columns: 90px 1fr auto;
    align-items: center;
    gap: 16px;
  }
  .flag {
    font-family: var(--v2-font-mono, ui-monospace, monospace);
    font-size: 10px;
    color: var(--v2-ink-3, #8a8478);
    text-transform: uppercase;
    letter-spacing: 0.14em;
  }
  .mode {
    font-family: var(--v2-font-sans, system-ui);
    font-size: 10.5px;
    color: var(--v2-ink-3, #8a8478);
    font-style: italic;
    text-align: right;
    min-width: 0;
  }
</style>

<!--
  Toggle scenario — pill switch, binary on/off.
  Wires the value to harness state so puppeteer can assert on it.
-->
<script lang="ts">
  import Toggle from "../../../src/components/primitives/Toggle.svelte";
  import { harnessState, recordChange } from "../harness-store.svelte";

  let value: boolean = $state(false);

  $effect(() => {
    const before = harnessState.value;
    if (before !== value) {
      harnessState.value = value;
      recordChange("value", before, value, "toggle");
    }
  });
</script>

<div class="row">
  <span class="lbl">Enabled</span>
  <Toggle bind:value ariaLabel="Toggle scenario" />
</div>

<style>
  .row {
    display: inline-flex;
    align-items: center;
    gap: 12px;
  }
  .lbl {
    font-size: 11px;
    color: var(--tv-text-muted, #7a7466);
    text-transform: uppercase;
    letter-spacing: 0.12em;
  }
</style>

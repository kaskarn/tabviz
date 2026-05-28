<!--
  v2 Mode scenario — the four-way MappedValue mode pill. Demos the
  pill plus the "follow-up control" pattern the editor uses (a Knob,
  Picker, or Picker(condition) appears beside the pill depending on
  active mode).
-->
<script lang="ts">
  import Mode  from "../../../../src/components/primitives/v2/Mode.svelte";
  import Pill  from "../../../../src/components/primitives/v2/Pill.svelte";
  import Knob  from "../../../../src/components/primitives/v2/Knob.svelte";
  import Picker from "../../../../src/components/primitives/v2/Picker.svelte";
  import type { MappedMode, PickerItem } from "../../../../src/components/primitives/v2/types";
  import { harnessState, recordChange } from "../../harness-store.svelte";

  let modeA = $state<MappedMode>("theme");
  let modeB = $state<MappedMode>("static");
  let modeC = $state<MappedMode>("field");
  let modeD = $state<MappedMode>("condition");

  let staticValue: number | null = $state(12);
  let fieldValue: string | null = $state("estimate");
  let conditionValue: string | null = $state("is_significant");

  const fieldItems: PickerItem<string>[] = [
    { value: "estimate",       label: "estimate",        secondary: "num", glyph: "field.numeric" },
    { value: "n_events",       label: "n_events",        secondary: "int", glyph: "field.integer" },
    { value: "is_significant", label: "is_significant",  secondary: "bool",glyph: "field.logical" },
  ];
  const conditionItems: PickerItem<string>[] = [
    { value: "is_significant", label: "is_significant", glyph: "mode.condition" },
    { value: "treatment_arm",  label: "treatment_arm",  glyph: "mode.condition" },
    { value: "above_median",   label: "above_median",   glyph: "mode.condition" },
  ];

  $effect(() => {
    const b = harnessState.modeA;
    if (b !== modeA) { harnessState.modeA = modeA; recordChange("modeA", b, modeA, "mode"); }
  });
  $effect(() => {
    const b = harnessState.modeB;
    if (b !== modeB) { harnessState.modeB = modeB; recordChange("modeB", b, modeB, "mode"); }
  });
</script>

<div class="sheet">
  <section>
    <h3>Mode pill — four orthogonal modes</h3>
    <div class="row">
      <span class="flag">A</span>
      <Mode bind:value={modeA} />
      <span class="active">active: <code>{modeA}</code></span>
    </div>
    <div class="row">
      <span class="flag">B</span>
      <Mode bind:value={modeB} />
      <span class="active">active: <code>{modeB}</code></span>
    </div>
  </section>

  <section>
    <h3>Mode + follow-up — editor pattern</h3>
    <p class="hint">
      The mode pill chooses HOW a value is supplied; the follow-up
      control captures WHAT. Switch modes to see the follow-up swap.
    </p>

    <div class="follow-row">
      <span class="flag">font-size</span>
      <Mode bind:value={modeC} />
      <div class="follow">
        {#if modeC === "theme"}
          <span class="from-theme">inherited from theme — 12 px</span>
        {:else if modeC === "static"}
          <Knob bind:value={staticValue} min={6} max={48} step={1} suffix="px" />
        {:else if modeC === "field"}
          <Picker bind:value={fieldValue} items={fieldItems} placeholder="Pick a field" />
        {:else if modeC === "condition"}
          <Picker bind:value={conditionValue} items={conditionItems} placeholder="Pick a condition" />
        {/if}
      </div>
    </div>

    <div class="follow-row">
      <span class="flag">color</span>
      <Mode bind:value={modeD} />
      <div class="follow">
        {#if modeD === "theme"}
          <span class="from-theme">inherited — accent.ink</span>
        {:else if modeD === "static"}
          <span class="swatch"><span class="chip" style:background="#b53a1f"></span><code>#b53a1f</code></span>
        {:else if modeD === "field"}
          <Picker bind:value={fieldValue} items={fieldItems} placeholder="Pick a field" />
        {:else if modeD === "condition"}
          <Picker bind:value={conditionValue} items={conditionItems} placeholder="Pick a condition" />
        {/if}
      </div>
    </div>
  </section>

  <section>
    <h3>Pruned set</h3>
    <p class="hint">Some options don't accept all modes — e.g. a boolean-only option might allow only theme + static.</p>
    <div class="row">
      <span class="flag">2-mode</span>
      <Mode value="static" modes={["theme", "static"]} disabled />
      <span class="active">theme | static only</span>
    </div>
  </section>
</div>

<style>
  .sheet {
    display: flex;
    flex-direction: column;
    gap: 28px;
    width: 580px;
  }
  section {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  h3 {
    margin: 0;
    font-family: var(--v2-font-mono, ui-monospace, monospace);
    font-size: var(--v2-text-micro, 9.5px);
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.14em;
    color: var(--v2-ink, #15140e);
    padding-bottom: 4px;
    border-bottom: 1px solid var(--v2-rule, #d6d0c1);
  }
  .hint {
    margin: 0;
    font-size: 11px;
    color: var(--v2-ink-3, #8a8478);
    font-style: italic;
  }

  .row, .follow-row {
    display: grid;
    grid-template-columns: 80px auto 1fr;
    align-items: center;
    gap: 14px;
  }
  .follow-row {
    grid-template-columns: 80px auto 1fr;
  }
  .flag {
    font-family: var(--v2-font-mono, ui-monospace, monospace);
    font-size: 10px;
    color: var(--v2-ink-3, #8a8478);
    text-transform: uppercase;
    letter-spacing: 0.14em;
  }
  .active, .from-theme {
    font-family: var(--v2-font-sans, system-ui);
    font-size: 10.5px;
    color: var(--v2-ink-3, #8a8478);
    font-style: italic;
  }
  .active code {
    font-family: var(--v2-font-mono);
    color: var(--v2-ink, #15140e);
    background: var(--v2-paper-2, #f3efe5);
    padding: 1px 5px;
    border-radius: 3px;
    margin-left: 4px;
    font-style: normal;
  }
  .follow {
    min-width: 0;
  }
  .swatch {
    display: inline-flex;
    align-items: center;
    gap: 6px;
  }
  .swatch .chip {
    width: 16px;
    height: 16px;
    border-radius: 3px;
    box-shadow: inset 0 0 0 1px var(--v2-rule, #d6d0c1);
  }
  .swatch code {
    font-family: var(--v2-font-mono);
    font-size: 11px;
    color: var(--v2-ink, #15140e);
  }
</style>

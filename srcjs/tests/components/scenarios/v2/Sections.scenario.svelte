<!--
  v2 Sections scenario — mocks the structural skeleton of the new
  column editor. Top-level Sections (DATA, HEADER & LAYOUT) plus
  schema-cascade Accordions (Numeric options, Text options) below.

  This is the closest preview to what the column editor popover
  will look like.
-->
<script lang="ts">
  import Section   from "../../../../src/components/primitives/v2/Section.svelte";
  import Accordion from "../../../../src/components/primitives/v2/Accordion.svelte";
  import Field     from "../../../../src/components/primitives/v2/Field.svelte";
  import Pill      from "../../../../src/components/primitives/v2/Pill.svelte";
  import Knob      from "../../../../src/components/primitives/v2/Knob.svelte";
  import { harnessState, recordChange } from "../../harness-store.svelte";

  type Align = "left" | "center" | "right";

  let field: string = $state("estimate");
  let header: string = $state("Estimate");
  let align = $state<Align>("right");
  let width: number | null = $state(120);
  let sortable: boolean = $state(true);
  let decimals: number | null = $state(2);
  let scientific: boolean = $state(false);

  function bind<T>(key: string, v: T): void {
    if (harnessState[key] !== v) {
      const before = harnessState[key];
      harnessState[key] = v;
      recordChange(key, before, v, "section");
    }
  }
  $effect(() => { bind("field",      field);      });
  $effect(() => { bind("header",     header);     });
  $effect(() => { bind("align",      align);      });
  $effect(() => { bind("width",      width);      });
  $effect(() => { bind("sortable",   sortable);   });
  $effect(() => { bind("decimals",   decimals);   });
  $effect(() => { bind("scientific", scientific); });

  // Pinned: differs from default
  const decimalsPinned = $derived(decimals !== 0 && decimals !== null);
  const widthPinned    = $derived(width !== null);
  const alignPinned    = $derived<boolean>(align !== "left");
</script>

<div class="popover">
  <header class="pop-h">
    <div class="pop-h-text">
      <span class="pop-h-glyph">#</span>
      <span class="pop-h-name">numeric column</span>
    </div>
    <button type="button" class="pop-h-close" aria-label="Close">×</button>
  </header>

  <div class="pop-body">
    <Section glyph="section.data" title="Data">
      <Field label="Field" glyph="field.numeric" mono>
        <span class="field-ref">estimate</span>
      </Field>
    </Section>

    <Section glyph="section.header" title="Header & Layout" hint="how the column reads at a glance">
      <Field label="Header">
        <span class="text-chip">{header}</span>
      </Field>
      <Field label="Align" glyph="align.center" tight pinned={alignPinned} onreset={() => (align = "left")}>
        <Pill
          bind:value={align}
          segments={[
            { value: "left",   glyph: "align.left",   title: "Left" },
            { value: "center", glyph: "align.center", title: "Center" },
            { value: "right",  glyph: "align.right",  title: "Right" },
          ]}
          ariaLabel="Align"
        />
      </Field>
      <Field label="Width" glyph="action.dragger" pinned={widthPinned} onreset={() => (width = null)}>
        <Knob bind:value={width} min={40} max={400} step={4} track suffix="px" pinned={widthPinned} />
      </Field>
      <Field label="Sortable" glyph="sort.unsorted" tight>
        <Pill
          bind:value={sortable}
          segments={[
            { value: false, label: "off" },
            { value: true,  label: "on" },
          ]}
          ariaLabel="Sortable"
        />
      </Field>
    </Section>

    <Accordion glyph="type.numeric" title="Numeric options" count={decimalsPinned ? 1 : 0}>
      <Field
        label="Decimals"
        pinned={decimalsPinned}
        onreset={() => (decimals = 0)}
        hint={decimalsPinned ? "click ● to reset" : undefined}
      >
        <Knob bind:value={decimals} min={0} max={6} step={1} pinned={decimalsPinned} />
      </Field>
      <Field label="Scientific" tight>
        <Pill
          bind:value={scientific}
          segments={[
            { value: false, label: "auto" },
            { value: true,  label: "e±n" },
          ]}
          ariaLabel="Scientific notation"
        />
      </Field>
    </Accordion>

    <Accordion glyph="type.text" title="Text options" open={false} dim>
      <Field label="Truncate" tight>
        <Pill
          value={"ellipsis"}
          segments={[
            { value: "none",     label: "none" },
            { value: "ellipsis", label: "ellipsis" },
            { value: "wrap",     label: "wrap" },
          ]}
          ariaLabel="Truncate mode"
        />
      </Field>
    </Accordion>
  </div>
</div>

<style>
  .popover {
    width: 384px;
    background: var(--v2-paper, #faf7f0);
    box-shadow:
      0 1px 0 var(--v2-rule, #d6d0c1),
      0 8px 28px rgba(21, 20, 14, 0.10),
      0 32px 80px rgba(21, 20, 14, 0.06);
    border-radius: var(--v2-r-large, 6px);
    overflow: hidden;
  }
  .pop-h {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 12px 8px;
    border-bottom: 1px solid var(--v2-rule, #d6d0c1);
    background: var(--v2-paper-2, #f3efe5);
  }
  .pop-h-text {
    display: inline-flex;
    align-items: baseline;
    gap: 8px;
    flex: 1;
  }
  .pop-h-glyph {
    font-family: var(--v2-font-mono);
    font-size: 14px;
    color: var(--v2-ink, #15140e);
    width: 14px;
    text-align: center;
  }
  .pop-h-name {
    font-family: var(--v2-font-mono);
    font-size: var(--v2-text-micro, 9.5px);
    text-transform: uppercase;
    letter-spacing: var(--v2-track-flag, 0.14em);
    color: var(--v2-ink, #15140e);
    font-weight: 600;
  }
  .pop-h-close {
    appearance: none;
    background: transparent;
    border: 0;
    width: 22px;
    height: 22px;
    border-radius: 3px;
    color: var(--v2-ink-3, #8a8478);
    font-size: 18px;
    line-height: 1;
    cursor: pointer;
    display: grid;
    place-items: center;
  }
  .pop-h-close:hover {
    background: var(--v2-hover-tint, rgba(21,20,14,0.05));
    color: var(--v2-ink, #15140e);
  }

  .pop-body {
    padding: 0 14px 12px;
    display: flex;
    flex-direction: column;
  }

  .field-ref {
    font-family: var(--v2-font-mono);
    font-size: var(--v2-text-body, 11.5px);
    color: var(--v2-ink, #15140e);
    background: var(--v2-paper-2, #f3efe5);
    padding: 2px 6px;
    border-radius: 3px;
  }
  .text-chip {
    font-family: var(--v2-font-sans);
    font-size: var(--v2-text-body, 11.5px);
    color: var(--v2-ink, #15140e);
    background: var(--v2-paper-edge, #fff);
    box-shadow: inset 0 0 0 1px var(--v2-rule, #d6d0c1);
    padding: 2px 7px;
    border-radius: var(--v2-r-soft, 3px);
    line-height: 1.4;
  }
</style>

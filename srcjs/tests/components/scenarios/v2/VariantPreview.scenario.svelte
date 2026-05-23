<!--
  v2 VariantPicker + ColumnPreview scenario — isolated demo of the
  two new editorial controls. Drop the editor chrome; show each
  primitive on its own so the design can be audited without the
  surrounding accordion stack.
-->
<script lang="ts">
  import VariantPicker from "../../../../src/components/primitives/v2/VariantPicker.svelte";
  import ColumnPreview from "../../../../src/components/primitives/v2/ColumnPreview.svelte";
  import { SCHEMA_REGISTRY } from "../../../../src/schema/columns";
  import type { ColumnSpec } from "../../../../src/types";
  import { harnessState, recordChange } from "../../harness-store.svelte";

  let intervalVariant: string = $state("traditional");
  let badgeVariant: string = $state("pill");
  let pictogramVariant: string = $state("row");

  // A few sample columns for the preview chip.
  const numericCol: Partial<ColumnSpec> = {
    type: "numeric",
    header: "Estimate",
    options: { numeric: { decimals: 2 } },
  };
  const numericCol4: Partial<ColumnSpec> = {
    type: "numeric",
    header: "Estimate (4 dp)",
    align: "right",
    options: { numeric: { decimals: 4 } },
  };
  const intervalCol: Partial<ColumnSpec> = {
    type: "interval",
    header: "Effect (95% CI)",
  };
  // Percent columns wire as type "numeric" with bucket "percent".
  const percentCol: Partial<ColumnSpec> = {
    type: "numeric",
    header: "Response",
    align: "right",
    options: { percent: {} },
  };

  $effect(() => {
    const b = harnessState.intervalVariant;
    if (b !== intervalVariant) {
      harnessState.intervalVariant = intervalVariant;
      recordChange("intervalVariant", b, intervalVariant, "variant");
    }
  });
  $effect(() => {
    const b = harnessState.badgeVariant;
    if (b !== badgeVariant) {
      harnessState.badgeVariant = badgeVariant;
      recordChange("badgeVariant", b, badgeVariant, "variant");
    }
  });
</script>

<div class="sheet">
  <section>
    <h3>Variant picker — interval recipes</h3>
    <VariantPicker
      bind:value={intervalVariant}
      variants={SCHEMA_REGISTRY.interval.variants ?? []}
      ariaLabel="Interval variant"
    />
  </section>

  <section>
    <h3>Variant picker — badge styles</h3>
    <VariantPicker
      bind:value={badgeVariant}
      variants={SCHEMA_REGISTRY.badge.variants ?? []}
      ariaLabel="Badge variant"
    />
  </section>

  <section>
    <h3>Variant picker — pictogram layouts</h3>
    <VariantPicker
      bind:value={pictogramVariant}
      variants={SCHEMA_REGISTRY.pictogram.variants ?? []}
      ariaLabel="Pictogram variant"
    />
  </section>

  <section>
    <h3>Column preview</h3>
    <div class="cols">
      <ColumnPreview schema={SCHEMA_REGISTRY.numeric}  column={numericCol} />
      <ColumnPreview schema={SCHEMA_REGISTRY.numeric}  column={numericCol4} />
      <ColumnPreview schema={SCHEMA_REGISTRY.interval} column={intervalCol} />
      <ColumnPreview schema={SCHEMA_REGISTRY.percent}  column={percentCol} />
    </div>
  </section>
</div>

<style>
  .sheet {
    display: flex;
    flex-direction: column;
    gap: 24px;
    width: 720px;
  }
  section {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  h3 {
    margin: 0;
    font-family: var(--v2-font-mono, ui-monospace, monospace);
    font-size: var(--v2-text-micro, 9.5px);
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: var(--v2-track-flag, 0.14em);
    color: var(--v2-ink, #15140e);
    padding-bottom: 4px;
    border-bottom: 1px solid var(--v2-rule, #d6d0c1);
  }
  .cols {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
  }
</style>

<script lang="ts">
  import type { ForestStore } from "$stores/forestStore.svelte";
  import BandingControl from "./BandingControl.svelte";
  import WatermarkControl from "./WatermarkControl.svelte";

  interface Props {
    store: ForestStore;
  }

  let { store }: Props = $props();
</script>

<!--
  Basics tab: table-wide display controls that don't belong to a narrower
  theming category (colors / typography / spacing / shapes / axis / layout).
  Currently groups banding and watermark; future additions that fit the
  "table display" bucket (row numbering, empty-state text, …) land here.
-->
<BandingControl {store} />
<WatermarkControl {store} />

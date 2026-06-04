<!--
  TraceInspector — the click-to-trace side panel. Repurposes the existing
  CascadeInspector but lives in the ThemePanel's right rail rather than
  the studio root.
-->
<script lang="ts">
  import CascadeInspector from "../../inspector/CascadeInspector.svelte";
</script>

<aside class="trace-inspector" aria-label="Trace Inspector">
  <CascadeInspector />
</aside>

<style>
  .trace-inspector {
    /* The inspector positions itself; we only need a host. */
    display: contents;
  }
</style>

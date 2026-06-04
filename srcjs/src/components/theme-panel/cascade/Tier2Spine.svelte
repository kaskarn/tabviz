<!--
  Tier 2 — wraps the existing RoleSpine. Role tokens pinned at their
  current binding positions on the three ramps. Drag to rebind grade
  (vertical) or ramp (horizontal). Click to trace.
-->
<script lang="ts">
  import type { ResolvedTheme } from "$lib/theme/resolve-theme";
  import RoleSpine from "../../spine/RoleSpine.svelte";

  const { resolved }: { resolved: ResolvedTheme } = $props();
</script>

<div class="tier2-spine">
  <RoleSpine {resolved} />
</div>

<style>
  .tier2-spine {
    padding: 4px 18px 18px;
  }
  .tier2-spine :global(.role-spine) {
    /* Lean into the panel's vertical rhythm — the spine sits flush. */
    border-top: none;
  }
</style>

<!--
  Stage 3 — AdvancedTab.svelte (skeleton)
  Spine UI · token list · raw cssVars editor.
  Initial pass: mounts the existing read-only RoleSpine.
-->
<script lang="ts">
  import { studioStore } from "../studio-store.svelte";
  import RoleSpine from "../../components/spine/RoleSpine.svelte";
</script>

<section>
  <h4>Role spine</h4>
  <p class="muted-note">Drag tokens up/down to change grade, across columns to rebind ramp.</p>
  {#if studioStore.resolved}
    <RoleSpine resolved={studioStore.resolved} />
  {/if}
</section>

<section class="placeholder-section">
  <h4>Token list</h4>
  <p class="muted-note">Per-token pin override (raw cssVars editor) comes once the wire's pinTokenByName surface is exposed here.</p>
</section>

<style>
  section { margin-bottom: 16px; }
  .placeholder-section { opacity: 0.5; }
  h4 {
    margin: 0 0 4px;
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    color: #475569;
    letter-spacing: 0.04em;
  }
  .muted-note {
    margin: 0 0 8px;
    font-size: 11px;
    color: #94a3b8;
    font-style: italic;
  }
</style>

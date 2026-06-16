<script lang="ts">
  import { portal } from "$lib/portal";

  interface Props {
    orientation: "vertical" | "horizontal";
    x?: number;           // viewport coord for vertical line (line X)
    y?: number;           // viewport coord for horizontal line (line Y)
    start?: number;       // perpendicular-axis start (vertical: top; horizontal: left)
    end?: number;         // perpendicular-axis end  (vertical: bottom; horizontal: right)
    // Resolved accent, passed in because this element is portaled to body and
    // can't read the `.tabviz-container`-scoped `--tv-accent` (D4). Falls back
    // to the CSS var/literal when undefined.
    color?: string;
  }
  const { orientation, x = 0, y = 0, start = 0, end = 0, color }: Props = $props();
</script>

<!--
  Portaled to document.body so position:fixed resolves against the
  viewport, not the contain-scoped .tabviz-container. Coords here are
  viewport-relative (from pointer events), so they must match the
  document-body coordinate system.
-->
{#if orientation === "vertical"}
  <div
    class="drop-indicator vertical"
    style:left="{x - 1}px"
    style:top="{start}px"
    style:height="{Math.max(0, end - start)}px"
    style:background={color}
    use:portal
  ></div>
{:else}
  <div
    class="drop-indicator horizontal"
    style:top="{y - 1}px"
    style:left="{start}px"
    style:width="{Math.max(0, end - start)}px"
    style:background={color}
    use:portal
  ></div>
{/if}

<style>
  .drop-indicator {
    position: fixed;
    background: var(--tv-accent, #2563eb);
    pointer-events: none;
    z-index: 10002;
    box-shadow: 0 0 6px rgba(37, 99, 235, 0.6);
  }
  .drop-indicator.vertical { width: 2px; }
  .drop-indicator.horizontal { height: 2px; }
</style>

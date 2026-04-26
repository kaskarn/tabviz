<script lang="ts">
  interface Props {
    orientation: "vertical" | "horizontal";
    x?: number;           // viewport coord for vertical line (line X)
    y?: number;           // viewport coord for horizontal line (line Y)
    start?: number;       // perpendicular-axis start (vertical: top; horizontal: left)
    end?: number;         // perpendicular-axis end  (vertical: bottom; horizontal: right)
  }
  let { orientation, x = 0, y = 0, start = 0, end = 0 }: Props = $props();
</script>

{#if orientation === "vertical"}
  <div
    class="drop-indicator vertical"
    style:left="{x - 1}px"
    style:top="{start}px"
    style:height="{Math.max(0, end - start)}px"
  ></div>
{:else}
  <div
    class="drop-indicator horizontal"
    style:top="{y - 1}px"
    style:left="{start}px"
    style:width="{Math.max(0, end - start)}px"
  ></div>
{/if}

<style>
  .drop-indicator {
    position: fixed;
    background: var(--tv-primary, #2563eb);
    pointer-events: none;
    z-index: 10002;
    box-shadow: 0 0 6px rgba(37, 99, 235, 0.6);
  }
  .drop-indicator.vertical { width: 2px; }
  .drop-indicator.horizontal { height: 2px; }
</style>

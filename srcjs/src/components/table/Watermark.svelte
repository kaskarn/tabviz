<!--
  Subtle watermark overlay rendered behind table content.
  The text is centered on the container and rotated to follow the container's
  diagonal, so the angle adapts to the table's aspect ratio. Theme-aware
  (foreground color at low opacity).
-->
<script lang="ts">
  import { onMount } from "svelte";
  import type { WebTheme } from "../../types/index.js";

  let { text, theme }: { text: string; theme: WebTheme } = $props();

  let wrapper: HTMLDivElement | undefined = $state();
  let width = $state(0);
  let height = $state(0);

  onMount(() => {
    if (!wrapper) return;
    const ro = new ResizeObserver(entries => {
      for (const entry of entries) {
        const r = entry.contentRect;
        width = r.width;
        height = r.height;
      }
    });
    ro.observe(wrapper);
    width = wrapper.clientWidth;
    height = wrapper.clientHeight;
    return () => ro.disconnect();
  });

  // Angle of the wrapper's diagonal — adapts to aspect ratio.
  const angleDeg = $derived(
    width > 0 && height > 0
      ? (Math.atan2(height, width) * 180) / Math.PI
      : 0
  );
  const diag = $derived(Math.sqrt(width * width + height * height));
  // Approx character width factor for a bold sans-serif at fontSize=1.
  // Scale font so the rendered text spans ~70% of the diagonal, then clamp.
  const fontSize = $derived(
    Math.max(
      20,
      Math.min(
        200,
        diag > 0 && text ? (diag * 0.7) / Math.max(1, text.length * 0.55) : 0
      )
    )
  );
  const cx = $derived(width / 2);
  const cy = $derived(height / 2);
</script>

<div bind:this={wrapper} class="tabviz-watermark" aria-hidden="true">
  {#if text && width > 0 && height > 0}
    <svg
      viewBox="0 0 {width} {height}"
      width={width}
      height={height}
      preserveAspectRatio="none"
    >
      <text
        x={cx}
        y={cy}
        transform="rotate({angleDeg.toFixed(2)} {cx} {cy})"
        text-anchor="middle"
        dominant-baseline="middle"
        font-family={theme.typography.fontFamily}
        font-size={fontSize.toFixed(1)}
        font-weight="700"
        fill={theme.colors.foreground}
        fill-opacity="0.07"
      >{text}</text>
    </svg>
  {/if}
</div>

<style>
  .tabviz-watermark {
    position: absolute;
    inset: 0;
    pointer-events: none;
    user-select: none;
    overflow: hidden;
    z-index: 1;
  }
</style>

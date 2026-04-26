<script lang="ts">
  import type { ImgColumnOptions } from "$types";

  interface Props {
    value: string | undefined | null;
    options?: ImgColumnOptions;
    naText?: string;
  }

  let { value, options, naText }: Props = $props();

  const imgHeight = $derived(options?.height);
  const maxWidth = $derived(options?.maxWidth);
  // `fallback` is the field-level default for missing/broken images. When the
  // author hasn't set one but did supply `naText`, prefer naText so the column-
  // wide NA setting wins; otherwise keep the historical camera-emoji default.
  const fallback = $derived(
    options?.fallback ?? (naText !== undefined ? naText : "\u{1F4F7}")
  );
  const shape = $derived(options?.shape ?? "square");

  let hasError = $state(false);

  const shapeClass = $derived(
    shape === "circle" ? "shape-circle" : shape === "rounded" ? "shape-rounded" : ""
  );

  function handleError() {
    hasError = true;
  }
</script>

{#if value && !hasError}
  <img
    class="cell-img {shapeClass}"
    src={value}
    alt=""
    loading="lazy"
    style:height={imgHeight ? `${imgHeight}px` : "calc(var(--tv-row-height, 28px) - 4px)"}
    style:max-width={maxWidth ? `${maxWidth}px` : "100%"}
    onerror={handleError}
  />
{:else if fallback}
  <span class="cell-img-fallback" title="Image not available">
    {fallback}
  </span>
{/if}

<style>
  .cell-img {
    display: block;
    object-fit: contain;
    background: var(--tv-border, #e2e8f0);
  }

  .shape-circle {
    border-radius: 50%;
    object-fit: cover;
  }

  .shape-rounded {
    border-radius: 4px;
  }

  .cell-img-fallback {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    color: var(--tv-muted, #94a3b8);
    font-size: var(--tv-font-size-base, 0.875rem);
  }
</style>

<script lang="ts">
  import type { ReferenceColumnOptions } from "$types";

  interface Props {
    value: string | undefined | null;
    metadata: Record<string, unknown>;
    options?: ReferenceColumnOptions;
    naText?: string;
  }

  let { value, metadata, options, naText }: Props = $props();

  const maxChars = $derived(options?.maxChars ?? 30);
  const showIcon = $derived(options?.showIcon ?? true);
  const hrefField = $derived(options?.hrefField);

  const href = $derived.by(() => {
    if (!hrefField) return null;
    const url = metadata[hrefField];
    return typeof url === "string" ? url : null;
  });

  const displayValue = $derived.by(() => {
    if (value === undefined || value === null) return "";
    const str = String(value);
    if (str.length <= maxChars) return str;
    return str.substring(0, maxChars) + "...";
  });

  const fullValue = $derived(value ? String(value) : "");
  const isTruncated = $derived(fullValue.length > maxChars);
</script>

{#if value}
  {#if href}
    <a
      class="cell-reference"
      {href}
      target="_blank"
      rel="noopener noreferrer"
      title={isTruncated ? fullValue : undefined}
    >
      <span class="reference-text">{displayValue}</span>
      {#if showIcon}
        <span class="reference-icon">↗</span>
      {/if}
    </a>
  {:else}
    <span
      class="cell-reference"
      title={isTruncated ? fullValue : undefined}
    >
      {displayValue}
    </span>
  {/if}
{:else if naText}
  <span class="cell-reference">{naText}</span>
{/if}

<style>
  .cell-reference {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    max-width: 100%;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    color: inherit;
    text-decoration: none;
  }

  a.cell-reference {
    color: var(--tv-accent, #2563eb);
    cursor: pointer;
  }

  a.cell-reference:hover {
    text-decoration: underline;
  }

  .reference-text {
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .reference-icon {
    flex-shrink: 0;
    font-size: 0.8em;
    opacity: 0.7;
  }
</style>

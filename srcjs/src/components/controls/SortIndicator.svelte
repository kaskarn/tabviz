<script lang="ts">
  interface Props {
    direction: "asc" | "desc" | "none";
  }
  let { direction }: Props = $props();
</script>

<span class="sort-indicator" class:active={direction !== "none"} aria-hidden="true">
  {#if direction === "asc"}
    <svg width="10" height="10" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M3 7.5 L6 4.5 L9 7.5" />
    </svg>
  {:else if direction === "desc"}
    <svg width="10" height="10" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M3 4.5 L6 7.5 L9 4.5" />
    </svg>
  {:else}
    <svg width="10" height="10" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" opacity="0.4">
      <path d="M3 4.5 L6 2 L9 4.5" />
      <path d="M3 7.5 L6 10 L9 7.5" />
    </svg>
  {/if}
</span>

<style>
  .sort-indicator {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    margin-left: 4px;
    opacity: 0.5;
    transition: opacity 0.12s ease;
    color: var(--tv-secondary, #64748b);
  }
  .sort-indicator.active {
    opacity: 1;
    color: var(--tv-primary, #2563eb);
  }
</style>

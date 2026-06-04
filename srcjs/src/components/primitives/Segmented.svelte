<!--
  Segmented — enum picker rendered as a row of buttons. Active segment
  inverts (dark bg, light text); inactive segments have hover lift.
  Modeled on rgc-design Segmented (controls.jsx:37-48, styles.css:237-249).
-->
<script lang="ts" generics="T extends string | number | boolean | null">
  interface Props {
    value: T;
    segments: { value: T; label: string }[];
    ariaLabel?: string;
    disabled?: boolean;
    onchange?: (next: T) => void;
  }

  let { value = $bindable(), segments, ariaLabel, disabled = false, onchange }: Props = $props();

  function select(v: T) {
    if (disabled) return;
    value = v;
    onchange?.(v);
  }
</script>

<div class="seg" role="radiogroup" aria-label={ariaLabel} class:disabled>
  {#each segments as seg (String(seg.value))}
    <button
      type="button"
      role="radio"
      aria-checked={value === seg.value}
      class:active={value === seg.value}
      {disabled}
      onclick={() => select(seg.value)}
    >
      {seg.label}
    </button>
  {/each}
</div>

<style>
  .seg {
    display: inline-flex;
    border: 1px solid var(--tv-border, #d6d2c6);
    border-radius: 4px;
    overflow: hidden;
    height: 22px;
  }
  .seg.disabled { opacity: 0.5; pointer-events: none; }

  .seg button {
    appearance: none;
    border: none;
    background: transparent;
    padding: 3px 8px;
    font-family: inherit;
    font-size: 11px;
    color: var(--tv-text, #1f1f1f);
    cursor: pointer;
    border-right: 1px solid var(--tv-border, #d6d2c6);
    transition: background 80ms ease;
  }
  .seg button:last-child { border-right: none; }
  .seg button:hover:not(.active) {
    background: var(--tv-hover-bg, rgba(0, 0, 0, 0.04));
  }
  .seg button.active {
    background: var(--tv-text, #1f1f1f);
    color: var(--tv-surface-bg, #fff);
  }
  .seg button:focus-visible {
    outline: 2px solid var(--tv-accent, #b53a1f);
    outline-offset: -2px;
    z-index: 1;
  }
</style>

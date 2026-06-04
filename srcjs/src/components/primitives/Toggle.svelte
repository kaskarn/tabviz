<!--
  Toggle — pill switch. 26×14 with moving dot. Bindable boolean.
  Modeled on rgc-design Toggle (controls.jsx:83-90, styles.css:251-262).
-->
<script lang="ts">
  interface Props {
    value?: boolean;
    ariaLabel?: string;
    disabled?: boolean;
  }

  let { value = $bindable(false), ariaLabel, disabled = false }: Props = $props();
</script>

<button
  class="toggle"
  type="button"
  role="switch"
  aria-checked={value}
  aria-label={ariaLabel}
  {disabled}
  onclick={() => (value = !value)}
>
  <span class="dot" class:on={value}></span>
</button>

<style>
  .toggle {
    position: relative;
    width: 26px;
    height: 14px;
    padding: 0;
    border: 1px solid var(--tv-border, #d6d2c6);
    border-radius: 8px;
    background: var(--tv-surface-muted, var(--tv-row-alt-bg, #f0eeec));
    cursor: pointer;
    transition: background 100ms ease, border-color 100ms ease;
  }
  .toggle[aria-checked="true"] {
    background: var(--tv-accent, #b53a1f);
    border-color: var(--tv-accent, #b53a1f);
  }
  .toggle:hover:not(:disabled) {
    border-color: var(--tv-text-muted, #7a7466);
  }
  .toggle:focus-visible {
    outline: 2px solid var(--tv-accent, #b53a1f);
    outline-offset: 2px;
  }
  .toggle:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .dot {
    position: absolute;
    top: 1px;
    left: 1px;
    width: 10px;
    height: 10px;
    border-radius: 50%;
    background: var(--tv-surface-bg, #fff);
    transition: transform 120ms ease;
  }
  .dot.on {
    transform: translateX(12px);
  }
</style>

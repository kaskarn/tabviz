<script lang="ts">
  import type { Snippet } from "svelte";

  interface Props {
    /** Visible label for the field (shown alongside the Inherit checkbox). */
    label: string;
    /** Optional secondary hint. */
    hint?: string;
    /** `true` ⇒ this field is inheriting, inner control is hidden. */
    inherit: boolean;
    /**
     * Fired when the user toggles the Inherit checkbox. When the user
     * un-checks Inherit, we need a value to commit — the consumer passes
     * `defaultValue` to decide what that value is (typically the theme's
     * palette color, or a reasonable numeric default).
     */
    onchange: (inherit: boolean) => void;
    /** Child field to render when NOT inheriting. */
    children: Snippet;
  }

  let { label, hint, inherit, onchange, children }: Props = $props();
</script>

<!--
  Semantic bundle fields can be null ("inherit the theme default"). This
  wrapper pairs any inner field with a small Inherit checkbox so the user
  can toggle between "use the theme default" and "use the explicit value"
  without a separate button/sentinel UX. Checked ⇒ inheriting; the inner
  control is hidden. Unchecked ⇒ inner control is live.
-->
<div class="optional-field" title={hint}>
  <span class="label">{label}</span>
  <div class="right">
    <label class="inherit-toggle" title="Inherit theme default">
      <input
        type="checkbox"
        checked={inherit}
        onchange={(e) => onchange((e.target as HTMLInputElement).checked)}
      />
      <span class="inherit-label">inherit</span>
    </label>
    {#if !inherit}
      <div class="child">{@render children()}</div>
    {/if}
  </div>
</div>

<style>
  .optional-field {
    display: grid;
    grid-template-columns: 1fr auto;
    align-items: center;
    gap: 8px;
    padding: 2px 0;
  }

  .label {
    font-size: 0.75rem;
    color: var(--wf-fg, #1a1a1a);
    font-weight: 500;
    line-height: 1.2;
    min-width: 0;
  }

  .right {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .inherit-toggle {
    display: inline-flex;
    align-items: center;
    gap: 3px;
    font-size: 0.65rem;
    color: var(--wf-secondary, #64748b);
    cursor: pointer;
    user-select: none;
  }

  .inherit-toggle input {
    accent-color: var(--wf-primary, #2563eb);
    cursor: pointer;
  }

  .inherit-label {
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }

  .child {
    display: block;
    min-width: 0;
  }
</style>

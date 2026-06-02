<!--
  TextField — settings-panel text row. v2-skinned: Field wraps either
  an <input> (single-line) or a <textarea> (multi-line auto-grow,
  when `lines > 1`). Two events: oninput (every keystroke, for live
  preview) + onchange (blur/Enter, for one op-log entry per edit).
-->
<script lang="ts">
  import Field from "$components/primitives/v2/Field.svelte";

  interface Props {
    label: string;
    hint?: string;
    value: string;
    placeholder?: string;
    oninput?: (value: string) => void;
    onchange?: (value: string) => void;
    /**
     * Multi-line mode: renders a `<textarea>` with `rows=lines` as the
     * minimum visible height; the field auto-grows to fit content up
     * to a generous cap. Default 1 = single-line `<input>`.
     */
    lines?: number;
    /**
     * Type family used to render the field's content. `"mono"` is the
     * default (matches code/data fields). `"serif"` matches a chart
     * title's eventual rendering — use for title/subtitle/caption
     * fields so authors WYSIWYG-author. `"sans"` for prose fields.
     */
    family?: "mono" | "serif" | "sans";
  }

  const { label, hint, value, placeholder, oninput, onchange, lines = 1, family = "mono" }: Props = $props();

  function handleInput(e: Event) {
    const el = e.target as HTMLInputElement | HTMLTextAreaElement;
    autoGrow(el);
    oninput?.(el.value);
  }
  function commit(e: Event) {
    onchange?.((e.target as HTMLInputElement | HTMLTextAreaElement).value);
  }
  function handleKeydown(e: KeyboardEvent) {
    // For single-line, Enter commits. For multi-line, Enter inserts a
    // newline (default) and Cmd+Enter commits.
    if (lines === 1 && e.key === "Enter") {
      onchange?.((e.target as HTMLInputElement).value);
    } else if (lines > 1 && e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      onchange?.((e.target as HTMLTextAreaElement).value);
    }
  }
  function autoGrow(el: HTMLInputElement | HTMLTextAreaElement) {
    if (el.tagName !== "TEXTAREA") return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }
</script>

<!--
  When called with label="", skip the Field wrapper and render the
  bare input. Lets callers that are ALREADY inside a Field's control
  slot reuse TextField without double-wrapping (same pattern as
  ColorField). Outer callers pass a non-empty label and get the
  standard labeled row.
-->
{#snippet bareInput()}
  {#if lines > 1}
    <textarea
      class="tf-input tf-textarea"
      class:family-serif={family === "serif"}
      class:family-sans={family === "sans"}
      rows={lines}
      {value}
      {placeholder}
      oninput={handleInput}
      onchange={commit}
      onblur={commit}
      onkeydown={handleKeydown}
      spellcheck="false"
      aria-label={label || undefined}
    ></textarea>
  {:else}
    <input
      class="tf-input"
      class:family-serif={family === "serif"}
      class:family-sans={family === "sans"}
      type="text"
      {value}
      {placeholder}
      oninput={handleInput}
      onchange={commit}
      onblur={commit}
      onkeydown={handleKeydown}
      spellcheck="false"
      aria-label={label || undefined}
    />
  {/if}
{/snippet}

{#if label === ""}
  {@render bareInput()}
{:else}
<div class="tf-row" data-tv-v2>
  <Field {label} {hint}>
    {#if lines > 1}
      <textarea
        class="tf-input tf-textarea"
        class:family-serif={family === "serif"}
        class:family-sans={family === "sans"}
        rows={lines}
        {value}
        {placeholder}
        oninput={handleInput}
        onchange={commit}
        onblur={commit}
        onkeydown={handleKeydown}
        spellcheck="false"
        aria-label={label}
      ></textarea>
    {:else}
      <input
        class="tf-input"
        class:family-serif={family === "serif"}
        class:family-sans={family === "sans"}
        type="text"
        {value}
        {placeholder}
        oninput={handleInput}
        onchange={commit}
        onblur={commit}
        onkeydown={handleKeydown}
        spellcheck="false"
        aria-label={label}
      />
    {/if}
  </Field>
</div>
{/if}

<style>
  .tf-row { display: contents; }
  .tf-input {
    flex: 1;
    min-width: 0;
    height: var(--v2-control-h, 22px);
    padding: 0 8px;
    border: 0;
    border-radius: var(--v2-r-soft, 3px);
    background: var(--v2-paper-edge, #fff);
    box-shadow: inset 0 0 0 1px var(--v2-rule, #d6d0c1);
    font-family: var(--v2-font-mono, ui-monospace, monospace);
    font-size: var(--v2-text-body, 11.5px);
    color: var(--v2-ink, #15140e);
    outline: none;
    transition: box-shadow var(--v2-dur-snap, 80ms) var(--v2-ease, ease);
  }
  .tf-input:hover  { box-shadow: inset 0 0 0 1px var(--v2-ink-2, #4a463c); }
  .tf-input:focus  { box-shadow: inset 0 0 0 1px var(--v2-rule-strong, #15140e); }
  .tf-input::placeholder {
    color: var(--v2-ink-3, #8a8478);
    font-style: italic;
  }
  /* Multi-line variant: auto-grow height set inline via the
     autoGrow() handler. Min-height covers the rows= attribute when
     empty; line-height keeps editorial spacing. */
  .tf-textarea {
    height: auto;
    min-height: var(--v2-control-h, 22px);
    padding: 4px 8px;
    line-height: 1.35;
    resize: none;
    overflow-y: hidden;
  }

  /* Family variants — let title/caption fields render in the chart's
     own typeface so authors author WYSIWYG. Default is mono (above);
     these classes are merged on for serif/sans. */
  .family-serif {
    font-family: var(--v2-font-serif, "EB Garamond", "Palatino", Georgia, serif) !important;
    font-size: 13px !important;
    letter-spacing: 0.01em;
  }
  .family-sans {
    font-family: var(--v2-font-sans, system-ui, sans-serif) !important;
  }
</style>

<!--
  Select — native styled dropdown for long lists where Picker is
  overkill (curated font roster, ~13+ options without per-item glyphs
  or search). Distinct from Picker (which has search box, group
  headers, glyph badges, keyboard nav, outside-click). Native select
  gives us free a11y + OS-native rendering on each platform.

  Use Picker when the list is keyed by domain semantics (a column
  field, a column type) and benefits from glyph badges + search.
  Use Select when the list is "pick one of these strings."
-->
<script lang="ts" generics="T extends string | number">
  interface Props {
    value?: T | null;
    options: { value: T; label: string; style?: string }[];
    placeholder?: string;
    disabled?: boolean;
    ariaLabel?: string;
    id?: string;
    /** Show option labels in their own family/style — used by FontFamily
     *  to render the live preview. Set per-option via `style`. */
    renderOptionStyle?: boolean;
    onchange?: (next: T) => void;
  }

  let {
    value = $bindable(null),
    options,
    placeholder,
    disabled = false,
    ariaLabel,
    id,
    renderOptionStyle = false,
    onchange,
  }: Props = $props();

  function onSelect(e: Event) {
    const v = (e.target as HTMLSelectElement).value;
    // Coerce back to the generic numeric/string type.
    const next = typeof options[0]?.value === "number" ? (parseFloat(v) as T) : (v as T);
    value = next;
    onchange?.(next);
  }
</script>

<select
  class="select"
  class:disabled
  {disabled}
  {id}
  aria-label={ariaLabel}
  value={value as string | number}
  onchange={onSelect}
>
  {#if placeholder && value == null}
    <option value="" disabled selected>{placeholder}</option>
  {/if}
  {#each options as opt (String(opt.value))}
    <option
      value={opt.value}
      style={renderOptionStyle ? opt.style : undefined}
    >{opt.label}</option>
  {/each}
</select>

<style>
  .select {
    appearance: none;
    -webkit-appearance: none;
    flex: 1;
    min-width: 0;
    height: var(--v2-control-h, 24px);
    padding: 0 22px 0 8px;
    border: 0;
    border-radius: var(--v2-r-soft, 3px);
    background: var(--v2-paper-edge, #fff);
    box-shadow: inset 0 0 0 1px var(--v2-rule, #d6d0c1);
    font-family: var(--v2-font-mono, ui-monospace, monospace);
    font-size: var(--v2-text-body, 11.5px);
    color: var(--v2-ink, #15140e);
    cursor: pointer;
    /* Caret chevron — pure CSS, mono-friendly. */
    background-image: linear-gradient(
      45deg, transparent 50%, var(--v2-ink-3, #8a8478) 50%
    ),
    linear-gradient(
      -45deg, var(--v2-ink-3, #8a8478) 50%, transparent 50%
    );
    background-position:
      calc(100% - 12px) calc(50% - 1px),
      calc(100% - 7px)  calc(50% - 1px);
    background-size: 5px 5px;
    background-repeat: no-repeat;
    transition: box-shadow var(--v2-dur-snap, 80ms) var(--v2-ease);
  }
  .select:hover { box-shadow: inset 0 0 0 1px var(--v2-ink-2, #4a463c); }
  .select:focus { outline: none; box-shadow: inset 0 0 0 1px var(--v2-rule-strong, #15140e); }
  .select.disabled { opacity: 0.4; cursor: not-allowed; }
</style>

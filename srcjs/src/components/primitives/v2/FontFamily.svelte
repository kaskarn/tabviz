<!--
  FontFamily — curated font roster + Dropdown. Each option renders in
  its own family so the user previews live, AND the selected value shows
  in its own face.

  Uses the custom DOM `Dropdown`, NOT the native `Select`: native
  <option> elements ignore `font-family` in Chrome/Safari, so the
  per-option preview (the whole point of this control) was a silent
  no-op under Select. Dropdown renders its option list as real DOM where
  font-family applies. The two are prop-compatible (value / options /
  renderOptionStyle / …), so this is a mechanical swap.

  Roster mirrors rgc-design's tested set: 5 serifs, 6 sans, 3 mono,
  arranged so the most-likely choices float near the top. Authors
  needing extras pass `extra` to extend; or `roster` to replace.

  The wire value is the CSS font-family string (with fallbacks
  already baked in).
-->
<script lang="ts">
  import Dropdown from "./Dropdown.svelte";

  export interface FontEntry {
    /** CSS font-family value (typically a quoted family + fallbacks). */
    value: string;
    /** Display label. */
    label: string;
  }

  /** Default roster — five serifs, six sans, three mono. Drop or
   *  extend via the `roster` and `extra` props on the parent. */
  export const DEFAULT_ROSTER: FontEntry[] = [
    { value: '"Spectral", Georgia, serif',                      label: "Spectral" },
    { value: '"Newsreader", Georgia, serif',                    label: "Newsreader" },
    { value: '"IBM Plex Serif", Georgia, serif',                label: "Plex Serif" },
    { value: '"Cormorant Garamond", Georgia, serif',            label: "Cormorant" },
    { value: '"EB Garamond", Georgia, serif',                   label: "EB Garamond" },
    { value: "Georgia, serif",                                  label: "Georgia" },
    { value: "Helvetica, 'Helvetica Neue', Arial, sans-serif",  label: "Helvetica" },
    { value: '"Inter", Helvetica, sans-serif',                  label: "Inter" },
    { value: '"DM Sans", Helvetica, sans-serif',                label: "DM Sans" },
    { value: '"IBM Plex Sans", Helvetica, sans-serif',          label: "Plex Sans" },
    { value: '"IBM Plex Mono", "Menlo", monospace',             label: "Plex Mono" },
    { value: '"JetBrains Mono", monospace',                     label: "JetBrains Mono" },
    { value: '"Space Mono", monospace',                         label: "Space Mono" },
  ];

  interface Props {
    value?: string | null;
    /** Replace the default roster wholesale. */
    roster?: FontEntry[];
    /** Append additional fonts to the default roster. */
    extra?: FontEntry[];
    disabled?: boolean;
    ariaLabel?: string;
    id?: string;
    onchange?: (next: string) => void;
  }

  let {
    value = $bindable(null),
    roster,
    extra = [],
    disabled = false,
    ariaLabel = "Font family",
    id,
    onchange,
  }: Props = $props();

  // Build the option list. If the current `value` doesn't match any
  // roster entry, prepend a synthetic "(current)" option so the
  // dropdown displays it as selected instead of going blank — common
  // case when a wire value carries a system font not in the curated
  // roster ("system-ui, -apple-system, …").
  const options = $derived.by(() => {
    const base = [...(roster ?? DEFAULT_ROSTER), ...extra];
    const opts = base.map((f) => ({
      value: f.value,
      label: f.label,
      style: `font-family: ${f.value}`,
    }));
    if (value && !base.some((f) => f.value === value)) {
      const first = value.split(",")[0].replace(/["']/g, "").trim();
      opts.unshift({
        value,
        label: first ? `${first} (current)` : "(current)",
        style: `font-family: ${value}`,
      });
    }
    return opts;
  });
</script>

<Dropdown
  bind:value
  {options}
  renderOptionStyle
  {disabled}
  {ariaLabel}
  {id}
  onchange={(v) => onchange?.(v as string)}
/>

// v2 editor primitives — designed from scratch on the ink-on-cream
// editorial aesthetic. Built on the ui-glyphs vocabulary; consume the
// design tokens in `tokens.css`.
//
// All components live under a host that has `data-tv-v2` set on
// itself or an ancestor. The popover root and the harness Host both
// set the attribute; the tokens.css cascade does the rest.
//
// Bold collapses vs v1:
// - Pill replaces Toggle + Segmented (boolean is the 2-segment case)
// - Knob replaces NumberInput + SliderValue (plain / scrub / track modes)
// - Field replaces FieldRow with override-dot gutter
// - Section + Accordion split the v1 AccordionSection responsibilities
//   (always-open vs collapsible) with a shared header anatomy

export { default as Pill }      from "./Pill.svelte";
export { default as Knob }      from "./Knob.svelte";
export { default as Field }     from "./Field.svelte";
export { default as Section }   from "./Section.svelte";
export { default as Accordion } from "./Accordion.svelte";
export { default as Picker }    from "./Picker.svelte";
export { default as Mode }      from "./Mode.svelte";

export type { PillSegment, PickerItem, MappedMode } from "./types";

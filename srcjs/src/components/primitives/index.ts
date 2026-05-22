// Editor primitives — compact, theme-token-driven controls. The
// schema-driven editor and the (eventual) settings-panel re-skin both
// import from here.

export { default as AccordionSection } from "./AccordionSection.svelte";
export { default as FieldRow } from "./FieldRow.svelte";
export { default as Toggle } from "./Toggle.svelte";
export { default as Segmented } from "./Segmented.svelte";
export { default as NumberInput } from "./NumberInput.svelte";
export { default as TextInput } from "./TextInput.svelte";
export { default as SliderValue } from "./SliderValue.svelte";
export { default as ColorChip } from "./ColorChip.svelte";
export { default as FieldSelect } from "./FieldSelect.svelte";

// Composite: full schema-driven editor body. Walks the schema's
// inheritance chain and stacks one accordion section per ancestor.
export { default as SchemaForm } from "./SchemaForm.svelte";

// Shared Tier-1 theme controls (settings-overhaul P1).
//
// ONE implementation per control, mounted by BOTH hosts (T1 decision):
//   - the widget settings panel (layout="compact")
//   - the studio rail (layout="roomy")
// Hosts own state plumbing: controls receive values + callbacks and never
// import a store. This is what makes the LayoutControl-mirror drift class
// impossible — there is no second implementation to drift.
//
// Dialect law (P1): every enum is an EnumRow (Field+Pill), every number a
// v2 Slider, every color an AnchorRow (swatch+hex, LCH on expand), every
// collapsed group a DisclosureField with a value summary. Disclosure
// depth ≤ 1 (T2 decision).

export { default as AnchorRow } from "./AnchorRow.svelte";
export { default as EnumRow } from "./EnumRow.svelte";

/** Host layout for the shared controls. */
export type ControlLayout = "compact" | "roomy";

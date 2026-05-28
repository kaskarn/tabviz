// Shared types for MappedValue.svelte. Svelte components can't export
// types from the `<script>` block; this sidecar file does.

/**
 * Discriminated state for a styling option that may be off, set to a
 * static value, or mapped to a data field.
 */
export type MappedState<T> =
  | { mode: "off" }
  | { mode: "static"; value: T }
  | { mode: "field"; field: string };

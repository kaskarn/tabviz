// Discriminated mapped-option state types (consumed by schema/initial-state).
// Survivor of the deleted primitives-v1 island (2026-06 dead-code pass).

/**
 * Discriminated state for a styling option that may be off, set to a
 * static value, or mapped to a data field.
 */
export type MappedState<T> =
  | { mode: "off" }
  | { mode: "static"; value: T }
  | { mode: "field"; field: string };

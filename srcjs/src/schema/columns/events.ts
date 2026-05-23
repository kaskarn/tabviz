// `events` — concrete column schema for "events/n" display with
// optional percent. Two data slots (events count + total). Inherits
// NUMERIC for thousandsSep / abbreviate. Wire bucket is "custom"
// (legacy — events shares the "custom" bucket today; future cleanup).

import type { ColumnSchema } from "../types";

export const EVENTS_SCHEMA: ColumnSchema = {
  key: "events",
  label: "Events",
  glyph: "type.events",
  defaultOpen: true,
  inherits: "numeric",
  type: "custom",
  bucket: "custom",
  category: "numeric",
  slots: [
    { key: "events", label: "Events", accepts: ["numeric", "integer"], required: true,
      autoPair: { suffixes: ["_events", "_e", "_x"] } },
    { key: "n",      label: "N",      accepts: ["numeric", "integer"], required: true,
      autoPair: { suffixes: ["_n", "_total"] } },
  ],
  optionOverrides: {
    header: "Events",
    thousandsSep: ",",
  },
  options: [
    {
      key: "separator",
      label: "Separator",
      control: "text",
      default: "/",
    },
    {
      key: "showPct",
      label: "Show percent",
      control: "toggle",
      default: false,
      hint: 'Append "(37.5%)" after the ratio',
    },
  ],
};

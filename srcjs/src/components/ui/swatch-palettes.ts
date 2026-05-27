// Curated role-specific palettes — rgc-design idiom. Each ColorField in
// the settings panel gets a small inline swatch row of plausible picks
// for its role. Authors can still type any hex; the swatches are the
// one-click shortcut.
//
// Single source so the Theme / Text / Viz / Tokens tabs all show the
// same palette per semantic role.

export interface PaletteSwatch {
  color: string;
  token: string;
}

export const PAPER_SWATCHES: PaletteSwatch[] = [
  { color: "#ffffff", token: "pure white" },
  { color: "#fafaf7", token: "cream" },
  { color: "#f4efe6", token: "newsprint" },
  { color: "#fbe4d6", token: "warm" },
  { color: "#e5efef", token: "cool" },
  { color: "#efe6cf", token: "parchment" },
  { color: "#0e1014", token: "dark" },
];

export const INK_SWATCHES: PaletteSwatch[] = [
  { color: "#0a0a0a", token: "near-black" },
  { color: "#1a1714", token: "warm ink" },
  { color: "#15212e", token: "navy ink" },
  { color: "#231312", token: "burgundy ink" },
  { color: "#4a463c", token: "soft ink" },
  { color: "#8a8478", token: "muted ink" },
  { color: "#e7e9ee", token: "paper (inverse)" },
];

export const ACCENT_SWATCHES: PaletteSwatch[] = [
  { color: "#8a2a1f", token: "oxblood" },
  { color: "#d83a1f", token: "vermilion" },
  { color: "#2a6f97", token: "teal" },
  { color: "#243a8a", token: "ultramarine" },
  { color: "#7ee787", token: "spring green" },
  { color: "#ff4a1c", token: "bright" },
  { color: "#b3392b", token: "brick" },
];

export const NEUTRAL_SWATCHES: PaletteSwatch[] = [
  { color: "#15140e", token: "ink" },
  { color: "#4a463c", token: "soft ink" },
  { color: "#8a8478", token: "muted" },
  { color: "#d6d0c1", token: "hairline" },
  { color: "#e6e0d1", token: "soft rule" },
  { color: "#faf7f0", token: "paper" },
];

export const STATUS_SWATCHES: PaletteSwatch[] = [
  { color: "#3F7D3F", token: "positive" },
  { color: "#B33A3A", token: "negative" },
  { color: "#C68A2E", token: "warning" },
  { color: "#2C4F7C", token: "info" },
  { color: "#5B6C7E", token: "muted" },
];

// Series anchors — Tableau-ish rotation. Used in the Viz tab for slot
// fills so authors can swap the per-series color with one click rather
// than typing a hex.
export const SERIES_SWATCHES: PaletteSwatch[] = [
  { color: "#1f77b4", token: "blue" },
  { color: "#ff7f0e", token: "orange" },
  { color: "#2ca02c", token: "green" },
  { color: "#d62728", token: "red" },
  { color: "#9467bd", token: "purple" },
  { color: "#8c564b", token: "brown" },
  { color: "#7f7f7f", token: "grey" },
];

// Plain helper: most ColorField call sites want a string[] not the
// {color, token} pair. Single place to flatten.
export const colors = (p: PaletteSwatch[]): string[] => p.map((s) => s.color);

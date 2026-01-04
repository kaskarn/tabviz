import type { WebTheme } from "$types";

// Theme preset names
export const THEME_NAMES = [
  "default",
  "minimal",
  "dark",
  "jama",
  "lancet",
  "modern",
  "presentation",
  "cochrane",
  "nature",
] as const;

export type ThemeName = (typeof THEME_NAMES)[number];

// Default theme values (from R/classes-theme.R)
const DEFAULT_THEME: WebTheme = {
  name: "default",
  colors: {
    background: "#ffffff",
    foreground: "#333333",
    primary: "#0891b2",     // Cyan-600: fresh, professional
    secondary: "#64748b",
    accent: "#8b5cf6",
    muted: "#94a3b8",
    border: "#e2e8f0",
    interval: "#0891b2",          // Unified marker color
    intervalPositive: "#0891b2",  // Match primary (deprecated)
    intervalNegative: "#dc2626",  // (deprecated)
    intervalNeutral: "#64748b",
    intervalLine: "#475569",
    summaryFill: "#0891b2",
    summaryBorder: "#0e7490",
  },
  typography: {
    fontFamily: "system-ui, -apple-system, sans-serif",
    fontSizeSm: "0.75rem",
    fontSizeBase: "0.875rem",
    fontSizeLg: "1rem",
    fontWeightNormal: 400,
    fontWeightMedium: 500,
    fontWeightBold: 600,
    lineHeight: 1.5,
  },
  spacing: {
    rowHeight: 28,
    headerHeight: 36,
    columnGap: 8,
    sectionGap: 16,
    padding: 12,
    cellPaddingX: 10,
    cellPaddingY: 4,
  },
  shapes: {
    pointSize: 6,
    summaryHeight: 10,
    lineWidth: 1.5,
    borderRadius: 2,  // Cleaner, more professional
  },
  axis: {
    rangeMin: null,
    rangeMax: null,
    tickCount: null,
    tickValues: null,
    gridlines: false,
    gridlineStyle: "dotted",
  },
  layout: {
    plotPosition: "right",
    tableWidth: "auto",
    plotWidth: "auto",
    rowBorder: true,
    rowBorderStyle: "solid",
    containerBorder: true,
    containerBorderRadius: 8,
  },
};

// Minimal/Publication theme - black & white, serif
const MINIMAL_THEME: WebTheme = {
  ...DEFAULT_THEME,
  name: "minimal",
  colors: {
    ...DEFAULT_THEME.colors,
    background: "#ffffff",
    foreground: "#000000",
    primary: "#000000",
    secondary: "#333333",
    muted: "#666666",
    border: "#cccccc",
    interval: "#333333",
    intervalPositive: "#333333",
    intervalNegative: "#333333",
    intervalNeutral: "#666666",
    intervalLine: "#000000",
    summaryFill: "#000000",
    summaryBorder: "#000000",
  },
  typography: {
    ...DEFAULT_THEME.typography,
    fontFamily: "'Times New Roman', Times, serif",
  },
};

// Dark theme - Catppuccin-inspired
const DARK_THEME: WebTheme = {
  ...DEFAULT_THEME,
  name: "dark",
  colors: {
    ...DEFAULT_THEME.colors,
    background: "#1e1e2e",
    foreground: "#cdd6f4",
    primary: "#89b4fa",
    secondary: "#a6adc8",
    accent: "#cba6f7",
    muted: "#6c7086",
    border: "#45475a",
    interval: "#89b4fa",
    intervalPositive: "#a6e3a1",
    intervalNegative: "#f38ba8",
    intervalNeutral: "#6c7086",
    intervalLine: "#bac2de",
    summaryFill: "#89b4fa",
    summaryBorder: "#74c7ec",
  },
};

// JAMA theme - dense, publication-ready
const JAMA_THEME: WebTheme = {
  ...DEFAULT_THEME,
  name: "jama",
  colors: {
    ...DEFAULT_THEME.colors,
    background: "#ffffff",
    foreground: "#000000",
    primary: "#000000",
    secondary: "#333333",
    accent: "#000000",
    muted: "#666666",
    border: "#000000",
    interval: "#000000",
    intervalPositive: "#000000",
    intervalNegative: "#000000",
    intervalNeutral: "#000000",
    intervalLine: "#000000",
    summaryFill: "#000000",
    summaryBorder: "#000000",
  },
  typography: {
    ...DEFAULT_THEME.typography,
    fontFamily: "Arial, Helvetica, sans-serif",
    fontSizeSm: "9pt",
    fontSizeBase: "10pt",
    fontSizeLg: "11pt",
    fontWeightNormal: 400,
    fontWeightMedium: 500,
    fontWeightBold: 700,
    lineHeight: 1.3,
  },
  spacing: {
    ...DEFAULT_THEME.spacing,
    rowHeight: 20,
    headerHeight: 26,
    columnGap: 6,
    sectionGap: 12,
    padding: 8,
  },
  shapes: {
    ...DEFAULT_THEME.shapes,
    pointSize: 5,
    summaryHeight: 8,
    lineWidth: 1,
    borderRadius: 0,
  },
};

// Lancet theme - medical journal blue/crimson
const LANCET_THEME: WebTheme = {
  ...DEFAULT_THEME,
  name: "lancet",
  colors: {
    ...DEFAULT_THEME.colors,
    background: "#ffffff",
    foreground: "#00407a",
    primary: "#00407a",
    secondary: "#446e9b",
    accent: "#c4161c",
    muted: "#7a99ac",
    border: "#ccd6dd",
    interval: "#00407a",
    intervalPositive: "#00407a",
    intervalNegative: "#c4161c",
    intervalNeutral: "#446e9b",
    intervalLine: "#00407a",
    summaryFill: "#00407a",
    summaryBorder: "#002d54",
  },
  typography: {
    ...DEFAULT_THEME.typography,
    fontFamily: "Georgia, 'Times New Roman', serif",
    fontSizeSm: "0.75rem",
    fontSizeBase: "0.875rem",
    fontSizeLg: "1rem",
    fontWeightNormal: 400,
    fontWeightMedium: 500,
    fontWeightBold: 700,
    lineHeight: 1.4,
  },
  spacing: {
    ...DEFAULT_THEME.spacing,
    rowHeight: 24,
    headerHeight: 32,
    columnGap: 8,
    sectionGap: 14,
    padding: 10,
  },
  shapes: {
    ...DEFAULT_THEME.shapes,
    pointSize: 5,
    summaryHeight: 9,
    lineWidth: 1.25,
    borderRadius: 0,
  },
};

// Modern theme - clean, contemporary
const MODERN_THEME: WebTheme = {
  ...DEFAULT_THEME,
  name: "modern",
  colors: {
    ...DEFAULT_THEME.colors,
    background: "#fafafa",
    foreground: "#18181b",
    primary: "#2563eb",
    secondary: "#52525b",
    accent: "#7c3aed",
    muted: "#a1a1aa",
    border: "#e4e4e7",
    interval: "#2563eb",
    intervalPositive: "#16a34a",
    intervalNegative: "#dc2626",
    intervalNeutral: "#71717a",
    intervalLine: "#3f3f46",
    summaryFill: "#2563eb",
    summaryBorder: "#1d4ed8",
  },
  typography: {
    ...DEFAULT_THEME.typography,
    fontFamily: "Inter, system-ui, -apple-system, sans-serif",
    fontSizeSm: "0.75rem",
    fontSizeBase: "0.875rem",
    fontSizeLg: "1rem",
    fontWeightNormal: 400,
    fontWeightMedium: 500,
    fontWeightBold: 600,
    lineHeight: 1.5,
  },
  spacing: {
    ...DEFAULT_THEME.spacing,
    rowHeight: 32,
    headerHeight: 40,
    columnGap: 10,
    sectionGap: 20,
    padding: 14,
  },
  shapes: {
    ...DEFAULT_THEME.shapes,
    pointSize: 7,
    summaryHeight: 11,
    lineWidth: 1.5,
    borderRadius: 6,
  },
};

// Presentation theme - large, bold
const PRESENTATION_THEME: WebTheme = {
  ...DEFAULT_THEME,
  name: "presentation",
  colors: {
    ...DEFAULT_THEME.colors,
    background: "#ffffff",
    foreground: "#0f172a",
    primary: "#0284c7",
    secondary: "#475569",
    accent: "#f59e0b",
    muted: "#94a3b8",
    border: "#cbd5e1",
    interval: "#0284c7",
    intervalPositive: "#059669",
    intervalNegative: "#e11d48",
    intervalNeutral: "#475569",
    intervalLine: "#1e293b",
    summaryFill: "#0284c7",
    summaryBorder: "#0369a1",
  },
  typography: {
    ...DEFAULT_THEME.typography,
    fontFamily: "'Source Sans Pro', 'Segoe UI', Roboto, sans-serif",
    fontSizeSm: "0.875rem",
    fontSizeBase: "1rem",
    fontSizeLg: "1.125rem",
    fontWeightNormal: 400,
    fontWeightMedium: 600,
    fontWeightBold: 700,
    lineHeight: 1.4,
  },
  spacing: {
    ...DEFAULT_THEME.spacing,
    rowHeight: 40,
    headerHeight: 48,
    columnGap: 12,
    sectionGap: 24,
    padding: 16,
  },
  shapes: {
    ...DEFAULT_THEME.shapes,
    pointSize: 10,
    summaryHeight: 14,
    lineWidth: 2,
    borderRadius: 4,
  },
};

// Cochrane systematic review theme
const COCHRANE_THEME: WebTheme = {
  ...DEFAULT_THEME,
  name: "cochrane",
  colors: {
    ...DEFAULT_THEME.colors,
    background: "#ffffff",
    foreground: "#333333",
    primary: "#0099cc",
    secondary: "#666666",
    accent: "#0066cc",
    muted: "#999999",
    border: "#cccccc",
    interval: "#0099cc",
    intervalPositive: "#0099cc",
    intervalNegative: "#cc3333",
    intervalNeutral: "#666666",
    intervalLine: "#333333",
    summaryFill: "#0099cc",
    summaryBorder: "#007799",
  },
  typography: {
    ...DEFAULT_THEME.typography,
    fontFamily: "Arial, Helvetica, sans-serif",
    fontSizeSm: "0.7rem",
    fontSizeBase: "0.8rem",
    fontSizeLg: "0.9rem",
    fontWeightNormal: 400,
    fontWeightMedium: 500,
    fontWeightBold: 700,
    lineHeight: 1.3,
  },
  spacing: {
    ...DEFAULT_THEME.spacing,
    rowHeight: 22,
    headerHeight: 28,
    columnGap: 6,
    sectionGap: 10,
    padding: 8,
  },
  shapes: {
    ...DEFAULT_THEME.shapes,
    pointSize: 5,
    summaryHeight: 8,
    lineWidth: 1,
    borderRadius: 0,
  },
  layout: {
    ...DEFAULT_THEME.layout,
    containerBorder: false,
    containerBorderRadius: 0,
  },
};

// Nature journal theme
const NATURE_THEME: WebTheme = {
  ...DEFAULT_THEME,
  name: "nature",
  colors: {
    ...DEFAULT_THEME.colors,
    background: "#ffffff",
    foreground: "#212121",
    primary: "#1976d2",
    secondary: "#424242",
    accent: "#d32f2f",
    muted: "#757575",
    border: "#e0e0e0",
    interval: "#1976d2",
    intervalPositive: "#1976d2",
    intervalNegative: "#d32f2f",
    intervalNeutral: "#616161",
    intervalLine: "#212121",
    summaryFill: "#1976d2",
    summaryBorder: "#1565c0",
  },
  typography: {
    ...DEFAULT_THEME.typography,
    fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif",
    fontSizeSm: "0.75rem",
    fontSizeBase: "0.875rem",
    fontSizeLg: "1rem",
    fontWeightNormal: 400,
    fontWeightMedium: 500,
    fontWeightBold: 700,
    lineHeight: 1.4,
  },
  spacing: {
    ...DEFAULT_THEME.spacing,
    rowHeight: 26,
    headerHeight: 34,
    columnGap: 8,
    sectionGap: 14,
    padding: 10,
  },
  shapes: {
    ...DEFAULT_THEME.shapes,
    pointSize: 6,
    summaryHeight: 9,
    lineWidth: 1.25,
    borderRadius: 2,
  },
  layout: {
    ...DEFAULT_THEME.layout,
    containerBorder: true,
    containerBorderRadius: 2,
  },
};

// Export all theme presets
export const THEME_PRESETS: Record<ThemeName, WebTheme> = {
  default: DEFAULT_THEME,
  minimal: MINIMAL_THEME,
  dark: DARK_THEME,
  jama: JAMA_THEME,
  lancet: LANCET_THEME,
  modern: MODERN_THEME,
  presentation: PRESENTATION_THEME,
  cochrane: COCHRANE_THEME,
  nature: NATURE_THEME,
};

// Human-readable theme labels for UI
export const THEME_LABELS: Record<ThemeName, string> = {
  default: "Default",
  minimal: "Minimal",
  dark: "Dark",
  jama: "JAMA",
  lancet: "Lancet",
  modern: "Modern",
  presentation: "Presentation",
  cochrane: "Cochrane",
  nature: "Nature",
};

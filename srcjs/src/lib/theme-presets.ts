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
    sectionGap: 16,
    padding: 12,
    containerPadding: 0,
    cellPaddingX: 10,
    cellPaddingY: 4,
    axisGap: 12,
    groupPadding: 8,
  },
  shapes: {
    pointSize: 6,
    summaryHeight: 10,
    lineWidth: 1.5,
    borderRadius: 2,  // Cleaner, more professional
  },
  axis: {
    // Explicit overrides (null = auto)
    rangeMin: null,
    rangeMax: null,
    tickCount: null,
    tickValues: null,
    gridlines: false,
    gridlineStyle: "dotted",
    // Auto-scaling parameters
    padding: 0.15,                  // 15% padding on each side
    ciTruncationThreshold: 3.0,     // Include CIs within 3× estimate range before truncating
    includeNull: true,              // Always include null in range
    symmetric: null,                // null = auto (symmetric if effects on both sides)
    nullTick: true,                 // Always show tick at null value
    markerMargin: true,             // Add marker padding at edges
  },
  layout: {
    plotPosition: "right",
    tableWidth: "auto",
    plotWidth: "auto",
    rowBorder: true,
    rowBorderStyle: "solid",
    containerBorder: false,
    containerBorderRadius: 8,
  },
  groupHeaders: {
    level1FontSize: "1rem",
    level1FontWeight: 700,
    level1Italic: false,
    level1Background: null,  // Computed from primary at 15% opacity
    level1BorderBottom: false,
    level2FontSize: "0.9375rem",
    level2FontWeight: 500,
    level2Italic: true,
    level2Background: null,  // Computed from primary at 10% opacity
    level2BorderBottom: false,
    level3FontSize: "0.875rem",
    level3FontWeight: 400,
    level3Italic: false,
    level3Background: null,  // Computed from primary at 6% opacity
    level3BorderBottom: false,
    indentPerLevel: 16,
  },
};

// Minimal/Publication theme - academic B&W, serif, sharp corners
const MINIMAL_THEME: WebTheme = {
  ...DEFAULT_THEME,
  name: "minimal",
  colors: {
    ...DEFAULT_THEME.colors,
    background: "#ffffff",
    foreground: "#000000",
    primary: "#000000",
    secondary: "#333333",
    accent: "#000000",
    muted: "#666666",
    border: "#000000",           // Strong black borders
    interval: "#000000",         // Pure black markers
    intervalPositive: "#000000",
    intervalNegative: "#000000",
    intervalNeutral: "#666666",
    intervalLine: "#000000",
    summaryFill: "#000000",
    summaryBorder: "#000000",
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
    headerHeight: 30,
    sectionGap: 12,
    padding: 10,
  },
  shapes: {
    ...DEFAULT_THEME.shapes,
    pointSize: 5,
    summaryHeight: 8,
    lineWidth: 1,
    borderRadius: 0,             // Sharp corners
  },
  layout: {
    ...DEFAULT_THEME.layout,
    rowBorder: true,
    rowBorderStyle: "solid",
    containerBorder: false,
    containerBorderRadius: 0,    // No rounded corners
  },
};

// Dark theme - Catppuccin Mocha inspired, comfortable night viewing
const DARK_THEME: WebTheme = {
  ...DEFAULT_THEME,
  name: "dark",
  colors: {
    ...DEFAULT_THEME.colors,
    background: "#1e1e2e",         // Catppuccin base
    foreground: "#cdd6f4",         // Catppuccin text
    primary: "#89b4fa",            // Catppuccin blue
    secondary: "#a6adc8",          // Catppuccin subtext0
    accent: "#f5c2e7",             // Catppuccin pink
    muted: "#6c7086",              // Catppuccin overlay0
    border: "#313244",             // Catppuccin surface0
    interval: "#89b4fa",           // Catppuccin blue
    intervalPositive: "#a6e3a1",   // Catppuccin green
    intervalNegative: "#f38ba8",   // Catppuccin red
    intervalNeutral: "#6c7086",
    intervalLine: "#9399b2",       // Catppuccin overlay2
    summaryFill: "#89b4fa",
    summaryBorder: "#74c7ec",      // Catppuccin sapphire
  },
  typography: {
    ...DEFAULT_THEME.typography,
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
    ...DEFAULT_THEME.spacing,
    rowHeight: 30,                 // Slightly taller for comfort
    headerHeight: 38,
    sectionGap: 18,
    padding: 14,
  },
  shapes: {
    ...DEFAULT_THEME.shapes,
    pointSize: 6,
    summaryHeight: 10,
    lineWidth: 1.5,
    borderRadius: 4,               // Soft rounded corners
  },
  layout: {
    ...DEFAULT_THEME.layout,
    rowBorder: true,
    rowBorderStyle: "solid",
    containerBorder: false,
    containerBorderRadius: 8,
  },
};

// JAMA theme - maximum density, medical journal print-ready
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
    muted: "#555555",
    border: "#000000",             // Pure black borders
    interval: "#000000",           // Pure black markers
    intervalPositive: "#000000",
    intervalNegative: "#000000",
    intervalNeutral: "#555555",
    intervalLine: "#000000",
    summaryFill: "#000000",
    summaryBorder: "#000000",
  },
  typography: {
    ...DEFAULT_THEME.typography,
    fontFamily: "Arial, Helvetica, sans-serif",
    fontSizeSm: "8pt",             // Smaller for density
    fontSizeBase: "9pt",           // Compact base
    fontSizeLg: "10pt",
    fontWeightNormal: 400,
    fontWeightMedium: 500,
    fontWeightBold: 700,
    lineHeight: 1.2,               // Tight line height
  },
  spacing: {
    ...DEFAULT_THEME.spacing,
    rowHeight: 18,                 // Very compact rows
    headerHeight: 24,
    sectionGap: 8,
    padding: 6,
    cellPaddingX: 8,               // Tighter cell padding
    cellPaddingY: 2,
  },
  shapes: {
    ...DEFAULT_THEME.shapes,
    pointSize: 4,                  // Small markers
    summaryHeight: 7,
    lineWidth: 1.25,               // Slightly thicker for visibility
    borderRadius: 0,
  },
  layout: {
    ...DEFAULT_THEME.layout,
    rowBorder: true,
    rowBorderStyle: "solid",
    containerBorder: false,
    containerBorderRadius: 0,      // Sharp corners
  },
};

// Lancet theme - elegant academic with navy blue and warm gold
const LANCET_THEME: WebTheme = {
  ...DEFAULT_THEME,
  name: "lancet",
  colors: {
    ...DEFAULT_THEME.colors,
    background: "#fdfcfb",           // Warm off-white
    foreground: "#1e3a5f",           // Deep navy
    primary: "#00407a",              // Lancet blue
    secondary: "#3d5a80",            // Slate blue
    accent: "#b8860b",               // Dark goldenrod
    muted: "#6b7c93",
    border: "#d4dce6",
    interval: "#00407a",
    intervalPositive: "#00407a",
    intervalNegative: "#9d2933",     // Deep crimson
    intervalNeutral: "#3d5a80",
    intervalLine: "#1e3a5f",
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
    lineHeight: 1.5,                 // More generous
  },
  spacing: {
    ...DEFAULT_THEME.spacing,
    rowHeight: 26,                   // Slightly taller
    headerHeight: 34,
    sectionGap: 16,
    padding: 12,
    cellPaddingX: 12,                // More breathing room
    cellPaddingY: 5,
  },
  shapes: {
    ...DEFAULT_THEME.shapes,
    pointSize: 5,
    summaryHeight: 9,
    lineWidth: 1.25,
    borderRadius: 0,                 // Sharp corners for academic feel
  },
  layout: {
    ...DEFAULT_THEME.layout,
    rowBorder: true,
    rowBorderStyle: "solid",
    containerBorder: false,
    containerBorderRadius: 0,        // No rounded corners
  },
};

// Modern theme - bold, vibrant, generous spacing
const MODERN_THEME: WebTheme = {
  ...DEFAULT_THEME,
  name: "modern",
  colors: {
    ...DEFAULT_THEME.colors,
    background: "#fafafa",
    foreground: "#18181b",
    primary: "#3b82f6",              // Blue-500 - more vibrant
    secondary: "#52525b",
    accent: "#8b5cf6",               // Violet-500
    muted: "#a1a1aa",
    border: "#d4d4d8",               // Slightly more visible
    interval: "#3b82f6",
    intervalPositive: "#22c55e",     // Green-500
    intervalNegative: "#ef4444",     // Red-500
    intervalNeutral: "#71717a",
    intervalLine: "#27272a",         // Darker for contrast
    summaryFill: "#3b82f6",
    summaryBorder: "#2563eb",        // Blue-600
  },
  typography: {
    ...DEFAULT_THEME.typography,
    fontFamily: "Inter, system-ui, -apple-system, sans-serif",
    fontSizeSm: "0.8125rem",         // Slightly larger
    fontSizeBase: "0.9375rem",       // 15px
    fontSizeLg: "1.0625rem",         // 17px
    fontWeightNormal: 400,
    fontWeightMedium: 500,
    fontWeightBold: 600,
    lineHeight: 1.5,
  },
  spacing: {
    ...DEFAULT_THEME.spacing,
    rowHeight: 36,                   // Taller rows
    headerHeight: 44,
    sectionGap: 24,
    padding: 16,
    cellPaddingX: 12,
    cellPaddingY: 6,
  },
  shapes: {
    ...DEFAULT_THEME.shapes,
    pointSize: 8,                    // Larger markers
    summaryHeight: 12,
    lineWidth: 1.75,
    borderRadius: 8,                 // More rounded
  },
  layout: {
    ...DEFAULT_THEME.layout,
    rowBorder: true,
    rowBorderStyle: "solid",
    containerBorder: false,
    containerBorderRadius: 12,       // Prominent rounded corners
  },
};

// Presentation theme - oversized for slides and posters
const PRESENTATION_THEME: WebTheme = {
  ...DEFAULT_THEME,
  name: "presentation",
  colors: {
    ...DEFAULT_THEME.colors,
    background: "#ffffff",
    foreground: "#0f172a",
    primary: "#0369a1",              // Deeper sky blue
    secondary: "#334155",            // Darker slate
    accent: "#ea580c",               // Orange-600 for emphasis
    muted: "#64748b",
    border: "#94a3b8",               // More visible borders
    interval: "#0369a1",
    intervalPositive: "#047857",     // Emerald-700
    intervalNegative: "#be123c",     // Rose-700
    intervalNeutral: "#334155",
    intervalLine: "#0f172a",         // Very dark for visibility
    summaryFill: "#0369a1",
    summaryBorder: "#0c4a6e",        // Darker outline
  },
  typography: {
    ...DEFAULT_THEME.typography,
    fontFamily: "'Source Sans Pro', 'Segoe UI', Roboto, sans-serif",
    fontSizeSm: "1rem",              // Larger small text
    fontSizeBase: "1.125rem",        // Larger base
    fontSizeLg: "1.25rem",           // Larger headings
    fontWeightNormal: 400,
    fontWeightMedium: 600,
    fontWeightBold: 700,
    lineHeight: 1.4,
  },
  spacing: {
    ...DEFAULT_THEME.spacing,
    rowHeight: 44,                   // Extra tall rows
    headerHeight: 52,                // Extra tall headers
    sectionGap: 28,
    padding: 20,
    cellPaddingX: 14,                // More cell padding
    cellPaddingY: 6,
  },
  shapes: {
    ...DEFAULT_THEME.shapes,
    pointSize: 12,                   // Oversized markers
    summaryHeight: 16,               // Larger diamonds
    lineWidth: 2.5,                  // Thick lines
    borderRadius: 4,
  },
  layout: {
    ...DEFAULT_THEME.layout,
    rowBorder: true,
    containerBorder: false,
    containerBorderRadius: 6,
  },
};

// Cochrane systematic review theme - compact, utilitarian
const COCHRANE_THEME: WebTheme = {
  ...DEFAULT_THEME,
  name: "cochrane",
  colors: {
    ...DEFAULT_THEME.colors,
    background: "#ffffff",
    foreground: "#2c2c2c",
    primary: "#0099cc",              // Cochrane teal
    secondary: "#555555",
    accent: "#006699",               // Darker teal for accents
    muted: "#888888",
    border: "#b3b3b3",
    interval: "#0099cc",
    intervalPositive: "#0099cc",
    intervalNegative: "#cc3333",
    intervalNeutral: "#555555",
    intervalLine: "#2c2c2c",
    summaryFill: "#0099cc",
    summaryBorder: "#006699",
  },
  typography: {
    ...DEFAULT_THEME.typography,
    fontFamily: "Arial, Helvetica, sans-serif",
    fontSizeSm: "0.6875rem",         // 11px - very compact
    fontSizeBase: "0.75rem",         // 12px
    fontSizeLg: "0.8125rem",         // 13px
    fontWeightNormal: 400,
    fontWeightMedium: 500,
    fontWeightBold: 700,
    lineHeight: 1.25,
  },
  spacing: {
    ...DEFAULT_THEME.spacing,
    rowHeight: 20,                   // Compact
    headerHeight: 26,
    sectionGap: 8,
    padding: 6,
    cellPaddingX: 6,
    cellPaddingY: 2,
  },
  shapes: {
    ...DEFAULT_THEME.shapes,
    pointSize: 4,                    // Small markers
    summaryHeight: 7,
    lineWidth: 1,
    borderRadius: 0,
  },
  layout: {
    ...DEFAULT_THEME.layout,
    rowBorder: true,
    rowBorderStyle: "solid",
    containerBorder: false,          // No outer border (Cochrane style)
    containerBorderRadius: 0,
  },
};

// Nature journal theme - precise, refined scientific prestige
const NATURE_THEME: WebTheme = {
  ...DEFAULT_THEME,
  name: "nature",
  colors: {
    ...DEFAULT_THEME.colors,
    background: "#ffffff",
    foreground: "#1a1a1a",           // Slightly darker for precision
    primary: "#1976d2",              // Nature blue
    secondary: "#424242",
    accent: "#c62828",               // Refined red
    muted: "#616161",
    border: "#bdbdbd",               // Slightly stronger border
    interval: "#1976d2",
    intervalPositive: "#1976d2",
    intervalNegative: "#c62828",
    intervalNeutral: "#616161",
    intervalLine: "#1a1a1a",
    summaryFill: "#1976d2",
    summaryBorder: "#0d47a1",        // Darker blue border
  },
  typography: {
    ...DEFAULT_THEME.typography,
    fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif",
    fontSizeSm: "0.75rem",
    fontSizeBase: "0.8125rem",       // Slightly smaller base
    fontSizeLg: "0.9375rem",
    fontWeightNormal: 400,
    fontWeightMedium: 500,
    fontWeightBold: 700,
    lineHeight: 1.35,                // Tighter line height
  },
  spacing: {
    ...DEFAULT_THEME.spacing,
    rowHeight: 24,                   // Slightly more compact
    headerHeight: 32,
    sectionGap: 12,
    padding: 10,
    cellPaddingX: 10,
    cellPaddingY: 4,
  },
  shapes: {
    ...DEFAULT_THEME.shapes,
    pointSize: 5,
    summaryHeight: 8,
    lineWidth: 1.25,
    borderRadius: 1,                 // Almost sharp corners
  },
  layout: {
    ...DEFAULT_THEME.layout,
    rowBorder: true,
    rowBorderStyle: "solid",
    containerBorder: false,
    containerBorderRadius: 2,        // Minimal rounding
  },
  axis: {
    ...DEFAULT_THEME.axis,
    gridlines: false,                // Clean axis
    nullTick: true,
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

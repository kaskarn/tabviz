import type { WebTheme, ColorPalette, Typography, Spacing, Shapes } from "$types";

export const defaultColors: ColorPalette = {
  background: "#ffffff",
  foreground: "#1a1a1a",
  primary: "#2563eb",
  secondary: "#64748b",
  accent: "#8b5cf6",
  muted: "#94a3b8",
  border: "#e2e8f0",
  intervalPositive: "#16a34a",
  intervalNegative: "#dc2626",
  intervalNeutral: "#64748b",
  intervalLine: "#475569",
  summaryFill: "#2563eb",
  summaryBorder: "#1d4ed8",
};

export const defaultTypography: Typography = {
  fontFamily: "system-ui, -apple-system, sans-serif",
  fontSizeSm: "0.75rem",
  fontSizeBase: "0.875rem",
  fontSizeLg: "1rem",
  fontWeightNormal: 400,
  fontWeightMedium: 500,
  fontWeightBold: 600,
  lineHeight: 1.5,
};

export const defaultSpacing: Spacing = {
  rowHeight: 28,
  headerHeight: 36,
  columnGap: 0, // No gap - borders connect directly
  sectionGap: 16,
  padding: 12,
};

export const defaultShapes: Shapes = {
  pointSize: 6,
  summaryHeight: 10,
  lineWidth: 1.5,
  borderRadius: 4,
};

export const defaultTheme: WebTheme = {
  name: "default",
  colors: defaultColors,
  typography: defaultTypography,
  spacing: defaultSpacing,
  shapes: defaultShapes,
};

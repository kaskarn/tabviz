import type { WebTheme, ColorPalette, Typography, Spacing, Shapes } from "$types";

export const defaultColors: ColorPalette = {
  background: "#ffffff",
  foreground: "#1a1a1a",
  primary: "#2563eb",
  secondary: "#64748b",
  accent: "#8b5cf6",
  muted: "#94a3b8",
  border: "#e2e8f0",
  rowBg: "#ffffff",
  altBg: "#f8fafc",
  interval: "#2563eb",
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
  headerFontScale: 1.0,
};

export const defaultSpacing: Spacing = {
  rowHeight: 28,
  headerHeight: 36,
  padding: 12,
  containerPadding: 0,
  cellPaddingX: 8,
  cellPaddingY: 4,
  axisGap: 12,
  groupPadding: 8,
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
  axis: {
    rangeMin: null,
    rangeMax: null,
    tickCount: null,
    tickValues: null,
    gridlines: true,
    gridlineStyle: "solid",
    ciClipFactor: 2.0,
    includeNull: true,
    symmetric: null,
    nullTick: true,
    markerMargin: true,
  },
  layout: {
    plotWidth: "auto",
    containerBorder: false,
    containerBorderRadius: 4,
    banding: true,
  },
  groupHeaders: {
    level1FontSize: "0.875rem",
    level1FontWeight: 600,
    level1Italic: false,
    level1Background: null,
    level1BorderBottom: true,
    level2FontSize: "0.8125rem",
    level2FontWeight: 500,
    level2Italic: false,
    level2Background: null,
    level2BorderBottom: false,
    level3FontSize: "0.8rem",
    level3FontWeight: 400,
    level3Italic: true,
    level3Background: null,
    level3BorderBottom: false,
    indentPerLevel: 16,
  },
};

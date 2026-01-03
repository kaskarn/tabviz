// Core types for webforest
// Generic table + interval visualization

// ============================================================================
// Data Types
// ============================================================================

export interface RowStyle {
  type?: "data" | "header" | "summary" | "spacer";
  bold?: boolean;
  italic?: boolean;
  color?: string | null;
  bg?: string | null;
  indent?: number;
  icon?: string | null;
  badge?: string | null;
}

// Per-cell styling (subset of RowStyle applicable to individual cells)
export interface CellStyle {
  bold?: boolean;
  italic?: boolean;
  color?: string | null;
  bg?: string | null;
  badge?: string | null;
  icon?: string | null;
}

// Maps style properties to column names containing values
export interface StyleMapping {
  bold?: string;
  italic?: string;
  color?: string;
  bg?: string;
  badge?: string;
  icon?: string;
}

export interface Row {
  id: string;
  label: string;
  point: number;
  lower: number;
  upper: number;
  groupId?: string | null;
  metadata: Record<string, unknown>;
  style?: RowStyle;
  // Per-cell styles keyed by column field name
  cellStyles?: Record<string, CellStyle>;
}

export interface Group {
  id: string;
  label: string;
  collapsed: boolean;
  parentId?: string | null;
  depth: number;
}

export interface GroupSummary {
  groupId: string;
  point: number;
  lower: number;
  upper: number;
  metadata: Record<string, unknown>;
}

export interface OverallSummary {
  point: number;
  lower: number;
  upper: number;
  metadata: Record<string, unknown>;
}

export interface EffectSpec {
  id: string;
  pointCol: string;
  lowerCol: string;
  upperCol: string;
  label?: string | null;
  color?: string | null;
}

export interface WebData {
  rows: Row[];
  groups: Group[];
  summaries: GroupSummary[];
  overall?: OverallSummary | null;
  pointCol: string;
  lowerCol: string;
  upperCol: string;
  labelCol?: string | null;
  labelHeader?: string | null;
  groupCol?: string | null;
  weightCol?: string | null;
  scale: "linear" | "log";
  nullValue: number;
  axisLabel: string;
  effects: EffectSpec[];
  includeForest: boolean;
}

// ============================================================================
// Column Types
// ============================================================================

export interface NumericColumnOptions {
  decimals?: number;  // Number of decimal places (default: 2)
}

export interface PercentColumnOptions {
  decimals?: number;  // Decimal places (default: 1)
  multiply?: boolean; // Multiply by 100 if value is proportion (default: false)
  symbol?: boolean;   // Show % symbol (default: true)
}

export interface EventsColumnOptions {
  eventsField: string;  // Column name for event count
  nField: string;       // Column name for total N
  separator?: string;   // Separator between events and N (default: "/")
  showPct?: boolean;    // Show percentage after (default: false)
}

export interface BarColumnOptions {
  maxValue?: number | null;
  showLabel?: boolean;
  color?: string | null;
}

export interface PvalueColumnOptions {
  stars?: boolean;
  thresholds?: [number, number, number]; // e.g., [0.05, 0.01, 0.001]
  format?: "scientific" | "decimal" | "auto";
}

export interface SparklineColumnOptions {
  type?: "line" | "bar" | "area";
  height?: number;
  color?: string | null;
}

export interface ColumnOptions {
  numeric?: NumericColumnOptions;
  percent?: PercentColumnOptions;
  events?: EventsColumnOptions;
  bar?: BarColumnOptions;
  pvalue?: PvalueColumnOptions;
  sparkline?: SparklineColumnOptions;
  naText?: string;  // Custom text for NA/missing values
}

export interface ColumnSpec {
  id: string;
  header: string;
  field: string;
  type: "text" | "numeric" | "interval" | "bar" | "pvalue" | "sparkline" | "custom";
  width?: number | "auto" | null;  // "auto" for content-based width calculation
  align: "left" | "center" | "right";
  headerAlign?: "left" | "center" | "right" | null;  // Header alignment (defaults to align if not specified)
  wrap?: boolean;  // Enable text wrapping (default false)
  position: "left" | "right";
  sortable: boolean;
  options?: ColumnOptions;
  isGroup: false;
  // Style mapping: column names containing per-cell style values
  styleMapping?: StyleMapping;
}

export interface ColumnGroup {
  id: string;
  header: string;
  isGroup: true;
  position: "left" | "right";
  columns: ColumnDef[];
}

export type ColumnDef = ColumnSpec | ColumnGroup;

// ============================================================================
// Theme Types
// ============================================================================

export interface ColorPalette {
  background: string;
  foreground: string;
  primary: string;
  secondary: string;
  accent: string;
  muted: string;
  border: string;
  intervalPositive: string;
  intervalNegative: string;
  intervalNeutral: string;
  intervalLine: string;
  summaryFill: string;
  summaryBorder: string;
}

export interface Typography {
  fontFamily: string;
  fontSizeSm: string;
  fontSizeBase: string;
  fontSizeLg: string;
  fontWeightNormal: number;
  fontWeightMedium: number;
  fontWeightBold: number;
  lineHeight: number;
}

export interface Spacing {
  rowHeight: number;
  headerHeight: number;
  columnGap: number;
  sectionGap: number;
  padding: number;
  cellPaddingX: number;
  cellPaddingY: number;
}

export interface Shapes {
  pointSize: number;
  summaryHeight: number;
  lineWidth: number;
  borderRadius: number;
}

export interface AxisConfig {
  rangeMin: number | null;
  rangeMax: number | null;
  tickCount: number | null;
  tickValues: number[] | null;
  gridlines: boolean;
  gridlineStyle: "solid" | "dashed" | "dotted";
}

export interface LayoutConfig {
  plotPosition: "left" | "right";
  tableWidth: number | "auto";
  plotWidth: number | "auto";
  rowBorder: boolean;
  rowBorderStyle: "solid" | "dashed" | "dotted";
  containerBorder: boolean;
  containerBorderRadius: number;
}

export interface WebTheme {
  name: string;
  colors: ColorPalette;
  typography: Typography;
  spacing: Spacing;
  shapes: Shapes;
  axis: AxisConfig;
  layout: LayoutConfig;
}

// ============================================================================
// Interaction Types
// ============================================================================

export interface InteractionSpec {
  showFilters: boolean;
  showLegend: boolean;
  enableSort: boolean;
  enableCollapse: boolean;
  enableSelect: boolean;
  enableHover: boolean;
  enableResize: boolean;
  enableExport?: boolean;
  tooltipFields?: string[] | null;  // Column names to show in hover tooltip (opt-in)
}

export interface LayoutSpec {
  plotPosition: "right" | "left";
  tableWidth: number | "auto";
  plotWidth: number | "auto";
}

// ============================================================================
// Plot Labels (titles, subtitles, captions, footnotes)
// ============================================================================

export interface PlotLabels {
  title?: string | null;
  subtitle?: string | null;
  caption?: string | null;
  footnote?: string | null;
}

// ============================================================================
// Main Spec (what R sends to JS)
// ============================================================================

export interface WebSpec {
  data: WebData;
  columns: ColumnDef[];
  annotations: Annotation[];
  theme: WebTheme;
  interaction: InteractionSpec;
  layout: LayoutSpec;
  labels?: PlotLabels;
}

// ============================================================================
// Annotation Types (future)
// ============================================================================

export interface ReferenceLine {
  type: "reference_line";
  id: string;
  x: number;
  label?: string;
  style: "solid" | "dashed" | "dotted";
  color?: string;
}

export interface CustomAnnotation {
  type: "custom";
  id: string;
  rowId: string;
  shape: "circle" | "square" | "triangle" | "star";
  position: "before" | "after" | "overlay";
  color: string;
  size: number;
}

export interface RiskOfBiasAnnotation {
  type: "risk_of_bias";
  id: string;
  domains: string[];
  assessments: {
    studyId: string;
    ratings: Record<string, "low" | "unclear" | "high">;
  }[];
}

export type Annotation = ReferenceLine | CustomAnnotation | RiskOfBiasAnnotation;

// ============================================================================
// Computed Layout
// ============================================================================

export interface ComputedLayout {
  totalWidth: number;
  totalHeight: number;
  tableWidth: number;
  forestWidth: number;
  headerHeight: number;
  rowHeight: number;
  plotHeight: number;
  axisHeight: number;
  nullValue: number;
  summaryYPosition: number;
  showOverallSummary: boolean;
  // Cumulative Y positions for each row (accounts for variable heights like spacers)
  rowPositions: number[];
  // Heights for each row (spacers are half-height)
  rowHeights: number[];
}

// ============================================================================
// Display Row Types (for rendering)
// ============================================================================

export interface GroupHeaderRow {
  type: "group_header";
  group: Group;
  rowCount: number;
  depth: number;
}

export interface DataRow {
  type: "data";
  row: Row;
  depth: number;
}

export type DisplayRow = GroupHeaderRow | DataRow;

// ============================================================================
// Store State
// ============================================================================

export interface SortConfig {
  column: string;
  direction: "asc" | "desc";
}

export interface FilterConfig {
  field: string;
  operator: "eq" | "neq" | "gt" | "lt" | "contains";
  value: unknown;
}

// ============================================================================
// Split Forest Types
// ============================================================================

export interface NavTreeNode {
  label: string;
  key: string;
  children: NavTreeNode[] | null;
}

export interface SplitForestPayload {
  type: "split_forest";
  splitVars: string[];
  navTree: NavTreeNode[];
  specs: Record<string, WebSpec>;
  sharedAxis: boolean;
  axisRange: { min: number; max: number } | null;
}

// ============================================================================
// HTMLWidgets Integration
// ============================================================================

declare global {
  interface Window {
    HTMLWidgets: {
      widget: (binding: HTMLWidgetsBinding) => void;
    };
    Shiny?: {
      setInputValue: (name: string, value: unknown, opts?: { priority?: string }) => void;
      addCustomMessageHandler: (type: string, handler: (msg: unknown) => void) => void;
    };
  }
}

export interface HTMLWidgetsBinding {
  name: string;
  type: string;
  factory: (el: HTMLElement, width: number, height: number) => WidgetInstance;
}

export interface WidgetInstance {
  renderValue: (x: WebSpec) => void;
  resize: (width: number, height: number) => void;
}

# Density-spacing reference values.
#
# Test-only mirror of the TS resolver's density presets
# (`srcjs/src/lib/theme-adapter.ts::DENSITY_SPACING`). Kept R-side so
# tests can probe expected pixel values without round-tripping through V8.

DENSITY_PRESETS <- list(
  compact = list(
    row_height = 20, header_height = 26, padding = 8, container_padding = 0,
    axis_gap = 8, column_group_padding = 6, row_group_padding = 0,
    cell_padding_x = 8, footer_gap = 6, title_subtitle_gap = 10,
    header_gap = 8, bottom_margin = 12, indent_per_level = 14
  ),
  comfortable = list(
    row_height = 24, header_height = 32, padding = 12, container_padding = 0,
    axis_gap = 12, column_group_padding = 8, row_group_padding = 0,
    cell_padding_x = 10, footer_gap = 8, title_subtitle_gap = 13,
    header_gap = 12, bottom_margin = 16, indent_per_level = 16
  ),
  spacious = list(
    row_height = 30, header_height = 40, padding = 16, container_padding = 0,
    axis_gap = 16, column_group_padding = 12, row_group_padding = 0,
    cell_padding_x = 14, footer_gap = 12, title_subtitle_gap = 18,
    header_gap = 16, bottom_margin = 22, indent_per_level = 20
  )
)

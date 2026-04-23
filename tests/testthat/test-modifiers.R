# Tests for set_* modifier functions

test_that("set_colors modifies theme colors", {
  theme <- web_theme_default()
  updated <- set_colors(theme, primary = "#ff0000", accent = "#00ff00")
  expect_equal(updated@colors@primary, "#ff0000")
  expect_equal(updated@colors@accent, "#00ff00")
  # Other colors unchanged

  expect_equal(updated@colors@background, theme@colors@background)
})

test_that("set_typography modifies font properties", {
  theme <- web_theme_default()
  updated <- set_typography(theme, font_family = "Georgia, serif")
  expect_equal(updated@typography@font_family, "Georgia, serif")
})

test_that("set_spacing modifies dimensions", {
  theme <- web_theme_default()
  updated <- set_spacing(theme, row_height = 40, padding = 16)
  expect_equal(updated@spacing@row_height, 40)
  expect_equal(updated@spacing@padding, 16)
})

test_that("set_shapes modifies visual properties", {
  theme <- web_theme_default()
  updated <- set_shapes(theme, point_size = 12, line_width = 2)
  expect_equal(updated@shapes@point_size, 12)
  expect_equal(updated@shapes@line_width, 2)
})

test_that("set_axis modifies axis config", {
  theme <- web_theme_default()
  updated <- set_axis(theme, range_min = -5, range_max = 5, gridlines = TRUE)
  expect_equal(updated@axis@range_min, -5)
  expect_equal(updated@axis@range_max, 5)
  expect_true(updated@axis@gridlines)
})

test_that("set_layout modifies layout config", {
  theme <- web_theme_default()
  updated <- set_layout(theme, plot_position = "left", banding = "none")
  expect_equal(updated@layout@plot_position, "left")
  expect_equal(updated@layout@banding, "none")
})

test_that("set_layout accepts banding grammar", {
  theme <- web_theme_default()
  expect_equal(set_layout(theme, banding = "row")@layout@banding, "row")
  expect_equal(set_layout(theme, banding = "group")@layout@banding, "group")
  expect_equal(set_layout(theme, banding = "group-2")@layout@banding, "group-2")
  expect_error(set_layout(theme, banding = "bogus"), "banding")
  expect_error(set_layout(theme, banding = "group-0"), "banding")
  expect_error(set_layout(theme, banding = TRUE), "no longer accepts logical")
})

test_that("parse_banding normalizes banding values", {
  expect_equal(parse_banding("none"), list(mode = "none", level = NA_integer_))
  expect_equal(parse_banding("row"), list(mode = "row", level = NA_integer_))
  expect_equal(parse_banding("group"), list(mode = "group", level = NA_integer_))
  expect_equal(parse_banding("group-3"), list(mode = "group", level = 3L))
  expect_error(parse_banding("group-"), "banding")
  expect_error(parse_banding("rows"), "banding")
  expect_error(parse_banding(FALSE), "no longer accepts logical")
})

test_that("serialize_banding emits {mode, level} with NULL level for bare group", {
  expect_equal(serialize_banding("none"), list(mode = "none", level = NULL))
  expect_equal(serialize_banding("group"), list(mode = "group", level = NULL))
  expect_equal(serialize_banding("group-2"), list(mode = "group", level = 2L))
})

test_that("tabviz(banding=) threads into effective theme", {
  data <- data.frame(
    study = c("A", "B", "C"),
    hr = c(0.8, 1.1, 1.4),
    lower = c(0.6, 0.9, 1.0),
    upper = c(1.0, 1.3, 1.8)
  )
  spec <- tabviz(
    data, label = "study",
    columns = list(col_interval("hr", "lower", "upper")),
    banding = "row",
    .spec_only = TRUE
  )
  expect_equal(spec@theme@layout@banding, "row")

  # tabviz arg wins over a theme that already sets banding
  themed <- web_theme_default() |> set_layout(banding = "none")
  spec2 <- tabviz(
    data, label = "study",
    columns = list(col_interval("hr", "lower", "upper")),
    theme = themed, banding = "group-1",
    .spec_only = TRUE
  )
  expect_equal(spec2@theme@layout@banding, "group-1")

  # Invalid banding surfaces a clear error
  expect_error(
    tabviz(data, label = "study", banding = "stripes", .spec_only = TRUE),
    "banding"
  )
})

test_that("set_group_headers modifies group header styling", {
  theme <- web_theme_default()
  updated <- set_group_headers(theme, level1_font_weight = 700, level1_italic = TRUE)
  expect_equal(updated@group_headers@level1_font_weight, 700)
  expect_true(updated@group_headers@level1_italic)
})

test_that("set_effect_colors sets effect colors", {
  theme <- web_theme_default()
  updated <- set_effect_colors(theme, c("#ff0000", "#00ff00", "#0000ff"))
  expect_equal(updated@shapes@effect_colors, c("#ff0000", "#00ff00", "#0000ff"))
})

test_that("set_marker_shapes sets marker shapes", {
  theme <- web_theme_default()
  updated <- set_marker_shapes(theme, c("circle", "diamond"))
  expect_equal(updated@shapes@marker_shapes, c("circle", "diamond"))
})

test_that("fluent chaining works", {
  result <- web_theme_default() |>
    set_colors(primary = "#123456") |>
    set_spacing(row_height = 35) |>
    set_shapes(point_size = 10)

  expect_equal(result@colors@primary, "#123456")
  expect_equal(result@spacing@row_height, 35)
  expect_equal(result@shapes@point_size, 10)
})

test_that("set_theme on WebSpec works with name string", {
  data <- data.frame(
    study = c("A", "B"),
    point = c(1, 2),
    lower = c(0.5, 1.5),
    upper = c(1.5, 2.5)
  )

  spec <- web_spec(
    data = data,
    label = "study",
    columns = list(
      viz_forest(point = "point", lower = "lower", upper = "upper")
    )
  )

  updated <- set_theme(spec, "jama")
  expect_equal(updated@theme@name, "jama")
})

test_that("set_theme on WebSpec works with WebTheme object", {
  data <- data.frame(
    study = c("A", "B"),
    point = c(1, 2),
    lower = c(0.5, 1.5),
    upper = c(1.5, 2.5)
  )

  spec <- web_spec(
    data = data,
    label = "study",
    columns = list(
      viz_forest(point = "point", lower = "lower", upper = "upper")
    )
  )

  custom_theme <- web_theme_jama() |> set_colors(primary = "#ff0000")
  updated <- set_theme(spec, custom_theme)
  expect_equal(updated@theme@colors@primary, "#ff0000")
})

test_that("widget round-trip: forest_plot |> set_colors works", {
  data <- data.frame(
    study = c("A", "B"),
    point = c(1, 2),
    lower = c(0.5, 1.5),
    upper = c(1.5, 2.5)
  )

  widget <- forest_plot(data, point = "point", lower = "lower", upper = "upper",
                        label = "study")
  updated_spec <- set_theme(widget, "lancet")
  # Returns an htmlwidget
  expect_true(inherits(updated_spec, "htmlwidget"))
})

# ----------------------------------------------------------------------------
# New verbs (WebSpec static path)
# ----------------------------------------------------------------------------

make_spec <- function() {
  data <- data.frame(
    study = c("A", "B", "C"),
    hr = c(0.8, 1.1, 1.4),
    lower = c(0.6, 0.9, 1.0),
    upper = c(1.0, 1.3, 1.8),
    notes = c("x", "y", "z")
  )
  tabviz(
    data, label = "study",
    columns = list(
      col_numeric("hr", "HR"),
      col_text("notes", "Notes")
    ),
    .spec_only = TRUE
  )
}

test_that("add_column on WebSpec appends by default", {
  spec <- make_spec()
  before <- length(spec@columns)
  new_spec <- add_column(spec, col_text("lower", "Lower"))
  expect_equal(length(new_spec@columns), before + 1L)
  expect_equal(new_spec@columns[[length(new_spec@columns)]]@field, "lower")
})

test_that("add_column with after = field inserts after that column", {
  spec <- make_spec()
  # columns order: [label(study), hr, notes]  (tabviz prepends label)
  new_spec <- add_column(spec, col_text("lower", "Lo"), after = "hr")
  fields <- vapply(new_spec@columns, function(c) c@field, character(1))
  hr_idx <- which(fields == "hr")
  expect_equal(fields[hr_idx + 1L], "lower")
})

test_that("remove_column drops the named column", {
  spec <- make_spec()
  new_spec <- remove_column(spec, "notes")
  fields <- vapply(new_spec@columns, function(c) c@field, character(1))
  expect_false("notes" %in% fields)
})

test_that("remove_column errors on unknown field", {
  expect_error(remove_column(make_spec(), "nope"), "not found")
})

test_that("move_column reorders top-level columns", {
  spec <- make_spec()
  # Before: [study, hr, notes]
  new_spec <- move_column(spec, "notes", to = 1L)
  fields <- vapply(new_spec@columns, function(c) c@field, character(1))
  expect_equal(fields[1], "notes")
})

test_that("resize_column sets @width", {
  spec <- make_spec()
  new_spec <- resize_column(spec, "hr", 150)
  hr_col <- Filter(function(c) c@field == "hr", new_spec@columns)[[1]]
  expect_equal(hr_col@width, 150)
})

test_that("update_column changes top-level props and merges options", {
  spec <- make_spec()
  new_spec <- update_column(spec, "hr", header = "Hazard", align = "right")
  hr_col <- Filter(function(c) c@field == "hr", new_spec@columns)[[1]]
  expect_equal(hr_col@header, "Hazard")
  expect_equal(hr_col@align, "right")
})

test_that("sort_rows reorders data by a column", {
  spec <- make_spec()
  new_spec <- sort_rows(spec, "hr", direction = "desc")
  expect_equal(new_spec@data$hr, sort(spec@data$hr, decreasing = TRUE))
})

test_that("sort_rows direction=none is a no-op", {
  spec <- make_spec()
  new_spec <- sort_rows(spec, "hr", direction = "none")
  expect_equal(new_spec@data$hr, spec@data$hr)
})

test_that("filter_rows keeps rows matching the predicate", {
  spec <- make_spec()
  new_spec <- filter_rows(spec, "hr", operator = "gt", value = 1)
  expect_true(all(new_spec@data$hr > 1))
})

test_that("move_row reorders data by row id", {
  spec <- make_spec()
  new_spec <- move_row(spec, "C", to = 1L)
  expect_equal(new_spec@data$study[1], "C")
})

test_that("update_data replaces the data frame", {
  spec <- make_spec()
  new_data <- spec@data
  new_data$hr <- new_data$hr * 2
  new_spec <- update_data(spec, new_data)
  expect_equal(new_spec@data$hr, spec@data$hr * 2)
})

test_that("clear_filters is a no-op on WebSpec", {
  spec <- make_spec()
  new_spec <- clear_filters(spec)
  expect_equal(new_spec@data, spec@data)
})

test_that("set_cell/set_row_label warn on static inputs", {
  spec <- make_spec()
  expect_warning(set_cell(spec, "A", "hr", 99), "runtime")
  expect_warning(set_row_label(spec, "A", "X"), "runtime")
  expect_warning(clear_edits(spec), "runtime")
})

test_that("htmlwidget round-trip: add_column returns htmlwidget", {
  spec <- make_spec()
  widget <- tabviz(spec)
  updated <- add_column(widget, col_text("lower", "Lo"))
  expect_true(inherits(updated, "htmlwidget"))
})

test_that("finalize_enable_themes handles NULL, 'default', and empty list", {
  theme <- web_theme_default()
  expect_null(tabviz:::finalize_enable_themes(NULL, theme))
  expect_null(tabviz:::finalize_enable_themes(list(), theme))
  resolved <- tabviz:::finalize_enable_themes("default", theme)
  expect_type(resolved, "list")
  expect_true(length(resolved) >= 1)
})

test_that("finalize_enable_themes auto-includes the active theme", {
  active <- web_theme_jama()
  resolved <- tabviz:::finalize_enable_themes(
    list(web_theme_default(), web_theme_modern()), active
  )
  names_out <- vapply(resolved, function(t) t@name, character(1))
  expect_true(active@name %in% names_out)
  # active theme prepended at position 1 when not already present
  expect_identical(names_out[[1]], active@name)
})

test_that("finalize_enable_themes does not duplicate when active already present", {
  active <- web_theme_jama()
  resolved <- tabviz:::finalize_enable_themes(
    list(web_theme_default(), web_theme_jama()), active
  )
  names_out <- vapply(resolved, function(t) t@name, character(1))
  expect_equal(sum(names_out == active@name), 1L)
})

test_that("finalize_enable_themes applies named list overrides to @name", {
  active <- web_theme_default()
  resolved <- tabviz:::finalize_enable_themes(
    list(Classical = web_theme_jama(), Modern = web_theme_modern()),
    active
  )
  names_out <- vapply(resolved, function(t) t@name, character(1))
  expect_true("Classical" %in% names_out)
  expect_true("Modern" %in% names_out)
})

test_that("selectable_themes sets spec interaction and auto-includes active", {
  spec <- make_spec()
  spec@theme <- web_theme_jama()
  updated <- selectable_themes(spec, list(web_theme_default()))
  names_out <- vapply(updated@interaction@enable_themes,
                      function(t) t@name, character(1))
  expect_true(spec@theme@name %in% names_out)
})

test_that("selectable_themes(NULL) hides the switcher", {
  spec <- make_spec()
  updated <- selectable_themes(spec, NULL)
  expect_null(updated@interaction@enable_themes)
})

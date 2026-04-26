# Tests for non-theme modifiers + theme-name dispatch.
# v2 theme modifiers (set_inputs, set_variants, set_spacing, set_theme_field)
# are tested in test-themes-api.R.

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

test_that("tabviz(banding=) threads into the row cluster", {
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
  expect_equal(spec@theme@row@banding, "row")

  # tabviz arg wins over a theme that already sets banding
  themed <- web_theme_cochrane()
  themed@row@banding <- "none"
  spec2 <- tabviz(
    data, label = "study",
    columns = list(col_interval("hr", "lower", "upper")),
    theme = themed, banding = "group-1",
    .spec_only = TRUE
  )
  expect_equal(spec2@theme@row@banding, "group-1")

  expect_error(
    tabviz(data, label = "study", banding = "stripes", .spec_only = TRUE),
    "banding"
  )
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
    columns = list(viz_forest(point = "point", lower = "lower", upper = "upper"))
  )
  custom <- web_theme(name = "test", inputs = list(brand = "#FF0000"))
  updated <- set_theme(spec, custom)
  expect_equal(updated@theme@name, "test")
  expect_equal(toupper(updated@theme@inputs@brand), "#FF0000")
})

test_that("widget round-trip: forest_plot |> set_theme works", {
  data <- data.frame(
    study = c("A", "B"),
    point = c(1, 2),
    lower = c(0.5, 1.5),
    upper = c(1.5, 2.5)
  )
  widget <- forest_plot(data, point = "point", lower = "lower", upper = "upper",
                       label = "study")
  updated <- set_theme(widget, "lancet")
  expect_true(inherits(updated, "htmlwidget"))
})

# ----------------------------------------------------------------------------
# Column manipulation verbs (WebSpec static path)
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
  updated <- add_column(spec, col_text("lower", "Lo"))
  expect_equal(length(updated@columns), before + 1L)
  expect_equal(updated@columns[[length(updated@columns)]]@field, "lower")
})

test_that("add_column with after = field inserts after that column", {
  spec <- make_spec()
  updated <- add_column(spec, col_text("lower", "Lo"), after = "hr")
  fields <- vapply(updated@columns, function(c) c@field, character(1))
  expect_equal(fields, c("study", "hr", "lower", "notes"))
})

test_that("remove_column drops the named column", {
  spec <- make_spec()
  updated <- remove_column(spec, "notes")
  fields <- vapply(updated@columns, function(c) c@field, character(1))
  expect_false("notes" %in% fields)
})

test_that("remove_column errors on unknown field", {
  expect_error(remove_column(make_spec(), "nope"))
})

test_that("move_column reorders top-level columns", {
  spec <- make_spec()
  updated <- move_column(spec, "notes", to = 2L)
  fields <- vapply(updated@columns, function(c) c@field, character(1))
  expect_equal(fields[1:3], c("study", "notes", "hr"))
})

test_that("resize_column sets @width", {
  spec <- make_spec()
  updated <- resize_column(spec, "hr", 200)
  hr_col <- Find(function(c) c@field == "hr", updated@columns)
  expect_equal(hr_col@width, 200)
})

test_that("update_column changes top-level props and merges options", {
  spec <- make_spec()
  updated <- update_column(spec, "hr", header = "Hazard Ratio", options = list(decimals = 3))
  hr_col <- Find(function(c) c@field == "hr", updated@columns)
  expect_equal(hr_col@header, "Hazard Ratio")
  expect_equal(hr_col@options$decimals, 3)
})

test_that("sort_rows reorders data by a column", {
  spec <- make_spec()
  sorted <- sort_rows(spec, "hr", direction = "desc")
  expect_equal(sorted@data$study, c("C", "B", "A"))
})

test_that("sort_rows direction=none is a no-op", {
  spec <- make_spec()
  expect_equal(sort_rows(spec, "hr", direction = "none")@data, spec@data)
})

test_that("filter_rows keeps rows matching the predicate", {
  spec <- make_spec()
  filtered <- filter_rows(spec, "hr", "gt", 1)
  expect_equal(filtered@data$study, c("B", "C"))
})

test_that("move_row reorders data by row id", {
  spec <- make_spec()
  moved <- move_row(spec, "C", to = 1L)
  expect_equal(moved@data$study, c("C", "A", "B"))
})

test_that("update_data replaces the data frame", {
  spec <- make_spec()
  new_data <- data.frame(
    study = "Z", hr = 2.0, lower = 1.5, upper = 2.5, notes = "z"
  )
  new_spec <- update_data(spec, new_data)
  expect_equal(new_spec@data, new_data)
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

# ----------------------------------------------------------------------------
# Theme switcher (selectable_themes)
# ----------------------------------------------------------------------------

test_that("finalize_enable_themes handles NULL, 'default', and empty list", {
  theme <- web_theme_cochrane()
  expect_null(tabviz:::finalize_enable_themes(NULL, theme))
  expect_null(tabviz:::finalize_enable_themes(list(), theme))
  resolved <- tabviz:::finalize_enable_themes("default", theme)
  expect_type(resolved, "list")
  expect_true(length(resolved) >= 1)
})

test_that("finalize_enable_themes auto-includes the active theme", {
  active <- web_theme_jama()
  resolved <- tabviz:::finalize_enable_themes(
    list(web_theme_cochrane(), web_theme_lancet()), active
  )
  names_out <- vapply(resolved, function(t) t@name, character(1))
  expect_true(active@name %in% names_out)
  expect_identical(names_out[[1]], active@name)
})

test_that("finalize_enable_themes does not duplicate when active already present", {
  active <- web_theme_jama()
  resolved <- tabviz:::finalize_enable_themes(
    list(web_theme_cochrane(), web_theme_jama()), active
  )
  names_out <- vapply(resolved, function(t) t@name, character(1))
  expect_equal(sum(names_out == active@name), 1L)
})

test_that("finalize_enable_themes applies named list overrides to @name", {
  active <- web_theme_cochrane()
  resolved <- tabviz:::finalize_enable_themes(
    list(Classical = web_theme_jama(), Modern = web_theme_lancet()),
    active
  )
  names_out <- vapply(resolved, function(t) t@name, character(1))
  expect_true("Classical" %in% names_out)
  expect_true("Modern" %in% names_out)
})

test_that("selectable_themes sets spec interaction and auto-includes active", {
  spec <- make_spec()
  spec@theme <- web_theme_jama()
  updated <- selectable_themes(spec, list(web_theme_cochrane()))
  names_out <- vapply(updated@interaction@enable_themes,
                      function(t) t@name, character(1))
  expect_true(spec@theme@name %in% names_out)
})

test_that("selectable_themes(NULL) hides the switcher", {
  spec <- make_spec()
  updated <- selectable_themes(spec, NULL)
  expect_null(updated@interaction@enable_themes)
})

# ----------------------------------------------------------------------------
# Labels + watermark + shared column widths
# ----------------------------------------------------------------------------

test_that("set_title/subtitle/caption/footnote update spec@labels", {
  spec <- make_spec()
  spec <- set_title(spec, "T")
  spec <- set_subtitle(spec, "S")
  spec <- set_caption(spec, "C")
  spec <- set_footnote(spec, "F")
  expect_equal(spec@labels@title, "T")
  expect_equal(spec@labels@subtitle, "S")
  expect_equal(spec@labels@caption, "C")
  expect_equal(spec@labels@footnote, "F")
})

test_that("set_title(NULL) clears the title", {
  spec <- make_spec()
  spec <- set_title(spec, "X")
  spec <- set_title(spec, NULL)
  expect_true(is.na(spec@labels@title))
})

test_that("set_watermark sets and clears", {
  spec <- make_spec()
  spec <- set_watermark(spec, "DRAFT")
  expect_equal(spec@watermark, "DRAFT")
  spec <- set_watermark(spec, NULL)
  expect_true(is.na(spec@watermark))
})

test_that("set_shared_column_widths flips the SplitForest flag", {
  data <- data.frame(
    study = c("A", "B", "C", "D"),
    region = c("N", "N", "S", "S"),
    or = c(0.8, 1.0, 1.2, 1.1),
    lower = c(0.5, 0.7, 0.9, 0.8),
    upper = c(1.1, 1.3, 1.6, 1.4)
  )
  sf <- tabviz(
    data, label = "study",
    columns = list(viz_forest(point = "or", lower = "lower", upper = "upper")),
    .spec_only = TRUE
  ) |>
    split_table(by = "region")
  expect_false(sf@shared_column_widths)
  sf2 <- set_shared_column_widths(sf, TRUE)
  expect_true(sf2@shared_column_widths)
  sf3 <- set_shared_column_widths(sf2, FALSE)
  expect_false(sf3@shared_column_widths)
})

test_that("tabviz() captures original_call verbatim", {
  spec <- tabviz(
    data.frame(study = "A", hr = 1.0),
    label = "study",
    columns = list(col_numeric("hr")),
    .spec_only = TRUE
  )
  expect_match(spec@original_call, "^tabviz\\(")
  expect_match(spec@original_call, "label = \"study\"")
})

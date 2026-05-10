# Tests for pagination: spec validation, shortcut coercion, breakpoint
# computation, and save_plot multi-page PDF.

test_that("paginate_spec() defaults are stable", {
  ps <- paginate_spec()
  expect_s7_class(ps, PaginateSpec)
  expect_equal(ps@rows, 30L)
  expect_equal(ps@break_on, "split")
  expect_true(ps@keep_groups)
  expect_equal(ps@orphan_min, 3L)
  expect_true(ps@repeat_header)
  expect_true(ps@repeat_legend)
  expect_true(ps@repeat_title)
  expect_equal(ps@footnotes_on, "last")
  expect_equal(ps@page_label, "x_of_y")
  expect_equal(ps@oversized_group_policy, "overflow")
})

test_that("paginate_spec() rejects invalid args", {
  expect_error(paginate_spec(rows = 0), ">= 1")
  expect_error(paginate_spec(rows = -5), ">= 1")
  expect_error(paginate_spec(orphan_min = 30, rows = 30), "must be less than")
  expect_error(paginate_spec(break_on = "bogus"), "should be one of")
  expect_error(paginate_spec(footnotes_on = "bogus"), "should be one of")
  expect_error(paginate_spec(page_label = list(1)), "page_label")
})

test_that("paginate_spec() accepts function-form page_label", {
  pl <- function(page, total) sprintf("p%d / %d", page, total)
  ps <- paginate_spec(page_label = pl)
  expect_true(is.function(ps@page_label))
})

test_that("paginate_letter / a4 / slide presets pick orientation-aware row counts", {
  expect_equal(paginate_letter()@rows, 30L)
  expect_equal(paginate_letter("landscape")@rows, 18L)
  expect_equal(paginate_a4()@rows, 32L)
  expect_equal(paginate_a4("landscape")@rows, 20L)
  expect_equal(paginate_slide()@rows, 16L)
})

test_that("as_paginate_spec() coerces shortcut forms", {
  expect_null(as_paginate_spec(NULL))
  expect_null(as_paginate_spec(FALSE))
  ps_t <- as_paginate_spec(TRUE)
  expect_s7_class(ps_t, PaginateSpec)
  expect_equal(ps_t@rows, 30L)
  ps_n <- as_paginate_spec(50)
  expect_equal(ps_n@rows, 50L)
  ps_obj <- paginate_spec(rows = 25)
  expect_identical(as_paginate_spec(ps_obj), ps_obj)
  expect_error(as_paginate_spec("not-valid"), "must be")
  expect_error(as_paginate_spec(c(1, 2)), "must be")
})

test_that("compute_page_breaks() handles ungrouped data with even splits", {
  df <- data.frame(study = paste0("s", 1:60))
  spec <- tabviz(df, label = "study", .spec_only = TRUE)
  spec@paginate <- paginate_spec(rows = 20, orphan_min = 0)
  br <- compute_page_breaks(spec)
  expect_equal(br$n_pages, 3L)
  expect_equal(br$page_starts, c(1L, 21L, 41L))
  expect_equal(br$page_ends, c(20L, 40L, 60L))
})

test_that("compute_page_breaks() respects group integrity by default", {
  # Groups: A=20, B=25, C=18, D=10, total 73; rows = 30 should pack
  # A-alone (page 1, 20), B-alone (page 2, 25), C+D (page 3, 28).
  df <- data.frame(
    study = paste0("s", 1:73),
    grp = rep(c("A","B","C","D"), times = c(20, 25, 18, 10))
  )
  spec <- tabviz(df, label = "study", group = "grp", .spec_only = TRUE)
  spec@paginate <- paginate_spec(rows = 30, orphan_min = 0)
  br <- compute_page_breaks(spec)
  expect_equal(br$n_pages, 3L)
  sizes <- br$page_ends - br$page_starts + 1L
  expect_equal(sizes, c(20L, 25L, 28L))
})

test_that("compute_page_breaks() splits across rows when keep_groups = FALSE", {
  df <- data.frame(
    study = paste0("s", 1:73),
    grp = rep(c("A","B","C","D"), times = c(20, 25, 18, 10))
  )
  spec <- tabviz(df, label = "study", group = "grp", .spec_only = TRUE)
  spec@paginate <- paginate_spec(rows = 30, orphan_min = 0, keep_groups = FALSE)
  br <- compute_page_breaks(spec)
  sizes <- br$page_ends - br$page_starts + 1L
  expect_equal(sum(sizes), 73L)
  # Without group integrity, packing fills every page to budget except the last.
  expect_true(all(sizes[-length(sizes)] == 30L))
})

test_that("compute_page_breaks() oversizes a group larger than the row budget", {
  df <- data.frame(
    study = paste0("s", 1:50),
    grp = rep(c("A","B"), times = c(35, 15))
  )
  spec <- tabviz(df, label = "study", group = "grp", .spec_only = TRUE)
  spec@paginate <- paginate_spec(rows = 20, orphan_min = 0)
  expect_message(br <- compute_page_breaks(spec), "overflow")
  sizes <- br$page_ends - br$page_starts + 1L
  expect_equal(sizes, c(35L, 15L))
})

test_that("compute_page_breaks() applies orphan_min by pulling rows back", {
  # 61 rows, rows = 30 -> 30/30/1 by default; orphan_min = 3 -> 30/28/3.
  df <- data.frame(study = paste0("s", 1:61))
  spec <- tabviz(df, label = "study", .spec_only = TRUE)
  spec@paginate <- paginate_spec(rows = 30, orphan_min = 3)
  br <- compute_page_breaks(spec)
  sizes <- br$page_ends - br$page_starts + 1L
  expect_equal(sizes, c(30L, 28L, 3L))
})

test_that("compute_page_breaks() falls back to merging when prior page can't donate (regression)", {
  # 14 rows with rows=12, orphan_min=10. Default split: 12 + 2.
  # Pulling 8 rows from page 1 would leave it at 4, below orphan_min=10.
  # Fix: merge instead — single 14-row page. Tradeoff: rows-per-page
  # cap exceeded by 2 to honour orphan_min.
  df <- data.frame(study = paste0("s", 1:14))
  spec <- tabviz(df, label = "study", .spec_only = TRUE)
  spec@paginate <- paginate_spec(rows = 12, orphan_min = 10)
  br <- compute_page_breaks(spec)
  sizes <- br$page_ends - br$page_starts + 1L
  expect_equal(br$n_pages, 1L)
  expect_equal(sizes, 14L)
})

test_that("compute_page_breaks() returns NULL when no spec is attached", {
  df <- data.frame(study = paste0("s", 1:5))
  spec <- tabviz(df, label = "study", .spec_only = TRUE)
  expect_null(compute_page_breaks(spec))
})

test_that("compute_page_breaks() handles empty data without erroring", {
  df <- data.frame(study = character(0))
  spec <- tabviz(df, label = "study", .spec_only = TRUE)
  spec@paginate <- paginate_spec(rows = 30)
  br <- compute_page_breaks(spec)
  expect_equal(br$n_pages, 0L)
  expect_length(br$page_starts, 0L)
})

test_that("tabviz(paginate = ...) accepts shortcut forms", {
  df <- data.frame(study = paste0("s", 1:5))
  expect_s7_class(
    tabviz(df, label = "study", paginate = TRUE, .spec_only = TRUE)@paginate,
    PaginateSpec
  )
  expect_equal(
    tabviz(df, label = "study", paginate = 50, .spec_only = TRUE)@paginate@rows,
    50L
  )
  expect_null(tabviz(df, label = "study", .spec_only = TRUE)@paginate)
  expect_null(tabviz(df, label = "study", paginate = NULL, .spec_only = TRUE)@paginate)
})

test_that("paginate() fluent modifier sets and clears the spec", {
  df <- data.frame(study = paste0("s", 1:5))
  spec <- tabviz(df, label = "study", .spec_only = TRUE) |> paginate(rows = 20)
  expect_equal(spec@paginate@rows, 20L)
  spec2 <- spec |> paginate(NULL)
  expect_null(spec2@paginate)
  spec3 <- tabviz(df, label = "study", .spec_only = TRUE) |> paginate(paginate_letter())
  expect_equal(spec3@paginate@rows, 30L)
})

test_that("serialize_paginate() returns 0-based page ranges and a stable page count", {
  df <- data.frame(study = paste0("s", 1:50))
  spec <- tabviz(df, label = "study", paginate = paginate_spec(rows = 20),
                 .spec_only = TRUE)
  ser <- serialize_paginate(spec)
  expect_equal(ser$rows, 20L)
  expect_equal(ser$nPages, 3L)
  expect_equal(length(ser$pages), 3L)
  expect_equal(ser$pages[[1]]$startIdx, 0L)
  expect_equal(ser$pages[[1]]$endIdx, 19L)
  expect_equal(ser$pages[[3]]$endIdx, 49L)
})

test_that("save_plot(.pdf) emits a multi-page PDF when paginate is set", {
  skip_if_not_installed("V8")
  skip_if_not_installed("rsvg")
  skip_if_not_installed("qpdf")

  df <- data.frame(
    study = paste0("Study ", 1:45),
    est = round(runif(45, 0.5, 1.5), 2),
    lo = round(runif(45, 0.3, 1.0), 2),
    hi = round(runif(45, 1.0, 2.0), 2)
  )
  spec <- tabviz(df, label = "study",
                 columns = list(viz_forest(point = "est", lower = "lo", upper = "hi")),
                 paginate = paginate_spec(rows = 20, orphan_min = 0),
                 .spec_only = TRUE)
  path <- tempfile(fileext = ".pdf")
  on.exit(unlink(path), add = TRUE)
  save_plot(spec, path, width = 600)
  expect_true(file.exists(path))
  expect_equal(qpdf::pdf_length(path), 3L)
})

test_that("save_plot(.png) flattens with a warning when paginate is set", {
  skip_if_not_installed("V8")
  skip_if_not_installed("rsvg")

  df <- data.frame(
    study = paste0("s", 1:30),
    est = runif(30, 0.5, 1.5),
    lo = runif(30, 0.3, 1.0),
    hi = runif(30, 1.0, 2.0)
  )
  spec <- tabviz(df, label = "study",
                 columns = list(viz_forest(point = "est", lower = "lo", upper = "hi")),
                 paginate = paginate_spec(rows = 10),
                 .spec_only = TRUE)
  path <- tempfile(fileext = ".png")
  on.exit(unlink(path), add = TRUE)
  expect_warning(save_plot(spec, path, width = 400, scale = 1), "single-image")
  expect_true(file.exists(path))
})

test_that("save_plot(paginate = NULL) overrides spec-level pagination silently", {
  skip_if_not_installed("V8")
  skip_if_not_installed("rsvg")

  df <- data.frame(
    study = paste0("s", 1:30),
    est = runif(30), lo = runif(30), hi = runif(30) + 1
  )
  spec <- tabviz(df, label = "study",
                 columns = list(viz_forest(point = "est", lower = "lo", upper = "hi")),
                 paginate = paginate_spec(rows = 10),
                 .spec_only = TRUE)
  path <- tempfile(fileext = ".png")
  on.exit(unlink(path), add = TRUE)
  expect_no_warning(save_plot(spec, path, width = 400, scale = 1, paginate = NULL))
  expect_true(file.exists(path))
})

test_that("split_by × paginate propagates paginate into every sub-spec", {
  df <- data.frame(
    study = paste0("s", 1:40),
    site = rep(c("N","S"), each = 20),
    est = runif(40), lo = runif(40), hi = runif(40) + 1
  )
  w <- tabviz(df, label = "study", split_by = "site",
              columns = list(viz_forest(point = "est", lower = "lo", upper = "hi")),
              paginate = paginate_spec(rows = 10))
  sf <- attr(w, "splitforest")
  expect_s7_class(sf, SplitForest)
  for (key in names(sf@specs)) {
    expect_s7_class(sf@specs[[key]]@paginate, PaginateSpec)
    expect_equal(sf@specs[[key]]@paginate@rows, 10L)
  }
})

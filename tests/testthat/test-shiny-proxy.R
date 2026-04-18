# Tests for the Shiny proxy surface and verb dispatch on proxies.
#
# Uses a fake session that records sendCustomMessage calls so we can inspect
# method + args payloads without spinning up a real Shiny app.

fake_session <- function() {
  calls <- list()
  list(
    sendCustomMessage = function(type, message) {
      calls[[length(calls) + 1L]] <<- list(type = type, message = message)
      invisible(NULL)
    },
    calls = function() calls
  )
}

fake_proxy <- function(session, id = "w1") {
  structure(list(id = id, session = session), class = "tabviz_proxy")
}

# ----------------------------------------------------------------------------
# Renames: old forest_* / forestProxy / forestOutput are gone; new names exist
# ----------------------------------------------------------------------------

test_that("renamed exports are present", {
  expect_true(exists("tabviz_proxy", mode = "function", envir = asNamespace("tabviz")))
  expect_true(exists("tabvizOutput", mode = "function", envir = asNamespace("tabviz")))
  expect_true(exists("renderTabviz", mode = "function", envir = asNamespace("tabviz")))
  expect_true(exists("split_tabviz_proxy", mode = "function", envir = asNamespace("tabviz")))
  expect_true(exists("split_tabviz_select", mode = "function", envir = asNamespace("tabviz")))
  expect_true(exists("splitTabvizOutput", mode = "function", envir = asNamespace("tabviz")))
  expect_true(exists("renderSplitTabviz", mode = "function", envir = asNamespace("tabviz")))
})

test_that("old forest_* proxy functions are gone", {
  ns <- asNamespace("tabviz")
  for (nm in c("forest_update_data", "forest_toggle_subgroup", "forest_filter",
               "forest_clear_filter", "forest_sort", "forestProxy",
               "forestOutput", "renderForest", "splitForestProxy",
               "splitForestOutput", "renderSplitForest", "split_table_select")) {
    expect_false(exists(nm, mode = "function", envir = ns, inherits = FALSE),
                 info = paste("unexpected export:", nm))
  }
})

# ----------------------------------------------------------------------------
# Verb dispatch on proxies
# ----------------------------------------------------------------------------

test_that("sort_rows on proxy sends sortBy message", {
  sess <- fake_session()
  p <- fake_proxy(sess)
  sort_rows(p, "hr", direction = "desc")
  calls <- sess$calls()
  expect_length(calls, 1)
  expect_equal(calls[[1]]$type, "tabviz-proxy")
  expect_equal(calls[[1]]$message$id, "w1")
  expect_equal(calls[[1]]$message$method, "sortBy")
  expect_equal(calls[[1]]$message$args, list(column = "hr", direction = "desc"))
})

test_that("filter_rows on proxy sends applyFilter message", {
  sess <- fake_session()
  p <- fake_proxy(sess)
  filter_rows(p, "hr", operator = "gt", value = 1)
  calls <- sess$calls()
  expect_equal(calls[[1]]$message$method, "applyFilter")
  expect_equal(calls[[1]]$message$args$filter,
               list(field = "hr", operator = "gt", value = 1))
})

test_that("clear_filters on proxy sends clearFilter", {
  sess <- fake_session()
  p <- fake_proxy(sess)
  clear_filters(p)
  expect_equal(sess$calls()[[1]]$message$method, "clearFilter")
})

test_that("toggle_group on proxy sends toggleGroup with collapsed flag", {
  sess <- fake_session()
  p <- fake_proxy(sess)
  toggle_group(p, "grp1", collapsed = TRUE)
  expect_equal(sess$calls()[[1]]$message$method, "toggleGroup")
  expect_equal(sess$calls()[[1]]$message$args,
               list(groupId = "grp1", collapsed = TRUE))
})

test_that("add_column on proxy sends addColumn with serialized column", {
  sess <- fake_session()
  p <- fake_proxy(sess)
  add_column(p, col_text("notes", max_chars = 10), after = "hr")
  msg <- sess$calls()[[1]]$message
  expect_equal(msg$method, "addColumn")
  expect_equal(msg$args$afterId, "hr")
  expect_equal(msg$args$column$field, "notes")
  expect_equal(msg$args$column$type, "text")
})

test_that("remove_column on proxy sends hideColumn", {
  sess <- fake_session()
  p <- fake_proxy(sess)
  remove_column(p, "notes")
  msg <- sess$calls()[[1]]$message
  expect_equal(msg$method, "hideColumn")
  expect_equal(msg$args, list(id = "notes"))
})

test_that("move_column on proxy sends moveColumn with 0-based newIndex", {
  sess <- fake_session()
  p <- fake_proxy(sess)
  move_column(p, "hr", to = 3L)
  msg <- sess$calls()[[1]]$message
  expect_equal(msg$method, "moveColumn")
  expect_equal(msg$args$itemId, "hr")
  expect_equal(msg$args$newIndex, 2L) # R's 3 -> JS's 2
})

test_that("resize_column on proxy sends setColumnWidth", {
  sess <- fake_session()
  p <- fake_proxy(sess)
  resize_column(p, "hr", width = 120)
  msg <- sess$calls()[[1]]$message
  expect_equal(msg$method, "setColumnWidth")
  expect_equal(msg$args, list(columnId = "hr", width = 120))
})

test_that("update_column on proxy sends updateColumn with changes payload", {
  sess <- fake_session()
  p <- fake_proxy(sess)
  update_column(p, "hr", header = "Hazard Ratio", align = "right")
  msg <- sess$calls()[[1]]$message
  expect_equal(msg$method, "updateColumn")
  expect_equal(msg$args$id, "hr")
  expect_equal(msg$args$changes$header, "Hazard Ratio")
  expect_equal(msg$args$changes$align, "right")
})

test_that("select_rows on proxy sends selectRows", {
  sess <- fake_session()
  p <- fake_proxy(sess)
  select_rows(p, c("A", "B"))
  msg <- sess$calls()[[1]]$message
  expect_equal(msg$method, "selectRows")
  expect_equal(msg$args$rowIds, list("A", "B"))
})

test_that("move_row on proxy sends moveRow with 0-based newIndex", {
  sess <- fake_session()
  p <- fake_proxy(sess)
  move_row(p, "r3", to = 1L)
  msg <- sess$calls()[[1]]$message
  expect_equal(msg$method, "moveRow")
  expect_equal(msg$args$rowId, "r3")
  expect_equal(msg$args$newIndex, 0L)
})

test_that("set_cell/set_row_label/clear_edits on proxy route correctly", {
  sess <- fake_session()
  p <- fake_proxy(sess)
  set_cell(p, "r1", "hr", 1.23)
  set_row_label(p, "r1", "Renamed")
  clear_edits(p)
  methods <- vapply(sess$calls(), function(c) c$message$method, character(1))
  expect_equal(methods, c("setCell", "setRowLabel", "clearEdits"))
})

test_that("set_theme on proxy with theme name sends setTheme{name}", {
  sess <- fake_session()
  p <- fake_proxy(sess)
  set_theme(p, "jama")
  msg <- sess$calls()[[1]]$message
  expect_equal(msg$method, "setTheme")
  expect_equal(msg$args, list(name = "jama"))
})

test_that("set_zoom on proxy sends setZoom with all knobs", {
  sess <- fake_session()
  p <- fake_proxy(sess)
  set_zoom(p, zoom = 0.8, auto_fit = FALSE, max_width = 500)
  msg <- sess$calls()[[1]]$message
  expect_equal(msg$method, "setZoom")
  expect_equal(msg$args$zoom, 0.8)
  expect_false(msg$args$autoFit)
  expect_equal(msg$args$maxWidth, 500)
})

test_that("update_data on proxy requires a WebSpec", {
  sess <- fake_session()
  p <- fake_proxy(sess)
  expect_error(update_data(p, data.frame(a = 1)), "WebSpec")
})

test_that("invoke_proxy_method rejects non-proxy input", {
  expect_error(invoke_proxy_method(list(), "foo", list()), "tabviz_proxy")
})

# eps + tiff + dpi contract (spec-first plan Phase 0).
test_that("eps and dpi-tagged tiff export work", {
  skip_if_not_installed("rsvg")
  skip_if_not_installed("magick")
  df <- data.frame(s = "A", hr = .7, lo = .6, hi = .9)
  w <- tabviz(df, label = "s", columns = list(col_interval("hr", "lo", "hi")))
  f_eps <- tempfile(fileext = ".eps")
  suppressMessages(save_plot(w, f_eps))
  expect_gt(file.size(f_eps), 1000)
  f_tif <- tempfile(fileext = ".tiff")
  suppressMessages(save_plot(w, f_tif, dpi = 300))
  info <- magick::image_info(magick::image_read(f_tif))
  expect_match(as.character(info$density), "300")
})

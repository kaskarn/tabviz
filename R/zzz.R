# Package load hook
# Called when the package is loaded

.onLoad <- function(libname, pkgname) {

  # Signal experimental lifecycle stage
 lifecycle::signal_stage("experimental", "tabviz")

  # Bind `knit_print` for our S7 classes to the underscore-named handlers
  # in `forest_plot.R`. We can't use the standard
  # `knit_print.tabviz::SplitForest` declaration because `::` is invalid
  # in R function names; `registerS3method` accepts the raw class string,
  # which is what S7 actually puts on the object (`class(x)[1]` is
  # `"tabviz::SplitForest"`). Without this registration, knitr falls
  # back to base print and emits the S7 structure dump as raw text —
  # exactly the regression that surfaced as "thousands of lines of raw
  # code" on the Split Plots docs page.
  if (requireNamespace("knitr", quietly = TRUE)) {
    registerS3method(
      "knit_print", "tabviz::SplitForest",
      knit_print_splitforest, envir = asNamespace("knitr")
    )
    registerS3method(
      "knit_print", "tabviz::WebSpec",
      knit_print_webspec, envir = asNamespace("knitr")
    )
  }
}

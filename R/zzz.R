# Package load hook
# Called when the package is loaded

.onLoad <- function(libname, pkgname) {

  # Signal experimental lifecycle stage
 lifecycle::signal_stage("experimental", "tabviz")
}

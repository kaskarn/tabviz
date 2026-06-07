# Stage 3 -- tabviz_studio() editor gadget.
#
# Opens an interactive theme editor as a Shiny gadget. Edits operate on
# a working copy; the original input is untouched until Done returns
# the edited value (or Cancel returns NULL).
#
# S7 generic dispatched on (WebSpec | WebTheme):
#   - tabviz_studio(spec)  -- chart renders against the user's data;
#                            edits theme bound to spec; returns updated spec.
#   - tabviz_studio(theme) -- opens with a sample spec; theme-only edit;
#                            returns updated theme.
#
# Per Stage 3 design doc + ideation session 2026-06-03:
#   - Edit scope = theme only. Spec structure is read-only.
#   - Live re-render on every edit.
#   - Done returns edited; Cancel returns NULL.
#   - Both echo R-modifier snippet to console on close.

#' Open the theme editor.
#'
#' Launches `tabviz_studio` as a Shiny gadget. Edits the theme bound to a
#' [WebSpec] (chart-aware mode) or a stand-alone [WebTheme] (theme-only
#' mode). Returns the edited object on Done; returns NULL on Cancel.
#'
#' On close (Done OR Cancel), the studio echoes an R `set_*()` pipe chain
#' to the console so the edits are recoverable even if the return value
#' wasn't assigned.
#'
#' @param x A [WebSpec] or [WebTheme].
#' @param ... Reserved for future arguments; currently unused.
#' @return The edited object (WebSpec or WebTheme), or NULL on Cancel.
#' @export
tabviz_studio <- S7::new_generic("tabviz_studio", "x")

S7::method(tabviz_studio, WebSpec) <- function(x) {
  result <- .run_studio_gadget(spec = x, theme = x@theme)
  if (is.null(result)) return(invisible(NULL))
  # Update the spec's theme with the edited result, returning the new spec.
  x@theme <- result
  x
}

S7::method(tabviz_studio, WebTheme) <- function(x) {
  # Wrap in a sample spec for live re-rendering during the editor session.
  sample_spec <- .studio_sample_spec(x)
  result <- .run_studio_gadget(spec = sample_spec, theme = x)
  if (is.null(result)) return(invisible(NULL))
  result
}

# Internal launcher -- sets up the gadget UI + server reactivity.
.run_studio_gadget <- function(spec, theme) {
  if (!requireNamespace("shiny", quietly = TRUE)) {
    cli::cli_abort(c(
      "Package {.pkg shiny} is required for {.fn tabviz_studio}.",
      "i" = "Install it with: {.code install.packages(\"shiny\")}"
    ))
  }
  if (!requireNamespace("miniUI", quietly = TRUE)) {
    cli::cli_abort(c(
      "Package {.pkg miniUI} is required for {.fn tabviz_studio}.",
      "i" = "Install it with: {.code install.packages(\"miniUI\")}"
    ))
  }
  # Serve the studio bundle from the package's `inst/studio/` directory.
  studio_dir <- system.file("studio", package = "tabviz")
  if (!nzchar(studio_dir) || !dir.exists(studio_dir)) {
    cli::cli_abort(c(
      "Studio bundle not found at {.path inst/studio/}.",
      "i" = "Run {.code cd srcjs && npm run build:studio} to build it."
    ))
  }
  shiny::addResourcePath("tabviz-studio", studio_dir)

  # The studio UI is a single mounted Svelte component (`StudioShell`)
  # rendered inside a miniUI page. The component owns its own state +
  # working-copy + history; we hand it the initial spec and theme as
  # serialized JSON and receive the final state on Done/Cancel.
  ui <- miniUI::miniPage(
    htmltools::tags$head(
      htmltools::tags$link(rel = "stylesheet", href = "tabviz-studio/studio.css"),
      htmltools::tags$script(src = "tabviz-studio/studio.js", defer = NA)
    ),
    miniUI::miniContentPanel(
      htmltools::tags$div(
        id = "tabviz-studio-mount",
        `data-initial-spec` = jsonlite::toJSON(serialize_spec(spec), auto_unbox = TRUE),
        `data-initial-theme` = jsonlite::toJSON(serialize_theme(theme), auto_unbox = TRUE),
        style = "width: 100%; height: 100%;"
      )
    )
  )
  # Final result captured here when the gadget emits a `done` or `cancel`.
  final <- list(action = NULL, theme = NULL)
  server <- function(input, output, session) {
    shiny::observeEvent(input$studio_done, {
      final$action <<- "done"
      final$theme  <<- input$studio_done
      shiny::stopApp()
    })
    # Save-as (P0 review #4): previously a dead input — the JS posted the
    # name and nothing listened. The payload is now {name, wire}; write
    # the envelope-resolved theme into the user theme dir, keep editing.
    shiny::observeEvent(input$studio_save_as, {
      path <- .studio_save_as_payload(input$studio_save_as)
      if (!is.null(path)) cli::cli_inform("Saved theme to {.path {path}}.")
    })
    shiny::observeEvent(input$studio_cancel, {
      final$action <<- "cancel"
      shiny::stopApp()
    })
  }
  viewer <- if (rstudioapi::isAvailable()) shiny::paneViewer() else shiny::browserViewer()
  shiny::runGadget(ui, server, viewer = viewer)

  if (identical(final$action, "cancel") || is.null(final$theme)) {
    .echo_studio_snippet(NULL, "cancel")
    return(NULL)
  }
  # The studio posts the WIRE envelope ({$schema, name, inputs,
  # roleOverrides}) — re-resolve it through the canonical cascade. The
  # pre-P0 payload was the ResolvedTheme blob (cssVars/ramps/roles), which
  # was NOT the shape deserialize_resolved_theme expects and silently
  # dropped roleOverrides.
  edited <- theme_from_wire(final$theme)
  .echo_studio_snippet(edited, "done")
  edited
}

# Internal: a minimal sample WebSpec used when the studio is invoked with a
# theme alone (no chart-bearing spec).
.studio_sample_spec <- function(theme) {
  # Construct a forest plot with hand-crafted data so users see a representative
  # chart while editing colors.
  sample <- data.frame(
    study = c("Alpha 2024", "Beta 2023", "Gamma 2022", "Delta 2021"),
    region = c("Americas", "Americas", "Europe", "Asia"),
    n  = c(245, 189, 312, 478),
    hr = c(0.72, 0.81, 0.66, 0.91),
    lo = c(0.58, 0.65, 0.50, 0.78),
    hi = c(0.89, 1.01, 0.86, 1.06),
    stringsAsFactors = FALSE
  )
  spec <- tabviz(
    data = sample,
    label = "study",
    columns = list(
      col_text(field = "region", header = "Region"),
      col_n("n", header = "N"),
      col_interval("hr", "lo", "hi", header = "HR (95% CI)"),
      viz_forest(point = "hr", lower = "lo", upper = "hi")
    ),
    theme = theme
  )
  spec@labels$title <- "tabviz_studio -- sample"
  spec@labels$subtitle <- "Editing theme - sample data shown"
  spec
}

# Internal: echo an R-modifier pipe chain to the console on close.
# `theme` is the edited WebTheme (or NULL for cancel).
.echo_studio_snippet <- function(theme, action) {
  if (identical(action, "cancel")) {
    cli::cli_alert_info("Studio: cancelled (returning NULL).")
    return(invisible(NULL))
  }
  if (is.null(theme)) return(invisible(NULL))
  # For now: minimal echo. The actual setter-chain construction lives in the
  # JS-side snippet generator (passed back through the gadget) and is wired in
  # a follow-up.
  cli::cli_alert_success("Studio: theme returned. Assign to a variable to keep edits.")
  invisible(NULL)
}

#' List theme files saved by the user.
#'
#' Enumerates `*.json` files in the user theme directory
#' (`~/.tabviz/themes/` by default; override via
#' `options(tabviz.theme_dir = ...)`).
#'
#' @return A character vector of theme names (basenames without `.json`).
#' @export
list_user_themes <- function() {
  dir <- .tabviz_theme_dir()
  if (!dir.exists(dir)) return(character())
  files <- list.files(dir, pattern = "\\.json$", full.names = FALSE)
  tools::file_path_sans_ext(files)
}

# Internal: handle a studio_save_as Shiny payload (JSON string with
# {name, wire}). Validates the name (path-traversal guard), resolves the
# wire to prove it's a real theme, then persists the WIRE ENVELOPE
# VERBATIM (flow review F2 — not the 50x resolved blob; read_theme sniffs
# the shape on the way back). Returns the written path, or NULL on any
# rejection. Extracted from the observeEvent so the verbatim-write +
# traversal-guard behavior is unit-testable without a live Shiny session
# (round-2 test-gap audit: this F2 promise had no gate).
.studio_save_as_payload <- function(json) {
  payload <- tryCatch(
    jsonlite::fromJSON(json, simplifyVector = FALSE, simplifyDataFrame = FALSE),
    error = function(e) NULL
  )
  if (is.null(payload) || is.null(payload[["name"]]) || is.null(payload[["wire"]])) return(NULL)
  name <- payload[["name"]]
  if (!checkmate::test_string(name, pattern = "^[A-Za-z0-9._-]+$") ||
      grepl("..", name, fixed = TRUE)) {
    cli::cli_warn("Studio save-as: invalid theme name {.val {name}} (letters, digits, . _ - only).")
    return(NULL)
  }
  th <- tryCatch(theme_from_wire(payload[["wire"]]), error = function(e) NULL)
  if (is.null(th)) {
    cli::cli_warn("Studio save-as: could not resolve the posted theme wire.")
    return(NULL)
  }
  dir <- .tabviz_theme_dir()
  if (!dir.exists(dir)) dir.create(dir, recursive = TRUE)
  path <- file.path(dir, paste0(name, ".json"))
  jsonlite::write_json(payload[["wire"]], path,
                       auto_unbox = TRUE, pretty = TRUE, null = "null", digits = NA)
  path
}

#' Read a saved theme by name (or path).
#'
#' Loads a previously-saved theme JSON. If `x` is a bare name, looks up
#' under the user theme directory (`~/.tabviz/themes/` by default).
#' Otherwise treated as a path.
#'
#' @param x Theme name (e.g. `"my-blue"`), a path to a `.json` file, or a
#'   theme-wire JSON string (e.g. pasted from the viewer's "Edit in
#'   studio" handoff, which copies the portable wire to the clipboard).
#' @return A [WebTheme] reconstructed from the saved JSON.
#' @export
read_theme <- function(x) {
  checkmate::assert_string(x)
  # Inline wire JSON (theme-rework Wave 1): the viewer's "Edit in studio"
  # handoff copies the portable envelope to the clipboard, so a pasted
  # string IS a valid theme source — route it straight to the importer.
  # (Heuristic: starts with `{` and is not an existing path.)
  if (!file.exists(x) && grepl("^\\s*\\{", x)) {
    return(theme_from_wire(x))
  }
  path <- if (file.exists(x)) {
    x
  } else {
    file.path(.tabviz_theme_dir(), paste0(x, ".json"))
  }
  if (!file.exists(path)) {
    cli::cli_abort(c(
      "Theme {.val {x}} not found.",
      "i" = "Expected at {.path {path}}",
      "i" = "Use {.fn list_user_themes} to see available themes."
    ))
  }
  blob <- jsonlite::fromJSON(path, simplifyVector = FALSE, simplifyDataFrame = FALSE)
  # Two JSON shapes share the extension (P0 review #3): the WIRE ENVELOPE
  # ({$schema, inputs, roleOverrides} — what write_theme + the studio now
  # emit) and the legacy resolved blob (what write_theme USED to emit).
  # Route envelopes through the canonical importer.
  if (!is.null(blob[["$schema"]]) || (!is.null(blob[["inputs"]]) && !is.null(blob[["inputs"]][["anchors"]]))) {
    return(theme_from_wire(blob))
  }
  # Legacy resolved blob. It carries `authoringInputs` — reconstruct from
  # it so the round-trip preserves the AUTHORED theme. Round-2 review
  # blocker (3 personas): deserialize_resolved_theme stubs default inputs,
  # so re-reading a write_theme()-saved file used to return a DIFFERENT
  # theme (dark paper came back white) with no error. Rebuilding through
  # resolve_from_inputs mirrors the envelope path exactly.
  if (!is.null(blob[["authoringInputs"]])) {
    inputs <- theme_inputs_from_wire(blob[["authoringInputs"]])
    return(resolve_from_inputs(
      inputs,
      name = blob[["name"]] %||% "imported",
      role_overrides = blob[["roleOverrides"]] %||% list(),
      pins = blob[["pins"]] %||% list()
    ))
  }
  deserialize_resolved_theme(blob)
}

#' Build the portable wire envelope from a resolved theme.
#'
#' The R twin of the studio's export: returns the canonical, self-contained
#' artifact `{$schema, name, inputs, roleOverrides?, pins?}` — the same
#' shape `read_theme()` / [theme_from_wire()] consume and the studio
#' emits. This is what [write_theme()] persists. `roleOverrides` / `pins`
#' are omitted when empty so the JSON stays a clean object (and survives
#' the JS-side `parseThemeWire` shape check).
#'
#' @param theme A [WebTheme].
#' @return A named list ready for `jsonlite::toJSON(auto_unbox = TRUE)`.
#' @seealso [write_theme()], [theme_from_wire()], [read_theme()]
#' @export
theme_to_wire <- function(theme) {
  if (!inherits(theme, "tabviz::WebTheme")) {
    cli::cli_abort("{.arg theme} must be a {.cls WebTheme}.")
  }
  wire <- list(
    "$schema" = "tabviz-theme/v4",
    name = theme@name,
    inputs = theme_inputs_to_json(theme@inputs)
  )
  # roleOverrides serialize as NAME aliases ("neutral.5"), not positional
  # {ramp,grade} — DTCG-shaped + re-index-migratable (theme-rework Wave 0).
  if (length(theme@role_overrides) > 0L) {
    wire$roleOverrides <- .role_overrides_to_aliases(theme@role_overrides)
  }
  if (length(theme@pins) > 0L) wire$pins <- theme@pins
  wire
}

#' Write a theme to the user theme directory or to a file.
#'
#' Persists the portable **wire envelope** (`{$schema, name, inputs,
#' roleOverrides?, pins?}`) — the same self-contained artifact the studio
#' exports and [read_theme()] / [theme_from_wire()] consume. (It used to
#' write a resolved blob, which [read_theme()] could not faithfully
#' restore — round-2 review blocker.)
#'
#' @param theme A [WebTheme] to save.
#' @param name Bare registry name (e.g. `"my-blue"`); writes to
#'   `~/.tabviz/themes/<name>.json`. Mutually exclusive with `file`.
#' @param file Path to a `.json` file to write (e.g. a repo-committed
#'   theme that travels with a project). Mutually exclusive with `name`.
#' @return Invisibly, the path written.
#' @seealso [theme_to_wire()], [read_theme()]
#' @export
write_theme <- function(theme, name = NULL, file = NULL) {
  if (!inherits(theme, "tabviz::WebTheme")) {
    cli::cli_abort("{.arg theme} must be a {.cls WebTheme}.")
  }
  if (is.null(name) && is.null(file)) {
    cli::cli_abort(c(
      "Provide a destination.",
      "i" = "{.arg name} writes to the user theme registry; {.arg file} writes to a path."
    ))
  }
  if (!is.null(name) && !is.null(file)) {
    cli::cli_abort("Provide only one of {.arg name} or {.arg file}.")
  }
  path <- if (!is.null(file)) {
    checkmate::assert_string(file, min.chars = 1)
    file
  } else {
    # Bare-slug names only — `name` is pasted into a filesystem path
    # (round-2 robustness P1: "../x" wrote outside the theme dir).
    if (!checkmate::test_string(name, pattern = "^[A-Za-z0-9._-]+$") ||
        grepl("..", name, fixed = TRUE)) {
      cli::cli_abort(c(
        "{.arg name} must be a bare theme name (letters, digits, . _ - only).",
        "i" = "To write to an arbitrary path, use {.arg file}."
      ))
    }
    dir <- .tabviz_theme_dir()
    if (!dir.exists(dir)) dir.create(dir, recursive = TRUE)
    file.path(dir, paste0(name, ".json"))
  }
  jsonlite::write_json(theme_to_wire(theme), path,
                       auto_unbox = TRUE, pretty = TRUE, null = "null", digits = NA)
  cli::cli_alert_success("Theme written to {.path {path}}")
  invisible(path)
}

# Internal: resolve the user theme directory, respecting the option.
.tabviz_theme_dir <- function() {
  getOption("tabviz.theme_dir", default = file.path(Sys.getenv("HOME"), ".tabviz", "themes"))
}

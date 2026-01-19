# Annotation S7 classes for tabviz

#' ReferenceLine: Vertical reference line annotation
#'
#' @param x X-axis position for the line
#' @param label Optional label for the line
#' @param style Line style: "solid", "dashed", "dotted"
#' @param color Line color (optional, uses theme default)
#' @param width Line width in pixels (default 1)
#' @param opacity Line opacity from 0 to 1 (default 0.6)
#'
#' @export
ReferenceLine <- new_class(
  "ReferenceLine",
  properties = list(
    x = class_numeric,
    label = new_property(class_character, default = NA_character_),
    style = new_property(class_character, default = "dashed"),
    color = new_property(class_character, default = NA_character_),
    width = new_property(class_numeric, default = 1),
    opacity = new_property(class_numeric, default = 0.6)
  ),
  validator = function(self) {
    if (!self@style %in% c("solid", "dashed", "dotted")) {
      return("style must be 'solid', 'dashed', or 'dotted'")
    }
    if (self@width <= 0) {
      return("width must be positive")
    }
    if (self@opacity < 0 || self@opacity > 1) {
      return("opacity must be between 0 and 1")
    }
    NULL
  }
)

#' Create a reference line annotation
#'
#' Adds a vertical reference line to the forest plot at a specified x-axis
#' position. Commonly used to mark the null effect (e.g., 0 for differences,
#' 1 for ratios) or other clinically meaningful thresholds.
#'
#' @param x X-axis position for the line
#' @param label Optional label text displayed near the line
#' @param style Line style: "dashed" (default), "solid", or "dotted"
#' @param color Line color. If NULL, uses theme default
#' @param width Line width in pixels (default 1)
#' @param opacity Line opacity from 0 to 1 (default 0.6)
#'
#' @return A ReferenceLine object
#'
#' @examples
#' # Basic null line
#' forest_refline(1)
#'
#' # Labeled threshold with custom styling
#' forest_refline(0.5, label = "Clinically meaningful", style = "solid",
#'                width = 2, opacity = 0.8)
#'
#' @export
forest_refline <- function(
    x,
    label = NULL,
    style = c("dashed", "solid", "dotted"),
    color = NULL,
    width = 1,
    opacity = 0.6) {
  style <- match.arg(style)

  ReferenceLine(
    x = x,
    label = label %||% NA_character_,
    style = style,
    color = color %||% NA_character_,
    width = width,
    opacity = opacity
  )
}

#' CustomAnnotation: Custom shape annotation
#'
#' @param study_id Study to annotate
#' @param shape Shape type: "circle", "square", "triangle", "star"
#' @param position Position relative to point: "before", "after", "overlay"
#' @param color Shape color
#' @param size Shape size multiplier
#'
#' @export
CustomAnnotation <- new_class(
  "CustomAnnotation",
  properties = list(
    study_id = class_character,
    shape = new_property(class_character, default = "circle"),
    position = new_property(class_character, default = "after"),
    color = new_property(class_character, default = "#8b5cf6"),
    size = new_property(class_numeric, default = 1.0)
  ),
  validator = function(self) {
    if (!self@shape %in% c("circle", "square", "triangle", "star")) {
      return("shape must be 'circle', 'square', 'triangle', or 'star'")
    }
    if (!self@position %in% c("before", "after", "overlay")) {
      return("position must be 'before', 'after', or 'overlay'")
    }
    NULL
  }
)

#' Create a custom annotation
#'
#' @param study_id Study to annotate
#' @param shape Shape type
#' @param position Position
#' @param color Color
#' @param size Size multiplier
#'
#' @return A CustomAnnotation object
#' @export
forest_annotation <- function(
    study_id,
    shape = c("circle", "square", "triangle", "star"),
    position = c("after", "before", "overlay"),
    color = "#8b5cf6",
    size = 1.0) {
  shape <- match.arg(shape)
  position <- match.arg(position)

  CustomAnnotation(
    study_id = study_id,
    shape = shape,
    position = position,
    color = color,
    size = size
  )
}

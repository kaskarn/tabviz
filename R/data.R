# Documentation for package datasets

#' GLP-1 Agonist Cardiovascular Outcomes Trials
#'
#' A dataset containing results from cardiovascular outcomes trials of GLP-1
#' receptor agonists, suitable for demonstrating meta-analysis forest plots.
#' Data is stylized for educational purposes based on published trial results.
#'
#' @format A data frame with 24 rows and 14 variables:
#' \describe{
#'   \item{study}{Trial name or subgroup identifier}
#'   \item{drug}{GLP-1 agonist drug name}
#'   \item{year}{Year of primary publication}
#'   \item{n}{Sample size (total randomized)}
#'   \item{events}{Number of primary endpoint events}
#'   \item{hr}{Hazard ratio point estimate}
#'   \item{lower}{Lower bound of 95 percent confidence interval}
#'   \item{upper}{Upper bound of 95 percent confidence interval}
#'   \item{pvalue}{P-value for hazard ratio}
#'   \item{endpoint}{Primary endpoint (MACE = major adverse cardiovascular events)}
#'   \item{row_type}{Row type: data or summary}
#'   \item{row_bold}{Whether to display row in bold}
#'   \item{group}{Grouping variable for hierarchical display}
#' }
#'
#' @source Based on published cardiovascular outcomes trial data.
#'   Trial results are stylized for educational purposes.
#'
#' @examples
#' data(glp1_trials)
#' head(glp1_trials)
#'
"glp1_trials"

#' Airline Carrier Delay Performance
#'
#' A dataset containing airline performance metrics including delay times,
#' on-time percentages, and customer satisfaction scores. Data is simulated
#' but inspired by DOT aviation statistics.
#'
#' @format A data frame with 40 rows and 11 variables:
#' \describe{
#'   \item{carrier}{Airline carrier name}
#'   \item{carrier_type}{Carrier classification: Legacy, Low-Cost, or Ultra Low-Cost}
#'   \item{month}{Month of observation (Jan-Apr)}
#'   \item{delay_vs_avg}{Delay in minutes relative to industry average}
#'   \item{on_time_pct}{Proportion of flights arriving on time (0-1)}
#'   \item{satisfaction}{Customer satisfaction score (1-5 scale)}
#'   \item{flights}{Number of flights operated}
#'   \item{delay_lower}{Lower bound of delay estimate}
#'   \item{delay_upper}{Upper bound of delay estimate}
#'   \item{trend}{List column containing 12-month delay trend (sparkline data)}
#' }
#'
#' @source Simulated data inspired by U.S. DOT aviation statistics.
#'
#' @examples
#' data(airline_delays)
#' head(airline_delays)
#'
"airline_delays"

#' NBA Player Efficiency Ratings
#'
#' A fun dataset containing NBA player statistics including Player Efficiency
#' Rating (PER), points per game, and All-Star/award information.
#'
#' @format A data frame with 30 rows and 12 variables:
#' \describe{
#'   \item{player}{Player name}
#'   \item{team}{Team abbreviation}
#'   \item{conference}{NBA conference (East or West)}
#'   \item{position}{Primary position (G, F, or C)}
#'   \item{games}{Games played}
#'   \item{ppg}{Points per game}
#'   \item{per}{Player Efficiency Rating}
#'   \item{per_lower}{Lower bound of PER estimate}
#'   \item{per_upper}{Upper bound of PER estimate}
#'   \item{all_star}{Whether player was an All-Star}
#'   \item{award}{Notable award or honor}
#' }
#'
#' @source Simulated data based on typical NBA statistics.
#'
#' @examples
#' data(nba_efficiency)
#' head(nba_efficiency)
#'
"nba_efficiency"

#' Regional Climate Temperature Anomalies
#'
#' A minimal dataset showing temperature anomalies relative to pre-industrial
#' baseline across different regions and time periods.
#'
#' @format A data frame with 20 rows and 7 variables:
#' \describe{
#'   \item{region}{Geographic region or category}
#'   \item{period}{Time period of measurement}
#'   \item{anomaly}{Temperature anomaly in degrees Celsius}
#'   \item{lower}{Lower bound of uncertainty range}
#'   \item{upper}{Upper bound of uncertainty range}
#'   \item{certainty}{Confidence level: High or Medium}
#'   \item{category}{Category grouping (Global, Hemisphere, Continental, etc.)}
#' }
#'
#' @source Simulated data based on climate science literature.
#'
#' @examples
#' data(climate_temps)
#' head(climate_temps)
#'
"climate_temps"

#' Effect Sizes with Varying Precision (Stress Test Dataset)
#'
#' A dataset designed to stress test forest plot axis rendering and subgroup
#' splitting logic. Contains studies with widely varying confidence interval
#' widths, from highly precise large trials to exploratory studies with CIs
#' that extend far beyond typical axis limits.
#'
#' This dataset is useful for testing:
#' \itemize{
#'   \item Axis range calculation with extreme CI bounds
#'   \item CI clipping and arrow indicators
#'   \item \code{split_by} / \code{plot_by} with multiple grouping variables
#'   \item Edge cases: very wide CIs, null effects, extreme effect sizes
#' }
#'
#' @format A data frame with 20 rows and 12 variables:
#' \describe{
#'   \item{study}{Study or site name}
#'   \item{region}{Geographic region: North America, Europe, or Asia Pacific}
#'   \item{outcome}{Outcome type: Primary, Secondary, or Exploratory}
#'   \item{treatment}{Treatment arm: Drug A, Drug B, or Combination}
#'   \item{phase}{Trial phase: Phase 1, Phase 2, or Phase 3}
#'   \item{n}{Sample size}
#'   \item{hr}{Hazard ratio point estimate}
#'   \item{lower}{Lower bound of 95 percent confidence interval}
#'   \item{upper}{Upper bound of 95 percent confidence interval}
#'   \item{se}{Standard error (log scale)}
#'   \item{significant}{Logical: whether CI excludes 1.0}
#'   \item{direction}{Effect direction: Favors Treatment or Favors Control}
#' }
#'
#' @source Simulated data designed to test edge cases in forest plot rendering.
#'
#' @examples
#' data(effect_sizes)
#'
#' # Basic plot - note how axis adapts to varying CI widths
#' forest_plot(effect_sizes,
#'             point = "hr", lower = "lower", upper = "upper",
#'             label = "study", scale = "log")
#'
#' # Split by region to test subgroup navigation
#' forest_plot(effect_sizes,
#'             point = "hr", lower = "lower", upper = "upper",
#'             label = "study", scale = "log", split_by = "region")
#'
#' # Split by multiple variables for hierarchical navigation
#' effect_sizes |>
#'   web_spec(
#'     label = "study",
#'     columns = list(
#'       col_forest(point = "hr", lower = "lower", upper = "upper", scale = "log")
#'     )
#'   ) |>
#'   split_table(by = c("outcome", "treatment")) |>
#'   forest_plot()
#'
"effect_sizes"

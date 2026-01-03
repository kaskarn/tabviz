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
#' @format A data frame with 40 rows and 10 variables:
#' \describe{
#'   \item{carrier}{Airline carrier name}
#'   \item{month}{Month of observation (Jan-Apr)}
#'   \item{delay_vs_avg}{Delay in minutes relative to industry average}
#'   \item{on_time_pct}{Percentage of flights arriving on time}
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

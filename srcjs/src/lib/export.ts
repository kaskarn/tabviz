/**
 * Export utilities for forest plot static image generation
 *
 * Uses the pure-data svg-generator for both SVG and PNG export.
 */

import type { WebSpec } from "$types";
import { generateSVG, svgToBlob } from "./svg-generator";

export type { ExportOptions } from "./svg-generator";

/**
 * Export spec as SVG string
 *
 * @param spec - The WebSpec object containing plot data and configuration
 * @param options - Optional export options (dimensions, column widths)
 * @returns SVG string
 */
export function exportToSVG(spec: WebSpec, options?: ExportOptions): string {
  return generateSVG(spec, options);
}

/**
 * Export spec as PNG blob
 *
 * @param spec - The WebSpec object containing plot data and configuration
 * @param options - Optional export options (dimensions, column widths)
 * @param scale - Scale factor for resolution (default 2 for retina)
 * @returns Promise resolving to PNG Blob
 */
export async function exportToPNG(spec: WebSpec, options?: ExportOptions, scale: number = 2): Promise<Blob> {
  const svgString = generateSVG(spec, options);
  return svgToBlob(svgString, scale);
}

/**
 * Trigger file download in browser
 *
 * @param blob - The file blob to download
 * @param filename - The filename for the download
 */
export function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Generate a default filename based on current timestamp
 *
 * @param extension - File extension (svg, png)
 * @returns Filename string
 */
export function generateFilename(extension: "svg" | "png"): string {
  const now = new Date();
  const timestamp = now.toISOString().slice(0, 19).replace(/[:-]/g, "");
  return `forest_plot_${timestamp}.${extension}`;
}

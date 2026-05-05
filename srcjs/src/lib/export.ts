/**
 * Export utilities for forest plot static image generation
 *
 * Uses the pure-data svg-generator for both SVG and PNG export.
 */

import type { WebSpec } from "$types";
import { generateSVG, svgToBlob, type ExportOptions } from "./svg-generator";

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
 * Heuristic for environments where `<a download>` silently no-ops.
 *
 * VSCode webviews enforce CSP/sandbox at the host level: anchor-click
 * downloads return without error but never produce a file. Sandboxed
 * iframes without `allow-downloads` behave the same. Detection has to be
 * pre-flight because the failure is silent — there's no event to listen
 * for. Heuristic, not perfect; UA strings drift, so the modal path is
 * always safe (it shows content the user can copy or save manually).
 */
export function downloadsLikelyBlocked(): boolean {
  if (typeof window === "undefined") return false;
  if (typeof navigator !== "undefined" && /vscode/i.test(navigator.userAgent)) {
    return true;
  }
  try {
    const frame = window.frameElement as HTMLIFrameElement | null;
    const sandbox = frame?.sandbox;
    if (sandbox && sandbox.length > 0 && !sandbox.contains("allow-downloads")) {
      return true;
    }
  } catch {
    // Cross-origin access throws — assume not blocked in that case.
  }
  return false;
}

/**
 * Try the File System Access API. User-gesture-initiated; works in some
 * restricted contexts where anchor.click() silently fails.
 *
 * Returns:
 *   "saved"     — file written
 *   "cancelled" — user dismissed the picker (don't fall through)
 *   "unsupported" — feature missing or threw; caller should try the next tier
 */
export async function tryShowSaveFilePicker(
  blob: Blob,
  filename: string,
  mimeType: string,
): Promise<"saved" | "cancelled" | "unsupported"> {
  const w = window as unknown as {
    showSaveFilePicker?: (opts: {
      suggestedName?: string;
      types?: { description: string; accept: Record<string, string[]> }[];
    }) => Promise<FileSystemFileHandle>;
  };
  if (typeof w.showSaveFilePicker !== "function") return "unsupported";
  try {
    const ext = filename.split(".").pop() ?? "";
    const handle = await w.showSaveFilePicker({
      suggestedName: filename,
      types: [
        {
          description: ext.toUpperCase() || "File",
          accept: { [mimeType]: [`.${ext}`] },
        },
      ],
    });
    const writable = await (handle as unknown as {
      createWritable: () => Promise<{
        write: (data: Blob) => Promise<void>;
        close: () => Promise<void>;
      }>;
    }).createWritable();
    await writable.write(blob);
    await writable.close();
    return "saved";
  } catch (err) {
    // AbortError means the user dismissed the picker — that's a deliberate
    // "cancel", not a failure to fall through from.
    if (err instanceof DOMException && err.name === "AbortError") {
      return "cancelled";
    }
    return "unsupported";
  }
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

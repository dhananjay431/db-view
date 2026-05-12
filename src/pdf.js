/**
 * db-view PDF renderer with proper memory management
 * Handles PDF rendering with blob URL management and cleanup
 */

import {assetCache, cleanupContainer} from "./utils.js";

/**
 * Creates a PDF viewer with proper memory management
 * Blob URLs are stored in the asset cache for proper cleanup
 * @param {string} data - Base64 encoded PDF data
 * @returns {string} - The blob URL for the PDF
 */
export default function pdf(data) {
  try {
    // Validate input
    if (typeof data !== "string" || !data.trim()) {
      throw new Error("Invalid PDF data: data must be a non-empty string");
    }

    // Remove base64 prefix if present
    if (data.indexOf("base64,") !== -1) {
      data = data.split("base64,")[1];
    }

    // Remove all whitespace
    data = data.replace(/\s+/g, "");

    if (!data) {
      throw new Error("Invalid PDF data: empty after processing");
    }

    // Decode base64 to binary
    const binaryString = atob(data);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);

    for (let i = 0; i < len; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    // Create blob
    const blob = new Blob([bytes], {type: "application/pdf"});

    // Create blob URL
    const blobUrl = URL.createObjectURL(blob);

    // Store in cache with cleanup handler
    const cacheKey = `pdf-${Date.now()}-${Math.random().toString(36).substring(7)}`;
    assetCache.set(cacheKey, {
      url: blobUrl,
      blob: blob,
      type: "pdf",
      createdAt: Date.now(),
    });

    // // Store the cache key in the URL for tracking
    // blobUrl.__cacheKey = cacheKey;

    return blobUrl;
  } catch (error) {
    console.error("Error creating PDF blob URL:", error);
    throw new Error(`Failed to create PDF: ${error.message}`);
  }
}

/**
 * Cleans up a PDF blob URL and its associated resources
 * @param {string} blobUrl - The blob URL to clean up
 */
export function cleanupPdf(blobUrl) {
  try {
    if (!blobUrl || typeof blobUrl !== "string") return;

    // Revoke the blob URL
    if (blobUrl.startsWith("blob:")) {
      URL.revokeObjectURL(blobUrl);
    }

    // Remove from cache
    const cacheKey = blobUrl.__cacheKey;
    if (cacheKey) {
      assetCache.delete(cacheKey);
    }
  } catch (error) {
    console.error("Error cleaning up PDF blob URL:", error);
  }
}

/**
 * Cleans up all PDF resources
 * Should be called when the PDF viewer is no longer needed
 */
export function cleanupAllPdfs() {
  for (const [key, value] of assetCache.entries()) {
    if (value && value.type === "pdf" && value.url) {
      try {
        if (value.url.startsWith("blob:")) {
          URL.revokeObjectURL(value.url);
        }
        assetCache.delete(key);
      } catch (error) {
        console.error(`Error cleaning up PDF cache entry ${key}:`, error);
      }
    }
  }
}

/**
 * Registers a cleanup callback for when the PDF iframe is unloaded
 * @param {HTMLIFrameElement} iframe - The iframe containing the PDF
 * @param {string} blobUrl - The blob URL used in the iframe
 */
export function registerPdfCleanup(iframe, blobUrl) {
  if (!iframe || !blobUrl) return;

  // Clean up when iframe is removed from DOM
  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      for (const node of mutation.removedNodes) {
        if (node === iframe || node.contains(iframe)) {
          cleanupPdf(blobUrl);
          observer.disconnect();
          break;
        }
      }
    }
  });

  if (iframe.parentNode) {
    observer.observe(iframe.parentNode, {childList: true});
  }

  // Also clean up on beforeunload
  window.addEventListener("beforeunload", () => {
    cleanupPdf(blobUrl);
    cleanupAllPdfs();
  });
}

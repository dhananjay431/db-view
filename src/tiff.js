/**
 * db-view TIFF renderer with proper canvas cleanup
 * Handles TIFF file rendering with memory management for canvas elements
 */

import * as UTIF from "./assets/UTIF.min.js";
import { cleanupContainer, cleanupBlobUrls } from "./utils.js";

/**
 * Renders a TIFF file with proper canvas cleanup
 * @param {string} base64 - Base64 encoded TIFF data
 * @param {string|HTMLElement} container - Container ID or element
 * @param {Object} options - Rendering options
 * @returns {Object} - TIFF viewer object
 */
export default function tiff(base64, container, options = {}) {
  try {
    // Get container if ID was passed
    if (typeof container === "string") {
      container = document.getElementById(container);
    }

    if (!container) {
      throw new Error("TIFF target container not found.");
    }

    // Clean up existing resources in container
    cleanupContainer(container);
    cleanupBlobUrls();

    // Remove data URL prefix if present
    if (typeof base64 === "string" && base64.indexOf("base64,") !== -1) {
      base64 = base64.split("base64,")[1];
    }

    // Validate input
    if (typeof base64 !== "string" || !base64.trim()) {
      throw new Error("Invalid TIFF data: data must be a non-empty string");
    }

    // Decode Base64 to binary
    const binary = atob(base64);
    const len = binary.length;
    const buffer = new ArrayBuffer(len);
    const view = new Uint8Array(buffer);

    for (let i = 0; i < len; i++) {
      view[i] = binary.charCodeAt(i);
    }

    // Decode TIFF using UTIF.js
    const pages = UTIF.decode(buffer);
    if (!pages || pages.length === 0) {
      throw new Error("Invalid TIFF file or no pages found.");
    }

    // Create container structure
    container.innerHTML = "";

    const imageWrapper = document.createElement("div");
    imageWrapper.style.textAlign = "center";
    imageWrapper.style.overflow = "auto";

    const img = document.createElement("img");
    img.alt = "tiff image";
    img.style.maxWidth = "100%";
    img.style.height = "auto";
    img.style.display = "block";
    img.style.margin = "0 auto";

    imageWrapper.appendChild(img);
    container.appendChild(imageWrapper);

    let currentIndex = 0;

    // Array to track created canvases for cleanup
    const createdCanvases = [];

    const renderPage = (index) => {
      // Clean up previous canvas if it exists
      if (currentIndex !== index && createdCanvases.length > 0) {
        const prevCanvas = createdCanvases[createdCanvases.length - 1];
        if (prevCanvas) {
          const ctx = prevCanvas.getContext("2d");
          if (ctx) {
            ctx.clearRect(0, 0, prevCanvas.width, prevCanvas.height);
          }
          prevCanvas.remove();
        }
        createdCanvases.pop();
      }

      const page = pages[index];
      UTIF.decodeImage(buffer, page);
      const rgba = UTIF.toRGBA8(page);

      const canvas = document.createElement("canvas");
      canvas.width = page.width;
      canvas.height = page.height;
      const ctx = canvas.getContext("2d");
      const imageData = ctx.createImageData(page.width, page.height);
      imageData.data.set(rgba);
      ctx.putImageData(imageData, 0, 0);

      createdCanvases.push(canvas);

      // Revoke any blob URL from previous image
      if (img.src && img.src.startsWith("blob:")) {
        URL.revokeObjectURL(img.src);
      }

      img.src = canvas.toDataURL("image/png");
      currentIndex = index;
    };

    renderPage(currentIndex);

    return {
      pages: pages.length,
      get currentIndex() {
        return currentIndex;
      },
      renderPage,
      // Cleanup method to free canvas resources
      cleanup: function () {
        createdCanvases.forEach((canvas) => {
          const ctx = canvas.getContext("2d");
          if (ctx) {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
          }
          canvas.remove();
        });
        createdCanvases.length = 0;
        cleanupBlobUrls();
      },
      // Next page method
      nextPage: function () {
        if (currentIndex < this.pages - 1) {
          this.renderPage(currentIndex + 1);
        }
      },
      // Previous page method
      previousPage: function () {
        if (currentIndex > 0) {
          this.renderPage(currentIndex - 1);
        }
      },
      // Go to specific page
      goToPage: function (page) {
        const pageNum = Math.max(0, Math.min(page, this.pages - 1));
        this.renderPage(pageNum);
      },
      // Reset view
      reset: function () {
        this.renderPage(0);
      },
    };
  } catch (error) {
    console.error("Error rendering TIFF:", error);
    if (container && container.parentNode) {
      container.innerHTML =
        '<div style="color: red; padding: 20px;">Failed to load TIFF image: ' +
        error.message +
        "</div>";
    }
    return null;
  }
}

/**
 * Cleans up all TIFF-related resources in a container
 * @param {string|HTMLElement} container - Container ID or element
 */
export function cleanupTiff(container) {
  if (typeof container === "string") {
    container = document.getElementById(container);
  }

  if (!container) return;

  // Clean up container
  cleanupContainer(container);

  // Revoke any blob URLs
  cleanupBlobUrls();
}

/**
 * Cleans up all TIFF resources globally
 * Should be called when the TIFF viewer is no longer needed
 */
export function cleanupAllTiffResources() {
  cleanupBlobUrls();
}
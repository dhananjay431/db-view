import pdf from "./pdf.js";
import png from "./png.js";
import jpeg from "./jpeg.js";
import eml from "./eml.js";
import html from "./html.js";
import xlsx from "./xlsx.js";
import doc from "./doc.js";
import txt from "./txt.js";
import svg from "./svg.js";
import tiff from "./tiff.js";
import msg from "./msg.js";
import { cleanupContainer, assetCache } from "./utils.js";

// Storage for event listeners and cleanup functions
const containers = new Map();
const eventListeners = new Map();

// Private cleanup function
function cleanupContainerInternal(containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;

  // Clean up all event listeners associated with this container
  if (eventListeners.has(containerId)) {
    eventListeners.get(containerId).forEach((listener) => {
      try {
        if (listener.target && listener.type && listener.listener) {
          listener.target.removeEventListener(listener.type, listener.listener);
        }
      } catch (e) {
        // Ignore errors
      }
    });
    eventListeners.delete(containerId);
  }

  // Clean up container contents
  cleanupContainer(container);

  // Clean up any canvas resources
  const canvases = container.querySelectorAll("canvas");
  canvases.forEach((canvas) => {
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
    canvas.remove();
  });

  // Revoke blob URLs
  const images = container.querySelectorAll("img");
  images.forEach((img) => {
    if (img.src && img.src.startsWith("blob:")) {
      URL.revokeObjectURL(img.src);
    }
  });

  // Clean up iframes
  const iframes = container.querySelectorAll("iframe");
  iframes.forEach((iframe) => {
    try {
      iframe.src = "about:blank";
    } catch (e) {
      // Ignore cross-origin errors
    }
    iframe.remove();
  });

  // Clear container
  container.innerHTML = "";
}

/**
 * db-view - Safe document viewer for various file formats
 * Provides XSS-safe rendering for documents with proper memory management
 */
const db = {
  /**
   * Show a document in a container
   * @param {string} data - Base64 encoded document data
   * @param {string} file - File name with extension
   * @param {string} id - Container element ID
   * @param {Object} options - Optional configuration
   */
  show: function (data, file, id, options = {}) {
    try {
      const container = document.getElementById(id);
      if (!container) {
        throw new Error("Container element not found: " + id);
      }

      // Store container reference for later cleanup
      containers.set(id, container);

      this.injectStyles();
      container.classList.add("db-view-container");

      // Clean up any existing resources in container
      cleanupContainerInternal(id);

      if (data) {
        if (data.indexOf("base64,") !== -1) {
          data = data.split("base64,")[1];
        }
        data = data.replace(/\s+/g, "");
      }

      const fileParts = file.split(".");
      const ext = fileParts.length > 1 ? fileParts.pop().toLowerCase() : "";

      // Store zoom history for this container
      if (!this.zoomHistory) {
        this.zoomHistory = {};
      }

      container.innerHTML = `
        ${
          ext !== "pdf"
            ? `
        <div class="zoom-controls">
          <button class="zoom-btn" title="Zoom In" onclick="window.zoomDbViewImage(this, 1.2)">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line><line x1="11" y1="8" x2="11" y2="14"></line><line x1="8" y1="11" x2="14" y2="11"></line></svg>
          </button>
          <button class="zoom-btn" title="Zoom Out" onclick="window.zoomDbViewImage(this, 1/1.2)">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24" 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line><line x1="8" y1="11" x2="14" y2="11"></line></svg>
          </button>
          ${
            ext === "tif" || ext === "tiff"
              ? `
          <button class="zoom-btn" id="${id}-tiff-prev" type="button" title="Previous Page">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg>
          </button>
          <span id="${id}-tiff-page-info" style="font-weight:bold; align-self:center;">Page 1 / 1</span>
          <button class="zoom-btn" id="${id}-tiff-next" type="button" title="Next Page">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>
          </button>
          `
              : ""
          }
        </div>
        `
            : ""
        }
        <div class="content-zoom-wrapper"${ext === "pdf" ? ' style="padding: 0; border: none; background: transparent;"' : ""}>
          <div id="${id}-content-target" class="${ext !== "pdf" ? "zoom-target" : ""}" data-scale="1">
          </div>
        </div>
      `;

      const contentContainer = document.getElementById(`${id}-content-target`);
      if (!contentContainer) {
        throw new Error("Content container not found: " + id);
      }

      if (ext === "pdf") {
        document.getElementById(id).innerHTML = "";
        const iframe = document.createElement("iframe");
        iframe.id = "pdfFrame";
        iframe.width = "100%";
        iframe.style.border = "none";
        iframe.style.height = "100vh";
        iframe.src = pdf(data);
        document.getElementById(id).appendChild(iframe);

        // Store iframe for cleanup
        this.pdfIframes = this.pdfIframes || {};
        this.pdfIframes[id] = iframe;
      } else if ("png" === ext) {
        contentContainer.innerHTML = png(data);
      } else if ("jpeg" === ext || "jpg" === ext) {
        contentContainer.innerHTML = jpeg(data);
      } else if ("eml" === ext) {
        contentContainer.innerHTML = eml(data);
      } else if ("msg" === ext) {
        contentContainer.innerHTML = msg(data);
      } else if ("html" === ext) {
        contentContainer.innerHTML = html(data);
      } else if ("xlsx" === ext || "xls" === ext || "csv" === ext) {
        xlsx(data)
          .then((htmlContent) => {
            contentContainer.innerHTML = htmlContent;
          })
          .catch((error) => {
            console.error("Error rendering XLSX:", error);
            contentContainer.innerHTML =
              '<div style="color: red; padding: 20px;">Error loading spreadsheet: ' +
              error.message +
              "</div>";
          });
      } else if ("docx" === ext || "doc" === ext) {
        doc(data, `${id}-content-target`)
          .then(() => {
            // Success
          })
          .catch((error) => {
            console.error("Error rendering DOCX:", error);
            contentContainer.innerHTML =
              '<div style="color: red; padding: 20px;">Error loading document: ' +
              error.message +
              "</div>";
          });
      } else if ("txt" === ext || "xml" === ext) {
        const pre = document.createElement("pre");
        pre.textContent = txt(data, id);
        contentContainer.appendChild(pre);
      } else if ("svg" === ext) {
        contentContainer.innerHTML = svg(data, id);
      } else if ("tif" === ext || "tiff" === ext) {
        contentContainer.innerHTML = "";
        const tiffViewer = tiff(data, contentContainer);

        if (!tiffViewer) {
          return;
        }

        const prevBtn = document.getElementById(`${id}-tiff-prev`);
        const nextBtn = document.getElementById(`${id}-tiff-next`);
        const pageInfo = document.getElementById(`${id}-tiff-page-info`);

        const updateTiffControls = () => {
          if (!pageInfo || !prevBtn || !nextBtn || !tiffViewer) return;
          pageInfo.textContent = `Page ${tiffViewer.currentIndex + 1} / ${tiffViewer.pages}`;
          prevBtn.disabled = tiffViewer.currentIndex === 0;
          nextBtn.disabled = tiffViewer.currentIndex === tiffViewer.pages - 1;
          prevBtn.style.opacity = prevBtn.disabled ? "0.5" : "1";
          nextBtn.style.opacity = nextBtn.disabled ? "0.5" : "1";
        };

        // Store tiff viewer for cleanup
        this.tiffViewers = this.tiffViewers || {};
        this.tiffViewers[id] = tiffViewer;

        if (prevBtn) {
          const listener = () => {
            if (tiffViewer.currentIndex > 0) {
              tiffViewer.renderPage(tiffViewer.currentIndex - 1);
              updateTiffControls();
            }
          };
          prevBtn.addEventListener("click", listener);
          this._storeEventListener(id, prevBtn, "click", listener);
        }

        if (nextBtn) {
          const listener = () => {
            if (tiffViewer.currentIndex < tiffViewer.pages - 1) {
              tiffViewer.renderPage(tiffViewer.currentIndex + 1);
              updateTiffControls();
            }
          };
          nextBtn.addEventListener("click", listener);
          this._storeEventListener(id, nextBtn, "click", listener);
        }

        updateTiffControls();
      }
    } catch (error) {
      console.error("Error in dbView.show:", error);
      throw error;
    }
  },

  /**
   * Inject styles into the document
   */
  injectStyles: function () {
    if (document.getElementById("db-view-styles")) return;
    const style = document.createElement("style");
    style.id = "db-view-styles";
    style.innerHTML = `
      .db-view-container {
        width: 100%;
        max-width: 100%;
        overflow-x: auto;
        box-sizing: border-box;
        font-family: "Segoe UI", Tahoma, Geneva, Verdana, sans-serif;
      }
      .db-view-container img, .db-view-container svg {
        max-width: 100%;
        height: auto;
        display: block;
        margin: 0 auto;
      }
      .db-view-container iframe {
        width: 100%;
        height: 100vh;
        min-height: 600px;
        border: none;
      }
      .db-view-container pre {
        white-space: pre-wrap;
        word-wrap: break-word;
        background: #f4f4f4;
        padding: 15px;
        border-radius: 8px;
      }
      .db-view-container .xlsx-wrapper {
        width: 100%;
        overflow-x: auto;
      }
      .db-view-container table {
        border-collapse: collapse;
        width: 100%;
        background-color: white;
        font-size: 14px;
      }
      .db-view-container table th, .db-view-container table td {
        padding: 12px 15px;
        border: 1px solid #e0e0e0;
      }
      .db-view-container table tr:first-child {
        background-color: #ccc;
        color: #000;
        font-weight: bold;
        text-align: left;
      }
      .db-view-container table tr:nth-child(even) {
        background-color: #f8f9fa;
      }
      /* Simple style overrides for docx-preview to make it responsive */
      .db-view-container .docx-wrapper {
        padding: 0 !important;
        background: transparent !important;
      }
      .db-view-container .docx-wrapper > section.docx {
        width: 100% !important;
        padding: 20px !important;
        box-sizing: border-box !important;
        box-shadow: none !important;
        margin-bottom: 0 !important;
      }
      /* Zoom functionality styles */
      .zoom-controls {
        display: flex;
        justify-content: center;
        gap: 10px;
        margin-bottom: 15px;
        padding: 10px;
      }
      .zoom-btn {
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 8px 12px;
        background-color: #007bff;
        color: white;
        border: none;
        border-radius: 4px;
        cursor: pointer;
        transition: background-color 0.2s;
      }
      .zoom-btn svg {
        width: 20px;
        height: 20px;
      }
      .zoom-btn:hover {
        background-color: #0056b3;
      }
      .content-zoom-wrapper {
        overflow: auto;
        height: 100vh;
        text-align: center;
        border: 1px solid #eee;
        padding: 20px;
        background: #fafafa;
      }
      .zoom-target {
        transition: transform 0.2s ease;
        transform-origin: top center;
        display: inline-block;
        min-width: 100%;
      }
    `;
    document.head.appendChild(style);
  },

  /**
   * Store event listener for later cleanup
   */
  _storeEventListener: function (containerId, target, type, listener) {
    if (!eventListeners.has(containerId)) {
      eventListeners.set(containerId, []);
    }
    eventListeners.get(containerId).push({
      target,
      type,
      listener,
    });
  },

  /**
   * Zoom a document in a container
   * @param {string} containerId - Container element ID
   * @param {number} factor - Zoom factor
   */
  zoom: function (containerId, factor) {
    if (!this.zoomHistory) {
      this.zoomHistory = {};
    }
    if (!this.zoomHistory[containerId]) {
      this.zoomHistory[containerId] = 1;
    }

    const container = document.getElementById(containerId);
    if (!container) return;

    const wrapper = container.querySelector(".content-zoom-wrapper");
    if (!wrapper) return;

    let scale = this.zoomHistory[containerId] || 1;
    scale *= factor;
    scale = Math.max(0.5, Math.min(scale, 3)); // Clamp scale between 0.5 and 3

    this.zoomHistory[containerId] = scale;
    wrapper.style.transform = "scale(" + scale + ")";
  },

  /**
   * Reset zoom for a container
   * @param {string} containerId - Container element ID
   */
  resetZoom: function (containerId) {
    if (!this.zoomHistory) {
      this.zoomHistory = {};
    }
    this.zoomHistory[containerId] = 1;

    const container = document.getElementById(containerId);
    if (!container) return;

    const wrapper = container.querySelector(".content-zoom-wrapper");
    if (wrapper) {
      wrapper.style.transform = "scale(1)";
    }
  },

  /**
   * Cleanup resources for a specific container
   * @param {string} containerId - Container element ID
   */
  cleanup: function (containerId) {
    cleanupContainerInternal(containerId);

    // Clean up PDF iframes
    if (this.pdfIframes && this.pdfIframes[containerId]) {
      const iframe = this.pdfIframes[containerId];
      if (iframe) {
        iframe.src = "about:blank";
        iframe.remove();
      }
      delete this.pdfIframes[containerId];
    }

    // Clean up TIFF viewers
    if (this.tiffViewers && this.tiffViewers[containerId]) {
      const tiffViewer = this.tiffViewers[containerId];
      if (tiffViewer && tiffViewer.cleanup) {
        tiffViewer.cleanup();
      }
      delete this.tiffViewers[containerId];
    }
  },

  /**
   * Cleanup all resources
   */
  cleanupAll: function () {
    // Clean up all event listeners
    for (const [containerId, listeners] of eventListeners.entries()) {
      listeners.forEach((listener) => {
        try {
          if (listener.target && listener.type && listener.listener) {
            listener.target.removeEventListener(
              listener.type,
              listener.listener,
            );
          }
        } catch (e) {
          // Ignore errors
        }
      });
    }
    eventListeners.clear();

    // Clean up all containers
    for (const containerId of containers.keys()) {
      cleanupContainerInternal(containerId);
    }
    containers.clear();

    // Clean up all blob URLs
    for (const [key, value] of assetCache.entries()) {
      if (value && typeof value === "string" && value.startsWith("blob:")) {
        URL.revokeObjectURL(value);
      }
    }
    assetCache.clear();

    // Clean up PDF iframes
    if (this.pdfIframes) {
      for (const id in this.pdfIframes) {
        const iframe = this.pdfIframes[id];
        if (iframe) {
          iframe.src = "about:blank";
          iframe.remove();
        }
      }
      this.pdfIframes = {};
    }

    // Clean up TIFF viewers
    if (this.tiffViewers) {
      for (const id in this.tiffViewers) {
        const tiffViewer = this.tiffViewers[id];
        if (tiffViewer && tiffViewer.cleanup) {
          tiffViewer.cleanup();
        }
      }
      this.tiffViewers = {};
    }

    // Reset zoom history
    this.zoomHistory = {};
  },

  /**
   * Get version
   * @returns {string} - Version string
   */
  getVersion: function () {
    return "1.0.0";
  },

  /**
   * Export cleanup functions for external use
   */
  cleanupContainer: cleanupContainerInternal,
};

// Expose globally for backwards compatibility
if (typeof window !== "undefined") {
  window.db = db;

  // Expose zoom function globally
  if (!window.zoomDbViewImage) {
    window.zoomDbViewImage = function (button, factor) {
      const container = button.closest(".db-view-container");
      if (!container) return;

      const containerId = container.id;
      db.zoom(containerId, factor);
    };
  }

  // Cleanup on page unload
  window.addEventListener("beforeunload", () => {
    db.cleanupAll();
  });
}

// Export as ES6 module
export { db };

// Re-export all file renderers for direct import
export { pdf, png, jpeg, eml, html, xlsx, doc, txt, svg, tiff, msg };

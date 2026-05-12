/**
 * db-view DOCX renderer with proper error handling
 * Uses docx-preview library to render Word documents
 */

import { waitForDomReady, safeExecute } from "./utils.js";

/**
 * Renders a DOCX file with proper error handling
 * @param {string} data - Base64 encoded DOCX data
 * @param {string|HTMLElement} id - Container ID or element
 * @param {Object} options - Rendering options
 * @returns {Promise<void>}
 */
export default async function doc(data, id, options = {}) {
  try {
    // Validate inputs
    if (typeof data !== "string" || !data.trim()) {
      throw new Error("Invalid DOCX data: data must be a non-empty string");
    }

    // Get container
    const container = typeof id === "string" 
      ? document.getElementById(id) 
      : id;

    if (!container) {
      throw new Error(`DOCX container not found: ${id}`);
    }

    // Remove base64 prefix if present
    if (data.indexOf("base64,") !== -1) {
      data = data.split("base64,")[1];
    }

    // Remove whitespace
    data = data.replace(/\s+/g, "");

    if (!data) {
      throw new Error("Invalid DOCX data: empty after processing");
    }

    // Wait for DOM to be ready
    await waitForDomReady();

    // Validate binary data
    const binaryString = atob(data);
    if (!binaryString || binaryString.length === 0) {
      throw new Error("Invalid DOCX data: failed to decode base64");
    }

    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    // Import and render with docx-preview
    const docxModule = await import("./assets/docx-preview.min.js");
    
    if (typeof docxModule.renderAsync === "function") {
      await docxModule.renderAsync(bytes.buffer, container, null, {
        useMathMLPolyfill: true,
        ...options,
      });
    } else {
      throw new Error("docx-preview.renderAsync is not a function");
    }

  } catch (error) {
    console.error("Error rendering DOCX file:", error);
    throw new Error(`Failed to render DOCX: ${error.message}`);
  }
}

/**
 * Renders a DOCX file with fallback error handling
 * @param {string} data - Base64 encoded DOCX data
 * @param {string|HTMLElement} id - Container ID or element
 * @param {Object} options - Rendering options
 * @returns {Promise<void>}
 */
export function renderDocWithFallback(data, id, options = {}) {
  return new Promise((resolve, reject) => {
    doc(data, id, options)
      .then(() => resolve())
      .catch((error) => {
        console.error("DOCX rendering failed:", error);
        reject(error);
      });
  });
}

/**
 * Attempts to render DOCX with multiple fallback strategies
 * @param {string} data - Base64 encoded DOCX data
 * @param {string|HTMLElement} id - Container ID or element
 * @param {Object} options - Rendering options
 * @returns {Promise<void>}
 */
export async function renderDocWithRetry(data, id, options = {}, maxRetries = 2) {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await doc(data, id, options);
    } catch (error) {
      if (attempt === maxRetries) {
        throw error;
      }
      console.warn(`DOCX rendering attempt ${attempt + 1} failed, retrying...`);
      // Wait before retrying
      await new Promise((resolve) => setTimeout(resolve, 100 * (attempt + 1)));
    }
  }
}

/**
 * Cleans up DOCX rendering resources
 * @param {HTMLElement} container - The container element
 */
export function cleanupDoc(container) {
  if (!container) return;

  // Remove any canvas elements created by docx-preview
  const canvases = container.querySelectorAll("canvas");
  canvases.forEach((canvas) => {
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
    canvas.remove();
  });

  // Clear container
  container.innerHTML = "";
}
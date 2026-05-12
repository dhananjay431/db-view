/**
 * db-view TXT file renderer with proper error handling
 * Safely renders text content with proper encoding and error handling
 */

import {escapeHtml, isValidBase64} from "./utils.js";

/**
 * Renders a text file with proper error handling
 * @param {string} data - Base64 encoded text data
 * @param {string|Object} id - Container ID or options object
 * @param {Object} options - Rendering options
 * @returns {string} - HTML content with text
 */
export default function txt(data, id, options = {}) {
  try {
    // Handle different input formats
    if (typeof id === "object" && id !== null) {
      options = id;
      id = null;
    }

    // Validate input
    if (typeof data !== "string" || !data.trim()) {
      throw new Error("Invalid TXT data: data must be a non-empty string");
    }

    // Remove base64 prefix if present
    if (data.indexOf("base64,") !== -1) {
      data = data.split("base64,")[1];
    }

    // Remove whitespace
    data = data.replace(/\s+/g, "");

    if (!data) {
      throw new Error("Invalid TXT data: empty after processing");
    }

    // Validate base64 if needed
    if (isValidBase64(data)) {
      data = atob(data);
    }

    // Get options with defaults
    const {wrapText = true, escapeHtmlContent = true, preId = null} = options;

    // Escape HTML content if requested
    let content = data;
    if (escapeHtmlContent) {
      content = escapeHtml(data);
    }

    // Process line breaks and whitespace
    if (wrapText) {
      content = content.replace(/\n/g, "<br>");
      // Preserve multiple spaces
      content = content.replace(/  /g, " &nbsp;");
    }

    // Build output
    const result = content;

    if (id) {
      // If ID is provided, return HTML string with pre element
      const preIdAttr = preId ? ` id="${preId}"` : "";
      return `<pre${preIdAttr} style="white-space: pre-wrap; word-wrap: break-word; background: #f4f4f4; padding: 15px; border-radius: 8px; font-family: monospace;">${result}</pre>`;
    }

    return result;
  } catch (error) {
    console.error("Error rendering TXT content:", error);
    const errorMsg = escapeHtml(`Error loading text content: ${error.message}`);
    return `<pre style="color: red; padding: 20px; font-family: monospace;">${errorMsg}</pre>`;
  }
}

/**
 * Renders plain text content safely (deprecated, kept for backwards compatibility)
 * @param {string} data - Base64 encoded text data
 * @param {string} id - Container ID
 * @returns {string} - HTML content
 */
export function renderPlainText(data, id) {
  return txt(data, id, {escapeHtmlContent: true});
}

/**
 * Renders text content without HTML escaping
 * WARNING: Use only with trusted content
 * @param {string} data - Base64 encoded text data
 * @param {string} id - Container ID
 * @returns {string} - HTML content
 */
export function renderPlainTextUnescaped(data, id) {
  return txt(data, id, {escapeHtmlContent: false});
}

/**
 * Clean text content by removing potentially dangerous patterns
 * @param {string} text - Text to clean
 * @returns {string} - Cleaned text
 */
function cleanTextContent(text) {
  if (typeof text !== "string") return "";

  // Remove null bytes
  text = text.replace(/\0/g, "");

  // Remove null characters
  text = text.replace(/\u0000/g, "");

  return text;
}

/**
 * Validate text encoding and return content
 * @param {string} data - Base64 encoded text data
 * @returns {string} - Decoded text content
 */
function validateAndDecodeText(data) {
  // Remove base64 prefix if present
  if (data.indexOf("base64,") !== -1) {
    data = data.split("base64,")[1];
  }

  // Validate base64
  if (!isValidBase64(data)) {
    throw new Error("Invalid base64 encoding in text data");
  }

  // Decode
  const decoded = atob(data);

  // Clean content
  return cleanTextContent(decoded);
}

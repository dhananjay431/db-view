/**
 * db-view SVG file renderer with proper error handling
 * Safely renders SVG content with error handling and validation
 */

import {escapeHtml, sanitizeSvg, sanitizeHtml} from "./sanitizer.js";
import {isValidBase64} from "./utils.js";

/**
 * Renders an SVG file with proper error handling
 * @param {string} data - Base64 encoded SVG data
 * @param {string} id - Container ID
 * @param {Object} options - Rendering options
 * @returns {string} - HTML content with SVG
 */
export default function svg(data, id, options = {}) {
  try {
    // Validate input
    if (typeof data !== "string" || !data.trim()) {
      throw new Error("Invalid SVG data: data must be a non-empty string");
    }

    // Remove base64 prefix if present
    if (data.indexOf("base64,") !== -1) {
      data = data.split("base64,")[1];
    }

    // Remove whitespace
    data = data.replace(/\s+/g, "");

    if (!data) {
      throw new Error("Invalid SVG data: empty after processing");
    }

    // Validate base64
    if (!isValidBase64(data)) {
      throw new Error("Invalid base64 encoding in SVG data");
    }

    // Decode base64
    const svgContent = atob(data);

    // Sanitize SVG content to prevent XSS
    const sanitizedSvg = sanitizeSvg(svgContent, options);

    if (!sanitizedSvg) {
      throw new Error("SVG content is empty or invalid after sanitization");
    }

    // Get options with defaults
    const {alt = "svg image", className = "", style = ""} = options;

    // Build SVG content
    const sanitizedContent = sanitizeHtml(sanitizedSvg);

    // Return SVG content
    return (
      '<div class="svg-container" style="text-align: center; overflow: auto;">' +
      sanitizedContent +
      "</div>"
    );
  } catch (error) {
    console.error("Error rendering SVG content:", error);
    return (
      '<div class="svg-container" style="color: red; padding: 20px; text-align: center;">Error loading SVG content: ' +
      escapeHtml(error.message) +
      "</div>"
    );
  }
}

/**
 * Renders SVG content from raw SVG string
 * @param {string} svgContent - Raw SVG content
 * @param {Object} options - Rendering options
 * @returns {string} - HTML content with SVG
 */
export function renderSvgContent(svgContent, options = {}) {
  try {
    if (typeof svgContent !== "string" || !svgContent.trim()) {
      throw new Error("Invalid SVG content: must be a non-empty string");
    }

    // Sanitize content
    const sanitized = sanitizeSvg(svgContent, options);

    if (!sanitized) {
      throw new Error("SVG content is empty or invalid after sanitization");
    }

    return (
      '<div class="svg-container" style="text-align: center; overflow: auto;">' +
      sanitized +
      "</div>"
    );
  } catch (error) {
    console.error("Error rendering SVG content:", error);
    return (
      '<div class="svg-container" style="color: red; padding: 20px; text-align: center;">Error loading SVG content: ' +
      escapeHtml(error.message) +
      "</div>"
    );
  }
}

/**
 * Renders SVG content as an image tag
 * @param {string} data - Base64 encoded SVG data
 * @param {Object} options - Rendering options
 * @returns {string} - Image tag with SVG data
 */
export function renderSvgAsImage(data, options = {}) {
  try {
    // Validate input
    if (typeof data !== "string" || !data.trim()) {
      throw new Error("Invalid SVG data: data must be a non-empty string");
    }

    // Remove base64 prefix if present
    let base64Data = data;
    if (data.indexOf("base64,") !== -1) {
      base64Data = data.split("base64,")[1];
    }

    // Remove whitespace
    base64Data = base64Data.replace(/\s+/g, "");

    if (!base64Data) {
      throw new Error("Invalid SVG data: empty after processing");
    }

    // Validate base64
    if (!isValidBase64(base64Data)) {
      throw new Error("Invalid base64 encoding in SVG data");
    }

    // Get options with defaults
    const {alt = "svg image", className = "", style = ""} = options;

    // Build image tag with base64 SVG
    return (
      '<img src="data:image/svg+xml;base64,' +
      base64Data +
      '" alt="' +
      escapeHtml(alt) +
      '" class="' +
      escapeHtml(className) +
      '"' +
      (style ? ' style="' + escapeHtml(style) + '"' : "") +
      " />"
    );
  } catch (error) {
    console.error("Error rendering SVG image:", error);
    return (
      '<div style="color: red; padding: 20px;">Error loading SVG content: ' +
      escapeHtml(error.message) +
      "</div>"
    );
  }
}

/**
 * Validates SVG content for dangerous elements
 * @param {string} svgContent - Raw SVG content
 * @returns {boolean} - True if content is safe
 */
export function isSvgSafe(svgContent) {
  if (typeof svgContent !== "string") return false;

  // Check for dangerous elements
  const dangerousPatterns = [
    /<script/i,
    /<svg[^>]*onload/i,
    /<svg[^>]*onstart/i,
    /javascript:/i,
    /vbscript:/i,
    /data:text\/html/i,
  ];

  return !dangerousPatterns.some((pattern) => pattern.test(svgContent));
}

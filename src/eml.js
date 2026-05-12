/**
 * db-view EML file renderer with XSS protection
 * Properly sanitizes EML content to prevent XSS attacks
 */

import {sanitizeHtml, sanitizeEmlContent} from "./sanitizer.js";

/**
 * Renders an EML file content with proper XSS sanitization
 * EML files can contain both plain text and HTML content
 * @param {string} data - Base64 encoded EML content
 * @param {Object} options - Sanitization options
 * @returns {string} - Sanitized HTML content
 */
export default function eml(data, options = {}) {
  try {
    // Validate input
    if (typeof data !== "string" || !data.trim()) {
      throw new Error("Invalid EML data: data must be a non-empty string");
    }

    // Remove base64 prefix if present
    if (data.indexOf("base64,") !== -1) {
      data = data.split("base64,")[1];
    }

    // Remove whitespace
    data = data.replace(/\s+/g, "");

    if (!data) {
      throw new Error("Invalid EML data: empty after processing");
    }

    // Decode base64
    const decodedString = atob(data);

    // Sanitize the content to prevent XSS attacks
    const sanitizedContent = sanitizeHtml(decodedString, options);

    // Return sanitized content wrapped in a container
    return '<div class="eml-content">' + sanitizedContent + "</div>";
  } catch (error) {
    console.error("Error rendering EML content:", error);
    return (
      '<div class="eml-content" style="color: red; padding: 20px;">Error loading EML content: ' +
      error.message +
      "</div>"
    );
  }
}

/**
 * Renders plain text EML content safely
 * @param {string} text - Plain text content
 * @returns {string} - HTML with text content
 */
function renderPlainText(text) {
  // Escape HTML special characters
  const escaped = String(text)
    .replace(/&/g, "&")
    .replace(/</g, "<")
    .replace(/>/g, ">")

    .replace(/'/g, "&#039;")
    .replace(/\n/g, "<br>")
    .replace(/  /g, "&nbsp; ");

  return '<div class="eml-content">' + escaped + "</div>";
}

/**
 * Extracts HTML content from EML file
 * EML files may have multipart content with HTML parts
 * @param {string} content - Raw EML content
 * @returns {string|null} - Found HTML content or null
 */
function extractHtmlFromEml(content) {
  if (typeof content !== "string") return null;

  // Look for HTML content between content-type boundaries
  const htmlStart = content.indexOf("<html");
  if (htmlStart !== -1) {
    // Find the end of the HTML content
    const htmlEnd = content.toLowerCase().lastIndexOf("</html>");
    if (htmlEnd !== -1) {
      return content.substring(htmlStart, htmlEnd + 7);
    }
    // If no closing tag, return up to the next boundary or end
    const nextBoundary = content.indexOf("--", htmlStart);
    if (nextBoundary !== -1) {
      return content.substring(htmlStart, nextBoundary);
    }
    return content.substring(htmlStart);
  }

  return null;
}

/**
 * Extracts plain text content from EML file
 * @param {string} content - Raw EML content
 * @returns {string} - Plain text content
 */
function extractPlainText(content) {
  if (typeof content !== "string") return "";

  // Look for text/plain section
  const textStart = content.indexOf("text/plain");
  if (textStart !== -1) {
    // Find the start of actual text content
    const bodyStart = content.indexOf("\n\n", textStart);
    if (bodyStart !== -1) {
      const textSection = content.substring(bodyStart + 2);
      // Find the end of this section (next boundary or end of file)
      const boundaryIndex = textSection.indexOf("--");
      if (boundaryIndex !== -1) {
        return textSection.substring(0, boundaryIndex);
      }
      return textSection.trim();
    }
  }

  // If no text/plain section, return first non-empty line
  const lines = content.split("\n").filter((line) => line.trim());
  return lines.length > 0 ? lines[0] : content;
}

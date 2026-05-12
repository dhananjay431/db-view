/**
 * db-view EML file renderer with XSS protection
 * Properly parses EML/MIME structure and sanitizes content
 */

import {sanitizeHtml} from "./sanitizer.js";

/**
 * Decode quoted-printable content
 * @param {string} str - Quoted-printable encoded string
 * @returns {string} - Decoded string
 */
function decodeQuotedPrintable(str) {
  return str
    .replace(/=\r\n/g, "")
    .replace(/=([A-Fa-f0-9]{2})/g, (_, hex) =>
      String.fromCharCode(parseInt(hex, 16)),
    );
}

/**
 * Decode base64 string
 * @param {string} str - Base64 encoded string
 * @returns {string} - Decoded string
 */
function decodeBase64Str(str) {
  try {
    return atob(str.replace(/\s/g, ""));
  } catch (e) {
    return str;
  }
}

/**
 * Decode a MIME encoded-word (e.g., =?UTF-8?B?base64?= or =?UTF-8?Q?quoted?=)
 * @param {string} str - Encoded word
 * @returns {string} - Decoded string
 */
function decodeMimeWord(str) {
  return str.replace(
    /=\?([^?]+)\?([BbQq])\?([^?]*)\?=/g,
    (_, charset, encoding, data) => {
      try {
        if (encoding.toUpperCase() === "B") {
          return decodeBase64Str(data);
        } else {
          return decodeQuotedPrintable(data);
        }
      } catch (e) {
        return data;
      }
    },
  );
}

/**
 * Parse email headers from raw EML content
 * @param {string} content - Raw EML content
 * @returns {{headers: Object, bodyStart: number}} - Parsed headers and body index
 */
function parseHeaders(content) {
  const headers = {};
  const headerEnd = content.indexOf("\n\n");

  if (headerEnd === -1) return {headers, bodyStart: 0};

  const headerSection = content.substring(0, headerEnd);
  let currentKey = null;

  for (const line of headerSection.split("\n")) {
    // Continuation line (starts with whitespace)
    if ((line.startsWith(" ") || line.startsWith("\t")) && currentKey) {
      headers[currentKey] += line.trim();
      continue;
    }

    const colonIdx = line.indexOf(":");
    if (colonIdx === -1) continue;

    currentKey = line.substring(0, colonIdx).toLowerCase().trim();
    const value = line.substring(colonIdx + 1).trim();
    headers[currentKey] = decodeMimeWord(value);
  }

  return {headers, bodyStart: headerEnd + 2};
}

/**
 * Parse multipart boundary from Content-Type header
 * @param {string} contentType - Content-Type header value
 * @returns {string|null} - Boundary string or null
 */
function getBoundary(contentType) {
  if (!contentType) return null;
  const match = contentType.match(/boundary\s*=\s*"?([^";\s]+)"?/i);
  return match ? match[1] : null;
}

/**
 * Get MIME type from Content-Type header
 * @param {string} contentType - Content-Type header value
 * @returns {string} - MIME type (lowercase)
 */
function getMimeType(contentType) {
  if (!contentType) return "text/plain";
  return contentType.split(";")[0].trim().toLowerCase();
}

/**
 * Get encoding from Content-Transfer-Encoding header
 * @param {string} cte - Content-Transfer-Encoding value
 * @returns {string} - Normalized encoding name
 */
function getEncoding(cte) {
  if (!cte) return "7bit";
  const e = cte.trim().toLowerCase();
  if (e === "quoted-printable") return "qp";
  if (e === "base64") return "base64";
  return "7bit";
}

/**
 * Decode body content based on transfer encoding
 * @param {string} body - Raw body content
 * @param {string} encoding - Transfer encoding
 * @returns {string} - Decoded content
 */
function decodeBody(body, encoding) {
  if (encoding === "qp") return decodeQuotedPrintable(body);
  if (encoding === "base64") return decodeBase64Str(body);
  return body;
}

/**
 * Extract body parts from a multipart section
 * @param {string} body - Body content
 * @param {string} boundary - MIME boundary
 * @returns {Array} - Array of {headers: Object, body: string} parts
 */
function extractParts(body, boundary) {
  const parts = [];
  const delimiter = "--" + boundary;
  const sections = body.split(delimiter);

  for (const section of sections) {
    const trimmed = section.trim();
    if (!trimmed || trimmed === "--") continue;

    const {headers, bodyStart} = parseHeaders(trimmed);
    if (bodyStart === 0) continue;

    const partBody = trimmed.substring(bodyStart);
    parts.push({headers, body: partBody});
  }

  return parts;
}

/**
 * Recursively parse EML content to extract the best text representation
 * @param {string} body - Body content
 * @param {Object} headers - Part headers
 * @returns {string|null} - Decoded text content or null
 */
function parseBody(body, headers) {
  const contentType = getMimeType(headers["content-type"] || "");
  const encoding = getEncoding(headers["content-transfer-encoding"] || "");

  if (contentType.startsWith("multipart/")) {
    const boundary = getBoundary(headers["content-type"] || "");
    if (!boundary) return null;

    const parts = extractParts(body, boundary);
    let best = null;

    for (const part of parts) {
      const type = getMimeType(part.headers["content-type"] || "");
      const result = parseBody(part.body, part.headers);

      if (result) {
        // Prefer text/html over text/plain
        if (type === "text/html") {
          return result; // HTML is best, return immediately
        }
        if (!best) best = result;
      }
    }

    return best;
  }

  if (contentType === "text/html") {
    return decodeBody(body, encoding);
  }

  if (contentType === "text/plain") {
    return decodeBody(body, encoding);
  }

  return null;
}

/**
 * Format email headers as HTML
 * @param {Object} headers - Parsed headers
 * @returns {string} - HTML string
 */
function formatHeaders(headers) {
  const relevant = ["from", "to", "cc", "subject", "date"];
  let html = "";

  for (const key of relevant) {
    if (headers[key]) {
      const label = key.charAt(0).toUpperCase() + key.slice(1);
      html +=
        '<div class="eml-header-row"><span class="eml-header-label">' +
        label +
        ':</span><span class="eml-header-value">' +
        escapeHtml(headers[key]) +
        "</span></div>";
    }
  }

  return html;
}

/**
 * Escape HTML special characters
 * @param {string} str - String to escape
 * @returns {string} - Escaped string
 */
function escapeHtml(str) {
  var s = String(str ?? "");
  var am = String.fromCharCode(38) + "amp;";
  var lt = String.fromCharCode(38) + "lt;";
  var gt = String.fromCharCode(38) + "gt;";
  var qt = String.fromCharCode(38) + "quot;";
  return s
    .replace(new RegExp(String.fromCharCode(38), "g"), am)
    .replace(new RegExp(String.fromCharCode(60), "g"), lt)
    .replace(new RegExp(String.fromCharCode(62), "g"), gt)
    .replace(new RegExp(String.fromCharCode(34), "g"), qt);
}

/**
 * Renders an EML file content with proper parsing and XSS sanitization
 * @param {string} data - Base64 encoded EML content
 * @returns {string} - Sanitized HTML content
 */
export default function eml(data) {
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

    // Parse headers
    const {headers, bodyStart} = parseHeaders(decodedString);

    // Get content type from headers
    const contentType = getMimeType(headers["content-type"] || "");
    const encoding = getEncoding(headers["content-transfer-encoding"] || "");

    // Extract body content
    let bodyContent = decodedString.substring(bodyStart);

    // Try to parse multipart content
    if (contentType.startsWith("multipart/")) {
      const boundary = getBoundary(headers["content-type"] || "");
      if (boundary) {
        const parts = extractParts(bodyContent, boundary);
        let bestText = null;
        let bestHtml = null;

        for (const part of parts) {
          const result = parseBody(part.body, part.headers);
          if (!result) continue;

          const partType = getMimeType(part.headers["content-type"] || "");
          if (partType === "text/html") {
            bestHtml = result;
          } else if (partType === "text/plain" && !bestText) {
            bestText = result;
          }
        }

        bodyContent = bestHtml || bestText || bodyContent;
      }
    } else {
      // Single part - decode directly
      bodyContent = decodeBody(bodyContent, encoding);
    }

    // Format headers HTML
    const headerHtml = formatHeaders(headers);

    // Determine if body is HTML or plain text
    let bodyHtml;
    const hasHtmlTags = /<html|<body|<div|<p|<br|<table|<a\s|<img/i.test(
      bodyContent,
    );

    if (hasHtmlTags) {
      // Sanitize HTML content
      bodyHtml = sanitizeHtml(bodyContent);
    } else {
      // Escape plain text to HTML
      bodyHtml =
        '<pre class="eml-plaintext">' + escapeHtml(bodyContent) + "</pre>";
    }

    // Build styles
    const styles = `
    <style>
      .eml-wrapper { background: #fff; border: 1px solid #d8dee9; border-radius: 8px; overflow: hidden; }
      .eml-headers { padding: 16px 20px; background: #f8f9fb; border-bottom: 1px solid #e5e9f0; }
      .eml-header-row { padding: 3px 0; display: flex; gap: 10px; font-size: 14px; }
      .eml-header-label { font-weight: 600; color: #4b5563; min-width: 72px; flex-shrink: 0; }
      .eml-header-value { color: #1f2937; word-break: break-word; }
      .eml-body { padding: 20px; }
      .eml-plaintext { margin: 0; white-space: pre-wrap; word-wrap: break-word;
        font-family: "Segoe UI", Tahoma, Geneva, Verdana, sans-serif;
        font-size: 14px; line-height: 1.6; color: #1f2937; }
    </style>`;

    return (
      styles +
      '<div class="eml-wrapper">' +
      '<div class="eml-headers">' +
      headerHtml +
      "</div>" +
      '<div class="eml-body">' +
      bodyHtml +
      "</div>" +
      "</div>"
    );
  } catch (error) {
    console.error("Error rendering EML content:", error);
    return (
      '<div class="eml-content" style="color: red; padding: 20px; background: white; border-radius: 8px;">Error loading EML content: ' +
      escapeHtml(error.message) +
      "</div>"
    );
  }
}

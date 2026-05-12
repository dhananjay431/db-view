/**
 * db-view utility functions for memory management and caching
 * Provides helper utilities for proper cleanup and caching of extracted assets
 */

// Cache for extracted assets
export const assetCache = new Map();

/**
 * Clean up all resources associated with the given container
 * Removes event listeners, cleans up canvas elements, and revokes blob URLs
 * @param {HTMLElement} container - The container element to clean up
 */
export function cleanupContainer(container) {
  if (!container) return;

  // Clean up any canvas elements in the container
  const canvases = container.querySelectorAll("canvas");
  canvases.forEach((canvas) => {
    const ctx = canvas.getContext("2d");
    if (ctx) {
      // Clear the canvas
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
    // Remove the canvas element
    canvas.remove();
  });

  // Clean up any image elements
  const images = container.querySelectorAll("img");
  images.forEach((img) => {
    // Revoke blob URL if it's a blob URL
    if (img.src && img.src.startsWith("blob:")) {
      URL.revokeObjectURL(img.src);
    }
    // Remove the image
    img.remove();
  });

  // Clean up any iframe elements (which may have their own resources)
  const iframes = container.querySelectorAll("iframe");
  iframes.forEach((iframe) => {
    try {
      // Clear the iframe content
      iframe.src = "about:blank";
    } catch (e) {
      // Ignore cross-origin errors
    }
    iframe.remove();
  });

  // Clean up any SVG elements
  const svgs = container.querySelectorAll("svg");
  svgs.forEach((svg) => {
    svg.remove();
  });

  // Clear the container's inner HTML
  container.innerHTML = "";
}

/**
 * Revokes all blob URLs stored in the asset cache
 */
export function cleanupBlobUrls() {
  for (const [key, value] of assetCache.entries()) {
    if (value && typeof value === "string" && value.startsWith("blob:")) {
      URL.revokeObjectURL(value);
    }
    assetCache.delete(key);
  }
}

/**
 * Creates a cleanup function that can be used to clean up resources
 * @param {HTMLElement} container - The container to clean up
 * @returns {function} - A cleanup function
 */
export function createCleanupFunction(container) {
  return () => {
    cleanupContainer(container);
    cleanupBlobUrls();
  };
}

/**
 * Safely parses JSON with error handling
 * @param {string} jsonString - The JSON string to parse
 * @param {any} defaultValue - The default value to return on error
 * @returns {any} - Parsed JSON or default value
 */
export function safeJSONParse(jsonString, defaultValue = null) {
  try {
    return JSON.parse(jsonString);
  } catch (e) {
    return defaultValue;
  }
}

/**
 * Safely executes a function with error handling
 * @param {function} fn - The function to execute
 * @param {any} defaultValue - The default value to return on error
 * @returns {any} - Return value of function or default value
 */
export function safeExecute(fn, defaultValue = null) {
  try {
    return fn();
  } catch (e) {
    return defaultValue;
  }
}

/**
 * Waits for DOM to be ready
 * @returns {Promise<void>}
 */
export function waitForDomReady() {
  return new Promise((resolve) => {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", resolve);
    } else {
      resolve();
    }
  });
}

/**
 * Debounces a function to limit how often it can be called
 * @param {function} func - The function to debounce
 * @param {number} wait - The number of milliseconds to wait
 * @returns {function} - The debounced function
 */
export function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

/**
 * Throttles a function to limit how often it can be called
 * @param {function} func - The function to throttle
 * @param {number} wait - The number of milliseconds to wait
 * @returns {function} - The throttled function
 */
export function throttle(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      timeout = null;
      func(...args);
    };
    if (!timeout) {
      timeout = setTimeout(later, wait);
      func(...args);
    }
  };
}

/**
 * Validates if the input is a valid base64 string
 * @param {string} str - The string to validate
 * @returns {boolean} - True if valid base64, false otherwise
 */
export function isValidBase64(str) {
  try {
    if (!str || typeof str !== "string") return false;
    // Remove data URL prefix if present
    const base64Str = str.replace(/^data:[^;]+;base64,/, "");
    if (!base64Str) return false;
    // Check if it's valid base64
    const decoded = atob(base64Str);
    const encoded = btoa(decoded);
    return encoded === base64Str;
  } catch (e) {
    return false;
  }
}

/**
 * Escapes HTML special characters
 * @param {string} str - The string to escape
 * @returns {string} - The escaped string
 */
export function escapeHtml(str) {
  if (str == null) return "";
  const text = String(str);
  // Use a map for replacements to avoid chained replace issues
  return text
    .replace(/&/g, "&")
    .replace(/</g, "<")
    .replace(/>/g, ">")
    .replace(/'/g, "&#039;");
}

/**
 * Sanitizes HTML to prevent XSS attacks
 * @param {string} html - The HTML to sanitize
 * @returns {string} - The sanitized HTML
 */
export function sanitizeHtml(html) {
  if (typeof html !== "string") return "";

  const div = document.createElement("div");
  div.innerHTML = html;

  // Remove script tags
  const scripts = div.querySelectorAll("script");
  scripts.forEach((script) => script.remove());

  // Remove event attributes
  const allElements = div.querySelectorAll("*");
  allElements.forEach((el) => {
    const attributes = Array.from(el.attributes);
    attributes.forEach((attr) => {
      if (attr.name.startsWith("on")) {
        el.removeAttribute(attr.name);
      }
    });
  });

  return div.innerHTML;
}

/**
 * Validates and sanitizes attributes to prevent XSS
 * @param {string} attrName - The attribute name
 * @param {string} attrValue - The attribute value
 * @returns {string} - Sanitized attribute value
 */
export function sanitizeAttribute(attrName, attrValue) {
  if (typeof attrValue !== "string") return "";

  // Block event handler attributes
  if (attrName.toLowerCase().startsWith("on")) {
    return "";
  }

  // For href and src, only allow safe protocols
  if (attrName === "href" || attrName === "src") {
    const lowerValue = attrValue.toLowerCase().trim();
    if (
      !lowerValue.startsWith("http://") &&
      !lowerValue.startsWith("https://") &&
      !lowerValue.startsWith("data:")
    ) {
      return "";
    }
  }

  return attrValue;
}

/**
 * Utility to check if a string contains potentially dangerous patterns
 * @param {string} str - The string to check
 * @returns {boolean} - True if potentially dangerous patterns are found
 */
export function containsDangerousPatterns(str) {
  if (typeof str !== "string") return false;

  // Check for common XSS patterns
  const dangerousPatterns = [
    /<script/i,
    /javascript:/i,
    /vbscript:/i,
    /data:text\/html/i,
    /on\w+\s*=/i,
    /<iframe/i,
    /<embed/i,
    /<object/i,
    /<applet/i,
    /<link/i,
    /<meta/i,
  ];

  return dangerousPatterns.some((pattern) => pattern.test(str));
}

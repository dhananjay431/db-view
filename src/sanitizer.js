/**
 * db-view XSS protection utilities
 * Provides comprehensive sanitization functions to prevent XSS attacks
 * in extracted content from various file formats (EML, HTML, etc.)
 */

/**
 * Sanitization configuration
 */
export const SanitizerConfig = {
  allowDataUrls: true,
  allowedProtocols: ["http:", "https:", "mailto:", "tel:", "data:"],
  allowedTags: [
    "a",
    "b",
    "i",
    "u",
    "strong",
    "em",
    "sub",
    "sup",
    "small",
    "code",
    "pre",
    "br",
    "p",
    "div",
    "span",
    "h1",
    "h2",
    "h3",
    "h4",
    "h5",
    "h6",
    "blockquote",
    "cite",
    "q",
    "abbr",
    "acronym",
    "address",
    "area",
    "article",
    "aside",
    "audio",
    "bdi",
    "bdo",
    "button",
    "canvas",
    "caption",
    "center",
    "col",
    "colgroup",
    "datalist",
    "details",
    "dialog",
    "dialog",
    "dt",
    "dd",
    "dir",
    "dl",
    "figure",
    "figcaption",
    "footer",
    "form",
    "header",
    "hgroup",
    "hr",
    "label",
    "legend",
    "li",
    "main",
    "map",
    "mark",
    "menu",
    "meter",
    "nav",
    "noscript",
    "ol",
    "optgroup",
    "option",
    "output",
    "progress",
    "rp",
    "rt",
    "ruby",
    "s",
    "samp",
    "section",
    "select",
    "shadow",
    "slot",
    "source",
    "summary",
    "table",
    "tbody",
    "td",
    "tfoot",
    "th",
    "thead",
    "tr",
    "track",
    "tt",
    "u",
    "ul",
    "var",
    "video",
    "wbr",
  ],
  disallowedTags: [
    "script",
    "style",
    "iframe",
    "embed",
    "object",
    "applet",
    "link",
    "meta",
    "base",
    "title",
    "frame",
    "frameset",
    "noframes",
  ],
  allowedAttributes: [
    "href",
    "src",
    "alt",
    "title",
    "class",
    "id",
    "style",
    "target",
    "rel",
    "type",
    "width",
    "height",
    "cellpadding",
    "cellspacing",
    "border",
    "colspan",
    "rowspan",
    "align",
    "valign",
    "bgcolor",
    "bordercolor",
    "background",
    "download",
  ],
  eventAttributes: [
    "onabort",
    "onafterprint",
    "onanimationend",
    "onanimationiteration",
    "onanimationstart",
    "onauxclick",
    "onbeforeprint",
    "onbeforeunload",
    "onblur",
    "oncanplay",
    "oncanplaythrough",
    "onchange",
    "onclick",
    "onclose",
    "oncontextmenu",
    "oncuechange",
    "ondblclick",
    "ondrag",
    "ondragend",
    "ondragenter",
    "ondragleave",
    "ondragover",
    "ondragstart",
    "ondrop",
    "ondurationchange",
    "onemptied",
    "onended",
    "onerror",
    "onfocus",
    "onfocusin",
    "onfocusout",
    "onhashchange",
    "oninput",
    "oninvalid",
    "onkeydown",
    "onkeypress",
    "onkeyup",
    "onload",
    "onloadeddata",
    "onloadedmetadata",
    "onloadstart",
    "onmousedown",
    "onmouseenter",
    "onmouseleave",
    "onmousemove",
    "onmouseout",
    "onmouseover",
    "onmouseup",
    "onmousewheel",
    "onoffline",
    "ononline",
    "onpagehide",
    "onpageshow",
    "onpause",
    "onplay",
    "onplaying",
    "onpopstate",
    "onprogress",
    "onratechange",
    "onreset",
    "onresize",
    "onscroll",
    "onseeked",
    "onseeking",
    "onselect",
    "onstalled",
    "onstorage",
    "onsubmit",
    "onsuspend",
    "ontimeupdate",
    "ontoggle",
    "onunload",
    "onvolumechange",
    "onwaiting",
    "onwheel",
  ],
};

/**
 * Sanitizes a single element's attributes to prevent XSS
 * @param {HTMLElement} element - The element to sanitize
 * @param {object} config - Sanitization configuration
 */
export function sanitizeElement(element, config = SanitizerConfig) {
  if (!element || element.nodeType !== Node.ELEMENT_NODE) return;

  // Remove disallowed tags
  if (config.disallowedTags.includes(element.tagName.toLowerCase())) {
    element.remove();
    return;
  }

  // Process attributes
  const attributes = Array.from(element.attributes);
  attributes.forEach((attr) => {
    const attrName = attr.name.toLowerCase();
    const attrValue = attr.value;

    // Remove event handler attributes
    if (config.eventAttributes.includes(attrName)) {
      element.removeAttribute(attrName);
      return;
    }

    // Validate href and src attributes for dangerous protocols (Rule 10)
    if (attrName === "href" || attrName === "src") {
      let url = attrValue.trim().toLowerCase();

      // Explicitly block dangerous protocols
      if (
        url.startsWith("javascript:") ||
        url.startsWith("vbscript:") ||
        url.startsWith("file:")
      ) {
        element.removeAttribute(attrName);
        return;
      }

      // Rule 10: data: is blocked for href (hyperlinks), allowed only for src
      // (images) so inline attachments still render.
      if (url.startsWith("data:")) {
        if (attrName === "href") {
          element.removeAttribute(attrName);
          return;
        }
        if (!config.allowDataUrls) {
          element.removeAttribute(attrName);
          return;
        }
        // Only allow safe data URLs (images, etc.)
        if (
          !url.match(
            /^data:(image\/(png|jpeg|gif|svg\+xml|webp|bmp)|text\/(html|plain)|application\/pdf|video\/(mp4|webm)|audio\/(mp3|wav))/i,
          )
        ) {
          element.removeAttribute(attrName);
          return;
        }
      }
      // mailto: and tel: are safe (Rules 7, 8, 10)
      else if (url.startsWith("mailto:") || url.startsWith("tel:")) {
        // Allow email and telephone links
      }
      // Handle protocol-relative URLs
      else if (url.startsWith("//")) {
        // Allow protocol-relative URLs (they inherit from parent)
      }
      // Handle relative URLs
      else if (url.startsWith("/")) {
        // Allow relative URLs
      }
      // Handle absolute URLs - only allow http/https
      else if (!url.startsWith("http://") && !url.startsWith("https://")) {
        element.removeAttribute(attrName);
        return;
      }
    }

    // Only allow whitelisted attributes
    if (
      !config.allowedAttributes.includes(attrName) &&
      !attrName.startsWith("data-") &&
      !attrName.startsWith("aria-")
    ) {
      element.removeAttribute(attrName);
    }
  });

  // Rule 11: external links always open in a new tab.
  // Rule 9:  show the full destination URL as a tooltip on hover.
  if (element.tagName.toLowerCase() === "a") {
    const href = element.getAttribute("href");
    if (href) {
      // Preserve download links (data: with a download attribute) as-is.
      if (!href.trim().toLowerCase().startsWith("data:")) {
        element.setAttribute("target", "_blank");
        element.setAttribute("rel", "noopener noreferrer");
      }
      // Add a tooltip with the destination URL when no title is present (Rule 9).
      if (!element.hasAttribute("title")) {
        element.setAttribute("title", href);
      }
    }
  }

  // Process child nodes recursively
  const childNodes = Array.from(element.childNodes);
  childNodes.forEach((child) => {
    if (child.nodeType === Node.ELEMENT_NODE) {
      sanitizeElement(child, config);
    } else if (child.nodeType === Node.TEXT_NODE) {
      // Sanitize text content to prevent XSS via text nodes
      child.textContent = sanitizeTextContent(child.textContent);
    }
  });
}

/**
 * Escapes HTML special characters in a string
 * @param {string} str - The string to escape
 * @returns {string} - Escaped string
 */
export function escapeHtml(str) {
  if (typeof str !== "string") return "";
  return str.replace(/[&<>"']/g, (m) => {
    switch (m) {
      case "&":
        return "&" + "amp;";
      case "<":
        return "&" + "lt;";
      case ">":
        return "&" + "gt;";
      case '"':
        return "&" + "quot;";
      case "'":
        return "&#039;";
      default:
        return m;
    }
  });
}

/**
 * Sanitizes text content to prevent XSS
 * @param {string} text - The text to sanitize
 * @returns {string} - Sanitized text
 */
export function sanitizeTextContent(text) {
  return escapeHtml(text);
}

/**
 * Sanitizes HTML to prevent XSS attacks using DOM-based sanitization
 * This is the primary XSS protection function
 * @param {string} html - The HTML to sanitize
 * @param {object} config - Sanitization configuration
 * @returns {string} - Sanitized HTML
 */
export function sanitizeHtml(html, config = SanitizerConfig) {
  if (typeof html !== "string") return "";
  if (!html.trim()) return "";

  // Create a temporary container
  const div = document.createElement("div");

  // Parse the HTML safely
  div.innerHTML = html;

  // Sanitize all elements
  sanitizeElement(div, config);

  // Return sanitized HTML
  return div.innerHTML;
}

/**
 * Sanitizes an EML file content to prevent XSS
 * EML files can contain HTML content that needs to be sanitized
 * @param {string} emlContent - The EML content (decoded)
 * @param {object} config - Sanitization configuration
 * @returns {string} - Sanitized EML content
 */
export function sanitizeEmlContent(emlContent, config = SanitizerConfig) {
  if (typeof emlContent !== "string") return "";

  // Try to detect and extract HTML content from EML
  // EML files can have both plain text and HTML parts
  if (
    emlContent.includes("<html") ||
    emlContent.includes("<div") ||
    emlContent.includes("<p")
  ) {
    return sanitizeHtml(emlContent, config);
  }

  // Plain text - just escape it
  return sanitizeTextContent(emlContent);
}

/**
 * Sanitizes HTML attributes safely
 * @param {string} attributeName - The attribute name
 * @param {string} attributeValue - The attribute value
 * @param {object} config - Sanitization configuration
 * @returns {string} - Sanitized attribute value
 */
export function sanitizeAttribute(
  attributeName,
  attributeValue,
  config = SanitizerConfig,
) {
  if (typeof attributeName !== "string" || typeof attributeValue !== "string")
    return "";

  const attrName = attributeName.toLowerCase().trim();

  // Block all event handler attributes
  if (config.eventAttributes.includes(attrName)) {
    return "";
  }

  // Validate href and src attributes (Rule 10)
  if (attrName === "href" || attrName === "src") {
    let value = attributeValue.trim();
    let lower = value.toLowerCase();

    // Explicitly block dangerous protocols
    if (
      lower.startsWith("javascript:") ||
      lower.startsWith("vbscript:") ||
      lower.startsWith("file:")
    ) {
      return "";
    }

    // Rule 10: data: is blocked for href (hyperlinks), allowed only for src
    // (images) so inline attachments still render.
    if (lower.startsWith("data:")) {
      if (attrName === "href") return "";
      if (!config.allowDataUrls) return "";
      if (
        !value.match(/^data:(image\/|text\/|application\/pdf|video\/|audio\/)/i)
      ) {
        return "";
      }
    }
    // mailto: and tel: are safe (Rules 7, 8, 10)
    else if (lower.startsWith("mailto:") || lower.startsWith("tel:")) {
      // Allow email and telephone links
    }
    // Handle protocol-relative URLs
    else if (value.startsWith("//")) {
      // Allow protocol-relative URLs (they inherit from parent)
    }
    // Handle absolute URLs - only allow http/https
    else if (!lower.startsWith("http://") && !lower.startsWith("https://")) {
      return "";
    }

    return value;
  }

  // Allow whitelisted attributes
  if (
    config.allowedAttributes.includes(attrName) ||
    attrName.startsWith("data-") ||
    attrName.startsWith("aria-") ||
    attrName.startsWith("role")
  ) {
    return attributeValue;
  }

  return "";
}

/**
 * Creates a safe iframe content by sanitizing the HTML
 * @param {string} html - The HTML to put in iframe
 * @param {object} config - Sanitization configuration
 * @returns {string} - Sanitized HTML for iframe
 */
export function createSafeIframeContent(html, config = SanitizerConfig) {
  if (typeof html !== "string") return "";

  const sanitized = sanitizeHtml(html, config);

  // For iframe, we also need to sanitize any inline scripts
  // that might be injected through other means
  return sanitized.replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, "");
}

/**
 * Sanitizes SVG content to prevent XSS
 * SVG files can contain JavaScript in events and script tags
 * @param {string} svgContent - The SVG content
 * @param {object} config - Sanitization configuration
 * @returns {string} - Sanitized SVG content
 */
export function sanitizeSvg(svgContent, config = SanitizerConfig) {
  if (typeof svgContent !== "string") return "";

  // First, escape the content
  let sanitized = String(svgContent);

  // Parse as XML and remove dangerous elements
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(sanitized, "image/svg+xml");

    // Remove script elements
    const scripts = doc.querySelectorAll("script");
    scripts.forEach((script) => script.remove());

    // Remove event attributes from all elements
    const elements = doc.querySelectorAll("*");
    elements.forEach((el) => {
      config.eventAttributes.forEach((event) => {
        el.removeAttribute(event);
      });
    });

    sanitized = doc.documentElement.outerHTML;
  } catch (e) {
    // If parsing fails, return empty string for safety
    sanitized = "";
  }

  return sanitized;
}

/**
 * Validates and sanitizes all image sources to prevent XSS
 * @param {string} html - HTML containing images
 * @param {object} config - Sanitization configuration
 * @returns {string} - Sanitized HTML
 */
export function sanitizeImageSources(html, config = SanitizerConfig) {
  if (typeof html !== "string") return "";

  // Create a temporary container
  const div = document.createElement("div");
  div.innerHTML = html;

  // Find all images and validate their sources
  const images = div.querySelectorAll("img");
  images.forEach((img) => {
    const src = img.getAttribute("src");
    if (src) {
      const sanitizedSrc = sanitizeAttribute("src", src, config);
      if (sanitizedSrc) {
        img.setAttribute("src", sanitizedSrc);
      } else {
        img.removeAttribute("src");
      }
    }
  });

  return div.innerHTML;
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

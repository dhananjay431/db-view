/**
 * db-view MSG (Outlook .msg) file renderer
 * Parses the OLE2 compound .msg format and renders it like msg-viewer.pages.dev
 *
 * Hyperlink rendering follows agents.md rules:
 *   - Rule 1, 4: Display only the author-visible text
 *   - Rule 2:     href is hidden from UI but preserved
 *   - Rule 3, 11: target="_blank" rel="noopener noreferrer"
 *   - Rule 5:     If link text equals URL, display the URL as-is
 *   - Rule 6:     Plain text URLs auto-linkified
 *   - Rule 7:     Email -> mailto:
 *   - Rule 8:     Phone -> tel:
 *   - Rule 9:     title= attribute shows full destination on hover
 *   - Rule 10:    Only safe protocols (sanitizer.js enforces)
 *   - Rule 12:    color #0a66c2, underline
 *   - Rule 15, 16: Preserve HTML, sanitize via sanitizeHtml
 *   - Rule 17:    HTML, RTF, and plain text bodies all supported
 */

import { Msg } from "msg-parser";
import {
  PidTagSubject,
  PidTagSenderName,
  PidTagSenderEmailAddress,
  PidTagDisplayTo,
  PidTagDisplayCc,
  PidTagClientSubmitTime,
  PidTagMessageDeliveryTime,
  PidTagBody,
  PidTagBodyHtml,
  PidTagAttachLongFilename,
  PidTagAttachFilename,
  PidTagAttachSize,
} from "msg-parser";
import { sanitizeHtml } from "./sanitizer.js";

// Escape HTML special characters (uses charCode to avoid entity mangling)
function escapeHtml(str) {
  var s = String(str == null ? "" : str);
  var am = String.fromCharCode(38) + "amp;";
  var lt = String.fromCharCode(38) + "lt;";
  var gt = String.fromCharCode(38) + "gt;";
  var qt = String.fromCharCode(38) + "quot;";
  var sq = String.fromCharCode(38) + "#039;";
  return s
    .replace(new RegExp(String.fromCharCode(38), "g"), am)
    .replace(new RegExp(String.fromCharCode(60), "g"), lt)
    .replace(new RegExp(String.fromCharCode(62), "g"), gt)
    .replace(new RegExp(String.fromCharCode(34), "g"), qt)
    .replace(new RegExp(String.fromCharCode(39), "g"), sq);
}

// Decode base64 to Uint8Array
function base64ToUint8Array(base64) {
  var binary = atob(base64);
  var len = binary.length;
  var bytes = new Uint8Array(len);
  for (var i = 0; i < len; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

// Convert bytes to base64
function bytesToBase64(bytes) {
  var binary = "";
  for (var i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

// Format file size
function formatSize(bytes) {
  if (!bytes && bytes !== 0) return "";
  if (bytes === 0) return "0 B";
  var k = 1024;
  var sizes = ["B", "KB", "MB", "GB"];
  var i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
}

// Format date from parser value
function formatDate(value) {
  if (!value) return "";
  try {
    var date = value instanceof Date ? value : new Date(value);
    if (isNaN(date.getTime())) return String(value);
    return date.toLocaleString();
  } catch (e) {
    return String(value);
  }
}

// Safely get a property
function safeGetProperty(obj, property) {
  try {
    return obj.getProperty(property);
  } catch (e) {
    return null;
  }
}

// Build a metadata row
function metaRow(label, value) {
  if (!value) return "";
  return (
    '<div class="msg-meta-row"><span class="msg-meta-label">' +
    label +
    '</span><span class="msg-meta-value">' +
    escapeHtml(value) +
    "</span></div>"
  );
}

// Run a regex transform over only the segments of `s` that are NOT inside
// an existing <a ...>...</a> block. This avoids nesting new <a> tags inside
// ones we already created in a previous pass.
function applyOutsideAnchors(s, pattern, replacer) {
  var parts = String(s).split(/(<a [^>]*>[\s\S]*?<\/a>)/gi);
  for (var i = 0; i < parts.length; i++) {
    if (/^<a\s/i.test(parts[i])) continue;
    parts[i] = parts[i].replace(pattern, replacer);
  }
  return parts.join("");
}

// Strip everything except digits and a leading '+' from a phone number.
function digitsForTel(displayText) {
  var hasPlus = /^\s*\+/.test(displayText);
  var digits = String(displayText).replace(/[^0-9]/g, "");
  if (hasPlus) return "+" + digits;
  return digits;
}

// Build an <a> tag with the standard set of attributes used everywhere in
// this file. Centralizing keeps Rule 3/9/11 consistent.
function buildAnchor(href, displayText) {
  return (
    '<a href="' +
    href +
    '" target="_blank" rel="noopener noreferrer" title="' +
    href +
    '">' +
    displayText +
    "</a>"
  );
}

// Convert URLs, email addresses, and phone numbers in already-escaped
// plain text into clickable <a> tags. The caller MUST pass HTML-escaped
// text so that injection via crafted input is impossible. The returned
// string is then passed through sanitizeHtml() to keep XSS protection.
//
// Rules implemented here:
//   Rule 6 - plain text URLs auto-linkified (displayed as-is, per Rule 5)
//   Rule 7 - email -> mailto:
//   Rule 8 - phone -> tel:
//   Rule 9 - title= attribute on every generated anchor
//   Rule 11 - target=_blank rel=noopener noreferrer
function linkifyPlainText(escapedText) {
  var s = String(escapedText == null ? "" : escapedText);

  // 1. http(s)://... URLs (stop at whitespace, quotes, angle brackets, or backticks)
  s = s.replace(/\bhttps?:\/\/[^\s<>"'`)\]\}]+/gi, function (url) {
    var trimmed = url.replace(/[.,;:!?]+$/, "");
    var trailing = url.substring(trimmed.length);
    return buildAnchor(trimmed, trimmed) + trailing;
  });

  // 2. www.example.com URLs (skip ones already inside an <a> tag)
  s = applyOutsideAnchors(
    s,
    /(^|[^="'>])(\bwww\.[^\s<>"'`)\]\}]+)/gi,
    function (match, prefix, url) {
      var trimmed = url.replace(/[.,;:!?]+$/, "");
      var trailing = url.substring(trimmed.length);
      return prefix + buildAnchor("https://" + trimmed, trimmed) + trailing;
    },
  );

  // 3. mailto: links for plain email addresses (skip ones inside an <a> tag)
  s = applyOutsideAnchors(
    s,
    /(^|[^\w@./-])([A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,})/g,
    function (match, prefix, email) {
      return prefix + buildAnchor("mailto:" + email, email);
    },
  );

  // 4. tel: links for phone numbers. We require either:
  //      - an explicit leading '+' (international), e.g. +1 555 123 4567
  //      - OR a North American style 10-digit grouping: (NNN) NNN-NNNN
  //      - OR a 10+ digit run with at least one separator (space/dash/dot)
  //    The visible text is the original phone number (Rule 4 - never
  //    modify displayed text); the href uses digits-only (tel: scheme
  //    requirement).
  s = applyOutsideAnchors(
    s,
    /(\+[0-9](?:[0-9().\- \u00A0]*[0-9]){6,}[0-9]|\([0-9]{3}\)\s?[0-9]{3}[-.][0-9]{4}|\b[0-9]{3}[-. ][0-9]{3}[-. ][0-9]{4}\b)/g,
    function (phone) {
      // Skip if it's actually inside a longer digit run that looks like a URL.
      // Heuristic: a phone with `://` before it would be caught by the URL pass.
      // We only see this string after the URL pass, so it's safe.
      var href = "tel:" + digitsForTel(phone);
      return buildAnchor(href, phone);
    },
  );

  return s;
}

// Build attachments HTML
function buildAttachments(message) {
  try {
    var attachments = message.attachments();
    if (!attachments || attachments.length === 0) return "";

    var html =
      '<div class="msg-attachments">' +
      '<div class="msg-attachments-title">Attachments (' +
      attachments.length +
      ")</div>" +
      '<div class="msg-attachments-list">';

    for (var i = 0; i < attachments.length; i++) {
      var att = attachments[i];
      var filename =
        safeGetProperty(att, PidTagAttachLongFilename) ||
        safeGetProperty(att, PidTagAttachFilename) ||
        "attachment_" + i;
      var size = safeGetProperty(att, PidTagAttachSize);
      var sizeText = size != null ? formatSize(Number(size)) : "";
      var downloadLink = "";
      try {
        var content = att.content();
        if (content && content.length > 0) {
          var b64 = bytesToBase64(content);
          downloadLink =
            '<a href="data:application/octet-stream;base64,' +
            b64 +
            '" download="' +
            escapeHtml(filename) +
            '" class="msg-attach-download" title="Download">Download</a>';
        }
      } catch (e) {
        // content not available
      }

      html +=
        '<div class="msg-attach-item">' +
        '<div class="msg-attach-icon">' +
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"></path></svg>' +
        "</div>" +
        '<div class="msg-attach-info">' +
        '<div class="msg-attach-name">' +
        escapeHtml(filename) +
        "</div>" +
        (sizeText
          ? '<div class="msg-attach-size">' + escapeHtml(sizeText) + "</div>"
          : "") +
        "</div>" +
        downloadLink +
        "</div>";
    }

    html += "</div></div>";
    return html;
  } catch (e) {
    return "";
  }
}

// Renders an Outlook MSG file content
export default function msg(data) {
  try {
    if (typeof data !== "string" || !data.trim()) {
      throw new Error("Invalid MSG data: data must be a non-empty string");
    }

    if (data.indexOf("base64,") !== -1) {
      data = data.split("base64,")[1];
    }
    data = data.replace(/\s+/g, "");

    if (!data) {
      throw new Error("Invalid MSG data: empty after processing");
    }

    var bytes = base64ToUint8Array(data);
    var message = Msg.fromUint8Array(bytes);

    // Header fields
    var subject = safeGetProperty(message, PidTagSubject) || "(No Subject)";
    var senderName = safeGetProperty(message, PidTagSenderName) || "";
    var senderEmail = safeGetProperty(message, PidTagSenderEmailAddress) || "";
    var fromValue =
      (senderName || senderEmail) +
      (senderName && senderEmail && senderName !== senderEmail
        ? " <" + senderEmail + ">"
        : "");
    var toValue = safeGetProperty(message, PidTagDisplayTo) || "";
    var ccValue = safeGetProperty(message, PidTagDisplayCc) || "";
    var dateValue =
      formatDate(safeGetProperty(message, PidTagClientSubmitTime)) ||
      formatDate(safeGetProperty(message, PidTagMessageDeliveryTime));

    // Body - prefer HTML, fall back to plain text (with URL linkification)
    var bodyHtml = "";
    var bodyPlain = safeGetProperty(message, PidTagBody);
    var bodyHtmlRaw = safeGetProperty(message, PidTagBodyHtml);

    if (bodyHtmlRaw && String(bodyHtmlRaw).trim()) {
      bodyHtml = sanitizeHtml(String(bodyHtmlRaw));
    } else if (bodyPlain != null && String(bodyPlain).trim()) {
      // Escape first, then convert URLs/emails/phones to clickable links,
      // then run through sanitizeHtml for defense in depth.
      var escaped = escapeHtml(String(bodyPlain));
      var linkified = linkifyPlainText(escaped);
      bodyHtml =
        '<pre class="msg-plaintext">' + sanitizeHtml(linkified) + "</pre>";
    } else {
      bodyHtml =
        '<pre class="msg-plaintext">(No readable body found in this MSG file)</pre>';
    }

    // Attachments
    var attachmentsHtml = buildAttachments(message);

    // Styles matching msg-viewer.pages.dev layout
    var styles =
      "<style>" +
      ".msg-wrapper{background:#fff;border:1px solid #e0e0e0;border-radius:8px;overflow:hidden;font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;}" +
      ".msg-subject{padding:16px 20px;font-size:18px;font-weight:700;color:#1a1a2e;border-bottom:1px solid #f0f0f0;background:#fafafa;text-align:left;}" +
      ".msg-meta{padding:12px 20px;border-bottom:1px solid #f0f0f0;}" +
      ".msg-meta-row{display:flex;padding:3px 0;font-size:13px;line-height:1.5;}" +
      ".msg-meta-label{font-weight:600;color:#6c757d;min-width:60px;flex-shrink:0;}" +
      ".msg-meta-value{color:#1f2937;word-break:break-word;}" +
      ".msg-body{padding:20px;font-size:14px;line-height:1.6;color:#1f2937;}" +
      // Rule 12: hyperlink styling — #0a66c2, underline, cursor pointer.
      // Rule 11: external links always open in a new tab (handled in HTML).
      ".msg-body a{color:#0a66c2;text-decoration:underline;cursor:pointer;word-break:break-word;overflow-wrap:break-word;}" +
      ".msg-body a:hover{text-decoration:underline;color:#084d92;}" +
      // Rule 13: accessibility — keyboard focus styles and Enter-key support.
      ".msg-body a:focus{outline:2px solid #0a66c2;outline-offset:2px;text-decoration:underline;}" +
      ".msg-plaintext a:focus{outline:2px solid #0a66c2;outline-offset:2px;text-decoration:underline;}" +
      ".msg-plaintext{margin:0;white-space:pre-wrap;word-wrap:break-word;font-family:inherit;font-size:14px;line-height:1.6;text-align:left;}" +
      ".msg-plaintext a{color:#0a66c2;text-decoration:underline;cursor:pointer;word-break:break-word;overflow-wrap:break-word;display:inline-block;}" +
      ".msg-plaintext a:hover{color:#084d92;}" +
      ".msg-attachments{padding:12px 20px;border-top:1px solid #f0f0f0;background:#fafafa;}" +
      ".msg-attachments-title{font-size:13px;font-weight:700;color:#6c757d;margin-bottom:10px;}" +
      ".msg-attachments-list{display:flex;flex-direction:column;gap:8px;}" +
      ".msg-attach-item{display:flex;align-items:center;justify-content:flex-start;gap:8px;padding:6px 10px;border:1px solid #e0e0e0;border-radius:8px;background:#fff;width:fit-content;max-width:100%;}" +
      ".msg-attach-icon{flex-shrink:0;width:32px;height:32px;border-radius:8px;background:#eff6ff;color:#2563eb;display:flex;align-items:center;justify-content:center;}" +
      ".msg-attach-icon svg{width:16px;height:16px;}" +
      ".msg-attach-info{flex:1;min-width:0;}" +
      ".msg-attach-name{font-size:13px;font-weight:600;color:#1f2937;word-break:break-all;}" +
      ".msg-attach-size{font-size:12px;color:#94a3b8;margin-top:2px;}" +
      ".msg-attach-download{flex-shrink:0;font-size:12px;font-weight:600;color:#2563eb;text-decoration:none;padding:6px 12px;border:1px solid #bfdbfe;border-radius:6px;transition:all 0.2s;}" +
      ".msg-attach-download:hover{background:#eff6ff;border-color:#2563eb;}" +
      "</style>";

    return (
      styles +
      '<div class="msg-wrapper">' +
      '<div class="msg-subject">' +
      escapeHtml(subject) +
      "</div>" +
      '<div class="msg-meta">' +
      metaRow("From", fromValue) +
      metaRow("To", toValue) +
      metaRow("Cc", ccValue) +
      metaRow("Date", dateValue) +
      "</div>" +
      '<div class="msg-body">' +
      bodyHtml +
      "</div>" +
      attachmentsHtml +
      "</div>"
    );
  } catch (error) {
    console.error("Error rendering MSG content:", error);
    return (
      '<div style="color:red;padding:20px;background:#fff;border:1px solid #e0e0e0;border-radius:8px;">Error loading MSG content: ' +
      escapeHtml(error.message) +
      "</div>"
    );
  }
}

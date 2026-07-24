/**
 * db-view MSG (Outlook .msg) file renderer
 * Parses the OLE2 compound .msg format and renders it like msg-viewer.pages.dev
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

    // Body - prefer HTML, fall back to plain text
    var bodyHtml = "";
    var bodyPlain = safeGetProperty(message, PidTagBody);
    var bodyHtmlRaw = safeGetProperty(message, PidTagBodyHtml);

    if (bodyHtmlRaw && String(bodyHtmlRaw).trim()) {
      bodyHtml = sanitizeHtml(String(bodyHtmlRaw));
    } else if (bodyPlain != null && String(bodyPlain).trim()) {
      bodyHtml =
        '<pre class="msg-plaintext">' +
        escapeHtml(String(bodyPlain)) +
        "</pre>";
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
      ".msg-body a{color:#2563eb;}" +
      ".msg-plaintext{margin:0;white-space:pre-wrap;word-wrap:break-word;font-family:inherit;font-size:14px;line-height:1.6;text-align:left;}" +
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

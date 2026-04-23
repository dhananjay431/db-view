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

const injectStyles = () => {
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
    .image-zoom-wrapper {
      overflow: auto;
      max-height: 80vh;
      text-align: center;
      border: 1px solid #eee;
      padding: 20px;
      background: #fafafa;
    }
    .image-zoom-wrapper img {
      transition: transform 0.2s ease;
      transform-origin: top center;
    }
  `;
  document.head.appendChild(style);
};

if (typeof window !== "undefined" && !window.zoomDbViewImage) {
  window.zoomDbViewImage = function(button, factor) {
    const wrapper = button.parentElement.nextElementSibling;
    const img = wrapper.querySelector("img") || document.querySelector("img");
    if (!img) return;
    let scale = parseFloat(img.getAttribute("data-scale")) || 1;
    scale *= factor;
    img.setAttribute("data-scale", scale);
    img.style.transform = "scale(" + scale + ")";
  };
}

export const show = (data, file, id) => {
  injectStyles();
  const container = document.getElementById(id);
  container.classList.add("db-view-container");
  
  let ext = file.split(".").at(-1).toLowerCase();
  
  if ("pdf" === ext) {
    container.innerHTML = "";
    const iframe = document.createElement("iframe");
    iframe.id = "pdfFrame";
    iframe.src = pdf(data);
    container.appendChild(iframe);
  } else if ("png" === ext) {
    container.innerHTML = png(data);
  } else if ("jpeg" === ext || "jpg" === ext) {
    container.innerHTML = jpeg(data);
  } else if ("eml" === ext) {
    container.innerHTML = eml(data);
  } else if ("html" === ext) {
    container.innerHTML = html(data);
  } else if ("xlsx" === ext || "xls" === ext || "csv" === ext) {
    xlsx(data).then((htmlContent) => {
      container.innerHTML = htmlContent;
    });
  } else if ("docx" === ext || "doc" === ext) {
    doc(data, id);
  } else if ("txt" === ext || "xml" === ext) {
    const pre = document.createElement("pre");
    pre.textContent = txt(data, id);
    container.innerHTML = "";
    container.appendChild(pre);
  } else if ("svg" === ext) {
    container.innerHTML = svg(data, id);
  } else if ("tif" === ext || "tiff" === ext) {
    container.innerHTML = tiff(data, id);
  }
};

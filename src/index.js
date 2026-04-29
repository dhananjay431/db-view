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
    .content-zoom-wrapper {
      overflow: auto;
      height: 100vh;
      text-align: center;
      border: 1px solid #eee;
      padding: 20px;
      background: #fafafa;
    }
    .zoom-target {
      transition: transform 0.2s ease;
      transform-origin: top center;
      display: inline-block;
      min-width: 100%;
    }
  `;
  document.head.appendChild(style);
};

if (typeof window !== "undefined" && !window.zoomDbViewImage) {
  window.zoomDbViewImage = function(button, factor) {
    const wrapper = button.parentElement.nextElementSibling;
    const target = wrapper.classList.contains("zoom-target") ? wrapper : wrapper.querySelector(".zoom-target") || wrapper.querySelector("img");
    if (!target) return;
    let scale = parseFloat(target.getAttribute("data-scale")) || 1;
    scale *= factor;
    target.setAttribute("data-scale", scale);
    target.style.transform = "scale(" + scale + ")";
  };
}

export const show = (data, file, id) => {
  injectStyles();
  const container = document.getElementById(id);
  container.classList.add("db-view-container");
  
  if (data) {
    if (data.indexOf('base64,') !== -1) {
      data = data.split('base64,')[1];
    }
    data = data.replace(/\s+/g, '');
  }
  
  let ext = file.split(".").at(-1).toLowerCase();
  
  container.innerHTML = `
    ${ext !== "pdf" ? `
    <div class="zoom-controls">
      <button class="zoom-btn" title="Zoom In" onclick="window.zoomDbViewImage(this, 1.2)">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line><line x1="11" y1="8" x2="11" y2="14"></line><line x1="8" y1="11" x2="14" y2="11"></line></svg>
      </button>
      <button class="zoom-btn" title="Zoom Out" onclick="window.zoomDbViewImage(this, 1/1.2)">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line><line x1="8" y1="11" x2="14" y2="11"></line></svg>
      </button>
    </div>
    ` : ''}
    <div class="content-zoom-wrapper"${ext === 'pdf' ? ' style="padding: 0; border: none; background: transparent;"' : ''}>
      <div id="${id}-content-target" class="${ext !== "pdf" ? "zoom-target" : ""}" data-scale="1">
      </div>
    </div>
  `;
  
  const contentContainer = document.getElementById(`${id}-content-target`);
  
  if ("pdf" === ext) {
    pdf(data, `${id}-content-target`, file);
  } else if ("png" === ext) {
    contentContainer.innerHTML = png(data);
  } else if ("jpeg" === ext || "jpg" === ext) {
    contentContainer.innerHTML = jpeg(data);
  } else if ("eml" === ext) {
    contentContainer.innerHTML = eml(data);
  } else if ("html" === ext) {
    contentContainer.innerHTML = html(data);
  } else if ("xlsx" === ext || "xls" === ext || "csv" === ext) {
    xlsx(data).then((htmlContent) => {
      contentContainer.innerHTML = htmlContent;
    });
  } else if ("docx" === ext || "doc" === ext) {
    doc(data, `${id}-content-target`);
  } else if ("txt" === ext || "xml" === ext) {
    const pre = document.createElement("pre");
    pre.textContent = txt(data, id);
    contentContainer.appendChild(pre);
  } else if ("svg" === ext) {
    contentContainer.innerHTML = svg(data, id);
  } else if ("tif" === ext || "tiff" === ext) {
    contentContainer.innerHTML = tiff(data, id);
  }
};

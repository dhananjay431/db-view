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
export const show = (data, file, id) => {
  let ext = file.split(".").at(-1).toLowerCase();
  if ("pdf" === ext) {
    document.getElementById(id).innerHTML = "";
    const iframe = document.createElement("iframe");
    iframe.id = "pdfFrame";
    iframe.width = "100%";
    // iframe.height = '600px';
    iframe.style.border = "none";
    iframe.style.height = "100vh";
    iframe.src = pdf(data);
    document.getElementById(id).appendChild(iframe);
    // document.getElementById(id).innerHTML = pdf(data);
  }
  // if ("pdf" === ext) {
  //   document.getElementById(id).innerHTML = pdf(data);
  // }
  else if ("png" === ext) {
    document.getElementById(id).innerHTML = png(data);
  } else if ("jpeg" === ext || "jpg" === ext) {
    document.getElementById(id).innerHTML = jpeg(data);
  } else if ("eml" === ext) {
    document.getElementById(id).innerHTML = eml(data);
  } else if ("html" === ext) {
    document.getElementById(id).innerHTML = html(data);
  } else if ("xlsx" === ext || "xls" === ext || "csv" === ext) {
    xlsx(data).then((html) => {
      document.getElementById(id).innerHTML = html;
    });
  } else if ("docx" === ext || "doc" === ext) {
    doc(data, id);
  } else if ("txt" === ext || "xml" === ext) {
    document.getElementById(id).textContent = txt(data, id);
  } else if ("svg" === ext) {
    document.getElementById(id).innerHTML = svg(data, id);
  } else if ("tif" === ext || "tiff" === ext) {
    document.getElementById(id).innerHTML = tiff(data, id);
  }
};

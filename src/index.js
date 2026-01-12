import pdf from "./pdf.js";
import png from "./png.js";
import jpeg from "./jpeg.js";
import eml from "./eml.js";
import html from "./html.js";
import xlsx from "./xlsx.js";
import doc from "./doc.js";
export const show = (data, file, id) => {
  let ext = file.split(".").at(-1);
  if ("pdf" === ext) {
    document.getElementById(id).innerHTML = pdf(data);
  } else if ("png" === ext) {
    document.getElementById(id).innerHTML = png(data);
  } else if ("jpeg" === ext || "jpg" === ext) {
    document.getElementById(id).innerHTML = jpeg(data);
  } else if ("eml" === ext) {
    document.getElementById(id).innerHTML = eml(data);
  } else if ("html" === ext) {
    document.getElementById(id).innerHTML = html(data);
  } else if ("xlsx" === ext || "xls" === ext || "csv" === ext) {
    document.getElementById(id).innerHTML = xlsx(data);
  } else if ("docx" === ext || "doc" === ext) {
    doc(data, id);
  }
};

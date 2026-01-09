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
    document.getElementById("view").innerHTML = pdf(data);
  } else if ("png" === ext) {
    document.getElementById("view").innerHTML = png(data);
  } else if ("jpeg" === ext || "jpg" === ext) {
    document.getElementById("view").innerHTML = jpeg(data);
  } else if ("eml" === ext) {
    document.getElementById("view").innerHTML = eml(data);
  } else if ("html" === ext) {
    document.getElementById("view").innerHTML = html(data);
  } else if ("xlsx" === ext || "xls" === ext || "csv" === ext) {
    document.getElementById("view").innerHTML = xlsx(data);
  } else if ("docx" === ext || "doc" === ext) {
    doc(data, id);
  }
};

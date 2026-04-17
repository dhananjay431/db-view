let XLSX = require("xlsx");

function normalizePath(basePath, targetPath) {
  if (targetPath.startsWith("/")) return targetPath.replace(/^\/+/, "");
  const baseDir = basePath.split("/").slice(0, -1);
  const parts = `${baseDir.join("/")}/${targetPath}`.split("/");
  const normalized = [];
  for (const part of parts) {
    if (!part || part === ".") continue;
    if (part === "..") normalized.pop();
    else normalized.push(part);
  }
  return normalized.join("/");
}

function getEmbedId(blip) {
  if (!blip) return null;
  return (
    blip.getAttribute("r:embed") ||
    blip.getAttribute("embed") ||
    Array.from(blip.attributes || []).find((attr) => attr.name.endsWith(":embed"))
      ?.value ||
    null
  );
}

function parseXml(content) {
  if (typeof DOMParser === "undefined") return null;
  return new DOMParser().parseFromString(content, "application/xml");
}

function toBase64(content) {
  if (typeof btoa === "function") return btoa(content);
  if (typeof Buffer !== "undefined") return Buffer.from(content, "binary").toString("base64");
  return null;
}

function getFileContent(workbook, path) {
  const file = workbook.files?.[path];
  if (!file) return null;
  const content = file.content;
  if (typeof content === "string") return content;
  if (content instanceof Uint8Array) return new TextDecoder("utf-8").decode(content);
  if (content instanceof ArrayBuffer)
    return new TextDecoder("utf-8").decode(new Uint8Array(content));
  return null;
}

function getFileAsBase64(workbook, path) {
  const file = workbook.files?.[path];
  if (!file || !file.content) return null;
  const content = file.content;
  if (typeof content === "string") return toBase64(content);
  const bytes =
    content instanceof Uint8Array
      ? content
      : content instanceof ArrayBuffer
      ? new Uint8Array(content)
      : null;
  if (!bytes) return null;
  let binary = "";
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return toBase64(binary);
}

function getRelationshipsById(relationshipsXml) {
  const rels = {};
  relationshipsXml.querySelectorAll("Relationship").forEach((relationship) => {
    const id = relationship.getAttribute("Id");
    const target = relationship.getAttribute("Target");
    if (id && target) rels[id] = target;
  });
  return rels;
}

function extractSheetImages(workbook, sheetName) {
  if (!workbook.files) return [];
  const workbookXmlText = getFileContent(workbook, "xl/workbook.xml");
  const workbookRelsText = getFileContent(workbook, "xl/_rels/workbook.xml.rels");
  if (!workbookXmlText || !workbookRelsText) return [];

  const workbookXml = parseXml(workbookXmlText);
  const workbookRelsXml = parseXml(workbookRelsText);
  if (!workbookXml || !workbookRelsXml) return [];
  const workbookRels = getRelationshipsById(workbookRelsXml);
  const sheet = Array.from(workbookXml.querySelectorAll("sheet")).find(
    (node) => node.getAttribute("name") === sheetName
  );
  if (!sheet) return [];

  const sheetRelId = sheet.getAttribute("r:id");
  const sheetTarget = workbookRels[sheetRelId];
  if (!sheetTarget) return [];

  const sheetPath = normalizePath("xl/workbook.xml", sheetTarget);
  const sheetRelsPath = `${sheetPath.replace(/\/[^/]+$/, "")}/_rels/${sheetPath
    .split("/")
    .pop()}.rels`;
  const sheetRelsText = getFileContent(workbook, sheetRelsPath);
  if (!sheetRelsText) return [];

  const sheetRels = parseXml(sheetRelsText);
  if (!sheetRels) return [];
  const drawingRel = Array.from(sheetRels.querySelectorAll("Relationship")).find((rel) =>
    /\/drawing$/.test(rel.getAttribute("Type") || "")
  );
  if (!drawingRel) return [];

  const drawingPath = normalizePath(sheetRelsPath, drawingRel.getAttribute("Target"));
  const drawingXmlText = getFileContent(workbook, drawingPath);
  if (!drawingXmlText) return [];

  const drawingRelsPath = `${drawingPath.replace(/\/[^/]+$/, "")}/_rels/${drawingPath
    .split("/")
    .pop()}.rels`;
  const drawingRelsText = getFileContent(workbook, drawingRelsPath);
  if (!drawingRelsText) return [];

  const drawingXml = parseXml(drawingXmlText);
  const drawingRelsXml = parseXml(drawingRelsText);
  if (!drawingXml || !drawingRelsXml) return [];
  const drawingRels = getRelationshipsById(drawingRelsXml);
  const anchors = [
    ...Array.from(drawingXml.querySelectorAll("oneCellAnchor")),
    ...Array.from(drawingXml.querySelectorAll("twoCellAnchor")),
  ];

  return anchors
    .map((anchor) => {
      const from = anchor.querySelector("from");
      const blip = anchor.querySelector("blip");
      if (!from || !blip) return null;

      const col = Number(from.querySelector("col")?.textContent || "0");
      const row = Number(from.querySelector("row")?.textContent || "0");
      const embedId = getEmbedId(blip);
      const mediaTarget = embedId ? drawingRels[embedId] : null;
      if (!mediaTarget) return null;

      const mediaPath = normalizePath(drawingRelsPath, mediaTarget);
      const base64 = getFileAsBase64(workbook, mediaPath);
      if (!base64) return null;

      const extNode = anchor.querySelector("ext");
      const cx = Number(extNode?.getAttribute("cx") || "0");
      const cy = Number(extNode?.getAttribute("cy") || "0");
      const width = cx > 0 ? Math.round(cx / 9525) : null;
      const height = cy > 0 ? Math.round(cy / 9525) : null;

      const extension = mediaPath.split(".").pop()?.toLowerCase() || "png";
      const mimeType =
        extension === "jpg" || extension === "jpeg"
          ? "image/jpeg"
          : extension === "gif"
          ? "image/gif"
          : extension === "bmp"
          ? "image/bmp"
          : extension === "svg"
          ? "image/svg+xml"
          : "image/png";

      return {
        address: XLSX.utils.encode_cell({ r: row, c: col }),
        src: `data:${mimeType};base64,${base64}`,
        width,
        height,
      };
    })
    .filter(Boolean);
}

function ensureCell(table, rowIndex, columnIndex) {
  while (table.rows.length <= rowIndex) {
    table.insertRow();
  }
  const row = table.rows[rowIndex];
  while (row.cells.length <= columnIndex) {
    row.insertCell();
  }
  return row.cells[columnIndex];
}

function appendImagesToHtml(html, images) {
  if (!images.length) return html;
  if (typeof DOMParser === "undefined") return html;
  const doc = new DOMParser().parseFromString(html, "text/html");
  const table = doc.querySelector("table");
  if (!table) return html;

  images.forEach(({ address, src, width, height }) => {
    const decoded = XLSX.utils.decode_cell(address);
    let cell = doc.getElementById(`sjs-${address}`);
    if (!cell) {
      cell = ensureCell(table, decoded.r, decoded.c);
      cell.id = `sjs-${address}`;
    }
    const imgElement = doc.createElement("img");
    imgElement.src = src;
    imgElement.alt = `Excel image at ${address}`;
    if (width) imgElement.width = width;
    if (height) imgElement.height = height;
    cell.appendChild(imgElement);
  });

  return doc.documentElement.outerHTML;
}

export default function xlsx(b64Data) {
  const workbook = XLSX.read(b64Data, { type: "base64", bookFiles: true });

  // 2. Access the data (Example: Get the first sheet)
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];

  const html = XLSX.utils.sheet_to_html(worksheet);
  const images = extractSheetImages(workbook, sheetName);
  return appendImagesToHtml(html, images);
}

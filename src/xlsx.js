let XLSX = require("xlsx");

const MIME_TYPES = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  bmp: "image/bmp",
  webp: "image/webp",
  svg: "image/svg+xml",
};
const BASE64_CHUNK_SIZE = 0x8000;

const toUtf8 = (content) => {
  if (!content) return "";
  if (typeof content === "string") return content;
  return new TextDecoder("utf-8").decode(content);
};

const toBase64 = (content) => {
  if (!content) return "";
  if (typeof Buffer !== "undefined" && Buffer.isBuffer(content)) {
    return content.toString("base64");
  }
  const bytes = content instanceof Uint8Array ? content : new Uint8Array(content);
  let binary = "";
  for (let i = 0; i < bytes.length; i += BASE64_CHUNK_SIZE) {
    binary += String.fromCharCode(...bytes.subarray(i, i + BASE64_CHUNK_SIZE));
  }
  return btoa(binary);
};

const getDir = (path = "") => {
  const parts = path.split("/");
  parts.pop();
  return parts.join("/");
};

const getFileName = (path = "") => path.split("/").pop() || "";

const normalizePath = (baseFilePath, targetPath) => {
  if (!targetPath) return "";
  const baseParts = getDir(baseFilePath).split("/").filter(Boolean);
  const targetParts = targetPath.split("/").filter(Boolean);
  const allParts = targetPath.startsWith("/") ? targetParts : [...baseParts, ...targetParts];

  const normalized = [];
  for (const part of allParts) {
    if (part === ".") continue;
    if (part === "..") {
      normalized.pop();
      continue;
    }
    normalized.push(part);
  }
  return normalized.join("/");
};

const parseAttrs = (tag = "") => {
  const attrs = {};
  const attrRegex = /([^\s=]+)=["']([^"']*)["']/g;
  let match;
  while ((match = attrRegex.exec(tag))) {
    attrs[match[1]] = match[2];
  }
  return attrs;
};

const parseRelationships = (xml = "") => {
  const rels = {};
  const relRegex = /<Relationship\b[^>]*\/?>/g;
  let relTag;
  while ((relTag = relRegex.exec(xml))) {
    const attrs = parseAttrs(relTag[0]);
    if (attrs.Id && attrs.Target) {
      rels[attrs.Id] = { target: attrs.Target, type: attrs.Type || "" };
    }
  }
  return rels;
};

const getWorkbookImagesByCell = (workbook, sheetName) => {
  const sheetMeta = workbook?.Workbook?.Sheets?.find((sheet) => sheet.name === sheetName);
  const sheetRelId = sheetMeta?.id;
  if (!sheetRelId) return [];

  const wbRelsPath = "xl/_rels/workbook.xml.rels";
  const wbRelsXml = toUtf8(workbook?.files?.[wbRelsPath]?.content);
  const wbRels = parseRelationships(wbRelsXml);
  const sheetRel = wbRels[sheetRelId];
  if (!sheetRel) return [];

  const sheetPath = normalizePath("xl/workbook.xml", sheetRel.target);
  const sheetRelsPath = `${getDir(sheetPath)}/_rels/${getFileName(sheetPath)}.rels`;
  const sheetRelsXml = toUtf8(workbook?.files?.[sheetRelsPath]?.content);
  const sheetRels = parseRelationships(sheetRelsXml);
  const drawingRel = Object.values(sheetRels).find((rel) => rel.type.includes("/drawing"));
  if (!drawingRel) return [];

  const drawingPath = normalizePath(sheetPath, drawingRel.target);
  const drawingXml = toUtf8(workbook?.files?.[drawingPath]?.content);
  if (!drawingXml) return [];

  const drawingRelsPath = `${getDir(drawingPath)}/_rels/${getFileName(drawingPath)}.rels`;
  const drawingRelsXml = toUtf8(workbook?.files?.[drawingRelsPath]?.content);
  const drawingRels = parseRelationships(drawingRelsXml);

  const images = [];
  const anchorRegex = /<(?:xdr:)?(?:twoCellAnchor|oneCellAnchor)\b[^>]*>([\s\S]*?)<\/(?:xdr:)?(?:twoCellAnchor|oneCellAnchor)>/g;
  let anchorMatch;
  while ((anchorMatch = anchorRegex.exec(drawingXml))) {
    const anchorXml = anchorMatch[1];
    const rowMatch = anchorXml.match(/<(?:xdr:)?row>(\d+)<\/(?:xdr:)?row>/);
    const colMatch = anchorXml.match(/<(?:xdr:)?col>(\d+)<\/(?:xdr:)?col>/);
    const embedMatch = anchorXml.match(/<a:blip\b[^>]*\br:embed=["']([^"']+)["']/);
    if (!rowMatch || !colMatch || !embedMatch) continue;

    const imageRel = drawingRels[embedMatch[1]];
    if (!imageRel || !imageRel.type.includes("/image")) continue;

    const imagePath = normalizePath(drawingPath, imageRel.target);
    const imageContent = workbook?.files?.[imagePath]?.content;
    if (!imageContent) continue;

    const ext = (getFileName(imagePath).split(".").pop() || "").toLowerCase();
    const mimeType = MIME_TYPES[ext] || "image/png";
    images.push({
      cell: XLSX.utils.encode_cell({ c: Number(colMatch[1]), r: Number(rowMatch[1]) }),
      src: `data:${mimeType};base64,${toBase64(imageContent)}`,
    });
  }

  return images;
};

const injectImagesInHtml = (html, images) => {
  let updatedHtml = html;
  const imageMap = {};
  for (const image of images) {
    if (!image?.cell || !image?.src) continue;
    if (!imageMap[image.cell]) imageMap[image.cell] = [];
    imageMap[image.cell].push(image.src);
  }

  for (const cell of Object.keys(imageMap)) {
    const cellKey = `sjs-${cell}`;
    const imagesHtml = imageMap[cell]
      .map((src) => `<img src="${src}" alt="" style="max-width:100%;height:auto;display:block;"/>`)
      .join("<br/>");
    const matchRegex = new RegExp(`(<td[^>]*\\bid=["']${cellKey}["'][^>]*>)([\\s\\S]*?)(</td>)`);
    updatedHtml = updatedHtml.replace(matchRegex, (full, openTag, content, closeTag) => {
      return `${openTag}${content}${imagesHtml}${closeTag}`;
    });
  }
  return updatedHtml;
};

export default function xlsx(b64Data) {
  const workbook = XLSX.read(b64Data, { type: "base64", bookFiles: true });

  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  const images = getWorkbookImagesByCell(workbook, sheetName);

  if (images.length && worksheet["!ref"]) {
    const range = XLSX.utils.decode_range(worksheet["!ref"]);
    for (const image of images) {
      const cell = XLSX.utils.decode_cell(image.cell);
      if (cell.c > range.e.c) range.e.c = cell.c;
      if (cell.r > range.e.r) range.e.r = cell.r;
    }
    worksheet["!ref"] = XLSX.utils.encode_range(range);
  }

  let html = XLSX.utils.sheet_to_html(worksheet);
  if (images.length) {
    html = injectImagesInHtml(html, images);
  }
  return html;
}

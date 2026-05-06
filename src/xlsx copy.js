let XLSX = require("xlsx");
import JSZip from "jszip";

function getMimeFromExt(ext) {
  const map = {
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    gif: "image/gif",
    bmp: "image/bmp",
    svg: "image/svg+xml",
    webp: "image/webp",
    tiff: "image/tiff",
    tif: "image/tiff",
  };
  return map[ext] || null;
}

// Detect image MIME type from file magic bytes
function getMimeFromBytes(bytes) {
  if (
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47
  )
    return "image/png";
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff)
    return "image/jpeg";
  if (
    bytes[0] === 0x47 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x38
  )
    return "image/gif";
  if (bytes[0] === 0x42 && bytes[1] === 0x4d) return "image/bmp";
  if (
    bytes[0] === 0x49 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x2a &&
    bytes[3] === 0x00
  )
    return "image/tiff";
  if (
    bytes[0] === 0x4d &&
    bytes[1] === 0x4d &&
    bytes[2] === 0x00 &&
    bytes[3] === 0x2a
  )
    return "image/tiff";
  if (
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  )
    return "image/webp";
  return null;
}

// Resolve relative path segments (e.g., "../media/image1.png" relative to "xl/drawings/drawing1.xml")
function resolveRelPath(basePath, relTarget) {
  const parts = basePath.split("/");
  parts.pop(); // remove the filename
  for (const seg of relTarget.split("/")) {
    if (seg === "..") parts.pop();
    else if (seg !== ".") parts.push(seg);
  }
  return parts.join("/");
}

// Helper: find element by namespace OR prefixed tag name
function findElements(parent, ns, localName, prefix) {
  let els = Array.from(parent.getElementsByTagNameNS(ns, localName));
  if (els.length === 0 && prefix) {
    els = Array.from(parent.getElementsByTagName(prefix + ":" + localName));
  }
  return els;
}

async function extractImagePlacements(b64Data) {
  const binary = atob(b64Data);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }

  const zip = await JSZip.loadAsync(bytes);

  // Collect all renderable media files as base64 with detected MIME types
  const mediaFiles = {};
  for (const [path, file] of Object.entries(zip.files)) {
    if (/^xl\/media\/.+/i.test(path) && !file.dir) {
      const rawBytes = await file.async("uint8array");
      const ext = path.split(".").pop().toLowerCase();
      const mime = getMimeFromBytes(rawBytes) || getMimeFromExt(ext);
      if (!mime) continue; // skip emf, wmf, etc.
      mediaFiles[path] = {
        base64: await file.async("base64"),
        mime: mime,
      };
    }
  }
  if (Object.keys(mediaFiles).length === 0) return [];

  const images = [];

  const XDR =
    "http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing";
  const A = "http://schemas.openxmlformats.org/drawingml/2006/main";
  const R =
    "http://schemas.openxmlformats.org/officeDocument/2006/relationships";

  // Process every drawing XML
  for (const [path, file] of Object.entries(zip.files)) {
    if (!/^xl\/drawings\/drawing\d+\.xml$/i.test(path) || file.dir) continue;

    const drawingXml = await file.async("string");

    // Build rId → media path map from the rels file
    const relsPath = path.replace(
      /xl\/drawings\/(drawing\d+\.xml)/,
      "xl/drawings/_rels/$1.rels",
    );
    const relsMap = {};
    if (zip.files[relsPath]) {
      const relsXml = await zip.files[relsPath].async("string");
      const relsDoc = new DOMParser().parseFromString(relsXml, "text/xml");
      const rels = relsDoc.getElementsByTagName("Relationship");
      for (let i = 0; i < rels.length; i++) {
        const id = rels[i].getAttribute("Id");
        const target = rels[i].getAttribute("Target");
        relsMap[id] = resolveRelPath(path, target);
      }
    }
    if (Object.keys(relsMap).length === 0) continue;

    const doc = new DOMParser().parseFromString(drawingXml, "text/xml");

    // Gather all anchor types
    const anchors = [
      ...findElements(doc, XDR, "twoCellAnchor", "xdr"),
      ...findElements(doc, XDR, "oneCellAnchor", "xdr"),
    ];

    for (const anchor of anchors) {
      // Get "from" cell reference
      const fromEls = findElements(anchor, XDR, "from", "xdr");
      const from = fromEls[0];
      if (!from) continue;

      const colEls = findElements(from, XDR, "col", "xdr");
      const rowEls = findElements(from, XDR, "row", "xdr");
      const col = parseInt(colEls[0]?.textContent || "0");
      const row = parseInt(rowEls[0]?.textContent || "0");

      // Find the blip (may be nested inside pic > blipFill)
      let blips = findElements(anchor, A, "blip", "a");
      if (blips.length === 0) continue;

      const blip = blips[0];
      const rEmbed =
        blip.getAttributeNS(R, "embed") || blip.getAttribute("r:embed");
      if (!rEmbed || !relsMap[rEmbed]) continue;

      const mediaPath = relsMap[rEmbed];
      const media = mediaFiles[mediaPath];
      if (!media) continue;

      images.push({
        row,
        col,
        cellRef: XLSX.utils.encode_cell({ r: row, c: col }),
        src: `data:${media.mime};base64,${media.base64}`,
      });
    }

    // Handle absoluteAnchor (no cell position — shown at end)
    const absAnchors = findElements(doc, XDR, "absoluteAnchor", "xdr");
    for (const anchor of absAnchors) {
      let blips = findElements(anchor, A, "blip", "a");
      if (blips.length === 0) continue;
      const blip = blips[0];
      const rEmbed =
        blip.getAttributeNS(R, "embed") || blip.getAttribute("r:embed");
      if (!rEmbed || !relsMap[rEmbed]) continue;
      const mediaPath = relsMap[rEmbed];
      const media = mediaFiles[mediaPath];
      if (!media) continue;
      images.push({
        row: -1,
        col: -1,
        cellRef: null,
        src: `data:${media.mime};base64,${media.base64}`,
      });
    }
  }

  return images;
}

function injectImages(tableHtml, images) {
  if (images.length === 0) return tableHtml;

  const container = document.createElement("div");
  container.innerHTML = tableHtml;
  const table = container.querySelector("table");

  const unplaced = [];

  if (table) {
    for (const img of images) {
      if (!img.cellRef) {
        unplaced.push(img);
        continue;
      }

      let td = table.querySelector(`[id="sjs-${img.cellRef}"]`);

      if (!td) {
        const rows = table.querySelectorAll("tr");
        const tr = rows[img.row];
        if (tr) {
          const cells = tr.querySelectorAll("td, th");
          td = cells[img.col] || null;
        }
      }

      if (td) {
        const imgEl = document.createElement("img");
        imgEl.src = img.src;
        imgEl.style.maxWidth = "100%";
        imgEl.style.height = "auto";
        imgEl.style.display = "block";
        td.appendChild(imgEl);
      } else {
        unplaced.push(img);
      }
    }
  } else {
    unplaced.push(...images);
  }

  if (unplaced.length > 0) {
    const extra = document.createElement("div");
    extra.style.marginTop = "12px";
    for (const img of unplaced) {
      const imgEl = document.createElement("img");
      imgEl.src = img.src;
      imgEl.style.maxWidth = "100%";
      imgEl.style.height = "auto";
      imgEl.style.display = "block";
      imgEl.style.marginBottom = "8px";
      extra.appendChild(imgEl);
    }
    container.appendChild(extra);
  }

  return container.innerHTML;
}

function optimizeSheetRef(ws) {
  let minR = Infinity, maxR = -1;
  let minC = Infinity, maxC = -1;
  let hasData = false;
  
  for (const key in ws) {
    if (key.startsWith('!')) continue;
    const cell = XLSX.utils.decode_cell(key);
    hasData = true;
    if (cell.r < minR) minR = cell.r;
    if (cell.r > maxR) maxR = cell.r;
    if (cell.c < minC) minC = cell.c;
    if (cell.c > maxC) maxC = cell.c;
  }
  
  if (hasData) {
    ws['!ref'] = XLSX.utils.encode_range({s: {r: minR, c: minC}, e: {r: maxR, c: maxC}});
  } else {
    ws['!ref'] = 'A1:A1';
  }
}

export default async function xlsx(b64Data) {
  const workbook = XLSX.read(b64Data, { type: "base64" });

  // Extract embedded images
  let images = [];
  try {
    images = await extractImagePlacements(b64Data);
  } catch (e) {
    console.error("XLSX image extraction failed:", e);
  }

  const sheetNames = workbook.SheetNames;

  // Single sheet — no tabs needed
  if (sheetNames.length <= 1) {
    const worksheet = workbook.Sheets[sheetNames[0]];
    optimizeSheetRef(worksheet);
    let tableHtml = XLSX.utils.sheet_to_html(worksheet);
    return injectImages(tableHtml, images);
  }

  // Multiple sheets — build tab UI
  const tabStyles = `
    <style>
      .xlsx-tabs { display:flex; border-bottom:2px solid #dee2e6; margin-bottom:0; padding:0; gap:2px; }
      .xlsx-tab { padding:8px 16px; cursor:pointer; border:1px solid transparent;
        border-bottom:none; border-radius:4px 4px 0 0; background:#f8f9fa; color:#495057;
        font-size:14px; font-family:sans-serif; user-select:none; white-space:nowrap; }
      .xlsx-tab:hover { background:#e9ecef; }
      .xlsx-tab.active { background:#fff; color:#212529; border-color:#dee2e6;
        font-weight:600; position:relative; top:1px; }
      .xlsx-sheet { display:none; }
      .xlsx-sheet.active { display:block; }
    </style>`;

  let tabBar = '<div class="xlsx-tabs">';
  let sheets = "";

  for (let i = 0; i < sheetNames.length; i++) {
    const name = sheetNames[i];
    const activeClass = i === 0 ? " active" : "";
    const safeId = "xlsx-sheet-" + i;

    tabBar += `<div class="xlsx-tab${activeClass}" data-sheet="${safeId}" onclick="var w=this.closest('.xlsx-wrapper');w.querySelectorAll('.xlsx-tab').forEach(function(t){t.classList.remove('active')});w.querySelectorAll('.xlsx-sheet').forEach(function(p){p.classList.remove('active')});this.classList.add('active');w.querySelector('#'+this.getAttribute('data-sheet')).classList.add('active')">${name.replace(/</g, "&lt;")}</div>`;

    const worksheet = workbook.Sheets[name];
    optimizeSheetRef(worksheet);
    let tableHtml = XLSX.utils.sheet_to_html(worksheet);
    tableHtml = injectImages(tableHtml, images);

    sheets += `<div id="${safeId}" class="xlsx-sheet${activeClass}">${tableHtml}</div>`;
  }

  tabBar += "</div>";

  return tabStyles + '<div class="xlsx-wrapper">' + tabBar + sheets + "</div>";
}

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
  let minR = Infinity,
    maxR = -1;
  let minC = Infinity,
    maxC = -1;
  let hasData = false;

  for (const key in ws) {
    if (key.startsWith("!")) continue;
    const cell = XLSX.utils.decode_cell(key);
    hasData = true;
    if (cell.r < minR) minR = cell.r;
    if (cell.r > maxR) maxR = cell.r;
    if (cell.c < minC) minC = cell.c;
    if (cell.c > maxC) maxC = cell.c;
  }

  if (hasData) {
    ws["!ref"] = XLSX.utils.encode_range({
      s: { r: minR, c: minC },
      e: { r: maxR, c: maxC },
    });
  } else {
    ws["!ref"] = "A1:A1";
  }
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function getDisplayValue(cell) {
  if (!cell) return "";
  if (cell.w !== undefined) return cell.w;
  return XLSX.utils.format_cell(cell);
}

function getColumnWidth(ws, colIndex) {
  const column = ws["!cols"]?.[colIndex];
  const width =
    column?.wpx || (column?.wch ? Math.max(64, column.wch * 8) : 112);
  return Math.min(Math.max(width, 64), 280);
}

function getRowHeight(ws, rowIndex) {
  const row = ws["!rows"]?.[rowIndex];
  return row?.hpx ? Math.min(Math.max(row.hpx, 28), 140) : 32;
}

function buildMergeMap(ws) {
  const covered = new Set();
  const origins = new Map();

  for (const merge of ws["!merges"] || []) {
    const rows = merge.e.r - merge.s.r + 1;
    const cols = merge.e.c - merge.s.c + 1;
    const origin = `${merge.s.r}:${merge.s.c}`;
    origins.set(origin, { rows, cols });

    for (let r = merge.s.r; r <= merge.e.r; r++) {
      for (let c = merge.s.c; c <= merge.e.c; c++) {
        if (r !== merge.s.r || c !== merge.s.c) covered.add(`${r}:${c}`);
      }
    }
  }

  return { covered, origins };
}

function getUsedRows(ws, range) {
  const rows = new Set();

  for (const key in ws) {
    if (key.startsWith("!")) continue;
    const cell = ws[key];
    if (
      !cell ||
      (cell.v === undefined && cell.f === undefined && cell.w === undefined)
    )
      continue;

    const address = XLSX.utils.decode_cell(key);
    if (address.r >= range.s.r && address.r <= range.e.r) rows.add(address.r);
  }

  for (const merge of ws["!merges"] || []) {
    if (
      merge.e.r >= range.s.r &&
      merge.s.r <= range.e.r &&
      merge.e.c >= range.s.c &&
      merge.s.c <= range.e.c
    ) {
      rows.add(merge.s.r);
    }
  }

  if (rows.size === 0) rows.add(range.s.r);
  return Array.from(rows).sort((a, b) => a - b);
}

function cellClass(cell) {
  if (!cell) return "xlsx-cell-empty";
  if (cell.t === "n" || cell.t === "d") return "xlsx-cell-number";
  if (cell.t === "b") return "xlsx-cell-boolean";
  return "xlsx-cell-text";
}

function worksheetToGridHtml(ws) {
  optimizeSheetRef(ws);

  const range = XLSX.utils.decode_range(ws["!ref"] || "A1:A1");
  const mergeMap = buildMergeMap(ws);
  const columnCount = range.e.c - range.s.c + 1;
  const physicalRowCount = range.e.r - range.s.r + 1;
  const rowsToRender = physicalRowCount > 5000 ? getUsedRows(ws, range) : null;
  const rowCount = rowsToRender ? rowsToRender.length : physicalRowCount;
  const skippedRows = rowsToRender ? physicalRowCount - rowsToRender.length : 0;

  let colgroup = '<col style="width:48px" />';
  for (let c = range.s.c; c <= range.e.c; c++) {
    colgroup += `<col style="width:${getColumnWidth(ws, c)}px" />`;
  }

  let thead = '<thead><tr><th class="xlsx-corner"></th>';
  for (let c = range.s.c; c <= range.e.c; c++) {
    thead += `<th class="xlsx-col-header">${XLSX.utils.encode_col(c)}</th>`;
  }
  thead += "</tr></thead>";

  let tbody = "<tbody>";
  const renderRows =
    rowsToRender ||
    Array.from({ length: physicalRowCount }, (_, index) => range.s.r + index);

  for (let rowIndex = 0; rowIndex < renderRows.length; rowIndex++) {
    const r = renderRows[rowIndex];
    const previous = renderRows[rowIndex - 1];
    if (previous !== undefined && r > previous + 1) {
      tbody += `<tr class="xlsx-gap-row"><th class="xlsx-row-header">...</th><td colspan="${columnCount}">${r - previous - 1} blank rows hidden</td></tr>`;
    }

    tbody += `<tr style="height:${getRowHeight(ws, r)}px"><th class="xlsx-row-header">${r + 1}</th>`;

    for (let c = range.s.c; c <= range.e.c; c++) {
      const key = `${r}:${c}`;
      if (mergeMap.covered.has(key)) continue;

      const cellRef = XLSX.utils.encode_cell({ r, c });
      const cell = ws[cellRef];
      const merge = mergeMap.origins.get(key);
      const attrs = [
        `id="sjs-${cellRef}"`,
        `data-cell="${cellRef}"`,
        `class="${cellClass(cell)}"`,
      ];

      if (merge?.rows > 1) attrs.push(`rowspan="${merge.rows}"`);
      if (merge?.cols > 1) attrs.push(`colspan="${merge.cols}"`);
      if (cell?.f)
        attrs.push(`title="${escapeHtml(`${cellRef}: =${cell.f}`)}"`);

      tbody += `<td ${attrs.join(" ")}>${escapeHtml(getDisplayValue(cell))}</td>`;
    }

    tbody += "</tr>";
  }
  tbody += "</tbody>";

  return `
    <div class="xlsx-grid-wrap" style="--xlsx-cols:${columnCount}; --xlsx-rows:${rowCount};">
      ${
        skippedRows > 0
          ? `<div class="xlsx-grid-note">${skippedRows} blank rows hidden from this preview.</div>`
          : ""
      }
      <table class="xlsx-grid-table">${colgroup}${thead}${tbody}</table>
    </div>
  `;
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

  const styles = `
    <style>
      .xlsx-wrapper {
        width: 100%;
        min-width: 720px;
        height: calc(100vh - 92px);
        min-height: 520px;
        overflow: hidden;
        background: #f5f7fb;
        border: 1px solid #d8dee9;
        border-radius: 8px;
        color: #1f2937;
        font-family: "Segoe UI", Tahoma, Geneva, Verdana, sans-serif;
      }
      .xlsx-toolbar {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 16px;
        min-height: 56px;
        padding: 10px 12px;
        background: #ffffff;
        border-bottom: 1px solid #d8dee9;
      }
      .xlsx-title {
        display: flex;
        flex-direction: column;
        gap: 2px;
        min-width: 0;
      }
      .xlsx-title strong {
        font-size: 15px;
        line-height: 20px;
        font-weight: 650;
      }
      .xlsx-title span {
        color: #6b7280;
        font-size: 12px;
        line-height: 16px;
      }
      .xlsx-sheet-picker {
        display: flex;
        align-items: center;
        gap: 8px;
        flex: 0 0 auto;
      }
      .xlsx-sheet-picker label {
        color: #4b5563;
        font-size: 13px;
        font-weight: 600;
      }
      .xlsx-sheet-picker select {
        min-width: 180px;
        max-width: 280px;
        height: 34px;
        border: 1px solid #c7d0dc;
        border-radius: 6px;
        background: #fff;
        color: #111827;
        font: inherit;
        font-size: 13px;
        padding: 0 32px 0 10px;
      }
      .xlsx-sheet {
        display: none;
        height: calc(100% - 57px);
      }
      .xlsx-sheet.active {
        display: block;
      }
      .xlsx-grid-wrap {
        width: 100%;
        height: 100%;
        overflow: auto;
        background: #ffffff;
      }
      .xlsx-grid-note {
        position: sticky;
        top: 0;
        z-index: 5;
        padding: 7px 10px;
        background: #fff7d6;
        border-bottom: 1px solid #ead38b;
        color: #6f5600;
        font-size: 12px;
        text-align: left;
      }
      .xlsx-grid-table {
        width: max-content !important;
        min-width: 100%;
        border-collapse: separate !important;
        border-spacing: 0;
        table-layout: fixed;
        background: #ffffff;
        font-size: 13px !important;
      }
      .xlsx-grid-table th,
      .xlsx-grid-table td {
        box-sizing: border-box;
        border: 0 !important;
        border-right: 1px solid #e1e6ef !important;
        border-bottom: 1px solid #e1e6ef !important;
        padding: 6px 8px !important;
        height: 32px;
        max-width: 280px;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        vertical-align: middle;
      }
      .xlsx-grid-table tr:first-child {
        background: transparent !important;
        color: inherit !important;
        font-weight: inherit !important;
      }
      .xlsx-corner,
      .xlsx-col-header,
      .xlsx-row-header {
        background: #eef2f7 !important;
        color: #4b5563 !important;
        font-weight: 600 !important;
        text-align: center !important;
        user-select: none;
      }
      .xlsx-corner {
        position: sticky;
        top: 0;
        left: 0;
        z-index: 4;
      }
      .xlsx-col-header {
        position: sticky;
        top: 0;
        z-index: 3;
      }
      .xlsx-row-header {
        position: sticky;
        left: 0;
        z-index: 2;
        width: 48px;
      }
      .xlsx-cell-number,
      .xlsx-cell-boolean {
        text-align: right;
        font-variant-numeric: tabular-nums;
      }
      .xlsx-cell-text {
        text-align: left;
      }
      .xlsx-cell-empty {
        background: #fff;
      }
      .xlsx-grid-table td:hover {
        outline: 2px solid #2f80ed;
        outline-offset: -2px;
      }
      .xlsx-gap-row td,
      .xlsx-gap-row th {
        height: 26px !important;
        background: #fbfcfe !important;
        color: #7b8494 !important;
        font-size: 12px;
        font-style: italic;
        text-align: center !important;
      }
      .xlsx-grid-table img {
        max-width: 180px !important;
        max-height: 140px;
        margin: 4px 0 0 !important;
        object-fit: contain;
      }
      .xlsx-empty {
        display: grid;
        place-items: center;
        height: calc(100% - 57px);
        color: #6b7280;
        font-size: 14px;
      }
      @media (max-width: 760px) {
        .xlsx-wrapper {
          min-width: 0;
          height: calc(100vh - 84px);
          border-radius: 0;
        }
        .xlsx-toolbar {
          align-items: stretch;
          flex-direction: column;
          gap: 10px;
        }
        .xlsx-sheet {
          height: calc(100% - 105px);
        }
        .xlsx-sheet-picker,
        .xlsx-sheet-picker select {
          width: 100%;
        }
      }
    </style>`;

  if (sheetNames.length === 0) {
    return `${styles}<div class="xlsx-wrapper"><div class="xlsx-toolbar"><div class="xlsx-title"><strong>SheetJS In-Browser Live Grid</strong><span>No worksheets found</span></div></div><div class="xlsx-empty">No worksheet data to preview.</div></div>`;
  }

  const options = sheetNames
    .map(
      (name, index) =>
        `<option value="xlsx-sheet-${index}">${escapeHtml(name)}</option>`,
    )
    .join("");

  const toolbar = `
    <div class="xlsx-toolbar">
      
      <div class="xlsx-sheet-picker">
        <label for="xlsx-sheet-select">Choose a worksheet:</label>
        <select id="xlsx-sheet-select" onchange="var w=this.closest('.xlsx-wrapper');w.querySelectorAll('.xlsx-sheet').forEach(function(s){s.classList.remove('active')});var sheet=w.querySelector('#'+this.value);if(sheet)sheet.classList.add('active');">
          ${options}
        </select>
      </div>
    </div>`;

  let sheets = "";

  for (let i = 0; i < sheetNames.length; i++) {
    const name = sheetNames[i];
    const activeClass = i === 0 ? " active" : "";
    const safeId = "xlsx-sheet-" + i;

    const worksheet = workbook.Sheets[name];
    let tableHtml = worksheetToGridHtml(worksheet);
    tableHtml = injectImages(tableHtml, images);

    sheets += `<div id="${safeId}" class="xlsx-sheet${activeClass}">${tableHtml}</div>`;
  }

  return styles + '<div class="xlsx-wrapper">' + toolbar + sheets + "</div>";
}

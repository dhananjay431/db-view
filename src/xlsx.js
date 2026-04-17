let XLSX = require("xlsx");

function toBase64(bytes) {
  let binary = "";
  const chunkSize = 8192;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode.apply(null, chunk);
  }
  return btoa(binary);
}

function getMimeType(ext) {
  if (ext === "png") return "image/png";
  if (ext === "jpg" || ext === "jpeg") return "image/jpeg";
  if (ext === "gif") return "image/gif";
  if (ext === "bmp") return "image/bmp";
  if (ext === "svg") return "image/svg+xml";
  if (ext === "webp") return "image/webp";
  return "application/octet-stream";
}

function extractEmbeddedImages(workbook) {
  const files = workbook && workbook.files ? workbook.files : null;
  if (!files) return [];

  const mediaPaths = Object.keys(files).filter((path) =>
    /^xl\/media\/.+\.(png|jpg|jpeg|gif|bmp|svg|webp)$/i.test(path),
  );

  return mediaPaths
    .sort()
    .map((path) => {
      const entry = files[path];
      if (!entry || !entry.content) return null;

      const ext = path.split(".").at(-1).toLowerCase();
      const bytes = entry.content instanceof Uint8Array ? entry.content : null;
      if (!bytes) return null;

      return {
        path,
        src: `data:${getMimeType(ext)};base64,${toBase64(bytes)}`,
      };
    })
    .filter(Boolean);
}

export default function xlsx(b64Data) {
  const workbook = XLSX.read(b64Data, { type: "base64", bookFiles: true });

  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  const tableHtml = XLSX.utils.sheet_to_html(worksheet);

  const images = extractEmbeddedImages(workbook);
  if (!images.length) return tableHtml;

  const imagesHtml = images
    .map(
      (image) =>
        `<img src="${image.src}" alt="${image.path}" style="max-width:100%;height:auto;display:block;margin:12px 0;"/>`,
    )
    .join("");

  return `${tableHtml}<div style="margin-top:12px;">${imagesHtml}</div>`;
}

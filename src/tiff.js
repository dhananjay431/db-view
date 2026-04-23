import * as UTIF from "./assets/UTIF.min.js";
export default function tiff(base64, id) {
  try {
    // Remove data URL prefix if present
    base64 = base64.replace(/^data:image\/tiff;base64,/, "");

    // Decode Base64 to binary
    const binary = atob(base64);
    const len = binary.length;
    const buffer = new ArrayBuffer(len);
    const view = new Uint8Array(buffer);

    for (let i = 0; i < len; i++) {
      view[i] = binary.charCodeAt(i);
    }

    // Decode TIFF using UTIF.js
    const ifds = UTIF.decode(buffer);
    if (!ifds || ifds.length === 0) {
      throw new Error("Invalid TIFF file or no pages found.");
    }

    // Use the first page
    const firstPage = ifds[0];
    UTIF.decodeImage(buffer, firstPage);
    const rgba = UTIF.toRGBA8(firstPage);

    // Create canvas dynamically
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");

    canvas.width = firstPage.width;
    canvas.height = firstPage.height;

    // Render image on canvas
    const imageData = ctx.createImageData(firstPage.width, firstPage.height);
    imageData.data.set(rgba);
    ctx.putImageData(imageData, 0, 0);

    // Convert canvas to data URL and return as HTML img tag
    const dataURL = canvas.toDataURL("image/png");
    return `
      <div class="zoom-controls">
        <button class="zoom-btn" title="Zoom In" onclick="window.zoomDbViewImage(this, 1.2)">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line><line x1="11" y1="8" x2="11" y2="14"></line><line x1="8" y1="11" x2="14" y2="11"></line></svg>
        </button>
        <button class="zoom-btn" title="Zoom Out" onclick="window.zoomDbViewImage(this, 1/1.2)">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line><line x1="8" y1="11" x2="14" y2="11"></line></svg>
        </button>
      </div>
      <div class="image-zoom-wrapper">
        <img src="${dataURL}" alt="tiff image" data-scale="1" />
      </div>
    `;
  } catch (error) {
    console.error("Error rendering TIFF:", error);
    throw new Error("Failed to load TIFF image.");
  }
}

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
    return `<img src="${dataURL}" alt="tiff image" />`;
  } catch (error) {
    console.error("Error rendering TIFF:", error);
    throw new Error("Failed to load TIFF image.");
  }
}

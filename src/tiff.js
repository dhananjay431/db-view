import * as UTIF from "./assets/UTIF.min.js";
export default function tiff(base64, container) {
  if (typeof container === "string") {
    container = document.getElementById(container);
  }
  if (!container) {
    throw new Error("TIFF target container not found.");
  }

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
    const pages = UTIF.decode(buffer);
    if (!pages || pages.length === 0) {
      throw new Error("Invalid TIFF file or no pages found.");
    }

    container.innerHTML = "";

    const imageWrapper = document.createElement("div");
    imageWrapper.style.textAlign = "center";
    imageWrapper.style.overflow = "auto";

    const img = document.createElement("img");
    img.alt = "tiff image";
    img.style.maxWidth = "100%";
    img.style.height = "auto";
    img.style.display = "block";
    img.style.margin = "0 auto";

    imageWrapper.appendChild(img);
    container.appendChild(imageWrapper);

    let currentIndex = 0;

    const renderPage = (index) => {
      const page = pages[index];
      UTIF.decodeImage(buffer, page);
      const rgba = UTIF.toRGBA8(page);

      const canvas = document.createElement("canvas");
      canvas.width = page.width;
      canvas.height = page.height;
      const ctx = canvas.getContext("2d");
      const imageData = ctx.createImageData(page.width, page.height);
      imageData.data.set(rgba);
      ctx.putImageData(imageData, 0, 0);

      img.src = canvas.toDataURL("image/png");
      currentIndex = index;
    };

    renderPage(currentIndex);

    return {
      pages: pages.length,
      get currentIndex() {
        return currentIndex;
      },
      renderPage,
    };
  } catch (error) {
    console.error("Error rendering TIFF:", error);
    container.innerHTML = `<div style="color:red; padding:20px;">Failed to load TIFF image.</div>`;
  }
}

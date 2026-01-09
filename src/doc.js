import "./assets/jszip.min.js";
import * as docx from "./assets/docx-preview.min.js";

export default function doc(data, id) {
  const binaryString = window.atob(data);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  docx.renderAsync(bytes.buffer, document.getElementById(id), null, {
    useMathMLPolyfill: true,
  });
}

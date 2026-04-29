import * as pdfjsLib from 'pdfjs-dist';
import workerSrc from './assets/pdf.worker.min.mjs';

// Use the statically saved local worker from the assets directory
pdfjsLib.GlobalWorkerOptions.workerSrc = workerSrc;

export default function pdf(data, targetId, fileName) {
  const container = document.getElementById(targetId);
  if (!container) return;

  // Clear existing content
  container.innerHTML = '';
  container.style.transform = 'none';

  // Setup UI
  const toolbar = document.createElement('div');
  toolbar.style.display = 'flex';
  toolbar.style.gap = '10px';
  toolbar.style.justifyContent = 'center';
  toolbar.style.alignItems = 'center';
  toolbar.style.padding = '10px';
  toolbar.style.background = '#f1f3f4';
  toolbar.style.borderBottom = '1px solid #ccc';
  toolbar.style.top = '0';
  toolbar.style.zIndex = '10';
  toolbar.style.flexWrap = 'wrap';

  const createBtn = (html, title, onClick) => {
    const btn = document.createElement('button');
    btn.innerHTML = html;
    btn.title = title;
    btn.onclick = onClick;
    btn.style.padding = '8px 12px';
    btn.style.display = 'flex';
    btn.style.alignItems = 'center';
    btn.style.justifyContent = 'center';
    btn.style.cursor = 'pointer';
    btn.style.border = '1px solid #007bff';
    btn.style.background = '#007bff';
    btn.style.color = '#fff';
    btn.style.borderRadius = '4px';
    btn.style.fontWeight = 'bold';
    btn.onmouseover = () => btn.style.background = '#0056b3';
    btn.onmouseout = () => btn.style.background = '#007bff';
    return btn;
  };

  const canvasContainer = document.createElement('div');
  canvasContainer.style.background = '#e5e5e5';
  canvasContainer.style.padding = '20px';
  canvasContainer.style.display = 'flex';
  canvasContainer.style.justifyContent = 'center';
  canvasContainer.style.overflow = 'auto';
  canvasContainer.style.height = '100vh';
  
  const canvas = document.createElement('canvas');
  canvasContainer.appendChild(canvas);

  container.appendChild(toolbar);
  container.appendChild(canvasContainer);

  let pdfDoc = null;
  let pageNum = 1;
  let pageRendering = false;
  let pageNumPending = null;
  let scale = 1.0;
  let rotation = 0; // degrees

  const pageInfo = document.createElement('span');
  pageInfo.style.fontWeight = 'bold';
  pageInfo.style.padding = '0 10px';
  pageInfo.textContent = `Page : 0 / 0`;

  const renderPage = (num) => {
    pageRendering = true;
    pdfDoc.getPage(num).then((page) => {
      const viewport = page.getViewport({ scale: scale, rotation: rotation });
      
      const outputScale = window.devicePixelRatio || 1;
      
      canvas.width = Math.floor(viewport.width * outputScale);
      canvas.height = Math.floor(viewport.height * outputScale);
      canvas.style.width = Math.floor(viewport.width) + "px";
      canvas.style.height = Math.floor(viewport.height) + "px";
      canvas.style.display = 'block';

      const transform = outputScale !== 1 
        ? [outputScale, 0, 0, outputScale, 0, 0] 
        : null;

      const renderContext = {
        canvasContext: canvas.getContext('2d'),
        transform: transform,
        viewport: viewport
      };

      const renderTask = page.render(renderContext);
      renderTask.promise.then(() => {
        pageRendering = false;
        if (pageNumPending !== null) {
          renderPage(pageNumPending);
          pageNumPending = null;
        }
      });
    });

    pageInfo.textContent = `Page ${num} / ${pdfDoc.numPages}`;
  };

  const queueRenderPage = (num) => {
    if (pageRendering) {
      pageNumPending = num;
    } else {
      renderPage(num);
    }
  };

  const onPrevPage = () => {
    if (pageNum <= 1) return;
    pageNum--;
    queueRenderPage(pageNum);
  };

  const onNextPage = () => {
    if (pageNum >= pdfDoc.numPages) return;
    pageNum++;
    queueRenderPage(pageNum);
  };

  const onZoomIn = () => {
    scale += 0.2;
    queueRenderPage(pageNum);
  };

  const onZoomOut = () => {
    if (scale <= 0.4) return;
    scale -= 0.2;
    queueRenderPage(pageNum);
  };

  const onRotateLeft = () => {
    rotation = (rotation - 90) % 360;
    queueRenderPage(pageNum);
  };

  const onRotateRight = () => {
    rotation = (rotation + 90) % 360;
    queueRenderPage(pageNum);
  };

  const onDownload = () => {
    const byteCharacters = atob(data);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    const blob = new Blob([byteArray], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName || 'document.pdf';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const iconZoomIn = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:20px;height:20px;"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line><line x1="11" y1="8" x2="11" y2="14"></line><line x1="8" y1="11" x2="14" y2="11"></line></svg>`;
  const iconZoomOut = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:20px;height:20px;"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line><line x1="8" y1="11" x2="14" y2="11"></line></svg>`;
  const iconRotLeft = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:20px;height:20px;"><polyline points="1 4 1 10 7 10"></polyline><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"></path></svg>`;
  const iconRotRight = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:20px;height:20px;"><polyline points="23 4 23 10 17 10"></polyline><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path></svg>`;
  const iconPrev = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:20px;height:20px;"><polyline points="15 18 9 12 15 6"></polyline></svg>`;
  const iconNext = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:20px;height:20px;"><polyline points="9 18 15 12 9 6"></polyline></svg>`;
  const iconDownload = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:20px;height:20px;"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>`;

  toolbar.appendChild(createBtn(iconZoomIn, 'Zoom In', onZoomIn));
  toolbar.appendChild(createBtn(iconZoomOut, 'Zoom Out', onZoomOut));
  toolbar.appendChild(createBtn(iconRotLeft, 'Rotate Left', onRotateLeft));
  toolbar.appendChild(createBtn(iconRotRight, 'Rotate Right', onRotateRight));
  toolbar.appendChild(createBtn(iconPrev, 'Previous Page', onPrevPage));
  toolbar.appendChild(pageInfo);
  toolbar.appendChild(createBtn(iconNext, 'Next Page', onNextPage));
  toolbar.appendChild(createBtn(iconDownload, 'Download', onDownload));

  const byteCharacters = atob(data);
  const byteNumbers = new Array(byteCharacters.length);
  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i);
  }
  const byteArray = new Uint8Array(byteNumbers);

  const loadingTask = pdfjsLib.getDocument({ 
    data: byteArray,
    cMapUrl: 'https://unpkg.com/pdfjs-dist@5.6.205/cmaps/',
    cMapPacked: true,
    standardFontDataUrl: 'https://unpkg.com/pdfjs-dist@5.6.205/standard_fonts/',
    wasmUrl: 'https://unpkg.com/pdfjs-dist@5.6.205/wasm/'
  });
  loadingTask.promise.then((pdfDocument) => {
    pdfDoc = pdfDocument;
    renderPage(pageNum);
  }).catch((err) => {
    console.error('Error loading PDF: ', err);
    canvasContainer.innerHTML = '<div style="color:red; padding:20px;">Failed to load PDF.</div>';
  });
}
/**
 * db-view TypeScript Definitions
 * Type definitions for the db-view library
 */

// File type definitions
export type FileExtension = "pdf" | "png" | "jpeg" | "jpg" | "eml" | "msg" | "html" | "xlsx" | "xls" | "csv" | "docx" | "doc" | "txt" | "xml" | "svg" | "tif" | "tiff";

// Base64 data type
export type Base64Data = string;

// Container element type
export type ContainerElement = HTMLElement | null;

// File information interface
export interface FileInfo {
  data: Base64Data;
  file: string;
  id: string;
}

// Thumbnail generation options
export interface ThumbnailOptions {
  width?: number;
  height?: number;
  format?: "png" | "jpeg";
  quality?: number;
}

// Zoom control interface
export interface ZoomController {
  scale: number;
  minScale: number;
  maxScale: number;
  zoomIn(factor: number): void;
  zoomOut(factor: number): void;
  reset(): void;
  setScale(scale: number): void;
  getScale(): number;
}

// TIFF viewer interface
export interface TiffViewer {
  pages: number;
  currentIndex: number;
  renderPage(index: number): void;
  nextPage(): void;
  previousPage(): void;
  goToPage(index: number): void;
  dispose(): void;
}

// PDF viewer interface (when using blob URLs)
export interface PdfViewer {
  url: string;
  blobUrl: string | null;
  cleanup(): void;
}

// Image source options
export interface ImageSourceOptions {
  alt?: string;
  className?: string;
  style?: Record<string, string>;
}

// HTML sanitization options
export interface SanitizeOptions {
  allowDataUrls?: boolean;
  allowedProtocols?: string[];
  allowedTags?: string[];
  disallowedTags?: string[];
  allowedAttributes?: string[];
  eventAttributes?: string[];
}

// Document rendering options
export interface DocRenderOptions {
  useMathMLPolyfill?: boolean;
  canvas?: HTMLCanvasElement;
  imageType?: "image/png" | "image/jpeg";
  imageQuality?: number;
}

// Generic view options
export interface ViewOptions {
  container?: string | HTMLElement;
  width?: number | string;
  height?: number | string;
  showToolbar?: boolean;
  allowZoom?: boolean;
  enableNavigation?: boolean;
  preload?: boolean;
}

// Error handler type
export type ErrorHandler = (error: Error, context?: string) => void;

// Event listener type
export type EventListener = (event: Event) => void;

// Event types for the library
export enum DbViewEvents {
  BEFORE_RENDER = "beforeRender",
  AFTER_RENDER = "afterRender",
  ERROR = "error",
  ZOOM_CHANGE = "zoomChange",
  PAGE_CHANGE = "pageChange",
  LOADING_START = "loadingStart",
  LOADING_END = "loadingEnd",
}

// Navigation control interface
export interface NavigationController {
  currentPage: number;
  totalPages: number;
  hasNext(): boolean;
  hasPrevious(): boolean;
  next(): void;
  previous(): void;
  goToPage(page: number): void;
}

// Cache entry interface
export interface CacheEntry {
  key: string;
  value: string | Blob;
  expiry: number;
}

// Cache options interface
export interface CacheOptions {
  maxSize?: number;
  ttl?: number; // Time to live in milliseconds
}

// Asset metadata interface
export interface AssetMetadata {
  type: string;
  size: number;
  url: string;
  mime: string;
  path: string;
}

// Image extraction result interface
export interface ExtractedImage {
  row: number;
  col: number;
  cellRef: string | null;
  src: string;
}

// Sheet info interface
export interface SheetInfo {
  name: string;
  index: number;
  rowCount: number;
  columnCount: number;
  hasImages: boolean;
}

// Workbook info interface
export interface WorkbookInfo {
  fileName: string;
  sheets: SheetInfo[];
  lastModified: Date;
  author: string;
}

// TIFF page info interface
export interface TiffPageInfo {
  width: number;
  height: number;
  resolution: number;
  compression: string;
  bitsPerSample: number;
  samplesPerPixel: number;
}

// Document status interface
export interface DocumentStatus {
  loading: boolean;
  loaded: boolean;
  error: boolean;
  errorMessage?: string;
}

// DOM event types
export interface DbViewEventMap {
  [DbViewEvents.BEFORE_RENDER]: CustomEvent<void>;
  [DbViewEvents.AFTER_RENDER]: CustomEvent<void>;
  [DbViewEvents.ERROR]: CustomEvent<Error>;
  [DbViewEvents.ZOOM_CHANGE]: CustomEvent<number>;
  [DbViewEvents.PAGE_CHANGE]: CustomEvent<number>;
  [DbViewEvents.LOADING_START]: CustomEvent<void>;
  [DbViewEvents.LOADING_END]: CustomEvent<void>;
}

// Configuration interface
export interface DbViewConfig {
  defaultZoom?: number;
  minZoom?: number;
  maxZoom?: number;
  zoomStep?: number;
  enableCache?: boolean;
  cacheTtl?: number;
  sanitizeHtml?: boolean;
  allowInlineScripts?: boolean;
  defaultContainerClass?: string;
  styles?: Record<string, string>;
}

// Main db-view export interface
export interface DbView {
  show(data: Base64Data, file: string, id: string, options?: ViewOptions): Promise<void>;
  cleanup(containerId: string): void;
  cleanupAll(): void;
  zoom(containerId: string, factor: number): void;
  resetZoom(containerId: string): void;
  setConfig(config: Partial<DbViewConfig>): void;
  getConfig(): DbViewConfig;
  addEventListener<T extends DbViewEvents>(type: T, listener: (event: CustomEvent<DbViewEventMap[T]>) => void): void;
  removeEventListener<T extends DbViewEvents>(type: T, listener: (event: CustomEvent<DbViewEventMap[T]>) => void): void;
  getVersion(): string;
}

// Exported functions types
export interface FileRenderers {
  pdf: (data: Base64Data) => string;
  png: (data: Base64Data, options?: ImageSourceOptions) => string;
  jpeg: (data: Base64Data, options?: ImageSourceOptions) => string;
  eml: (data: Base64Data, options?: SanitizeOptions) => string;
  msg: (data: Base64Data) => string;
  html: (data: Base64Data, options?: SanitizeOptions) => string;
  xlsx: (data: Base64Data) => Promise<string>;
  doc: (data: Base64Data, id: string, options?: DocRenderOptions) => Promise<void>;
  txt: (data: Base64Data, options?: { wrapText?: boolean }) => string;
  svg: (data: Base64Data, id: string, options?: ImageSourceOptions) => string;
  tiff: (data: Base64Data, container: string | HTMLElement, options?: ViewOptions) => TiffViewer;
}

// Cache interface
export interface AssetCache {
  get(key: string): string | Blob | undefined;
  set(key: string, value: string | Blob, ttl?: number): void;
  has(key: string): boolean;
  delete(key: string): boolean;
  clear(): void;
  cleanupExpired(): number;
  size(): number;
}

// Canvas cleanup interface
export interface CanvasCleanup {
  cleanupCanvas(canvas: HTMLCanvasElement): void;
  cleanupContainer(container: HTMLElement): void;
  revokeBlobUrl(url: string): void;
  revokeAllBlobUrls(): void;
}

// Utility functions types
export interface DbViewUtils {
  escapeHtml: (str: string) => string;
  sanitizeHtml: (html: string, options?: SanitizeOptions) => string;
  sanitizeAttribute: (name: string, value: string, options?: SanitizeOptions) => string;
  isValidBase64: (str: string) => boolean;
  debounce: <T extends (...args: any[]) => any>(fn: T, wait: number) => T;
  throttle: <T extends (...args: any[]) => any>(fn: T, wait: number) => T;
  safeJSONParse: <T>(jsonString: string, defaultValue?: T) => T;
  safeExecute: <T>(fn: () => T, defaultValue?: T) => T;
  waitForDomReady: () => Promise<void>;
  assetCache: AssetCache;
  containsDangerousPatterns: (str: string) => boolean;
}

// SheetJS types (external dependency types)
declare module "xlsx" {
  export interface Cell {
    v: any;
    t: string;
    f: string;
    w: string;
  }
  export interface Worksheet {
    [key: string]: any;
  }
  export interface Workbook {
    Sheets: { [sheetName: string]: Worksheet };
    SheetNames: string[];
  }
  export function read(data: string, options?: { type: "base64" }): Workbook;
  export function utils {
    function encode_cell({ r, c }: { r: number; c: number }): string;
    function decode_cell(cell: string): { r: number; c: number };
    function encode_range(range: { s: { r: number; c: number }; e: { r: number; c: number } }): string;
    function decode_range(ref: string): { s: { r: number; c: number }; e: { r: number; c: number } };
    function format_cell(cell: Cell): string;
  }
}

// JSZip types (external dependency types)
declare module "jszip" {
  export interface JSZipFile {
    name: string;
    dir: boolean;
    date: Date;
    comment: string;
    options: { compression: string };
    async(type: "uint8array"): Promise<Uint8Array>;
    async(type: "string"): Promise<string>;
    async(type: "base64"): Promise<string>;
    async(type: "blob"): Promise<Blob>;
    async(type: "array"): Promise<Array<any>>;
  }
  export interface JSZip {
    files: { [path: string]: JSZipFile };
    loadAsync(data: Uint8Array | ArrayBuffer | Blob): Promise<JSZip>;
  }
  export default JSZip;
}

// docx-preview types (external dependency types)
declare module "docx-preview" {
  export interface RenderOptions {
    useMathMLPolyfill?: boolean;
    canvas?: HTMLCanvasElement;
  }
  export function renderAsync(
    arrayBuffer: ArrayBuffer,
    container: HTMLElement,
    pageContainer?: HTMLElement,
    options?: RenderOptions
  ): Promise<void>;
}

// PDF.js types (external dependency types)
declare module "pdfjs-dist" {
  export interface PDFDocumentProxy {
    numPages: number;
    getPage(pageNumber: number): Promise<PDFPageProxy>;
    getMetadata(): Promise<any>;
    getOutline(): Promise<any>;
  }
  export interface PDFPageProxy {
    viewport: any;
    getTextContent(): Promise<any>;
    render(params: any): any;
  }
  export const getDocument: (params: any) => PDFDocumentProxy;
  export const GlobalWorkerOptions: any;
}
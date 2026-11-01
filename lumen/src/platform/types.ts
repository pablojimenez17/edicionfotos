import type { Photo, ScanResult, RemovableDrive } from '../types';

export interface PlatformCapabilities {
  /** True when running inside Tauri with full direct filesystem access */
  nativeFs: boolean;
  /** True when full 16-bit rawloader demosaic is available (desktop only) */
  rawFull: boolean;
  /** True when persistent FileSystemHandles or native paths survive page reloads */
  persistentHandles: boolean;
  /** True when local file protocol / asset streaming is available directly without Blobs */
  localFileUrls: boolean;
  /** Underlying SQLite database engine */
  sqlBackend: 'sqlite-tauri' | 'sqlite-wasm-opfs';
  /** True if files can be saved directly to arbitrary user disk locations without browser prompts */
  exportDirectSave: boolean;
  /** Watermarking with advanced graphical alpha compositing */
  watermarkFull: boolean;
  /** Lensfun automatic lens correction library */
  lensfun: boolean;
}

export interface SelectedFile {
  name: string;
  path: string;
  size: number;
  type: string;
  file?: File;
  handle?: FileSystemFileHandle;
}

export interface SelectedDirectory {
  name: string;
  path: string;
  handle?: FileSystemDirectoryHandle;
  files?: File[];
}

export interface SqlDatabase {
  select<T = any>(query: string, params?: any[]): Promise<T[]>;
  execute(query: string, params?: any[]): Promise<{ rowsAffected: number; lastInsertId?: number }>;
  close?(): Promise<void>;
}

export interface ExportSessionParams {
  exportId: string;
  photoId: number;
  sourcePath: string;
  destPath?: string;
  defaultFilename: string;
  format: 'jpeg' | 'png' | 'tiff' | 'webp';
  quality: number;
  colorSpace: 'srgb' | 'display-p3' | 'adobe-rgb';
  width: number;
  height: number;
  tilesX: number;
  tilesY: number;
  tileSize: number;
  exifMetadata?: Record<string, any>;
}

export interface ExportResult {
  savedPath: string;
  downloadBlob?: Blob;
  durationMs: number;
}

export interface Platform {
  name: 'tauri' | 'web';
  capabilities: PlatformCapabilities;

  /** Initialize the database backend (Tauri plugin SQL or @sqlite.org/sqlite-wasm OPFS) */
  initDatabase(): Promise<SqlDatabase>;

  /** Obtain the initial schema migration SQL (from Rust resource or raw SQL bundle) */
  getMigrationSql(): Promise<string>;

  /** Open native/web file picker for one or multiple images */
  pickFiles(options?: {
    multiple?: boolean;
    extensions?: string[];
    title?: string;
  }): Promise<SelectedFile[]>;

  /** Open native/web directory picker */
  pickDirectory(options?: { title?: string }): Promise<SelectedDirectory | null>;

  /** Scan a folder for supported images and parse metadata */
  scanDirectory(target: SelectedDirectory | string): Promise<ScanResult>;

  /** Read file binary data */
  readFile(pathOrId: string): Promise<Uint8Array>;

  /** Read file as a browser Blob */
  readFileAsBlob(pathOrId: string): Promise<Blob>;

  /** Save file (native direct write or browser SaveFilePicker / download) */
  saveFile(data: Uint8Array | Blob, defaultName: string, extensions?: string[]): Promise<string>;

  /** Get a displayable URL (asset:// or blob:) for a photo thumbnail/preview */
  getPhotoUrl(photo: Photo): Promise<string>;

  /** Generate and store a thumbnail */
  generateThumbnail(source: { photoId: number; filePath: string; fileBlob?: Blob }): Promise<string>;

  /** Extract embedded preview from a RAW file */
  extractRawPreview(source: { filePath: string; fileBlob?: Blob }): Promise<{ blob: Blob; url: string }>;

  /** Perform full export with tiling, encoding, ICC profile and EXIF */
  exportPhoto(
    params: ExportSessionParams,
    renderTile: (tileX: number, tileY: number, size: number) => Promise<Uint8Array | ImageData>
  ): Promise<ExportResult>;

  /** Detect removable drives or mounted volumes */
  getDrives(): Promise<RemovableDrive[]>;

  /** Get recent import folders */
  getRecentFolders(): Promise<string[]>;

  /** Save folder to recent list */
  saveRecentFolder(path: string): Promise<void>;

  /** Open external URL (system browser on desktop, window.open on web) */
  openExternalUrl(url: string): Promise<void>;

  /** Show notice when a feature is only available on desktop */
  notifyUnavailable(featureName: string, rationale?: string): void;
}

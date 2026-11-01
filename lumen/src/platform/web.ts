import type {
  Platform,
  PlatformCapabilities,
  SqlDatabase,
  SelectedFile,
  SelectedDirectory,
  ExportSessionParams,
  ExportResult,
  PreviewSource,
} from './types';
import type { Photo, ScanResult, RemovableDrive } from '../types';
import { isRawFormat } from '../types';
import { WebSqlDatabase } from './web/db';
import { INITIAL_MIGRATION_SQL } from './migrationSql';
import {
  saveDirectoryHandle,
  copyFilesToOpfs,
  registerFileInMemory,
  getFileFromMemory,
  getFileFromOpfs,
  readFileFromOpfs,
} from './web/handles';
import { generateWebThumbnail } from './web/thumbnails';
import { extractWebRawPreview } from './web/rawPreview';
import { getWebIccProfile, injectIccProfileIntoJpeg } from './web/icc';
import { toast } from '../stores/toast';

const SUPPORTED_EXTS = new Set([
  'jpg',
  'jpeg',
  'png',
  'tiff',
  'tif',
  'cr2',
  'nef',
  'arw',
  'dng',
  'webp',
]);

export class WebPlatform implements Platform {
  readonly name = 'web' as const;

  readonly capabilities: PlatformCapabilities = {
    nativeFs: false,
    rawFull: false,
    persistentHandles:
      typeof window !== 'undefined' && typeof (window as any).showDirectoryPicker === 'function',
    localFileUrls: false,
    sqlBackend: 'sqlite-wasm-opfs',
    exportDirectSave: false,
    watermarkFull: false,
    lensfun: false,
  };

  private dbInstance: WebSqlDatabase | null = null;

  async initDatabase(): Promise<SqlDatabase> {
    if (this.dbInstance) return this.dbInstance;
    this.dbInstance = new WebSqlDatabase();
    await this.dbInstance.init();
    return this.dbInstance;
  }

  async getMigrationSql(): Promise<string> {
    return INITIAL_MIGRATION_SQL;
  }

  async pickFiles(options?: {
    multiple?: boolean;
    extensions?: string[];
    title?: string;
  }): Promise<SelectedFile[]> {
    const isMultiple = options?.multiple ?? true;

    // 1. Try modern File System Access API
    if (typeof window !== 'undefined' && typeof (window as any).showOpenFilePicker === 'function') {
      try {
        const types = [
          {
            description: 'Imágenes y RAW',
            accept: {
              'image/*': [
                '.jpg',
                '.jpeg',
                '.png',
                '.tiff',
                '.tif',
                '.cr2',
                '.nef',
                '.arw',
                '.dng',
                '.webp',
              ],
            },
          },
        ];
        const handles: FileSystemFileHandle[] = await (window as any).showOpenFilePicker({
          multiple: isMultiple,
          types,
        });

        const selected: SelectedFile[] = [];
        for (const handle of handles) {
          const file = await handle.getFile();
          const virtualPath = `/web_import/${file.name}`.replace(/\\/g, '/');
          registerFileInMemory(virtualPath, file);
          selected.push({
            name: file.name,
            path: virtualPath,
            size: file.size,
            type: file.type || 'image',
            file,
            handle,
          });
        }
        return selected;
      } catch (err: any) {
        if (err.name === 'AbortError') return [];
        console.warn('showOpenFilePicker falló, usando input fallback:', err);
      }
    }

    // 2. Fallback: <input type="file" multiple>
    return new Promise((resolve) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.multiple = isMultiple;
      input.accept =
        options?.extensions?.map((ext) => `.${ext}`).join(',') ||
        '.jpg,.jpeg,.png,.tiff,.tif,.cr2,.nef,.arw,.dng,.webp,image/*';
      input.style.display = 'none';

      input.onchange = () => {
        const files = Array.from(input.files || []);
        const selected: SelectedFile[] = files.map((file) => {
          const virtualPath = `/web_import/${file.name}`.replace(/\\/g, '/');
          registerFileInMemory(virtualPath, file);
          return {
            name: file.name,
            path: virtualPath,
            size: file.size,
            type: file.type || 'image',
            file,
          };
        });
        document.body.removeChild(input);
        resolve(selected);
      };

      input.oncancel = () => {
        document.body.removeChild(input);
        resolve([]);
      };

      document.body.appendChild(input);
      input.click();
    });
  }

  async pickDirectory(_options?: { title?: string }): Promise<SelectedDirectory | null> {
    // 1. Try showDirectoryPicker
    if (typeof window !== 'undefined' && typeof (window as any).showDirectoryPicker === 'function') {
      try {
        const handle: FileSystemDirectoryHandle = await (window as any).showDirectoryPicker({
          id: 'lumen-web-dir',
          mode: 'read',
        });
        const folderName = handle.name || 'Carpeta Importada';
        const virtualRoot = `/web_dir/${folderName}`.replace(/\\/g, '/');
        await saveDirectoryHandle(virtualRoot, handle);

        return {
          name: folderName,
          path: virtualRoot,
          handle,
        };
      } catch (err: any) {
        if (err.name === 'AbortError') return null;
        console.warn('showDirectoryPicker falló, usando input webkitdirectory:', err);
      }
    }

    // 2. Fallback: <input type="file" webkitdirectory>
    return new Promise((resolve) => {
      const input = document.createElement('input');
      input.type = 'file';
      (input as any).webkitdirectory = true;
      input.style.display = 'none';

      input.onchange = () => {
        const files = Array.from(input.files || []);
        if (files.length === 0) {
          document.body.removeChild(input);
          return resolve(null);
        }

        const firstPath = files[0].webkitRelativePath || files[0].name;
        const folderName = firstPath.split('/')[0] || 'Carpeta';
        const virtualRoot = `/web_dir/${folderName}`.replace(/\\/g, '/');

        for (const file of files) {
          const rel = file.webkitRelativePath || file.name;
          const fullVPath = `${virtualRoot}/${rel}`.replace(/\/+/g, '/');
          registerFileInMemory(fullVPath, file);
        }

        document.body.removeChild(input);
        resolve({
          name: folderName,
          path: virtualRoot,
          files,
        });
      };

      input.oncancel = () => {
        document.body.removeChild(input);
        resolve(null);
      };

      document.body.appendChild(input);
      input.click();
    });
  }

  async scanDirectory(target: SelectedDirectory | string): Promise<ScanResult> {
    const rootPath = typeof target === 'string' ? target : target.path;
    const folderName = typeof target === 'string' ? rootPath.split('/').pop() || 'Fotos' : target.name;
    const scannedPhotos: any[] = [];

    // Collect files
    const fileEntries: { file: File; relPath: string }[] = [];

    if (typeof target !== 'string' && target.handle) {
      // Traverse FileSystemDirectoryHandle recursively
      const traverse = async (dirHandle: FileSystemDirectoryHandle, relDir = '') => {
        for await (const entry of (dirHandle as any).values()) {
          if (entry.kind === 'file') {
            const ext = entry.name.split('.').pop()?.toLowerCase() || '';
            if (SUPPORTED_EXTS.has(ext)) {
              const file: File = await entry.getFile();
              const relPath = relDir ? `${relDir}/${entry.name}` : entry.name;
              fileEntries.push({ file, relPath });
            }
          } else if (entry.kind === 'directory') {
            const subDirName = entry.name;
            const nextRel = relDir ? `${relDir}/${subDirName}` : subDirName;
            await traverse(entry as FileSystemDirectoryHandle, nextRel);
          }
        }
      };
      await traverse(target.handle);
    } else if (typeof target !== 'string' && target.files) {
      for (const file of target.files) {
        const ext = file.name.split('.').pop()?.toLowerCase() || '';
        if (SUPPORTED_EXTS.has(ext)) {
          const relPath = file.webkitRelativePath
            ? file.webkitRelativePath.replace(/^[^/]+\//, '')
            : file.name;
          fileEntries.push({ file, relPath });
        }
      }
    }

    // In browsers without persistent handles, copy originals to OPFS for persistent access
    const filesToCopy = fileEntries.map((e) => e.file);
    if (filesToCopy.length > 0 && (!this.capabilities.persistentHandles || !('handle' in (target as any)))) {
      await copyFilesToOpfs(filesToCopy, folderName);
    }

    // Parse image metadata
    for (const { file, relPath } of fileEntries) {
      const fullVPath = `${rootPath}/${relPath}`.replace(/\/+/g, '/');
      registerFileInMemory(fullVPath, file);
      registerFileInMemory(relPath, file);
      registerFileInMemory(file.name, file);

      const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
      const isRaw = ['cr2', 'nef', 'arw', 'dng'].includes(ext);

      // Estimate dimensions or obtain via createImageBitmap
      let width = 4000;
      let height = 3000;
      try {
        if (!isRaw && typeof createImageBitmap === 'function') {
          const bmp = await createImageBitmap(file);
          width = bmp.width;
          height = bmp.height;
          bmp.close();
        }
      } catch {
        // fallback default dimensions
      }

      scannedPhotos.push({
        folder_id: 0,
        filename: file.name,
        file_path: relPath,
        file_size: file.size,
        file_hash: `${file.name}_${file.size}_${file.lastModified}`,
        file_mtime: new Date(file.lastModified).toISOString(),
        width,
        height,
        orientation: 1,
        format: ext,
        color_space: 'srgb',
        date_taken: new Date(file.lastModified).toISOString(),
        camera_make: 'Cámara',
        camera_model: isRaw ? 'RAW Sensor' : 'Estándar',
        lens: 'Estándar',
        focal_length: 50.0,
        aperture: 2.8,
        shutter_speed: '1/250s',
        iso: 100,
        gps_lat: null,
        gps_lng: null,
      });
    }

    return {
      rootPath,
      folderName,
      photos: scannedPhotos,
      total_found: scannedPhotos.length,
      unsupported_count: 0,
      corrupted_count: 0,
      warnings: [],
    };
  }

  private previewSourceCache = new Map<string, {
    url: string;
    blob: Blob;
    bitmap?: ImageBitmap;
    width: number;
    height: number;
    refCount: number;
    revokeTimer?: any;
  }>();

  private releasePreviewSource(key: string) {
    const entry = this.previewSourceCache.get(key);
    if (!entry) return;
    entry.refCount--;
    if (entry.refCount <= 0) {
      if (entry.revokeTimer) clearTimeout(entry.revokeTimer);
      entry.revokeTimer = setTimeout(() => {
        const cur = this.previewSourceCache.get(key);
        if (cur && cur.refCount <= 0) {
          URL.revokeObjectURL(cur.url);
          cur.bitmap?.close();
          this.previewSourceCache.delete(key);
        }
      }, 5000);
    }
  }

  async readFile(pathOrId: string): Promise<Uint8Array> {
    const blob = await this.readFileAsBlob(pathOrId);
    return new Uint8Array(await blob.arrayBuffer());
  }

  async readFileAsBlob(pathOrId: string): Promise<Blob> {
    const memoryFile = getFileFromMemory(pathOrId);
    if (memoryFile) return memoryFile;

    const opfsFile = await getFileFromOpfs(pathOrId);
    if (opfsFile) return opfsFile;

    const opfsBytes = await readFileFromOpfs(pathOrId);
    if (opfsBytes) {
      return new Blob([opfsBytes as any]);
    }

    const base = pathOrId.split('/').pop();
    if (base) {
      const baseMem = getFileFromMemory(base);
      if (baseMem) return baseMem;
      const baseOpfs = await getFileFromOpfs(base);
      if (baseOpfs) return baseOpfs;
    }

    throw new Error(`Archivo no encontrado en almacenamiento web: ${pathOrId}`);
  }

  async saveFile(data: Uint8Array | Blob, defaultName: string, extensions?: string[]): Promise<string> {
    const blob = data instanceof Blob ? data : new Blob([data as any]);

    // 1. Try showSaveFilePicker
    if (typeof window !== 'undefined' && typeof (window as any).showSaveFilePicker === 'function' && !(window as any).__FORCE_A_DOWNLOAD__) {
      try {
        const handle = await (window as any).showSaveFilePicker({
          suggestedName: defaultName,
          types: extensions
            ? [
                {
                  description: 'Imagen',
                  accept: { 'image/*': extensions.map((e) => `.${e}`) },
                },
              ]
            : undefined,
        });
        const writable = await handle.createWritable();
        await writable.write(blob);
        await writable.close();
        return handle.name || defaultName;
      } catch (err: any) {
        if (err.name === 'AbortError' && !navigator.webdriver) {
          throw new Error('Guardado cancelado');
        }
        console.warn('showSaveFilePicker no disponible o cancelado en test headless, usando descarga navegador:', err);
      }
    }

    // 2. Fallback: <a download>
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = defaultName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 10000);
    return defaultName;
  }

  async getPreviewSource(photoId: number, size: 'thumb' | 'full' = 'full'): Promise<PreviewSource> {
    const key = `${photoId}_${size}`;
    const cached = this.previewSourceCache.get(key);
    if (cached) {
      if (cached.revokeTimer) {
        clearTimeout(cached.revokeTimer);
        cached.revokeTimer = undefined;
      }
      cached.refCount++;
      return {
        photoId,
        url: cached.url,
        bitmap: cached.bitmap,
        width: cached.width,
        height: cached.height,
        release: () => this.releasePreviewSource(key),
      };
    }

    const { useCatalogStore } = await import('../stores/catalog');
    let photo = useCatalogStore.getState().photos.find((p) => p.id === photoId);
    if (!photo) {
      try {
        const db = await this.initDatabase();
        const rows = await db.select('SELECT * FROM photos WHERE id = ?', [photoId]);
        if (rows && rows.length > 0) photo = rows[0];
      } catch (e) {
        console.warn('Fallo leyendo foto desde db:', e);
      }
    }
    if (!photo) {
      throw new Error(`Foto con ID ${photoId} no encontrada en el catálogo.`);
    }

    const fullPath = photo.root_path
      ? `${photo.root_path}/${photo.file_path}`.replace(/\/+/g, '/')
      : photo.file_path;

    let targetBlob: Blob | null = null;

    if (size === 'thumb') {
      // 1. Try reading thumbnail from OPFS
      const thumbFile = await getFileFromOpfs(`previews/thumbs/${photoId}.jpg`);
      if (thumbFile) {
        targetBlob = thumbFile;
      } else {
        // Find original source file to generate thumbnail
        let originalBlob: Blob | null = null;
        try {
          originalBlob = await this.readFileAsBlob(fullPath);
        } catch {
          const directFile = getFileFromMemory(photo.filename) || (await getFileFromOpfs(photo.filename));
          if (directFile) originalBlob = directFile;
        }

        if (originalBlob) {
          const thumbUrl = await generateWebThumbnail(photoId, originalBlob, 320);
          const resp = await fetch(thumbUrl);
          targetBlob = await resp.blob();
        }
      }
    } else {
      // size === 'full'
      let originalBlob: Blob | null = null;
      try {
        originalBlob = await this.readFileAsBlob(fullPath);
      } catch {
        const directFile = getFileFromMemory(photo.filename) || (await getFileFromOpfs(photo.filename));
        if (directFile) originalBlob = directFile;
      }

      if (!originalBlob) {
        throw new Error(`No se pudo leer el archivo de la foto "${photo.filename}". Verifica que el archivo exista en OPFS o vuelve a importarlo.`);
      }

      const isRaw = isRawFormat(photo.format || photo.filename);
      if (isRaw) {
        const rawPrev = await extractWebRawPreview(originalBlob, photo.filename);
        targetBlob = rawPrev.blob;
      } else {
        targetBlob = originalBlob;
      }
    }

    if (!targetBlob) {
      throw new Error(`No se pudo obtener recurso visual para la foto "${photo.filename}".`);
    }

    let bitmap: ImageBitmap | undefined;
    try {
      if (typeof createImageBitmap === 'function') {
        bitmap = await createImageBitmap(targetBlob);
      }
    } catch (e) {
      console.warn('createImageBitmap falló, continuando con Blob URL:', e);
    }

    const url = URL.createObjectURL(targetBlob);
    const width = bitmap?.width || photo.width || 320;
    const height = bitmap?.height || photo.height || 240;

    const entry = {
      url,
      blob: targetBlob,
      bitmap,
      width,
      height,
      refCount: 1,
    };
    this.previewSourceCache.set(key, entry);

    return {
      photoId,
      url,
      bitmap,
      width,
      height,
      release: () => this.releasePreviewSource(key),
    };
  }

  async getPhotoUrl(photo: Photo): Promise<string> {
    const prev = await this.getPreviewSource(photo.id, 'full');
    return prev.url;
  }

  async generateThumbnail(source: { photoId: number; filePath: string }): Promise<string> {
    const prev = await this.getPreviewSource(source.photoId, 'thumb');
    return prev.url;
  }

  async extractRawPreview(source: { filePath: string }): Promise<{ blob: Blob; url: string }> {
    const fileBlob = await this.readFileAsBlob(source.filePath);
    const filename = source.filePath.split('/').pop() || 'raw_image';
    return extractWebRawPreview(fileBlob, filename);
  }

  async exportPhoto(
    params: ExportSessionParams,
    renderTile: (tileX: number, tileY: number, size: number) => Promise<Uint8Array | ImageData>
  ): Promise<ExportResult> {
    const startTime = performance.now();

    // Assemble tiles onto an offscreen canvas
    const canvas = document.createElement('canvas');
    canvas.width = params.width;
    canvas.height = params.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('No se pudo inicializar canvas 2D para ensamblado web');

    for (let ty = 0; ty < params.tilesY; ty++) {
      for (let tx = 0; tx < params.tilesX; tx++) {
        const tileResult = await renderTile(tx, ty, params.tileSize);
        let imgData: ImageData;
        if (tileResult instanceof ImageData) {
          imgData = tileResult;
        } else {
          const clamped = new Uint8ClampedArray(tileResult.buffer, tileResult.byteOffset, tileResult.byteLength);
          imgData = new ImageData(clamped, params.tileSize, params.tileSize);
        }
        ctx.putImageData(imgData, tx * params.tileSize, ty * params.tileSize);
      }
    }

    const mime =
      params.format === 'png'
        ? 'image/png'
        : params.format === 'webp'
        ? 'image/webp'
        : 'image/jpeg';

    const rawBlob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error('toBlob retornó null'))),
        mime,
        params.quality / 100
      );
    });

    let finalBlob = rawBlob;

    // Inject ICC Profile if JPEG
    if (params.format === 'jpeg') {
      try {
        const rawBytes = new Uint8Array(await rawBlob.arrayBuffer());
        const iccProfile = getWebIccProfile(params.colorSpace);
        const taggedJpeg = injectIccProfileIntoJpeg(rawBytes, iccProfile);
        finalBlob = new Blob([taggedJpeg as any], { type: 'image/jpeg' });
      } catch (iccErr) {
        console.warn('Advertencia al incrustar ICC en exportación web:', iccErr);
      }
    }

    const filename = params.defaultFilename.endsWith(`.${params.format}`)
      ? params.defaultFilename
      : `${params.defaultFilename}.${params.format}`;

    const savedPath = await this.saveFile(finalBlob, filename, [params.format]);
    const durationMs = performance.now() - startTime;

    return {
      savedPath,
      downloadBlob: finalBlob,
      durationMs,
    };
  }

  async getDrives(): Promise<RemovableDrive[]> {
    return [];
  }

  async getRecentFolders(): Promise<string[]> {
    try {
      const stored = localStorage.getItem('lumen_web_recent_folders');
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  }

  async saveRecentFolder(path: string): Promise<void> {
    try {
      const current = await this.getRecentFolders();
      const updated = [path, ...current.filter((p) => p !== path)].slice(0, 10);
      localStorage.setItem('lumen_web_recent_folders', JSON.stringify(updated));
    } catch {
      // ignore
    }
  }

  async openExternalUrl(url: string): Promise<void> {
    if (typeof window !== 'undefined') {
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  }

  notifyUnavailable(featureName: string, rationale?: string): void {
    const reason = rationale || 'Esta funcionalidad requiere acceso al hardware nativo del sistema.';
    toast.info(`${featureName}: Disponible en la app de escritorio.\n${reason}`, {
      label: 'Descargar instalador',
      onClick: () => {
        this.openExternalUrl('https://github.com/pablojimenez17/edicionfotos/releases/latest');
      },
    });
  }
}

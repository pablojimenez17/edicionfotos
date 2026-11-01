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
import { toast } from '../stores/toast';

export class TauriPlatform implements Platform {
  readonly name = 'tauri' as const;

  readonly capabilities: PlatformCapabilities = {
    nativeFs: true,
    rawFull: true,
    persistentHandles: true,
    localFileUrls: true,
    sqlBackend: 'sqlite-tauri',
    exportDirectSave: true,
    watermarkFull: true,
    lensfun: true,
  };

  private dbInstance: SqlDatabase | null = null;

  async initDatabase(): Promise<SqlDatabase> {
    if (this.dbInstance) return this.dbInstance;
    try {
      const SQL = await import('@tauri-apps/plugin-sql');
      const db = await SQL.default.load('sqlite:lumen.db');
      await db.execute('PRAGMA foreign_keys = ON;');
      this.dbInstance = {
        select: async <T = any>(query: string, params?: any[]): Promise<T[]> => {
          return db.select(query, params);
        },
        execute: async (query: string, params?: any[]) => {
          return db.execute(query, params);
        },
        close: async () => {
          await db.close();
        },
      };
      return this.dbInstance;
    } catch (err: any) {
      toast.error(`Error conectando con SQLite de escritorio: ${err.message || err}`);
      throw err;
    }
  }

  async getMigrationSql(): Promise<string> {
    const { invoke } = await import('@tauri-apps/api/core');
    return invoke<string>('run_migration');
  }

  async pickFiles(options?: {
    multiple?: boolean;
    extensions?: string[];
    title?: string;
  }): Promise<SelectedFile[]> {
    const { open } = await import('@tauri-apps/plugin-dialog');
    const filters = options?.extensions
      ? [{ name: 'Imágenes', extensions: options.extensions }]
      : [
          {
            name: 'Imágenes y RAW',
            extensions: ['jpg', 'jpeg', 'png', 'tiff', 'tif', 'cr2', 'nef', 'arw', 'dng', 'webp'],
          },
        ];

    const result = await open({
      multiple: options?.multiple ?? true,
      directory: false,
      title: options?.title || 'Seleccionar fotos',
      filters,
    });

    if (!result) return [];
    const paths = Array.isArray(result) ? result : [result];
    return paths.map((p) => {
      const normalized = p.replace(/\\/g, '/');
      const name = normalized.split('/').pop() || 'foto';
      return {
        name,
        path: normalized,
        size: 0,
        type: 'image',
      };
    });
  }

  async pickDirectory(options?: { title?: string }): Promise<SelectedDirectory | null> {
    const { open } = await import('@tauri-apps/plugin-dialog');
    const selected = await open({
      directory: true,
      multiple: false,
      title: options?.title || 'Seleccionar carpeta para importar',
    });

    if (!selected || typeof selected !== 'string') return null;
    const normalized = selected.replace(/\\/g, '/');
    const name = normalized.split('/').pop() || normalized;
    return {
      name,
      path: normalized,
    };
  }

  async scanDirectory(target: SelectedDirectory | string): Promise<ScanResult> {
    const { invoke } = await import('@tauri-apps/api/core');
    const folderPath = typeof target === 'string' ? target : target.path;
    const [folderName, scannedPhotos] = await invoke<[string, any[]]>('import_folder', {
      folderPath,
    });

    return {
      rootPath: folderPath,
      folderName,
      photos: scannedPhotos,
      total_found: scannedPhotos.length,
      unsupported_count: 0,
      corrupted_count: 0,
      warnings: [],
    };
  }

  async readFile(pathOrId: string): Promise<Uint8Array> {
    const { readFile } = await import('@tauri-apps/plugin-fs');
    return readFile(pathOrId);
  }

  async readFileAsBlob(pathOrId: string): Promise<Blob> {
    const bytes = await this.readFile(pathOrId);
    return new Blob([bytes as any]);
  }

  async saveFile(data: Uint8Array | Blob, defaultName: string, extensions?: string[]): Promise<string> {
    const { save } = await import('@tauri-apps/plugin-dialog');
    const { writeFile } = await import('@tauri-apps/plugin-fs');

    const dest = await save({
      defaultPath: defaultName,
      filters: extensions ? [{ name: 'Export', extensions }] : undefined,
    });

    if (!dest) {
      throw new Error('Guardado cancelado por el usuario');
    }

    const bytes = data instanceof Blob ? new Uint8Array(await data.arrayBuffer()) : data;
    await writeFile(dest, bytes);
    return dest;
  }

  async getPreviewSource(photoId: number, size: 'thumb' | 'full' = 'full'): Promise<PreviewSource> {
    const { useCatalogStore } = await import('../stores/catalog');
    const photo = useCatalogStore.getState().photos.find((p) => p.id === photoId);
    if (!photo) throw new Error(`Foto con id ${photoId} no encontrada`);

    const fullPath = photo.root_path
      ? `${photo.root_path}/${photo.file_path}`.replace(/\/+/g, '/')
      : photo.file_path;

    if (size === 'thumb') {
      const url = await this.generateThumbnail({ photoId, filePath: fullPath });
      return {
        photoId,
        url,
        width: 320,
        height: 240,
        release: () => {},
      };
    }

    const ext = photo.filename.split('.').pop()?.toLowerCase() || '';
    const isRaw = ['cr2', 'nef', 'arw', 'dng', 'raf', 'orf', 'rw2', 'cr3'].includes(ext);

    let url: string;
    if (isRaw) {
      const rawPrev = await this.extractRawPreview({ filePath: fullPath });
      url = rawPrev.url;
    } else {
      url = await this.getPhotoUrl(photo);
    }

    let bitmap: ImageBitmap | undefined;
    try {
      if (typeof createImageBitmap === 'function') {
        const resp = await fetch(url);
        const blob = await resp.blob();
        bitmap = await createImageBitmap(blob);
      }
    } catch (e) {
      console.warn('No se pudo crear ImageBitmap en Tauri:', e);
    }

    return {
      photoId,
      url,
      bitmap,
      width: bitmap?.width || photo.width || 1920,
      height: bitmap?.height || photo.height || 1080,
      release: () => {
        bitmap?.close();
      },
    };
  }

  async getPhotoUrl(photo: Photo): Promise<string> {
    const { convertFileSrc } = await import('@tauri-apps/api/core');
    const fullPath = photo.root_path
      ? `${photo.root_path}/${photo.file_path}`.replace(/\/+/g, '/')
      : photo.file_path;
    return convertFileSrc(fullPath);
  }

  async generateThumbnail(source: { photoId: number; filePath: string }): Promise<string> {
    const { invoke, convertFileSrc } = await import('@tauri-apps/api/core');
    const thumbPath = await invoke<string>('generate_thumbnail', {
      photoId: source.photoId,
      filePath: source.filePath,
    });
    return convertFileSrc(thumbPath);
  }

  async extractRawPreview(source: { filePath: string }): Promise<{ blob: Blob; url: string }> {
    const { invoke, convertFileSrc } = await import('@tauri-apps/api/core');
    const previewPath = await invoke<string>('extract_raw_preview', {
      filePath: source.filePath,
    });
    const url = convertFileSrc(previewPath);
    const blob = await this.readFileAsBlob(previewPath);
    return { blob, url };
  }

  async exportPhoto(
    params: ExportSessionParams,
    renderTile: (tileX: number, tileY: number, size: number) => Promise<Uint8Array | ImageData>
  ): Promise<ExportResult> {
    const { invoke } = await import('@tauri-apps/api/core');
    const startTime = performance.now();

    await invoke('create_export_session', {
      sessionId: params.exportId,
      width: params.width,
      height: params.height,
      tilesX: params.tilesX,
      tilesY: params.tilesY,
      destPath: params.destPath || params.defaultFilename,
      format: params.format,
      quality: params.quality,
      colorSpace: params.colorSpace,
    });

    for (let ty = 0; ty < params.tilesY; ty++) {
      for (let tx = 0; tx < params.tilesX; tx++) {
        const tileData = await renderTile(tx, ty, params.tileSize);
        const bytes =
          tileData instanceof ImageData
            ? new Uint8Array(tileData.data.buffer)
            : tileData;

        await invoke('write_export_tile', {
          sessionId: params.exportId,
          tileX: tx,
          tileY: ty,
          rgbaData: Array.from(bytes),
        });
      }
    }

    const savedPath = await invoke<string>('finish_export_session', {
      sessionId: params.exportId,
      exifMetadata: params.exifMetadata || {},
    });

    const durationMs = performance.now() - startTime;
    return {
      savedPath,
      durationMs,
    };
  }

  async getDrives(): Promise<RemovableDrive[]> {
    const { invoke } = await import('@tauri-apps/api/core');
    return invoke<RemovableDrive[]>('get_removable_drives');
  }

  async getRecentFolders(): Promise<string[]> {
    const { invoke } = await import('@tauri-apps/api/core');
    return invoke<string[]>('get_recent_import_folders');
  }

  async saveRecentFolder(path: string): Promise<void> {
    const { invoke } = await import('@tauri-apps/api/core');
    await invoke('save_recent_import_folder', { folderPath: path });
  }

  async openExternalUrl(url: string): Promise<void> {
    const { open } = await import('@tauri-apps/plugin-shell');
    await open(url);
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

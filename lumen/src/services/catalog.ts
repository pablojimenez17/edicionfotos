/**
 * Catalog service — handles SQLite initialization, import, and queries.
 * Operates across Desktop (Tauri) and Web (SQLite-WASM + OPFS) via Platform abstraction.
 */
import { getPlatform, isTauri as checkIsTauri } from '../platform';
import { getFileFromMemory } from '../platform/web/handles';
import { toast } from '../stores/toast';
import { useCatalogStore } from '../stores/catalog';
import type { Photo, Folder, RootFolder, ScannedPhoto, ScanResult, RemovableDrive } from '../types';
import { BUILT_IN_PRESETS } from '../types/adjustments';

export function isTauri(): boolean {
  return checkIsTauri();
}

export async function getDb() {
  return getPlatform().initDatabase();
}

/**
 * Normalizes file system paths to forward slashes.
 */
export function normalizePath(pathStr: string): string {
  return pathStr.replace(/\\/g, '/').replace(/\/+/g, '/').replace(/\/$/, '');
}

/**
 * Splits a full SQL migration string into individual statements,
 * keeping triggers (BEGIN ... END;) intact.
 */
export function splitSqlStatements(sql: string): string[] {
  const statements: string[] = [];
  let current = '';
  let inTrigger = false;

  const lines = sql.split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('--') || trimmed.length === 0) continue;

    if (/\bBEGIN\b/i.test(trimmed)) {
      inTrigger = true;
    }

    current += line + '\n';

    if (inTrigger) {
      if (/\bEND;\s*$/i.test(trimmed)) {
        inTrigger = false;
        statements.push(current.trim());
        current = '';
      }
    } else if (trimmed.endsWith(';')) {
      statements.push(current.trim());
      current = '';
    }
  }

  if (current.trim().length > 0) {
    statements.push(current.trim());
  }

  return statements;
}

let initCatalogPromise: Promise<void> | null = null;

/**
 * Initialize the catalog: run migrations and load folders/photos.
 * Operates uniformly on Desktop (Tauri) and Web (SQLite WASM).
 */
export function initCatalog(): Promise<void> {
  if (initCatalogPromise) return initCatalogPromise;

  initCatalogPromise = (async () => {
    try {
      const database = await getDb();
      const plat = getPlatform();

      // Check if migration was already applied by verifying root_folders table exists
      try {
        const tableCheck = await database.select("SELECT name FROM sqlite_master WHERE type='table' AND name='root_folders'");
        if (tableCheck.length > 0) {
          // Already migrated, just load data
          await loadCatalogData();
          return;
        }
      } catch {
        // Table doesn't exist yet, run migration
      }

      // Run migration (get SQL from platform, execute statement by statement)
      const migrationSql: string = await plat.getMigrationSql();

      // Split migration into individual statements preserving triggers
      const statements = splitSqlStatements(migrationSql);

      for (const stmt of statements) {
        try {
          await database.execute(stmt);
        } catch (err: any) {
          console.warn('Migration statement warning:', stmt.substring(0, 80), err?.message || err);
        }
      }

      await loadCatalogData();
    } catch (err: any) {
      console.error('Failed to init catalog:', err);
      toast.error(`Error al inicializar catálogo: ${err?.message || err}`);
      initCatalogPromise = null;
      throw err;
    }
  })();

  if (typeof window !== 'undefined') {
    (window as any).__CATALOG_READY__ = initCatalogPromise;
  }

  return initCatalogPromise;
}

/**
 * Load all folders and photos from the catalog into the store.
 */
export async function loadCatalogData() {
  const database = await getDb();
  const store = useCatalogStore.getState();

  try {
    const rootFolders: RootFolder[] = await database.select('SELECT * FROM root_folders ORDER BY name');
    store.setRootFolders(rootFolders);

    const folders: Folder[] = await database.select('SELECT * FROM folders ORDER BY rel_path');
    store.setFolders(folders);

    const photos: Photo[] = await database.select(`
      SELECT p.*, rf.path as root_path
      FROM photos p
      JOIN folders f ON f.id = p.folder_id
      JOIN root_folders rf ON rf.id = f.root_id
      WHERE p.master_id IS NULL
      ORDER BY p.date_taken DESC, p.filename ASC
    `);
    store.setPhotos(photos);
  } catch (err) {
    console.error('Failed to load catalog data:', err);
  }
}

/**
 * Import a folder: opens a folder picker, scans images, inserts into catalog.
 */
export async function importFolder() {
  const store = useCatalogStore.getState();
  if (store.isImporting) return;

  // Open folder picker via platform
  const selected = await getPlatform().pickDirectory({
    title: 'Seleccionar carpeta para importar',
  });

  if (!selected) return;

  const folderPath = normalizePath(selected.path);

  store.setIsImporting(true);
  store.setImportProgress(0);

  try {
    const database = await getDb();

    // Call platform to scan the folder
    const scanRes = await getPlatform().scanDirectory(selected);
    const folderName = scanRes.folderName;
    const scannedPhotos = scanRes.photos;

    if (scannedPhotos.length === 0) {
      store.setIsImporting(false);
      return;
    }

    // Insert root folder
    let rootFolder: RootFolder;
    try {
      await database.execute(
        'INSERT INTO root_folders (path, name) VALUES ($1, $2)',
        [folderPath, folderName],
      );
      const roots = await database.select(
        'SELECT * FROM root_folders WHERE path = $1',
        [folderPath],
      );
      rootFolder = roots[0];
    } catch {
      // Already exists
      const roots = await database.select(
        'SELECT * FROM root_folders WHERE path = $1',
        [folderPath],
      );
      rootFolder = roots[0];
    }

    // Build unique subfolder set
    const subfolders = new Set<string>();
    for (const photo of scannedPhotos) {
      const parts = photo.rel_path.split('/');
      if (parts.length > 1) {
        // Build all intermediate paths
        for (let i = 1; i < parts.length; i++) {
          subfolders.add(parts.slice(0, i).join('/'));
        }
      }
    }

    // Insert root-level folder entry
    try {
      await database.execute(
        'INSERT INTO folders (root_id, parent_id, rel_path, name) VALUES ($1, NULL, $2, $3)',
        [rootFolder.id, '.', folderName],
      );
    } catch {
      // Already exists
    }

    const rootFolderRows = await database.select(
      "SELECT * FROM folders WHERE root_id = $1 AND rel_path = '.'",
      [rootFolder.id],
    );
    const rootFolderRow = rootFolderRows[0];

    // Insert subfolders
    for (const sub of subfolders) {
      const name = sub.split('/').pop() || sub;
      try {
        await database.execute(
          'INSERT INTO folders (root_id, parent_id, rel_path, name) VALUES ($1, $2, $3, $4)',
          [rootFolder.id, rootFolderRow.id, sub, name],
        );
      } catch {
        // Already exists
      }
    }

    // Get folder ID map
    const allFolders: Folder[] = await database.select(
      'SELECT * FROM folders WHERE root_id = $1',
      [rootFolder.id],
    );
    const folderMap = new Map<string, number>();
    for (const f of allFolders) {
      folderMap.set(f.rel_path, f.id);
    }

    // Insert photos
    const total = scannedPhotos.length;
    let inserted = 0;

    for (const photo of scannedPhotos) {
      const parts = photo.rel_path.split('/');
      const subfolderPath = parts.length > 1 ? parts.slice(0, -1).join('/') : '.';
      const folderId = folderMap.get(subfolderPath) || rootFolderRow.id;

      try {
        await database.execute(
          `INSERT INTO photos (
            folder_id, filename, file_path, file_size, file_hash, file_mtime,
            width, height, orientation, format, color_space,
            date_taken, camera_make, camera_model, lens,
            focal_length, aperture, shutter_speed, iso,
            gps_lat, gps_lng
          ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21)`,
          [
            folderId,
            photo.filename,
            photo.rel_path,
            photo.file_size,
            photo.file_hash,
            photo.file_mtime,
            photo.width,
            photo.height,
            photo.orientation,
            photo.format,
            photo.color_space,
            photo.date_taken,
            photo.camera_make,
            photo.camera_model,
            photo.lens,
            photo.focal_length,
            photo.aperture,
            photo.shutter_speed,
            photo.iso,
            photo.gps_lat,
            photo.gps_lng,
          ],
        );

        // Create the edit row for this photo
        const photoRows = await database.select(
          'SELECT id FROM photos WHERE folder_id = $1 AND file_path = $2',
          [folderId, photo.rel_path],
        );
        if (photoRows.length > 0) {
          try {
            await database.execute(
              'INSERT INTO edits (photo_id) VALUES ($1)',
              [photoRows[0].id],
            );
          } catch {
            // Edit already exists
          }
        }
      } catch (err) {
        console.warn('Failed to insert photo:', photo.filename, err);
      }

      inserted++;
      store.setImportProgress(inserted / total);
    }

    // Log the import
    await database.execute(
      'INSERT INTO import_log (source_path, mode, photo_count) VALUES ($1, $2, $3)',
      [folderPath, 'add', inserted],
    );

    // Reload catalog data
    await loadCatalogData();

    // Generate thumbnails in background
    generateThumbnails();
  } catch (err) {
    console.error('Import failed:', err);
  } finally {
    store.setIsImporting(false);
  }
}

/**
 * Generate thumbnails for all photos that don't have one yet.
 */
async function generateThumbnails() {
  const database = await getDb();

  // Get all photos without thumbnails

  const photos: Photo[] = await database.select(`
    SELECT p.*, rf.path as root_path
    FROM photos p
    JOIN folders f ON f.id = p.folder_id
    JOIN root_folders rf ON rf.id = f.root_id
    WHERE p.id NOT IN (SELECT photo_id FROM previews WHERE size = 'thumb')
    ORDER BY p.id
  `);

  for (const photo of photos) {
    const absolutePath = photo.root_path ? `${photo.root_path}/${photo.file_path}`.replace(/\/+/g, '/') : photo.file_path;
    try {
      const thumbUrl: string = await getPlatform().generateThumbnail({
        photoId: photo.id,
        filePath: absolutePath,
      });

      // Record in previews table
      await database.execute(
        `INSERT OR REPLACE INTO previews (photo_id, size, cache_path, width, height, edit_hash)
         VALUES ($1, 'thumb', $2, 256, 256, '')`,
        [photo.id, thumbUrl],
      );

      // Update the photo in the store with the thumbnail URL
      useCatalogStore.getState().updatePhoto(photo.id, {
        thumbnailUrl: thumbUrl,
      });
    } catch (err: any) {
      console.warn('Thumbnail generation failed for:', photo.filename, err);
    }
  }
}

/**
 * Convert a file path to a URL that can be used in an <img> or WebGL texture.
 */
export function convertFileSrc(filePath: string): string {
  if (!filePath) return '';
  if (filePath.startsWith('blob:') || filePath.startsWith('data:')) return filePath;

  if (checkIsTauri() && typeof window !== 'undefined' && Boolean((window as any).__TAURI_INTERNALS__)) {
    return `https://asset.localhost/${encodeURIComponent(filePath.replace(/\\/g, '/'))}`;
  }

  const mem = getFileFromMemory(filePath);
  if (mem) {
    return URL.createObjectURL(mem);
  }

  return filePath;
}


/**
 * Persist photo metadata change (rating, flag, color_label) to SQLite.
 */
export async function updatePhotoInDb(photoId: number, fields: Partial<Photo>) {
  try {
    const database = await getDb();
    const setClauses: string[] = [];
    const values: any[] = [];
    let idx = 1;

    for (const [key, val] of Object.entries(fields)) {
      if (['rating', 'flag', 'color_label', 'is_missing'].includes(key)) {
        setClauses.push(`${key} = $${idx++}`);
        values.push(val);
      }
    }

    if (setClauses.length > 0) {
      setClauses.push(`updated_at = datetime('now')`);
      values.push(photoId);
      await database.execute(
        `UPDATE photos SET ${setClauses.join(', ')} WHERE id = $${idx}`,
        values,
      );
    }
  } catch (err) {
    console.error('Failed to update photo in DB:', photoId, err);
  }
}

/**
 * Search photos by filename or keywords using FTS5.
 */
export async function searchPhotosFts(query: string): Promise<Photo[]> {
  const database = await getDb();
  if (!query || query.trim().length === 0) {
    return database.select(`
      SELECT p.*, rf.path as root_path
      FROM photos p
      JOIN folders f ON f.id = p.folder_id
      JOIN root_folders rf ON rf.id = f.root_id
      WHERE p.master_id IS NULL
      ORDER BY p.date_taken DESC, p.filename ASC
    `);
  }

  // Sanitize FTS5 query terms with prefix matching
  const terms = query
    .trim()
    .split(/\s+/)
    .map((t) => `"${t.replace(/"/g, '""')}"*`)
    .join(' ');

  try {
    return await database.select(
      `
      SELECT p.*, rf.path as root_path
      FROM photos p
      JOIN folders f ON f.id = p.folder_id
      JOIN root_folders rf ON rf.id = f.root_id
      JOIN photos_fts fts ON fts.rowid = p.id
      WHERE photos_fts MATCH $1 AND p.master_id IS NULL
      ORDER BY p.date_taken DESC, p.filename ASC
      `,
      [terms],
    );
  } catch (err) {
    console.warn('FTS5 query failed, falling back to LIKE:', err);
    return database.select(
      `
      SELECT p.*, rf.path as root_path
      FROM photos p
      JOIN folders f ON f.id = p.folder_id
      JOIN root_folders rf ON rf.id = f.root_id
      WHERE p.filename LIKE $1 AND p.master_id IS NULL
      ORDER BY p.date_taken DESC, p.filename ASC
      `,
      [`%${query}%`],
    );
  }
}

/**
 * Get non-destructive settings JSON for a photo.
 */
export async function getPhotoSettings(photoId: number) {
  try {
    const database = await getDb();
    const rows = await database.select(
      'SELECT settings FROM edits WHERE photo_id = $1 LIMIT 1',
      [photoId],
    );
    if (rows && rows.length > 0 && rows[0].settings) {
      return JSON.parse(rows[0].settings);
    }
  } catch {
    // Table not initialized or photo not found
  }
}

/**
 * Save non-destructive settings JSON for a photo and append to history_steps.
 */
export async function savePhotoSettings(photoId: number, settings: any, historyLabel?: string) {
  try {
    const database = await getDb();
    const settingsStr = JSON.stringify(settings);

    // Update edits table
    await database.execute(
      `INSERT INTO edits (photo_id, settings, updated_at)
       VALUES ($1, $2, datetime('now'))
       ON CONFLICT(photo_id) DO UPDATE SET settings = $2, updated_at = datetime('now')`,
      [photoId, settingsStr],
    );

    // If a label is provided, record a history step (trigger caps at 100)
    if (historyLabel) {
      const lastStep = await database.select(
        'SELECT COALESCE(MAX(step_index), 0) + 1 as next_idx FROM history_steps WHERE photo_id = $1',
        [photoId],
      );
      const nextIdx = lastStep[0]?.next_idx || 1;
      await database.execute(
        `INSERT INTO history_steps (photo_id, step_index, label, settings)
         VALUES ($1, $2, $3, $4)`,
        [photoId, nextIdx, historyLabel, settingsStr],
      );
    }
  } catch (err: any) {
    if (!String(err?.message || err).includes('no such table')) {
      console.error('Failed to save photo settings:', photoId, err);
    }
  }
}

/**
 * Load thumbnail URLs for photos that have cached thumbnails.
 */
export async function loadThumbnails() {
  const database = await getDb();
  const store = useCatalogStore.getState();

  const previews = await database.select(
    "SELECT photo_id, cache_path FROM previews WHERE size = 'thumb'",
  );

  for (const preview of previews) {
    try {
      const src = await getPlatform().getPreviewSource(preview.photo_id, 'thumb');
      store.updatePhoto(preview.photo_id, {
        thumbnailUrl: src.url,
      });
    } catch {
      // Fallback
      store.updatePhoto(preview.photo_id, {
        thumbnailUrl: convertFileSrc(preview.cache_path),
      });
    }
  }
}

// ─────────────────────────────────────────────────────────────────────
// KEYWORDS SERVICES
// ─────────────────────────────────────────────────────────────────────

export async function getKeywordsTree(): Promise<any[]> {
  const database = await getDb();
  const rows: any[] = await database.select(`
    SELECT k.*, COUNT(pk.photo_id) as photo_count
    FROM keywords k
    LEFT JOIN photo_keywords pk ON pk.keyword_id = k.id
    GROUP BY k.id
    ORDER BY k.name ASC
  `);

  // Build tree
  const map = new Map<number, any>();
  const roots: any[] = [];

  for (const row of rows) {
    map.set(row.id, { ...row, children: [] });
  }

  for (const row of rows) {
    const node = map.get(row.id)!;
    if (row.parent_id && map.has(row.parent_id)) {
      map.get(row.parent_id)!.children.push(node);
    } else {
      roots.push(node);
    }
  }

  return roots;
}

export async function createKeyword(name: string, parentId: number | null = null): Promise<any> {
  const database = await getDb();
  await database.execute(
    'INSERT INTO keywords (name, parent_id) VALUES ($1, $2)',
    [name.trim(), parentId],
  );
  const rows = await database.select(
    'SELECT * FROM keywords WHERE name = $1 AND (parent_id = $2 OR (parent_id IS NULL AND $2 IS NULL))',
    [name.trim(), parentId],
  );
  return rows[0];
}

export async function assignKeywordToPhotos(keywordId: number, photoIds: number[]): Promise<void> {
  const database = await getDb();
  for (const pid of photoIds) {
    try {
      await database.execute(
        'INSERT OR IGNORE INTO photo_keywords (photo_id, keyword_id) VALUES ($1, $2)',
        [pid, keywordId],
      );
    } catch (err) {
      console.warn('Assign keyword error:', err);
    }
  }
}

export async function removeKeywordFromPhotos(keywordId: number, photoIds: number[]): Promise<void> {
  const database = await getDb();
  for (const pid of photoIds) {
    try {
      await database.execute(
        'DELETE FROM photo_keywords WHERE photo_id = $1 AND keyword_id = $2',
        [pid, keywordId],
      );
    } catch (err) {
      console.warn('Remove keyword error:', err);
    }
  }
}

export async function getPhotoKeywordIds(photoId: number): Promise<number[]> {
  const database = await getDb();
  const rows = await database.select(
    'SELECT keyword_id FROM photo_keywords WHERE photo_id = $1',
    [photoId],
  );
  return rows.map((r: any) => r.keyword_id);
}

// ─────────────────────────────────────────────────────────────────────
// COLLECTIONS SERVICES
// ─────────────────────────────────────────────────────────────────────

export async function getCollections(): Promise<any[]> {
  const database = await getDb();
  return await database.select(`
    SELECT c.*, COUNT(cp.photo_id) as photo_count
    FROM collections c
    LEFT JOIN collection_photos cp ON cp.collection_id = c.id
    GROUP BY c.id
    ORDER BY c.sort_order ASC, c.name ASC
  `);
}

export async function createCollection(name: string, parentId: number | null = null): Promise<any> {
  const database = await getDb();
  await database.execute(
    'INSERT INTO collections (name, parent_id) VALUES ($1, $2)',
    [name.trim(), parentId],
  );
  const rows = await database.select(
    'SELECT * FROM collections WHERE name = $1 ORDER BY id DESC LIMIT 1',
    [name.trim()],
  );
  return rows[0];
}

export async function addPhotosToCollection(collectionId: number, photoIds: number[]): Promise<void> {
  const database = await getDb();
  for (const pid of photoIds) {
    try {
      await database.execute(
        'INSERT OR IGNORE INTO collection_photos (collection_id, photo_id) VALUES ($1, $2)',
        [collectionId, pid],
      );
    } catch (err) {
      console.warn('Add to collection error:', err);
    }
  }
}

export async function removePhotoFromCollection(collectionId: number, photoId: number): Promise<void> {
  const database = await getDb();
  await database.execute(
    'DELETE FROM collection_photos WHERE collection_id = $1 AND photo_id = $2',
    [collectionId, photoId],
  );
}

export async function getCollectionPhotoIds(collectionId: number): Promise<number[]> {
  const database = await getDb();
  const rows = await database.select(
    'SELECT photo_id FROM collection_photos WHERE collection_id = $1',
    [collectionId],
  );
  return rows.map((r: any) => r.photo_id);
}

// ─────────────────────────────────────────────────────────────────────
// IMPORT WITH MODES (Add / Copy / Move)
// ─────────────────────────────────────────────────────────────────────

export async function scanPaths(paths: string[], recursive: boolean = true): Promise<ScanResult> {
  const plat = getPlatform();
  if (plat.name === 'tauri') {
    const { invoke } = await import('@tauri-apps/api/core');
    return await invoke<ScanResult>('scan_paths', { paths, recursive });
  }
  return plat.scanDirectory(paths[0] || '/web_import');
}

export async function listRemovableDrives(): Promise<RemovableDrive[]> {
  try {
    return await getPlatform().getDrives();
  } catch (err) {
    console.warn('Failed to list removable drives:', err);
    return [];
  }
}

const RECENT_FOLDERS_KEY = 'lumen_recent_import_folders';

export function getRecentFolders(): string[] {
  try {
    const raw = localStorage.getItem(RECENT_FOLDERS_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

export function addRecentFolder(path: string): void {
  try {
    if (!path || path.trim().length === 0) return;
    const clean = normalizePath(path.trim());
    const recents = getRecentFolders().filter((p) => normalizePath(p) !== clean);
    recents.unshift(clean);
    localStorage.setItem(RECENT_FOLDERS_KEY, JSON.stringify(recents.slice(0, 10)));
  } catch (err) {
    console.warn('Failed to save recent folder:', err);
  }
}

export async function scanFolderPhotos(folderPath: string): Promise<ScannedPhoto[]> {
  const result = await scanPaths([folderPath], true);
  return result.photos;
}

export interface ImportOptions {
  presetName?: string;
  keywords?: string[];
  renameTemplate?: string;
  onProgress?: (current: number, total: number) => void;
  cancelSignal?: { cancelled: boolean };
}

export interface ImportSummary {
  imported: number;
  skipped: number;
  errors: number;
}

export async function executeImportAdvanced(
  sourcePath: string,
  targetPath: string | null,
  mode: 'add' | 'copy' | 'move',
  selectedPhotos: ScannedPhoto[],
  options: ImportOptions = {},
): Promise<ImportSummary> {
  const store = useCatalogStore.getState();
  store.setIsImporting(true);
  store.setImportProgress(0);

  const summary: ImportSummary = { imported: 0, skipped: 0, errors: 0 };

  try {
    const database = await getDb();
    const normalizedSource = normalizePath(sourcePath);
    const normalizedTarget = targetPath ? normalizePath(targetPath) : null;
    const finalRootPath = mode === 'add' || !normalizedTarget ? normalizedSource : normalizedTarget;
    const finalRootName = finalRootPath.split('/').filter(Boolean).pop() || 'Fotos';

    addRecentFolder(normalizedSource);

    // Insert or get root folder
    let rootFolder: RootFolder;
    try {
      await database.execute(
        'INSERT INTO root_folders (path, name) VALUES ($1, $2)',
        [finalRootPath, finalRootName],
      );
      const roots = await database.select('SELECT * FROM root_folders WHERE path = $1', [finalRootPath]);
      rootFolder = roots[0];
    } catch {
      const roots = await database.select('SELECT * FROM root_folders WHERE path = $1', [finalRootPath]);
      rootFolder = roots[0];
    }

    // Default folder inside root
    let defaultFolder: Folder;
    try {
      await database.execute(
        'INSERT INTO folders (root_id, rel_path, name) VALUES ($1, $2, $3)',
        [rootFolder.id, '', finalRootName],
      );
      const f = await database.select(
        'SELECT * FROM folders WHERE root_id = $1 AND rel_path = $2',
        [rootFolder.id, ''],
      );
      defaultFolder = f[0];
    } catch {
      const f = await database.select(
        'SELECT * FROM folders WHERE root_id = $1 AND rel_path = $2',
        [rootFolder.id, ''],
      );
      defaultFolder = f[0];
    }

    const total = selectedPhotos.length;
    let seq = 1;

    for (const photo of selectedPhotos) {
      if (options.cancelSignal?.cancelled) {
        summary.skipped += total - (summary.imported + summary.errors);
        break;
      }

      try {
        let finalFilename = photo.filename;
        if (options.renameTemplate && options.renameTemplate.trim().length > 0) {
          const ext = photo.format;
          const baseName = photo.filename.replace(/\.[^/.]+$/, '');
          const dateStr = photo.date_taken ? photo.date_taken.slice(0, 10).replace(/[: ]/g, '-') : '2026-11-01';
          const seqStr = String(seq).padStart(3, '0');
          const cam = (photo.camera_model || photo.camera_make || 'cam').replace(/\s+/g, '_');

          finalFilename = options.renameTemplate
            .replace(/\{filename\}/g, baseName)
            .replace(/\{date\}/g, dateStr)
            .replace(/\{seq\}/g, seqStr)
            .replace(/\{camera\}/g, cam);

          if (!finalFilename.toLowerCase().endsWith(`.${ext.toLowerCase()}`)) {
            finalFilename = `${finalFilename}.${ext}`;
          }
        }

        const res = await database.execute(
          `INSERT OR IGNORE INTO photos (
            folder_id, filename, file_path, file_size, file_hash, file_mtime,
            width, height, orientation, format, color_space,
            date_taken, camera_make, camera_model, lens, focal_length,
            aperture, shutter_speed, iso, gps_lat, gps_lng
          ) VALUES (
            $1, $2, $3, $4, $5, $6,
            $7, $8, $9, $10, $11,
            $12, $13, $14, $15, $16,
            $17, $18, $19, $20, $21
          )`,
          [
            defaultFolder.id,
            finalFilename,
            photo.file_path || photo.rel_path || photo.filename,
            photo.file_size || 0,
            photo.file_hash || `${finalFilename}_${Date.now()}`,
            photo.file_mtime || new Date().toISOString(),
            photo.width || 3840,
            photo.height || 2160,
            photo.orientation || 1,
            photo.format || 'jpg',
            photo.color_space || 'srgb',
            photo.date_taken || new Date().toISOString(),
            photo.camera_make || 'Cámara',
            photo.camera_model || 'Estándar',
            photo.lens || 'Estándar',
            photo.focal_length || 50.0,
            photo.aperture || 2.8,
            photo.shutter_speed || '1/250s',
            photo.iso || 100,
            photo.gps_lat || null,
            photo.gps_lng || null,
          ],
        );

        if (res.rowsAffected === 0) {
          summary.skipped++;
        } else {
          summary.imported++;

          // Get photo ID
          const rows = await database.select(
            'SELECT id FROM photos WHERE folder_id = $1 AND file_path = $2',
            [defaultFolder.id, photo.rel_path],
          );

          if (rows.length > 0) {
            const photoId = rows[0].id;

            // Apply preset settings if requested
            let initialSettings = '{"processVersion":1}';
            if (options.presetName && BUILT_IN_PRESETS[options.presetName]) {
              initialSettings = JSON.stringify({
                processVersion: 1,
                ...BUILT_IN_PRESETS[options.presetName],
              });
            }

            await database.execute(
              `INSERT OR IGNORE INTO edits (photo_id, settings) VALUES ($1, $2)`,
              [photoId, initialSettings],
            );

            // Add keywords if requested
            if (options.keywords && options.keywords.length > 0) {
              for (const kw of options.keywords) {
                const cleanKw = kw.trim();
                if (cleanKw) {
                  try {
                    await database.execute('INSERT OR IGNORE INTO keywords (name) VALUES ($1)', [cleanKw]);
                    const kwRows = await database.select('SELECT id FROM keywords WHERE name = $1', [cleanKw]);
                    if (kwRows.length > 0) {
                      await database.execute(
                        'INSERT OR IGNORE INTO photo_keywords (photo_id, keyword_id) VALUES ($1, $2)',
                        [photoId, kwRows[0].id],
                      );
                    }
                  } catch (e) {
                    console.warn('Failed associating keyword:', cleanKw, e);
                  }
                }
              }
            }
          }
        }
      } catch (err) {
        console.warn('Failed to insert photo in mode:', mode, photo.filename, err);
        summary.errors++;
      }

      seq++;
      const processed = summary.imported + summary.skipped + summary.errors;
      store.setImportProgress(processed / total);
      if (options.onProgress) {
        options.onProgress(processed, total);
      }
    }

    // Log the import
    await database.execute(
      'INSERT INTO import_log (source_path, mode, photo_count) VALUES ($1, $2, $3)',
      [sourcePath, mode, summary.imported],
    );

    await loadCatalogData();
    generateThumbnails();
  } catch (err) {
    console.error('Import advanced failed:', err);
  } finally {
    store.setIsImporting(false);
  }

  return summary;
}

export async function executeImport(
  sourcePath: string,
  targetPath: string | null,
  mode: 'add' | 'copy' | 'move',
  selectedPhotos: ScannedPhoto[],
): Promise<void> {
  await executeImportAdvanced(sourcePath, targetPath, mode, selectedPhotos);
}



// ─────────────────────────────────────────────────────────────────────
// VIRTUAL COPIES & STACKS
// ─────────────────────────────────────────────────────────────────────

export async function createVirtualCopy(photoId: number): Promise<number | null> {
  const database = await getDb();
  try {
    const rows: Photo[] = await database.select('SELECT * FROM photos WHERE id = $1', [photoId]);
    if (rows.length === 0) return null;
    const orig = rows[0];
    const masterId = orig.master_id || orig.id;

    // Get original edits if present
    const editRows = await database.select('SELECT settings FROM edits WHERE photo_id = $1', [orig.id]);
    const settings = editRows[0]?.settings || '{"processVersion":1}';

    await database.execute(
      `INSERT INTO photos (
        folder_id, master_id, filename, file_path, file_size, file_hash, file_mtime,
        width, height, orientation, format, color_space,
        date_taken, camera_make, camera_model, lens, focal_length,
        aperture, shutter_speed, iso, gps_lat, gps_lng,
        rating, flag, color_label
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7,
        $8, $9, $10, $11, $12,
        $13, $14, $15, $16, $17,
        $18, $19, $20, $21, $22,
        $23, $24, $25
      )`,
      [
        orig.folder_id,
        masterId,
        orig.filename,
        orig.file_path,
        orig.file_size,
        orig.file_hash,
        orig.file_mtime,
        orig.width,
        orig.height,
        orig.orientation,
        orig.format,
        orig.color_space,
        orig.date_taken,
        orig.camera_make,
        orig.camera_model,
        orig.lens,
        orig.focal_length,
        orig.aperture,
        orig.shutter_speed,
        orig.iso,
        orig.gps_lat,
        orig.gps_lng,
        orig.rating,
        orig.flag,
        orig.color_label,
      ],
    );

    const newRows = await database.select('SELECT id FROM photos WHERE master_id = $1 ORDER BY id DESC LIMIT 1', [masterId]);
    if (newRows.length > 0) {
      const copyId = newRows[0].id;
      await database.execute('INSERT INTO edits (photo_id, settings) VALUES ($1, $2)', [copyId, settings]);
      await database.execute(
        `INSERT INTO history_steps (photo_id, step_index, label, settings)
         VALUES ($1, 1, 'Copia Virtual', $2)`,
        [copyId, settings],
      );
      await loadCatalogData();
      return copyId;
    }
  } catch (err) {
    console.error('Failed to create virtual copy:', err);
  }
  return null;
}

export async function groupPhotosIntoStack(photoIds: number[]): Promise<number | null> {
  if (photoIds.length < 2) return null;
  const database = await getDb();
  try {
    const stackId = Date.now();
    for (let i = 0; i < photoIds.length; i++) {
      await database.execute(
        'UPDATE photos SET stack_id = $1, stack_position = $2 WHERE id = $3',
        [stackId, i + 1, photoIds[i]],
      );
    }
    await loadCatalogData();
    return stackId;
  } catch (err) {
    console.error('Failed to group into stack:', err);
    return null;
  }
}

export async function ungroupStack(stackId: number): Promise<void> {
  const database = await getDb();
  try {
    await database.execute(
      'UPDATE photos SET stack_id = NULL, stack_position = NULL WHERE stack_id = $1',
      [stackId],
    );
    await loadCatalogData();
  } catch (err) {
    console.error('Failed to ungroup stack:', err);
  }
}

export async function setStackTop(photoId: number, stackId: number): Promise<void> {
  const database = await getDb();
  try {
    // Shift others
    await database.execute(
      'UPDATE photos SET stack_position = stack_position + 1 WHERE stack_id = $1 AND id != $2',
      [stackId, photoId],
    );
    await database.execute(
      'UPDATE photos SET stack_position = 1 WHERE id = $1',
      [photoId],
    );
    await loadCatalogData();
  } catch (err) {
    console.error('Failed to set stack top:', err);
  }
}

// ─────────────────────────────────────────────────────────────────────
// SMART COLLECTIONS
// ─────────────────────────────────────────────────────────────────────

export interface SmartCollectionRule {
  ratingOp?: '>=' | '<=' | '==' | '>';
  rating?: number;
  flag?: string;
  color?: string;
  camera?: string;
  keyword?: string;
}

export async function getSmartCollections(): Promise<any[]> {
  const database = await getDb();
  try {
    return await database.select('SELECT * FROM smart_collections ORDER BY name ASC');
  } catch {
    return [];
  }
}

export async function createSmartCollection(name: string, rules: SmartCollectionRule): Promise<any> {
  const database = await getDb();
  await database.execute(
    'INSERT INTO smart_collections (name, rules) VALUES ($1, $2)',
    [name.trim(), JSON.stringify(rules)],
  );
  const rows = await database.select('SELECT * FROM smart_collections WHERE name = $1 ORDER BY id DESC LIMIT 1', [name.trim()]);
  return rows[0];
}

export async function deleteSmartCollection(id: number): Promise<void> {
  const database = await getDb();
  await database.execute('DELETE FROM smart_collections WHERE id = $1', [id]);
}

// ─────────────────────────────────────────────────────────────────────
// USER PRESETS
// ─────────────────────────────────────────────────────────────────────

export async function getUserPresets(): Promise<any[]> {
  const database = await getDb();
  try {
    return await database.select('SELECT * FROM presets ORDER BY group_name ASC, name ASC');
  } catch {
    return [];
  }
}

export async function saveUserPreset(name: string, groupName: string, settings: any): Promise<any> {
  const database = await getDb();
  await database.execute(
    'INSERT OR REPLACE INTO presets (name, group_name, settings) VALUES ($1, $2, $3)',
    [name.trim(), groupName.trim() || 'User Presets', JSON.stringify(settings)],
  );
  const rows = await database.select('SELECT * FROM presets WHERE name = $1', [name.trim()]);
  return rows[0];
}

export async function deleteUserPreset(id: number): Promise<void> {
  const database = await getDb();
  await database.execute('DELETE FROM presets WHERE id = $1', [id]);
}




import { toast } from '../../stores/toast';

const IDB_NAME = 'lumen_web_store';
const IDB_VERSION = 1;
const HANDLES_STORE = 'directory_handles';
const OPFS_FALLBACK_FLAG = 'lumen_opfs_fallback_notified';

// In-memory cache of File objects by path for immediate reading
const fileMemoryRegistry = new Map<string, File>();

export function registerFileInMemory(path: string, file: File): void {
  const norm = path.replace(/\\/g, '/').replace(/^\/+/, '');
  fileMemoryRegistry.set(norm, file);
  fileMemoryRegistry.set(file.name, file);
  const base = path.split('/').pop();
  if (base) fileMemoryRegistry.set(base, file);
}

export function getFileFromMemory(path: string): File | undefined {
  const norm = path.replace(/\\/g, '/').replace(/^\/+/, '');
  const direct = fileMemoryRegistry.get(norm);
  if (direct) return direct;
  const base = path.split('/').pop();
  if (base) return fileMemoryRegistry.get(base);
  return undefined;
}

function openIdb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      return reject(new Error('IndexedDB no está disponible en este entorno'));
    }
    const request = indexedDB.open(IDB_NAME, IDB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(HANDLES_STORE)) {
        db.createObjectStore(HANDLES_STORE);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Stores a FileSystemDirectoryHandle in IndexedDB.
 */
export async function saveDirectoryHandle(
  key: string,
  handle: FileSystemDirectoryHandle
): Promise<void> {
  try {
    const db = await openIdb();
    const tx = db.transaction(HANDLES_STORE, 'readwrite');
    tx.objectStore(HANDLES_STORE).put(handle, key);
    await new Promise((res, rej) => {
      tx.oncomplete = () => res(undefined);
      tx.onerror = () => rej(tx.error);
    });
  } catch (err) {
    console.warn('No se pudo guardar el handle en IndexedDB:', err);
  }
}

/**
 * Retrieves a stored directory handle from IndexedDB.
 */
export async function getDirectoryHandle(
  key: string
): Promise<FileSystemDirectoryHandle | null> {
  try {
    const db = await openIdb();
    const tx = db.transaction(HANDLES_STORE, 'readonly');
    const req = tx.objectStore(HANDLES_STORE).get(key);
    return new Promise((resolve) => {
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

/**
 * Verifies or prompts for user permission on a stored handle.
 */
export async function verifyHandlePermission(
  handle: any,
  readWrite = false
): Promise<boolean> {
  if (!handle || typeof handle.queryPermission !== 'function') return true;
  const options = { mode: readWrite ? 'readwrite' : 'read' };
  try {
    if ((await handle.queryPermission(options)) === 'granted') {
      return true;
    }
    if ((await handle.requestPermission(options)) === 'granted') {
      return true;
    }
  } catch (err) {
    console.warn('Error solicitando permisos del handle:', err);
  }
  return false;
}

/**
 * Copies files to OPFS (Origin Private File System) when browser lacks
 * persistent File System Access handles.
 */
export async function copyFilesToOpfs(files: File[], folderName: string): Promise<string[]> {
  const savedPaths: string[] = [];

  if (typeof navigator === 'undefined' || !navigator.storage?.getDirectory) {
    // Environment without OPFS: files stay in memory
    for (const f of files) {
      const vPath = `imported_files/${folderName}/${f.name}`;
      registerFileInMemory(vPath, f);
      savedPaths.push(vPath);
    }
    return savedPaths;
  }

  try {
    const root = await navigator.storage.getDirectory();
    const importDir = await root.getDirectoryHandle('imported_files', { create: true });
    const targetDir = await importDir.getDirectoryHandle(folderName, { create: true });

    for (const file of files) {
      const fileHandle = await targetDir.getFileHandle(file.name, { create: true });
      const writable = await (fileHandle as any).createWritable();
      await writable.write(await file.arrayBuffer());
      await writable.close();

      const relPath = `imported_files/${folderName}/${file.name}`;
      registerFileInMemory(relPath, file);
      registerFileInMemory(file.name, file);
      savedPaths.push(relPath);
    }

    if (!sessionStorage.getItem(OPFS_FALLBACK_FLAG)) {
      sessionStorage.setItem(OPFS_FALLBACK_FLAG, 'true');
      toast.info(
        `Navegador sin handles persistentes: se copiaron ${files.length} fotos a OPFS para acceso local continuo.`
      );
    }
  } catch (err: any) {
    console.warn('Error copiando a OPFS, manteniendo en memoria:', err);
    for (const f of files) {
      const vPath = `imported_files/${folderName}/${f.name}`;
      registerFileInMemory(vPath, f);
      savedPaths.push(vPath);
    }
  }

  return savedPaths;
}

/**
 * Obtains a File object from OPFS without assuming handmade URL protocols.
 * Cleans any /opfs/ or /web_import/ prefixes and traverses DirectoryHandles.
 */
export async function getFileFromOpfs(rawPath: string): Promise<File | null> {
  if (typeof navigator === 'undefined' || !navigator.storage?.getDirectory) return null;

  try {
    // Clean string prefixes
    let clean = rawPath
      .replace(/\\/g, '/')
      .replace(/^\/opfs\//, '')
      .replace(/^opfs:\/\/?/, '')
      .replace(/^\/web_import\//, '')
      .replace(/^\/+/, '');

    const root = await navigator.storage.getDirectory();

    // 1. Try direct path walk
    try {
      const parts = clean.split('/').filter(Boolean);
      if (parts.length > 0) {
        const filename = parts.pop()!;
        let currentDir = root;
        let walkOk = true;

        for (const folder of parts) {
          try {
            currentDir = await currentDir.getDirectoryHandle(folder, { create: false });
          } catch {
            walkOk = false;
            break;
          }
        }

        if (walkOk) {
          const fileHandle = await currentDir.getFileHandle(filename);
          return await fileHandle.getFile();
        }
      }
    } catch {
      // Proceed to fallback search
    }

    // 2. Fallback: Search by filename in imported_files or previews
    const filename = clean.split('/').pop();
    if (!filename) return null;

    // Check imported_files
    try {
      const importedDir = await root.getDirectoryHandle('imported_files', { create: false });
      // Iterate entries in imported_files
      for await (const [name, handle] of (importedDir as any).entries()) {
        if (handle.kind === 'file' && name === filename) {
          return await (handle as FileSystemFileHandle).getFile();
        } else if (handle.kind === 'directory') {
          try {
            const subFile = await (handle as FileSystemDirectoryHandle).getFileHandle(filename);
            return await subFile.getFile();
          } catch {
            // Not in this subfolder
          }
        }
      }
    } catch {
      // imported_files might not exist yet
    }

    // Check previews/thumbs and previews/full
    try {
      const previewsDir = await root.getDirectoryHandle('previews', { create: false });
      for (const sub of ['thumbs', 'full']) {
        try {
          const subDir = await previewsDir.getDirectoryHandle(sub, { create: false });
          const fileHandle = await subDir.getFileHandle(filename);
          return await fileHandle.getFile();
        } catch {
          // continue
        }
      }
    } catch {
      // previews might not exist yet
    }

    return null;
  } catch (err) {
    console.warn('Fallo al obtener archivo de OPFS:', rawPath, err);
    return null;
  }
}

/**
 * Reads a file from OPFS as bytes.
 */
export async function readFileFromOpfs(path: string): Promise<Uint8Array | null> {
  const file = await getFileFromOpfs(path);
  if (!file) return null;
  try {
    return new Uint8Array(await file.arrayBuffer());
  } catch (err) {
    console.warn('Fallo al leer bytes de OPFS:', path, err);
    return null;
  }
}

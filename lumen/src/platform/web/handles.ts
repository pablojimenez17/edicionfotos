import { toast } from '../../stores/toast';

const IDB_NAME = 'lumen_web_store';
const IDB_VERSION = 1;
const HANDLES_STORE = 'directory_handles';
const OPFS_FALLBACK_FLAG = 'lumen_opfs_fallback_notified';

// In-memory cache of File objects by path for immediate reading
const fileMemoryRegistry = new Map<string, File>();

export function registerFileInMemory(path: string, file: File): void {
  const norm = path.replace(/\\/g, '/');
  fileMemoryRegistry.set(norm, file);
}

export function getFileFromMemory(path: string): File | undefined {
  const norm = path.replace(/\\/g, '/');
  return fileMemoryRegistry.get(norm);
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
      const vPath = `/web_import/${folderName}/${f.name}`;
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

      const opfsPath = `/opfs/imported_files/${folderName}/${file.name}`;
      registerFileInMemory(opfsPath, file);
      savedPaths.push(opfsPath);
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
      const vPath = `/web_import/${folderName}/${f.name}`;
      registerFileInMemory(vPath, f);
      savedPaths.push(vPath);
    }
  }

  return savedPaths;
}

/**
 * Reads a file from OPFS if it starts with /opfs/
 */
export async function readFileFromOpfs(path: string): Promise<Uint8Array | null> {
  if (typeof navigator === 'undefined' || !navigator.storage?.getDirectory) return null;
  if (!path.startsWith('/opfs/')) return null;

  try {
    const relative = path.replace('/opfs/', '');
    const parts = relative.split('/');
    const filename = parts.pop()!;
    let currentDir = await navigator.storage.getDirectory();

    for (const folder of parts) {
      currentDir = await currentDir.getDirectoryHandle(folder, { create: false });
    }

    const fileHandle = await currentDir.getFileHandle(filename);
    const file = await fileHandle.getFile();
    return new Uint8Array(await file.arrayBuffer());
  } catch (err) {
    console.warn('Fallo al leer de OPFS:', path, err);
    return null;
  }
}

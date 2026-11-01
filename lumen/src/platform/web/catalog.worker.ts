/**
 * Dedicated Web Worker for SQLite WASM with OPFS SAHPool VFS.
 * Does not require Cross-Origin-Opener-Policy or Cross-Origin-Embedder-Policy headers.
 */
import sqlite3Init from '@sqlite.org/sqlite-wasm';

let db: any = null;
let poolUtil: any = null;

async function getOrInitDb() {
  if (db) return db;

  const sqlite3 = await (sqlite3Init as any)();

  // Try opfs-sahpool first (SyncAccessHandle Pool VFS - works without COOP/COEP)
  try {
    if (typeof (sqlite3 as any).installOpfsSAHPoolVfs === 'function') {
      poolUtil = await (sqlite3 as any).installOpfsSAHPoolVfs({
        name: 'lumen-sahpool',
      });
      db = new poolUtil.OpfsSAHPoolDb('lumen.db');
      console.log('Lumen SQLite-WASM inicializado con VFS opfs-sahpool');
    } else if (sqlite3.oo1?.OpfsDb) {
      db = new sqlite3.oo1.OpfsDb('/lumen.db');
      console.log('Lumen SQLite-WASM inicializado con oo1.OpfsDb');
    } else {
      db = new sqlite3.oo1.DB('lumen.db', 'c');
      console.log('Lumen SQLite-WASM inicializado con memoria/archivo fallback');
    }
  } catch (err) {
    console.warn('Fallo al inicializar OPFS SAHPool, usando memoria/fallback:', err);
    db = new sqlite3.oo1.DB('lumen.db', 'c');
  }

  try {
    db.exec('PRAGMA foreign_keys = ON;');
  } catch (err) {
    console.warn('Advertencia al activar foreign_keys en Worker:', err);
  }

  return db;
}

self.onmessage = async (event: MessageEvent) => {
  const { id, type, sql, bind, statements } = event.data;

  try {
    const database = await getOrInitDb();

    if (type === 'INIT') {
      self.postMessage({ id, ok: true });
      return;
    }

    const normSql = typeof sql === 'string' ? sql.replace(/\$\d+/g, '?') : sql;

    if (type === 'SELECT') {
      const rows: any[] = [];
      database.exec({
        sql: normSql,
        bind: bind || [],
        rowMode: 'object',
        callback: (row: any) => {
          rows.push({ ...row });
        },
      });
      self.postMessage({ id, ok: true, data: rows });
      return;
    }

    if (type === 'EXEC') {
      database.exec({
        sql: normSql,
        bind: bind || [],
      });
      const rowsAffected = database.changes ? database.changes() : 0;
      let lastInsertId: number | undefined;
      try {
        lastInsertId = Number(database.selectValue('SELECT last_insert_rowid()'));
      } catch {
        // ignore
      }
      self.postMessage({ id, ok: true, data: { rowsAffected, lastInsertId } });
      return;
    }

    if (type === 'MIGRATE') {
      for (const stmt of statements) {
        if (!stmt.trim()) continue;
        try {
          database.exec(stmt);
        } catch (mErr: any) {
          console.warn('Worker migration warning on stmt:', stmt.slice(0, 60), mErr.message);
        }
      }
      self.postMessage({ id, ok: true });
      return;
    }

    throw new Error(`Tipo de comando desconocido en SQLite Worker: ${type}`);
  } catch (err: any) {
    self.postMessage({
      id,
      ok: false,
      error: err?.message || String(err),
    });
  }
};

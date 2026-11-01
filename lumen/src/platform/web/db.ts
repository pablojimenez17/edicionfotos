import type { SqlDatabase } from '../types';
import sqlite3Init from '@sqlite.org/sqlite-wasm';

interface PendingRequest {
  resolve: (data: any) => void;
  reject: (err: any) => void;
}

export class WebSqlDatabase implements SqlDatabase {
  private worker: Worker | null = null;
  private inMemoryDb: any = null;
  private pending = new Map<string, PendingRequest>();
  private reqCounter = 0;
  private initPromise: Promise<void> | null = null;

  async init(): Promise<void> {
    if (this.initPromise) return this.initPromise;

    this.initPromise = (async () => {
      // Check if Worker is supported in environment
      if (typeof Worker !== 'undefined') {
        try {
          this.worker = new Worker(new URL('./catalog.worker.ts', import.meta.url), {
            type: 'module',
          });

          this.worker.onmessage = (event: MessageEvent) => {
            const { id, ok, data, error } = event.data;
            const handler = this.pending.get(id);
            if (!handler) return;
            this.pending.delete(id);

            if (ok) {
              handler.resolve(data);
            } else {
              handler.reject(new Error(error || 'Error en SQLite Worker'));
            }
          };

          this.worker.onerror = (err) => {
            console.error('Error no capturado en SQLite Worker:', err);
          };

          // Handshake
          await this.sendToWorker('INIT', {});
          return;
        } catch (workerErr) {
          console.warn('No se pudo inicializar Worker para SQLite, usando SQLite in-thread:', workerErr);
        }
      }

      // In-thread fallback (Vitest / Node / restricted environments)
      const sqlite3 = await (sqlite3Init as any)();
      this.inMemoryDb = new sqlite3.oo1.DB('lumen.db', 'c');
      this.inMemoryDb.exec('PRAGMA foreign_keys = ON;');
    })();

    return this.initPromise;
  }

  private sendToWorker<T = any>(type: string, payload: any): Promise<T> {
    const id = `req_${++this.reqCounter}`;
    return new Promise<T>((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.worker!.postMessage({ id, type, ...payload });
    });
  }

  async select<T = any>(query: string, params?: any[]): Promise<T[]> {
    await this.init();
    const normSql = typeof query === 'string' ? query.replace(/\$\d+/g, '?') : query;
    if (this.worker) {
      return this.sendToWorker<T[]>('SELECT', { sql: normSql, bind: params });
    }

    const rows: T[] = [];
    this.inMemoryDb.exec({
      sql: normSql,
      bind: params || [],
      rowMode: 'object',
      callback: (row: any) => {
        rows.push({ ...row } as T);
      },
    });
    return rows;
  }

  async execute(query: string, params?: any[]): Promise<{ rowsAffected: number; lastInsertId?: number }> {
    await this.init();
    const normSql = typeof query === 'string' ? query.replace(/\$\d+/g, '?') : query;
    if (this.worker) {
      return this.sendToWorker<{ rowsAffected: number; lastInsertId?: number }>('EXEC', {
        sql: normSql,
        bind: params,
      });
    }

    this.inMemoryDb.exec({
      sql: normSql,
      bind: params || [],
    });
    const rowsAffected = this.inMemoryDb.changes ? this.inMemoryDb.changes() : 0;
    let lastInsertId: number | undefined;
    try {
      lastInsertId = Number(this.inMemoryDb.selectValue('SELECT last_insert_rowid()'));
    } catch {
      // ignore
    }
    return { rowsAffected, lastInsertId };
  }

  async runStatements(statements: string[]): Promise<void> {
    await this.init();
    if (this.worker) {
      await this.sendToWorker('MIGRATE', { statements });
      return;
    }

    for (const stmt of statements) {
      if (!stmt.trim()) continue;
      try {
        this.inMemoryDb.exec(stmt);
      } catch (err: any) {
        console.warn('In-thread migration warning:', stmt.slice(0, 60), err.message);
      }
    }
  }

  async close(): Promise<void> {
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }
    if (this.inMemoryDb) {
      this.inMemoryDb.close();
      this.inMemoryDb = null;
    }
    this.initPromise = null;
  }
}

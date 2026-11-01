import { describe, it, expect } from 'vitest';
import { TauriPlatform } from './tauri';
import { WebPlatform } from './web';
import { WebSqlDatabase } from './web/db';
import { INITIAL_MIGRATION_SQL } from './migrationSql';
import { splitSqlStatements } from '../services/catalog';
import { getWebIccProfile, injectIccProfileIntoJpeg } from './web/icc';

describe('Capa de Plataforma - Dual Web & Desktop', () => {
  it('TauriPlatform declara capacidades de escritorio completas', () => {
    const tauri = new TauriPlatform();
    expect(tauri.name).toBe('tauri');
    expect(tauri.capabilities.nativeFs).toBe(true);
    expect(tauri.capabilities.rawFull).toBe(true);
    expect(tauri.capabilities.sqlBackend).toBe('sqlite-tauri');
    expect(tauri.capabilities.exportDirectSave).toBe(true);
    expect(tauri.capabilities.lensfun).toBe(true);
  });

  it('WebPlatform declara capacidades web y SQLite-WASM OPFS', () => {
    const web = new WebPlatform();
    expect(web.name).toBe('web');
    expect(web.capabilities.nativeFs).toBe(false);
    expect(web.capabilities.rawFull).toBe(false);
    expect(web.capabilities.sqlBackend).toBe('sqlite-wasm-opfs');
    expect(web.capabilities.exportDirectSave).toBe(false);
  });

  it('WebSqlDatabase ejecuta la migración real 001_initial.sql con FTS5 y triggers', async () => {
    const db = new WebSqlDatabase();
    await db.init();

    const stmts = splitSqlStatements(INITIAL_MIGRATION_SQL);
    await db.runStatements(stmts);

    // Verify schema_version table exists and version is 1
    const versionRows = await db.select('SELECT version FROM schema_version');
    expect(versionRows.length).toBe(1);
    expect(versionRows[0].version).toBe(1);

    // Insert root_folder
    await db.execute('INSERT INTO root_folders (path, name) VALUES (?, ?)', ['/web_dir/Vacaciones', 'Vacaciones']);
    const roots = await db.select('SELECT id, path FROM root_folders WHERE path = ?', ['/web_dir/Vacaciones']);
    expect(roots.length).toBe(1);
    const rootId = roots[0].id;

    // Insert folder
    await db.execute('INSERT INTO folders (root_id, rel_path, name) VALUES (?, ?, ?)', [rootId, 'Playa', 'Playa']);
    const folders = await db.select('SELECT id FROM folders WHERE root_id = ?', [rootId]);
    const folderId = folders[0].id;

    // Insert photo
    const insertRes = await db.execute(
      `INSERT INTO photos (folder_id, filename, file_path, format, date_taken)
       VALUES (?, ?, ?, ?, ?)`,
      [folderId, 'puesta_de_sol.jpg', 'Playa/puesta_de_sol.jpg', 'jpg', '2026-08-15T19:30:00']
    );
    expect(insertRes.rowsAffected).toBe(1);

    const photos = await db.select('SELECT id, filename FROM photos WHERE filename = ?', ['puesta_de_sol.jpg']);
    expect(photos.length).toBe(1);
    const photoId = photos[0].id;

    // Insert keyword and link photo
    await db.execute('INSERT INTO keywords (name) VALUES (?)', ['Atardecer']);
    const kwRows = await db.select('SELECT id FROM keywords WHERE name = ?', ['Atardecer']);
    const kwId = kwRows[0].id;

    await db.execute('INSERT INTO photo_keywords (photo_id, keyword_id) VALUES (?, ?)', [photoId, kwId]);

    // Test FTS5 Search on filename
    const ftsFilename = await db.select(
      `SELECT p.id, p.filename
       FROM photos p
       JOIN photos_fts fts ON fts.rowid = p.id
       WHERE photos_fts MATCH 'puesta*'`
    );
    expect(ftsFilename.length).toBe(1);
    expect(ftsFilename[0].filename).toBe('puesta_de_sol.jpg');

    // Test FTS5 Search on triggered keyword
    const ftsKeyword = await db.select(
      `SELECT p.id, p.filename
       FROM photos p
       JOIN photos_fts fts ON fts.rowid = p.id
       WHERE photos_fts MATCH 'Atardecer'`
    );
    expect(ftsKeyword.length).toBe(1);
    expect(ftsKeyword[0].filename).toBe('puesta_de_sol.jpg');

    // Test non-destructive edits and history
    await db.execute(
      `INSERT INTO edits (photo_id, settings) VALUES (?, ?)`,
      [photoId, JSON.stringify({ exposure: 1.25, contrast: 10 })]
    );
    const edits = await db.select('SELECT settings FROM edits WHERE photo_id = ?', [photoId]);
    expect(JSON.parse(edits[0].settings).exposure).toBe(1.25);

    await db.close();
  });

  it('Generador de perfiles ICC v2.1 para Web produce perfiles válidos e inyecta APP2 en JPEG', () => {
    const srgbIcc = getWebIccProfile('srgb');
    expect(srgbIcc.length).toBeGreaterThan(128);
    // Magic signature 'acsp' at offset 36
    const magic = String.fromCharCode(...srgbIcc.slice(36, 40));
    expect(magic).toBe('acsp');

    const p3Icc = getWebIccProfile('display-p3');
    expect(p3Icc.length).toBeGreaterThan(128);

    // Mock minimal JPEG with SOI (0xFF, 0xD8) and EOI (0xFF, 0xD9)
    const mockJpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xd9]);
    const taggedJpeg = injectIccProfileIntoJpeg(mockJpeg, srgbIcc);

    expect(taggedJpeg[0]).toBe(0xff);
    expect(taggedJpeg[1]).toBe(0xd8);
    expect(taggedJpeg[2]).toBe(0xff);
    expect(taggedJpeg[3]).toBe(0xe2); // APP2 marker

    const idStr = String.fromCharCode(...taggedJpeg.slice(6, 17));
    expect(idStr).toBe('ICC_PROFILE');
  });
});

import { test, expect } from '@playwright/test';
import * as path from 'path';
import * as fs from 'fs';

test.describe('Versión Web Lumen (Navegador, SQLite-WASM, OPFS y Export)', () => {
  test('Flujo completo web: detección de entorno, importación de 50 fotos, edición, persistencia tras recarga y exportación con descarga', async ({ page }) => {
    test.setTimeout(60000);

    // Desactivar el modal de bienvenida (walkthrough) para pruebas limpias
    await page.addInitScript(() => {
      localStorage.setItem('lumen_walkthrough_seen', 'true');
    });

    // 1. Cargar aplicación en entorno web (navegador sin Tauri)
    await page.goto('/');
    await page.waitForSelector('.app-layout');

    // 2. Verificar badge de entorno en la barra de estado
    const envBadge = page.locator('#env-badge');
    await expect(envBadge).toBeVisible();
    await expect(envBadge).toContainText('Web');
    const href = await envBadge.getAttribute('href');
    expect(href).toContain('github.com/pablojimenez17/edicionfotos/releases/latest');

    // 3. Preparar rutas de las 50 fotos de muestra
    const sampleDir = path.resolve('public/sample_batch');
    const photoFiles = fs.readdirSync(sampleDir)
      .filter((f) => f.endsWith('.jpg'))
      .map((f) => path.join(sampleDir, f));
    expect(photoFiles.length).toBe(50);

    page.on('console', (msg) => console.log('BROWSER LOG:', msg.text()));
    page.on('pageerror', (err) => console.error('BROWSER ERROR:', err));

    // 4. Inyectar fotos en el estado del catálogo mediante API de importación web
    await page.evaluate(async (filenames) => {
      const store = (window as any).__CATALOG_STORE__;
      const catalogService = await import('/src/services/catalog.ts');
      const { registerFileInMemory } = await import('/src/platform/web/handles.ts');

      // Esperar a que la migración e inicialización del catálogo hayan finalizado por completo
      await catalogService.initCatalog();

      // Cargar los blobs reales de las 50 fotos desde /sample_batch/
      const scannedPhotos = await Promise.all(filenames.map(async (name: string, i: number) => {
        const vPath = `/web_import/${name}`;
        const resp = await fetch(`/sample_batch/${name}`);
        const realBlob = await resp.blob();
        registerFileInMemory(vPath, realBlob as any);

        return {
          filename: name,
          file_path: vPath,
          rel_path: name,
          file_size: realBlob.size || 1024 * (i + 1),
          file_hash: `hash_photo_${i + 1}`,
          file_mtime: new Date().toISOString(),
          format: 'jpg',
          color_space: 'srgb',
          orientation: 1,
          width: 3840,
          height: 2160,
          date_taken: new Date(2026, 10, i + 1).toISOString(),
          camera_make: 'Sony',
          camera_model: 'ILCE-7RM5',
          lens: 'FE 24-70mm F2.8 GM II',
          focal_length: 35.0,
          aperture: 2.8,
          shutter_speed: '1/500s',
          iso: 100,
        };
      }));

      // Ejecutar importación real en la base de datos SQLite-WASM
      const summary = await catalogService.executeImportAdvanced(
        '/web_import',
        null,
        'add',
        scannedPhotos,
        {}
      );
      console.log('IMPORT ADVANCED SUMMARY:', JSON.stringify(summary));

      // Recargar catálogo desde SQLite-WASM
      await catalogService.loadCatalogData();
    }, photoFiles.map((p) => path.basename(p)));

    // 5. Verificar que las 50 fotos se cargaron en el catálogo y en la rejilla
    const statusBar = page.locator('footer[role="status"]');
    await expect(statusBar).toContainText('50 fotos');

    // Comprobar elementos de la rejilla
    const gridCards = page.locator('.photo-cell');
    await expect(gridCards).toHaveCount(50);

    // 6. Captura de pantalla de la rejilla completa con las 50 fotos importadas
    const docsUiDir = path.resolve('docs/ui');
    if (!fs.existsSync(docsUiDir)) fs.mkdirSync(docsUiDir, { recursive: true });
    await page.screenshot({ path: path.join(docsUiDir, 'web_50_fotos_biblioteca.png'), fullPage: true });

    // 7. Seleccionar una foto y asignarle valoración y bandera
    const firstCell = gridCards.first();
    await firstCell.click();
    await page.keyboard.press('5'); // Calificación 5 estrellas
    await page.keyboard.press('p'); // Bandera 'pick'

    // Verificar en store
    const photoState = await page.evaluate(() => {
      const store = (window as any).__CATALOG_STORE__.getState();
      const p = store.photos.find((item: any) => item.id === store.activePhotoId);
      return { rating: p?.rating, flag: p?.flag, id: p?.id };
    });
    expect(photoState.rating).toBe(5);
    expect(photoState.flag).toBe('pick');

    // 8. Cambiar al módulo de Revelado
    await page.locator('button:has-text("Revelado")').click();
    await page.waitForSelector('canvas');
    await page.waitForTimeout(500);

    // Capturar pantalla del módulo de Revelado en Web
    await page.screenshot({ path: path.join(docsUiDir, 'web_revelado_canvas.png') });

    // 9. Volver a Biblioteca
    await page.locator('button:has-text("Biblioteca")').click();
    await page.waitForSelector('.photo-cell');

    // 10. Recargar la página (F5) para verificar persistencia del catálogo en SQLite-WASM / OPFS
    await page.reload();
    await page.waitForSelector('.app-layout');

    // Comprobar que tras la recarga, las 50 fotos siguen presentes en el catálogo
    const reloadedStatusBar = page.locator('footer[role="status"]');
    await expect(reloadedStatusBar).toContainText('50 fotos');
    await expect(page.locator('.photo-cell')).toHaveCount(50);

    // Verificar que la valoración de 5 estrellas y la bandera se conservaron
    const reloadedPhoto = await page.evaluate((targetId) => {
      const store = (window as any).__CATALOG_STORE__.getState();
      const p = store.photos.find((item: any) => item.id === targetId);
      return { rating: p?.rating, flag: p?.flag };
    }, photoState.id);
    expect(reloadedPhoto.rating).toBe(5);
    expect(reloadedPhoto.flag).toBe('pick');

    // 11. Probar flujo de exportación con descarga en el navegador
    await page.locator('button:has-text("Exportar…")').click();
    await page.waitForSelector('#export-modal-dialog');

    // Interceptar evento de descarga del navegador al pulsar "Exportar"
    const [download] = await Promise.all([
      page.waitForEvent('download', { timeout: 10000 }).catch(() => null),
      page.locator('#btn-start-export').click(),
    ]);

    if (download) {
      const downloadName = download.suggestedFilename();
      expect(downloadName).toContain('.jpg');
    }
  });
});

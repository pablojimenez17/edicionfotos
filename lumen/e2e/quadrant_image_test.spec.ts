import { test, expect } from '@playwright/test';
import * as path from 'path';
import * as fs from 'fs';

test.describe('Pruebas E2E de Carga de Imágenes: Cuadrantes y Foto Real en Cuadrícula, Lupa y Revelado', () => {
  test('Verificar que la imagen de 4 cuadrantes y la foto real IMG_1229.JPEG cargan correctamente sin icono de imagen rota ni texto "Lumen Web"', async ({ page }) => {
    test.setTimeout(60000);

    // Evitar el diálogo inicial de bienvenida
    await page.addInitScript(() => {
      localStorage.setItem('lumen_walkthrough_seen', 'true');
    });

    const consoleErrors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    // 1. Navegar a la aplicación
    await page.goto('/');
    await page.waitForSelector('.app-layout');

    // 2. Crear e importar imagen sintética de 4 cuadrantes (rojo, verde, azul, amarillo) y foto real IMG_1229.JPEG
    await page.evaluate(async () => {
      const catalogService = await import('/src/services/catalog.ts');
      const { registerFileInMemory } = await import('/src/platform/web/handles.ts');

      await catalogService.initCatalog();

      // Generar imagen de 4 cuadrantes en un canvas
      const canvas = document.createElement('canvas');
      canvas.width = 200;
      canvas.height = 200;
      const ctx = canvas.getContext('2d')!;

      // Cuadrante superior-izquierdo: Rojo (#FF0000)
      ctx.fillStyle = '#ff0000';
      ctx.fillRect(0, 0, 100, 100);

      // Cuadrante superior-derecho: Verde (#00FF00)
      ctx.fillStyle = '#00ff00';
      ctx.fillRect(100, 0, 100, 100);

      // Cuadrante inferior-izquierdo: Azul (#0000FF)
      ctx.fillStyle = '#0000ff';
      ctx.fillRect(0, 100, 100, 100);

      // Cuadrante inferior-derecho: Amarillo (#FFFF00)
      ctx.fillStyle = '#ffff00';
      ctx.fillRect(100, 100, 100, 100);

      const quadrantBlob = await new Promise<Blob>((resolve) => canvas.toBlob((b) => resolve(b!), 'image/png'));
      const quadrantPath = '/web_import/quadrant_test.png';
      registerFileInMemory(quadrantPath, quadrantBlob);
      registerFileInMemory('quadrant_test.png', quadrantBlob);

      // Descargar foto real y registrarla como IMG_1229.JPEG (el caso exacto del bug reportado)
      const realResp = await fetch('/test_real_photo.jpg');
      const realBlob = await realResp.blob();
      const realPath = '/web_import/IMG_1229.JPEG';
      registerFileInMemory(realPath, realBlob);
      registerFileInMemory('IMG_1229.JPEG', realBlob);

      const scanned = [
        {
          filename: 'quadrant_test.png',
          file_path: quadrantPath,
          rel_path: 'quadrant_test.png',
          file_size: quadrantBlob.size,
          file_hash: 'hash_quadrant_1',
          file_mtime: new Date().toISOString(),
          format: 'png',
          color_space: 'srgb',
          orientation: 1,
          width: 200,
          height: 200,
          date_taken: new Date().toISOString(),
          camera_make: 'LumenTest',
          camera_model: 'QuadrantGen',
          lens: '24-70mm',
          focal_length: 50,
          aperture: 2.8,
          shutter_speed: '1/250s',
          iso: 100,
        },
        {
          filename: 'IMG_1229.JPEG',
          file_path: realPath,
          rel_path: 'IMG_1229.JPEG',
          file_size: realBlob.size,
          file_hash: 'hash_real_photo_1229',
          file_mtime: new Date().toISOString(),
          format: 'jpeg',
          color_space: 'srgb',
          orientation: 1,
          width: 1536,
          height: 2048,
          date_taken: new Date().toISOString(),
          camera_make: 'Apple',
          camera_model: 'iPhone',
          lens: 'Back Camera',
          focal_length: 26,
          aperture: 1.8,
          shutter_speed: '1/120s',
          iso: 80,
        },
      ];

      await catalogService.executeImportAdvanced('/web_import', null, 'add', scanned, {});
      await catalogService.loadCatalogData();
    });

    // 3. Comprobación en Cuadrícula (Grid)
    const gridCells = page.locator('.photo-cell');
    await expect(gridCells).toHaveCount(2);

    // Esperar a que ambas miniaturas se resuelvan y rendericen sus <img>
    const photoImgs = page.locator('.photo-cell__img');
    await expect(photoImgs).toHaveCount(2, { timeout: 15000 });

    // Esperar a que ambos <img> tengan complete y naturalWidth > 0
    await page.waitForFunction(() => {
      const imgs = Array.from(document.querySelectorAll<HTMLImageElement>('.photo-cell__img'));
      return imgs.length === 2 && imgs.every((img) => img.complete && img.naturalWidth > 0);
    }, { timeout: 15000 });

    const imgStatuses = await page.evaluate(() => {
      const imgs = Array.from(document.querySelectorAll<HTMLImageElement>('.photo-cell__img'));
      return imgs.map((img) => ({
        src: img.src,
        complete: img.complete,
        naturalWidth: img.naturalWidth,
        naturalHeight: img.naturalHeight,
      }));
    });

    expect(imgStatuses.length).toBe(2);
    for (const status of imgStatuses) {
      expect(status.complete).toBe(true);
      expect(status.naturalWidth).toBeGreaterThan(0);
      expect(status.naturalHeight).toBeGreaterThan(0);
      expect(status.src).toContain('blob:');
      expect(status.src).not.toContain('/opfs/');
    }

    // Verificar ausencia absoluta de errores y textos rotos
    const pageText = await page.innerText('body');
    expect(pageText).not.toContain('Lumen Web');
    expect(pageText).not.toContain('No se pudo cargar esta foto');

    const brokenErrors = page.locator('.photo-error-state');
    await expect(brokenErrors).toHaveCount(0);

    // 4. Comprobación en Lupa (Loupe) para la imagen de 4 cuadrantes
    // Seleccionar la foto de cuadrantes (buscar la celda de quadrant_test.png)
    const quadrantCell = page.locator('.photo-cell:has-text("quadrant_test.png")');
    await quadrantCell.click();

    // Cambiar a la vista Lupa (tecla 'e' o botón ⊡)
    await page.keyboard.press('e');
    await page.waitForSelector('#loupe-canvas');
    await page.waitForFunction(() => {
      const canvas = document.querySelector<HTMLCanvasElement>('#loupe-canvas');
      const img = document.querySelector<HTMLImageElement>('#loupe-img');
      return canvas && canvas.width > 0 && canvas.height > 0 && img && img.complete && img.naturalWidth > 0;
    }, { timeout: 15000 });

    // Verificar en Lupa: <img> de sincronización tiene complete y naturalWidth > 0
    const loupeImgState = await page.evaluate(() => {
      const img = document.querySelector<HTMLImageElement>('#loupe-img');
      return {
        complete: img?.complete,
        naturalWidth: img?.naturalWidth,
        naturalHeight: img?.naturalHeight,
        src: img?.src,
      };
    });
    expect(loupeImgState.complete).toBe(true);
    expect(loupeImgState.naturalWidth).toBe(200);
    expect(loupeImgState.naturalHeight).toBe(200);
    expect(loupeImgState.src).toContain('blob:');

    // Verificar en Lupa: #loupe-canvas contiene los píxeles de los 4 cuadrantes
    const quadrantPixels = await page.evaluate(() => {
      const canvas = document.querySelector<HTMLCanvasElement>('#loupe-canvas');
      if (!canvas) return null;
      const ctx = canvas.getContext('2d');
      if (!ctx) return null;
      const w = canvas.width;
      const h = canvas.height;

      // Muestrear centro de cada cuadrante (25%, 75%)
      const getPixel = (x: number, y: number) => {
        const p = ctx.getImageData(Math.floor(x), Math.floor(y), 1, 1).data;
        return [p[0], p[1], p[2], p[3]];
      };

      return {
        w,
        h,
        topLeft: getPixel(w * 0.25, h * 0.25),      // Rojo
        topRight: getPixel(w * 0.75, h * 0.25),     // Verde
        bottomLeft: getPixel(w * 0.25, h * 0.75),   // Azul
        bottomRight: getPixel(w * 0.75, h * 0.75),  // Amarillo
      };
    });

    expect(quadrantPixels).not.toBeNull();
    // Cuadrante 1: Rojo (#FF0000)
    expect(quadrantPixels!.topLeft[0]).toBeGreaterThan(200);
    expect(quadrantPixels!.topLeft[1]).toBeLessThan(50);
    expect(quadrantPixels!.topLeft[2]).toBeLessThan(50);

    // Cuadrante 2: Verde (#00FF00)
    expect(quadrantPixels!.topRight[0]).toBeLessThan(50);
    expect(quadrantPixels!.topRight[1]).toBeGreaterThan(200);
    expect(quadrantPixels!.topRight[2]).toBeLessThan(50);

    // Cuadrante 3: Azul (#0000FF)
    expect(quadrantPixels!.bottomLeft[0]).toBeLessThan(50);
    expect(quadrantPixels!.bottomLeft[1]).toBeLessThan(50);
    expect(quadrantPixels!.bottomLeft[2]).toBeGreaterThan(200);

    // Cuadrante 4: Amarillo (#FFFF00)
    expect(quadrantPixels!.bottomRight[0]).toBeGreaterThan(200);
    expect(quadrantPixels!.bottomRight[1]).toBeGreaterThan(200);
    expect(quadrantPixels!.bottomRight[2]).toBeLessThan(50);

    // Asegurar que no hay textos "Lumen Web" ni icono roto
    const loupeText = await page.innerText('body');
    expect(loupeText).not.toContain('Lumen Web');
    expect(loupeText).not.toContain('No se pudo cargar esta foto');

    // 5. Comprobación en Revelado (Develop)
    await page.locator('button:has-text("Revelado")').click();
    await page.waitForSelector('#develop-canvas');
    await page.waitForFunction(() => {
      const canvas = document.querySelector<HTMLCanvasElement>('#develop-canvas');
      if (!canvas || canvas.width === 0 || canvas.height === 0) return false;
      const gl = canvas.getContext('webgl2');
      if (!gl) return false;
      const buf = new Uint8Array(4);
      gl.readPixels(Math.floor(canvas.width / 2), Math.floor(canvas.height / 2), 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, buf);
      return (buf[0] + buf[1] + buf[2]) > 0;
    }, { timeout: 15000 });

    // Verificar en WebGL DevelopPipeline los 4 cuadrantes
    const developPixels = await page.evaluate(() => {
      const canvas = document.querySelector<HTMLCanvasElement>('#develop-canvas');
      if (!canvas) return null;
      const gl = canvas.getContext('webgl2');
      if (!gl) return null;
      const w = canvas.width;
      const h = canvas.height;

      const readAt = (x: number, y: number) => {
        const buf = new Uint8Array(4);
        gl.readPixels(Math.floor(x), Math.floor(y), 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, buf);
        return Array.from(buf);
      };

      return {
        w,
        h,
        pos0_0: readAt(w * 0.25, h * 0.25),
        pos1_0: readAt(w * 0.75, h * 0.25),
        pos0_1: readAt(w * 0.25, h * 0.75),
        pos1_1: readAt(w * 0.75, h * 0.75),
      };
    });

    console.log('DEVELOP PIXELS RESULT:', JSON.stringify(developPixels));

    // Comprobar que los 4 cuadrantes (rojo, verde, azul, amarillo) están presentes en el canvas WebGL
    const samples = [
      developPixels!.pos0_0,
      developPixels!.pos1_0,
      developPixels!.pos0_1,
      developPixels!.pos1_1,
    ];
    const hasRed = samples.some((p) => p[0] > 180 && p[1] < 60 && p[2] < 60);
    const hasGreen = samples.some((p) => p[0] < 60 && p[1] > 180 && p[2] < 60);
    const hasBlue = samples.some((p) => p[0] < 60 && p[1] < 60 && p[2] > 180);
    const hasYellow = samples.some((p) => p[0] > 180 && p[1] > 180 && p[2] < 60);

    expect(hasRed).toBe(true);
    expect(hasGreen).toBe(true);
    expect(hasBlue).toBe(true);
    expect(hasYellow).toBe(true);

    // 6. Comprobación con FOTO REAL IMG_1229.JPEG en Lupa
    // Volver a Biblioteca
    await page.locator('button:has-text("Biblioteca")').click();
    await page.waitForTimeout(300);

    // Asegurar vista Lupa ('e')
    await page.keyboard.press('e');
    await page.waitForTimeout(300);

    // Hacer clic en la miniatura de IMG_1229.JPEG (disponible en la tira de película)
    const realThumb = page.locator('img[alt="IMG_1229.JPEG"]').first();
    await realThumb.click();
    await page.waitForTimeout(500);

    await page.waitForSelector('#loupe-canvas');
    await page.waitForFunction(() => {
      const canvas = document.querySelector<HTMLCanvasElement>('#loupe-canvas');
      const img = document.querySelector<HTMLImageElement>('#loupe-img');
      return canvas && canvas.width > 200 && img && img.complete && img.naturalWidth > 200;
    }, { timeout: 15000 });

    // Verificar foto real en Lupa
    const realLoupeState = await page.evaluate(() => {
      const canvas = document.querySelector<HTMLCanvasElement>('#loupe-canvas');
      const img = document.querySelector<HTMLImageElement>('#loupe-img');
      const ctx = canvas?.getContext('2d');
      const pixelSample = ctx ? Array.from(ctx.getImageData(Math.floor(canvas!.width / 2), Math.floor(canvas!.height / 2), 1, 1).data) : null;

      return {
        canvasWidth: canvas?.width || 0,
        canvasHeight: canvas?.height || 0,
        imgComplete: img?.complete || false,
        imgNaturalWidth: img?.naturalWidth || 0,
        imgNaturalHeight: img?.naturalHeight || 0,
        imgSrc: img?.src || '',
        pixelSample,
      };
    });

    expect(realLoupeState.imgComplete).toBe(true);
    expect(realLoupeState.imgNaturalWidth).toBeGreaterThan(0);
    expect(realLoupeState.canvasWidth).toBeGreaterThan(0);
    expect(realLoupeState.canvasHeight).toBeGreaterThan(0);
    expect(realLoupeState.imgSrc).toContain('blob:');
    expect(realLoupeState.imgSrc).not.toContain('/opfs/');
    expect(realLoupeState.imgSrc).not.toContain('/web_import/');

    // Muestra de píxeles no debe ser completamente negro/transparente
    expect(realLoupeState.pixelSample).not.toBeNull();
    const sumChannels = realLoupeState.pixelSample![0] + realLoupeState.pixelSample![1] + realLoupeState.pixelSample![2];
    expect(sumChannels).toBeGreaterThan(0);

    // Sin errores ni textos rotos
    const finalBodyText = await page.innerText('body');
    expect(finalBodyText).not.toContain('Lumen Web');
    expect(finalBodyText).not.toContain('No se pudo cargar esta foto');

    // 7. Guardar captura oficial con foto real en la Lupa
    const docsUiDir = path.resolve('docs/ui');
    if (!fs.existsSync(docsUiDir)) fs.mkdirSync(docsUiDir, { recursive: true });

    const screenshotPath = path.join(docsUiDir, 'lupa_real_photo.png');
    await page.screenshot({ path: screenshotPath, fullPage: true });
    console.log(`[OK] Captura de foto real en Lupa guardada en: ${screenshotPath}`);
  });
});

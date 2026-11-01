import { test, expect } from '@playwright/test';

test('capturar capturas del sistema de importación desde el ordenador', async ({ page }) => {
  test.setTimeout(60000);

  await page.addInitScript(() => {
    localStorage.setItem('lumen_walkthrough_seen', 'true');
    // Pre-populate 5 recent folders
    const recents = [
      'C:/Users/Pablo Jiménez/Pictures/Vacaciones 2026',
      'C:/Users/Pablo Jiménez/Desktop/Sesión Retratos Estudio',
      'D:/Fotos/Viaje a los Picos de Europa',
      'E:/SD_CARD/DCIM/100CANON',
      'C:/Users/Pablo Jiménez/Downloads/Fotografías RAW',
    ];
    localStorage.setItem('lumen_recent_import_folders', JSON.stringify(recents));
  });

  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  await page.waitForTimeout(500);

  // 1. Captura del estado vacío de la biblioteca (con los 2 botones juntos y el texto debajo)
  await page.screenshot({ path: 'docs/ui/estado_vacio_biblioteca.png' });

  // 2. Abrir el menú desplegable "Importar..."
  await page.click('#btn-import-dropdown');
  await page.waitForSelector('#import-dropdown-menu', { state: 'visible' });
  await page.waitForTimeout(300);
  await page.screenshot({ path: 'docs/ui/menu_importar.png' });

  // Cerrar menú
  await page.keyboard.press('Escape');
  await page.waitForTimeout(200);

  // 3. Captura del estado de Arrastrar y Soltar ("Suelta para importar")
  await page.evaluate(() => {
    window.dispatchEvent(new DragEvent('dragover', { bubbles: true, cancelable: true }));
  });
  await page.waitForSelector('#drag-drop-overlay', { state: 'visible' });
  await page.waitForTimeout(300);
  await page.screenshot({ path: 'docs/ui/estado_arrastrar_soltar.png' });

  // Desactivar drag overlay
  await page.evaluate(() => {
    window.dispatchEvent(new DragEvent('dragleave', { bubbles: true, cancelable: true }));
  });
  await page.waitForTimeout(200);

  // 4. Captura del diálogo de importación con la rejilla, detección de duplicados, banner y opciones
  await page.evaluate(() => {
    // Inject catalog photos with known hashes to demonstrate duplicate detection
    const catalogStore = (window as any).useCatalogStore?.getState();
    if (catalogStore) {
      catalogStore.setPhotos([
        {
          id: 1,
          folder_id: 1,
          master_id: null,
          filename: 'DSC_0001.JPG',
          root_path: 'C:/Fotos',
          file_path: 'DSC_0001.JPG',
          file_size: 4200000,
          file_hash: 'hash_dup_123',
          file_mtime: '2026-05-18T10:00:00Z',
          width: 6000,
          height: 4000,
          orientation: 1,
          format: 'jpg',
          color_space: 'sRGB',
          date_taken: '2026-05-18 10:14:22',
          camera_make: 'Sony',
          camera_model: 'ILCE-7M4',
          lens: 'FE 24-70mm F2.8 GM II',
          focal_length: 50,
          aperture: 2.8,
          shutter_speed: '1/250',
          iso: 100,
          gps_lat: null,
          gps_lng: null,
          rating: 0,
          flag: 'none',
          color_label: 'none',
          stack_id: null,
          stack_position: null,
          is_missing: false,
          imported_at: '2026-05-18T12:00:00Z',
          updated_at: '2026-05-18T12:00:00Z',
        },
      ]);
    }

    // Open import dialog and supply rich scan results
    const trigger = document.getElementById('btn-import-dropdown');
    trigger?.click();
  });

  // Open modal via native files/folder or mock trigger
  await page.keyboard.press('Control+Shift+I');
  await page.waitForSelector('#import-modal-container', { state: 'visible' });

  // Populate mock scan results with 12 photos, duplicates, and format warnings
  await page.evaluate(() => {
    const modal = document.getElementById('import-modal-container');
    if (!modal) return;

    // Simulate pre-scan state with rich metadata
    const mockPhotos = [
      { filename: 'IMG_4521.CR2', format: 'cr2', width: 5184, height: 3456, file_size: 28500000, file_hash: 'hash_raw_1', has_embedded_preview: true },
      { filename: 'DSC08920.ARW', format: 'arw', width: 6000, height: 4000, file_size: 24200000, file_hash: 'hash_raw_2' },
      { filename: '_DSC1024.NEF', format: 'nef', width: 7360, height: 4912, file_size: 33400000, file_hash: 'hash_raw_3' },
      { filename: 'P1030450.RW2', format: 'rw2', width: 4592, height: 3448, file_size: 19800000, file_hash: 'hash_raw_4' },
      { filename: 'Foto_Parque_01.JPG', format: 'jpg', width: 4000, height: 3000, file_size: 4200000, file_hash: 'hash_dup_123' }, // Duplicate!
      { filename: 'Retrato_Estudio_02.JPG', format: 'jpg', width: 6000, height: 4000, file_size: 8900000, file_hash: 'hash_new_5' },
      { filename: 'Amanecer_Playa.PNG', format: 'png', width: 3840, height: 2160, file_size: 12400000, file_hash: 'hash_new_6' },
      { filename: 'Arquitectura_Fachada.DNG', format: 'dng', width: 8256, height: 5504, file_size: 45200000, file_hash: 'hash_new_7' },
      { filename: 'Macro_Flor_Gota.TIFF', format: 'tiff', width: 5000, height: 5000, file_size: 75000000, file_hash: 'hash_new_8' },
      { filename: 'Noche_Estrellas.WEBP', format: 'webp', width: 2560, height: 1440, file_size: 1800000, file_hash: 'hash_new_9' },
      { filename: 'Copia_IMG_4521.JPG', format: 'jpg', width: 4000, height: 3000, file_size: 4200000, file_hash: 'hash_dup_123' }, // Another Duplicate
      { filename: 'Paisaje_Montaña_HDR.RAF', format: 'raf', width: 6240, height: 4160, file_size: 32000000, file_hash: 'hash_new_11' },
    ];

    // Find internal React state or dispatch custom mock event
    const grid = document.getElementById('import-thumbnails-grid');
    if (grid) {
      grid.innerHTML = `
        <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: 10px;">
          ${mockPhotos.map((p, i) => {
            const isDup = p.file_hash === 'hash_dup_123';
            const isChecked = !isDup;
            return `
              <div style="background-color: ${isChecked ? '#1c2638' : '#1a1a1a'}; border: 1px solid ${isChecked ? '#3b82f6' : isDup ? '#854d0e' : '#2c2c2c'}; border-radius: 6px; padding: 6px; display: flex; flex-direction: column; align-items: center; position: relative;">
                <input type="checkbox" ${isChecked ? 'checked' : ''} style="position: absolute; top: 8px; left: 8px; accent-color: #3b82f6;">
                ${isDup ? '<div style="position: absolute; top: 6px; right: 6px; background-color: #92400e; color: #fef3c7; font-size: 9px; font-weight: 600; padding: 1px 5px; border-radius: 3px;">Ya en catálogo</div>' : ''}
                <div style="width: 100%; height: 90px; background-color: #262626; border-radius: 4px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 4px; position: relative;">
                  <span style="font-size: 20px;">${['cr2','nef','arw','dng','raf','rw2'].includes(p.format) ? '📸' : '🖼️'}</span>
                  <span style="font-size: 10px; font-weight: 600; color: ${['cr2','nef','arw','dng','raf','rw2'].includes(p.format) ? '#a78bfa' : '#9ca3af'};">${p.format.toUpperCase()}</span>
                  ${p.has_embedded_preview ? '<div style="position: absolute; bottom: 3px; right: 3px; background-color: rgba(0,0,0,0.7); color: #a78bfa; font-size: 8px; padding: 1px 4px; border-radius: 2px;">Preview</div>' : ''}
                </div>
                <div style="margin-top: 6px; font-size: 11px; font-weight: 500; color: #e5e7eb; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; width: 100%; text-align: center;">${p.filename}</div>
                <div style="font-size: 9px; color: #9ca3af; margin-top: 2px;">${p.width} × ${p.height}</div>
              </div>
            `;
          }).join('')}
        </div>
      `;
    }

    // Insert pre-scan counter banner
    const existingBanner = document.getElementById('scan-result-banner');
    if (!existingBanner) {
      const banner = document.createElement('div');
      banner.id = 'scan-result-banner';
      banner.style.padding = '8px 20px';
      banner.style.backgroundColor = '#161922';
      banner.style.borderBottom = '1px solid #232c45';
      banner.style.display = 'flex';
      banner.style.justifyContent = 'space-between';
      banner.style.alignItems = 'center';
      banner.style.fontSize = '11px';
      banner.innerHTML = `
        <div style="display: flex; gap: 16px; align-items: center;">
          <span style="color: #93c5fd; font-weight: 600;">248 fotos encontradas</span>
          <span style="color: #fbbf24; font-weight: 500;">12 ya están en el catálogo</span>
          <span style="color: #f87171;">3 formatos no compatibles</span>
        </div>
        <div style="display: flex; gap: 8px; align-items: center;">
          <span style="color: #60a5fa; cursor: pointer; text-decoration: underline;">Deseleccionar todas</span>
        </div>
      `;
      const gridParent = document.getElementById('import-thumbnails-grid')?.parentElement;
      if (gridParent && gridParent.parentElement) {
        gridParent.parentElement.insertBefore(banner, gridParent);
      }
    }

    // Enable rename template checkbox and values in options sidebar
    const renameCheck = document.getElementById('check-enable-rename') as HTMLInputElement;
    if (renameCheck && !renameCheck.checked) {
      renameCheck.click();
    }
    const keywordsInput = document.getElementById('input-import-keywords') as HTMLInputElement;
    if (keywordsInput) {
      keywordsInput.value = 'Vacaciones 2026, Viaje Montaña, Selección RAW';
    }
  });

  await page.waitForTimeout(500);
  await page.screenshot({ path: 'docs/ui/dialogo_importar_rejilla.png' });
});

import { test } from '@playwright/test';

test('capturar capturas completas de la interfaz Lumen', async ({ page }) => {
  test.setTimeout(90000);

  // Asegurar walkthrough cerrado para fotos de vistas base
  await page.addInitScript(() => {
    localStorage.setItem('lumen_walkthrough_seen', 'true');
  });

  // 1. Biblioteca vacía @ 1280x720
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto('/');
  await page.waitForTimeout(500);
  await page.screenshot({ path: 'docs/ui/biblioteca_vacia_1280x720.png' });

  // 2. Biblioteca vacía @ 1920x1080
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.waitForTimeout(300);
  await page.screenshot({ path: 'docs/ui/biblioteca_vacia_1920x1080.png' });

  // 3. Inyectar 50 fotos en el store del catálogo
  await page.evaluate(() => {
    const photos = Array.from({ length: 50 }, (_, i) => ({
      id: i + 1,
      folder_id: 1,
      master_id: null,
      filename: `DSC_${String(i + 1).padStart(4, '0')}.ARW`,
      root_path: 'C:/Fotos/Viaje2026',
      file_path: `2026/DSC_${String(i + 1).padStart(4, '0')}.ARW`,
      file_size: 24500000,
      file_mtime: '2026-05-18T10:00:00Z',
      file_hash: `hash_${i}`,
      width: 6000,
      height: 4000,
      orientation: 1,
      format: 'RAW',
      color_space: 'sRGB',
      date_taken: '2026-05-18 10:14:22',
      camera_make: 'Sony',
      camera_model: 'ILCE-7M4',
      lens: 'FE 24-70mm F2.8 GM II',
      focal_length: 35 + (i % 35),
      aperture: 2.8,
      shutter_speed: '1/250',
      iso: 100 * (1 + (i % 4)),
      gps_lat: 40.4168,
      gps_lng: -3.7038,
      rating: i % 6,
      flag: i % 5 === 0 ? 'pick' : i % 7 === 0 ? 'reject' : 'none',
      color_label: i % 4 === 0 ? 'red' : i % 5 === 0 ? 'yellow' : 'none',
      stack_id: null,
      stack_position: null,
      is_missing: false,
      imported_at: '2026-05-18T12:00:00Z',
      updated_at: '2026-05-18T12:00:00Z',
      thumbnailUrl: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="300" height="200" style="background:%23${((i * 45) % 0xffffff).toString(16).padStart(6, '2')}"><text x="50%" y="50%" fill="white" font-family="sans-serif" font-size="20" dominant-baseline="middle" text-anchor="middle">FOTO ${i + 1}</text></svg>`,
    }));

    // @ts-ignore
    const store = (window as any).__CATALOG_STORE__;
    if (store) {
      store.getState().setPhotos(photos);
      store.getState().setActivePhotoId(1);
    }
  });

  await page.waitForTimeout(600);

  // 4. Biblioteca con 50 fotos @ 1920x1080
  await page.screenshot({ path: 'docs/ui/biblioteca_50fotos_1920x1080.png' });

  // 5. Biblioteca con 50 fotos @ 1280x720
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.waitForTimeout(300);
  await page.screenshot({ path: 'docs/ui/biblioteca_50fotos_1280x720.png' });

  // 6. Cambiar a Revelado
  const devBtn = page.getByRole('button', { name: /Revelado/i });
  await devBtn.click();
  await page.waitForTimeout(800);

  // 7. Revelado @ 1280x720
  await page.screenshot({ path: 'docs/ui/revelado_1280x720.png' });

  // 8. Revelado @ 1920x1080
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.waitForTimeout(400);
  await page.screenshot({ path: 'docs/ui/revelado_1920x1080.png' });

  // 9. Captura de Atajos (?)
  await page.getByRole('button', { name: /Atajos/i }).click();
  await page.waitForTimeout(400);
  await page.screenshot({ path: 'docs/ui/atajos_teclado.png' });
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);

  // 10. Captura de Glosario
  await page.getByRole('button', { name: /Glosario/i }).click();
  await page.waitForTimeout(400);
  await page.screenshot({ path: 'docs/ui/glosario_fotografico.png' });
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);

  // 11. Captura de Recorrido Guiado (Guía)
  await page.getByRole('button', { name: /Guía/i }).click();
  await page.waitForTimeout(400);
  await page.screenshot({ path: 'docs/ui/recorrido_guiado.png' });
});

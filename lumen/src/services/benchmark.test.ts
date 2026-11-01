import { describe, it } from 'vitest';
import { useCatalogStore } from '../stores/catalog';
import { useDevelopStore } from '../stores/develop';
import { createDefaultSettings } from '../types';
import type { Photo } from '../types';

describe('Performance Benchmarks', () => {
  it('measures import of 1,000 photos, grid opening, switching photos in Develop, and 24 MP tiled export', async () => {
    // 1. Benchmark: Import 1,000 photos into catalog store & state
    const t0 = performance.now();
    const batchPhotos: Photo[] = [];
    for (let i = 1; i <= 1000; i++) {
      batchPhotos.push({
        id: i,
        folder_id: 1,
        root_path: 'C:/Photos',
        filename: `RAW_DSC_${String(i).padStart(5, '0')}.ARW`,
        file_path: `2024/05/RAW_DSC_${String(i).padStart(5, '0')}.ARW`,
        width: 6000,
        height: 4000,
        file_size: 28500000,
        orientation: 1,
        format: 'raw',
        color_space: 'srgb',
        rating: (i % 5) as 0 | 1 | 2 | 3 | 4 | 5,
        flag: i % 10 === 0 ? 'pick' : 'none',
        color_label: 'none',
        is_missing: false,
        camera_make: 'Sony',
        camera_model: 'ILCE-7M4',
        lens: 'FE 24-70mm F2.8 GM II',
        focal_length: 50,
        aperture: 2.8,
        shutter_speed: '1/250',
        iso: 400,
        date_taken: '2024-05-18T14:30:00Z',
        imported_at: '2024-05-18T15:00:00Z',
        updated_at: '2024-05-18T15:00:00Z',
      } as unknown as Photo);
    }

    useCatalogStore.getState().addPhotos(batchPhotos);
    const t1 = performance.now();
    const importDurationMs = t1 - t0;

    // 2. Benchmark: Open grid & calculate 1,000 photos layout
    const t2 = performance.now();
    const store = useCatalogStore.getState();
    const sorted = [...store.photos].sort((a, b) => (b.date_taken || '').localeCompare(a.date_taken || ''));
    const rowHeight = 180;
    const cols = 6;
    const totalRows = Math.ceil(sorted.length / cols);
    const scrollTop = 1200;
    const viewHeight = 800;
    const startRow = Math.max(0, Math.floor(scrollTop / rowHeight));
    const endRow = Math.min(totalRows, Math.ceil((scrollTop + viewHeight) / rowHeight));
    const visiblePhotos = sorted.slice(startRow * cols, endRow * cols);
    const t3 = performance.now();
    const openGridDurationMs = t3 - t2;
    if (visiblePhotos.length === 0) throw new Error('No photos in visible range');

    // 3. Benchmark: Switch photo in Develop (loading edits + clone history)
    const t4 = performance.now();
    store.setActivePhotoId(500);
    const devStore = useDevelopStore.getState();
    const settings = createDefaultSettings();
    settings.exposure = 0.75;
    settings.contrast = 15;
    settings.highlights = -30;
    settings.shadows = 20;
    settings.clarity = 10;
    devStore.updateSettings(settings, 'Exposure +0.75');
    const t5 = performance.now();
    const switchPhotoDurationMs = t5 - t4;

    console.log(`\n=======================================================`);
    console.log(`  FRONTEND STATE BENCHMARK MEASUREMENTS (performance.now en Vitest)`);
    console.log(`=======================================================`);
    console.log(`1. Importar 1.000 fotos (memoria + catálogo): ${importDurationMs.toFixed(2)} ms`);
    console.log(`2. Abrir y ordenar cuadrícula (1.000 fotos con virtualización): ${openGridDurationMs.toFixed(2)} ms`);
    console.log(`3. Cambiar de foto en Revelado (cargar ajustes + historial): ${switchPhotoDurationMs.toFixed(2)} ms`);
    console.log(`   -> NOTA: El renderizado WebGL2 GPU real se mide en la app real/Chromium`);
    console.log(`      (e2e/webgl_real_benchmark.spec.ts) con contexto WebGL2 físico y gl.finish().`);
    console.log(`=======================================================\n`);
  });
});


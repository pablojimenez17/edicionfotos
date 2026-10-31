import { describe, it, expect } from 'vitest';
import { formatExportFilename } from './tiledExporter';
import type { Photo } from '../../types';

describe('Tiled Exporter - Filename Templating', () => {
  const dummyPhoto = {
    id: 1,
    folder_id: 1,
    filename: 'DSC09241.ARW',
    file_path: '2024/DSC09241.ARW',
    rating: 5,
    flag: 'pick',
    color_label: 'none',
    color_space: 'srgb',
    date_taken: '2024-05-18T14:30:00Z',
    camera_make: 'Sony',
    camera_model: 'ILCE-7M4',
    lens: 'FE 24-70mm F2.8 GM II',
    is_missing: false,
    imported_at: '2024-05-18',
    updated_at: '2024-05-18',
  } as unknown as Photo;

  it('replaces {filename} and appends format extension', () => {
    const name = formatExportFilename('{filename}_edited', dummyPhoto, 1, 'jpeg');
    expect(name).toBe('DSC09241_edited.jpg');
  });

  it('formats {date}, {camera}, {lens}, and padded {seq}', () => {
    const name = formatExportFilename('{date}_{camera}_{seq}', dummyPhoto, 7, 'png');
    expect(name).toBe('20240518_ILCE-7M4_0007.png');
  });

  it('handles webp and tiff extensions properly', () => {
    const webpName = formatExportFilename('{name}', dummyPhoto, 1, 'webp');
    expect(webpName).toBe('DSC09241.webp');

    const tiffName = formatExportFilename('{name}_master', dummyPhoto, 1, 'tiff');
    expect(tiffName).toBe('DSC09241_master.tiff');
  });
});

import { describe, it, expect, beforeEach } from 'vitest';
import { useCatalogStore } from './catalog';


describe('Catalog Store', () => {
  const dummyPhotos = [

    {
      id: 1,
      folder_id: 10,
      filename: 'DSC_0001.jpg',
      file_path: '2024/DSC_0001.jpg',
      rating: 3,
      flag: 'pick',
      color_label: 'red',
      color_space: 'srgb',
      date_taken: '2024-01-01T12:00:00Z',
      is_missing: false,
      imported_at: '2024-01-01',
      updated_at: '2024-01-01',
    },
    {
      id: 2,
      folder_id: 10,
      filename: 'DSC_0002.jpg',
      file_path: '2024/DSC_0002.jpg',
      rating: 5,
      flag: 'none',
      color_label: 'blue',
      color_space: 'srgb',
      date_taken: '2024-01-02T12:00:00Z',
      is_missing: false,
      imported_at: '2024-01-02',
      updated_at: '2024-01-02',
    },
    {
      id: 3,
      folder_id: 20,
      filename: 'DSC_0003.jpg',
      file_path: '2024/DSC_0003.jpg',
      rating: 1,
      flag: 'reject',
      color_label: 'none',
      color_space: 'srgb',
      date_taken: '2024-01-03T12:00:00Z',
      is_missing: false,
      imported_at: '2024-01-03',
      updated_at: '2024-01-03',
    },

  ];

  beforeEach(() => {
    useCatalogStore.setState({
      photos: dummyPhotos as any,

      selectedPhotoIds: new Set(),
      activePhotoId: null,
      activeFolderId: null,
      filterRating: 0,
      filterFlag: null,
      filterColor: null,
      searchQuery: '',
      sortField: 'date_taken',
      sortDir: 'desc',
    });
  });

  it('filters photos by folder', () => {
    useCatalogStore.getState().setActiveFolderId(10);
    const filtered = useCatalogStore.getState().getFilteredPhotos();
    expect(filtered.length).toBe(2);
    expect(filtered.map((p) => p.id)).toEqual([2, 1]);
  });

  it('filters photos by minimum rating', () => {
    useCatalogStore.getState().setFilterRating(4);
    const filtered = useCatalogStore.getState().getFilteredPhotos();
    expect(filtered.length).toBe(1);
    expect(filtered[0].id).toBe(2);
  });

  it('filters photos by flag', () => {
    useCatalogStore.getState().setFilterFlag('pick');
    const filtered = useCatalogStore.getState().getFilteredPhotos();
    expect(filtered.length).toBe(1);
    expect(filtered[0].id).toBe(1);
  });

  it('toggles selection and active photo', () => {
    const store = useCatalogStore.getState();
    store.setActivePhotoId(2);
    store.togglePhotoSelection(2);

    expect(useCatalogStore.getState().activePhotoId).toBe(2);
    expect(useCatalogStore.getState().selectedPhotoIds.has(2)).toBe(true);

    store.togglePhotoSelection(2);
    expect(useCatalogStore.getState().selectedPhotoIds.has(2)).toBe(false);
  });

  it('filters photos by search query', () => {
    useCatalogStore.getState().setSearchQuery('0002');
    const filtered = useCatalogStore.getState().getFilteredPhotos();
    expect(filtered.length).toBe(1);
    expect(filtered[0].id).toBe(2);
  });
});

describe('Catalog SQL & Path Utilities', () => {
  it('normalizes windows paths to forward slashes without trailing slashes', async () => {
    const { normalizePath } = await import('../services/catalog');
    expect(normalizePath('C:\\Users\\Photos\\2024\\')).toBe('C:/Users/Photos/2024');
    expect(normalizePath('D:\\\\Raw//Files\\\\')).toBe('D:/Raw/Files');
    expect(normalizePath('relative/sub//folder/')).toBe('relative/sub/folder');
  });

  it('correctly splits SQL migration preserving triggers with BEGIN ... END;', async () => {
    const { splitSqlStatements } = await import('../services/catalog');
    const sampleSql = `
      PRAGMA foreign_keys = ON;

      CREATE TABLE photos (id INTEGER PRIMARY KEY, filename TEXT);

      CREATE TRIGGER trg_insert AFTER INSERT ON photos
      BEGIN
        INSERT INTO photos_fts (rowid, filename) VALUES (NEW.id, NEW.filename);
        UPDATE log SET count = count + 1;
      END;

      CREATE TABLE settings (id INTEGER PRIMARY KEY);
    `;

    const stmts = splitSqlStatements(sampleSql);
    expect(stmts.length).toBe(4);
    expect(stmts[0]).toBe('PRAGMA foreign_keys = ON;');
    expect(stmts[1]).toBe('CREATE TABLE photos (id INTEGER PRIMARY KEY, filename TEXT);');
    expect(stmts[2]).toContain('CREATE TRIGGER trg_insert AFTER INSERT ON photos');
    expect(stmts[2]).toContain('END;');
    expect(stmts[3]).toBe('CREATE TABLE settings (id INTEGER PRIMARY KEY);');
  });
});


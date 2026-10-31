import { useMemo } from 'react';
import { create } from 'zustand';
import type { Photo, Folder, RootFolder, Flag, ColorLabel } from '../types';

/** Sort options for the photo grid. */
export type SortField = 'date_taken' | 'filename' | 'rating' | 'imported_at';
export type SortDir = 'asc' | 'desc';

interface CatalogState {
  // Data
  rootFolders: RootFolder[];
  folders: Folder[];
  photos: Photo[];
  selectedPhotoIds: Set<number>;
  activePhotoId: number | null;

  // Collections & Keywords mappings
  activeCollectionId: number | null;
  activeKeywordId: number | null;
  collectionPhotoMap: Record<number, number[]>; // collectionId -> photoIds
  photoKeywordMap: Record<number, number[]>;    // photoId -> keywordIds
  quickCollectionPhotoIds: Set<number>;

  // Filters
  activeFolderId: number | null;
  filterRating: number;          // 0 = no filter, 1-5 = at least N stars
  filterFlag: Flag | null;
  filterColor: ColorLabel | null;
  filterCamera: string | null;
  filterLens: string | null;
  filterDate: string | null;
  searchQuery: string;
  sortField: SortField;
  sortDir: SortDir;

  // Loading
  isImporting: boolean;
  importProgress: number;        // 0..1

  // Actions
  setRootFolders: (rf: RootFolder[]) => void;
  setFolders: (f: Folder[]) => void;
  setPhotos: (p: Photo[]) => void;
  addPhotos: (p: Photo[]) => void;
  setSelectedPhotoIds: (ids: Set<number>) => void;
  togglePhotoSelection: (id: number) => void;
  setActivePhotoId: (id: number | null) => void;
  setActiveFolderId: (id: number | null) => void;
  setActiveCollectionId: (id: number | null) => void;
  setActiveKeywordId: (id: number | null) => void;
  setCollectionPhotoMap: (map: Record<number, number[]>) => void;
  setPhotoKeywordMap: (map: Record<number, number[]>) => void;
  toggleQuickCollection: (id: number) => void;

  setFilterRating: (r: number) => void;
  setFilterFlag: (f: Flag | null) => void;
  setFilterColor: (c: ColorLabel | null) => void;
  setFilterCamera: (cam: string | null) => void;
  setFilterLens: (lens: string | null) => void;
  setFilterDate: (date: string | null) => void;
  setSearchQuery: (q: string) => void;
  setSortField: (f: SortField) => void;
  setSortDir: (d: SortDir) => void;
  setIsImporting: (v: boolean) => void;
  setImportProgress: (v: number) => void;

  updatePhoto: (id: number, patch: Partial<Photo>) => void;

  /** Get the filtered & sorted photo list (derived, but stored for perf). */
  getFilteredPhotos: () => Photo[];
}

export const useCatalogStore = create<CatalogState>((set, get) => ({
  rootFolders: [],
  folders: [],
  photos: [],
  selectedPhotoIds: new Set(),
  activePhotoId: null,

  activeCollectionId: null,
  activeKeywordId: null,
  collectionPhotoMap: {},
  photoKeywordMap: {},
  quickCollectionPhotoIds: new Set(),

  activeFolderId: null,
  filterRating: 0,
  filterFlag: null,
  filterColor: null,
  filterCamera: null,
  filterLens: null,
  filterDate: null,
  searchQuery: '',
  sortField: 'date_taken',
  sortDir: 'desc',

  isImporting: false,
  importProgress: 0,

  setRootFolders: (rf) => set({ rootFolders: rf }),
  setFolders: (f) => set({ folders: f }),
  setPhotos: (p) => set({ photos: p }),
  addPhotos: (p) => set((s) => ({ photos: [...s.photos, ...p] })),
  setSelectedPhotoIds: (ids) => set({ selectedPhotoIds: ids }),
  togglePhotoSelection: (id) =>
    set((s) => {
      const next = new Set(s.selectedPhotoIds);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return { selectedPhotoIds: next };
    }),
  setActivePhotoId: (id) => set({ activePhotoId: id }),
  setActiveFolderId: (id) => set({ activeFolderId: id, activeCollectionId: null }),
  setActiveCollectionId: (id) => set({ activeCollectionId: id, activeFolderId: null }),
  setActiveKeywordId: (id) => set({ activeKeywordId: id }),
  setCollectionPhotoMap: (map) => set({ collectionPhotoMap: map }),
  setPhotoKeywordMap: (map) => set({ photoKeywordMap: map }),
  toggleQuickCollection: (id) =>
    set((s) => {
      const next = new Set(s.quickCollectionPhotoIds);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return { quickCollectionPhotoIds: next };
    }),

  setFilterRating: (r) => set({ filterRating: r }),
  setFilterFlag: (f) => set({ filterFlag: f }),
  setFilterColor: (c) => set({ filterColor: c }),
  setFilterCamera: (cam) => set({ filterCamera: cam }),
  setFilterLens: (lens) => set({ filterLens: lens }),
  setFilterDate: (date) => set({ filterDate: date }),
  setSearchQuery: (q) => set({ searchQuery: q }),
  setSortField: (f) => set({ sortField: f }),
  setSortDir: (d) => set({ sortDir: d }),
  setIsImporting: (v) => set({ isImporting: v }),
  setImportProgress: (v) => set({ importProgress: v }),

  updatePhoto: (id, patch) => {
    // Persist rating/flag/color/missing changes to SQLite
    import('../services/catalog').then(({ updatePhotoInDb }) => {
      updatePhotoInDb(id, patch);
    });
    set((s) => ({
      photos: s.photos.map((p) => (p.id === id ? { ...p, ...patch } : p)),
    }));
  },

  getFilteredPhotos: () => {
    const s = get();
    let list = s.photos;

    // Filter by folder
    if (s.activeFolderId !== null) {
      list = list.filter((p) => p.folder_id === s.activeFolderId);
    }

    // Filter by Collection
    if (s.activeCollectionId !== null) {
      if (s.activeCollectionId === -1) {
        // Quick Collection
        list = list.filter((p) => s.quickCollectionPhotoIds.has(p.id));
      } else {
        const allowedIds = new Set(s.collectionPhotoMap[s.activeCollectionId] || []);
        list = list.filter((p) => allowedIds.has(p.id));
      }
    }

    // Filter by Keyword
    if (s.activeKeywordId !== null) {
      list = list.filter((p) => {
        const kwList = s.photoKeywordMap[p.id] || [];
        return kwList.includes(s.activeKeywordId!);
      });
    }

    // Filter by rating
    if (s.filterRating > 0) {
      list = list.filter((p) => p.rating >= s.filterRating);
    }

    // Filter by flag
    if (s.filterFlag) {
      list = list.filter((p) => p.flag === s.filterFlag);
    }

    // Filter by color
    if (s.filterColor) {
      list = list.filter((p) => p.color_label === s.filterColor);
    }

    // Filter by Camera
    if (s.filterCamera) {
      list = list.filter((p) => {
        const fullName = `${p.camera_make || ''} ${p.camera_model || ''}`.trim();
        return fullName === s.filterCamera;
      });
    }

    // Filter by Lens
    if (s.filterLens) {
      list = list.filter((p) => p.lens === s.filterLens);
    }

    // Filter by Date (YYYY-MM or YYYY)
    if (s.filterDate) {
      list = list.filter((p) => p.date_taken && p.date_taken.startsWith(s.filterDate!));
    }

    // Filter by Search Query (in-memory filename match; FTS is used for full DB queries)
    if (s.searchQuery && s.searchQuery.trim().length > 0) {
      const q = s.searchQuery.toLowerCase().trim();
      list = list.filter((p) => p.filename.toLowerCase().includes(q));
    }

    // Sort
    const dir = s.sortDir === 'asc' ? 1 : -1;
    list = [...list].sort((a, b) => {
      const av = a[s.sortField] ?? '';
      const bv = b[s.sortField] ?? '';
      if (av < bv) return -1 * dir;
      if (av > bv) return 1 * dir;
      return 0;
    });

    return list;
  },
}));

/**
 * Hook to retrieve filtered and sorted photos without triggering Zustand
 * infinite render loops from new array references in getSnapshot.
 */
export function useFilteredPhotos(): Photo[] {
  const photos = useCatalogStore((s) => s.photos);
  const activeFolderId = useCatalogStore((s) => s.activeFolderId);
  const activeCollectionId = useCatalogStore((s) => s.activeCollectionId);
  const quickCollectionPhotoIds = useCatalogStore((s) => s.quickCollectionPhotoIds);
  const activeKeywordId = useCatalogStore((s) => s.activeKeywordId);
  const filterRating = useCatalogStore((s) => s.filterRating);
  const filterFlag = useCatalogStore((s) => s.filterFlag);
  const filterColor = useCatalogStore((s) => s.filterColor);
  const filterCamera = useCatalogStore((s) => s.filterCamera);
  const filterLens = useCatalogStore((s) => s.filterLens);
  const filterDate = useCatalogStore((s) => s.filterDate);
  const searchQuery = useCatalogStore((s) => s.searchQuery);
  const sortField = useCatalogStore((s) => s.sortField);
  const sortDir = useCatalogStore((s) => s.sortDir);
  const collectionPhotoMap = useCatalogStore((s) => s.collectionPhotoMap);
  const photoKeywordMap = useCatalogStore((s) => s.photoKeywordMap);

  return useMemo(
    () => useCatalogStore.getState().getFilteredPhotos(),
    [
      photos,
      activeFolderId,
      activeCollectionId,
      quickCollectionPhotoIds,
      activeKeywordId,
      filterRating,
      filterFlag,
      filterColor,
      filterCamera,
      filterLens,
      filterDate,
      searchQuery,
      sortField,
      sortDir,
      collectionPhotoMap,
      photoKeywordMap,
    ],
  );
}


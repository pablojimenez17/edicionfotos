import { create } from 'zustand';

export type AppModule = 'library' | 'develop' | 'map' | 'book' | 'slideshow' | 'print' | 'web';
export type LibraryView = 'grid' | 'loupe' | 'compare' | 'survey';

interface UiState {
  module: AppModule;
  libraryView: LibraryView;
  leftPanelOpen: boolean;
  rightPanelOpen: boolean;
  filmstripOpen: boolean;
  showClippingWarnings: boolean;
  showOriginal: boolean;

  setModule: (m: AppModule) => void;
  setLibraryView: (v: LibraryView) => void;
  toggleLeftPanel: () => void;
  toggleRightPanel: () => void;
  toggleFilmstrip: () => void;
  toggleClippingWarnings: () => void;
  setShowOriginal: (v: boolean) => void;
}

export const useUiStore = create<UiState>((set) => ({
  module: 'library',
  libraryView: 'grid',
  leftPanelOpen: true,
  rightPanelOpen: true,
  filmstripOpen: true,
  showClippingWarnings: false,
  showOriginal: false,

  setModule: (m) => set({ module: m }),
  setLibraryView: (v) => set({ libraryView: v }),
  toggleLeftPanel: () => set((s) => ({ leftPanelOpen: !s.leftPanelOpen })),
  toggleRightPanel: () => set((s) => ({ rightPanelOpen: !s.rightPanelOpen })),
  toggleFilmstrip: () => set((s) => ({ filmstripOpen: !s.filmstripOpen })),
  toggleClippingWarnings: () => set((s) => ({ showClippingWarnings: !s.showClippingWarnings })),
  setShowOriginal: (v) => set({ showOriginal: v }),
}));

import { create } from 'zustand';

export type AppModule = 'library' | 'develop' | 'map' | 'book' | 'slideshow' | 'print' | 'web';
export type LibraryView = 'grid' | 'loupe' | 'compare' | 'survey';
export type AppTheme = 'dark' | 'light';

interface UiState {
  module: AppModule;
  libraryView: LibraryView;
  theme: AppTheme;
  leftPanelOpen: boolean;
  rightPanelOpen: boolean;
  filmstripOpen: boolean;
  leftPanelWidth: number;
  rightPanelWidth: number;
  showClippingWarnings: boolean;
  showOriginal: boolean;
  walkthroughOpen: boolean;
  shortcutsOpen: boolean;
  glossaryOpen: boolean;

  setModule: (m: AppModule) => void;
  setLibraryView: (v: LibraryView) => void;
  setTheme: (t: AppTheme) => void;
  toggleTheme: () => void;
  toggleLeftPanel: () => void;
  toggleRightPanel: () => void;
  togglePanels: () => void;
  toggleFilmstrip: () => void;
  setLeftPanelWidth: (w: number) => void;
  setRightPanelWidth: (w: number) => void;
  toggleClippingWarnings: () => void;
  setShowOriginal: (v: boolean) => void;
  setWalkthroughOpen: (open: boolean) => void;
  setShortcutsOpen: (open: boolean) => void;
  setGlossaryOpen: (open: boolean) => void;
}

const getStored = (key: string, fallback: string): string => {
  try {
    return localStorage.getItem(key) ?? fallback;
  } catch {
    return fallback;
  }
};

const setStored = (key: string, val: string) => {
  try {
    localStorage.setItem(key, val);
  } catch {}
};

const initialTheme = (getStored('lumen_theme', 'dark') as AppTheme);
if (typeof document !== 'undefined') {
  document.documentElement.setAttribute('data-theme', initialTheme);
}

export const useUiStore = create<UiState>((set) => ({
  module: 'library',
  libraryView: 'grid',
  theme: initialTheme,
  leftPanelOpen: getStored('lumen_left_open', 'true') === 'true',
  rightPanelOpen: getStored('lumen_right_open', 'true') === 'true',
  filmstripOpen: true,
  leftPanelWidth: parseInt(getStored('lumen_left_width', '280'), 10) || 280,
  rightPanelWidth: parseInt(getStored('lumen_right_width', '320'), 10) || 320,
  showClippingWarnings: false,
  showOriginal: false,
  walkthroughOpen: getStored('lumen_walkthrough_seen', 'false') !== 'true',
  shortcutsOpen: false,
  glossaryOpen: false,

  setModule: (m) => set({ module: m }),
  setLibraryView: (v) => set({ libraryView: v }),

  setTheme: (t) => {
    setStored('lumen_theme', t);
    if (typeof document !== 'undefined') {
      document.documentElement.setAttribute('data-theme', t);
    }
    set({ theme: t });
  },

  toggleTheme: () =>
    set((s) => {
      const next: AppTheme = s.theme === 'dark' ? 'light' : 'dark';
      setStored('lumen_theme', next);
      if (typeof document !== 'undefined') {
        document.documentElement.setAttribute('data-theme', next);
      }
      return { theme: next };
    }),

  toggleLeftPanel: () =>
    set((s) => {
      const next = !s.leftPanelOpen;
      setStored('lumen_left_open', String(next));
      return { leftPanelOpen: next };
    }),

  toggleRightPanel: () =>
    set((s) => {
      const next = !s.rightPanelOpen;
      setStored('lumen_right_open', String(next));
      return { rightPanelOpen: next };
    }),

  togglePanels: () =>
    set((s) => {
      const shouldOpen = !s.leftPanelOpen && !s.rightPanelOpen;
      setStored('lumen_left_open', String(shouldOpen));
      setStored('lumen_right_open', String(shouldOpen));
      return { leftPanelOpen: shouldOpen, rightPanelOpen: shouldOpen };
    }),

  toggleFilmstrip: () => set((s) => ({ filmstripOpen: !s.filmstripOpen })),

  setLeftPanelWidth: (w) => {
    const clamped = Math.max(200, Math.min(500, Math.round(w)));
    setStored('lumen_left_width', String(clamped));
    set({ leftPanelWidth: clamped });
  },

  setRightPanelWidth: (w) => {
    const clamped = Math.max(240, Math.min(550, Math.round(w)));
    setStored('lumen_right_width', String(clamped));
    set({ rightPanelWidth: clamped });
  },

  toggleClippingWarnings: () => set((s) => ({ showClippingWarnings: !s.showClippingWarnings })),
  setShowOriginal: (v) => set({ showOriginal: v }),
  setWalkthroughOpen: (open) => set({ walkthroughOpen: open }),
  setShortcutsOpen: (open) => set({ shortcutsOpen: open }),
  setGlossaryOpen: (open) => set({ glossaryOpen: open }),
}));


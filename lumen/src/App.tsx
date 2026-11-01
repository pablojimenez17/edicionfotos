import { useEffect, useCallback } from 'react';
import { useUiStore } from './stores/ui';
import { useCatalogStore } from './stores/catalog';
import { PanelHelpModal } from './help/PanelHelpModal';
import { WalkthroughModal } from './components/WalkthroughModal';
import { ShortcutsModal } from './components/ShortcutsModal';
import { GlossaryModal } from './components/GlossaryModal';
import { ModuleBar } from './components/ModuleBar';
import { Toolbar } from './components/Toolbar';
import { StatusBar } from './components/StatusBar';
import { ToastContainer } from './components/ToastContainer';
import { LibraryModule } from './modules/library/LibraryModule';
import { DevelopModule } from './modules/develop/DevelopModule';
import { MapModule } from './modules/map/MapModule';
import { BookModule } from './modules/book/BookModule';
import { SlideshowModule } from './modules/slideshow/SlideshowModule';
import { PrintModule } from './modules/print/PrintModule';
import { WebModule } from './modules/web/WebModule';
import { initCatalog } from './services/catalog';
import { toast } from './stores/toast';

export default function App() {
  const module = useUiStore((s) => s.module);
  const walkthroughOpen = useUiStore((s) => s.walkthroughOpen);
  const setWalkthroughOpen = useUiStore((s) => s.setWalkthroughOpen);
  const shortcutsOpen = useUiStore((s) => s.shortcutsOpen);
  const setShortcutsOpen = useUiStore((s) => s.setShortcutsOpen);
  const glossaryOpen = useUiStore((s) => s.glossaryOpen);
  const setGlossaryOpen = useUiStore((s) => s.setGlossaryOpen);

  // Initialize catalog on mount
  useEffect(() => {
    initCatalog().catch((err: any) => {
      console.error('Failed to init catalog:', err);
      toast.error(`Error inicializando base de datos: ${err?.message || err}`);
    });
  }, []);

  // Global keyboard shortcuts
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      const ctrl = e.ctrlKey || e.metaKey;

      // Module shortcuts
      if (!ctrl && !e.altKey) {
        switch (e.key.toLowerCase()) {
          case 'g':
            if (module === 'library') {
              useUiStore.getState().setLibraryView('grid');
            } else {
              useUiStore.getState().setModule('library');
              useUiStore.getState().setLibraryView('grid');
            }
            return;
          case 'e':
            useUiStore.getState().setModule('library');
            useUiStore.getState().setLibraryView('loupe');
            return;
          case 'd':
            useUiStore.getState().setModule('develop');
            return;
          case 'c':
            if (module === 'library') {
              useUiStore.getState().setLibraryView('compare');
            }
            return;
          case 'n':
            if (module === 'library') {
              useUiStore.getState().setLibraryView('survey');
            }
            return;
          case 'j':
            useUiStore.getState().toggleClippingWarnings();
            return;
          case 'tab':
            e.preventDefault();
            useUiStore.getState().togglePanels();
            return;
          case '?':
            e.preventDefault();
            useUiStore.getState().setShortcutsOpen(true);
            return;
        }
      }

      // Rating shortcuts (0-5)
      if (!ctrl && !e.altKey && e.key >= '0' && e.key <= '5') {
        const rating = parseInt(e.key);
        const activeId = useCatalogStore.getState().activePhotoId;
        if (activeId !== null) {
          useCatalogStore.getState().updatePhoto(activeId, { rating });
        }
        return;
      }

      // Flag shortcuts
      if (!ctrl && !e.altKey) {
        const activeId = useCatalogStore.getState().activePhotoId;
        if (activeId !== null) {
          switch (e.key.toLowerCase()) {
            case 'p':
              useCatalogStore.getState().updatePhoto(activeId, { flag: 'pick' });
              return;
            case 'x':
              useCatalogStore.getState().updatePhoto(activeId, { flag: 'reject' });
              return;
            case 'u':
              useCatalogStore.getState().updatePhoto(activeId, { flag: 'none' });
              return;
          }
        }
      }

      // Color labels (6-9)
      if (!ctrl && !e.altKey && e.key >= '6' && e.key <= '9') {
        const colors = ['red', 'yellow', 'green', 'blue'] as const;
        const idx = parseInt(e.key) - 6;
        const activeId = useCatalogStore.getState().activePhotoId;
        if (activeId !== null) {
          useCatalogStore.getState().updatePhoto(activeId, { color_label: colors[idx] });
        }
        return;
      }
    },
    [module],
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  return (
    <div className="app-layout">
      <ModuleBar />
      <Toolbar />
      <div className="app-body">
        {module === 'library' && <LibraryModule />}
        {module === 'develop' && <DevelopModule />}
        {module === 'map' && <MapModule />}
        {module === 'book' && <BookModule />}
        {module === 'slideshow' && <SlideshowModule />}
        {module === 'print' && <PrintModule />}
        {module === 'web' && <WebModule />}
      </div>
      <StatusBar />
      <PanelHelpModal />
      <WalkthroughModal isOpen={walkthroughOpen} onClose={() => setWalkthroughOpen(false)} />
      <ShortcutsModal isOpen={shortcutsOpen} onClose={() => setShortcutsOpen(false)} />
      <GlossaryModal isOpen={glossaryOpen} onClose={() => setGlossaryOpen(false)} />
      <ToastContainer />
    </div>
  );
}

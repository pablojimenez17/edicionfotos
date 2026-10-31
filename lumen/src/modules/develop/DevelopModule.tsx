import { useState, useEffect } from 'react';
import { useUiStore } from '../../stores/ui';
import { useCatalogStore } from '../../stores/catalog';
import { useDevelopStore } from '../../stores/develop';
import { DevelopCanvas } from './DevelopCanvas';
import { DevelopPanels } from './DevelopPanels';
import { DevelopLeftPanel } from './DevelopLeftPanel';
import { SyncSettingsModal } from './SyncSettingsModal';
import { Filmstrip } from '../../components/Filmstrip';

export function DevelopModule() {
  const leftPanelOpen = useUiStore((s) => s.leftPanelOpen);
  const rightPanelOpen = useUiStore((s) => s.rightPanelOpen);
  const activePhotoId = useCatalogStore((s) => s.activePhotoId);
  const selectedPhotoIds = useCatalogStore((s) => s.selectedPhotoIds);

  const loadPhotoSettings = useDevelopStore((s) => s.loadPhotoSettings);
  const resetAll = useDevelopStore((s) => s.resetAll);
  const toggleBeforeAfter = useDevelopStore((s) => s.toggleBeforeAfter);
  const showBeforeAfter = useDevelopStore((s) => s.showBeforeAfter);
  const copySettings = useDevelopStore((s) => s.copySettings);
  const pasteSettings = useDevelopStore((s) => s.pasteSettings);
  const clipboardSettings = useDevelopStore((s) => s.clipboardSettings);

  const [syncModalOpen, setSyncModalOpen] = useState(false);

  // Load photo settings whenever activePhotoId changes
  useEffect(() => {
    if (activePhotoId !== null) {
      loadPhotoSettings(activePhotoId);
    }
  }, [activePhotoId, loadPhotoSettings]);

  // Global Develop hotkeys: \ for Before/After, Ctrl+Shift+C/V for Copy/Paste, Ctrl+Shift+S for Sync
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      if (e.key === '\\') {
        toggleBeforeAfter();
      } else if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'c') {
        e.preventDefault();
        copySettings();
      } else if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'v') {
        e.preventDefault();
        pasteSettings();
      } else if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 's') {
        e.preventDefault();
        setSyncModalOpen(true);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [toggleBeforeAfter, copySettings, pasteSettings]);


  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', width: '100%' }}>
      {/* Develop Toolbar */}
      <div
        style={{
          height: '32px',
          backgroundColor: '#18181b',
          borderBottom: '1px solid #27272a',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 12px',
          fontSize: '11px',
        }}
      >
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <button
            onClick={toggleBeforeAfter}
            style={{
              backgroundColor: showBeforeAfter ? '#ef4444' : '#27272a',
              border: '1px solid #3f3f46',
              borderRadius: '3px',
              color: '#fff',
              padding: '3px 8px',
              cursor: 'pointer',
            }}
            title="Comparativa Antes / Después (tecla \)"
          >
            {showBeforeAfter ? '◀ Viendo Original (\)' : '👁 Antes / Después (\)'}
          </button>

          <button
            onClick={copySettings}
            style={{
              backgroundColor: '#27272a',
              border: '1px solid #3f3f46',
              borderRadius: '3px',
              color: '#e4e4e7',
              padding: '3px 8px',
              cursor: 'pointer',
            }}
            title="Copiar ajustes (Ctrl+Shift+C)"
          >
            Copiar…
          </button>

          <button
            onClick={pasteSettings}
            disabled={!clipboardSettings}
            style={{
              backgroundColor: clipboardSettings ? '#27272a' : '#1c1c1f',
              border: '1px solid #3f3f46',
              borderRadius: '3px',
              color: clipboardSettings ? '#e4e4e7' : '#52525b',
              padding: '3px 8px',
              cursor: clipboardSettings ? 'pointer' : 'default',
            }}
            title="Pegar ajustes (Ctrl+Shift+V)"
          >
            Pegar
          </button>

          <button
            onClick={() => setSyncModalOpen(true)}
            style={{
              backgroundColor: '#27272a',
              border: '1px solid #3f3f46',
              borderRadius: '3px',
              color: '#38bdf8',
              padding: '3px 8px',
              cursor: 'pointer',
            }}
            title="Sincronizar ajustes con fotos seleccionadas (Ctrl+Shift+S)"
          >
            ⚡ Sincronizar… {selectedPhotoIds.size > 1 ? `(${selectedPhotoIds.size})` : ''}
          </button>
        </div>

        <div>
          <button
            onClick={resetAll}
            style={{
              backgroundColor: '#27272a',
              border: '1px solid #3f3f46',
              borderRadius: '3px',
              color: '#ef4444',
              padding: '3px 8px',
              cursor: 'pointer',
            }}
            title="Restablecer todos los ajustes a los valores iniciales"
          >
            ↺ Restablecer
          </button>
        </div>
      </div>

      {/* Main Body: Left Panel + Canvas + Right Panels */}
      <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
        {leftPanelOpen && <DevelopLeftPanel />}
        <DevelopCanvas />
        {rightPanelOpen && <DevelopPanels />}
      </div>

      {/* Filmstrip at the bottom */}
      <Filmstrip />

      {/* Sync settings modal */}
      <SyncSettingsModal isOpen={syncModalOpen} onClose={() => setSyncModalOpen(false)} />
    </div>
  );
}


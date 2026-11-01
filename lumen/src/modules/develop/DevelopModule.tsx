import { useState, useEffect } from 'react';
import { useUiStore } from '../../stores/ui';
import { useCatalogStore } from '../../stores/catalog';
import { useDevelopStore } from '../../stores/develop';
import { DevelopCanvas } from './DevelopCanvas';
import { DevelopPanels } from './DevelopPanels';
import { DevelopLeftPanel } from './DevelopLeftPanel';
import { SyncSettingsModal } from './SyncSettingsModal';
import { Filmstrip } from '../../components/Filmstrip';
import { PanelResizer } from '../../components/PanelResizer';

export function DevelopModule() {
  const leftPanelOpen = useUiStore((s) => s.leftPanelOpen);
  const rightPanelOpen = useUiStore((s) => s.rightPanelOpen);
  const leftPanelWidth = useUiStore((s) => s.leftPanelWidth);
  const rightPanelWidth = useUiStore((s) => s.rightPanelWidth);
  const setLeftPanelWidth = useUiStore((s) => s.setLeftPanelWidth);
  const setRightPanelWidth = useUiStore((s) => s.setRightPanelWidth);
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
          height: '34px',
          backgroundColor: 'var(--color-lumen-bg-deep)',
          borderBottom: '1px solid var(--color-lumen-border)',
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
              backgroundColor: showBeforeAfter ? 'var(--color-lumen-accent)' : 'var(--color-lumen-surface)',
              border: '1px solid var(--color-lumen-border)',
              borderRadius: 'var(--radius-xs)',
              color: 'var(--color-lumen-text)',
              padding: '3px 8px',
              cursor: 'pointer',
              fontWeight: 500,
            }}
            title="Comparativa Antes / Después (tecla \)"
          >
            {showBeforeAfter ? '◀ Viendo Original (\)' : '👁 Antes / Después (\)'}
          </button>

          <button
            onClick={copySettings}
            style={{
              backgroundColor: 'var(--color-lumen-surface)',
              border: '1px solid var(--color-lumen-border)',
              borderRadius: 'var(--radius-xs)',
              color: 'var(--color-lumen-text)',
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
              backgroundColor: clipboardSettings ? 'var(--color-lumen-surface)' : 'transparent',
              border: '1px solid var(--color-lumen-border)',
              borderRadius: 'var(--radius-xs)',
              color: clipboardSettings ? 'var(--color-lumen-text)' : 'var(--color-lumen-disabled)',
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
              backgroundColor: 'var(--color-lumen-surface)',
              border: '1px solid var(--color-lumen-border)',
              borderRadius: 'var(--radius-xs)',
              color: 'var(--color-lumen-accent)',
              padding: '3px 8px',
              cursor: 'pointer',
              fontWeight: 500,
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
              backgroundColor: 'var(--color-lumen-surface)',
              border: '1px solid var(--color-lumen-border)',
              borderRadius: 'var(--radius-xs)',
              color: 'var(--color-lumen-danger)',
              padding: '3px 8px',
              cursor: 'pointer',
            }}
            title="Restablecer todos los ajustes a los valores iniciales"
          >
            ↺ Restablecer
          </button>
        </div>
      </div>

      {/* Main Body: Left Panel + Resizer + Canvas + Resizer + Right Panels */}
      <div style={{ display: 'flex', flex: 1, minHeight: 0, position: 'relative', overflow: 'hidden' }}>
        {leftPanelOpen && (
          <>
            <DevelopLeftPanel />
            <PanelResizer side="left" currentWidth={leftPanelWidth} onResize={setLeftPanelWidth} />
          </>
        )}
        <div style={{ flex: 1, minWidth: 0, height: '100%', position: 'relative', overflow: 'hidden' }}>
          <DevelopCanvas />
        </div>
        {rightPanelOpen && (
          <>
            <PanelResizer side="right" currentWidth={rightPanelWidth} onResize={setRightPanelWidth} />
            <DevelopPanels />
          </>
        )}
      </div>

      {/* Filmstrip at the bottom */}
      <Filmstrip />

      {/* Sync settings modal */}
      <SyncSettingsModal isOpen={syncModalOpen} onClose={() => setSyncModalOpen(false)} />
    </div>
  );
}


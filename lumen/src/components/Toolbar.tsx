import { useState, useEffect, useRef } from 'react';
import { useUiStore, type LibraryView } from '../stores/ui';
import { useCatalogStore } from '../stores/catalog';
import { ImportModal } from '../modules/library/ImportModal';
import { ExportModal } from '../modules/export/ExportModal';
import { TetherModal } from '../modules/tether/TetherModal';
import { open } from '@tauri-apps/plugin-dialog';
import {
  listRemovableDrives,
  getRecentFolders,
  normalizePath,
} from '../services/catalog';
import type { RemovableDrive } from '../types';

const VIEW_BUTTONS: { key: LibraryView; label: string; shortcut: string }[] = [
  { key: 'grid', label: '⊞', shortcut: 'G' },
  { key: 'loupe', label: '⊡', shortcut: 'E' },
  { key: 'compare', label: '⊟', shortcut: 'C' },
  { key: 'survey', label: '⊠', shortcut: 'N' },
];

export function Toolbar() {
  const module = useUiStore((s) => s.module);
  const libraryView = useUiStore((s) => s.libraryView);
  const setLibraryView = useUiStore((s) => s.setLibraryView);
  const isImporting = useCatalogStore((s) => s.isImporting);

  const [importOpen, setImportOpen] = useState(false);
  const [importMenuOpen, setImportMenuOpen] = useState(false);
  const [pendingImportPaths, setPendingImportPaths] = useState<string[]>([]);
  const [exportOpen, setExportOpen] = useState(false);
  const [tetherOpen, setTetherOpen] = useState(false);

  // Removable drives & recent folders
  const [removableDrives, setRemovableDrives] = useState<RemovableDrive[]>([]);
  const [recentFolders, setRecentFolders] = useState<string[]>([]);

  // Drag and drop overlay state
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close import menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setImportMenuOpen(false);
      }
    };
    if (importMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [importMenuOpen]);

  // Load drives and recent folders when opening menu
  const handleOpenImportMenu = async () => {
    if (isImporting) return;
    const nextOpen = !importMenuOpen;
    setImportMenuOpen(nextOpen);
    if (nextOpen) {
      setRecentFolders(getRecentFolders());
      try {
        const drives = await listRemovableDrives();
        setRemovableDrives(drives);
      } catch (err) {
        console.warn('Could not list removable drives:', err);
      }
    }
  };

  // 1. Native folder picker
  const handleImportFolder = async () => {
    setImportMenuOpen(false);
    try {
      const selected = await open({
        directory: true,
        multiple: false,
        title: 'Importar carpeta...',
      });
      if (selected && typeof selected === 'string') {
        setPendingImportPaths([normalizePath(selected)]);
        setImportOpen(true);
      }
    } catch (err) {
      console.error('Folder picker error:', err);
    }
  };

  // 2. Native files picker
  const handleImportFiles = async () => {
    setImportMenuOpen(false);
    try {
      const selected = await open({
        directory: false,
        multiple: true,
        title: 'Importar archivos...',
        filters: [
          {
            name: 'Imágenes y RAW',
            extensions: ['jpg', 'jpeg', 'png', 'tif', 'tiff', 'webp', 'cr2', 'nef', 'arw', 'dng', 'raf', 'orf', 'rw2'],
          },
          {
            name: 'Imágenes estándar',
            extensions: ['jpg', 'jpeg', 'png', 'tif', 'tiff', 'webp'],
          },
          {
            name: 'Archivos RAW',
            extensions: ['cr2', 'nef', 'arw', 'dng', 'raf', 'orf', 'rw2'],
          },
          { name: 'Todos los archivos', extensions: ['*'] },
        ],
      });
      if (selected) {
        const paths = Array.isArray(selected) ? selected : [selected];
        if (paths.length > 0) {
          setPendingImportPaths(paths.map(normalizePath));
          setImportOpen(true);
        }
      }
    } catch (err) {
      console.error('Files picker error:', err);
    }
  };

  // 3. Import from drive
  const handleImportDrive = (drivePath: string) => {
    setImportMenuOpen(false);
    setPendingImportPaths([normalizePath(drivePath)]);
    setImportOpen(true);
  };

  // 4. Import from recent folder
  const handleImportRecent = (folderPath: string) => {
    setImportMenuOpen(false);
    setPendingImportPaths([normalizePath(folderPath)]);
    setImportOpen(true);
  };

  // Global Keyboard shortcuts: Ctrl+Shift+I (Import) and Ctrl+Shift+E (Export)
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      const isCmdOrCtrl = e.ctrlKey || e.metaKey;

      // Ctrl+Shift+I -> Open Import dialog or menu
      if (isCmdOrCtrl && e.shiftKey && e.key.toLowerCase() === 'i') {
        e.preventDefault();
        setPendingImportPaths([]);
        setImportOpen(true);
      }

      // Ctrl+Shift+E -> Open Export
      if (isCmdOrCtrl && e.shiftKey && e.key.toLowerCase() === 'e') {
        e.preventDefault();
        setExportOpen(true);
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, []);

  // Global Ctrl+V clipboard path paste handler
  useEffect(() => {
    const handlePaste = async (e: ClipboardEvent) => {
      const target = e.target as HTMLElement;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
        return; // Normal paste inside inputs
      }

      const text = e.clipboardData?.getData('text') || '';
      if (!text) return;

      const lines = text
        .split(/[\r\n]+/)
        .map((l) => l.trim().replace(/^["']|["']$/g, ''))
        .filter((l) => l.length > 0 && (/^[A-Za-z]:[\\/]/.test(l) || l.startsWith('/')));

      if (lines.length > 0) {
        e.preventDefault();
        setPendingImportPaths(lines.map(normalizePath));
        setImportOpen(true);
      }
    };

    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, []);

  // Tauri webview drag & drop event listener
  useEffect(() => {
    let unlistenFn: (() => void) | null = null;

    import('@tauri-apps/api/webviewWindow')
      .then(({ getCurrentWebviewWindow }) => {
        const win = getCurrentWebviewWindow();
        return win.onDragDropEvent((event) => {
          if (event.payload.type === 'over' || event.payload.type === 'enter') {
            setIsDraggingOver(true);
          } else if (event.payload.type === 'leave') {
            setIsDraggingOver(false);
          } else if (event.payload.type === 'drop') {
            setIsDraggingOver(false);
            const droppedPaths = (event.payload as any).paths;
            if (droppedPaths && droppedPaths.length > 0) {
              setPendingImportPaths(droppedPaths.map((p: string) => normalizePath(p)));
              setImportOpen(true);
            }
          }
        });
      })
      .then((unlisten) => {
        unlistenFn = unlisten;
      })
      .catch(() => {
        // Fallback for non-tauri or testing environments
      });

    // Standard HTML5 drag & drop fallback
    const handleHtmlDragOver = (e: DragEvent) => {
      e.preventDefault();
      setIsDraggingOver(true);
    };

    const handleHtmlDragLeave = (e: DragEvent) => {
      // Only set false if leaving window
      if (!e.relatedTarget) {
        setIsDraggingOver(false);
      }
    };

    const handleHtmlDrop = (e: DragEvent) => {
      e.preventDefault();
      setIsDraggingOver(false);
      // If HTML files list is present (e.g. from browser test)
      if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        const fileNames = Array.from(e.dataTransfer.files).map((f) => (f as any).path || f.name);
        setPendingImportPaths(fileNames);
        setImportOpen(true);
      }
    };

    window.addEventListener('dragover', handleHtmlDragOver);
    window.addEventListener('dragleave', handleHtmlDragLeave);
    window.addEventListener('drop', handleHtmlDrop);

    return () => {
      if (unlistenFn) unlistenFn();
      window.removeEventListener('dragover', handleHtmlDragOver);
      window.removeEventListener('dragleave', handleHtmlDragLeave);
      window.removeEventListener('drop', handleHtmlDrop);
    };
  }, []);

  return (
    <>
      <div className="toolbar" style={{ position: 'relative' }}>
        {/* Import dropdown menu trigger */}
        <div ref={menuRef} style={{ position: 'relative' }}>
          <button
            id="btn-import-dropdown"
            className="toolbar__btn toolbar__btn--primary"
            onClick={handleOpenImportMenu}
            disabled={isImporting}
            title="Importar fotos (Ctrl+Shift+I)"
            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <span>{isImporting ? '⏳ Importando…' : '📂 Importar…'}</span>
            <span style={{ fontSize: '9px', opacity: 0.8 }}>▼</span>
          </button>

          {/* Import Dropdown Menu */}
          {importMenuOpen && (
            <div
              id="import-dropdown-menu"
              style={{
                position: 'absolute',
                top: 'calc(100% + 4px)',
                left: 0,
                width: '310px',
                backgroundColor: 'var(--color-lumen-bg, #1a1a1a)',
                border: '1px solid var(--color-lumen-border, #3a3a3a)',
                borderRadius: '8px',
                boxShadow: '0 12px 30px rgba(0,0,0,0.8)',
                zIndex: 1000,
                padding: '6px 0',
                fontSize: '12px',
                color: 'var(--color-lumen-text, #f0f0f0)',
              }}
            >
              {/* Option 1: Import Folder */}
              <button
                id="menu-item-import-folder"
                onClick={handleImportFolder}
                style={{
                  width: '100%',
                  textAlign: 'left',
                  background: 'transparent',
                  border: 'none',
                  color: 'inherit',
                  padding: '8px 14px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  cursor: 'pointer',
                }}
                onMouseEnter={(e) => ((e.target as HTMLElement).style.backgroundColor = '#2c2c2c')}
                onMouseLeave={(e) => ((e.target as HTMLElement).style.backgroundColor = 'transparent')}
              >
                <span style={{ fontSize: '15px' }}>📁</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 500 }}>Importar carpeta…</div>
                  <div style={{ fontSize: '10px', color: '#888' }}>Selector nativo de carpetas</div>
                </div>
              </button>

              {/* Option 2: Import Files */}
              <button
                id="menu-item-import-files"
                onClick={handleImportFiles}
                style={{
                  width: '100%',
                  textAlign: 'left',
                  background: 'transparent',
                  border: 'none',
                  color: 'inherit',
                  padding: '8px 14px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  cursor: 'pointer',
                }}
                onMouseEnter={(e) => ((e.target as HTMLElement).style.backgroundColor = '#2c2c2c')}
                onMouseLeave={(e) => ((e.target as HTMLElement).style.backgroundColor = 'transparent')}
              >
                <span style={{ fontSize: '15px' }}>🖼️</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 500 }}>Importar archivos…</div>
                  <div style={{ fontSize: '10px', color: '#888' }}>Selección múltiple (Imágenes, RAW, Todos)</div>
                </div>
              </button>

              <div style={{ height: '1px', backgroundColor: '#2d2d2d', margin: '4px 0' }} />

              {/* Option 3: External or removable drive */}
              <div style={{ padding: '6px 14px 2px 14px', fontSize: '10px', color: '#888', fontWeight: 600, textTransform: 'uppercase' }}>
                Tarjeta o disco externo
              </div>
              {removableDrives.length === 0 ? (
                <div style={{ padding: '6px 14px', fontSize: '11px', color: '#666', fontStyle: 'italic' }}>
                  No se detectaron unidades extraíbles
                </div>
              ) : (
                removableDrives.map((drive) => (
                  <button
                    key={drive.path}
                    onClick={() => handleImportDrive(drive.path)}
                    style={{
                      width: '100%',
                      textAlign: 'left',
                      background: 'transparent',
                      border: 'none',
                      color: 'inherit',
                      padding: '6px 14px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      cursor: 'pointer',
                    }}
                    onMouseEnter={(e) => ((e.target as HTMLElement).style.backgroundColor = '#2c2c2c')}
                    onMouseLeave={(e) => ((e.target as HTMLElement).style.backgroundColor = 'transparent')}
                  >
                    <span>💾</span>
                    <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {drive.label}
                    </span>
                  </button>
                ))
              )}

              <div style={{ height: '1px', backgroundColor: '#2d2d2d', margin: '4px 0' }} />

              {/* Option 4: Recent folders */}
              <div style={{ padding: '6px 14px 2px 14px', fontSize: '10px', color: '#888', fontWeight: 600, textTransform: 'uppercase' }}>
                Carpetas recientes
              </div>
              {recentFolders.length === 0 ? (
                <div style={{ padding: '6px 14px', fontSize: '11px', color: '#666', fontStyle: 'italic' }}>
                  Sin carpetas recientes
                </div>
              ) : (
                <div style={{ maxHeight: '160px', overflowY: 'auto' }}>
                  {recentFolders.slice(0, 10).map((f) => (
                    <button
                      key={f}
                      onClick={() => handleImportRecent(f)}
                      title={f}
                      style={{
                        width: '100%',
                        textAlign: 'left',
                        background: 'transparent',
                        border: 'none',
                        color: 'inherit',
                        padding: '6px 14px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        cursor: 'pointer',
                        fontSize: '11px',
                      }}
                      onMouseEnter={(e) => ((e.target as HTMLElement).style.backgroundColor = '#2c2c2c')}
                      onMouseLeave={(e) => ((e.target as HTMLElement).style.backgroundColor = 'transparent')}
                    >
                      <span style={{ opacity: 0.6 }}>📁</span>
                      <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {f.split('/').filter(Boolean).pop() || f}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Export button */}
        <button
          className="toolbar__btn"
          onClick={() => setExportOpen(true)}
          title="Exportar fotos (Ctrl+Shift+E)"
          style={{
            backgroundColor: 'var(--color-lumen-surface)',
            borderColor: 'var(--color-lumen-border)',
            color: 'var(--color-lumen-text)',
          }}
        >
          📤 Exportar…
        </button>

        {/* Tether button */}
        <button
          className="toolbar__btn"
          onClick={() => setTetherOpen(true)}
          title="Captura conectada de cámara (Tethered) — Próximamente"
          style={{
            backgroundColor: 'var(--color-lumen-card)',
            borderColor: 'var(--color-lumen-border)',
            color: 'var(--color-lumen-muted)',
          }}
        >
          📷 Conectar cámara{' '}
          <span
            style={{
              fontSize: '9px',
              background: 'var(--color-lumen-surface)',
              border: '1px solid var(--color-lumen-border)',
              color: 'var(--color-lumen-muted)',
              padding: '1px 4px',
              borderRadius: '3px',
              marginLeft: '4px',
            }}
          >
            Próximamente
          </span>
        </button>

        <div className="toolbar__separator" />

        {/* View mode buttons (library only) */}
        {module === 'library' && (
          <>
            {VIEW_BUTTONS.map((v) => (
              <button
                key={v.key}
                className={`toolbar__btn ${libraryView === v.key ? 'toolbar__btn--active' : ''}`}
                onClick={() => setLibraryView(v.key)}
                title={v.shortcut}
              >
                {v.label}
              </button>
            ))}
            <div className="toolbar__separator" />
          </>
        )}

        {/* FTS5 Search Input */}
        {module === 'library' && <FtsSearchBar />}

        <div className="toolbar__spacer" />

        {/* Filter indicators */}
        <FilterButtons />
      </div>

      {/* Drag & Drop Visual Overlay ("Suelta para importar") */}
      {isDraggingOver && (
        <div
          id="drag-drop-overlay"
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 99999,
            backgroundColor: 'rgba(15, 23, 42, 0.88)',
            backdropFilter: 'blur(10px)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            pointerEvents: 'none',
          }}
        >
          <div
            style={{
              padding: '50px 80px',
              border: '3px dashed var(--color-lumen-accent, #3b82f6)',
              borderRadius: '20px',
              backgroundColor: 'rgba(30, 41, 59, 0.7)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '16px',
              boxShadow: '0 20px 60px rgba(0,0,0,0.6)',
            }}
          >
            <div style={{ fontSize: '56px' }}>📥</div>
            <div style={{ fontSize: '24px', fontWeight: 700, color: '#ffffff' }}>
              Suelta para importar
            </div>
            <div style={{ fontSize: '13px', color: '#93c5fd' }}>
              Carpetas o fotos se abrirán en el diálogo de importación
            </div>
          </div>
        </div>
      )}

      {/* Modals */}
      <ImportModal
        isOpen={importOpen}
        onClose={() => setImportOpen(false)}
        initialPaths={pendingImportPaths}
      />
      <ExportModal isOpen={exportOpen} onClose={() => setExportOpen(false)} />
      <TetherModal isOpen={tetherOpen} onClose={() => setTetherOpen(false)} />
    </>
  );
}

function FtsSearchBar() {
  const searchQuery = useCatalogStore((s) => s.searchQuery);
  const setSearchQuery = useCatalogStore((s) => s.setSearchQuery);
  const setPhotos = useCatalogStore((s) => s.setPhotos);

  const handleSearch = async (val: string) => {
    setSearchQuery(val);
    const { searchPhotosFts } = await import('../services/catalog');
    const results = await searchPhotosFts(val);
    setPhotos(results);
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center', marginLeft: '6px' }}>
      <input
        type="text"
        placeholder="🔍 Buscar por nombre o keyword…"
        value={searchQuery}
        onChange={(e) => handleSearch(e.target.value)}
        className="toolbar__input"
        style={{ width: '220px', fontSize: '11px' }}
      />
      {searchQuery && (
        <button
          onClick={() => handleSearch('')}
          className="toolbar__btn"
          style={{ marginLeft: '4px', padding: '2px 6px', fontSize: '11px' }}
          title="Limpiar búsqueda"
        >
          ✕
        </button>
      )}
    </div>
  );
}

function FilterButtons() {
  const filterRating = useCatalogStore((s) => s.filterRating);
  const filterFlag = useCatalogStore((s) => s.filterFlag);
  const filterColor = useCatalogStore((s) => s.filterColor);
  const setFilterRating = useCatalogStore((s) => s.setFilterRating);
  const setFilterFlag = useCatalogStore((s) => s.setFilterFlag);
  const setFilterColor = useCatalogStore((s) => s.setFilterColor);

  const hasFilter = filterRating !== null || filterFlag !== null || filterColor !== null;

  if (!hasFilter) return null;

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: '#888' }}>
      <span>Filtro activo:</span>
      {filterRating !== null && (
        <span className="filter-badge" onClick={() => setFilterRating(null)}>
          ★ {filterRating}+ ✕
        </span>
      )}
      {filterFlag !== null && (
        <span className="filter-badge" onClick={() => setFilterFlag(null)}>
          {filterFlag} ✕
        </span>
      )}
      {filterColor !== null && (
        <span className="filter-badge" onClick={() => setFilterColor(null)}>
          {filterColor} ✕
        </span>
      )}
    </div>
  );
}

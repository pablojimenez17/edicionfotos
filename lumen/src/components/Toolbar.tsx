import { useState, useEffect } from 'react';
import { useUiStore, type LibraryView } from '../stores/ui';
import { useCatalogStore } from '../stores/catalog';
import { ImportModal } from '../modules/library/ImportModal';
import { ExportModal } from '../modules/export/ExportModal';
import { TetherModal } from '../modules/tether/TetherModal';

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
  const [exportOpen, setExportOpen] = useState(false);
  const [tetherOpen, setTetherOpen] = useState(false);

  // Global Ctrl+Shift+E shortcut for export
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'e') {
        e.preventDefault();
        setExportOpen(true);
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, []);

  return (
    <>
      <div className="toolbar">
        {/* Import button */}
        <button
          className="toolbar__btn toolbar__btn--primary"
          onClick={() => setImportOpen(true)}
          disabled={isImporting}
          title="Importar fotos (Añadir / Copiar / Mover)"
        >
          {isImporting ? '⏳ Importando…' : '📂 Importar…'}
        </button>

        {/* Export button */}
        <button
          className="toolbar__btn"
          onClick={() => setExportOpen(true)}
          title="Exportar fotos (Ctrl+Shift+E)"
          style={{ backgroundColor: '#27272a', border: '1px solid #3f3f46', color: '#93c5fd' }}
        >
          📤 Exportar…
        </button>

        {/* Tether button */}
        <button
          className="toolbar__btn"
          onClick={() => setTetherOpen(true)}
          title="Captura conectada de cámara (Tethered) — Próximamente"
          style={{ backgroundColor: '#27272a', border: '1px solid #3f3f46', color: '#a1a1aa' }}
        >
          📷 Conectar cámara <span style={{ fontSize: '9px', background: '#3f3f46', color: '#e4e4e7', padding: '1px 4px', borderRadius: '3px', marginLeft: '4px' }}>Próximamente</span>
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
    <ImportModal isOpen={importOpen} onClose={() => setImportOpen(false)} />
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
        value={searchQuery}
        onChange={(e) => handleSearch(e.target.value)}
        placeholder="🔍 Buscar archivos / etiquetas…"
        style={{
          backgroundColor: '#18181b',
          border: '1px solid #3f3f46',
          borderRadius: '4px',
          color: '#e4e4e7',
          padding: '3px 8px',
          fontSize: '11px',
          width: '180px',
          outline: 'none',
        }}
      />
      {searchQuery && (
        <button
          onClick={() => handleSearch('')}
          style={{
            background: 'none',
            border: 'none',
            color: '#a1a1aa',
            cursor: 'pointer',
            marginLeft: '-20px',
            fontSize: '11px',
          }}
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
  const setFilterRating = useCatalogStore((s) => s.setFilterRating);
  const setFilterFlag = useCatalogStore((s) => s.setFilterFlag);

  return (
    <>
      {/* Rating filter */}
      <button
        className={`toolbar__btn ${filterRating > 0 ? 'toolbar__btn--active' : ''}`}
        onClick={() => setFilterRating(filterRating > 0 ? 0 : 1)}
        title="Filtrar por rating"
      >
        ★ {filterRating > 0 ? `≥${filterRating}` : ''}
      </button>

      {/* Flag filter */}
      <button
        className={`toolbar__btn ${filterFlag === 'pick' ? 'toolbar__btn--active' : ''}`}
        onClick={() => setFilterFlag(filterFlag === 'pick' ? null : 'pick')}
        title="Mostrar picks"
      >
        🏳
      </button>
    </>
  );
}

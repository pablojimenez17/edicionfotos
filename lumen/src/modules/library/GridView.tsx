import { useCallback, useEffect, useRef, useState } from 'react';
import { useCatalogStore, useFilteredPhotos } from '../../stores/catalog';
import { useUiStore } from '../../stores/ui';
import {
  loadThumbnails,
  createVirtualCopy,
  groupPhotosIntoStack,
  ungroupStack,
  setStackTop,
} from '../../services/catalog';
import { ImportModal } from './ImportModal';
import type { Photo } from '../../types';

const COLOR_MAP: Record<string, string> = {
  red: 'var(--color-label-red)',
  yellow: 'var(--color-label-yellow)',
  green: 'var(--color-label-green)',
  blue: 'var(--color-label-blue)',
  purple: 'var(--color-label-purple)',
};

export function GridView() {
  const filteredPhotos = useFilteredPhotos();
  const selectedIds = useCatalogStore((s) => s.selectedPhotoIds);
  const activePhotoId = useCatalogStore((s) => s.activePhotoId);
  const setActivePhotoId = useCatalogStore((s) => s.setActivePhotoId);
  const toggleSelection = useCatalogStore((s) => s.togglePhotoSelection);
  const setSelectedPhotoIds = useCatalogStore((s) => s.setSelectedPhotoIds);
  const isImporting = useCatalogStore((s) => s.isImporting);
  const importProgress = useCatalogStore((s) => s.importProgress);

  // Stacks collapsed state (set of stack_ids that are collapsed)
  const [collapsedStacks, setCollapsedStacks] = useState<Set<number>>(new Set());

  // Context menu state
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    photo: Photo;
  } | null>(null);

  // Load thumbnails on mount
  useEffect(() => {
    loadThumbnails().catch(console.error);
  }, []);

  // Keyboard shortcut listener for Stacks and Virtual copies
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "'") {
        e.preventDefault();
        if (activePhotoId !== null) {
          createVirtualCopy(activePhotoId);
        }
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'g') {
        e.preventDefault();
        if (e.shiftKey) {
          // Ungroup stack
          const active = filteredPhotos.find((p) => p.id === activePhotoId);
          if (active?.stack_id) ungroupStack(active.stack_id);
        } else {
          // Group into stack
          if (selectedIds.size > 1) {
            groupPhotosIntoStack(Array.from(selectedIds));
          }
        }
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [activePhotoId, selectedIds, filteredPhotos]);

  // Close context menu on outside click
  useEffect(() => {
    const close = () => setContextMenu(null);
    window.addEventListener('click', close);
    return () => window.removeEventListener('click', close);
  }, []);

  const handlePhotoClick = useCallback(
    (photo: Photo, e: React.MouseEvent) => {
      if (e.ctrlKey || e.metaKey) {
        toggleSelection(photo.id);
      } else if (e.shiftKey && activePhotoId !== null) {
        // Range select
        const allPhotos = useCatalogStore.getState().getFilteredPhotos();
        const startIdx = allPhotos.findIndex((p) => p.id === activePhotoId);
        const endIdx = allPhotos.findIndex((p) => p.id === photo.id);
        if (startIdx !== -1 && endIdx !== -1) {
          const [lo, hi] = startIdx < endIdx ? [startIdx, endIdx] : [endIdx, startIdx];
          const newIds = new Set(selectedIds);
          for (let i = lo; i <= hi; i++) {
            newIds.add(allPhotos[i].id);
          }
          setSelectedPhotoIds(newIds);
        }
      } else {
        setSelectedPhotoIds(new Set([photo.id]));
        setActivePhotoId(photo.id);
      }
    },
    [activePhotoId, selectedIds, toggleSelection, setSelectedPhotoIds, setActivePhotoId],
  );

  const handleDoubleClick = useCallback(
    (photo: Photo) => {
      setActivePhotoId(photo.id);
      useUiStore.getState().setLibraryView('loupe');
    },
    [setActivePhotoId],
  );

  const handleContextMenu = (photo: Photo, e: React.MouseEvent) => {
    e.preventDefault();
    if (!selectedIds.has(photo.id)) {
      setSelectedPhotoIds(new Set([photo.id]));
      setActivePhotoId(photo.id);
    }
    setContextMenu({ x: e.clientX, y: e.clientY, photo });
  };

  const toggleStackCollapse = (stackId: number, e: React.MouseEvent) => {
    e.stopPropagation();
    setCollapsedStacks((prev) => {
      const next = new Set(prev);
      if (next.has(stackId)) next.delete(stackId);
      else next.add(stackId);
      return next;
    });
  };

  const [emptyImportOpen, setEmptyImportOpen] = useState(false);
  const [emptyImportPaths, setEmptyImportPaths] = useState<string[]>([]);

  const handleEmptyImportFolder = async () => {
    try {
      const { open } = await import('@tauri-apps/plugin-dialog');
      const selected = await open({ directory: true, multiple: false, title: 'Importar carpeta...' });
      if (selected && typeof selected === 'string') {
        setEmptyImportPaths([selected]);
        setEmptyImportOpen(true);
      }
    } catch (err) {
      console.error('Empty import folder error:', err);
    }
  };

  const handleEmptyImportFiles = async () => {
    try {
      const { open } = await import('@tauri-apps/plugin-dialog');
      const selected = await open({
        directory: false,
        multiple: true,
        title: 'Importar archivos...',
        filters: [
          {
            name: 'Imágenes y RAW',
            extensions: ['jpg', 'jpeg', 'png', 'tif', 'tiff', 'webp', 'cr2', 'nef', 'arw', 'dng', 'raf', 'orf', 'rw2'],
          },
          { name: 'Todos los archivos', extensions: ['*'] },
        ],
      });
      if (selected) {
        const paths = Array.isArray(selected) ? selected : [selected];
        if (paths.length > 0) {
          setEmptyImportPaths(paths);
          setEmptyImportOpen(true);
        }
      }
    } catch (err) {
      console.error('Empty import files error:', err);
    }
  };

  if (filteredPhotos.length === 0 && !isImporting) {
    return (
      <>
        <div className="empty-state">
          <div className="empty-state__icon">📷</div>
          <div className="empty-state__text" style={{ marginBottom: '16px' }}>
            No hay fotos en la biblioteca.
          </div>
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center', justifyContent: 'center' }}>
            <button
              id="empty-btn-import-folder"
              className="empty-state__btn"
              onClick={handleEmptyImportFolder}
            >
              📁 Importar carpeta
            </button>
            <button
              id="empty-btn-import-files"
              className="empty-state__btn"
              style={{
                backgroundColor: 'var(--color-lumen-surface, #27272a)',
                border: '1px solid var(--color-lumen-border, #3f3f46)',
                color: 'var(--color-lumen-text, #f4f4f5)',
              }}
              onClick={handleEmptyImportFiles}
            >
              🖼️ Importar archivos
            </button>
          </div>
          <div style={{ marginTop: '14px', fontSize: '13px', color: 'var(--color-lumen-muted, #a1a1aa)' }}>
            o arrastra aquí tus fotos
          </div>
        </div>
        <ImportModal
          isOpen={emptyImportOpen}
          onClose={() => setEmptyImportOpen(false)}
          initialPaths={emptyImportPaths}
        />
      </>
    );
  }

  // Count total photos in each stack
  const stackTotals = new Map<number, number>();
  for (const p of filteredPhotos) {
    if (p.stack_id) {
      stackTotals.set(p.stack_id, (stackTotals.get(p.stack_id) || 0) + 1);
    }
  }

  // Filter out collapsed stack members (keep only stack_position === 1 or top)
  const visiblePhotos = filteredPhotos.filter((p) => {
    if (!p.stack_id) return true;
    if (collapsedStacks.has(p.stack_id)) {
      return (p.stack_position || 1) === 1;
    }
    return true;
  });

  return (
    <div className="grid-view">
      {isImporting && (
        <div className="import-progress">
          <div className="import-progress__bar" style={{ width: `${importProgress * 100}%` }} />
          <span className="import-progress__text">
            Importando… {Math.round(importProgress * 100)}%
          </span>
        </div>
      )}

      {/* Grid header actions */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 12px', borderBottom: '1px solid #27272a', fontSize: '11px', color: '#a1a1aa' }}>
        <span>{visiblePhotos.length} fotos {visiblePhotos.length !== filteredPhotos.length ? `(${filteredPhotos.length} en total)` : ''}</span>
        <div style={{ display: 'flex', gap: '8px' }}>
          {selectedIds.size > 1 && (
            <button
              onClick={() => groupPhotosIntoStack(Array.from(selectedIds))}
              style={{ backgroundColor: '#27272a', border: '1px solid #3f3f46', color: '#e4e4e7', padding: '2px 8px', borderRadius: '4px', cursor: 'pointer', fontSize: '11px' }}
              title="Agrupar selección en pila (Ctrl+G)"
            >
              📚 Agrupar ({selectedIds.size})
            </button>
          )}
          {activePhotoId !== null && (
            <button
              onClick={() => createVirtualCopy(activePhotoId)}
              style={{ backgroundColor: '#27272a', border: '1px solid #3f3f46', color: '#e4e4e7', padding: '2px 8px', borderRadius: '4px', cursor: 'pointer', fontSize: '11px' }}
              title="Crear copia virtual (Ctrl+')"
            >
              📑 Copia virtual
            </button>
          )}
        </div>
      </div>

      <div className="photo-grid">
        {visiblePhotos.map((photo) => {
          const isSelected = selectedIds.has(photo.id);
          const isActive = photo.id === activePhotoId;
          const isVirtualCopy = photo.master_id !== null;
          const stackTotal = photo.stack_id ? stackTotals.get(photo.stack_id) || 1 : 0;
          const isCollapsed = photo.stack_id ? collapsedStacks.has(photo.stack_id) : false;

          return (
            <PhotoCard
              key={photo.id}
              photo={photo}
              isSelected={isSelected}
              isActive={isActive}
              isVirtualCopy={isVirtualCopy}
              stackTotal={stackTotal}
              isCollapsed={isCollapsed}
              onToggleCollapse={(e) => photo.stack_id && toggleStackCollapse(photo.stack_id, e)}
              onClick={(e) => handlePhotoClick(photo, e)}
              onDoubleClick={() => handleDoubleClick(photo)}
              onContextMenu={(e) => handleContextMenu(photo, e)}
            />
          );
        })}
      </div>

      {/* Context Menu */}
      {contextMenu && (
        <div
          style={{
            position: 'fixed',
            left: contextMenu.x,
            top: contextMenu.y,
            backgroundColor: '#18181b',
            border: '1px solid #3f3f46',
            borderRadius: '6px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
            zIndex: 1000,
            padding: '4px',
            minWidth: '180px',
            fontSize: '11px',
            color: '#e4e4e7',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div
            onClick={() => {
              createVirtualCopy(contextMenu.photo.id);
              setContextMenu(null);
            }}
            style={{ padding: '6px 10px', cursor: 'pointer', borderRadius: '4px' }}
            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#27272a'; }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
          >
            📑 Crear copia virtual (Ctrl+')
          </div>

          {selectedIds.size > 1 && (
            <div
              onClick={() => {
                groupPhotosIntoStack(Array.from(selectedIds));
                setContextMenu(null);
              }}
              style={{ padding: '6px 10px', cursor: 'pointer', borderRadius: '4px' }}
              onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#27272a'; }}
              onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
            >
              📚 Agrupar fotos en pila (Ctrl+G)
            </div>
          )}

          {contextMenu.photo.stack_id && (
            <>
              <div
                onClick={() => {
                  setStackTop(contextMenu.photo.id, contextMenu.photo.stack_id!);
                  setContextMenu(null);
                }}
                style={{ padding: '6px 10px', cursor: 'pointer', borderRadius: '4px' }}
                onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#27272a'; }}
                onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
              >
                🔝 Poner al principio de la pila
              </div>
              <div
                onClick={() => {
                  ungroupStack(contextMenu.photo.stack_id!);
                  setContextMenu(null);
                }}
                style={{ padding: '6px 10px', cursor: 'pointer', borderRadius: '4px', color: '#f87171' }}
                onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#27272a'; }}
                onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
              >
                ✕ Desagrupar pila (Ctrl+Shift+G)
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

interface PhotoCardProps {
  photo: Photo;
  isSelected: boolean;
  isActive: boolean;
  isVirtualCopy: boolean;
  stackTotal: number;
  isCollapsed: boolean;
  onToggleCollapse: (e: React.MouseEvent) => void;
  onClick: (e: React.MouseEvent) => void;
  onDoubleClick: () => void;
  onContextMenu: (e: React.MouseEvent) => void;
}

function PhotoCard({
  photo,
  isSelected,
  isActive,
  isVirtualCopy,
  stackTotal,
  isCollapsed,
  onToggleCollapse,
  onClick,
  onDoubleClick,
  onContextMenu,
}: PhotoCardProps) {
  const imgRef = useRef<HTMLImageElement>(null);
  const src = photo.thumbnailUrl || '';
  const showPlaceholder = !src;

  return (
    <div
      className={`photo-cell ${isSelected ? 'photo-cell--selected' : ''} ${isActive ? 'photo-cell--active' : ''}`}
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      onContextMenu={onContextMenu}
      style={{ position: 'relative' }}
    >
      {/* Badges for Virtual Copy & Stacks */}
      <div style={{ position: 'absolute', top: 6, left: 6, zIndex: 10, display: 'flex', gap: '4px' }}>
        {isVirtualCopy && (
          <span
            style={{
              backgroundColor: 'rgba(59, 130, 246, 0.85)',
              color: '#fff',
              fontSize: '9px',
              fontWeight: 600,
              padding: '1px 4px',
              borderRadius: '3px',
              letterSpacing: '0.5px',
            }}
            title="Copia Virtual"
          >
            COPIA
          </span>
        )}
        {photo.stack_id && stackTotal > 1 && (
          <button
            onClick={onToggleCollapse}
            style={{
              backgroundColor: 'rgba(24, 24, 27, 0.9)',
              border: '1px solid #52525b',
              color: '#fbbf24',
              fontSize: '9px',
              fontWeight: 700,
              padding: '1px 5px',
              borderRadius: '3px',
              cursor: 'pointer',
            }}
            title={isCollapsed ? 'Pila plegada. Clic para desplegar' : 'Pila desplegada. Clic para plegar'}
          >
            {isCollapsed ? `[ 1/${stackTotal} ] ▶` : `[ ${photo.stack_position || 1}/${stackTotal} ] ▼`}
          </button>
        )}
      </div>

      {showPlaceholder ? (
        <div
          style={{
            width: '100%',
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--color-lumen-muted)',
            fontSize: 24,
          }}
        >
          🖼
        </div>
      ) : (
        <img
          ref={imgRef}
          className="photo-cell__img"
          src={src}
          alt={photo.filename}
          loading="lazy"
        />
      )}

      <div className="photo-cell__overlay">
        {photo.rating > 0 && (
          <span className="photo-cell__rating">{'★'.repeat(photo.rating)}</span>
        )}
        {photo.flag === 'pick' && <span className="photo-cell__flag photo-cell__flag--pick">⚑</span>}
        {photo.flag === 'reject' && <span className="photo-cell__flag photo-cell__flag--reject">✕</span>}
        <span className="photo-cell__filename">{photo.filename}</span>
        {photo.color_label !== 'none' && (
          <div
            className="photo-cell__color-label"
            style={{ background: COLOR_MAP[photo.color_label] }}
          />
        )}
      </div>
    </div>
  );
}

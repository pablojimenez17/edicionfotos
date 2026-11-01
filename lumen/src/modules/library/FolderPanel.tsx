import { useState } from 'react';
import { useCatalogStore } from '../../stores/catalog';
import { useUiStore } from '../../stores/ui';
import { useHelpStore } from '../../help/helpStore';
import { CollectionsPanel } from './CollectionsPanel';
import { KeywordsPanel } from './KeywordsPanel';
import { PublishServicesPanel } from './PublishServicesPanel';
import type { Folder } from '../../types';

export function FolderPanel() {
  const [foldersOpen, setFoldersOpen] = useState(true);
  const [publishOpen, setPublishOpen] = useState(true);
  const leftPanelWidth = useUiStore((s) => s.leftPanelWidth);
  const openHelp = useHelpStore((s) => s.openPanelHelp);

  const rootFolders = useCatalogStore((s) => s.rootFolders);
  const folders = useCatalogStore((s) => s.folders);
  const photos = useCatalogStore((s) => s.photos);
  const activeFolderId = useCatalogStore((s) => s.activeFolderId);
  const setActiveFolderId = useCatalogStore((s) => s.setActiveFolderId);

  // Count photos per folder
  const countMap = new Map<number, number>();
  for (const p of photos) {
    countMap.set(p.folder_id, (countMap.get(p.folder_id) || 0) + 1);
  }

  // Count total for "All Photos"
  const totalPhotos = photos.length;

  return (
    <div className="panel" style={{ width: `${leftPanelWidth}px`, flexShrink: 0 }}>
      {/* Carpetas Header */}
      <div
        className="panel__header"
        onClick={() => setFoldersOpen(!foldersOpen)}
        style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', userSelect: 'none' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span>{foldersOpen ? '▾' : '▸'} CARPETAS</span>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              openHelp('panel_folders');
            }}
            title="Ayuda sobre el panel de carpetas (?)"
            style={{
              background: 'var(--color-lumen-surface)',
              border: '1px solid var(--color-lumen-border)',
              borderRadius: '50%',
              width: '15px',
              height: '15px',
              fontSize: '10px',
              lineHeight: '13px',
              textAlign: 'center',
              color: 'var(--color-lumen-muted)',
              cursor: 'pointer',
            }}
          >
            ?
          </button>
        </div>
      </div>

      {foldersOpen && (
        <div style={{ paddingBottom: '8px' }}>
          {/* All Photos */}
          <div
            className={`folder-item ${activeFolderId === null ? 'folder-item--active' : ''}`}
            onClick={() => setActiveFolderId(null)}
          >
            <span className="folder-item__icon">📸</span>
            <span>Todas las fotos</span>
            <span className="folder-item__count">{totalPhotos}</span>
          </div>

          {/* Root folders */}
          {rootFolders.map((rf) => {
            const rfFolders = folders.filter((f) => f.root_id === rf.id);
            return (
              <div key={rf.id}>
                <div
                  style={{
                    padding: '8px 14px 4px',
                    fontSize: 11,
                    fontWeight: 600,
                    color: 'var(--color-lumen-muted)',
                    letterSpacing: '0.5px',
                  }}
                >
                  {rf.is_missing ? '⚠️ ' : '💾 '}
                  {rf.name}
                </div>
                {rfFolders.map((folder) => (
                  <FolderItem
                    key={folder.id}
                    folder={folder}
                    isActive={activeFolderId === folder.id}
                    photoCount={countMap.get(folder.id) || 0}
                    onClick={() => setActiveFolderId(folder.id)}
                  />
                ))}
              </div>
            );
          })}

          {rootFolders.length === 0 && (
            <div style={{ padding: '16px 14px', color: 'var(--color-lumen-muted)', fontSize: 12, lineHeight: 1.5 }}>
              No hay carpetas importadas.
              <br />
              Usa el botón «Importar» para añadir fotos.
            </div>
          )}
        </div>
      )}

      {/* Collections section */}
      <CollectionsPanel />

      {/* Keywords section */}
      <KeywordsPanel />

      {/* Publish Services section */}
      <div style={{ marginTop: '12px', borderTop: '1px solid var(--color-lumen-border)' }}>
        <div
          className="panel__header"
          onClick={() => setPublishOpen(!publishOpen)}
          style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', userSelect: 'none' }}
        >
          <span>{publishOpen ? '▾' : '▸'} SERVICIOS DE PUBLICACIÓN</span>
          <span
            style={{
              fontSize: '9px',
              background: 'var(--color-lumen-surface)',
              border: '1px solid var(--color-lumen-border)',
              color: 'var(--color-lumen-muted)',
              padding: '1px 5px',
              borderRadius: 'var(--radius-sm)',
            }}
          >
            Próximamente
          </span>
        </div>
        {publishOpen && (
          <div style={{ padding: '10px 12px' }}>
            <PublishServicesPanel />
          </div>
        )}
      </div>
    </div>
  );
}

function FolderItem({
  folder,
  isActive,
  photoCount,
  onClick,
}: {
  folder: Folder;
  isActive: boolean;
  photoCount: number;
  onClick: () => void;
}) {
  const depth = folder.rel_path === '.' ? 0 : folder.rel_path.split('/').length;

  return (
    <div
      className={`folder-item ${isActive ? 'folder-item--active' : ''}`}
      onClick={onClick}
      style={{ paddingLeft: 14 + depth * 14 }}
    >
      <span className="folder-item__icon">📁</span>
      <span>{folder.name}</span>
      {photoCount > 0 && <span className="folder-item__count">{photoCount}</span>}
    </div>
  );
}

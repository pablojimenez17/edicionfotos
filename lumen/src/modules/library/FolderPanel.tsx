import { useCatalogStore } from '../../stores/catalog';
import { CollectionsPanel } from './CollectionsPanel';
import { KeywordsPanel } from './KeywordsPanel';
import { PublishServicesPanel } from './PublishServicesPanel';
import type { Folder } from '../../types';


export function FolderPanel() {
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
    <div className="panel">
      <div className="panel__header">Carpetas</div>

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
                padding: '6px 12px 2px',
                fontSize: 11,
                fontWeight: 600,
                color: 'var(--color-lumen-muted)',
                letterSpacing: '0.5px',
                marginTop: 8,
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

      {/* Collections section */}
      <CollectionsPanel />

      {/* Keywords section */}
      <KeywordsPanel />

      {/* Publish Services section */}
      <div style={{ marginTop: '16px', borderTop: '1px solid #27272a', paddingTop: '10px' }}>
        <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--color-lumen-muted)', padding: '4px 12px 6px' }}>
          SERVICIOS DE PUBLICACIÓN
        </div>
        <div style={{ padding: '0 8px' }}>
          <PublishServicesPanel />
        </div>
      </div>

      {rootFolders.length === 0 && (
        <div style={{ padding: '16px 12px', color: 'var(--color-lumen-muted)', fontSize: 12 }}>
          No hay carpetas importadas.
          <br />
          Usa el botón «Importar» para añadir fotos.
        </div>
      )}
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
      style={{ paddingLeft: 12 + depth * 16 }}
    >
      <span className="folder-item__icon">📁</span>
      <span>{folder.name}</span>
      {photoCount > 0 && <span className="folder-item__count">{photoCount}</span>}
    </div>
  );
}

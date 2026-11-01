import React from 'react';
import { useUiStore } from '../stores/ui';
import { useCatalogStore, useFilteredPhotos } from '../stores/catalog';

export const StatusBar: React.FC = () => {
  const module = useUiStore((s) => s.module);
  const photos = useFilteredPhotos();
  const allPhotos = useCatalogStore((s) => s.photos);
  const activePhotoId = useCatalogStore((s) => s.activePhotoId);
  const selectedPhotoIds = useCatalogStore((s) => s.selectedPhotoIds);

  const activePhoto = allPhotos.find((p) => p.id === activePhotoId) || null;

  const moduleNames: Record<string, string> = {
    library: 'BIBLIOTECA',
    develop: 'REVELADO',
    map: 'MAPA',
    book: 'LIBRO',
    slideshow: 'PRESENTACIÓN',
    print: 'IMPRESIÓN',
    web: 'WEB',
  };

  return (
    <footer
      role="status"
      style={{
        height: '24px',
        backgroundColor: 'var(--color-lumen-bg-deep)',
        borderTop: '1px solid var(--color-lumen-border)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 12px',
        fontSize: '11px',
        color: 'var(--color-lumen-muted)',
        userSelect: 'none',
        flexShrink: 0,
      }}
    >
      {/* Left: Active Module & Photo Selection Info */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <span
          style={{
            fontWeight: 600,
            fontSize: '10px',
            letterSpacing: '0.05em',
            color: 'var(--color-lumen-accent)',
          }}
        >
          {moduleNames[module] || module.toUpperCase()}
        </span>

        <span style={{ color: 'var(--color-lumen-border)' }}>|</span>

        <span>
          {allPhotos.length === 0
            ? '0 fotos en el catálogo'
            : selectedPhotoIds.size > 1
            ? `${selectedPhotoIds.size} de ${photos.length} fotos seleccionadas`
            : `${photos.length} fotos filtradas (${allPhotos.length} en total)`}
        </span>
      </div>

      {/* Center: Active Photo Technical Details */}
      {activePhoto && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            color: 'var(--color-lumen-text-dim)',
            fontFamily: 'var(--font-mono)',
            fontSize: '10.5px',
          }}
        >
          <span style={{ color: 'var(--color-lumen-text)', fontWeight: 500 }}>
            {activePhoto.filename}
          </span>
          <span>·</span>
          <span>{activePhoto.width} × {activePhoto.height} px</span>
          <span>·</span>
          <span>{activePhoto.format}</span>
          {activePhoto.iso && (
            <>
              <span>·</span>
              <span>ISO {activePhoto.iso}</span>
              <span>·</span>
              <span>ƒ/{activePhoto.aperture}</span>
              <span>·</span>
              <span>{activePhoto.shutter_speed}s</span>
            </>
          )}
        </div>
      )}

      {/* Right: SQLite Catalog Status */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '10.5px' }}>
        <span
          style={{
            width: '6px',
            height: '6px',
            borderRadius: '50%',
            backgroundColor: 'var(--color-lumen-success)',
            display: 'inline-block',
          }}
        />
        <span>Catálogo SQLite sincronizado</span>
      </div>
    </footer>
  );
};

import { useRef, useEffect } from 'react';
import { useCatalogStore, useFilteredPhotos } from '../stores/catalog';
import { useUiStore } from '../stores/ui';

export function Filmstrip() {
  const photos = useFilteredPhotos();
  const activePhotoId = useCatalogStore((s) => s.activePhotoId);
  const setActivePhotoId = useCatalogStore((s) => s.setActivePhotoId);
  const filmstripOpen = useUiStore((s) => s.filmstripOpen);
  const toggleFilmstrip = useUiStore((s) => s.toggleFilmstrip);

  const activeThumbRef = useRef<HTMLDivElement | null>(null);

  // Scroll active photo into view
  useEffect(() => {
    if (activeThumbRef.current) {
      activeThumbRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    }
  }, [activePhotoId]);

  if (!filmstripOpen) {
    return (
      <div
        onClick={toggleFilmstrip}
        style={{
          height: '18px',
          backgroundColor: '#18181b',
          borderTop: '1px solid #27272a',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          color: '#71717a',
          fontSize: '10px',
        }}
        title="Mostrar tira de imágenes"
      >
        ▲ Mostrar tira de imágenes ({photos.length} fotos)
      </div>
    );
  }

  return (
    <div
      style={{
        height: '96px',
        backgroundColor: '#141416',
        borderTop: '1px solid #27272a',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '2px 8px',
          backgroundColor: '#18181b',
          borderBottom: '1px solid #222226',
          fontSize: '10px',
          color: '#71717a',
        }}
      >
        <span>
          Tira de película — {photos.length} fotos {activePhotoId ? `(Foto activa #${activePhotoId})` : ''}
        </span>
        <button
          onClick={toggleFilmstrip}
          style={{ background: 'none', border: 'none', color: '#71717a', cursor: 'pointer', fontSize: '10px' }}
        >
          ▼ Ocultar
        </button>
      </div>
      <div
        style={{
          flex: 1,
          display: 'flex',
          gap: '6px',
          overflowX: 'auto',
          padding: '6px 8px',
          alignItems: 'center',
        }}
      >
        {photos.map((photo) => {
          const isActive = photo.id === activePhotoId;
          return (
            <div
              key={photo.id}
              ref={isActive ? activeThumbRef : null}
              onClick={() => setActivePhotoId(photo.id)}
              style={{
                flex: '0 0 74px',
                height: '64px',
                backgroundColor: '#1c1c1f',
                borderRadius: '3px',
                border: isActive ? '2px solid #3b82f6' : '1px solid #27272a',
                overflow: 'hidden',
                position: 'relative',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {photo.thumbnailUrl ? (
                <img
                  src={photo.thumbnailUrl}
                  alt={photo.filename}
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
              ) : (
                <div style={{ fontSize: '10px', color: '#52525b' }}>IMG</div>
              )}
              {/* Star rating overlay */}
              {photo.rating > 0 && (
                <div
                  style={{
                    position: 'absolute',
                    bottom: '2px',
                    left: '2px',
                    fontSize: '9px',
                    color: '#eab308',
                    backgroundColor: 'rgba(0,0,0,0.6)',
                    padding: '0 3px',
                    borderRadius: '2px',
                  }}
                >
                  {'★'.repeat(photo.rating)}
                </div>
              )}
              {/* Flag badge */}
              {photo.flag !== 'none' && (
                <div
                  style={{
                    position: 'absolute',
                    top: '2px',
                    left: '2px',
                    width: '6px',
                    height: '6px',
                    borderRadius: '50%',
                    backgroundColor: photo.flag === 'pick' ? '#22c55e' : '#ef4444',
                  }}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

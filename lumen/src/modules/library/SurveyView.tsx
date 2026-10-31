import { useCatalogStore, useFilteredPhotos } from '../../stores/catalog';
import { convertFileSrc } from '../../services/catalog';

export function SurveyView() {
  const photos = useFilteredPhotos();
  const selectedPhotoIds = useCatalogStore((s) => s.selectedPhotoIds);
  const togglePhotoSelection = useCatalogStore((s) => s.togglePhotoSelection);
  const setActivePhotoId = useCatalogStore((s) => s.setActivePhotoId);
  const activePhotoId = useCatalogStore((s) => s.activePhotoId);
  const updatePhoto = useCatalogStore((s) => s.updatePhoto);

  // If there is an explicit selection, show selected photos; otherwise show first 4 photos
  const surveyPhotos = selectedPhotoIds.size > 0
    ? photos.filter((p) => selectedPhotoIds.has(p.id))
    : photos.slice(0, 4);

  if (surveyPhotos.length === 0) {
    return (
      <div className="empty-state">
        <div className="empty-state__icon">📊</div>
        <div className="empty-state__text">
          La vista Encuesta (N) muestra las fotos seleccionadas. Selecciona 2 o más fotos en la cuadrícula.
        </div>
      </div>
    );
  }

  // Calculate dynamic grid columns (2 for 2-4 photos, 3 for 5-9 photos, etc.)
  const cols = surveyPhotos.length <= 2 ? 2 : surveyPhotos.length <= 4 ? 2 : 3;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', width: '100%', height: '100%', backgroundColor: '#121214' }}>
      {/* Top action toolbar for Survey */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '6px 14px',
          backgroundColor: '#18181b',
          borderBottom: '1px solid #27272a',
          fontSize: '11px',
          color: '#e4e4e7',
        }}
      >
        <span style={{ fontWeight: 600 }}>
          Vista Encuesta (N) — {surveyPhotos.length} fotos en comparación
        </span>
        <span style={{ color: '#71717a' }}>
          Haz clic en ✕ para retirar fotos de la encuesta hasta elegir la ganadora
        </span>
      </div>

      {/* Grid container */}
      <div
        style={{
          flex: 1,
          display: 'grid',
          gridTemplateColumns: `repeat(${cols}, 1fr)`,
          gap: '8px',
          padding: '12px',
          overflowY: 'auto',
        }}
      >
        {surveyPhotos.map((photo) => {
          const isActive = photo.id === activePhotoId;
          const root = photo.root_path || '';
          const fullPath = root ? `${root}/${photo.file_path}` : photo.file_path;
          const src = convertFileSrc(fullPath);

          return (
            <div
              key={photo.id}
              onClick={() => setActivePhotoId(photo.id)}
              style={{
                position: 'relative',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: '#18181b',
                borderRadius: '4px',
                border: isActive ? '2px solid #3b82f6' : '1px solid #27272a',
                overflow: 'hidden',
                padding: '8px',
              }}
            >
              {/* Dismiss / Remove button */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  togglePhotoSelection(photo.id);
                }}
                style={{
                  position: 'absolute',
                  top: '8px',
                  right: '8px',
                  width: '22px',
                  height: '22px',
                  backgroundColor: 'rgba(0,0,0,0.7)',
                  border: '1px solid #3f3f46',
                  borderRadius: '50%',
                  color: '#fff',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '11px',
                  zIndex: 2,
                }}
                title="Retirar de la encuesta"
              >
                ✕
              </button>

              <img
                src={photo.thumbnailUrl || src}
                alt={photo.filename}
                style={{
                  maxWidth: '100%',
                  maxHeight: '80%',
                  objectFit: 'contain',
                  borderRadius: '2px',
                }}
              />

              {/* Rating & filename */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  width: '100%',
                  marginTop: '6px',
                  fontSize: '11px',
                  color: '#a1a1aa',
                }}
              >
                <span title={photo.filename} style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '65%' }}>
                  {photo.filename}
                </span>
                <div style={{ display: 'flex', gap: '2px' }}>
                  {[1, 2, 3, 4, 5].map((s) => (
                    <button
                      key={s}
                      onClick={(e) => {
                        e.stopPropagation();
                        updatePhoto(photo.id, { rating: photo.rating === s ? 0 : s });
                      }}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: s <= photo.rating ? '#eab308' : '#3f3f46',
                        cursor: 'pointer',
                        padding: 0,
                        fontSize: '12px',
                      }}
                    >
                      ★
                    </button>
                  ))}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

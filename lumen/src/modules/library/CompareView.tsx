import { useState, useEffect } from 'react';

import { useCatalogStore, useFilteredPhotos } from '../../stores/catalog';
import { getPreviewSource, type PreviewSource } from '../../platform';
import { PhotoErrorState } from '../../components/PhotoErrorState';
import type { Photo } from '../../types';

export function CompareView() {
  const photos = useFilteredPhotos();
  const activePhotoId = useCatalogStore((s) => s.activePhotoId);
  const setActivePhotoId = useCatalogStore((s) => s.setActivePhotoId);
  const updatePhoto = useCatalogStore((s) => s.updatePhoto);

  const [candidateIndex, setCandidateIndex] = useState<number>(0);

  // Active / Select photo
  const selectPhoto = photos.find((p) => p.id === activePhotoId) || photos[0] || null;

  // Candidate photo (defaults to next photo in list)
  useEffect(() => {
    if (selectPhoto) {
      const idx = photos.findIndex((p) => p.id === selectPhoto.id);
      const nextIdx = idx + 1 < photos.length ? idx + 1 : idx > 0 ? idx - 1 : 0;
      setCandidateIndex(nextIdx);
    }
  }, [selectPhoto?.id]);

  const candidatePhoto = photos[candidateIndex] || null;

  if (!selectPhoto || !candidatePhoto || photos.length < 2) {
    return (
      <div className="empty-state">
        <div className="empty-state__icon">⚖️</div>
        <div className="empty-state__text">
          La vista Comparar (C) requiere al menos 2 fotos en el catálogo.
        </div>
      </div>
    );
  }

  const handleSwap = () => {
    setActivePhotoId(candidatePhoto.id);
  };

  const handleNextCandidate = () => {
    setCandidateIndex((prev) => (prev + 1 < photos.length ? prev + 1 : 0));
  };

  const handlePrevCandidate = () => {
    setCandidateIndex((prev) => (prev - 1 >= 0 ? prev - 1 : photos.length - 1));
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', width: '100%', height: '100%', backgroundColor: '#121214' }}>
      {/* Top action toolbar for Compare */}
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
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <span style={{ fontWeight: 600 }}>Vista Comparar (C)</span>
          <button
            onClick={handleSwap}
            style={{
              backgroundColor: '#27272a',
              border: '1px solid #3f3f46',
              borderRadius: '3px',
              color: '#fff',
              padding: '2px 8px',
              cursor: 'pointer',
            }}
          >
            ⇄ Intercambiar (Swap)
          </button>
        </div>

        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <span>Candidata {candidateIndex + 1} de {photos.length}:</span>
          <button
            onClick={handlePrevCandidate}
            style={{
              backgroundColor: '#27272a',
              border: '1px solid #3f3f46',
              borderRadius: '3px',
              color: '#fff',
              padding: '2px 6px',
              cursor: 'pointer',
            }}
          >
            ◀ Anterior
          </button>
          <button
            onClick={handleNextCandidate}
            style={{
              backgroundColor: '#27272a',
              border: '1px solid #3f3f46',
              borderRadius: '3px',
              color: '#fff',
              padding: '2px 6px',
              cursor: 'pointer',
            }}
          >
            Siguiente ▶
          </button>
        </div>
      </div>

      {/* 2-photo split screen */}
      <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
        {/* Left: Select */}
        <ComparePane
          title="ENFOQUE (Selección activa)"
          photo={selectPhoto}
          isSelect={true}
          onSetRating={(r) => updatePhoto(selectPhoto.id, { rating: r })}
          onSetFlag={(f) => updatePhoto(selectPhoto.id, { flag: f })}
        />

        <div style={{ width: '2px', backgroundColor: '#27272a' }} />

        {/* Right: Candidate */}
        <ComparePane
          title="CANDIDATA"
          photo={candidatePhoto}
          isSelect={false}
          onSetRating={(r) => updatePhoto(candidatePhoto.id, { rating: r })}
          onSetFlag={(f) => updatePhoto(candidatePhoto.id, { flag: f })}
          onMakeSelect={() => setActivePhotoId(candidatePhoto.id)}
        />
      </div>
    </div>
  );
}

function ComparePane({
  title,
  photo,
  isSelect,
  onSetRating,
  onSetFlag,
  onMakeSelect,
}: {
  title: string;
  photo: Photo;
  isSelect: boolean;
  onSetRating: (r: number) => void;
  onSetFlag: (f: 'none' | 'pick' | 'reject') => void;
  onMakeSelect?: () => void;
}) {
  const [imgUrl, setImgUrl] = useState<string>(photo.thumbnailUrl || '');
  const [hasError, setHasError] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    let isCurrent = true;
    let source: PreviewSource | null = null;

    getPreviewSource(photo.id, 'full')
      .then((s) => {
        if (!isCurrent) {
          s.release();
          return;
        }
        source = s;
        setImgUrl(s.url);
        setHasError(false);
      })
      .catch((err) => {
        if (!isCurrent) return;
        console.error('Error cargando foto en Comparación:', photo.filename, err);
        setHasError(true);
        setErrorMsg(err?.message || 'Error al cargar imagen');
      });

    return () => {
      isCurrent = false;
      source?.release();
    };
  }, [photo.id]);

  const handleRetry = () => {
    setHasError(false);
    getPreviewSource(photo.id, 'full')
      .then((s) => {
        setImgUrl(s.url);
      })
      .catch((err) => {
        console.error('Error al reintentar carga en Comparación:', err);
        setHasError(true);
      });
  };

  return (
    <div
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
        padding: '12px',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#121214',
      }}
    >
      <div
        style={{
          position: 'absolute',
          top: 10,
          left: 12,
          display: 'flex',
          gap: '8px',
          alignItems: 'center',
          backgroundColor: 'rgba(24, 24, 27, 0.8)',
          padding: '4px 8px',
          borderRadius: '4px',
          backdropFilter: 'blur(4px)',
          fontSize: '11px',
          color: isSelect ? '#60a5fa' : '#e4e4e7',
          fontWeight: 600,
        }}
      >
        <span>{title}: {photo.filename}</span>
        {!isSelect && onMakeSelect && (
          <button
            onClick={onMakeSelect}
            style={{
              backgroundColor: '#3b82f6',
              border: 'none',
              borderRadius: '2px',
              color: '#fff',
              fontSize: '10px',
              padding: '2px 6px',
              cursor: 'pointer',
            }}
          >
            Hacer Enfoque
          </button>
        )}
      </div>

      {hasError ? (
        <PhotoErrorState reason={errorMsg || undefined} onRetry={handleRetry} />
      ) : (
        <img
          src={imgUrl}
          alt={photo.filename}
          onError={() => {
            console.error('Error cargando <img> en Comparación:', photo.filename);
            setHasError(true);
            setErrorMsg('Error de carga de imagen');
          }}
          style={{
            maxWidth: '100%',
            maxHeight: '84%',
            objectFit: 'contain',
            borderRadius: '3px',
            boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
          }}
        />
      )}

      {/* Floating Classification Bar */}
      <div
        style={{
          position: 'absolute',
          bottom: 12,
          display: 'flex',
          gap: '12px',
          backgroundColor: 'rgba(24, 24, 27, 0.85)',
          padding: '4px 12px',
          borderRadius: '16px',
          backdropFilter: 'blur(6px)',
          border: '1px solid #3f3f46',
          alignItems: 'center',
        }}
      >
        <div style={{ display: 'flex', gap: '3px' }}>
          {[1, 2, 3, 4, 5].map((s) => (
            <button
              key={s}
              onClick={() => onSetRating(photo.rating === s ? 0 : s)}
              style={{
                background: 'none',
                border: 'none',
                color: s <= photo.rating ? '#eab308' : '#3f3f46',
                cursor: 'pointer',
                fontSize: '14px',
              }}
            >
              ★
            </button>
          ))}
        </div>
        <div style={{ width: '1px', height: '14px', backgroundColor: '#3f3f46' }} />
        <button
          onClick={() => onSetFlag(photo.flag === 'pick' ? 'none' : 'pick')}
          style={{
            background: 'none',
            border: 'none',
            color: photo.flag === 'pick' ? '#22c55e' : '#71717a',
            cursor: 'pointer',
            fontSize: '12px',
          }}
        >
          ✓ Pick
        </button>
        <button
          onClick={() => onSetFlag(photo.flag === 'reject' ? 'none' : 'reject')}
          style={{
            background: 'none',
            border: 'none',
            color: photo.flag === 'reject' ? '#ef4444' : '#71717a',
            cursor: 'pointer',
            fontSize: '12px',
          }}
        >
          ✕ Reject
        </button>
      </div>
    </div>
  );
}

import { useState, useRef, useEffect, useCallback } from 'react';
import { useCatalogStore, useFilteredPhotos } from '../../stores/catalog';
import { useUiStore } from '../../stores/ui';
import { getPreviewSource, type PreviewSource } from '../../platform';
import { PhotoErrorState } from '../../components/PhotoErrorState';

export function LoupeView() {
  const activePhotoId = useCatalogStore((s) => s.activePhotoId);
  const photos = useFilteredPhotos();
  const setActivePhotoId = useCatalogStore((s) => s.setActivePhotoId);
  const activePhoto = photos.find((p) => p.id === activePhotoId);

  // Zoom & Pan state
  const [zoomLevel, setZoomLevel] = useState<'fit' | 1 | 2>('fit');
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [showInfoOverlay, setShowInfoOverlay] = useState(true);

  // Preview source state
  const [preview, setPreview] = useState<PreviewSource | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);

  // Reset zoom on active photo change
  useEffect(() => {
    setZoomLevel('fit');
    setPan({ x: 0, y: 0 });
  }, [activePhotoId]);

  // Load preview source from centralized platform service
  useEffect(() => {
    if (!activePhotoId) {
      setPreview(null);
      setError(null);
      return;
    }

    let isCurrent = true;
    let loadedSource: PreviewSource | null = null;
    setLoading(true);
    setError(null);

    getPreviewSource(activePhotoId, 'full')
      .then((src) => {
        if (!isCurrent) {
          src.release();
          return;
        }
        loadedSource = src;
        setPreview(src);
        setLoading(false);
      })
      .catch((err) => {
        if (!isCurrent) return;
        const msg = err?.message || 'Error desconocido al cargar el archivo de imagen';
        console.error('Error cargando foto en Lupa:', err);
        setError(msg);
        setLoading(false);
      });

    return () => {
      isCurrent = false;
      if (loadedSource) {
        loadedSource.release();
      }
    };
  }, [activePhotoId, retryCount]);

  // Draw on canvas whenever preview, zoom, or pan updates
  useEffect(() => {
    if (!preview || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Use bitmap if present, or let image handle it
    const drawTarget = preview.bitmap || imgRef.current;
    if (!drawTarget) return;

    const natW = preview.bitmap ? preview.bitmap.width : (imgRef.current?.naturalWidth || preview.width || 800);
    const natH = preview.bitmap ? preview.bitmap.height : (imgRef.current?.naturalHeight || preview.height || 600);

    canvas.width = natW;
    canvas.height = natH;

    ctx.clearRect(0, 0, natW, natH);
    ctx.drawImage(drawTarget, 0, 0, natW, natH);
  }, [preview, zoomLevel, pan]);

  // Navigate left/right photos
  const handleNextPhoto = useCallback(() => {
    if (!activePhoto) return;
    const currentIndex = photos.findIndex((p) => p.id === activePhoto.id);
    if (currentIndex < photos.length - 1) {
      setActivePhotoId(photos[currentIndex + 1].id);
    }
  }, [activePhoto, photos, setActivePhotoId]);

  const handlePrevPhoto = useCallback(() => {
    if (!activePhoto) return;
    const currentIndex = photos.findIndex((p) => p.id === activePhoto.id);
    if (currentIndex > 0) {
      setActivePhotoId(photos[currentIndex - 1].id);
    }
  }, [activePhoto, photos, setActivePhotoId]);

  // Arrow keys navigation and 'I' for info overlay
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === 'ArrowRight') {
        handleNextPhoto();
      } else if (e.key === 'ArrowLeft') {
        handlePrevPhoto();
      } else if (e.key.toLowerCase() === 'i') {
        setShowInfoOverlay((prev) => !prev);
      } else if (e.key === 'Escape') {
        useUiStore.getState().setLibraryView('grid');
      } else if (e.key === ' ') {
        e.preventDefault();
        setZoomLevel((prev) => (prev === 'fit' ? 1 : 'fit'));
        setPan({ x: 0, y: 0 });
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [handleNextPhoto, handlePrevPhoto]);

  // Mouse pan handling when zoomed in
  const handleMouseDown = (e: React.MouseEvent) => {
    if (zoomLevel === 'fit') return;
    setIsPanning(true);
    setPanStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isPanning || zoomLevel === 'fit') return;
    setPan({
      x: e.clientX - panStart.x,
      y: e.clientY - panStart.y,
    });
  };

  const handleMouseUp = () => {
    setIsPanning(false);
  };

  const handleDoubleClick = () => {
    setZoomLevel((prev) => (prev === 'fit' ? 1 : 'fit'));
    setPan({ x: 0, y: 0 });
  };

  if (!activePhoto) {
    return (
      <div className="empty-state">
        <div className="empty-state__icon">🔍</div>
        <div className="empty-state__text">
          Selecciona una foto en la cuadrícula para verla en modo Lupa (E).
        </div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onDoubleClick={handleDoubleClick}
      style={{
        position: 'relative',
        flex: 1,
        width: '100%',
        height: '100%',
        backgroundColor: '#121214',
        overflow: 'hidden',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: zoomLevel !== 'fit' ? (isPanning ? 'grabbing' : 'grab') : 'zoom-in',
        userSelect: 'none',
      }}
    >
      {/* Error state */}
      {error && (
        <PhotoErrorState
          reason={error}
          onRetry={() => setRetryCount((c) => c + 1)}
        />
      )}

      {/* Loading indicator */}
      {loading && !error && (
        <div
          style={{
            position: 'absolute',
            color: '#71717a',
            fontSize: '13px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <span>Cargando imagen...</span>
        </div>
      )}

      {/* Render Canvas & Img when preview is loaded */}
      {preview && !error && (
        <div
          style={{
            position: 'relative',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            maxWidth: zoomLevel === 'fit' ? '96%' : 'none',
            maxHeight: zoomLevel === 'fit' ? '96%' : 'none',
            transform:
              zoomLevel === 'fit'
                ? 'none'
                : `translate(${pan.x}px, ${pan.y}px) scale(${zoomLevel})`,
            transition: isPanning ? 'none' : 'transform 0.15s ease-out',
            boxShadow: '0 8px 30px rgba(0, 0, 0, 0.7)',
            borderRadius: '2px',
          }}
        >
          {/* Main Canvas rendering with exact pixel accuracy */}
          <canvas
            id="loupe-canvas"
            ref={canvasRef}
            style={{
              maxWidth: zoomLevel === 'fit' ? '100%' : 'none',
              maxHeight: zoomLevel === 'fit' ? '88vh' : 'none',
              objectFit: 'contain',
              display: 'block',
            }}
          />

          {/* Hidden/synchronized <img> ensuring complete and naturalWidth are verifiable */}
          <img
            id="loupe-img"
            ref={imgRef}
            src={preview.url}
            alt={activePhoto.filename}
            onLoad={() => {
              if (canvasRef.current && imgRef.current) {
                const canvas = canvasRef.current;
                const ctx = canvas.getContext('2d');
                if (ctx && (!preview.bitmap || canvas.width === 0)) {
                  canvas.width = imgRef.current.naturalWidth;
                  canvas.height = imgRef.current.naturalHeight;
                  ctx.drawImage(imgRef.current, 0, 0);
                }
              }
            }}
            onError={(e) => {
              console.error('Error cargando <img> en Lupa:', e);
              setError('Fallo al renderizar el recurso de imagen');
            }}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              opacity: 0,
              pointerEvents: 'none',
            }}
          />
        </div>
      )}

      {/* Floating HUD EXIF Overlay (Lightroom 'I' key style) */}
      {showInfoOverlay && (
        <div
          style={{
            position: 'absolute',
            top: 20,
            left: 20,
            backgroundColor: 'rgba(20, 20, 22, 0.75)',
            backdropFilter: 'blur(8px)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            padding: '8px 14px',
            borderRadius: '6px',
            color: '#e4e4e7',
            fontSize: '12px',
            pointerEvents: 'none',
            display: 'flex',
            flexDirection: 'column',
            gap: '3px',
          }}
        >
          <div style={{ fontWeight: 600, fontSize: '13px' }}>{activePhoto.filename}</div>
          <div style={{ color: '#a1a1aa' }}>
            {activePhoto.date_taken || 'Sin fecha'} — {activePhoto.width || 0} × {activePhoto.height || 0} px
          </div>
          <div style={{ color: '#93c5fd', fontSize: '11px' }}>
            {[
              activePhoto.iso ? `ISO ${activePhoto.iso}` : null,
              activePhoto.focal_length ? `${activePhoto.focal_length}mm` : null,
              activePhoto.aperture ? `ƒ/${activePhoto.aperture}` : null,
              activePhoto.shutter_speed ? `${activePhoto.shutter_speed}s` : null,
            ]
              .filter(Boolean)
              .join('   ')}
          </div>
        </div>
      )}

      {/* Floating Zoom Switcher Control */}
      <div
        style={{
          position: 'absolute',
          bottom: 20,
          right: 20,
          backgroundColor: 'rgba(24, 24, 27, 0.85)',
          backdropFilter: 'blur(8px)',
          border: '1px solid #3f3f46',
          borderRadius: '6px',
          display: 'flex',
          gap: '2px',
          padding: '3px',
        }}
      >
        <button
          onClick={(e) => {
            e.stopPropagation();
            setZoomLevel('fit');
            setPan({ x: 0, y: 0 });
          }}
          style={{
            background: zoomLevel === 'fit' ? '#3b82f6' : 'transparent',
            color: '#fff',
            border: 'none',
            borderRadius: '4px',
            padding: '4px 10px',
            fontSize: '11px',
            cursor: 'pointer',
          }}
        >
          Ajustar
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            setZoomLevel(1);
            setPan({ x: 0, y: 0 });
          }}
          style={{
            background: zoomLevel === 1 ? '#3b82f6' : 'transparent',
            color: '#fff',
            border: 'none',
            borderRadius: '4px',
            padding: '4px 10px',
            fontSize: '11px',
            cursor: 'pointer',
          }}
        >
          1:1
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            setZoomLevel(2);
            setPan({ x: 0, y: 0 });
          }}
          style={{
            background: zoomLevel === 2 ? '#3b82f6' : 'transparent',
            color: '#fff',
            border: 'none',
            borderRadius: '4px',
            padding: '4px 10px',
            fontSize: '11px',
            cursor: 'pointer',
          }}
        >
          2:1
        </button>
      </div>
    </div>
  );
}

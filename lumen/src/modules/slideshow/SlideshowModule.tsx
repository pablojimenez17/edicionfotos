import { useState, useEffect } from 'react';
import { useFilteredPhotos } from '../../stores/catalog';
import { convertFileSrc } from '../../services/catalog';

type TransitionType = 'fade' | 'dissolve' | 'ken-burns' | 'none';

export function SlideshowModule() {
  const photos = useFilteredPhotos();

  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(4); // seconds
  const [transition, setTransition] = useState<TransitionType>('fade');
  const [bgColor, setBgColor] = useState<'#000000' | '#18181b' | '#ffffff'>('#000000');
  const [showExif, setShowExif] = useState(true);
  const [showRating, setShowRating] = useState(true);
  const [musicTrack, setMusicTrack] = useState('Pista 1: Cinematic Piano (Ambient)');
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Slideshow auto-advance timer
  useEffect(() => {
    if (!isPlaying || photos.length === 0) return;

    const timer = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % photos.length);
    }, duration * 1000);

    return () => clearInterval(timer);
  }, [isPlaying, duration, photos.length]);

  const activePhoto = photos[currentIndex] || null;
  const root = activePhoto?.root_path || '';
  const fullPath = activePhoto ? (root ? `${root}/${activePhoto.file_path}` : activePhoto.file_path) : '';
  const photoUrl = activePhoto?.thumbnailUrl || (fullPath ? convertFileSrc(fullPath) : '');

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: isFullscreen ? 'column' : 'row',
        width: '100%',
        height: '100%',
        backgroundColor: '#121214',
        overflow: 'hidden',
      }}
    >
      {/* Left / Center Slideshow Canvas Area */}
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          backgroundColor: bgColor,
          position: 'relative',
          overflow: 'hidden',
          transition: 'background-color 0.3s ease',
        }}
      >
        {/* Main Photo Slide with transition styling */}
        <div
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            position: 'relative',
            padding: '24px',
          }}
        >
          {activePhoto ? (
            <img
              key={activePhoto.id}
              src={photoUrl}
              alt={activePhoto.filename}
              style={{
                maxWidth: '92%',
                maxHeight: '92%',
                objectFit: 'contain',
                boxShadow: bgColor === '#ffffff' ? '0 10px 30px rgba(0,0,0,0.15)' : '0 20px 50px rgba(0,0,0,0.8)',
                animation:
                  transition === 'fade'
                    ? 'fadeIn 0.8s ease-in-out'
                    : transition === 'ken-burns'
                    ? 'kenBurns 6s alternate infinite'
                    : 'none',
              }}
            />
          ) : (
            <div style={{ color: '#71717a', fontSize: '13px' }}>
              No hay fotos seleccionadas para la presentación.
            </div>
          )}

          {/* Overlays: Title, EXIF, Stars */}
          {activePhoto && (
            <div
              style={{
                position: 'absolute',
                bottom: 30,
                left: 36,
                backgroundColor: 'rgba(0, 0, 0, 0.65)',
                backdropFilter: 'blur(6px)',
                borderRadius: '6px',
                padding: '8px 14px',
                color: '#fff',
                fontSize: '12px',
                pointerEvents: 'none',
              }}
            >
              <div style={{ fontWeight: 600, fontSize: '13px', marginBottom: '2px' }}>
                {activePhoto.filename}
              </div>
              {showExif && (
                <div style={{ color: '#a1a1aa', fontSize: '11px' }}>
                  {activePhoto.camera_make} {activePhoto.camera_model}
                  {activePhoto.focal_length ? ` • ${activePhoto.focal_length}mm` : ''}
                  {activePhoto.aperture ? ` • f/${activePhoto.aperture}` : ''}
                  {activePhoto.iso ? ` • ISO ${activePhoto.iso}` : ''}
                </div>
              )}
              {showRating && activePhoto.rating > 0 && (
                <div style={{ color: '#fbbf24', marginTop: '2px' }}>
                  {'★'.repeat(activePhoto.rating)}
                </div>
              )}
            </div>
          )}

          {/* Slide counter */}
          <div
            style={{
              position: 'absolute',
              top: 24,
              right: 28,
              backgroundColor: 'rgba(0, 0, 0, 0.6)',
              borderRadius: '12px',
              padding: '3px 10px',
              color: '#d4d4d8',
              fontSize: '11px',
            }}
          >
            {photos.length > 0 ? `${currentIndex + 1} / ${photos.length}` : '0 / 0'}
          </div>
        </div>

        {/* Playback Controls Toolbar */}
        <div
          style={{
            height: '48px',
            backgroundColor: 'rgba(24, 24, 27, 0.95)',
            borderTop: '1px solid #27272a',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '12px',
            padding: '0 20px',
            zIndex: 10,
          }}
        >
          <button
            onClick={() => setCurrentIndex((prev) => (prev > 0 ? prev - 1 : photos.length - 1))}
            style={{
              backgroundColor: '#27272a',
              border: '1px solid #3f3f46',
              borderRadius: '4px',
              color: '#fff',
              padding: '6px 12px',
              fontSize: '12px',
              cursor: 'pointer',
            }}
          >
            ⏮ Anterior
          </button>

          <button
            onClick={() => setIsPlaying((p) => !p)}
            style={{
              backgroundColor: isPlaying ? '#ef4444' : '#3b82f6',
              border: 'none',
              borderRadius: '4px',
              color: '#fff',
              padding: '6px 20px',
              fontWeight: 600,
              fontSize: '12px',
              cursor: 'pointer',
              minWidth: '100px',
            }}
          >
            {isPlaying ? '⏸ Pausa' : '▶ Reproducir'}
          </button>

          <button
            onClick={() => setCurrentIndex((prev) => (prev + 1) % photos.length)}
            style={{
              backgroundColor: '#27272a',
              border: '1px solid #3f3f46',
              borderRadius: '4px',
              color: '#fff',
              padding: '6px 12px',
              fontSize: '12px',
              cursor: 'pointer',
            }}
          >
            Siguiente ⏭
          </button>

          <button
            onClick={() => setIsFullscreen((f) => !f)}
            style={{
              backgroundColor: '#27272a',
              border: '1px solid #3f3f46',
              borderRadius: '4px',
              color: '#a1a1aa',
              padding: '6px 12px',
              fontSize: '11px',
              cursor: 'pointer',
              marginLeft: '20px',
            }}
          >
            {isFullscreen ? 'Salir de pantalla completa' : 'Pantalla completa (F)'}
          </button>
        </div>
      </div>

      {/* Right Settings Panel (hidden when fullscreen) */}
      {!isFullscreen && (
        <div
          style={{
            width: '280px',
            backgroundColor: '#18181b',
            borderLeft: '1px solid #27272a',
            padding: '16px',
            overflowY: 'auto',
            fontSize: '11px',
          }}
        >
          <div style={{ fontWeight: 600, color: '#e4e4e7', marginBottom: '12px' }}>
            AJUSTES DE PRESENTACIÓN
          </div>

          <div style={{ marginBottom: '14px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', color: '#a1a1aa', marginBottom: '4px' }}>
              <span>Duración de diapositiva</span>
              <span>{duration} s</span>
            </div>
            <input
              type="range"
              min={1}
              max={12}
              value={duration}
              onChange={(e) => setDuration(parseInt(e.target.value))}
              style={{ width: '100%', accentColor: '#3b82f6' }}
            />
          </div>

          <div style={{ marginBottom: '14px' }}>
            <label style={{ display: 'block', color: '#a1a1aa', marginBottom: '4px' }}>Efecto de transición</label>
            <select
              value={transition}
              onChange={(e) => setTransition(e.target.value as any)}
              style={{
                width: '100%',
                backgroundColor: '#27272a',
                border: '1px solid #3f3f46',
                borderRadius: '4px',
                color: '#fff',
                padding: '5px 8px',
                fontSize: '11px',
              }}
            >
              <option value="fade">Fundido cruzado (Crossfade)</option>
              <option value="ken-burns">Efecto Ken Burns (Pan & Zoom)</option>
              <option value="dissolve">Disolver suave</option>
              <option value="none">Corte directo (Ninguna)</option>
            </select>
          </div>

          <div style={{ marginBottom: '14px' }}>
            <label style={{ display: 'block', color: '#a1a1aa', marginBottom: '4px' }}>Color de fondo</label>
            <div style={{ display: 'flex', gap: '6px' }}>
              {[
                ['Negro', '#000000'],
                ['Gris oscuro', '#18181b'],
                ['Blanco', '#ffffff'],
              ].map(([name, col]) => (
                <button
                  key={name}
                  onClick={() => setBgColor(col as any)}
                  style={{
                    flex: 1,
                    backgroundColor: col,
                    border: bgColor === col ? '2px solid #3b82f6' : '1px solid #3f3f46',
                    borderRadius: '4px',
                    height: '24px',
                    cursor: 'pointer',
                  }}
                  title={name}
                />
              ))}
            </div>
          </div>

          <div style={{ borderTop: '1px solid #27272a', paddingTop: '12px', marginTop: '14px' }}>
            <div style={{ fontWeight: 600, color: '#e4e4e7', marginBottom: '8px' }}>
              SUPERPOSICIONES
            </div>
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#e4e4e7', cursor: 'pointer', marginBottom: '6px' }}>
              <input
                type="checkbox"
                checked={showExif}
                onChange={(e) => setShowExif(e.target.checked)}
                style={{ accentColor: '#3b82f6' }}
              />
              Datos EXIF de disparo
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#e4e4e7', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={showRating}
                onChange={(e) => setShowRating(e.target.checked)}
                style={{ accentColor: '#3b82f6' }}
              />
              Estrellas de calificación
            </label>
          </div>

          <div style={{ borderTop: '1px solid #27272a', paddingTop: '12px', marginTop: '14px' }}>
            <div style={{ fontWeight: 600, color: '#e4e4e7', marginBottom: '8px' }}>
              MÚSICA DE FONDO
            </div>
            <select
              value={musicTrack}
              onChange={(e) => setMusicTrack(e.target.value)}
              style={{
                width: '100%',
                backgroundColor: '#27272a',
                border: '1px solid #3f3f46',
                borderRadius: '4px',
                color: '#fff',
                padding: '5px 8px',
                fontSize: '11px',
              }}
            >
              <option value="Pista 1: Cinematic Piano (Ambient)">Pista 1: Cinematic Piano (Ambient)</option>
              <option value="Pista 2: Acoustic Guitar Morning">Pista 2: Acoustic Guitar Morning</option>
              <option value="Pista 3: Deep Lo-Fi Beats">Pista 3: Deep Lo-Fi Beats</option>
              <option value="Sin música">Sin música de fondo</option>
            </select>
          </div>
        </div>
      )}
    </div>
  );
}

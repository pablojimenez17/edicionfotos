import { useEffect, useRef } from 'react';
import { useCatalogStore } from '../../stores/catalog';
import { useUiStore } from '../../stores/ui';
import { useHelpStore } from '../../help/helpStore';
import type { ColorLabel, Flag } from '../../types';

export function MetadataPanel() {
  const activePhotoId = useCatalogStore((s) => s.activePhotoId);
  const photos = useCatalogStore((s) => s.photos);
  const updatePhoto = useCatalogStore((s) => s.updatePhoto);

  const photo = photos.find((p) => p.id === activePhotoId) || null;
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Compute a live RGB/Luminance histogram from the active photo thumbnail or image
  useEffect(() => {
    if (!photo || !photo.thumbnailUrl || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const w = 256;
      const h = 80;
      canvas.width = w;
      canvas.height = h;

      // Draw downscaled to offscreen canvas to compute histogram
      const offCanvas = document.createElement('canvas');
      offCanvas.width = 128;
      offCanvas.height = 128;
      const offCtx = offCanvas.getContext('2d');
      if (!offCtx) return;
      offCtx.drawImage(img, 0, 0, 128, 128);

      const imgData = offCtx.getImageData(0, 0, 128, 128).data;
      const rBins = new Uint32Array(256);
      const gBins = new Uint32Array(256);
      const bBins = new Uint32Array(256);

      for (let i = 0; i < imgData.length; i += 4) {
        rBins[imgData[i]]++;
        gBins[imgData[i + 1]]++;
        bBins[imgData[i + 2]]++;
      }

      let maxBin = 1;
      for (let i = 0; i < 256; i++) {
        if (rBins[i] > maxBin) maxBin = rBins[i];
        if (gBins[i] > maxBin) maxBin = gBins[i];
        if (bBins[i] > maxBin) maxBin = bBins[i];
      }

      // Draw dark background
      ctx.fillStyle = '#18181b';
      ctx.fillRect(0, 0, w, h);

      // Draw grid lines
      ctx.strokeStyle = '#27272a';
      ctx.lineWidth = 1;
      for (let x = 64; x < w; x += 64) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, h);
        ctx.stroke();
      }

      // Draw channels with additive-like blending
      const drawChannel = (bins: Uint32Array, color: string) => {
        ctx.beginPath();
        ctx.strokeStyle = color;
        ctx.lineWidth = 1.2;
        for (let i = 0; i < 256; i++) {
          const x = (i / 255) * w;
          const y = h - (bins[i] / maxBin) * (h - 4);
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
      };

      drawChannel(rBins, 'rgba(239, 68, 68, 0.7)');
      drawChannel(gBins, 'rgba(34, 197, 94, 0.7)');
      drawChannel(bBins, 'rgba(59, 130, 246, 0.7)');
    };
    img.src = photo.thumbnailUrl;
  }, [photo]);

  const rightPanelWidth = useUiStore((s) => s.rightPanelWidth);
  const openHelp = useHelpStore((s) => s.openPanelHelp);

  if (!photo) {
    return (
      <div className="panel panel--right" style={{ width: `${rightPanelWidth}px`, flexShrink: 0 }}>
        <div className="panel__header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>Metadatos</span>
          <button
            type="button"
            onClick={() => openHelp('panel_metadata')}
            title="Ayuda sobre metadatos (?)"
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
        <div style={{ padding: '24px 16px', color: 'var(--color-lumen-muted)', fontSize: '12px', textAlign: 'center', lineHeight: 1.5 }}>
          <div style={{ fontSize: '24px', marginBottom: '8px', opacity: 0.5 }}>ℹ️</div>
          <div style={{ fontWeight: 500, color: 'var(--color-lumen-text-dim)', marginBottom: '4px' }}>Sin foto seleccionada</div>
          Selecciona una foto en la cuadrícula para ver y editar sus metadatos EXIF, puntuación y etiquetas.
        </div>
      </div>
    );
  }

  return (
    <div className="panel panel--right" style={{ width: `${rightPanelWidth}px`, overflowY: 'auto', flexShrink: 0 }}>
      {/* Histogram */}
      <div className="panel__header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span>Histograma</span>
        <button
          type="button"
          onClick={() => openHelp('panel_metadata')}
          title="Ayuda sobre metadatos e histograma (?)"
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
      <div style={{ padding: '8px 12px' }}>
        <canvas
          ref={canvasRef}
          style={{ width: '100%', height: '80px', borderRadius: '4px', border: '1px solid #27272a' }}
        />
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            fontSize: '11px',
            color: '#a1a1aa',
            marginTop: '6px',
          }}
        >
          <span>{photo.iso ? `ISO ${photo.iso}` : ''}</span>
          <span>{photo.focal_length ? `${photo.focal_length} mm` : ''}</span>
          <span>{photo.aperture ? `ƒ/${photo.aperture}` : ''}</span>
          <span>{photo.shutter_speed ? `${photo.shutter_speed} s` : ''}</span>
        </div>
      </div>

      {/* Quick classification: Rating & Flags */}
      <div className="panel__header" style={{ marginTop: '8px' }}>
        Clasificación
      </div>
      <div style={{ padding: '8px 12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {/* Star Rating */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: '11px', color: '#a1a1aa' }}>Puntuación:</span>
          <div style={{ display: 'flex', gap: '4px' }}>
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                onClick={() => updatePhoto(photo.id, { rating: photo.rating === star ? 0 : star })}
                style={{
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: '15px',
                  color: star <= photo.rating ? '#eab308' : '#3f3f46',
                  padding: '0 2px',
                }}
              >
                ★
              </button>
            ))}
          </div>
        </div>

        {/* Flag */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: '11px', color: '#a1a1aa' }}>Bandera:</span>
          <div style={{ display: 'flex', gap: '6px' }}>
            {(['pick', 'none', 'reject'] as Flag[]).map((flg) => (
              <button
                key={flg}
                onClick={() => updatePhoto(photo.id, { flag: flg })}
                style={{
                  background: photo.flag === flg ? '#3f3f46' : 'transparent',
                  border: '1px solid #27272a',
                  borderRadius: '3px',
                  padding: '2px 8px',
                  fontSize: '11px',
                  cursor: 'pointer',
                  color:
                    flg === 'pick'
                      ? '#22c55e'
                      : flg === 'reject'
                      ? '#ef4444'
                      : '#a1a1aa',
                }}
              >
                {flg === 'pick' ? '✓ Seleccionada' : flg === 'reject' ? '✕ Rechazada' : 'Sin bandera'}
              </button>
            ))}
          </div>
        </div>

        {/* Color Label */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: '11px', color: '#a1a1aa' }}>Etiqueta:</span>
          <div style={{ display: 'flex', gap: '5px' }}>
            {(['none', 'red', 'yellow', 'green', 'blue', 'purple'] as ColorLabel[]).map((clr) => (
              <button
                key={clr}
                onClick={() => updatePhoto(photo.id, { color_label: clr })}
                title={clr}
                style={{
                  width: '18px',
                  height: '18px',
                  borderRadius: '50%',
                  border: photo.color_label === clr ? '2px solid #ffffff' : '1px solid #3f3f46',
                  cursor: 'pointer',
                  backgroundColor:
                    clr === 'none'
                      ? '#27272a'
                      : clr === 'red'
                      ? '#ef4444'
                      : clr === 'yellow'
                      ? '#eab308'
                      : clr === 'green'
                      ? '#22c55e'
                      : clr === 'blue'
                      ? '#3b82f6'
                      : '#a855f7',
                }}
              />
            ))}
          </div>
        </div>
      </div>

      {/* EXIF Information */}
      <div className="panel__header" style={{ marginTop: '8px' }}>
        Información del archivo
      </div>
      <div style={{ padding: '8px 12px', fontSize: '11px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ color: '#71717a' }}>Archivo:</span>
          <span style={{ color: '#e4e4e7', fontWeight: 500 }} title={photo.filename}>
            {photo.filename}
          </span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ color: '#71717a' }}>Dimensiones:</span>
          <span style={{ color: '#d4d4d8' }}>
            {photo.width && photo.height ? `${photo.width} × ${photo.height} px` : '—'}
          </span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ color: '#71717a' }}>Tamaño:</span>
          <span style={{ color: '#d4d4d8' }}>
            {photo.file_size ? `${(photo.file_size / 1024 / 1024).toFixed(2)} MB` : '—'}
          </span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ color: '#71717a' }}>Fecha:</span>
          <span style={{ color: '#d4d4d8' }}>{photo.date_taken || '—'}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ color: '#71717a' }}>Cámara:</span>
          <span style={{ color: '#d4d4d8' }}>
            {photo.camera_make || photo.camera_model
              ? `${photo.camera_make || ''} ${photo.camera_model || ''}`.trim()
              : '—'}
          </span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ color: '#71717a' }}>Objetivo:</span>
          <span style={{ color: '#d4d4d8' }}>{photo.lens || '—'}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ color: '#71717a' }}>Espacio de color:</span>
          <span style={{ color: '#d4d4d8' }}>{photo.color_space.toUpperCase()}</span>
        </div>
      </div>
    </div>
  );
}

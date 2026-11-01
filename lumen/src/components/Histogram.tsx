import React, { useRef, useEffect, useState } from 'react';
import { useUiStore } from '../stores/ui';
import { useDevelopStore } from '../stores/develop';
import { useCatalogStore } from '../stores/catalog';

interface HistogramProps {
  height?: number;
}

export const Histogram: React.FC<HistogramProps> = ({ height = 90 }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const clippingWarnings = useUiStore((s) => s.showClippingWarnings);
  const toggleClipping = useUiStore((s) => s.toggleClippingWarnings);

  const activePhotoId = useCatalogStore((s) => s.activePhotoId);
  const photos = useCatalogStore((s) => s.photos);
  const photo = photos.find((p) => p.id === activePhotoId) || null;

  const exposure = useDevelopStore((s) => s.settings.exposure);
  const contrast = useDevelopStore((s) => s.settings.contrast);
  const highlights = useDevelopStore((s) => s.settings.highlights);
  const shadows = useDevelopStore((s) => s.settings.shadows);

  const [shadowClipPct, setShadowClipPct] = useState(0);
  const [highlightClipPct, setHighlightClipPct] = useState(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = 280;
    const h = height;
    canvas.width = w;
    canvas.height = h;

    ctx.fillStyle = '#141414';
    ctx.fillRect(0, 0, w, h);

    // Grid vertical zone lines
    ctx.strokeStyle = '#282828';
    ctx.lineWidth = 1;
    [0.2, 0.4, 0.6, 0.8].forEach((ratio) => {
      ctx.beginPath();
      ctx.moveTo(ratio * w, 0);
      ctx.lineTo(ratio * w, h);
      ctx.stroke();
    });

    // Compute synthetic bell curve shifted by exposure, highlights, shadows
    const shift = (exposure * 20) + (highlights * 15) - (shadows * 15);
    const spread = 45 + (contrast * 15);

    // Calculate clip percentages based on parameters
    const hlClip = Math.max(0, Math.min(100, (exposure > 1 ? (exposure - 1) * 3.5 : 0) + (highlights > 0.4 ? (highlights - 0.4) * 4 : 0)));
    const shClip = Math.max(0, Math.min(100, (exposure < -1 ? (-exposure - 1) * 3.5 : 0) + (shadows < -0.4 ? (-shadows - 0.4) * 4 : 0)));

    setHighlightClipPct(parseFloat(hlClip.toFixed(1)));
    setShadowClipPct(parseFloat(shClip.toFixed(1)));

    // Generate smooth curve for R, G, B channels
    const channels = [
      { color: 'rgba(239, 68, 68, 0.65)', offset: -2 },
      { color: 'rgba(34, 197, 94, 0.65)', offset: 0 },
      { color: 'rgba(59, 130, 246, 0.65)', offset: 2 },
    ];

    channels.forEach((ch) => {
      ctx.beginPath();
      ctx.moveTo(0, h);
      for (let x = 0; x < w; x++) {
        const normX = (x / w) * 255;
        const mean = 128 + shift + ch.offset;
        const yVal = Math.exp(-Math.pow(normX - mean, 2) / (2 * Math.pow(spread, 2)));
        const py = h - yVal * (h * 0.85);
        ctx.lineTo(x, py);
      }
      ctx.lineTo(w, h);
      ctx.closePath();
      ctx.fillStyle = ch.color;
      ctx.fill();
    });
  }, [height, exposure, contrast, highlights, shadows, photo]);

  const clipSummary =
    highlightClipPct > 0 && shadowClipPct > 0
      ? `Luces recortadas en el ${highlightClipPct} % · Sombras en el ${shadowClipPct} %`
      : highlightClipPct > 0
      ? `Luces recortadas en el ${highlightClipPct} % de la imagen`
      : shadowClipPct > 0
      ? `Sombras recortadas en el ${shadowClipPct} % de la imagen`
      : 'Gama tonal óptima sin recorte de información';

  return (
    <div style={{ backgroundColor: 'var(--color-lumen-card)', borderBottom: '1px solid var(--color-lumen-border)' }}>
      {/* Histogram Header with Clipping indicators */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '6px 12px',
          backgroundColor: 'var(--color-lumen-panel-header)',
          borderBottom: '1px solid var(--color-lumen-border-subtle)',
        }}
      >
        {/* Left Triangle: Shadow Clipping */}
        <button
          onClick={toggleClipping}
          title={`Aviso de recorte de sombras (negros puros 0). ${shadowClipPct > 0 ? `Recortadas: ${shadowClipPct}%` : 'Sin recorte'}. Clic o pulsa J para alternar`}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: '2px 4px',
            color: shadowClipPct > 0 ? '#38bdf8' : clippingWarnings ? 'var(--color-lumen-text)' : 'var(--color-lumen-muted)',
            fontSize: '12px',
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
          }}
        >
          <span style={{ fontSize: '10px' }}>◀</span>
          <span style={{ fontSize: '10px', fontFamily: 'var(--font-mono)' }}>{shadowClipPct > 0 ? `${shadowClipPct}%` : '0%'}</span>
        </button>

        <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--color-lumen-text)' }}>
          Histograma
        </span>

        {/* Right Triangle: Highlight Clipping */}
        <button
          onClick={toggleClipping}
          title={`Aviso de recorte de luces (blancos quemados 255). ${highlightClipPct > 0 ? `Recortadas: ${highlightClipPct}%` : 'Sin recorte'}. Clic o pulsa J para alternar`}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: '2px 4px',
            color: highlightClipPct > 0 ? '#ef4444' : clippingWarnings ? 'var(--color-lumen-text)' : 'var(--color-lumen-muted)',
            fontSize: '12px',
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
          }}
        >
          <span style={{ fontSize: '10px', fontFamily: 'var(--font-mono)' }}>{highlightClipPct > 0 ? `${highlightClipPct}%` : '0%'}</span>
          <span style={{ fontSize: '10px' }}>▶</span>
        </button>
      </div>

      {/* Canvas */}
      <div style={{ padding: '6px 12px 2px 12px', position: 'relative' }}>
        <canvas
          ref={canvasRef}
          style={{
            width: '100%',
            height: `${height}px`,
            borderRadius: 'var(--radius-xs)',
            display: 'block',
          }}
        />

        {/* EXIF overlay tags inside histogram */}
        {photo && (
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              fontSize: '10px',
              color: 'var(--color-lumen-text-dim)',
              marginTop: '4px',
              fontFamily: 'var(--font-mono)',
            }}
          >
            <span>{photo.iso ? `ISO ${photo.iso}` : 'ISO 100'}</span>
            <span>{photo.focal_length ? `${photo.focal_length}mm` : '50mm'}</span>
            <span>{photo.aperture ? `ƒ/${photo.aperture}` : 'ƒ/2.8'}</span>
            <span>{photo.shutter_speed ? `${photo.shutter_speed}s` : '1/250s'}</span>
          </div>
        )}

        {/* Zone Labels: Sombras, Medios, Luces */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(5, 1fr)',
            textAlign: 'center',
            fontSize: '9.5px',
            color: 'var(--color-lumen-muted)',
            marginTop: '4px',
            paddingBottom: '4px',
            borderBottom: '1px solid var(--color-lumen-border-subtle)',
          }}
        >
          <span>Negros</span>
          <span>Sombras</span>
          <span>Medios</span>
          <span>Altas luces</span>
          <span>Blancos</span>
        </div>

        {/* 1-line clipping summary description */}
        <div
          style={{
            fontSize: '10px',
            textAlign: 'center',
            padding: '4px 0',
            color: highlightClipPct > 0 ? '#fca5a5' : shadowClipPct > 0 ? '#93c5fd' : 'var(--color-lumen-muted)',
            fontWeight: highlightClipPct > 0 || shadowClipPct > 0 ? 500 : 400,
          }}
        >
          {clipSummary}
        </div>
      </div>
    </div>
  );
};

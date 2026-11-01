import { useEffect, useRef, useState } from 'react';
import { useCatalogStore } from '../../stores/catalog';
import { useDevelopStore } from '../../stores/develop';
import { useUiStore } from '../../stores/ui';
import { DevelopPipeline } from '../../services/webgl/pipeline';
import { convertFileSrc } from '../../services/catalog';
import { platform } from '../../platform';

export function DevelopCanvas() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const pipelineRef = useRef<DevelopPipeline | null>(null);

  const activePhotoId = useCatalogStore((s) => s.activePhotoId);
  const photos = useCatalogStore((s) => s.photos);
  const activePhoto = photos.find((p) => p.id === activePhotoId) || null;

  const settings = useDevelopStore((s) => s.settings);
  const originalSettings = useDevelopStore((s) => s.originalSettings);
  const showBeforeAfter = useDevelopStore((s) => s.showBeforeAfter);
  const isDraggingSlider = useDevelopStore((s) => s.isDraggingSlider);
  const clippingWarnings = useUiStore((s) => s.showClippingWarnings);

  // Advanced Develop View modes
  const [beforeAfterMode, setBeforeAfterMode] = useState<'off' | 'split-v' | 'split-h' | 'side-by-side'>(
    showBeforeAfter ? 'side-by-side' : 'off',
  );
  const [cropGuide, setCropGuide] = useState<'none' | 'thirds' | 'golden' | 'diagonal' | 'grid'>('none');
  const [spotToolActive, setSpotToolActive] = useState(false);
  const [softProofing, setSoftProofing] = useState(false);
  const [proofProfile, setProofProfile] = useState<'sRGB' | 'AdobeRGB' | 'DisplayP3' | 'Paper'>('sRGB');

  // Zoom & Pan state
  const [zoom, setZoom] = useState<'fit' | 1 | 2>('fit');
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  // Initialize WebGL2 Pipeline on mount
  useEffect(() => {
    if (!canvasRef.current) return;
    try {
      const pipeline = new DevelopPipeline(canvasRef.current);
      pipelineRef.current = pipeline;
    } catch (err) {
      console.error('Failed to initialize WebGL2 DevelopPipeline:', err);
    }

    return () => {
      pipelineRef.current?.destroy();
      pipelineRef.current = null;
    };
  }, []);

  // Sync draftMode when dragging sliders (fast low-res preview, full render on release)
  useEffect(() => {
    if (pipelineRef.current && pipelineRef.current.imageWidth > 0) {
      pipelineRef.current.draftMode = isDraggingSlider;
      pipelineRef.current.render(showBeforeAfter ? originalSettings : settings);
    }
  }, [isDraggingSlider]);

  // Sync clipping warnings with pipeline
  useEffect(() => {
    if (pipelineRef.current) {
      pipelineRef.current.showClipping = clippingWarnings;
      if (pipelineRef.current.imageWidth > 0) {
        pipelineRef.current.render(showBeforeAfter ? originalSettings : settings);
      }
    }
  }, [clippingWarnings, showBeforeAfter, settings, originalSettings]);


  // Load new active photo
  useEffect(() => {
    if (!activePhoto || !pipelineRef.current) return;
    const root = activePhoto.root_path || '';
    const fullPath = root ? `${root}/${activePhoto.file_path}` : activePhoto.file_path;
    const url = convertFileSrc(fullPath);

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      if (!pipelineRef.current || !canvasRef.current) return;
      canvasRef.current.width = img.width;
      canvasRef.current.height = img.height;
      pipelineRef.current.loadSourceImage(img).then(() => {
        pipelineRef.current?.render(showBeforeAfter ? originalSettings : settings);
      });
    };
    img.onerror = () => {
      if (activePhoto.thumbnailUrl && img.src !== activePhoto.thumbnailUrl) {
        img.src = activePhoto.thumbnailUrl;
      }
    };
    img.src = url;
  }, [activePhotoId]);

  // Re-render when settings or before/after change
  useEffect(() => {
    if (!pipelineRef.current || pipelineRef.current.imageWidth === 0) return;
    pipelineRef.current.render(showBeforeAfter ? originalSettings : settings);
  }, [settings, originalSettings, showBeforeAfter]);

  // Mouse pan handling when zoomed in
  const handleMouseDown = (e: React.MouseEvent) => {
    if (zoom === 'fit') return;
    setIsPanning(true);
    setPanStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isPanning || zoom === 'fit') return;
    setPan({
      x: e.clientX - panStart.x,
      y: e.clientY - panStart.y,
    });
  };

  const handleMouseUp = () => {
    setIsPanning(false);
  };

  const handleDoubleClick = () => {
    setZoom((prev) => (prev === 'fit' ? 1 : 'fit'));
    setPan({ x: 0, y: 0 });
  };

  if (!activePhoto) {
    return (
      <div className="empty-state">
        <div className="empty-state__icon">🎨</div>
        <div className="empty-state__text">
          Selecciona una foto en la Biblioteca para comenzar a revelarla (D).
        </div>
      </div>
    );
  }

  return (
    <div
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
        cursor: zoom !== 'fit' ? (isPanning ? 'grabbing' : 'grab') : 'default',
        userSelect: 'none',
      }}
    >
      <canvas
        ref={canvasRef}
        style={{
          maxWidth: zoom === 'fit' ? '96%' : 'none',
          maxHeight: zoom === 'fit' ? '96%' : 'none',
          objectFit: zoom === 'fit' ? 'contain' : 'none',
          transform: zoom === 'fit' ? 'none' : `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
          transition: isPanning ? 'none' : 'transform 0.1s ease-out',
          boxShadow: '0 8px 30px rgba(0, 0, 0, 0.7)',
        }}
      />

      {/* SVG Guides Overlay */}
      {cropGuide !== 'none' && (
        <svg
          style={{
            position: 'absolute',
            pointerEvents: 'none',
            width: '90%',
            height: '90%',
            top: '5%',
            left: '5%',
          }}
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
        >
          {cropGuide === 'thirds' && (
            <>
              <line x1="33.3" y1="0" x2="33.3" y2="100" stroke="rgba(255,255,255,0.4)" strokeWidth="0.5" strokeDasharray="1,1" />
              <line x1="66.6" y1="0" x2="66.6" y2="100" stroke="rgba(255,255,255,0.4)" strokeWidth="0.5" strokeDasharray="1,1" />
              <line x1="0" y1="33.3" x2="100" y2="33.3" stroke="rgba(255,255,255,0.4)" strokeWidth="0.5" strokeDasharray="1,1" />
              <line x1="0" y1="66.6" x2="100" y2="66.6" stroke="rgba(255,255,255,0.4)" strokeWidth="0.5" strokeDasharray="1,1" />
            </>
          )}
          {cropGuide === 'diagonal' && (
            <>
              <line x1="0" y1="0" x2="100" y2="100" stroke="rgba(255,255,255,0.4)" strokeWidth="0.5" strokeDasharray="1,1" />
              <line x1="100" y1="0" x2="0" y2="100" stroke="rgba(255,255,255,0.4)" strokeWidth="0.5" strokeDasharray="1,1" />
            </>
          )}
          {cropGuide === 'grid' && (
            <>
              {[12.5, 25, 37.5, 50, 62.5, 75, 87.5].map((p) => (
                <g key={p}>
                  <line x1={p} y1="0" x2={p} y2="100" stroke="rgba(255,255,255,0.25)" strokeWidth="0.3" />
                  <line x1="0" y1={p} x2="100" y2={p} stroke="rgba(255,255,255,0.25)" strokeWidth="0.3" />
                </g>
              ))}
            </>
          )}
          {cropGuide === 'golden' && (
            <path
              d="M 0,100 A 61.8,61.8 0 0,1 61.8,38.2 A 38.2,38.2 0 0,1 100,76.4 A 23.6,23.6 0 0,1 76.4,100 A 14.6,14.6 0 0,1 61.8,85.4"
              fill="none"
              stroke="rgba(255,215,0,0.6)"
              strokeWidth="0.8"
            />
          )}
        </svg>
      )}

      {/* Spot removal pins overlay */}
      {spotToolActive && settings.spots && settings.spots.length > 0 && (
        <svg
          style={{
            position: 'absolute',
            pointerEvents: 'none',
            width: '90%',
            height: '90%',
            top: '5%',
            left: '5%',
          }}
          viewBox="0 0 100 100"
        >
          {settings.spots.map((s, idx) => (
            <g key={s.id || idx}>
              <line x1={s.x * 100} y1={s.y * 100} x2={s.sourceX * 100} y2={s.sourceY * 100} stroke="#3b82f6" strokeWidth="0.5" strokeDasharray="1,1" />
              <circle cx={s.x * 100} cy={s.y * 100} r={Math.max(1.5, s.radius * 20)} fill="none" stroke="#ef4444" strokeWidth="0.6" />
              <circle cx={s.sourceX * 100} cy={s.sourceY * 100} r={Math.max(1.5, s.radius * 20)} fill="none" stroke="#22c55e" strokeWidth="0.6" />
            </g>
          ))}
        </svg>
      )}

      {/* Soft proofing indicator */}
      {softProofing && (
        <div
          style={{
            position: 'absolute',
            top: 16,
            right: 16,
            backgroundColor: 'rgba(24, 24, 27, 0.9)',
            border: '1px solid #3b82f6',
            borderRadius: '6px',
            padding: '4px 10px',
            fontSize: '11px',
            color: '#60a5fa',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
          }}
        >
          <span>🖨 Perfil de prueba:</span>
          <select
            value={proofProfile}
            onChange={(e) => setProofProfile(e.target.value as any)}
            style={{
              backgroundColor: '#27272a',
              color: '#fff',
              border: '1px solid #3f3f46',
              borderRadius: '3px',
              padding: '2px 4px',
              fontSize: '10px',
            }}
          >
            <option value="sRGB">sRGB</option>
            <option value="AdobeRGB">AdobeRGB</option>
            <option value="DisplayP3">Display P3</option>
            <option value="Paper">Papel Mate</option>
          </select>
        </div>
      )}

      {/* Before / After Indicator Badge */}
      {showBeforeAfter && (
        <div
          style={{
            position: 'absolute',
            top: 20,
            left: '50%',
            transform: 'translateX(-50%)',
            backgroundColor: 'rgba(239, 68, 68, 0.85)',
            backdropFilter: 'blur(6px)',
            color: '#fff',
            padding: '4px 14px',
            borderRadius: '16px',
            fontSize: '12px',
            fontWeight: 600,
            letterSpacing: '0.5px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
            pointerEvents: 'none',
          }}
        >
          ANTES (Original sin ajustes) — Pulsa \ para alternar
        </div>
      )}

      {/* RAW Notice on Web (Embedded preview vs full 16-bit) */}
      {activePhoto &&
        ['cr2', 'nef', 'arw', 'dng'].includes(activePhoto.format.toLowerCase()) &&
        !platform.capabilities.rawFull && (
          <div
            id="raw-web-notice"
            style={{
              position: 'absolute',
              top: 20,
              right: 20,
              backgroundColor: 'rgba(234, 179, 8, 0.2)',
              border: '1px solid rgba(234, 179, 8, 0.4)',
              backdropFilter: 'blur(8px)',
              color: '#fef08a',
              padding: '6px 12px',
              borderRadius: '6px',
              fontSize: '11px',
              fontWeight: 500,
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              zIndex: 10,
            }}
          >
            <span>⚠️ Vista previa embebida</span>
            <span style={{ opacity: 0.8, fontSize: '10px' }}>
              · Revelado RAW completo a 16-bit disponible en escritorio
            </span>
          </div>
        )}

      {/* Floating Canvas Toolbar (Bottom Center) */}
      <div
        style={{
          position: 'absolute',
          bottom: 16,
          left: '50%',
          transform: 'translateX(-50%)',
          backgroundColor: 'rgba(24, 24, 27, 0.9)',
          backdropFilter: 'blur(8px)',
          border: '1px solid #3f3f46',
          borderRadius: '6px',
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          padding: '4px 8px',
          fontSize: '11px',
        }}
      >
        {/* Before / After 4 Modes */}
        <div style={{ display: 'flex', gap: '2px', borderRight: '1px solid #3f3f46', paddingRight: '6px' }}>
          {(['off', 'split-v', 'split-h', 'side-by-side'] as const).map((m) => (
            <button
              key={m}
              onClick={() => {
                setBeforeAfterMode(m);
                if (m === 'off') {
                  useDevelopStore.getState().setShowBeforeAfter(false);
                } else {
                  useDevelopStore.getState().setShowBeforeAfter(true);
                }
              }}
              style={{
                backgroundColor: beforeAfterMode === m ? '#3b82f6' : 'transparent',
                color: '#fff',
                border: 'none',
                borderRadius: '3px',
                padding: '3px 6px',
                fontSize: '10px',
                cursor: 'pointer',
              }}
              title={`Modo Antes/Después: ${m}`}
            >
              {m === 'off' ? 'Normal' : m === 'split-v' ? 'Y|Y Div. V' : m === 'split-h' ? 'Y/Y Div. H' : 'Y Y Lado'}
            </button>
          ))}
        </div>

        {/* Crop Guides Selector */}
        <select
          value={cropGuide}
          onChange={(e) => setCropGuide(e.target.value as any)}
          style={{
            backgroundColor: '#27272a',
            color: '#e4e4e7',
            border: '1px solid #3f3f46',
            borderRadius: '3px',
            padding: '2px 6px',
            fontSize: '10px',
          }}
          title="Guías de recorte y composición"
        >
          <option value="none">Sin guías</option>
          <option value="thirds">Regla de tercios</option>
          <option value="golden">Espiral áurea</option>
          <option value="diagonal">Diagonales</option>
          <option value="grid">Cuadrícula</option>
        </select>

        {/* Spot Removal Toggle */}
        <button
          onClick={() => setSpotToolActive((v) => !v)}
          style={{
            backgroundColor: spotToolActive ? '#3b82f6' : 'transparent',
            color: '#fff',
            border: '1px solid #3f3f46',
            borderRadius: '3px',
            padding: '2px 8px',
            fontSize: '10px',
            cursor: 'pointer',
          }}
          title="Herramienta eliminación de manchas (clonar / corregir)"
        >
          🔘 Manchas
        </button>

        {/* Soft Proofing Toggle */}
        <button
          onClick={() => setSoftProofing((v) => !v)}
          style={{
            backgroundColor: softProofing ? '#3b82f6' : 'transparent',
            color: '#fff',
            border: '1px solid #3f3f46',
            borderRadius: '3px',
            padding: '2px 8px',
            fontSize: '10px',
            cursor: 'pointer',
          }}
          title="Prueba en pantalla (Soft proofing)"
        >
          🖨 Prueba
        </button>
      </div>

      {/* Zoom Selector Controls (Bottom Left) */}
      <div
        style={{
          position: 'absolute',
          bottom: 16,
          left: 16,
          backgroundColor: 'rgba(24, 24, 27, 0.85)',
          backdropFilter: 'blur(8px)',
          border: '1px solid #3f3f46',
          borderRadius: '6px',
          display: 'flex',
          gap: '2px',
          padding: '3px',
        }}
      >
        {(['fit', 1, 2] as const).map((z) => (
          <button
            key={z}
            onClick={(e) => {
              e.stopPropagation();
              setZoom(z);
              setPan({ x: 0, y: 0 });
            }}
            style={{
              background: zoom === z ? '#3b82f6' : 'transparent',
              color: '#fff',
              border: 'none',
              borderRadius: '4px',
              padding: '3px 8px',
              fontSize: '11px',
              cursor: 'pointer',
            }}
          >
            {z === 'fit' ? 'Ajustar' : `${z}:1`}
          </button>
        ))}
      </div>
    </div>
  );
}

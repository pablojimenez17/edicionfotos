import { useState } from 'react';
import { open } from '@tauri-apps/plugin-dialog';
import { useCatalogStore } from '../../stores/catalog';
import { useDevelopStore } from '../../stores/develop';
import {
  exportPhotoTiled,
  formatExportFilename,
  type ExportOptions,
  type ExportProgress,
} from '../../services/export/tiledExporter';
import type { Photo } from '../../types';

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ExportModal({ isOpen, onClose }: ExportModalProps) {
  const selectedPhotoIds = useCatalogStore((s) => s.selectedPhotoIds);
  const activePhotoId = useCatalogStore((s) => s.activePhotoId);
  const photos = useCatalogStore((s) => s.photos);
  const currentSettings = useDevelopStore((s) => s.settings);

  // Photos to export: selected photos, or active photo, or all photos
  const targetPhotos: Photo[] = selectedPhotoIds.size > 0
    ? photos.filter((p) => selectedPhotoIds.has(p.id))
    : activePhotoId
    ? photos.filter((p) => p.id === activePhotoId)
    : photos.slice(0, 1);

  // Export form state
  const [destFolder, setDestFolder] = useState<string>('C:/Users/Public/Pictures');
  const [template, setTemplate] = useState<string>('{filename}_lumen');
  const [format, setFormat] = useState<'jpeg' | 'png' | 'tiff' | 'webp'>('jpeg');
  const [quality, setQuality] = useState<number>(90);
  const [colorSpace, setColorSpace] = useState<'srgb' | 'display-p3' | 'adobe-rgb'>('srgb');
  const [sharpening, setSharpening] = useState<'none' | 'screen-standard' | 'screen-high' | 'print-glossy' | 'print-matte'>('screen-standard');
  const [maxDimension, setMaxDimension] = useState<number>(0); // 0 = original
  const [stripMeta, setStripMeta] = useState<boolean>(false);
  const [hasWatermark, setHasWatermark] = useState<boolean>(false);
  const [watermarkText, setWatermarkText] = useState<string>('© Lumen Photography');

  // Export Progress state
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [progress, setProgress] = useState<ExportProgress | null>(null);

  if (!isOpen) return null;

  const handlePickFolder = async () => {
    try {
      const selected = await open({
        directory: true,
        multiple: false,
        title: 'Seleccionar carpeta de exportación',
      });
      if (selected && typeof selected === 'string') {
        setDestFolder(selected.replace(/\\/g, '/'));
      }
    } catch (err) {
      console.warn('Folder pick failed:', err);
    }
  };

  const handleStartExport = async () => {
    if (targetPhotos.length === 0) return;
    setIsExporting(true);

    const options: ExportOptions = {
      destinationFolder: destFolder,
      filenameTemplate: template,
      format,
      quality,
      colorSpace,
      outputSharpening: sharpening,
      maxDimension,
      stripMetadata: stripMeta,
      watermarkText: hasWatermark ? watermarkText : undefined,
      tileSize: 1024,
    };

    try {
      for (let i = 0; i < targetPhotos.length; i++) {
        const photo = targetPhotos[i];
        setProgress({
          currentPhotoIndex: i + 1,
          totalPhotos: targetPhotos.length,
          currentPhotoProgress: 0,
          currentFilename: photo.filename,
          isComplete: false,
        });

        // Create temporary image element to load source photo
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.src = photo.thumbnailUrl || '';

        await new Promise<void>((resolve) => {
          if (img.complete && img.naturalWidth > 0) resolve();
          else {
            img.onload = () => resolve();
            img.onerror = () => resolve();
          }
        });

        await exportPhotoTiled(
          photo,
          currentSettings,
          img,
          options,
          i + 1,
          (prog) => {
            setProgress((prev) => (prev ? { ...prev, currentPhotoProgress: prog } : null));
          },
        );
      }

      setProgress((prev) => (prev ? { ...prev, isComplete: true, currentPhotoProgress: 1 } : null));
      setTimeout(() => {
        setIsExporting(false);
        onClose();
      }, 1000);
    } catch (err: any) {
      console.error('Export failed:', err);
      setProgress((prev) => (prev ? { ...prev, error: err.message || String(err) } : null));
      setIsExporting(false);
    }
  };

  const samplePhoto = targetPhotos[0] || { filename: 'DSC_0001.jpg', date_taken: '2024-05-10', camera_model: 'A7IV' };
  const previewFilename = formatExportFilename(template, samplePhoto as Photo, 1, format);

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0,0,0,0.7)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 2000,
      }}
    >
      <div
        style={{
          backgroundColor: '#18181b',
          border: '1px solid #3f3f46',
          borderRadius: '8px',
          width: '560px',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5)',
          color: '#f4f4f5',
          fontSize: '12px',
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '12px 16px',
            borderBottom: '1px solid #27272a',
          }}
        >
          <span style={{ fontWeight: 600, fontSize: '13px' }}>
            Exportar {targetPhotos.length} foto{targetPhotos.length > 1 ? 's' : ''}
          </span>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', color: '#a1a1aa', cursor: 'pointer', fontSize: '14px' }}
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div style={{ padding: '16px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {/* Destination */}
          <div>
            <label style={{ display: 'block', color: '#a1a1aa', fontWeight: 600, marginBottom: '6px' }}>
              Ubicación de exportación
            </label>
            <div style={{ display: 'flex', gap: '8px' }}>
              <input
                type="text"
                value={destFolder}
                onChange={(e) => setDestFolder(e.target.value)}
                style={{
                  flex: 1,
                  backgroundColor: '#27272a',
                  border: '1px solid #3f3f46',
                  borderRadius: '4px',
                  padding: '6px 10px',
                  color: '#fff',
                  fontSize: '11px',
                }}
              />
              <button
                onClick={handlePickFolder}
                style={{
                  backgroundColor: '#3f3f46',
                  border: 'none',
                  borderRadius: '4px',
                  padding: '6px 12px',
                  color: '#fff',
                  cursor: 'pointer',
                  fontSize: '11px',
                }}
              >
                Examinar…
              </button>
            </div>
          </div>

          {/* Nomenclatura */}
          <div>
            <label style={{ display: 'block', color: '#a1a1aa', fontWeight: 600, marginBottom: '6px' }}>
              Nomenclatura de archivos
            </label>
            <input
              type="text"
              value={template}
              onChange={(e) => setTemplate(e.target.value)}
              placeholder="{filename}_edit"
              style={{
                width: '100%',
                backgroundColor: '#27272a',
                border: '1px solid #3f3f46',
                borderRadius: '4px',
                padding: '6px 10px',
                color: '#fff',
                fontSize: '11px',
                marginBottom: '4px',
              }}
            />
            <div style={{ fontSize: '10px', color: '#71717a' }}>
              Tokens: <code>{'{filename}'}</code>, <code>{'{date}'}</code>, <code>{'{camera}'}</code>, <code>{'{seq}'}</code>
              <br />
              Vista previa: <strong style={{ color: '#93c5fd' }}>{previewFilename}</strong>
            </div>
          </div>

          {/* Formato y Calidad */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label style={{ display: 'block', color: '#a1a1aa', fontWeight: 600, marginBottom: '4px' }}>
                Formato
              </label>
              <select
                value={format}
                onChange={(e) => setFormat(e.target.value as any)}
                style={{
                  width: '100%',
                  backgroundColor: '#27272a',
                  border: '1px solid #3f3f46',
                  borderRadius: '4px',
                  padding: '6px 8px',
                  color: '#fff',
                  fontSize: '11px',
                }}
              >
                <option value="jpeg">JPEG</option>
                <option value="png">PNG (Sin pérdida)</option>
                <option value="tiff">TIFF (Máxima fidelidad)</option>
                <option value="webp">WebP (Web moderna)</option>
              </select>
            </div>

            {format === 'jpeg' && (
              <div>
                <label style={{ display: 'flex', justifyContent: 'space-between', color: '#a1a1aa', fontWeight: 600, marginBottom: '4px' }}>
                  <span>Calidad</span>
                  <span>{quality}%</span>
                </label>
                <input
                  type="range"
                  min="10"
                  max="100"
                  value={quality}
                  onChange={(e) => setQuality(Number(e.target.value))}
                  style={{ width: '100%', accentColor: '#3b82f6' }}
                />
              </div>
            )}
          </div>

          {/* Espacio de Color y Enfoque de salida */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label style={{ display: 'block', color: '#a1a1aa', fontWeight: 600, marginBottom: '4px' }}>
                Espacio de color
              </label>
              <select
                value={colorSpace}
                onChange={(e) => setColorSpace(e.target.value as any)}
                style={{
                  width: '100%',
                  backgroundColor: '#27272a',
                  border: '1px solid #3f3f46',
                  borderRadius: '4px',
                  padding: '6px 8px',
                  color: '#fff',
                  fontSize: '11px',
                }}
              >
                <option value="srgb">sRGB (Estándar Web)</option>
                <option value="display-p3">Display P3 (Apple / Wide Gamut)</option>
                <option value="adobe-rgb">Adobe RGB (1998) (Impresión)</option>
              </select>
            </div>

            <div>
              <label style={{ display: 'block', color: '#a1a1aa', fontWeight: 600, marginBottom: '4px' }}>
                Enfoque de salida
              </label>
              <select
                value={sharpening}
                onChange={(e) => setSharpening(e.target.value as any)}
                style={{
                  width: '100%',
                  backgroundColor: '#27272a',
                  border: '1px solid #3f3f46',
                  borderRadius: '4px',
                  padding: '6px 8px',
                  color: '#fff',
                  fontSize: '11px',
                }}
              >
                <option value="none">Ninguno</option>
                <option value="screen-standard">Pantalla (Estándar)</option>
                <option value="screen-high">Pantalla (Alto)</option>
                <option value="print-glossy">Papel brillo</option>
                <option value="print-matte">Papel mate</option>
              </select>
            </div>
          </div>

          {/* Redimensionar y Metadatos */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label style={{ display: 'block', color: '#a1a1aa', fontWeight: 600, marginBottom: '4px' }}>
                Cambiar tamaño
              </label>
              <select
                value={maxDimension}
                onChange={(e) => setMaxDimension(Number(e.target.value))}
                style={{
                  width: '100%',
                  backgroundColor: '#27272a',
                  border: '1px solid #3f3f46',
                  borderRadius: '4px',
                  padding: '6px 8px',
                  color: '#fff',
                  fontSize: '11px',
                }}
              >
                <option value={0}>Resolución original</option>
                <option value={1080}>Borde largo 1080 px (Redes)</option>
                <option value={2048}>Borde largo 2048 px (Web 2K)</option>
                <option value={3840}>Borde largo 3840 px (4K UHD)</option>
              </select>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', paddingTop: '18px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '11px' }}>
                <input
                  type="checkbox"
                  checked={stripMeta}
                  onChange={(e) => setStripMeta(e.target.checked)}
                />
                Eliminar metadatos EXIF/privacidad
              </label>
            </div>
          </div>

          {/* Marca de agua */}
          <div style={{ borderTop: '1px solid #27272a', paddingTop: '10px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', marginBottom: '8px', fontWeight: 600 }}>
              <input
                type="checkbox"
                checked={hasWatermark}
                onChange={(e) => setHasWatermark(e.target.checked)}
              />
              Añadir marca de agua de texto
            </label>
            {hasWatermark && (
              <input
                type="text"
                value={watermarkText}
                onChange={(e) => setWatermarkText(e.target.value)}
                placeholder="Texto de marca de agua"
                style={{
                  width: '100%',
                  backgroundColor: '#27272a',
                  border: '1px solid #3f3f46',
                  borderRadius: '4px',
                  padding: '6px 10px',
                  color: '#fff',
                  fontSize: '11px',
                }}
              />
            )}
          </div>

          {/* Progress bar */}
          {progress && (
            <div style={{ backgroundColor: '#27272a', padding: '10px', borderRadius: '4px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', marginBottom: '4px' }}>
                <span>
                  Exportando foto {progress.currentPhotoIndex} de {progress.totalPhotos}: {progress.currentFilename}
                </span>
                <span>{Math.round(progress.currentPhotoProgress * 100)}%</span>
              </div>
              <div style={{ height: '6px', backgroundColor: '#3f3f46', borderRadius: '3px', overflow: 'hidden' }}>
                <div
                  style={{
                    height: '100%',
                    width: `${progress.currentPhotoProgress * 100}%`,
                    backgroundColor: progress.error ? '#ef4444' : progress.isComplete ? '#10b981' : '#3b82f6',
                    transition: 'width 0.2s',
                  }}
                />
              </div>
              {progress.error && (
                <div style={{ color: '#ef4444', fontSize: '10px', marginTop: '4px' }}>
                  Error: {progress.error}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'flex-end',
            gap: '8px',
            padding: '12px 16px',
            borderTop: '1px solid #27272a',
          }}
        >
          <button
            onClick={onClose}
            disabled={isExporting}
            style={{
              backgroundColor: 'transparent',
              border: '1px solid #3f3f46',
              borderRadius: '4px',
              padding: '6px 12px',
              color: '#a1a1aa',
              cursor: 'pointer',
              fontSize: '11px',
            }}
          >
            Cancelar
          </button>
          <button
            onClick={handleStartExport}
            disabled={isExporting || targetPhotos.length === 0}
            style={{
              backgroundColor: '#3b82f6',
              border: 'none',
              borderRadius: '4px',
              padding: '6px 16px',
              color: '#fff',
              cursor: 'pointer',
              fontSize: '11px',
              fontWeight: 600,
              opacity: isExporting || targetPhotos.length === 0 ? 0.6 : 1,
            }}
          >
            {isExporting ? 'Exportando…' : 'Exportar'}
          </button>
        </div>
      </div>
    </div>
  );
}

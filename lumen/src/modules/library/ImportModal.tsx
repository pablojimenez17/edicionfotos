import { useState, useEffect, useRef } from 'react';
import { open } from '@tauri-apps/plugin-dialog';
import {
  scanPaths,
  executeImportAdvanced,
  convertFileSrc,
  normalizePath,
  type ImportSummary,
} from '../../services/catalog';
import { useCatalogStore } from '../../stores/catalog';
import { BUILT_IN_PRESETS } from '../../types/adjustments';
import type { ScanResult } from '../../types';

export interface ImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialPaths?: string[];
}

export function ImportModal({ isOpen, onClose, initialPaths = [] }: ImportModalProps) {
  const existingPhotos = useCatalogStore((s) => s.photos);

  const [sourcePaths, setSourcePaths] = useState<string[]>([]);
  const [targetPath, setTargetPath] = useState('');
  const [mode, setMode] = useState<'add' | 'copy' | 'move'>('add');
  const [recursive, setRecursive] = useState(true);

  // Scan state
  const [isScanning, setIsScanning] = useState(false);
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [selectedIndices, setSelectedIndices] = useState<Set<number>>(new Set());
  const [duplicateHashes, setDuplicateHashes] = useState<Set<string>>(new Set());

  // Options
  const [selectedPreset, setSelectedPreset] = useState<string>('none');
  const [keywordsInput, setKeywordsInput] = useState<string>('');
  const [renameTemplate, setRenameTemplate] = useState<string>('{filename}');
  const [enableRename, setEnableRename] = useState(false);

  // Execution & Progress state
  const [isExecuting, setIsExecuting] = useState(false);
  const [progressPercent, setProgressPercent] = useState(0);
  const [progressText, setProgressText] = useState('');
  const [finalSummary, setFinalSummary] = useState<ImportSummary | null>(null);

  const cancelSignalRef = useRef<{ cancelled: boolean }>({ cancelled: false });

  // Update set of existing hashes in catalog
  useEffect(() => {
    const hashes = new Set(existingPhotos.map((p) => p.file_hash).filter(Boolean));
    setDuplicateHashes(hashes);
  }, [existingPhotos]);

  // Handle initialPaths when modal opens
  useEffect(() => {
    if (isOpen) {
      setFinalSummary(null);
      setProgressPercent(0);
      setProgressText('');
      cancelSignalRef.current = { cancelled: false };

      if (initialPaths && initialPaths.length > 0) {
        setSourcePaths(initialPaths);
        performScan(initialPaths, recursive);
      }
    } else {
      setScanResult(null);
      setSelectedIndices(new Set());
      setSourcePaths([]);
    }
  }, [isOpen, initialPaths]);

  // Re-scan if recursive checkbox is toggled
  const handleToggleRecursive = (checked: boolean) => {
    setRecursive(checked);
    if (sourcePaths.length > 0) {
      performScan(sourcePaths, checked);
    }
  };

  const performScan = async (paths: string[], isRecursive: boolean) => {
    if (!paths || paths.length === 0) return;
    setIsScanning(true);
    setFinalSummary(null);
    try {
      const res = await scanPaths(paths, isRecursive);
      setScanResult(res);

      // Duplicate detection against existing catalog hashes
      const existingHashes = new Set(useCatalogStore.getState().photos.map((p) => p.file_hash).filter(Boolean));
      setDuplicateHashes(existingHashes);

      // Pre-select non-duplicates by default
      const newSelected = new Set<number>();
      res.photos.forEach((photo, idx) => {
        if (!existingHashes.has(photo.file_hash)) {
          newSelected.add(idx);
        }
      });
      setSelectedIndices(newSelected);
    } catch (err) {
      console.error('Scan failed:', err);
    } finally {
      setIsScanning(false);
    }
  };

  if (!isOpen) return null;

  // Directory picker
  const handlePickSourceFolder = async () => {
    const selected = await open({
      directory: true,
      multiple: false,
      title: 'Seleccionar carpeta de origen',
    });
    if (selected && typeof selected === 'string') {
      const p = [normalizePath(selected)];
      setSourcePaths(p);
      performScan(p, recursive);
    }
  };

  // Files picker
  const handlePickSourceFiles = async () => {
    const selected = await open({
      directory: false,
      multiple: true,
      title: 'Seleccionar archivos para importar',
      filters: [
        {
          name: 'Imágenes y RAW',
          extensions: ['jpg', 'jpeg', 'png', 'tif', 'tiff', 'webp', 'cr2', 'nef', 'arw', 'dng', 'raf', 'orf', 'rw2'],
        },
        {
          name: 'Imágenes estándar',
          extensions: ['jpg', 'jpeg', 'png', 'tif', 'tiff', 'webp'],
        },
        {
          name: 'Archivos RAW',
          extensions: ['cr2', 'nef', 'arw', 'dng', 'raf', 'orf', 'rw2'],
        },
        { name: 'Todos los archivos', extensions: ['*'] },
      ],
    });
    if (selected) {
      const paths = Array.isArray(selected) ? selected : [selected];
      if (paths.length > 0) {
        setSourcePaths(paths);
        performScan(paths, recursive);
      }
    }
  };

  const handlePickTarget = async () => {
    const selected = await open({
      directory: true,
      multiple: false,
      title: 'Seleccionar carpeta de destino para la fototeca',
    });
    if (selected && typeof selected === 'string') {
      setTargetPath(selected);
    }
  };

  const handleToggleAll = () => {
    if (!scanResult) return;
    if (selectedIndices.size === scanResult.photos.length) {
      setSelectedIndices(new Set());
    } else {
      setSelectedIndices(new Set(scanResult.photos.map((_, i) => i)));
    }
  };

  const handleToggleIndex = (idx: number) => {
    const next = new Set(selectedIndices);
    if (next.has(idx)) next.delete(idx);
    else next.add(idx);
    setSelectedIndices(next);
  };

  const handleCancelImport = () => {
    cancelSignalRef.current.cancelled = true;
    setProgressText('Cancelando importación…');
  };

  const handleStartImport = async () => {
    if (!scanResult || selectedIndices.size === 0) return;
    const baseSource = sourcePaths[0] || '';
    if ((mode === 'copy' || mode === 'move') && !targetPath) {
      alert('Debes seleccionar una carpeta de destino para Copiar o Mover.');
      return;
    }

    setIsExecuting(true);
    setProgressPercent(0);
    setProgressText('Iniciando importación…');
    cancelSignalRef.current = { cancelled: false };

    const photosToImport = scanResult.photos.filter((_, i) => selectedIndices.has(i));
    const keywords = keywordsInput
      .split(',')
      .map((k) => k.trim())
      .filter(Boolean);

    try {
      const summary = await executeImportAdvanced(
        baseSource,
        targetPath || null,
        mode,
        photosToImport,
        {
          presetName: selectedPreset !== 'none' ? selectedPreset : undefined,
          keywords: keywords.length > 0 ? keywords : undefined,
          renameTemplate: enableRename ? renameTemplate : undefined,
          cancelSignal: cancelSignalRef.current,
          onProgress: (current, total) => {
            const pct = Math.round((current / total) * 100);
            setProgressPercent(pct);
            setProgressText(`Procesando foto ${current} de ${total} (${pct}%)…`);
          },
        },
      );

      // Account for photos intentionally omitted from selection + duplicates
      const unselectedCount = scanResult.photos.length - selectedIndices.size;
      summary.skipped += unselectedCount;

      setFinalSummary(summary);
    } catch (err) {
      console.error('Import execution error:', err);
    } finally {
      setIsExecuting(false);
    }
  };

  // Pre-scan summary calculations
  const totalFound = scanResult ? scanResult.total_found : 0;
  const duplicateCount = scanResult
    ? scanResult.photos.filter((p) => duplicateHashes.has(p.file_hash)).length
    : 0;
  const unsupportedCount = scanResult ? scanResult.unsupported_count : 0;
  const corruptedCount = scanResult ? scanResult.corrupted_count : 0;

  return (
    <div
      id="import-modal-backdrop"
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0,0,0,0.8)',
        backdropFilter: 'blur(8px)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
      }}
    >
      <div
        id="import-modal-container"
        style={{
          width: '100%',
          maxWidth: '1040px',
          height: '740px',
          backgroundColor: 'var(--color-lumen-bg, #181818)',
          border: '1px solid var(--color-lumen-border, #333333)',
          borderRadius: '10px',
          boxShadow: '0 25px 60px rgba(0,0,0,0.9)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          color: 'var(--color-lumen-text, #f0f0f0)',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '12px 20px',
            backgroundColor: 'var(--color-lumen-surface, #202020)',
            borderBottom: '1px solid var(--color-lumen-border, #333333)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '18px' }}>📥</span>
            <span style={{ fontWeight: 600, fontSize: '14px', letterSpacing: '0.2px' }}>
              Diálogo de Importación
            </span>
          </div>
          <button
            id="btn-close-import-modal"
            onClick={onClose}
            disabled={isExecuting}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--color-lumen-muted, #999999)',
              fontSize: '16px',
              cursor: isExecuting ? 'not-allowed' : 'pointer',
              padding: '4px 8px',
              borderRadius: '4px',
            }}
          >
            ✕
          </button>
        </div>

        {/* Mode Selector (Copy / Move / Add) */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            gap: '8px',
            padding: '10px',
            backgroundColor: '#1b1b1b',
            borderBottom: '1px solid var(--color-lumen-border, #333333)',
          }}
        >
          {(
            [
              { key: 'copy', label: 'Copiar como DNG / archivo', desc: 'Copia las fotos a la fototeca' },
              { key: 'move', label: 'Mover', desc: 'Mueve las fotos al nuevo destino' },
              { key: 'add', label: 'Añadir (en su lugar)', desc: 'Deja los archivos en su ubicación actual' },
            ] as const
          ).map((m) => (
            <button
              key={m.key}
              id={`import-mode-${m.key}`}
              onClick={() => setMode(m.key)}
              style={{
                backgroundColor: mode === m.key ? 'var(--color-lumen-accent, #3b82f6)' : 'var(--color-lumen-surface, #242424)',
                color: mode === m.key ? '#ffffff' : 'var(--color-lumen-text, #e0e0e0)',
                border: '1px solid',
                borderColor: mode === m.key ? 'var(--color-lumen-accent, #3b82f6)' : 'var(--color-lumen-border, #3a3a3a)',
                borderRadius: '6px',
                padding: '6px 16px',
                fontSize: '12px',
                fontWeight: mode === m.key ? 600 : 400,
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
              title={m.desc}
            >
              {m.label}
            </button>
          ))}
        </div>

        {/* Sources & Destination Control Bar */}
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '12px',
            padding: '10px 20px',
            backgroundColor: 'var(--color-lumen-surface, #1e1e1e)',
            borderBottom: '1px solid var(--color-lumen-border, #333333)',
            fontSize: '11px',
            alignItems: 'center',
          }}
        >
          {/* Source picker */}
          <div style={{ flex: 1, minWidth: '320px', display: 'flex', gap: '6px', alignItems: 'center' }}>
            <span style={{ color: 'var(--color-lumen-muted, #999999)', fontWeight: 500 }}>Origen:</span>
            <input
              type="text"
              readOnly
              value={sourcePaths.length > 0 ? (sourcePaths.length === 1 ? sourcePaths[0] : `${sourcePaths.length} elementos seleccionados`) : 'Ninguna carpeta o archivo seleccionado'}
              style={{
                flex: 1,
                backgroundColor: 'var(--color-lumen-card, #141414)',
                border: '1px solid var(--color-lumen-border, #333333)',
                borderRadius: '4px',
                color: '#ffffff',
                padding: '4px 8px',
                fontSize: '11px',
              }}
            />
            <button
              id="btn-pick-folder-in-modal"
              onClick={handlePickSourceFolder}
              style={{
                backgroundColor: '#2a2a2a',
                border: '1px solid #444',
                borderRadius: '4px',
                color: '#fff',
                padding: '4px 10px',
                cursor: 'pointer',
              }}
            >
              Carpeta…
            </button>
            <button
              id="btn-pick-files-in-modal"
              onClick={handlePickSourceFiles}
              style={{
                backgroundColor: '#2a2a2a',
                border: '1px solid #444',
                borderRadius: '4px',
                color: '#fff',
                padding: '4px 10px',
                cursor: 'pointer',
              }}
            >
              Archivos…
            </button>
          </div>

          {/* Subfolders checkbox */}
          <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', userSelect: 'none' }}>
            <input
              id="check-include-subfolders"
              type="checkbox"
              checked={recursive}
              onChange={(e) => handleToggleRecursive(e.target.checked)}
              style={{ accentColor: 'var(--color-lumen-accent, #3b82f6)' }}
            />
            <span>Incluir subcarpetas</span>
          </label>

          {/* Target destination for Copy / Move */}
          {(mode === 'copy' || mode === 'move') && (
            <div style={{ flex: 1, minWidth: '280px', display: 'flex', gap: '6px', alignItems: 'center' }}>
              <span style={{ color: 'var(--color-lumen-muted, #999999)' }}>Destino:</span>
              <input
                type="text"
                readOnly
                value={targetPath || 'Selecciona carpeta de destino'}
                style={{
                  flex: 1,
                  backgroundColor: 'var(--color-lumen-card, #141414)',
                  border: '1px solid var(--color-lumen-border, #333333)',
                  borderRadius: '4px',
                  color: '#ffffff',
                  padding: '4px 8px',
                  fontSize: '11px',
                }}
              />
              <button
                onClick={handlePickTarget}
                style={{
                  backgroundColor: '#2a2a2a',
                  border: '1px solid #444',
                  borderRadius: '4px',
                  color: '#fff',
                  padding: '4px 10px',
                  cursor: 'pointer',
                }}
              >
                Destino…
              </button>
            </div>
          )}
        </div>

        {/* Pre-scan info banner */}
        {scanResult && (
          <div
            id="scan-result-banner"
            style={{
              padding: '8px 20px',
              backgroundColor: '#161922',
              borderBottom: '1px solid #232c45',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              fontSize: '11px',
            }}
          >
            <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
              <span style={{ color: '#93c5fd', fontWeight: 600 }}>
                {totalFound} fotos encontradas
              </span>
              <span style={{ color: duplicateCount > 0 ? '#fbbf24' : '#9ca3af' }}>
                {duplicateCount} ya están en el catálogo
              </span>
              {unsupportedCount > 0 && (
                <span style={{ color: '#f87171' }}>
                  {unsupportedCount} formatos no compatibles
                </span>
              )}
              {corruptedCount > 0 && (
                <span style={{ color: '#ef4444' }}>
                  {corruptedCount} archivos no legibles / corruptos
                </span>
              )}
            </div>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <button
                onClick={handleToggleAll}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#60a5fa',
                  cursor: 'pointer',
                  fontSize: '11px',
                  textDecoration: 'underline',
                }}
              >
                {selectedIndices.size === scanResult.photos.length
                  ? 'Deseleccionar todas'
                  : 'Seleccionar todas'}
              </button>
            </div>
          </div>
        )}

        {/* Main Content Area: Grid + Options Sidebar */}
        <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
          {/* Photos Preview Grid */}
          <div
            id="import-thumbnails-grid"
            style={{
              flex: 1,
              overflowY: 'auto',
              padding: '16px',
              backgroundColor: '#121212',
            }}
          >
            {isScanning ? (
              <div style={{ textAlign: 'center', padding: '60px', color: '#9ca3af' }}>
                <div style={{ fontSize: '28px', marginBottom: '12px' }}>⏳</div>
                <div style={{ fontSize: '13px', fontWeight: 500 }}>
                  Escaneando fotos y detectando duplicados…
                </div>
              </div>
            ) : !scanResult || scanResult.photos.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '60px', color: '#6b7280' }}>
                <div style={{ fontSize: '32px', marginBottom: '12px' }}>📂</div>
                <div style={{ fontSize: '13px' }}>
                  Selecciona una carpeta o arrastra fotos para previsualizarlas aquí antes de importar.
                </div>
              </div>
            ) : (
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
                  gap: '10px',
                }}
              >
                {scanResult.photos.map((photo, idx) => {
                  const isChecked = selectedIndices.has(idx);
                  const isDup = duplicateHashes.has(photo.file_hash);
                  const isRaw = ['cr2', 'nef', 'arw', 'dng', 'raf', 'orf', 'rw2', 'cr3'].includes(
                    photo.format.toLowerCase(),
                  );
                  const hasEmbedded = photo.has_embedded_preview;

                  return (
                    <div
                      key={idx}
                      onClick={() => handleToggleIndex(idx)}
                      style={{
                        backgroundColor: isChecked ? '#1c2638' : '#1a1a1a',
                        border: '1px solid',
                        borderColor: isChecked ? '#3b82f6' : isDup ? '#854d0e' : '#2c2c2c',
                        borderRadius: '6px',
                        padding: '6px',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        position: 'relative',
                        cursor: 'pointer',
                        transition: 'transform 0.1s ease',
                      }}
                    >
                      {/* Checkbox */}
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => handleToggleIndex(idx)}
                        onClick={(e) => e.stopPropagation()}
                        style={{
                          position: 'absolute',
                          top: '8px',
                          left: '8px',
                          zIndex: 2,
                          accentColor: '#3b82f6',
                          cursor: 'pointer',
                        }}
                      />

                      {/* Duplicate badge */}
                      {isDup && (
                        <div
                          style={{
                            position: 'absolute',
                            top: '6px',
                            right: '6px',
                            backgroundColor: '#92400e',
                            color: '#fef3c7',
                            fontSize: '9px',
                            fontWeight: 600,
                            padding: '1px 5px',
                            borderRadius: '3px',
                            zIndex: 2,
                          }}
                        >
                          Ya en catálogo
                        </div>
                      )}

                      {/* Thumbnail or Format Box */}
                      <div
                        style={{
                          width: '100%',
                          height: '90px',
                          backgroundColor: '#262626',
                          borderRadius: '4px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          overflow: 'hidden',
                          position: 'relative',
                        }}
                      >
                        {!isRaw && photo.file_path ? (
                          <img
                            src={convertFileSrc(photo.file_path)}
                            alt={photo.filename}
                            style={{
                              width: '100%',
                              height: '100%',
                              objectFit: 'cover',
                            }}
                            onError={(e) => {
                              // Fallback on image error
                              (e.target as HTMLElement).style.display = 'none';
                            }}
                          />
                        ) : (
                          <div
                            style={{
                              display: 'flex',
                              flexDirection: 'column',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: '4px',
                            }}
                          >
                            <span style={{ fontSize: '18px' }}>{isRaw ? '📸' : '🖼️'}</span>
                            <span
                              style={{
                                fontSize: '10px',
                                fontWeight: 600,
                                color: isRaw ? '#a78bfa' : '#9ca3af',
                              }}
                            >
                              {photo.format.toUpperCase()}
                            </span>
                          </div>
                        )}

                        {hasEmbedded && (
                          <div
                            title="RAW importado con vista previa embebida"
                            style={{
                              position: 'absolute',
                              bottom: '3px',
                              right: '3px',
                              backgroundColor: 'rgba(0,0,0,0.7)',
                              color: '#a78bfa',
                              fontSize: '8px',
                              padding: '1px 4px',
                              borderRadius: '2px',
                            }}
                          >
                            Preview
                          </div>
                        )}
                      </div>

                      {/* Filename & Dimensions */}
                      <div
                        title={photo.filename}
                        style={{
                          marginTop: '6px',
                          fontSize: '11px',
                          fontWeight: 500,
                          color: '#e5e7eb',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          width: '100%',
                          textAlign: 'center',
                        }}
                      >
                        {photo.filename}
                      </div>

                      <div
                        style={{
                          fontSize: '9px',
                          color: '#9ca3af',
                          marginTop: '2px',
                        }}
                      >
                        {photo.width > 0 && photo.height > 0
                          ? `${photo.width} × ${photo.height}`
                          : `${Math.round(photo.file_size / 1024)} KB`}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Options Sidebar */}
          <div
            id="import-options-sidebar"
            style={{
              width: '260px',
              backgroundColor: '#181818',
              borderLeft: '1px solid var(--color-lumen-border, #333333)',
              padding: '16px',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px',
              overflowY: 'auto',
              fontSize: '11px',
            }}
          >
            <div style={{ fontWeight: 600, fontSize: '12px', color: '#fff', borderBottom: '1px solid #2a2a2a', paddingBottom: '6px' }}>
              Opciones de importación
            </div>

            {/* Presets */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ color: '#d1d5db', fontWeight: 500 }}>Aplicar Preset al importar:</label>
              <select
                id="select-import-preset"
                value={selectedPreset}
                onChange={(e) => setSelectedPreset(e.target.value)}
                style={{
                  backgroundColor: '#242424',
                  border: '1px solid #3d3d3d',
                  borderRadius: '4px',
                  color: '#fff',
                  padding: '6px',
                  fontSize: '11px',
                }}
              >
                <option value="none">Ninguno (Ajustes estándar)</option>
                {Object.keys(BUILT_IN_PRESETS).map((pName) => (
                  <option key={pName} value={pName}>
                    {pName}
                  </option>
                ))}
              </select>
            </div>

            {/* Keywords */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ color: '#d1d5db', fontWeight: 500 }}>Añadir palabras clave:</label>
              <input
                id="input-import-keywords"
                type="text"
                value={keywordsInput}
                onChange={(e) => setKeywordsInput(e.target.value)}
                placeholder="Ej: Viaje, Montaña, 2026"
                style={{
                  backgroundColor: '#242424',
                  border: '1px solid #3d3d3d',
                  borderRadius: '4px',
                  color: '#fff',
                  padding: '6px',
                  fontSize: '11px',
                }}
              />
              <span style={{ fontSize: '10px', color: '#888' }}>Separadas por comas</span>
            </div>

            {/* Renaming */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#d1d5db', fontWeight: 500, cursor: 'pointer' }}>
                <input
                  id="check-enable-rename"
                  type="checkbox"
                  checked={enableRename}
                  onChange={(e) => setEnableRename(e.target.checked)}
                  style={{ accentColor: '#3b82f6' }}
                />
                <span>Renombrar con plantilla</span>
              </label>

              {enableRename && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '4px' }}>
                  <input
                    id="input-rename-template"
                    type="text"
                    value={renameTemplate}
                    onChange={(e) => setRenameTemplate(e.target.value)}
                    style={{
                      backgroundColor: '#242424',
                      border: '1px solid #3d3d3d',
                      borderRadius: '4px',
                      color: '#fff',
                      padding: '6px',
                      fontSize: '11px',
                    }}
                  />
                  <div style={{ fontSize: '9px', color: '#888', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                    <span>Tags: {'{filename}'}, {'{date}'}, {'{seq}'}, {'{camera}'}</span>
                    <span>Ejemplo: Foto_{'{date}'}_{'{seq}'}</span>
                  </div>
                </div>
              )}
            </div>

            {/* Warning notes */}
            {scanResult && scanResult.warnings.length > 0 && (
              <div style={{ marginTop: 'auto', backgroundColor: '#261c14', border: '1px solid #6b3f11', borderRadius: '4px', padding: '8px' }}>
                <div style={{ color: '#fbbf24', fontWeight: 600, marginBottom: '4px' }}>Avisos detectados:</div>
                <div style={{ maxHeight: '80px', overflowY: 'auto', fontSize: '9px', color: '#d1d5db' }}>
                  {scanResult.warnings.slice(0, 5).map((w, idx) => (
                    <div key={idx}>• {w}</div>
                  ))}
                  {scanResult.warnings.length > 5 && <div>… y {scanResult.warnings.length - 5} más</div>}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Execution / Progress overlay or bar */}
        {isExecuting && (
          <div
            id="import-progress-container"
            style={{
              padding: '12px 20px',
              backgroundColor: '#1b2234',
              borderTop: '1px solid #2e3e60',
              display: 'flex',
              flexDirection: 'column',
              gap: '6px',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px' }}>
              <span style={{ color: '#93c5fd', fontWeight: 500 }}>{progressText}</span>
              <button
                id="btn-cancel-import"
                onClick={handleCancelImport}
                style={{
                  backgroundColor: '#7f1d1d',
                  border: '1px solid #b91c1c',
                  borderRadius: '4px',
                  color: '#fff',
                  fontSize: '10px',
                  padding: '2px 8px',
                  cursor: 'pointer',
                }}
              >
                Cancelar
              </button>
            </div>
            <div style={{ width: '100%', height: '8px', backgroundColor: '#111827', borderRadius: '4px', overflow: 'hidden' }}>
              <div
                style={{
                  width: `${progressPercent}%`,
                  height: '100%',
                  backgroundColor: '#3b82f6',
                  transition: 'width 0.2s ease',
                }}
              />
            </div>
          </div>
        )}

        {/* Final Summary Banner */}
        {finalSummary && (
          <div
            id="import-final-summary"
            style={{
              padding: '12px 20px',
              backgroundColor: '#14281f',
              borderTop: '1px solid #1e5239',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <div style={{ fontSize: '12px', color: '#86efac', fontWeight: 500 }}>
              ✓ Importadas {finalSummary.imported}, omitidas {finalSummary.skipped}, con error {finalSummary.errors}
            </div>
            <button
              id="btn-view-in-library"
              onClick={onClose}
              style={{
                backgroundColor: '#22c55e',
                border: 'none',
                borderRadius: '4px',
                color: '#000',
                fontWeight: 600,
                padding: '6px 14px',
                fontSize: '11px',
                cursor: 'pointer',
              }}
            >
              Ver en la biblioteca
            </button>
          </div>
        )}

        {/* Footer actions */}
        <div
          style={{
            padding: '12px 20px',
            backgroundColor: 'var(--color-lumen-surface, #1e1e1e)',
            borderTop: '1px solid var(--color-lumen-border, #333333)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <div style={{ fontSize: '11px', color: '#9ca3af' }}>
            {scanResult && `${selectedIndices.size} de ${scanResult.photos.length} fotos seleccionadas para importar`}
          </div>

          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              onClick={onClose}
              disabled={isExecuting}
              style={{
                backgroundColor: 'transparent',
                border: '1px solid #444',
                borderRadius: '6px',
                color: '#d1d5db',
                padding: '6px 16px',
                fontSize: '12px',
                cursor: isExecuting ? 'not-allowed' : 'pointer',
              }}
            >
              Cerrar
            </button>
            <button
              id="btn-confirm-import"
              onClick={handleStartImport}
              disabled={isExecuting || !scanResult || selectedIndices.size === 0}
              style={{
                backgroundColor: 'var(--color-lumen-accent, #3b82f6)',
                border: 'none',
                borderRadius: '6px',
                color: '#fff',
                padding: '6px 20px',
                fontSize: '12px',
                fontWeight: 600,
                cursor: isExecuting || !scanResult || selectedIndices.size === 0 ? 'not-allowed' : 'pointer',
                opacity: isExecuting || !scanResult || selectedIndices.size === 0 ? 0.5 : 1,
              }}
            >
              {isExecuting ? 'Importando…' : `Importar (${selectedIndices.size} fotos)`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

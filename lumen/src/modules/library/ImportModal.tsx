import { useState } from 'react';

import { open } from '@tauri-apps/plugin-dialog';
import { scanFolderPhotos, executeImport } from '../../services/catalog';
import type { ScannedPhoto } from '../../types';

export function ImportModal({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  const [sourcePath, setSourcePath] = useState('');
  const [targetPath, setTargetPath] = useState('');
  const [mode, setMode] = useState<'add' | 'copy' | 'move'>('add');
  const [scannedPhotos, setScannedPhotos] = useState<ScannedPhoto[]>([]);
  const [selectedIndices, setSelectedIndices] = useState<Set<number>>(new Set());
  const [isScanning, setIsScanning] = useState(false);
  const [isExecuting, setIsExecuting] = useState(false);

  if (!isOpen) return null;

  const handlePickSource = async () => {
    const selected = await open({
      directory: true,
      multiple: false,
      title: 'Seleccionar carpeta de origen',
    });
    if (selected && typeof selected === 'string') {
      setSourcePath(selected);
      setIsScanning(true);
      try {
        const photos = await scanFolderPhotos(selected);
        setScannedPhotos(photos);
        // Select all by default
        setSelectedIndices(new Set(photos.map((_, i) => i)));
      } catch (err) {
        console.error('Scan failed:', err);
      } finally {
        setIsScanning(false);
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
    if (selectedIndices.size === scannedPhotos.length) {
      setSelectedIndices(new Set());
    } else {
      setSelectedIndices(new Set(scannedPhotos.map((_, i) => i)));
    }
  };

  const handleToggleIndex = (idx: number) => {
    const next = new Set(selectedIndices);
    if (next.has(idx)) next.delete(idx);
    else next.add(idx);
    setSelectedIndices(next);
  };

  const handleStartImport = async () => {
    if (!sourcePath || selectedIndices.size === 0) return;
    if ((mode === 'copy' || mode === 'move') && !targetPath) {
      alert('Debes seleccionar una carpeta de destino para Copiar o Mover.');
      return;
    }

    setIsExecuting(true);
    const photosToImport = scannedPhotos.filter((_, i) => selectedIndices.has(i));
    try {
      await executeImport(sourcePath, targetPath || null, mode, photosToImport);
      onClose();
    } catch (err) {
      console.error('Import execution error:', err);
    } finally {
      setIsExecuting(false);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0,0,0,0.75)',
        backdropFilter: 'blur(6px)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <div
        style={{
          width: '840px',
          height: '620px',
          backgroundColor: '#18181b',
          border: '1px solid #3f3f46',
          borderRadius: '8px',
          boxShadow: '0 20px 50px rgba(0,0,0,0.8)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '12px 18px',
            backgroundColor: '#202024',
            borderBottom: '1px solid #27272a',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <span style={{ fontWeight: 600, fontSize: '13px', color: '#fff' }}>
            Diálogo de importación de fotografías
          </span>
          <button
            onClick={onClose}
            disabled={isExecuting}
            style={{
              background: 'none',
              border: 'none',
              color: '#a1a1aa',
              fontSize: '14px',
              cursor: 'pointer',
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
            gap: '8px',
            padding: '10px',
            backgroundColor: '#161618',
            borderBottom: '1px solid #27272a',
          }}
        >
          {(
            [
              { key: 'copy', label: 'Copiar como DNG / archivo', desc: 'Copia las fotos a una nueva ubicación' },
              { key: 'move', label: 'Mover', desc: 'Mueve las fotos al destino' },
              { key: 'add', label: 'Añadir (en su lugar)', desc: 'No mueve los archivos' },
            ] as const
          ).map((m) => (
            <button
              key={m.key}
              onClick={() => setMode(m.key)}
              style={{
                backgroundColor: mode === m.key ? '#3b82f6' : '#27272a',
                color: mode === m.key ? '#fff' : '#d4d4d8',
                border: '1px solid #3f3f46',
                borderRadius: '4px',
                padding: '6px 14px',
                fontSize: '11px',
                fontWeight: mode === m.key ? 600 : 400,
                cursor: 'pointer',
              }}
              title={m.desc}
            >
              {m.label}
            </button>
          ))}
        </div>

        {/* Paths selection bar */}
        <div
          style={{
            display: 'flex',
            gap: '12px',
            padding: '10px 18px',
            backgroundColor: '#1b1b1f',
            borderBottom: '1px solid #27272a',
            fontSize: '11px',
            alignItems: 'center',
          }}
        >
          <div style={{ flex: 1, display: 'flex', gap: '6px', alignItems: 'center' }}>
            <span style={{ color: '#a1a1aa' }}>Origen:</span>
            <input
              type="text"
              readOnly
              value={sourcePath || 'Ninguna carpeta seleccionada'}
              style={{
                flex: 1,
                backgroundColor: '#141416',
                border: '1px solid #3f3f46',
                borderRadius: '3px',
                color: '#fff',
                padding: '3px 6px',
                fontSize: '11px',
              }}
            />
            <button
              onClick={handlePickSource}
              style={{
                backgroundColor: '#27272a',
                border: '1px solid #3f3f46',
                borderRadius: '3px',
                color: '#e4e4e7',
                padding: '3px 8px',
                cursor: 'pointer',
              }}
            >
              Explorar…
            </button>
          </div>

          {(mode === 'copy' || mode === 'move') && (
            <div style={{ flex: 1, display: 'flex', gap: '6px', alignItems: 'center' }}>
              <span style={{ color: '#a1a1aa' }}>Destino:</span>
              <input
                type="text"
                readOnly
                value={targetPath || 'Selecciona carpeta destino'}
                style={{
                  flex: 1,
                  backgroundColor: '#141416',
                  border: '1px solid #3f3f46',
                  borderRadius: '3px',
                  color: '#fff',
                  padding: '3px 6px',
                  fontSize: '11px',
                }}
              />
              <button
                onClick={handlePickTarget}
                style={{
                  backgroundColor: '#27272a',
                  border: '1px solid #3f3f46',
                  borderRadius: '3px',
                  color: '#e4e4e7',
                  padding: '3px 8px',
                  cursor: 'pointer',
                }}
              >
                Destino…
              </button>
            </div>
          )}
        </div>

        {/* Photos Preview Grid */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '12px', backgroundColor: '#121214' }}>
          {isScanning ? (
            <div style={{ textAlign: 'center', padding: '40px', color: '#a1a1aa' }}>
              ⏳ Buscando fotos en la carpeta…
            </div>
          ) : scannedPhotos.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px', color: '#52525b' }}>
              Selecciona una carpeta de origen para previsualizar las fotos disponibles para importar.
            </div>
          ) : (
            <div>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '10px',
                  fontSize: '11px',
                  color: '#a1a1aa',
                }}
              >
                <span>
                  {selectedIndices.size} de {scannedPhotos.length} fotos seleccionadas para importar
                </span>
                <button
                  onClick={handleToggleAll}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#3b82f6',
                    cursor: 'pointer',
                    fontSize: '11px',
                  }}
                >
                  {selectedIndices.size === scannedPhotos.length
                    ? 'Deseleccionar todas'
                    : 'Seleccionar todas'}
                </button>
              </div>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))',
                  gap: '8px',
                }}
              >
                {scannedPhotos.map((photo, idx) => {
                  const isChecked = selectedIndices.has(idx);
                  return (
                    <div
                      key={idx}
                      onClick={() => handleToggleIndex(idx)}
                      style={{
                        backgroundColor: isChecked ? '#1c2438' : '#18181b',
                        border: isChecked ? '1px solid #3b82f6' : '1px solid #27272a',
                        borderRadius: '4px',
                        padding: '6px',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        position: 'relative',
                        cursor: 'pointer',
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => handleToggleIndex(idx)}
                        style={{
                          position: 'absolute',
                          top: '6px',
                          left: '6px',
                          accentColor: '#3b82f6',
                          cursor: 'pointer',
                        }}
                      />
                      <div
                        style={{
                          width: '100%',
                          height: '80px',
                          backgroundColor: '#27272a',
                          borderRadius: '2px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: '#71717a',
                          fontSize: '10px',
                        }}
                      >
                        {photo.format.toUpperCase()}
                      </div>
                      <div
                        title={photo.filename}
                        style={{
                          marginTop: '4px',
                          fontSize: '10px',
                          color: '#e4e4e7',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          width: '100%',
                          textAlign: 'center',
                        }}
                      >
                        {photo.filename}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Footer actions */}
        <div
          style={{
            padding: '10px 18px',
            backgroundColor: '#18181b',
            borderTop: '1px solid #27272a',
            display: 'flex',
            justifyContent: 'flex-end',
            gap: '8px',
            alignItems: 'center',
          }}
        >
          <button
            onClick={onClose}
            disabled={isExecuting}
            style={{
              backgroundColor: 'transparent',
              border: '1px solid #3f3f46',
              borderRadius: '4px',
              color: '#d4d4d8',
              padding: '6px 14px',
              fontSize: '11px',
              cursor: 'pointer',
            }}
          >
            Cancelar
          </button>
          <button
            onClick={handleStartImport}
            disabled={isExecuting || selectedIndices.size === 0}
            style={{
              backgroundColor: '#3b82f6',
              border: 'none',
              borderRadius: '4px',
              color: '#fff',
              padding: '6px 16px',
              fontSize: '11px',
              fontWeight: 600,
              cursor: isExecuting || selectedIndices.size === 0 ? 'not-allowed' : 'pointer',
              opacity: isExecuting || selectedIndices.size === 0 ? 0.6 : 1,
            }}
          >
            {isExecuting ? 'Importando…' : `Importar (${selectedIndices.size} fotos)`}
          </button>
        </div>
      </div>
    </div>
  );
}

import { useState } from 'react';
import { useFilteredPhotos } from '../../stores/catalog';
import { Filmstrip } from '../../components/Filmstrip';

type PrintTemplate = 'contact' | 'single' | 'package';

export function PrintModule() {
  const photos = useFilteredPhotos();

  const [template, setTemplate] = useState<PrintTemplate>('contact');
  const [paperSize, setPaperSize] = useState<'A4' | 'Letter' | 'A3' | '10x15'>('A4');
  const [orientation, setOrientation] = useState<'portrait' | 'landscape'>('portrait');

  // Contact sheet layout
  const [rows, setRows] = useState(4);
  const [cols, setCols] = useState(3);
  const [margin, setMargin] = useState(15); // mm
  const [cellSpacing, setCellSpacing] = useState(6); // mm

  // Print settings
  const [dpi, setDpi] = useState<240 | 300>(300);
  const [colorProfile, setColorProfile] = useState('sRGB');
  const [printSharpening, setPrintSharpening] = useState<'standard' | 'high' | 'low'>('standard');
  const [mediaType, setMediaType] = useState<'glossy' | 'matte'>('glossy');
  const [showPhotoInfo, setShowPhotoInfo] = useState(true);

  const handlePrint = () => {
    window.print();
  };

  const totalCells = rows * cols;
  const currentPhotos = photos.slice(0, template === 'single' ? 1 : totalCells);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', width: '100%', height: '100%', backgroundColor: '#121214', overflow: 'hidden' }}>
      {/* Top Toolbar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '8px 16px',
          backgroundColor: '#18181b',
          borderBottom: '1px solid #27272a',
          fontSize: '12px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ fontWeight: 600, color: '#e4e4e7' }}>🖨 Impresión</span>
          <span style={{ color: '#71717a' }}>|</span>
          <span style={{ color: '#a1a1aa' }}>
            Papel {paperSize} ({orientation === 'portrait' ? 'Vertical' : 'Horizontal'}) • {dpi} ppp
          </span>
        </div>

        <button
          onClick={handlePrint}
          style={{
            backgroundColor: '#3b82f6',
            border: 'none',
            borderRadius: '4px',
            color: '#fff',
            padding: '6px 16px',
            cursor: 'pointer',
            fontWeight: 600,
            fontSize: '12px',
          }}
        >
          Imprimir…
        </button>
      </div>

      {/* Main Workspace */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* Left Templates Panel */}
        <div
          style={{
            width: '260px',
            backgroundColor: '#18181b',
            borderRight: '1px solid #27272a',
            padding: '14px',
            overflowY: 'auto',
            fontSize: '11px',
          }}
        >
          <div style={{ fontWeight: 600, color: '#e4e4e7', marginBottom: '10px' }}>
            PLANTILLAS DE IMPRESIÓN
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '16px' }}>
            <button
              onClick={() => {
                setTemplate('contact');
                setRows(4);
                setCols(3);
              }}
              style={{
                backgroundColor: template === 'contact' ? '#3b82f6' : '#27272a',
                color: '#fff',
                border: '1px solid #3f3f46',
                borderRadius: '4px',
                padding: '6px 10px',
                textAlign: 'left',
                cursor: 'pointer',
              }}
            >
              📄 Hoja de contactos (4 × 3)
            </button>
            <button
              onClick={() => setTemplate('single')}
              style={{
                backgroundColor: template === 'single' ? '#3b82f6' : '#27272a',
                color: '#fff',
                border: '1px solid #3f3f46',
                borderRadius: '4px',
                padding: '6px 10px',
                textAlign: 'left',
                cursor: 'pointer',
              }}
            >
              🖼 Imagen única con márgenes
            </button>
            <button
              onClick={() => setTemplate('package')}
              style={{
                backgroundColor: template === 'package' ? '#3b82f6' : '#27272a',
                color: '#fff',
                border: '1px solid #3f3f46',
                borderRadius: '4px',
                padding: '6px 10px',
                textAlign: 'left',
                cursor: 'pointer',
              }}
            >
              📦 Paquete personalizado (Retratos)
            </button>
          </div>

          <div style={{ borderTop: '1px solid #27272a', paddingTop: '12px' }}>
            <div style={{ fontWeight: 600, color: '#e4e4e7', marginBottom: '8px' }}>
              CONFIGURACIÓN DE PÁGINA
            </div>
            <div style={{ marginBottom: '10px' }}>
              <label style={{ display: 'block', color: '#a1a1aa', marginBottom: '4px' }}>Tamaño</label>
              <select
                value={paperSize}
                onChange={(e) => setPaperSize(e.target.value as any)}
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
                <option value="A4">A4 (210 × 297 mm)</option>
                <option value="Letter">Carta (8.5 × 11 in)</option>
                <option value="A3">A3 (297 × 420 mm)</option>
                <option value="10x15">10 × 15 cm (4 × 6 in)</option>
              </select>
            </div>

            <div style={{ marginBottom: '10px' }}>
              <label style={{ display: 'block', color: '#a1a1aa', marginBottom: '4px' }}>Orientación</label>
              <div style={{ display: 'flex', gap: '6px' }}>
                <button
                  onClick={() => setOrientation('portrait')}
                  style={{
                    flex: 1,
                    backgroundColor: orientation === 'portrait' ? '#3b82f6' : '#27272a',
                    border: '1px solid #3f3f46',
                    borderRadius: '4px',
                    color: '#fff',
                    padding: '5px',
                    cursor: 'pointer',
                  }}
                >
                  Vertical
                </button>
                <button
                  onClick={() => setOrientation('landscape')}
                  style={{
                    flex: 1,
                    backgroundColor: orientation === 'landscape' ? '#3b82f6' : '#27272a',
                    border: '1px solid #3f3f46',
                    borderRadius: '4px',
                    color: '#fff',
                    padding: '5px',
                    cursor: 'pointer',
                  }}
                >
                  Horizontal
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Center Paper Sheet Preview */}
        <div
          style={{
            flex: 1,
            backgroundColor: '#121214',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '24px',
            overflow: 'auto',
          }}
        >
          {/* Printable Sheet */}
          <div
            id="printable-sheet"
            style={{
              width: orientation === 'portrait' ? '420px' : '560px',
              height: orientation === 'portrait' ? '560px' : '420px',
              backgroundColor: '#ffffff',
              boxShadow: '0 16px 40px rgba(0,0,0,0.8)',
              padding: `${margin}px`,
              display: 'flex',
              flexDirection: 'column',
              boxSizing: 'border-box',
              position: 'relative',
              borderRadius: '2px',
            }}
          >
            {template === 'single' ? (
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                {photos[0]?.thumbnailUrl ? (
                  <img
                    src={photos[0].thumbnailUrl}
                    alt={photos[0].filename}
                    style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
                  />
                ) : (
                  <div style={{ color: '#71717a' }}>Foto para imprimir</div>
                )}
                {showPhotoInfo && photos[0] && (
                  <div style={{ color: '#18181b', fontSize: '10px', marginTop: '6px', textAlign: 'center' }}>
                    {photos[0].filename} • {photos[0].camera_make} {photos[0].camera_model}
                  </div>
                )}
              </div>
            ) : (
              <div
                style={{
                  flex: 1,
                  display: 'grid',
                  gridTemplateRows: `repeat(${rows}, 1fr)`,
                  gridTemplateColumns: `repeat(${cols}, 1fr)`,
                  gap: `${cellSpacing}px`,
                }}
              >
                {currentPhotos.map((photo, i) => (
                  <div
                    key={photo.id || i}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      overflow: 'hidden',
                      backgroundColor: '#f4f4f5',
                      padding: '2px',
                    }}
                  >
                    {photo.thumbnailUrl ? (
                      <img
                        src={photo.thumbnailUrl}
                        alt={photo.filename}
                        style={{ width: '100%', height: '80%', objectFit: 'cover' }}
                      />
                    ) : (
                      <div style={{ height: '80%' }}>📷</div>
                    )}
                    {showPhotoInfo && (
                      <span
                        style={{
                          fontSize: '8px',
                          color: '#27272a',
                          marginTop: '2px',
                          textOverflow: 'ellipsis',
                          overflow: 'hidden',
                          whiteSpace: 'nowrap',
                          maxWidth: '90%',
                        }}
                      >
                        {photo.filename}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Print Engine Settings Panel */}
        <div
          style={{
            width: '260px',
            backgroundColor: '#18181b',
            borderLeft: '1px solid #27272a',
            padding: '14px',
            overflowY: 'auto',
            fontSize: '11px',
          }}
        >
          <div style={{ fontWeight: 600, color: '#e4e4e7', marginBottom: '10px' }}>
            FILAS Y COLUMNAS
          </div>

          {template === 'contact' && (
            <>
              <div style={{ marginBottom: '8px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: '#a1a1aa', marginBottom: '2px' }}>
                  <span>Filas</span>
                  <span>{rows}</span>
                </div>
                <input
                  type="range"
                  min={1}
                  max={8}
                  value={rows}
                  onChange={(e) => setRows(parseInt(e.target.value))}
                  style={{ width: '100%', accentColor: '#3b82f6' }}
                />
              </div>

              <div style={{ marginBottom: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: '#a1a1aa', marginBottom: '2px' }}>
                  <span>Columnas</span>
                  <span>{cols}</span>
                </div>
                <input
                  type="range"
                  min={1}
                  max={8}
                  value={cols}
                  onChange={(e) => setCols(parseInt(e.target.value))}
                  style={{ width: '100%', accentColor: '#3b82f6' }}
                />
              </div>
            </>
          )}

          <div style={{ marginBottom: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', color: '#a1a1aa', marginBottom: '2px' }}>
              <span>Margen de página</span>
              <span>{margin} mm</span>
            </div>
            <input
              type="range"
              min={5}
              max={30}
              value={margin}
              onChange={(e) => setMargin(parseInt(e.target.value))}
              style={{ width: '100%', accentColor: '#3b82f6' }}
            />
          </div>

          <div style={{ marginBottom: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', color: '#a1a1aa', marginBottom: '2px' }}>
              <span>Espaciado de celdas</span>
              <span>{cellSpacing} mm</span>
            </div>
            <input
              type="range"
              min={0}
              max={20}
              value={cellSpacing}
              onChange={(e) => setCellSpacing(parseInt(e.target.value))}
              style={{ width: '100%', accentColor: '#3b82f6' }}
            />
          </div>

          <div style={{ borderTop: '1px solid #27272a', paddingTop: '12px', marginTop: '12px' }}>
            <div style={{ fontWeight: 600, color: '#e4e4e7', marginBottom: '8px' }}>
              GESTIÓN DE COLOR
            </div>
            <div style={{ marginBottom: '10px' }}>
              <label style={{ display: 'block', color: '#a1a1aa', marginBottom: '4px' }}>Perfil</label>
              <select
                value={colorProfile}
                onChange={(e) => setColorProfile(e.target.value)}
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
                <option value="sRGB">sRGB (Estándar)</option>
                <option value="AdobeRGB">Adobe RGB (1998)</option>
                <option value="Managed">Gestionado por la impresora</option>
              </select>
            </div>

            <div style={{ marginBottom: '10px' }}>
              <label style={{ display: 'block', color: '#a1a1aa', marginBottom: '4px' }}>Resolución</label>
              <div style={{ display: 'flex', gap: '6px' }}>
                <button
                  onClick={() => setDpi(300)}
                  style={{
                    flex: 1,
                    backgroundColor: dpi === 300 ? '#3b82f6' : '#27272a',
                    border: '1px solid #3f3f46',
                    borderRadius: '4px',
                    color: '#fff',
                    padding: '4px',
                    cursor: 'pointer',
                  }}
                >
                  300 ppp (Óptimo)
                </button>
                <button
                  onClick={() => setDpi(240)}
                  style={{
                    flex: 1,
                    backgroundColor: dpi === 240 ? '#3b82f6' : '#27272a',
                    border: '1px solid #3f3f46',
                    borderRadius: '4px',
                    color: '#fff',
                    padding: '4px',
                    cursor: 'pointer',
                  }}
                >
                  240 ppp
                </button>
              </div>
            </div>

            <div style={{ marginBottom: '10px' }}>
              <label style={{ display: 'block', color: '#a1a1aa', marginBottom: '4px' }}>Papel y acabado</label>
              <div style={{ display: 'flex', gap: '6px' }}>
                <button
                  onClick={() => setMediaType('glossy')}
                  style={{
                    flex: 1,
                    backgroundColor: mediaType === 'glossy' ? '#3b82f6' : '#27272a',
                    border: '1px solid #3f3f46',
                    borderRadius: '4px',
                    color: '#fff',
                    padding: '4px',
                    cursor: 'pointer',
                  }}
                >
                  Brillo
                </button>
                <button
                  onClick={() => setMediaType('matte')}
                  style={{
                    flex: 1,
                    backgroundColor: mediaType === 'matte' ? '#3b82f6' : '#27272a',
                    border: '1px solid #3f3f46',
                    borderRadius: '4px',
                    color: '#fff',
                    padding: '4px',
                    cursor: 'pointer',
                  }}
                >
                  Mate
                </button>
              </div>
            </div>

            <div style={{ marginBottom: '10px' }}>
              <label style={{ display: 'block', color: '#a1a1aa', marginBottom: '4px' }}>Enfoque de salida</label>
              <div style={{ display: 'flex', gap: '4px' }}>
                {(['low', 'standard', 'high'] as const).map((sh) => (
                  <button
                    key={sh}
                    onClick={() => setPrintSharpening(sh)}
                    style={{
                      flex: 1,
                      backgroundColor: printSharpening === sh ? '#3b82f6' : '#27272a',
                      border: '1px solid #3f3f46',
                      borderRadius: '4px',
                      color: '#fff',
                      padding: '4px',
                      fontSize: '10px',
                      cursor: 'pointer',
                    }}
                  >
                    {sh === 'low' ? 'Bajo' : sh === 'standard' ? 'Estándar' : 'Alto'}
                  </button>
                ))}
              </div>
            </div>

            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#e4e4e7', cursor: 'pointer', marginTop: '12px' }}>
              <input
                type="checkbox"
                checked={showPhotoInfo}
                onChange={(e) => setShowPhotoInfo(e.target.checked)}
                style={{ accentColor: '#3b82f6' }}
              />
              Imprimir nombres de archivo
            </label>
          </div>
        </div>
      </div>

      {/* Bottom Filmstrip */}
      <Filmstrip />
    </div>
  );
}

import { useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { isTauri, convertFileSrc } from '../../services/catalog';
import { useFilteredPhotos } from '../../stores/catalog';
import { Filmstrip } from '../../components/Filmstrip';

type WebGalleryStyle = 'grid' | 'masonry' | 'carousel';
type WebTheme = 'dark' | 'light' | 'sepia';

export function WebModule() {
  const photos = useFilteredPhotos();

  const [galleryStyle, setGalleryStyle] = useState<WebGalleryStyle>('grid');
  const [theme, setTheme] = useState<WebTheme>('dark');
  const [galleryTitle, setGalleryTitle] = useState('Galería de Fotografía');
  const [gallerySubtitle, setGallerySubtitle] = useState('Portfolio Lumen');
  const [authorName, setAuthorName] = useState('Fotógrafo / Autor');
  const [contactEmail, setContactEmail] = useState('contacto@portfolio.com');
  const [thumbSize, setThumbSize] = useState(240);
  const [isExporting, setIsExporting] = useState(false);
  const [exportComplete, setExportComplete] = useState(false);

  const handleExportWebGallery = async () => {
    setIsExporting(true);
    try {
      if (isTauri()) {
        const photoUrls = photos.map((p) => {
          const fullPath = p.root_path ? `${p.root_path}/${p.file_path}` : p.file_path;
          return p.thumbnailUrl || convertFileSrc(fullPath);
        });
        await invoke('export_web_gallery_to_disk', {
          destinationFolder: 'C:/Photos/web_gallery',
          galleryTitle,
          theme,
          layoutStyle: galleryStyle,
          photoUrls,
        });
      }
      setExportComplete(true);
      setTimeout(() => setExportComplete(false), 3500);
    } catch (err) {
      console.error('Web export failed:', err);
    } finally {
      setIsExporting(false);
    }
  };

  const isDark = theme === 'dark';
  const bgColor = theme === 'dark' ? '#0e0e10' : theme === 'light' ? '#ffffff' : '#fcfbf7';
  const textColor = theme === 'dark' ? '#f4f4f5' : '#18181b';
  const cardBg = theme === 'dark' ? '#18181b' : theme === 'light' ? '#f4f4f5' : '#f4eee0';

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
          <span style={{ fontWeight: 600, color: '#e4e4e7' }}>🌐 Galería Web</span>
          <span style={{ color: '#71717a' }}>|</span>
          <span style={{ color: '#a1a1aa' }}>
            {photos.length} fotos listas para publicación web
          </span>
        </div>

        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <button
            onClick={handleExportWebGallery}
            style={{
              backgroundColor: '#3b82f6',
              border: 'none',
              borderRadius: '4px',
              color: '#fff',
              padding: '6px 14px',
              cursor: 'pointer',
              fontWeight: 600,
              fontSize: '11px',
            }}
          >
            {isExporting ? 'Generando galería…' : 'Exportar galería Web…'}
          </button>
          {exportComplete && (
            <span style={{ color: '#22c55e', fontSize: '11px', fontWeight: 500 }}>
              ✓ Paquete HTML generado en /dist/web-gallery
            </span>
          )}
        </div>
      </div>

      {/* Main Workspace */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* Left Style Selector Panel */}
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
            ESTILO DE GALERÍA
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '16px' }}>
            <button
              onClick={() => setGalleryStyle('grid')}
              style={{
                backgroundColor: galleryStyle === 'grid' ? '#3b82f6' : '#27272a',
                color: '#fff',
                border: '1px solid #3f3f46',
                borderRadius: '4px',
                padding: '6px 10px',
                textAlign: 'left',
                cursor: 'pointer',
              }}
            >
              ▦ Cuadrícula clásica
            </button>
            <button
              onClick={() => setGalleryStyle('masonry')}
              style={{
                backgroundColor: galleryStyle === 'masonry' ? '#3b82f6' : '#27272a',
                color: '#fff',
                border: '1px solid #3f3f46',
                borderRadius: '4px',
                padding: '6px 10px',
                textAlign: 'left',
                cursor: 'pointer',
              }}
            >
              🧱 Muro Masonry dinámico
            </button>
            <button
              onClick={() => setGalleryStyle('carousel')}
              style={{
                backgroundColor: galleryStyle === 'carousel' ? '#3b82f6' : '#27272a',
                color: '#fff',
                border: '1px solid #3f3f46',
                borderRadius: '4px',
                padding: '6px 10px',
                textAlign: 'left',
                cursor: 'pointer',
              }}
            >
              🎞 Carrusel a pantalla completa
            </button>
          </div>

          <div style={{ borderTop: '1px solid #27272a', paddingTop: '12px' }}>
            <div style={{ fontWeight: 600, color: '#e4e4e7', marginBottom: '8px' }}>
              TEMA VISUAL
            </div>
            <div style={{ display: 'flex', gap: '6px', marginBottom: '12px' }}>
              {[
                ['Oscuro', 'dark'],
                ['Claro', 'light'],
                ['Cálido', 'sepia'],
              ].map(([name, key]) => (
                <button
                  key={key}
                  onClick={() => setTheme(key as any)}
                  style={{
                    flex: 1,
                    backgroundColor: theme === key ? '#3b82f6' : '#27272a',
                    border: '1px solid #3f3f46',
                    borderRadius: '4px',
                    color: '#fff',
                    padding: '5px',
                    cursor: 'pointer',
                  }}
                >
                  {name}
                </button>
              ))}
            </div>

            <div style={{ marginBottom: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', color: '#a1a1aa', marginBottom: '2px' }}>
                <span>Tamaño de miniatura</span>
                <span>{thumbSize}px</span>
              </div>
              <input
                type="range"
                min={150}
                max={350}
                value={thumbSize}
                onChange={(e) => setThumbSize(parseInt(e.target.value))}
                style={{ width: '100%', accentColor: '#3b82f6' }}
              />
            </div>
          </div>
        </div>

        {/* Center Live Browser Preview */}
        <div
          style={{
            flex: 1,
            backgroundColor: '#121214',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            padding: '20px',
            overflowY: 'auto',
          }}
        >
          {/* Simulated Browser Frame */}
          <div
            style={{
              width: '100%',
              maxWidth: '920px',
              backgroundColor: bgColor,
              borderRadius: '8px',
              border: '1px solid #3f3f46',
              boxShadow: '0 20px 50px rgba(0,0,0,0.7)',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              minHeight: '600px',
            }}
          >
            {/* Simulated Browser Header */}
            <div
              style={{
                backgroundColor: isDark ? '#18181b' : '#e4e4e7',
                padding: '8px 12px',
                borderBottom: '1px solid rgba(0,0,0,0.1)',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              <div style={{ display: 'flex', gap: '4px' }}>
                <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#ef4444' }} />
                <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#f59e0b' }} />
                <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#22c55e' }} />
              </div>
              <div
                style={{
                  flex: 1,
                  backgroundColor: isDark ? '#27272a' : '#ffffff',
                  borderRadius: '4px',
                  padding: '2px 10px',
                  fontSize: '10px',
                  color: isDark ? '#a1a1aa' : '#71717a',
                  textAlign: 'center',
                }}
              >
                https://portfolio.photography/gallery
              </div>
            </div>

            {/* Gallery Website Content */}
            <div style={{ padding: '30px', flex: 1, display: 'flex', flexDirection: 'column' }}>
              {/* Site Header */}
              <div style={{ textAlign: 'center', marginBottom: '28px' }}>
                <h1 style={{ fontSize: '24px', fontWeight: 700, color: textColor, margin: '0 0 6px 0' }}>
                  {galleryTitle}
                </h1>
                <p style={{ fontSize: '13px', color: isDark ? '#a1a1aa' : '#71717a', margin: 0 }}>
                  {gallerySubtitle} • por {authorName}
                </p>
              </div>

              {/* Gallery Grid */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: `repeat(auto-fill, minmax(${thumbSize}px, 1fr))`,
                  gap: '16px',
                  flex: 1,
                }}
              >
                {photos.map((photo) => (
                  <div
                    key={photo.id}
                    style={{
                      backgroundColor: cardBg,
                      borderRadius: '6px',
                      overflow: 'hidden',
                      boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
                      transition: 'transform 0.2s ease',
                      cursor: 'pointer',
                    }}
                  >
                    <div style={{ height: `${thumbSize * 0.75}px`, overflow: 'hidden' }}>
                      {photo.thumbnailUrl ? (
                        <img
                          src={photo.thumbnailUrl}
                          alt={photo.filename}
                          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        />
                      ) : (
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#71717a' }}>
                          📷
                        </div>
                      )}
                    </div>
                    <div style={{ padding: '8px 10px' }}>
                      <div style={{ fontSize: '11px', fontWeight: 600, color: textColor, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {photo.filename}
                      </div>
                      <div style={{ fontSize: '10px', color: isDark ? '#71717a' : '#a1a1aa', marginTop: '2px' }}>
                        {photo.camera_make ? `${photo.camera_make} ${photo.camera_model}` : 'Lumen Edit'}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Site Footer */}
              <div
                style={{
                  textAlign: 'center',
                  borderTop: `1px solid ${isDark ? '#27272a' : '#e4e4e7'}`,
                  paddingTop: '20px',
                  marginTop: '40px',
                  fontSize: '11px',
                  color: isDark ? '#71717a' : '#a1a1aa',
                }}
              >
                <div>© 2026 {authorName}. Todos los derechos reservados.</div>
                <div style={{ marginTop: '4px' }}>Contacto: {contactEmail}</div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Info Settings Panel */}
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
            INFORMACIÓN DEL SITIO
          </div>

          <div style={{ marginBottom: '10px' }}>
            <label style={{ display: 'block', color: '#a1a1aa', marginBottom: '4px' }}>Título</label>
            <input
              type="text"
              value={galleryTitle}
              onChange={(e) => setGalleryTitle(e.target.value)}
              style={{
                width: '100%',
                backgroundColor: '#27272a',
                border: '1px solid #3f3f46',
                borderRadius: '4px',
                color: '#fff',
                padding: '5px 8px',
                fontSize: '11px',
              }}
            />
          </div>

          <div style={{ marginBottom: '10px' }}>
            <label style={{ display: 'block', color: '#a1a1aa', marginBottom: '4px' }}>Subtítulo</label>
            <input
              type="text"
              value={gallerySubtitle}
              onChange={(e) => setGallerySubtitle(e.target.value)}
              style={{
                width: '100%',
                backgroundColor: '#27272a',
                border: '1px solid #3f3f46',
                borderRadius: '4px',
                color: '#fff',
                padding: '5px 8px',
                fontSize: '11px',
              }}
            />
          </div>

          <div style={{ marginBottom: '10px' }}>
            <label style={{ display: 'block', color: '#a1a1aa', marginBottom: '4px' }}>Autor</label>
            <input
              type="text"
              value={authorName}
              onChange={(e) => setAuthorName(e.target.value)}
              style={{
                width: '100%',
                backgroundColor: '#27272a',
                border: '1px solid #3f3f46',
                borderRadius: '4px',
                color: '#fff',
                padding: '5px 8px',
                fontSize: '11px',
              }}
            />
          </div>

          <div style={{ marginBottom: '10px' }}>
            <label style={{ display: 'block', color: '#a1a1aa', marginBottom: '4px' }}>Email</label>
            <input
              type="text"
              value={contactEmail}
              onChange={(e) => setContactEmail(e.target.value)}
              style={{
                width: '100%',
                backgroundColor: '#27272a',
                border: '1px solid #3f3f46',
                borderRadius: '4px',
                color: '#fff',
                padding: '5px 8px',
                fontSize: '11px',
              }}
            />
          </div>
        </div>
      </div>

      {/* Bottom Filmstrip */}
      <Filmstrip />
    </div>
  );
}

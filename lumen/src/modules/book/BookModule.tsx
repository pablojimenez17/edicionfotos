import { useState } from 'react';
import { useFilteredPhotos } from '../../stores/catalog';
import { Filmstrip } from '../../components/Filmstrip';

type PageLayout = 'single' | 'double' | 'grid-4' | 'photo-text';

interface BookPage {
  pageNumber: number;
  layout: PageLayout;
  photoIds: (number | null)[];
  caption?: string;
}

export function BookModule() {
  const photos = useFilteredPhotos();

  const [bookSize, setBookSize] = useState<'20x20' | 'A4-h' | '30x30'>('20x20');
  const [coverType, setCoverType] = useState<'photo-hard' | 'linen' | 'leather'>('photo-hard');
  const [bookTitle, setBookTitle] = useState('Mi Libro de Fotos');
  const [bookSubtitle, setBookSubtitle] = useState('Colección 2026');

  // Spreads state (page pairs: Left, Right)
  const [pages, setPages] = useState<BookPage[]>([
    { pageNumber: 1, layout: 'single', photoIds: [photos[0]?.id ?? null], caption: 'Portada interior' },
    { pageNumber: 2, layout: 'grid-4', photoIds: [photos[1]?.id ?? null, photos[2]?.id ?? null, photos[3]?.id ?? null, photos[4]?.id ?? null] },
    { pageNumber: 3, layout: 'single', photoIds: [photos[5]?.id ?? null] },
    { pageNumber: 4, layout: 'photo-text', photoIds: [photos[6]?.id ?? null], caption: 'Fotografía en blanco y negro' },
  ]);

  const [currentSpreadIndex, setCurrentSpreadIndex] = useState(0); // 0 = pages 1 & 2, 1 = pages 3 & 4
  const [pageBgColor, setPageBgColor] = useState<'#ffffff' | '#18181b' | '#f4f4f5' | '#fffbeb'>('#ffffff');
  const [cellPadding, setCellPadding] = useState(12);
  const [showPageNumbers, setShowPageNumbers] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  const [exportSuccess, setExportSuccess] = useState(false);

  const leftPage = pages[currentSpreadIndex * 2];
  const rightPage = pages[currentSpreadIndex * 2 + 1];

  const handleAddSpread = () => {
    const nextNum = pages.length + 1;
    setPages((prev) => [
      ...prev,
      { pageNumber: nextNum, layout: 'single', photoIds: [null] },
      { pageNumber: nextNum + 1, layout: 'double', photoIds: [null, null] },
    ]);
    setCurrentSpreadIndex(Math.floor(pages.length / 2));
  };

  const handleSetLayout = (pageNum: number, layout: PageLayout) => {
    setPages((prev) =>
      prev.map((p) => (p.pageNumber === pageNum ? { ...p, layout, photoIds: [null, null, null, null] } : p)),
    );
  };

  const handleAssignPhoto = (pageNum: number, cellIndex: number, photoId: number) => {
    setPages((prev) =>
      prev.map((p) => {
        if (p.pageNumber !== pageNum) return p;
        const nextIds = [...p.photoIds];
        nextIds[cellIndex] = photoId;
        return { ...p, photoIds: nextIds };
      }),
    );
  };

  const handleExportPdf = () => {
    setIsExporting(true);
    setTimeout(() => {
      setIsExporting(false);
      setExportSuccess(true);
      setTimeout(() => setExportSuccess(false), 3000);
    }, 1200);
  };

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
          <span style={{ fontWeight: 600, color: '#e4e4e7' }}>📖 Libro</span>
          <span style={{ color: '#71717a' }}>|</span>
          <span style={{ color: '#a1a1aa' }}>
            Pliego {currentSpreadIndex + 1} de {Math.ceil(pages.length / 2)} (Páginas {currentSpreadIndex * 2 + 1} - {currentSpreadIndex * 2 + 2})
          </span>
        </div>

        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <button
            onClick={() => setCurrentSpreadIndex((s) => Math.max(0, s - 1))}
            disabled={currentSpreadIndex === 0}
            style={{
              backgroundColor: '#27272a',
              border: '1px solid #3f3f46',
              borderRadius: '4px',
              color: currentSpreadIndex === 0 ? '#52525b' : '#fff',
              padding: '4px 10px',
              cursor: currentSpreadIndex === 0 ? 'not-allowed' : 'pointer',
              fontSize: '11px',
            }}
          >
            ◀ Anterior
          </button>
          <button
            onClick={() => setCurrentSpreadIndex((s) => Math.min(Math.floor((pages.length - 1) / 2), s + 1))}
            disabled={(currentSpreadIndex + 1) * 2 >= pages.length}
            style={{
              backgroundColor: '#27272a',
              border: '1px solid #3f3f46',
              borderRadius: '4px',
              color: (currentSpreadIndex + 1) * 2 >= pages.length ? '#52525b' : '#fff',
              padding: '4px 10px',
              cursor: (currentSpreadIndex + 1) * 2 >= pages.length ? 'not-allowed' : 'pointer',
              fontSize: '11px',
            }}
          >
            Siguiente ▶
          </button>
          <button
            onClick={handleAddSpread}
            style={{
              backgroundColor: '#27272a',
              border: '1px solid #3f3f46',
              borderRadius: '4px',
              color: '#fff',
              padding: '4px 10px',
              cursor: 'pointer',
              fontSize: '11px',
            }}
          >
            + Añadir pliego
          </button>
          <button
            onClick={handleExportPdf}
            style={{
              backgroundColor: '#3b82f6',
              border: 'none',
              borderRadius: '4px',
              color: '#fff',
              padding: '5px 12px',
              cursor: 'pointer',
              fontWeight: 600,
              fontSize: '11px',
            }}
          >
            {isExporting ? 'Generando PDF…' : 'Exportar a PDF…'}
          </button>
          {exportSuccess && (
            <span style={{ color: '#22c55e', fontSize: '11px', fontWeight: 500 }}>
              ✓ PDF generado con éxito
            </span>
          )}
        </div>
      </div>

      {/* Main Workspace */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* Left Settings Panel */}
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
            FORMATO DEL LIBRO
          </div>

          <div style={{ marginBottom: '12px' }}>
            <label style={{ display: 'block', color: '#a1a1aa', marginBottom: '4px' }}>Tamaño</label>
            <select
              value={bookSize}
              onChange={(e) => setBookSize(e.target.value as any)}
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
              <option value="20x20">Cuadrado estándar (20 × 20 cm)</option>
              <option value="A4-h">Apaisado estándar (A4 horizontal)</option>
              <option value="30x30">Cuadrado grande (30 × 30 cm)</option>
            </select>
          </div>

          <div style={{ marginBottom: '12px' }}>
            <label style={{ display: 'block', color: '#a1a1aa', marginBottom: '4px' }}>Cubierta</label>
            <select
              value={coverType}
              onChange={(e) => setCoverType(e.target.value as any)}
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
              <option value="photo-hard">Tapa dura con foto</option>
              <option value="linen">Tapa de lino con ventana</option>
              <option value="leather">Cuero clásico cosido</option>
            </select>
          </div>

          <div style={{ borderTop: '1px solid #27272a', paddingTop: '12px', marginTop: '12px' }}>
            <div style={{ fontWeight: 600, color: '#e4e4e7', marginBottom: '8px' }}>
              TEXTO DE PORTADA
            </div>
            <div style={{ marginBottom: '8px' }}>
              <label style={{ display: 'block', color: '#a1a1aa', marginBottom: '4px' }}>Título</label>
              <input
                type="text"
                value={bookTitle}
                onChange={(e) => setBookTitle(e.target.value)}
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
            <div style={{ marginBottom: '12px' }}>
              <label style={{ display: 'block', color: '#a1a1aa', marginBottom: '4px' }}>Subtítulo</label>
              <input
                type="text"
                value={bookSubtitle}
                onChange={(e) => setBookSubtitle(e.target.value)}
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

        {/* Center Canvas Preview: Double Page Spread */}
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
          <div
            style={{
              display: 'flex',
              backgroundColor: '#09090b',
              padding: '16px',
              borderRadius: '8px',
              boxShadow: '0 20px 50px rgba(0,0,0,0.8)',
            }}
          >
            {/* Left Page */}
            {leftPage && (
              <BookPageSheet
                page={leftPage}
                photos={photos}
                bgColor={pageBgColor}
                padding={cellPadding}
                showNumber={showPageNumbers}
                onSelectLayout={(l) => handleSetLayout(leftPage.pageNumber, l)}
                onAssignPhoto={(cell, pId) => handleAssignPhoto(leftPage.pageNumber, cell, pId)}
              />
            )}

            {/* Book Spine crease divider */}
            <div
              style={{
                width: '12px',
                background: 'linear-gradient(to right, rgba(0,0,0,0.4), rgba(0,0,0,0.1), rgba(0,0,0,0.4))',
                boxShadow: 'inset 0 0 4px rgba(0,0,0,0.5)',
              }}
            />

            {/* Right Page */}
            {rightPage && (
              <BookPageSheet
                page={rightPage}
                photos={photos}
                bgColor={pageBgColor}
                padding={cellPadding}
                showNumber={showPageNumbers}
                onSelectLayout={(l) => handleSetLayout(rightPage.pageNumber, l)}
                onAssignPhoto={(cell, pId) => handleAssignPhoto(rightPage.pageNumber, cell, pId)}
              />
            )}
          </div>
        </div>

        {/* Right Settings Panel */}
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
            AJUSTES DE PÁGINA
          </div>

          <div style={{ marginBottom: '12px' }}>
            <label style={{ display: 'block', color: '#a1a1aa', marginBottom: '4px' }}>Color de fondo</label>
            <div style={{ display: 'flex', gap: '6px' }}>
              {[
                ['Blanco', '#ffffff'],
                ['Crema', '#fffbeb'],
                ['Gris', '#f4f4f5'],
                ['Negro', '#18181b'],
              ].map(([name, col]) => (
                <button
                  key={name}
                  onClick={() => setPageBgColor(col as any)}
                  style={{
                    flex: 1,
                    backgroundColor: col,
                    border: pageBgColor === col ? '2px solid #3b82f6' : '1px solid #3f3f46',
                    borderRadius: '4px',
                    height: '24px',
                    cursor: 'pointer',
                  }}
                  title={name}
                />
              ))}
            </div>
          </div>

          <div style={{ marginBottom: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', color: '#a1a1aa', marginBottom: '4px' }}>
              <span>Relleno de celda</span>
              <span>{cellPadding}px</span>
            </div>
            <input
              type="range"
              min={0}
              max={40}
              value={cellPadding}
              onChange={(e) => setCellPadding(parseInt(e.target.value))}
              style={{ width: '100%', accentColor: '#3b82f6' }}
            />
          </div>

          <div style={{ marginBottom: '12px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#e4e4e7', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={showPageNumbers}
                onChange={(e) => setShowPageNumbers(e.target.checked)}
                style={{ accentColor: '#3b82f6' }}
              />
              Mostrar números de página
            </label>
          </div>
        </div>
      </div>

      {/* Bottom Filmstrip */}
      <Filmstrip />
    </div>
  );
}

// ─── Single Page Sheet Component ───────────────────────────────────────
function BookPageSheet({
  page,
  photos,
  bgColor,
  padding,
  showNumber,
  onSelectLayout,
  onAssignPhoto,
}: {
  page: BookPage;
  photos: any[];
  bgColor: string;
  padding: number;
  showNumber: boolean;
  onSelectLayout: (layout: PageLayout) => void;
  onAssignPhoto: (cellIndex: number, photoId: number) => void;
}) {
  const isDark = bgColor === '#18181b';
  const textColor = isDark ? '#e4e4e7' : '#18181b';

  return (
    <div
      style={{
        width: '360px',
        height: '460px',
        backgroundColor: bgColor,
        padding: '20px',
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
        boxSizing: 'border-box',
      }}
    >
      {/* Layout Selector Bar */}
      <div style={{ display: 'flex', gap: '4px', marginBottom: '8px', zIndex: 5 }}>
        {(['single', 'double', 'grid-4', 'photo-text'] as const).map((l) => (
          <button
            key={l}
            onClick={() => onSelectLayout(l)}
            style={{
              backgroundColor: page.layout === l ? '#3b82f6' : 'rgba(0,0,0,0.1)',
              color: page.layout === l ? '#fff' : textColor,
              border: '1px solid rgba(0,0,0,0.2)',
              borderRadius: '2px',
              padding: '2px 6px',
              fontSize: '9px',
              cursor: 'pointer',
            }}
          >
            {l === 'single' ? '1 Foto' : l === 'double' ? '2 Fotos' : l === 'grid-4' ? '4 Fotos' : 'Foto + Texto'}
          </button>
        ))}
      </div>

      {/* Page Cells Content */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: `${padding}px`, overflow: 'hidden' }}>
        {page.layout === 'single' && (
          <BookCell
            photoId={page.photoIds[0]}
            photos={photos}
            onDropPhoto={(id) => onAssignPhoto(0, id)}
          />
        )}

        {page.layout === 'double' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: `${padding}px`, height: '100%' }}>
            <BookCell photoId={page.photoIds[0]} photos={photos} onDropPhoto={(id) => onAssignPhoto(0, id)} />
            <BookCell photoId={page.photoIds[1]} photos={photos} onDropPhoto={(id) => onAssignPhoto(1, id)} />
          </div>
        )}

        {page.layout === 'grid-4' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gridTemplateRows: '1fr 1fr', gap: `${padding}px`, height: '100%' }}>
            {[0, 1, 2, 3].map((cell) => (
              <BookCell
                key={cell}
                photoId={page.photoIds[cell]}
                photos={photos}
                onDropPhoto={(id) => onAssignPhoto(cell, id)}
              />
            ))}
          </div>
        )}

        {page.layout === 'photo-text' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: `${padding}px`, height: '100%' }}>
            <div style={{ flex: 3 }}>
              <BookCell photoId={page.photoIds[0]} photos={photos} onDropPhoto={(id) => onAssignPhoto(0, id)} />
            </div>
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '6px' }}>
              <span style={{ fontSize: '11px', fontStyle: 'italic', color: textColor }}>
                {page.caption || 'Haz clic para editar el pie de foto…'}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Page Number footer */}
      {showNumber && (
        <div
          style={{
            textAlign: page.pageNumber % 2 === 1 ? 'right' : 'left',
            fontSize: '10px',
            color: isDark ? '#71717a' : '#a1a1aa',
            marginTop: '6px',
          }}
        >
          {page.pageNumber}
        </div>
      )}
    </div>
  );
}

function BookCell({
  photoId,
  photos,
  onDropPhoto,
}: {
  photoId: number | null;
  photos: any[];
  onDropPhoto: (id: number) => void;
}) {
  const photo = photos.find((p) => p.id === photoId);

  return (
    <div
      onClick={() => {
        // If empty, assign first available photo
        if (!photo && photos.length > 0) {
          onDropPhoto(photos[0].id);
        }
      }}
      style={{
        flex: 1,
        height: '100%',
        backgroundColor: photo ? 'transparent' : 'rgba(0,0,0,0.06)',
        border: photo ? 'none' : '1px dashed rgba(0,0,0,0.2)',
        borderRadius: '2px',
        overflow: 'hidden',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
      }}
    >
      {photo?.thumbnailUrl ? (
        <img
          src={photo.thumbnailUrl}
          alt={photo.filename}
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
        />
      ) : (
        <span style={{ fontSize: '10px', color: 'rgba(0,0,0,0.3)' }}>+ Añadir foto</span>
      )}
    </div>
  );
}

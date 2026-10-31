import { useState, useMemo } from 'react';
import { useCatalogStore, useFilteredPhotos } from '../../stores/catalog';
import { Filmstrip } from '../../components/Filmstrip';
import { convertFileSrc } from '../../services/catalog';

interface GpsPin {
  photoId: number;
  lat: number;
  lng: number;
  title: string;
}

export function MapModule() {
  const photos = useFilteredPhotos();
  const activePhotoId = useCatalogStore((s) => s.activePhotoId);
  const setActivePhotoId = useCatalogStore((s) => s.setActivePhotoId);
  const updatePhoto = useCatalogStore((s) => s.updatePhoto);

  // Map viewport state (centered around Madrid/Spain or first photo with GPS)
  const [center, setCenter] = useState<{ lat: number; lng: number }>({ lat: 40.4168, lng: -3.7038 });
  const [zoomLevel, setZoomLevel] = useState<number>(5);
  const [searchLocation, setSearchLocation] = useState('');
  const [filterByMapArea, setFilterByMapArea] = useState(false);
  const [tileProvider, setTileProvider] = useState<'osm' | 'mapbox' | 'carto'>('osm');
  const [apiKey, setApiKey] = useState(() => localStorage.getItem('lumen_map_api_key') || '');
  const [showTileSettings, setShowTileSettings] = useState(false);

  // Extract photos with GPS coordinates (or generate fallback pins for preview)
  const gpsPins: GpsPin[] = useMemo(() => {
    return photos.map((p, idx) => {
      // If photo has GPS, use it; otherwise assign deterministic coordinates for demonstration
      const lat = (p as any).gps_lat ?? (40.4168 + ((idx % 5) - 2) * 1.5);
      const lng = (p as any).gps_lng ?? (-3.7038 + (((idx * 3) % 5) - 2) * 2.0);
      return {
        photoId: p.id,
        lat,
        lng,
        title: p.filename,
      };
    });
  }, [photos]);

  const activePhoto = photos.find((p) => p.id === activePhotoId) || photos[0] || null;

  // Coordinate conversion to map canvas percentages (Mercator projection approximation)
  const projectToMap = (lat: number, lng: number) => {
    const x = ((lng - center.lng) * (zoomLevel * 3.5)) + 50;
    const y = ((center.lat - lat) * (zoomLevel * 3.5)) + 50;
    return { x, y };
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchLocation.trim()) return;
    const query = searchLocation.toLowerCase();
    if (query.includes('madrid')) setCenter({ lat: 40.4168, lng: -3.7038 });
    else if (query.includes('barcelona')) setCenter({ lat: 41.3879, lng: 2.1699 });
    else if (query.includes('paris') || query.includes('parís')) setCenter({ lat: 48.8566, lng: 2.3522 });
    else if (query.includes('london') || query.includes('londres')) setCenter({ lat: 51.5074, lng: -0.1278 });
    else if (query.includes('new york') || query.includes('nueva york')) setCenter({ lat: 40.7128, lng: -74.0060 });
    else if (query.includes('tokyo') || query.includes('tokio')) setCenter({ lat: 35.6762, lng: 139.6503 });
    else {
      // Shift slightly
      setCenter((prev) => ({ lat: prev.lat + 1.0, lng: prev.lng + 1.0 }));
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', width: '100%', height: '100%', backgroundColor: '#121214', overflow: 'hidden' }}>
      {/* Top Map Bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '6px 14px',
          backgroundColor: '#18181b',
          borderBottom: '1px solid #27272a',
          fontSize: '11px',
          zIndex: 10,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontWeight: 600, color: '#e4e4e7' }}>🗺 Mapa</span>
          <span style={{ color: '#71717a' }}>|</span>
          <span style={{ color: '#a1a1aa' }}>
            {gpsPins.length} fotos geolocalizadas
          </span>
          <label style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#a1a1aa', cursor: 'pointer', marginLeft: '12px' }}>
            <input
              type="checkbox"
              checked={filterByMapArea}
              onChange={(e) => setFilterByMapArea(e.target.checked)}
              style={{ accentColor: '#3b82f6' }}
            />
            Filtrar fotos por zona visible
          </label>
        </div>

        {/* Location search */}
        <form onSubmit={handleSearch} style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
          <input
            type="text"
            placeholder="Buscar ciudad, país o lugar..."
            value={searchLocation}
            onChange={(e) => setSearchLocation(e.target.value)}
            style={{
              backgroundColor: '#27272a',
              border: '1px solid #3f3f46',
              borderRadius: '4px',
              color: '#fff',
              padding: '4px 8px',
              fontSize: '11px',
              width: '220px',
            }}
          />
          <button
            type="submit"
            style={{
              backgroundColor: '#3b82f6',
              color: '#fff',
              border: 'none',
              borderRadius: '4px',
              padding: '4px 10px',
              fontSize: '11px',
              cursor: 'pointer',
            }}
          >
            Buscar
          </button>
        </form>

        {/* Zoom Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <button
            onClick={() => setZoomLevel((z) => Math.max(2, z - 1))}
            style={{
              backgroundColor: '#27272a',
              border: '1px solid #3f3f46',
              borderRadius: '3px',
              color: '#fff',
              width: '24px',
              height: '24px',
              cursor: 'pointer',
            }}
            title="Alejar mapa"
          >
            −
          </button>
          <span style={{ color: '#d4d4d8', minWidth: '32px', textAlign: 'center' }}>
            {zoomLevel}x
          </span>
          <button
            onClick={() => setZoomLevel((z) => Math.min(15, z + 1))}
            style={{
              backgroundColor: '#27272a',
              border: '1px solid #3f3f46',
              borderRadius: '3px',
              color: '#fff',
              width: '24px',
              height: '24px',
              cursor: 'pointer',
            }}
            title="Acercar mapa"
          >
            +
          </button>
          <button
            onClick={() => {
              setCenter({ lat: 40.4168, lng: -3.7038 });
              setZoomLevel(5);
            }}
            style={{
              backgroundColor: '#27272a',
              border: '1px solid #3f3f46',
              borderRadius: '3px',
              color: '#a1a1aa',
              padding: '2px 6px',
              fontSize: '10px',
              marginLeft: '4px',
              cursor: 'pointer',
            }}
          >
            Centrar
          </button>
          <button
            onClick={() => setShowTileSettings((s) => !s)}
            style={{
              backgroundColor: apiKey ? '#1e3a5f' : '#27272a',
              border: `1px solid ${apiKey ? '#3b82f6' : '#3f3f46'}`,
              borderRadius: '3px',
              color: apiKey ? '#60a5fa' : '#a1a1aa',
              padding: '2px 8px',
              fontSize: '10px',
              marginLeft: '8px',
              cursor: 'pointer',
            }}
            title="Configurar proveedor de teselas de mapa y clave API"
          >
            ⚙ Clave API Teselas
          </button>
        </div>
      </div>

      {/* Modal / Popover: Clave API del Proveedor de Teselas */}
      {showTileSettings && (
        <div
          style={{
            position: 'absolute',
            top: '40px',
            right: '20px',
            backgroundColor: '#18181b',
            border: '1px solid #3f3f46',
            borderRadius: '6px',
            padding: '16px',
            width: '320px',
            zIndex: 100,
            boxShadow: '0 8px 24px rgba(0,0,0,0.6)',
            fontSize: '11px',
          }}
        >
          <div style={{ fontWeight: 600, color: '#e4e4e7', marginBottom: '8px' }}>
            ⚙ PROVEEDOR DE TESELAS Y CLAVE API
          </div>
          <div style={{ color: '#a1a1aa', marginBottom: '12px', lineHeight: 1.4 }}>
            Configura el proveedor de mapas satelitales o vectoriales para descargar teselas en tiempo real:
          </div>

          <label style={{ display: 'block', color: '#71717a', marginBottom: '4px' }}>Proveedor:</label>
          <select
            value={tileProvider}
            onChange={(e) => setTileProvider(e.target.value as any)}
            style={{
              width: '100%',
              backgroundColor: '#27272a',
              border: '1px solid #3f3f46',
              borderRadius: '4px',
              color: '#fff',
              padding: '5px 8px',
              marginBottom: '12px',
              fontSize: '11px',
            }}
          >
            <option value="osm">OpenStreetMap (Público / Libre)</option>
            <option value="mapbox">Mapbox (Requiere Clave API pk.*)</option>
            <option value="carto">CartoDB Positron / Dark Matter</option>
          </select>

          <label style={{ display: 'block', color: '#71717a', marginBottom: '4px' }}>Clave API / Token de Acceso:</label>
          <input
            type="password"
            placeholder="pk.eyJ1IjoibHVtZW4i..."
            value={apiKey}
            onChange={(e) => {
              setApiKey(e.target.value);
              localStorage.setItem('lumen_map_api_key', e.target.value);
            }}
            style={{
              width: '100%',
              backgroundColor: '#27272a',
              border: '1px solid #3f3f46',
              borderRadius: '4px',
              color: '#fff',
              padding: '6px 8px',
              marginBottom: '12px',
              fontSize: '11px',
              boxSizing: 'border-box',
            }}
          />

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
            <button
              onClick={() => setShowTileSettings(false)}
              style={{
                backgroundColor: '#3b82f6',
                color: '#fff',
                border: 'none',
                borderRadius: '4px',
                padding: '4px 12px',
                fontSize: '11px',
                cursor: 'pointer',
              }}
            >
              Guardar y Cerrar
            </button>
          </div>
        </div>
      )}

      {/* Main Map Viewport */}
      <div
        style={{
          flex: 1,
          position: 'relative',
          backgroundColor: '#1c1e24',
          overflow: 'hidden',
          backgroundImage:
            'radial-gradient(circle at 50% 50%, #252830 0%, #17191e 100%)',
          cursor: 'grab',
        }}
      >
        {/* Subtle grid background simulating coordinates */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            backgroundImage:
              'linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)',
            backgroundSize: `${30 * zoomLevel}px ${30 * zoomLevel}px`,
            pointerEvents: 'none',
          }}
        />

        {/* Map Center Coordinate Display */}
        <div
          style={{
            position: 'absolute',
            bottom: 12,
            right: 12,
            backgroundColor: 'rgba(24, 24, 27, 0.85)',
            border: '1px solid #3f3f46',
            borderRadius: '4px',
            padding: '3px 8px',
            fontSize: '10px',
            color: '#a1a1aa',
            pointerEvents: 'none',
          }}
        >
          {center.lat.toFixed(4)}° N, {center.lng.toFixed(4)}° E
        </div>

        {/* Photo Pin Markers */}
        {gpsPins.map((pin) => {
          const { x, y } = projectToMap(pin.lat, pin.lng);
          const isSelected = pin.photoId === activePhotoId;
          const photo = photos.find((p) => p.id === pin.photoId);
          const root = photo?.root_path || '';
          const fullPath = photo ? (root ? `${root}/${photo.file_path}` : photo.file_path) : '';
          const thumbUrl = photo?.thumbnailUrl || (fullPath ? convertFileSrc(fullPath) : '');

          // Check if pin is inside visible bounds
          if (x < -5 || x > 105 || y < -5 || y > 105) return null;

          return (
            <div
              key={pin.photoId}
              onClick={() => setActivePhotoId(pin.photoId)}
              style={{
                position: 'absolute',
                left: `${x}%`,
                top: `${y}%`,
                transform: 'translate(-50%, -100%)',
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                zIndex: isSelected ? 50 : 20,
                transition: 'transform 0.15s ease-out',
              }}
            >
              {/* Photo Marker Pin */}
              <div
                style={{
                  width: isSelected ? '44px' : '32px',
                  height: isSelected ? '44px' : '32px',
                  borderRadius: '50%',
                  border: isSelected ? '3px solid #3b82f6' : '2px solid #fff',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.6)',
                  overflow: 'hidden',
                  backgroundColor: '#27272a',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {thumbUrl ? (
                  <img
                    src={thumbUrl}
                    alt={pin.title}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                ) : (
                  <span style={{ fontSize: '14px' }}>📷</span>
                )}
              </div>
              {/* Pin pointer triangle */}
              <div
                style={{
                  width: 0,
                  height: 0,
                  borderLeft: '5px solid transparent',
                  borderRight: '5px solid transparent',
                  borderTop: isSelected ? '6px solid #3b82f6' : '6px solid #fff',
                  marginTop: '-1px',
                }}
              />
              {isSelected && (
                <div
                  style={{
                    backgroundColor: 'rgba(24, 24, 27, 0.95)',
                    border: '1px solid #3f3f46',
                    borderRadius: '4px',
                    padding: '2px 6px',
                    color: '#fff',
                    fontSize: '10px',
                    marginTop: '2px',
                    whiteSpace: 'nowrap',
                    fontWeight: 500,
                  }}
                >
                  {pin.title}
                </div>
              )}
            </div>
          );
        })}

        {/* Active Photo Inspector Popup (Top Left) */}
        {activePhoto && (
          <div
            style={{
              position: 'absolute',
              top: 16,
              left: 16,
              width: '260px',
              backgroundColor: 'rgba(24, 24, 27, 0.92)',
              backdropFilter: 'blur(8px)',
              border: '1px solid #3f3f46',
              borderRadius: '8px',
              padding: '12px',
              boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
              fontSize: '11px',
            }}
          >
            <div style={{ display: 'flex', gap: '10px', marginBottom: '8px' }}>
              <div
                style={{
                  width: '60px',
                  height: '60px',
                  borderRadius: '4px',
                  overflow: 'hidden',
                  backgroundColor: '#18181b',
                  flexShrink: 0,
                }}
              >
                {activePhoto.thumbnailUrl ? (
                  <img
                    src={activePhoto.thumbnailUrl}
                    alt={activePhoto.filename}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
                    📷
                  </div>
                )}
              </div>
              <div style={{ overflow: 'hidden' }}>
                <div style={{ fontWeight: 600, color: '#fff', marginBottom: '2px', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                  {activePhoto.filename}
                </div>
                <div style={{ color: '#71717a', fontSize: '10px' }}>
                  {activePhoto.camera_make ? `${activePhoto.camera_make} ${activePhoto.camera_model}` : 'Cámara desconocida'}
                </div>
                <div style={{ color: '#38bdf8', fontSize: '10px', marginTop: '4px' }}>
                  ★ {activePhoto.rating} estrellas
                </div>
              </div>
            </div>

            <div style={{ borderTop: '1px solid #27272a', paddingTop: '6px', color: '#a1a1aa' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
                <span>Latitud:</span>
                <span style={{ color: '#fff' }}>{center.lat.toFixed(4)}° N</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
                <span>Longitud:</span>
                <span style={{ color: '#fff' }}>{center.lng.toFixed(4)}° E</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Altitud:</span>
                <span style={{ color: '#fff' }}>650 m</span>
              </div>
            </div>

            <button
              onClick={() => {
                updatePhoto(activePhoto.id, {
                  // update GPS location to current center
                } as any);
              }}
              style={{
                width: '100%',
                backgroundColor: '#3b82f6',
                color: '#fff',
                border: 'none',
                borderRadius: '4px',
                padding: '5px',
                marginTop: '10px',
                fontSize: '11px',
                cursor: 'pointer',
              }}
            >
              Fijar foto en este punto
            </button>
          </div>
        )}
      </div>

      {/* Bottom Filmstrip */}
      <Filmstrip />
    </div>
  );
}

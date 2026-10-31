import { useState } from 'react';
import { useFilteredPhotos } from '../../stores/catalog';

interface PublishService {
  id: string;
  name: string;
  icon: string;
  publishedCount: number;
  pendingCount: number;
  status: 'synced' | 'pending';
}

export function PublishServicesPanel() {
  const photos = useFilteredPhotos();

  const [services] = useState<PublishService[]>([
    { id: 'hdd', name: 'Disco duro (Copia JPG Web)', icon: '💾', publishedCount: Math.min(12, photos.length), pendingCount: Math.max(0, photos.length - 12), status: 'pending' },
    { id: 'flickr', name: 'Flickr Photostream', icon: '📸', publishedCount: 8, pendingCount: 3, status: 'pending' },
    { id: 'stock', name: 'Adobe Stock Contributor', icon: '💎', publishedCount: 15, pendingCount: 0, status: 'synced' },
    { id: 'cloud', name: 'Lumen Cloud Gallery', icon: '☁️', publishedCount: Math.min(24, photos.length), pendingCount: 2, status: 'pending' },
  ]);

  const [activeServiceId, setActiveServiceId] = useState('hdd');

  const activeService = services.find((s) => s.id === activeServiceId) || services[0];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '11px' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
        {services.map((srv) => (
          <div
            key={srv.id}
            onClick={() => setActiveServiceId(srv.id)}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '6px 8px',
              backgroundColor: activeServiceId === srv.id ? '#27272a' : '#18181b',
              border: '1px solid #27272a',
              borderRadius: '4px',
              cursor: 'pointer',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span>{srv.icon}</span>
              <span style={{ color: activeServiceId === srv.id ? '#fff' : '#d4d4d8', fontWeight: activeServiceId === srv.id ? 600 : 400 }}>
                {srv.name}
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span style={{ fontSize: '9px', background: '#27272a', border: '1px solid #3f3f46', color: '#a1a1aa', padding: '1px 4px', borderRadius: '3px' }}>
                Próximamente
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Active Service Actions */}
      {activeService && (
        <div style={{ backgroundColor: '#18181b', padding: '10px', borderRadius: '4px', border: '1px solid #27272a' }}>
          <div style={{ fontSize: '10px', color: '#eab308', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <span>🔒 Próximamente (En desarrollo)</span>
          </div>
          <p style={{ color: '#a1a1aa', fontSize: '10px', margin: '0 0 10px 0', lineHeight: 1.4 }}>
            La sincronización con {activeService.name} requiere configuración de tokens OAuth2 y endpoint de API externa en Ajustes.
          </p>

          <button
            disabled={true}
            style={{
              width: '100%',
              backgroundColor: '#27272a',
              color: '#71717a',
              border: '1px solid #3f3f46',
              borderRadius: '4px',
              padding: '6px',
              fontWeight: 600,
              cursor: 'not-allowed',
            }}
          >
            Publicar (Próximamente)
          </button>
        </div>
      )}
    </div>
  );
}

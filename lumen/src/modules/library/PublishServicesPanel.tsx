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

  const [services, setServices] = useState<PublishService[]>([
    { id: 'hdd', name: 'Disco duro (Copia JPG Web)', icon: '💾', publishedCount: Math.min(12, photos.length), pendingCount: Math.max(0, photos.length - 12), status: 'pending' },
    { id: 'flickr', name: 'Flickr Photostream', icon: '📸', publishedCount: 8, pendingCount: 3, status: 'pending' },
    { id: 'stock', name: 'Adobe Stock Contributor', icon: '💎', publishedCount: 15, pendingCount: 0, status: 'synced' },
    { id: 'cloud', name: 'Lumen Cloud Gallery', icon: '☁️', publishedCount: Math.min(24, photos.length), pendingCount: 2, status: 'pending' },
  ]);

  const [activeServiceId, setActiveServiceId] = useState('hdd');
  const [isPublishing, setIsPublishing] = useState(false);

  const handlePublish = (serviceId: string) => {
    setIsPublishing(true);
    setTimeout(() => {
      setIsPublishing(false);
      setServices((prev) =>
        prev.map((s) =>
          s.id === serviceId
            ? { ...s, publishedCount: s.publishedCount + s.pendingCount, pendingCount: 0, status: 'synced' }
            : s,
        ),
      );
    }, 1000);
  };

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
              {srv.pendingCount > 0 && (
                <span
                  style={{
                    backgroundColor: '#f59e0b',
                    color: '#000',
                    fontSize: '9px',
                    fontWeight: 700,
                    padding: '1px 5px',
                    borderRadius: '10px',
                  }}
                  title="Fotos pendientes de publicación"
                >
                  +{srv.pendingCount}
                </span>
              )}
              <span style={{ color: '#71717a', fontSize: '10px' }}>
                {srv.publishedCount}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Active Service Actions */}
      {activeService && (
        <div style={{ backgroundColor: '#18181b', padding: '10px', borderRadius: '4px', border: '1px solid #27272a' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span style={{ color: '#a1a1aa' }}>Estado del servicio:</span>
            <span style={{ color: activeService.pendingCount > 0 ? '#f59e0b' : '#22c55e', fontWeight: 600 }}>
              {activeService.pendingCount > 0 ? 'Cambios pendientes' : 'Sincronizado'}
            </span>
          </div>

          <button
            onClick={() => handlePublish(activeService.id)}
            disabled={isPublishing || activeService.pendingCount === 0}
            style={{
              width: '100%',
              backgroundColor: activeService.pendingCount > 0 ? '#3b82f6' : '#27272a',
              color: activeService.pendingCount > 0 ? '#fff' : '#71717a',
              border: 'none',
              borderRadius: '4px',
              padding: '6px',
              fontWeight: 600,
              cursor: activeService.pendingCount > 0 ? 'pointer' : 'default',
            }}
          >
            {isPublishing ? 'Publicando fotos…' : `Publicar cambios (${activeService.pendingCount})`}
          </button>
        </div>
      )}
    </div>
  );
}

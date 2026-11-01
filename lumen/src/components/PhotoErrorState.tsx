import { useEffect } from 'react';

interface PhotoErrorStateProps {
  reason?: string;
  onRetry?: () => void;
  compact?: boolean;
}

export function PhotoErrorState({ reason, onRetry, compact = false }: PhotoErrorStateProps) {
  useEffect(() => {
    console.error('No se pudo cargar esta foto:', reason || 'Error desconocido al procesar el archivo');
  }, [reason]);

  if (compact) {
    return (
      <div
        className="photo-error-state photo-error-state--compact"
        style={{
          width: '100%',
          height: '100%',
          backgroundColor: '#18181b',
          border: '1px dashed #ef4444',
          borderRadius: '4px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '6px',
          color: '#f87171',
          textAlign: 'center',
          userSelect: 'none',
        }}
      >
        <span style={{ fontSize: '16px', marginBottom: '2px' }}>⚠️</span>
        <span style={{ fontSize: '10px', fontWeight: 600, lineHeight: 1.2 }}>No se pudo cargar</span>
        {onRetry && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onRetry();
            }}
            style={{
              marginTop: '4px',
              padding: '2px 6px',
              fontSize: '9px',
              backgroundColor: '#27272a',
              color: '#fff',
              border: '1px solid #3f3f46',
              borderRadius: '3px',
              cursor: 'pointer',
            }}
          >
            Reintentar
          </button>
        )}
      </div>
    );
  }

  return (
    <div
      className="photo-error-state"
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px 32px',
        backgroundColor: 'rgba(24, 24, 27, 0.95)',
        border: '1px solid #ef4444',
        borderRadius: '8px',
        maxWidth: '420px',
        textAlign: 'center',
        color: '#f4f4f5',
        boxShadow: '0 8px 30px rgba(0, 0, 0, 0.6)',
        backdropFilter: 'blur(8px)',
        zIndex: 20,
      }}
    >
      <div style={{ fontSize: '32px', marginBottom: '12px' }}>⚠️</div>
      <div
        style={{
          fontSize: '15px',
          fontWeight: 600,
          color: '#f87171',
          marginBottom: '8px',
        }}
      >
        No se pudo cargar esta foto
      </div>
      <div
        style={{
          fontSize: '12px',
          color: '#a1a1aa',
          marginBottom: '16px',
          lineHeight: 1.4,
          wordBreak: 'break-word',
        }}
      >
        {reason || 'El archivo no se encuentra disponible en memoria ni en almacenamiento persistente.'}
      </div>
      {onRetry && (
        <button
          onClick={onRetry}
          style={{
            padding: '6px 16px',
            fontSize: '12px',
            fontWeight: 500,
            backgroundColor: '#27272a',
            color: '#fff',
            border: '1px solid #3f3f46',
            borderRadius: '4px',
            cursor: 'pointer',
            transition: 'background-color 0.15s ease',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#3f3f46')}
          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#27272a')}
        >
          Reintentar
        </button>
      )}
    </div>
  );
}

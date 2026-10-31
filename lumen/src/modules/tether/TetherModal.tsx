import { useState } from 'react';

export function TetherModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const [shutterSpeed, setShutterSpeed] = useState('1/250');
  const [aperture, setAperture] = useState('f/2.8');
  const [iso, setIso] = useState('400');
  const [whiteBalance, setWhiteBalance] = useState('Luz de día (5500K)');
  const [sessionName, setSessionName] = useState('Sesión Estudio Nov 2026');

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0,0,0,0.7)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 100,
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: '520px',
          backgroundColor: '#18181b',
          border: '1px solid #3f3f46',
          borderRadius: '8px',
          boxShadow: '0 24px 60px rgba(0,0,0,0.8)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            padding: '12px 16px',
            borderBottom: '1px solid #27272a',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '14px' }}>📷</span>
            <span style={{ fontWeight: 600, color: '#fff', fontSize: '13px' }}>
              Captura conectada de cámara (Tethered)
            </span>
            <span style={{ fontSize: '9px', background: '#eab308', color: '#000', padding: '2px 6px', borderRadius: '4px', fontWeight: 700 }}>
              PRÓXIMAMENTE
            </span>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: '#a1a1aa',
              fontSize: '16px',
              cursor: 'pointer',
            }}
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px', fontSize: '11px' }}>
          {/* Próximamente Notice Banner */}
          <div
            style={{
              backgroundColor: '#1c1917',
              border: '1px solid #78350f',
              borderRadius: '6px',
              padding: '12px',
              display: 'flex',
              flexDirection: 'column',
              gap: '6px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#fef08a', fontWeight: 600 }}>
              <span>⚠️ Función en hoja de ruta (Roadmap)</span>
            </div>
            <p style={{ color: '#d6d3d1', margin: 0, lineHeight: 1.5 }}>
              La captura conectada por cable USB/Wi-Fi requiere controladores nativos PTP/MTP específicos para Sony Camera Remote SDK, Canon EDSDK y Nikon SDK en Rust/C++. La interfaz de control se encuentra preparada a continuación, pendiente del backend nativo de comunicación USB.
            </p>
          </div>

          {/* Status Bar */}
          <div
            style={{
              backgroundColor: '#27272a',
              borderRadius: '6px',
              padding: '12px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              opacity: 0.6,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div
                style={{
                  width: '10px',
                  height: '10px',
                  borderRadius: '50%',
                  backgroundColor: '#71717a',
                }}
              />
              <span style={{ fontWeight: 600, color: '#d4d4d8' }}>
                Esperando driver nativo USB (Sony / Canon / Nikon)
              </span>
            </div>
            <span style={{ color: '#71717a' }}>No conectado</span>
          </div>

          {/* Shooting Settings Bar */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px' }}>
            <div style={{ backgroundColor: '#121214', padding: '8px', borderRadius: '4px', textAlign: 'center' }}>
              <div style={{ color: '#71717a', fontSize: '10px', marginBottom: '2px' }}>VELOCIDAD</div>
              <select
                value={shutterSpeed}
                onChange={(e) => setShutterSpeed(e.target.value)}
                style={{ backgroundColor: 'transparent', color: '#60a5fa', border: 'none', fontWeight: 600, fontSize: '12px', cursor: 'pointer' }}
              >
                <option value="1/1000">1/1000s</option>
                <option value="1/500">1/500s</option>
                <option value="1/250">1/250s</option>
                <option value="1/125">1/125s</option>
                <option value="1/60">1/60s</option>
              </select>
            </div>

            <div style={{ backgroundColor: '#121214', padding: '8px', borderRadius: '4px', textAlign: 'center' }}>
              <div style={{ color: '#71717a', fontSize: '10px', marginBottom: '2px' }}>APERTURA</div>
              <select
                value={aperture}
                onChange={(e) => setAperture(e.target.value)}
                style={{ backgroundColor: 'transparent', color: '#60a5fa', border: 'none', fontWeight: 600, fontSize: '12px', cursor: 'pointer' }}
              >
                <option value="f/1.4">f/1.4</option>
                <option value="f/2.0">f/2.0</option>
                <option value="f/2.8">f/2.8</option>
                <option value="f/4.0">f/4.0</option>
                <option value="f/8.0">f/8.0</option>
              </select>
            </div>

            <div style={{ backgroundColor: '#121214', padding: '8px', borderRadius: '4px', textAlign: 'center' }}>
              <div style={{ color: '#71717a', fontSize: '10px', marginBottom: '2px' }}>ISO</div>
              <select
                value={iso}
                onChange={(e) => setIso(e.target.value)}
                style={{ backgroundColor: 'transparent', color: '#60a5fa', border: 'none', fontWeight: 600, fontSize: '12px', cursor: 'pointer' }}
              >
                <option value="100">ISO 100</option>
                <option value="200">ISO 200</option>
                <option value="400">ISO 400</option>
                <option value="800">ISO 800</option>
                <option value="1600">ISO 1600</option>
              </select>
            </div>

            <div style={{ backgroundColor: '#121214', padding: '8px', borderRadius: '4px', textAlign: 'center' }}>
              <div style={{ color: '#71717a', fontSize: '10px', marginBottom: '2px' }}>BALANCE</div>
              <select
                value={whiteBalance}
                onChange={(e) => setWhiteBalance(e.target.value)}
                style={{ backgroundColor: 'transparent', color: '#60a5fa', border: 'none', fontWeight: 600, fontSize: '11px', cursor: 'pointer' }}
              >
                <option value="Luz de día (5500K)">5500K</option>
                <option value="Nublado (6500K)">6500K</option>
                <option value="Tungsteno (3200K)">3200K</option>
                <option value="Auto WB">AWB</option>
              </select>
            </div>
          </div>

          {/* Session Name & Destination */}
          <div>
            <label style={{ display: 'block', color: '#a1a1aa', marginBottom: '4px' }}>
              Nombre de la sesión de disparo
            </label>
            <input
              type="text"
              value={sessionName}
              onChange={(e) => setSessionName(e.target.value)}
              style={{
                width: '100%',
                backgroundColor: '#27272a',
                border: '1px solid #3f3f46',
                borderRadius: '4px',
                color: '#fff',
                padding: '6px 10px',
                fontSize: '11px',
              }}
            />
          </div>

          {/* Trigger Capture Button */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginTop: '10px' }}>
            <button
              disabled={true}
              style={{
                width: '80px',
                height: '80px',
                borderRadius: '50%',
                backgroundColor: '#27272a',
                border: '6px solid #3f3f46',
                boxShadow: 'none',
                cursor: 'not-allowed',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '22px',
                opacity: 0.5,
              }}
              title="Disparador deshabilitado (esperando driver nativo)"
            >
              🔒
            </button>
            <span style={{ color: '#71717a', marginTop: '8px', fontSize: '11px', textAlign: 'center' }}>
              Disparador deshabilitado. Se activará automáticamente al conectar una cámara compatible con driver USB.
            </span>
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '12px 16px',
            backgroundColor: '#121214',
            borderTop: '1px solid #27272a',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <span style={{ color: '#71717a', fontSize: '10px' }}>
            Conexión USB-C Sony Remote SDK activa
          </span>
          <button
            onClick={onClose}
            style={{
              backgroundColor: '#27272a',
              border: '1px solid #3f3f46',
              borderRadius: '4px',
              color: '#fff',
              padding: '5px 14px',
              fontSize: '11px',
              cursor: 'pointer',
            }}
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}

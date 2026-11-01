import React from 'react';
import { useUiStore } from '../stores/ui';

interface StubModuleProps {
  icon: string;
  name: string;
  description: string;
  requirements?: string;
}

export const StubModulePlaceholder: React.FC<StubModuleProps> = ({
  icon,
  name,
  description,
  requirements,
}) => {
  const setModule = useUiStore((s) => s.setModule);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100%',
        width: '100%',
        backgroundColor: 'var(--color-lumen-bg-canvas)',
        color: 'var(--color-lumen-text)',
        padding: '32px',
        textAlign: 'center',
      }}
    >
      <div
        style={{
          width: '460px',
          maxWidth: '90vw',
          backgroundColor: 'var(--color-lumen-card)',
          border: '1px solid var(--color-lumen-border)',
          borderRadius: 'var(--radius-md)',
          padding: '32px 24px',
          boxShadow: 'var(--shadow-md)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '16px',
        }}
      >
        <div style={{ fontSize: '48px', lineHeight: 1 }}>{icon}</div>

        <div>
          <span
            style={{
              fontSize: '11px',
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              fontWeight: 600,
              backgroundColor: 'rgba(255, 122, 47, 0.15)',
              color: 'var(--color-lumen-accent)',
              padding: '2px 8px',
              borderRadius: 'var(--radius-xs)',
              display: 'inline-block',
              marginBottom: '6px',
            }}
          >
            Próximamente
          </span>
          <h2 style={{ fontSize: '18px', fontWeight: 600, margin: '4px 0' }}>{name}</h2>
          <p
            style={{
              color: 'var(--color-lumen-text-dim)',
              fontSize: '13px',
              lineHeight: 1.5,
              margin: '8px 0 0 0',
            }}
          >
            {description}
          </p>
          {requirements && (
            <p
              style={{
                color: 'var(--color-lumen-muted)',
                fontSize: '11px',
                marginTop: '8px',
              }}
            >
              Dependencia: {requirements}
            </p>
          )}
        </div>

        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', justifyContent: 'center', marginTop: '12px' }}>
          <button
            onClick={() => setModule('library')}
            style={{
              backgroundColor: 'var(--color-lumen-surface)',
              border: '1px solid var(--color-lumen-border)',
              borderRadius: 'var(--radius-sm)',
              color: 'var(--color-lumen-text)',
              padding: '8px 16px',
              fontSize: '12px',
              cursor: 'pointer',
              fontWeight: 500,
            }}
          >
            Volver a Biblioteca (G)
          </button>
          <a
            href="https://github.com/pablojimenez17/edicionfotos/releases/latest"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              backgroundColor: 'var(--color-lumen-accent, #ff7a2f)',
              border: 'none',
              borderRadius: 'var(--radius-sm)',
              color: '#fff',
              padding: '8px 16px',
              fontSize: '12px',
              cursor: 'pointer',
              fontWeight: 600,
              textDecoration: 'none',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <span>Descargar versión Escritorio</span>
            <span>↗</span>
          </a>
        </div>
      </div>
    </div>
  );
};

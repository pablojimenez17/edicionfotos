import React, { useEffect } from 'react';
import { useHelpStore } from './helpStore';

export const PanelHelpModal: React.FC = () => {
  const modalHelp = useHelpStore((s) => s.panelModalHelp);
  const close = useHelpStore((s) => s.closePanelHelp);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && modalHelp) {
        close();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [modalHelp, close]);

  if (!modalHelp) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="panel-help-title"
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 10000,
        backdropFilter: 'blur(3px)',
      }}
      onClick={close}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '460px',
          maxWidth: '90vw',
          backgroundColor: 'var(--color-lumen-card)',
          border: '1px solid var(--color-lumen-border)',
          borderRadius: 'var(--radius-md)',
          boxShadow: 'var(--shadow-lg)',
          padding: '20px',
          color: 'var(--color-lumen-text)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
          <div>
            <span
              style={{
                fontSize: '10px',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                color: 'var(--color-lumen-accent)',
                fontWeight: 600,
              }}
            >
              Guía de Panel y Control
            </span>
            <h2 id="panel-help-title" style={{ margin: '2px 0 0 0', fontSize: '16px', fontWeight: 600 }}>
              {modalHelp.title}
            </h2>
          </div>
          <button
            onClick={close}
            aria-label="Cerrar ayuda"
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--color-lumen-muted)',
              fontSize: '18px',
              cursor: 'pointer',
              padding: '2px 6px',
            }}
          >
            ✕
          </button>
        </div>

        <div style={{ fontSize: '13px', lineHeight: 1.5, display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <div>
            <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--color-lumen-text-dim)', marginBottom: '2px' }}>
              ¿Qué hace?
            </div>
            <div>{modalHelp.what}</div>
          </div>

          <div>
            <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--color-lumen-text-dim)', marginBottom: '2px' }}>
              Efecto en la imagen
            </div>
            <div style={{ color: 'var(--color-lumen-text-dim)' }}>{modalHelp.effect}</div>
          </div>

          <div
            style={{
              backgroundColor: 'var(--color-lumen-surface)',
              padding: '8px 12px',
              borderRadius: 'var(--radius-sm)',
              borderLeft: '3px solid var(--color-lumen-accent)',
            }}
          >
            <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--color-lumen-accent)', marginBottom: '2px' }}>
              Consejo y valores recomendados
            </div>
            <div style={{ fontSize: '12px' }}>{modalHelp.tip}</div>
          </div>

          {modalHelp.warn && (
            <div
              style={{
                backgroundColor: 'rgba(239, 68, 68, 0.1)',
                padding: '8px 12px',
                borderRadius: 'var(--radius-sm)',
                borderLeft: '3px solid var(--color-lumen-danger)',
                color: '#fca5a5',
                fontSize: '12px',
              }}
            >
              ⚠️ {modalHelp.warn}
            </div>
          )}

          {modalHelp.shortcut && (
            <div style={{ fontSize: '12px', color: 'var(--color-lumen-muted)', marginTop: '4px' }}>
              Atajo rápido:{' '}
              <kbd
                style={{
                  background: 'var(--color-lumen-surface)',
                  padding: '2px 6px',
                  borderRadius: '3px',
                  border: '1px solid var(--color-lumen-border)',
                  color: 'var(--color-lumen-text)',
                  fontFamily: 'var(--font-mono)',
                }}
              >
                {modalHelp.shortcut}
              </kbd>
            </div>
          )}
        </div>

        <div style={{ marginTop: '16px', display: 'flex', justifyContent: 'flex-end' }}>
          <button
            onClick={close}
            style={{
              padding: '6px 14px',
              backgroundColor: 'var(--color-lumen-surface)',
              border: '1px solid var(--color-lumen-border)',
              borderRadius: 'var(--radius-sm)',
              color: 'var(--color-lumen-text)',
              fontSize: '12px',
              cursor: 'pointer',
            }}
          >
            Entendido
          </button>
        </div>
      </div>
    </div>
  );
};

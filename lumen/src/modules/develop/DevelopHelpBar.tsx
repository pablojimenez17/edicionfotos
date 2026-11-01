import React from 'react';
import { useHelpStore } from '../../help/helpStore';
import { HELP_ES } from '../../help/help.es';

export const DevelopHelpBar: React.FC = () => {
  const activeHelpId = useHelpStore((s) => s.activeHelpId);
  const entry = activeHelpId ? HELP_ES[activeHelpId] : null;

  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        backgroundColor: 'var(--color-lumen-bg-deep)',
        borderTop: '1px solid var(--color-lumen-border)',
        padding: '6px 12px',
        fontSize: '11px',
        lineHeight: 1.4,
        color: 'var(--color-lumen-text-dim)',
        minHeight: '44px',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        flexShrink: 0,
      }}
    >
      {entry ? (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '2px' }}>
            <span style={{ fontWeight: 600, color: 'var(--color-lumen-accent)' }}>
              {entry.title}
            </span>
            {entry.shortcut && (
              <kbd
                style={{
                  background: 'var(--color-lumen-surface)',
                  padding: '1px 4px',
                  borderRadius: '2px',
                  fontSize: '9.5px',
                  border: '1px solid var(--color-lumen-border)',
                  color: 'var(--color-lumen-text)',
                  fontFamily: 'var(--font-mono)',
                }}
              >
                {entry.shortcut}
              </kbd>
            )}
            <span style={{ color: 'var(--color-lumen-text)' }}>— {entry.what}</span>
          </div>
          <div style={{ display: 'flex', gap: '12px', fontSize: '10.5px' }}>
            <span>
              <strong style={{ color: 'var(--color-lumen-text-dim)' }}>Efecto:</strong>{' '}
              {entry.effect}
            </span>
            <span>
              <strong style={{ color: 'var(--color-lumen-accent)' }}>Consejo:</strong>{' '}
              {entry.tip}
            </span>
            {entry.warn && (
              <span style={{ color: 'var(--color-lumen-danger)' }}>
                ⚠️ {entry.warn}
              </span>
            )}
          </div>
        </div>
      ) : (
        <div style={{ color: 'var(--color-lumen-muted)', fontStyle: 'italic', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span>💡</span>
          <span>Pasa el cursor o enfoca con teclado cualquier control para ver su efecto fotográfico, consejos y advertencias.</span>
        </div>
      )}
    </div>
  );
};

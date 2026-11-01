export function PublishServicesPanel() {
  return (
    <div
      style={{
        padding: '10px 12px',
        backgroundColor: 'var(--color-lumen-card)',
        border: '1px solid var(--color-lumen-border)',
        borderRadius: 'var(--radius-md)',
        fontSize: '11px',
        color: 'var(--color-lumen-muted)',
        lineHeight: 1.4,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--color-lumen-text)', fontWeight: 500, marginBottom: '4px' }}>
        <span>☁️</span>
        <span>Servicios en la nube</span>
        <span
          style={{
            fontSize: '9px',
            background: 'var(--color-lumen-surface)',
            border: '1px solid var(--color-lumen-border)',
            color: 'var(--color-lumen-muted)',
            padding: '1px 5px',
            borderRadius: 'var(--radius-sm)',
            marginLeft: 'auto',
          }}
        >
          Próximamente
        </span>
      </div>
      <p style={{ margin: 0, fontSize: '10px', color: 'var(--color-lumen-text-dim)' }}>
        La publicación directa a Flickr, Adobe Stock y galería web en la nube se habilitará en próximas versiones con autenticación OAuth2.
      </p>
    </div>
  );
}

import { useUiStore, type AppModule } from '../stores/ui';

const MODULES: { key: AppModule; label: string }[] = [
  { key: 'library', label: 'Biblioteca' },
  { key: 'develop', label: 'Revelado' },
  { key: 'map', label: 'Mapa' },
  { key: 'book', label: 'Libro' },
  { key: 'slideshow', label: 'Presentación' },
  { key: 'print', label: 'Impresión' },
  { key: 'web', label: 'Web' },
];

export function ModuleBar() {
  const current = useUiStore((s) => s.module);
  const setModule = useUiStore((s) => s.setModule);
  const theme = useUiStore((s) => s.theme);
  const toggleTheme = useUiStore((s) => s.toggleTheme);
  const setShortcutsOpen = useUiStore((s) => s.setShortcutsOpen);
  const setGlossaryOpen = useUiStore((s) => s.setGlossaryOpen);
  const setWalkthroughOpen = useUiStore((s) => s.setWalkthroughOpen);

  return (
    <div
      className="module-bar"
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        backgroundColor: 'var(--color-lumen-bg-deep)',
        borderBottom: '1px solid var(--color-lumen-border)',
        height: '38px',
        padding: '0 12px',
      }}
    >
      {/* Left: Brand Logo & Module Navigation */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
        <span
          className="module-bar__logo"
          style={{
            fontWeight: 700,
            fontSize: '13px',
            color: 'var(--color-lumen-text)',
            marginRight: '12px',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            userSelect: 'none',
          }}
        >
          <span style={{ color: 'var(--color-lumen-accent)', fontSize: '15px' }}>◐</span> Lumen
        </span>

        {MODULES.map((m) => (
          <button
            key={m.key}
            className={`module-bar__btn ${current === m.key ? 'module-bar__btn--active' : ''}`}
            onClick={() => setModule(m.key)}
            style={{
              padding: '6px 12px',
              fontSize: '11.5px',
              fontWeight: current === m.key ? 600 : 500,
              color: current === m.key ? 'var(--color-lumen-accent)' : 'var(--color-lumen-text-dim)',
              backgroundColor: current === m.key ? 'var(--color-lumen-surface)' : 'transparent',
              border: 'none',
              borderRadius: 'var(--radius-sm)',
              cursor: 'pointer',
              transition: 'background-color 150ms ease, color 150ms ease',
            }}
          >
            {m.label}
          </button>
        ))}
      </div>

      {/* Right: Help, Glossary, Shortcuts & Theme Toggle */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
        <button
          onClick={() => setWalkthroughOpen(true)}
          title="Iniciar recorrido guiado de 6 pasos para nuevos usuarios"
          style={{
            background: 'var(--color-lumen-surface)',
            border: '1px solid var(--color-lumen-border)',
            borderRadius: 'var(--radius-sm)',
            color: 'var(--color-lumen-text)',
            padding: '4px 8px',
            fontSize: '11px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
          }}
        >
          🚀 Guía
        </button>

        <button
          onClick={() => setGlossaryOpen(true)}
          title="Glosario de conceptos fotográficos para principiantes"
          style={{
            background: 'var(--color-lumen-surface)',
            border: '1px solid var(--color-lumen-border)',
            borderRadius: 'var(--radius-sm)',
            color: 'var(--color-lumen-text)',
            padding: '4px 8px',
            fontSize: '11px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
          }}
        >
          📖 Glosario
        </button>

        <button
          onClick={() => setShortcutsOpen(true)}
          title="Atajos de teclado interactivos con buscador (?)"
          style={{
            background: 'var(--color-lumen-surface)',
            border: '1px solid var(--color-lumen-border)',
            borderRadius: 'var(--radius-sm)',
            color: 'var(--color-lumen-accent)',
            padding: '4px 8px',
            fontSize: '11px',
            cursor: 'pointer',
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
          }}
        >
          ⌨ Atajos
        </button>

        <button
          onClick={toggleTheme}
          title={`Alternar tema visual (actualmente ${theme === 'dark' ? 'oscuro neutro' : 'claro'})`}
          style={{
            background: 'var(--color-lumen-surface)',
            border: '1px solid var(--color-lumen-border)',
            borderRadius: 'var(--radius-sm)',
            color: 'var(--color-lumen-text)',
            padding: '4px 8px',
            fontSize: '11px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
          }}
        >
          {theme === 'dark' ? '☀️ Claro' : '🌙 Oscuro'}
        </button>
      </div>
    </div>
  );
}

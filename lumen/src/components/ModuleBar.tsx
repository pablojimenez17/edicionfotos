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

  return (
    <div className="module-bar">
      <span className="module-bar__logo">◐ Lumen</span>
      {MODULES.map((m) => (
        <button
          key={m.key}
          className={`module-bar__btn ${current === m.key ? 'module-bar__btn--active' : ''}`}
          onClick={() => setModule(m.key)}
        >
          {m.label}
        </button>
      ))}
    </div>
  );
}

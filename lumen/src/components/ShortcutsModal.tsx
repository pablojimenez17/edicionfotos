import React, { useState, useEffect } from 'react';

interface ShortcutGroup {
  module: string;
  items: { key: string; desc: string }[];
}

const SHORTCUTS_DATA: ShortcutGroup[] = [
  {
    module: 'Navegación General y Paneles',
    items: [
      { key: 'Tab', desc: 'Ocultar / mostrar todos los paneles laterales' },
      { key: '?', desc: 'Abrir este panel de atajos de teclado' },
      { key: 'G', desc: 'Ir a Biblioteca / Vista Cuadrícula' },
      { key: 'E', desc: 'Ir a Vista Lupa (pantalla grande)' },
      { key: 'D', desc: 'Ir al Módulo Revelado' },
    ],
  },
  {
    module: 'Biblioteca y Clasificación',
    items: [
      { key: '1 – 5', desc: 'Asignar puntuación de 1 a 5 estrellas (0 para borrar)' },
      { key: 'P', desc: 'Marcar como elegida (Pick flag)' },
      { key: 'X', desc: 'Marcar como rechazada (Reject flag)' },
      { key: 'U', desc: 'Quitar marcas y banderas' },
      { key: '6 – 9', desc: 'Asignar etiqueta de color (Rojo, Amarillo, Verde, Azul)' },
      { key: 'C', desc: 'Vista Comparar (dos fotos lado a lado)' },
      { key: 'N', desc: 'Vista Encuesta (cribar grupo de fotos)' },
      { key: 'B', desc: 'Añadir / quitar de la Colección Rápida' },
      { key: 'Ctrl + Shift + I', desc: 'Abrir diálogo de Importación' },
      { key: 'Ctrl + Shift + E', desc: 'Abrir diálogo de Exportación' },
    ],
  },
  {
    module: 'Módulo Revelado',
    items: [
      { key: '\\', desc: 'Alternar comparativa Antes / Después (foto original)' },
      { key: 'J', desc: 'Alternar avisos de recorte de sombras y luces' },
      { key: 'R', desc: 'Herramienta Recortar y Enderezar' },
      { key: 'M', desc: 'Panel de Máscaras y Ajustes Locales' },
      { key: 'K', desc: 'Herramienta Pincel de ajuste' },
      { key: 'Ctrl + Shift + C', desc: 'Copiar ajustes actuales al portapapeles' },
      { key: 'Ctrl + Shift + V', desc: 'Pegar ajustes del portapapeles en la foto activa' },
      { key: 'Ctrl + Shift + S', desc: 'Sincronizar ajustes con fotos seleccionadas' },
      { key: 'Ctrl + Shift + R', desc: 'Restablecer todos los ajustes a los valores iniciales' },
      { key: 'Doble clic en control', desc: 'Restablecer cualquier slider individual a 0' },
      { key: 'Mayús + Rueda / Flechas', desc: 'Paso grueso en controles numéricos (5x)' },
    ],
  },
];

interface ShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ShortcutsModal: React.FC<ShortcutsModalProps> = ({ isOpen, onClose }) => {
  const [filter, setFilter] = useState('');

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const normalized = filter.toLowerCase().trim();

  const filteredGroups = SHORTCUTS_DATA.map((group) => ({
    module: group.module,
    items: group.items.filter(
      (item) =>
        item.key.toLowerCase().includes(normalized) ||
        item.desc.toLowerCase().includes(normalized),
    ),
  })).filter((group) => group.items.length > 0);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="shortcuts-modal-title"
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.75)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 10000,
        backdropFilter: 'blur(4px)',
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '580px',
          maxWidth: '92vw',
          maxHeight: '85vh',
          backgroundColor: 'var(--color-lumen-card)',
          border: '1px solid var(--color-lumen-border)',
          borderRadius: 'var(--radius-md)',
          boxShadow: 'var(--shadow-lg)',
          display: 'flex',
          flexDirection: 'column',
          color: 'var(--color-lumen-text)',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '16px 20px',
            borderBottom: '1px solid var(--color-lumen-border)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <div>
            <h2 id="shortcuts-modal-title" style={{ margin: 0, fontSize: '16px', fontWeight: 600 }}>
              Atajos de Teclado
            </h2>
            <div style={{ fontSize: '11px', color: 'var(--color-lumen-text-dim)', marginTop: '2px' }}>
              Pulsa ? en cualquier momento para ver esta lista
            </div>
          </div>

          <button
            onClick={onClose}
            aria-label="Cerrar ventana de atajos"
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--color-lumen-text-dim)',
              fontSize: '18px',
              cursor: 'pointer',
              padding: '2px 6px',
            }}
          >
            ✕
          </button>
        </div>

        {/* Search bar */}
        <div style={{ padding: '12px 20px', borderBottom: '1px solid var(--color-lumen-border-subtle)' }}>
          <input
            type="search"
            aria-label="Buscar atajo o acción"
            placeholder="Buscar atajo o acción (ej: 'exportar', 'recorte', 'G')..."
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            autoFocus
            style={{
              width: '100%',
              padding: '7px 12px',
              backgroundColor: 'var(--color-lumen-surface)',
              border: '1px solid var(--color-lumen-border)',
              borderRadius: 'var(--radius-sm)',
              color: 'var(--color-lumen-text)',
              fontSize: '12px',
              outline: 'none',
            }}
          />
        </div>

        {/* Content list */}
        <div
          tabIndex={0}
          role="region"
          aria-label="Lista de atajos de teclado"
          style={{ flex: 1, overflowY: 'auto', padding: '16px 20px', outline: 'none' }}
        >
          {filteredGroups.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--color-lumen-muted)', fontSize: '13px' }}>
              No se encontraron atajos que coincidan con "{filter}"
            </div>
          ) : (
            filteredGroups.map((group) => (
              <div key={group.module} style={{ marginBottom: '20px' }}>
                <div
                  style={{
                    fontSize: '11px',
                    fontWeight: 600,
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    color: 'var(--color-lumen-accent)',
                    marginBottom: '8px',
                  }}
                >
                  {group.module}
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {group.items.map((item) => (
                    <div
                      key={item.key}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '6px 10px',
                        backgroundColor: 'var(--color-lumen-surface)',
                        borderRadius: 'var(--radius-xs)',
                        fontSize: '12px',
                      }}
                    >
                      <span style={{ color: 'var(--color-lumen-text-dim)' }}>{item.desc}</span>
                      <kbd
                        style={{
                          backgroundColor: 'var(--color-lumen-card)',
                          border: '1px solid var(--color-lumen-border)',
                          borderRadius: 'var(--radius-xs)',
                          padding: '2px 8px',
                          fontSize: '11px',
                          color: 'var(--color-lumen-text)',
                          fontFamily: 'var(--font-mono)',
                          fontWeight: 500,
                          flexShrink: 0,
                          marginLeft: '12px',
                        }}
                      >
                        {item.key}
                      </kbd>
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

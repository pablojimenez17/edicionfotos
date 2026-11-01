import React, { useState } from 'react';

interface GlossaryTerm {
  term: string;
  concept: string;
  example: string;
}

const GLOSSARY_TERMS: GlossaryTerm[] = [
  {
    term: 'Exposición (EV)',
    concept: 'Cantidad total de luz que incide en la imagen. Se mide en valores de exposición (EV) donde +1 EV duplica la luz capturada.',
    example: 'Si disparaste una toma en sombra y quedó oscura, subir la exposición a +0,7 EV ilumina la toma completa de forma natural.',
  },
  {
    term: 'Balance de Blancos y Temperatura',
    concept: 'Ajuste del color de la luz para que los objetos blancos se vean realmente neutros. Se mide en grados Kelvin (de fríos azulados a cálidos dorados).',
    example: 'Una foto tomada bajo tubos fluorescentes o de noche suele verse azulada; subir la temperatura a +15 añade calidez agradable.',
  },
  {
    term: 'Altas Luces y Sombras',
    concept: 'Control independiente de los dos extremos de la gama tonal sin alterar los medios tonos centrales de la piel.',
    example: 'En una foto con nubes blancas intensas, bajar Altas Luces a -40 recupera la textura esponjosa de las nubes que parecía quemada.',
  },
  {
    term: 'Curva de Tonos',
    concept: 'Gráfica interactiva de entrada y salida que mapea las luminosidades. Permite crear curvas en forma de "S" para contraste orgánico.',
    example: 'Levantar suavemente el punto inferior izquierdo (negros) crea el estilo "faded / mate" típico de película analógica clásica.',
  },
  {
    term: 'HSL (Tono, Saturación, Luminancia)',
    concept: 'Ajuste selectivo de color en 8 bandas espectrales independientes (Rojo, Naranja, Amarillo, Verde, Aguamarina, Azul, Púrpura, Magenta).',
    example: 'Para broncear la piel sin alterar el fondo, sube ligeramente la saturación del naranja y baja su luminancia.',
  },
  {
    term: 'Gradación de Color (Color Grading / Split Toning)',
    concept: 'Teñido selectivo de color aplicado por separado a Sombras, Tonos Medios y Altas Luces con ruedas cromáticas.',
    example: 'Estilo cinematográfico "Teal & Orange": sombras teñidas con azul petróleo y luces con ámbar dorado.',
  },
  {
    term: 'Máscaras y Ajustes Locales',
    concept: 'Capas de selección geométrica (radial, lineal) o por pincel que limitan la edición solo a una región de la foto.',
    example: 'Usa una máscara lineal en la parte superior para oscurecer y saturar solo el cielo de un paisaje.',
  },
  {
    term: 'Reducción de Ruido',
    concept: 'Filtro bilateral que analiza y limpia los artefactos de grano de luminancia y motas de color generados al disparar con ISO alto.',
    example: 'En una foto nocturna a ISO 6400, subir la reducción de ruido a 30 alisa el fondo oscuro sin empastar los ojos.',
  },
  {
    term: 'Perfiles de Color (sRGB, AdobeRGB, Display P3)',
    concept: 'Espacios de color estandarizados que definen la gama cromática máxima que un monitor o impresora puede reproducir.',
    example: 'Exporta siempre en sRGB si vas a subir fotos a redes sociales o páginas web para que todos las vean con los mismos colores.',
  },
];

interface GlossaryModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const GlossaryModal: React.FC<GlossaryModalProps> = ({ isOpen, onClose }) => {
  const [filter, setFilter] = useState('');

  React.useEffect(() => {
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
  const filtered = GLOSSARY_TERMS.filter(
    (t) =>
      t.term.toLowerCase().includes(normalized) ||
      t.concept.toLowerCase().includes(normalized) ||
      t.example.toLowerCase().includes(normalized),
  );

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="glossary-title"
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
          width: '620px',
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
            <span
              style={{
                fontSize: '10px',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                color: 'var(--color-lumen-accent)',
                fontWeight: 600,
              }}
            >
              Guía de Aprendizaje
            </span>
            <h2 id="glossary-title" style={{ margin: '2px 0 0 0', fontSize: '16px', fontWeight: 600 }}>
              Glosario Fotográfico para Principiantes
            </h2>
          </div>

          <button
            onClick={onClose}
            aria-label="Cerrar"
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

        {/* Search */}
        <div style={{ padding: '12px 20px', borderBottom: '1px solid var(--color-lumen-border-subtle)' }}>
          <input
            type="search"
            aria-label="Buscar concepto fotográfico"
            placeholder="Buscar término (ej: 'exposición', 'curvas', 'sRGB')..."
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
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

        {/* Terms list */}
        <div
          tabIndex={0}
          role="region"
          aria-label="Lista de términos fotográficos del glosario"
          style={{ flex: 1, overflowY: 'auto', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '14px', outline: 'none' }}
        >
          {filtered.map((item) => (
            <div
              key={item.term}
              style={{
                backgroundColor: 'var(--color-lumen-surface)',
                border: '1px solid var(--color-lumen-border-subtle)',
                borderRadius: 'var(--radius-sm)',
                padding: '12px 14px',
              }}
            >
              <div style={{ fontWeight: 600, fontSize: '13px', color: 'var(--color-lumen-accent)', marginBottom: '4px' }}>
                {item.term}
              </div>
              <div style={{ fontSize: '12.5px', color: 'var(--color-lumen-text)', lineHeight: 1.5, marginBottom: '6px' }}>
                {item.concept}
              </div>
              <div
                style={{
                  fontSize: '11.5px',
                  color: 'var(--color-lumen-text-dim)',
                  backgroundColor: 'var(--color-lumen-card)',
                  padding: '6px 10px',
                  borderRadius: 'var(--radius-xs)',
                  borderLeft: '2px solid var(--color-lumen-accent)',
                  lineHeight: 1.4,
                }}
              >
                <strong>Ejemplo práctico:</strong> {item.example}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

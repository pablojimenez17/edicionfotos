import React, { useState } from 'react';
import { useUiStore } from '../stores/ui';

interface Step {
  title: string;
  icon: string;
  description: string;
  actionText?: string;
  actionTarget?: () => void;
}

interface WalkthroughProps {
  isOpen: boolean;
  onClose: () => void;
}

export const WalkthroughModal: React.FC<WalkthroughProps> = ({ isOpen, onClose }) => {
  const [currentStep, setCurrentStep] = useState(0);
  const setModule = useUiStore((s) => s.setModule);
  const setLibraryView = useUiStore((s) => s.setLibraryView);

  const steps: Step[] = [
    {
      title: '1. Importar tus fotografías',
      icon: '📥',
      description:
        'Lumen trabaja directamente con tus carpetas sin duplicar tus fotos en el disco. Pulsa "Importar" en la barra de herramientas para seleccionar tu carpeta de fotos RAW o JPEG.',
      actionText: 'Ir a Biblioteca',
      actionTarget: () => {
        setModule('library');
        setLibraryView('grid');
      },
    },
    {
      title: '2. Cribar y Clasificar con rapidez',
      icon: '⭐',
      description:
        'Revisa tu sesión a máxima velocidad usando solo el teclado: pulsa del 1 al 5 para asignar estrellas, P para elegir (Pick), X para descartar (Reject) y U para quitar marcas.',
    },
    {
      title: '3. Inspección en Cuadrícula y Lupa',
      icon: '🔍',
      description:
        'Alterna entre la vista Cuadrícula (tecla G) para organizar y la vista Lupa (tecla E o doble clic) para comprobar la nitidez y el enfoque al 100%.',
    },
    {
      title: '4. Revelado No Destructivo a 16 bits',
      icon: '🎨',
      description:
        'Entra en el módulo Revelado (tecla D) para ajustar la exposición, balance de blancos, contraste y curvas. Todos los cambios se calculan por GPU en WebGL en tiempo real.',
      actionText: 'Ver Revelado',
      actionTarget: () => setModule('develop'),
    },
    {
      title: '5. Máscaras y Ajustes Locales',
      icon: '🖌️',
      description:
        'Crea máscaras radiales, degradados lineales o pinta con pincel (tecla M) para retocar solo el cielo o rostros sin alterar el resto de la imagen.',
    },
    {
      title: '6. Comparar y Exportar',
      icon: '🚀',
      description:
        'Pulsa la barra invertida (\\) para comparar tu edición con la foto original. Cuando estés listo, pulsa "Exportar" (Ctrl+Shift+E) para generar copias en sRGB, Display P3 o AdobeRGB.',
    },
  ];

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

  const step = steps[currentStep];

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep((s) => s + 1);
    } else {
      try {
        localStorage.setItem('lumen_walkthrough_seen', 'true');
      } catch {}
      onClose();
    }
  };

  const handlePrev = () => {
    if (currentStep > 0) setCurrentStep((s) => s - 1);
  };

  const handleSkip = () => {
    try {
      localStorage.setItem('lumen_walkthrough_seen', 'true');
    } catch {}
    onClose();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="walkthrough-title"
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
    >
      <div
        style={{
          width: '500px',
          maxWidth: '92vw',
          backgroundColor: 'var(--color-lumen-card)',
          border: '1px solid var(--color-lumen-border)',
          borderRadius: 'var(--radius-md)',
          boxShadow: 'var(--shadow-lg)',
          padding: '24px',
          color: 'var(--color-lumen-text)',
        }}
      >
        {/* Step indicator header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <div style={{ display: 'flex', gap: '6px' }}>
            {steps.map((_, i) => (
              <span
                key={i}
                style={{
                  width: '28px',
                  height: '4px',
                  borderRadius: '2px',
                  backgroundColor:
                    i === currentStep
                      ? 'var(--color-lumen-accent)'
                      : i < currentStep
                      ? 'var(--color-lumen-border-focus)'
                      : 'var(--color-lumen-border)',
                  transition: 'background-color 200ms ease',
                }}
              />
            ))}
          </div>
          <span style={{ fontSize: '11px', color: 'var(--color-lumen-muted)' }}>
            Paso {currentStep + 1} de {steps.length}
          </span>
        </div>

        {/* Content */}
        <div style={{ textAlign: 'center', padding: '16px 0 24px 0' }}>
          <div style={{ fontSize: '48px', marginBottom: '12px' }}>{step.icon}</div>
          <h2 id="walkthrough-title" style={{ fontSize: '17px', fontWeight: 600, marginBottom: '8px' }}>
            {step.title}
          </h2>
          <p style={{ color: 'var(--color-lumen-text-dim)', fontSize: '13px', lineHeight: 1.6, margin: 0 }}>
            {step.description}
          </p>

          {step.actionText && step.actionTarget && (
            <button
              onClick={() => {
                step.actionTarget?.();
                handleNext();
              }}
              style={{
                marginTop: '16px',
                padding: '6px 14px',
                backgroundColor: 'var(--color-lumen-surface)',
                border: '1px solid var(--color-lumen-accent)',
                borderRadius: 'var(--radius-sm)',
                color: 'var(--color-lumen-accent)',
                fontSize: '11.5px',
                cursor: 'pointer',
                fontWeight: 500,
              }}
            >
              {step.actionText} →
            </button>
          )}
        </div>

        {/* Buttons */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--color-lumen-border)', paddingTop: '16px' }}>
          <button
            onClick={handleSkip}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--color-lumen-muted)',
              fontSize: '12px',
              cursor: 'pointer',
              padding: '6px 8px',
            }}
          >
            Omitir recorrido
          </button>

          <div style={{ display: 'flex', gap: '8px' }}>
            {currentStep > 0 && (
              <button
                onClick={handlePrev}
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
                Anterior
              </button>
            )}
            <button
              onClick={handleNext}
              style={{
                padding: '6px 16px',
                backgroundColor: 'var(--color-lumen-accent)',
                border: 'none',
                borderRadius: 'var(--radius-sm)',
                color: '#fff',
                fontSize: '12px',
                cursor: 'pointer',
                fontWeight: 600,
              }}
            >
              {currentStep === steps.length - 1 ? '¡Comenzar!' : 'Siguiente'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

import React, { useCallback } from 'react';

interface PanelResizerProps {
  side: 'left' | 'right';
  onResize: (width: number) => void;
  currentWidth: number;
}

export const PanelResizer: React.FC<PanelResizerProps> = ({ side, onResize, currentWidth }) => {
  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      const startX = e.clientX;
      const startWidth = currentWidth;

      const handleMouseMove = (moveEvent: MouseEvent) => {
        const delta = moveEvent.clientX - startX;
        const newWidth = side === 'left' ? startWidth + delta : startWidth - delta;
        onResize(newWidth);
      };

      const handleMouseUp = () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      };

      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    },
    [side, onResize, currentWidth],
  );

  return (
    <div
      onMouseDown={handleMouseDown}
      role="separator"
      aria-orientation="vertical"
      aria-label={`Redimensionar panel ${side === 'left' ? 'izquierdo' : 'derecho'}`}
      aria-valuenow={currentWidth}
      aria-valuemin={side === 'left' ? 200 : 240}
      aria-valuemax={side === 'left' ? 500 : 550}
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'ArrowLeft') {
          onResize(currentWidth + (side === 'left' ? -10 : 10));
        } else if (e.key === 'ArrowRight') {
          onResize(currentWidth + (side === 'left' ? 10 : -10));
        }
      }}
      style={{
        width: '4px',
        cursor: 'col-resize',
        backgroundColor: 'transparent',
        transition: 'background-color 150ms ease',
        flexShrink: 0,
        zIndex: 10,
        position: 'relative',
      }}
      className="panel-resizer hover:bg-[var(--color-lumen-accent)] active:bg-[var(--color-lumen-accent)]"
      title={`Arrastra para cambiar ancho del panel ${side === 'left' ? 'izquierdo' : 'derecho'}`}
    />
  );
};

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useHelpStore } from '../help/helpStore';
import { useDevelopStore } from '../stores/develop';

interface AccessibleSliderProps {
  label: string;
  helpId?: string;
  min: number;
  max: number;
  step: number;
  value: number;
  defaultValue?: number;
  displayValue?: string | number;
  onChange: (v: number) => void;
  onReset?: () => void;
  gradient?: string;
  unit?: string;
}

export const AccessibleSlider: React.FC<AccessibleSliderProps> = ({
  label,
  helpId,
  min,
  max,
  step,
  value,
  defaultValue = 0,
  displayValue,
  onChange,
  onReset,
  gradient,
  unit = '',
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editInput, setEditInput] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const sliderRef = useRef<HTMLInputElement>(null);

  const setActiveHelpId = useHelpStore((s) => s.setActiveHelpId);

  const isModified = Math.abs(value - defaultValue) > 0.0001;

  const handleReset = useCallback(() => {
    if (onReset) {
      onReset();
    } else {
      onChange(defaultValue);
    }
  }, [onReset, onChange, defaultValue]);

  const startEditing = () => {
    setEditInput(String(displayValue !== undefined ? displayValue : value));
    setIsEditing(true);
  };

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const commitEdit = () => {
    const parsed = parseFloat(editInput);
    if (!isNaN(parsed)) {
      const clamped = Math.max(min, Math.min(max, parsed));
      onChange(clamped);
    }
    setIsEditing(false);
  };

  // Wheel handling with fine and coarse steps (Shift = 5x step)
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const multiplier = e.shiftKey ? 5 : 1;
    const direction = e.deltaY < 0 ? 1 : -1;
    const delta = step * multiplier * direction;
    const nextVal = Math.max(min, Math.min(max, parseFloat((value + delta).toFixed(4))));
    onChange(nextVal);
  };

  // Keyboard arrow keys with Shift for coarse step
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowUp' || e.key === 'ArrowRight') {
      if (e.shiftKey) {
        e.preventDefault();
        const nextVal = Math.max(min, Math.min(max, parseFloat((value + step * 5).toFixed(4))));
        onChange(nextVal);
      }
    } else if (e.key === 'ArrowDown' || e.key === 'ArrowLeft') {
      if (e.shiftKey) {
        e.preventDefault();
        const nextVal = Math.max(min, Math.min(max, parseFloat((value - step * 5).toFixed(4))));
        onChange(nextVal);
      }
    }
  };

  const formattedDisplay = displayValue !== undefined ? displayValue : Math.round(value * 100) / 100;

  return (
    <div
      onMouseEnter={() => helpId && setActiveHelpId(helpId)}
      onMouseLeave={() => helpId && setActiveHelpId(null)}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: '6px',
        fontSize: '11px',
        position: 'relative',
      }}
    >
      {/* Label with modified indicator dot & double click reset */}
      <div
        onDoubleClick={handleReset}
        title="Doble clic para restablecer (Paso fino con rueda/flechas, Mayús para paso grueso)"
        style={{
          width: '84px',
          display: 'flex',
          alignItems: 'center',
          gap: '4px',
          color: isModified ? 'var(--color-lumen-text)' : 'var(--color-lumen-muted)',
          cursor: 'pointer',
          userSelect: 'none',
          fontWeight: isModified ? 500 : 400,
        }}
      >
        <span
          style={{
            width: '5px',
            height: '5px',
            borderRadius: '50%',
            backgroundColor: isModified ? 'var(--color-lumen-accent)' : 'transparent',
            flexShrink: 0,
            display: 'inline-block',
          }}
          title={isModified ? 'Ajuste modificado' : undefined}
        />
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {label}
        </span>
      </div>

      {/* Slider Range Input */}
      <input
        ref={sliderRef}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onWheel={handleWheel}
        onKeyDown={handleKeyDown}
        onPointerDown={() => {
          useDevelopStore.getState().setIsDraggingSlider(true);
        }}
        onPointerUp={() => {
          useDevelopStore.getState().setIsDraggingSlider(false);
        }}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        onFocus={() => helpId && setActiveHelpId(helpId)}
        onBlur={() => helpId && setActiveHelpId(null)}
        aria-label={label}
        aria-valuenow={value}
        aria-valuemin={min}
        aria-valuemax={max}
        style={{
          flex: 1,
          margin: '0 8px',
          accentColor: 'var(--color-lumen-accent)',
          cursor: 'ew-resize',
          height: '4px',
          background: gradient || 'var(--color-lumen-border)',
          borderRadius: '2px',
          outline: 'none',
        }}
      />

      {/* Editable Numeric Value */}
      {isEditing ? (
        <input
          ref={inputRef}
          type="number"
          value={editInput}
          onChange={(e) => setEditInput(e.target.value)}
          onBlur={commitEdit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commitEdit();
            if (e.key === 'Escape') setIsEditing(false);
          }}
          step={step}
          min={min}
          max={max}
          style={{
            width: '44px',
            padding: '1px 3px',
            fontSize: '11px',
            textAlign: 'right',
            backgroundColor: 'var(--color-lumen-surface)',
            color: 'var(--color-lumen-text)',
            border: '1px solid var(--color-lumen-accent)',
            borderRadius: 'var(--radius-xs)',
            fontFamily: 'var(--font-mono)',
            outline: 'none',
          }}
        />
      ) : (
        <span
          onClick={startEditing}
          onDoubleClick={handleReset}
          title="Clic para editar valor directamente, doble clic para restablecer"
          style={{
            width: '44px',
            textAlign: 'right',
            fontVariantNumeric: 'tabular-nums',
            fontFamily: 'var(--font-mono)',
            fontSize: '11px',
            color: isModified ? 'var(--color-lumen-accent)' : 'var(--color-lumen-muted)',
            fontWeight: isModified ? 600 : 400,
            cursor: 'pointer',
            userSelect: 'none',
            padding: '1px 3px',
            borderRadius: '2px',
          }}
        >
          {formattedDisplay}
          {unit}
        </span>
      )}
    </div>
  );
};

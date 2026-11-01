import React, { useState, useRef, useEffect, useCallback } from 'react';
import { HELP_ES, type HelpEntry } from '../help/help.es';
import { useHelpStore } from '../help/helpStore';

interface TooltipProps {
  helpId?: string;
  fallbackText?: string;
  children: React.ReactElement;
  position?: 'top' | 'bottom' | 'left' | 'right';
  shortcut?: string;
}

export const Tooltip: React.FC<TooltipProps> = ({
  helpId,
  fallbackText,
  children,
  position = 'top',
  shortcut,
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const timerRef = useRef<number | null>(null);
  const setActiveHelpId = useHelpStore((s) => s.setActiveHelpId);

  const entry: HelpEntry | undefined = helpId ? HELP_ES[helpId] : undefined;
  const title = entry?.title || fallbackText || '';
  const what = entry?.what || '';
  const keyShortcut = shortcut || entry?.shortcut;

  const show = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => {
      setIsVisible(true);
      if (helpId) setActiveHelpId(helpId);
    }, 500); // 500 ms standard delay
  }, [helpId, setActiveHelpId]);

  const hide = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    setIsVisible(false);
    if (helpId) setActiveHelpId(null);
  }, [helpId, setActiveHelpId]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  if (!title && !what) {
    return children;
  }

  const tooltipId = helpId ? `tooltip-${helpId}` : undefined;

  const child = children as React.ReactElement<any>;
  const trigger = React.cloneElement(child, {
    onMouseEnter: (e: React.MouseEvent) => {
      child.props.onMouseEnter?.(e);
      show();
    },
    onMouseLeave: (e: React.MouseEvent) => {
      child.props.onMouseLeave?.(e);
      hide();
    },
    onFocus: (e: React.FocusEvent) => {
      child.props.onFocus?.(e);
      show();
    },
    onBlur: (e: React.FocusEvent) => {
      child.props.onBlur?.(e);
      hide();
    },
    'aria-describedby': tooltipId,
  });

  return (
    <div className="relative inline-flex" style={{ display: 'inline-flex' }}>
      {trigger}
      {isVisible && (
        <div
          id={tooltipId}
          role="tooltip"
          style={{
            position: 'absolute',
            zIndex: 9999,
            backgroundColor: 'var(--color-lumen-card)',
            color: 'var(--color-lumen-text)',
            border: '1px solid var(--color-lumen-border)',
            borderRadius: 'var(--radius-sm)',
            padding: '6px 10px',
            fontSize: '11px',
            lineHeight: 1.4,
            boxShadow: 'var(--shadow-md)',
            pointerEvents: 'none',
            whiteSpace: 'normal',
            maxWidth: '240px',
            width: 'max-content',
            bottom: position === 'top' ? 'calc(100% + 6px)' : undefined,
            top: position === 'bottom' ? 'calc(100% + 6px)' : undefined,
            left: position === 'top' || position === 'bottom' ? '50%' : undefined,
            transform:
              position === 'top' || position === 'bottom' ? 'translateX(-50%)' : undefined,
            animation: 'fadeIn 120ms ease-out',
          }}
        >
          <div style={{ fontWeight: 600, display: 'flex', justifyContent: 'space-between', gap: '8px' }}>
            <span>{title}</span>
            {keyShortcut && (
              <kbd
                style={{
                  background: 'var(--color-lumen-surface)',
                  padding: '1px 4px',
                  borderRadius: '2px',
                  fontSize: '9px',
                  border: '1px solid var(--color-lumen-border)',
                  color: 'var(--color-lumen-accent)',
                  fontFamily: 'var(--font-mono)',
                }}
              >
                {keyShortcut}
              </kbd>
            )}
          </div>
          {what && <div style={{ color: 'var(--color-lumen-text-dim)', marginTop: '2px', fontSize: '10.5px' }}>{what}</div>}
        </div>
      )}
    </div>
  );
};

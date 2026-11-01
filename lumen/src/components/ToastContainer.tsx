import React from 'react';
import { useToastStore, type Toast } from '../stores/toast';

export const ToastContainer: React.FC = () => {
  const { toasts, removeToast } = useToastStore();

  if (toasts.length === 0) return null;

  return (
    <div
      className="fixed bottom-10 right-6 z-50 flex flex-col gap-2 max-w-md w-full pointer-events-none"
      role="region"
      aria-label="Notificaciones del sistema"
    >
      {toasts.map((toastItem: Toast) => {
        const bgColors = {
          info: 'bg-zinc-800/95 border-sky-500/50 text-sky-200',
          success: 'bg-zinc-800/95 border-emerald-500/50 text-emerald-200',
          warning: 'bg-zinc-800/95 border-amber-500/50 text-amber-200',
          error: 'bg-zinc-900/95 border-rose-500/60 text-rose-200',
        }[toastItem.type];

        const icon = {
          info: 'ℹ️',
          success: '✅',
          warning: '⚠️',
          error: '🛑',
        }[toastItem.type];

        return (
          <div
            key={toastItem.id}
            className={`pointer-events-auto flex items-start gap-3 p-3.5 rounded-lg border shadow-2xl backdrop-blur-md transition-all duration-200 animate-in slide-in-from-bottom-2 ${bgColors}`}
            role="alert"
          >
            <span className="text-base select-none mt-0.5">{icon}</span>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-zinc-100 leading-relaxed whitespace-pre-wrap break-words">
                {toastItem.message}
              </p>
              {toastItem.action && (
                <button
                  type="button"
                  onClick={() => {
                    toastItem.action?.onClick();
                    removeToast(toastItem.id);
                  }}
                  className="mt-2 text-xs font-semibold px-2.5 py-1 rounded bg-zinc-700/80 hover:bg-zinc-600 text-white border border-zinc-500/40 transition-colors"
                >
                  {toastItem.action.label}
                </button>
              )}
            </div>
            <button
              type="button"
              onClick={() => removeToast(toastItem.id)}
              className="text-zinc-400 hover:text-zinc-200 text-sm p-0.5 ml-1 select-none"
              aria-label="Cerrar notificación"
            >
              ✕
            </button>
          </div>
        );
      })}
    </div>
  );
};

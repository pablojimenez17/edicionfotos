import { create } from 'zustand';

export interface ToastAction {
  label: string;
  onClick: () => void;
}

export interface Toast {
  id: string;
  type: 'info' | 'success' | 'warning' | 'error';
  message: string;
  action?: ToastAction;
  duration?: number;
}

interface ToastState {
  toasts: Toast[];
  addToast: (toast: Omit<Toast, 'id'>) => string;
  removeToast: (id: string) => void;
  clearToasts: () => void;
}

export const useToastStore = create<ToastState>((set) => ({
  toasts: [],
  addToast: (toast) => {
    const id = `toast_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const newToast: Toast = { ...toast, id };
    set((state) => ({ toasts: [...state.toasts, newToast] }));

    const duration = toast.duration ?? (toast.type === 'error' ? 8000 : 4000);
    if (duration > 0) {
      setTimeout(() => {
        set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) }));
      }, duration);
    }

    return id;
  },
  removeToast: (id) =>
    set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) })),
  clearToasts: () => set({ toasts: [] }),
}));

export const toast = {
  info: (message: string, action?: ToastAction, duration?: number) =>
    useToastStore.getState().addToast({ type: 'info', message, action, duration }),
  success: (message: string, duration?: number) =>
    useToastStore.getState().addToast({ type: 'success', message, duration }),
  warning: (message: string, action?: ToastAction, duration?: number) =>
    useToastStore.getState().addToast({ type: 'warning', message, action, duration }),
  error: (message: string, action?: ToastAction, duration?: number) =>
    useToastStore.getState().addToast({ type: 'error', message, action, duration }),
};

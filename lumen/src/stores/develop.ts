/**
 * Develop Zustand Store
 *
 * Manages active develop adjustments, history (capped at 100 steps),
 * snapshots, before/after comparison (\ key), copy/paste adjustments,
 * and develop tool modes.
 */

import { create } from 'zustand';
import type { LumenSettings } from '../types';
import { createDefaultSettings } from '../types';
import { savePhotoSettings, getPhotoSettings } from '../services/catalog';

interface HistoryEntry {
  label: string;
  settings: LumenSettings;
  timestamp: string;
}

interface DevelopState {
  // Current editing state
  activePhotoId: number | null;
  isRawActive: boolean;
  settings: LumenSettings;
  originalSettings: LumenSettings;

  // Comparison & Display
  showBeforeAfter: boolean;
  isDraggingSlider: boolean;

  // History & Snapshots
  history: HistoryEntry[];
  historyIndex: number;
  snapshots: { id: string; name: string; settings: LumenSettings }[];

  // Clipboard for copy/paste adjustments (Ctrl+Shift+C / Ctrl+Shift+V)
  clipboardSettings: Partial<LumenSettings> | null;

  // Actions
  loadPhotoSettings: (photoId: number, isRaw?: boolean) => Promise<void>;
  updateSetting: <K extends keyof LumenSettings>(key: K, value: LumenSettings[K], label?: string) => void;
  updateSettings: (patch: Partial<LumenSettings>, label?: string) => void;
  resetAll: () => void;
  toggleBeforeAfter: () => void;
  setShowBeforeAfter: (show: boolean) => void;
  setIsDraggingSlider: (dragging: boolean) => void;

  // History Actions
  undo: () => void;
  redo: () => void;
  jumpToHistory: (index: number) => void;
  createSnapshot: (name: string) => void;

  // Copy / Paste
  copySettings: () => void;
  pasteSettings: () => void;
}

export const useDevelopStore = create<DevelopState>((set, get) => ({
  activePhotoId: null,
  isRawActive: false,
  settings: createDefaultSettings(),
  originalSettings: createDefaultSettings(),
  showBeforeAfter: false,
  isDraggingSlider: false,
  history: [],
  historyIndex: -1,
  snapshots: [],
  clipboardSettings: null,

  setShowBeforeAfter: (show) => set({ showBeforeAfter: show }),

  loadPhotoSettings: async (photoId: number, isRaw?: boolean) => {
    const saved = await getPhotoSettings(photoId);
    const defaults = createDefaultSettings(isRaw);
    const settings = saved ? { ...defaults, ...saved } : defaults;
    set({
      activePhotoId: photoId,
      isRawActive: !!isRaw,
      settings,
      originalSettings: JSON.parse(JSON.stringify(settings)),
      history: [{ label: 'Importar / Estado inicial', settings, timestamp: new Date().toLocaleTimeString() }],
      historyIndex: 0,
      showBeforeAfter: false,
    });
  },

  updateSetting: (key, value, label) => {
    const { settings, activePhotoId, history, historyIndex } = get();
    const newSettings = { ...settings, [key]: value };

    // Truncate future redo history if we are in the middle of the stack
    const newHistory = history.slice(0, historyIndex + 1);
    if (label) {
      newHistory.push({
        label,
        settings: JSON.parse(JSON.stringify(newSettings)),
        timestamp: new Date().toLocaleTimeString(),
      });
      // Cap at 100 steps
      if (newHistory.length > 100) newHistory.shift();
    }

    set({
      settings: newSettings,
      history: newHistory,
      historyIndex: newHistory.length - 1,
    });

    if (activePhotoId !== null && label) {
      savePhotoSettings(activePhotoId, newSettings, label);
    }
  },

  updateSettings: (patch, label) => {
    const { settings, activePhotoId, history, historyIndex } = get();
    const newSettings = { ...settings, ...patch };

    const newHistory = history.slice(0, historyIndex + 1);
    if (label) {
      newHistory.push({
        label,
        settings: JSON.parse(JSON.stringify(newSettings)),
        timestamp: new Date().toLocaleTimeString(),
      });
      if (newHistory.length > 100) newHistory.shift();
    }

    set({
      settings: newSettings,
      history: newHistory,
      historyIndex: newHistory.length - 1,
    });

    if (activePhotoId !== null && label) {
      savePhotoSettings(activePhotoId, newSettings, label);
    }
  },

  resetAll: () => {
    const defaults = createDefaultSettings(get().isRawActive);
    get().updateSettings(defaults, 'Restablecer todos los ajustes');
  },

  toggleBeforeAfter: () => {
    set((s) => ({ showBeforeAfter: !s.showBeforeAfter }));
  },

  setIsDraggingSlider: (dragging) => {
    set({ isDraggingSlider: dragging });
  },

  undo: () => {
    const { history, historyIndex, activePhotoId } = get();
    if (historyIndex > 0) {
      const target = history[historyIndex - 1];
      set({
        historyIndex: historyIndex - 1,
        settings: JSON.parse(JSON.stringify(target.settings)),
      });
      if (activePhotoId !== null) {
        savePhotoSettings(activePhotoId, target.settings);
      }
    }
  },

  redo: () => {
    const { history, historyIndex, activePhotoId } = get();
    if (historyIndex < history.length - 1) {
      const target = history[historyIndex + 1];
      set({
        historyIndex: historyIndex + 1,
        settings: JSON.parse(JSON.stringify(target.settings)),
      });
      if (activePhotoId !== null) {
        savePhotoSettings(activePhotoId, target.settings);
      }
    }
  },

  jumpToHistory: (index) => {
    const { history, activePhotoId } = get();
    if (index >= 0 && index < history.length) {
      const target = history[index];
      set({
        historyIndex: index,
        settings: JSON.parse(JSON.stringify(target.settings)),
      });
      if (activePhotoId !== null) {
        savePhotoSettings(activePhotoId, target.settings);
      }
    }
  },

  createSnapshot: (name) => {
    const { settings, snapshots } = get();
    set({
      snapshots: [
        ...snapshots,
        {
          id: String(Date.now()),
          name,
          settings: JSON.parse(JSON.stringify(settings)),
        },
      ],
    });
  },

  copySettings: () => {
    const { settings } = get();
    // Exclude geometry crop when copying general color settings
    const toCopy = { ...settings };
    set({ clipboardSettings: toCopy });
  },

  pasteSettings: () => {
    const { clipboardSettings, updateSettings } = get();
    if (clipboardSettings) {
      updateSettings(clipboardSettings, 'Pegar ajustes');
    }
  },
}));

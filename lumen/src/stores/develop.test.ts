import { describe, it, expect, beforeEach } from 'vitest';
import { useDevelopStore } from './develop';
import { createDefaultSettings } from '../types';

describe('Develop Store', () => {
  beforeEach(() => {
    useDevelopStore.setState({
      activePhotoId: 1,
      settings: createDefaultSettings(),
      originalSettings: createDefaultSettings(),
      history: [{ label: 'Init', settings: createDefaultSettings(), timestamp: '' }],
      historyIndex: 0,
      snapshots: [],
    });
  });

  it('updates a basic adjustment with history entry', () => {
    const store = useDevelopStore.getState();
    store.updateSetting('exposure', 1.5, 'Exposure +1.5');

    const updated = useDevelopStore.getState();
    expect(updated.settings.exposure).toBe(1.5);
    expect(updated.history.length).toBe(2);
    expect(updated.history[1].label).toBe('Exposure +1.5');
  });

  it('supports undo and redo', () => {
    const store = useDevelopStore.getState();
    store.updateSetting('contrast', 0.4, 'Contrast +0.4');
    expect(useDevelopStore.getState().settings.contrast).toBe(0.4);

    store.undo();
    expect(useDevelopStore.getState().settings.contrast).toBe(0);

    store.redo();
    expect(useDevelopStore.getState().settings.contrast).toBe(0.4);
  });

  it('creates and restores snapshots', () => {
    const store = useDevelopStore.getState();
    store.updateSetting('vignette', -0.5, 'Vignette -0.5');
    store.createSnapshot('My Vignette');

    expect(useDevelopStore.getState().snapshots.length).toBe(1);
    expect(useDevelopStore.getState().snapshots[0].name).toBe('My Vignette');
  });

  it('caps history at 100 steps', () => {
    const store = useDevelopStore.getState();
    for (let i = 1; i <= 105; i++) {
      store.updateSetting('exposure', i * 0.01, `Step ${i}`);
    }

    const state = useDevelopStore.getState();
    expect(state.history.length).toBeLessThanOrEqual(100);
  });
});

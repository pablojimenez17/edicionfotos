import { useState } from 'react';

import { useCatalogStore } from '../../stores/catalog';
import { useDevelopStore } from '../../stores/develop';
import { savePhotoSettings, getPhotoSettings } from '../../services/catalog';
import type { LumenSettings } from '../../types';

export function SyncSettingsModal({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  const selectedPhotoIds = useCatalogStore((s) => s.selectedPhotoIds);
  const activePhotoId = useCatalogStore((s) => s.activePhotoId);
  const currentSettings = useDevelopStore((s) => s.settings);

  // Categories to sync
  const [categories, setCategories] = useState({
    basic: true,
    toneCurve: true,
    hsl: true,
    detail: true,
    effects: true,
    geometry: false, // crop usually kept separate
    masks: false,
  });

  if (!isOpen) return null;

  const targetIds = Array.from(selectedPhotoIds).filter((id) => id !== activePhotoId);

  const toggleCategory = (key: keyof typeof categories) => {
    setCategories((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleSync = async () => {
    if (targetIds.length === 0) {
      onClose();
      return;
    }

    // Build partial settings object to sync
    const patch: Partial<LumenSettings> = {};

    if (categories.basic) {
      patch.exposure = currentSettings.exposure;
      patch.contrast = currentSettings.contrast;
      patch.highlights = currentSettings.highlights;
      patch.shadows = currentSettings.shadows;
      patch.whites = currentSettings.whites;
      patch.blacks = currentSettings.blacks;
      patch.temperature = currentSettings.temperature;
      patch.tint = currentSettings.tint;
      patch.vibrance = currentSettings.vibrance;
      patch.saturation = currentSettings.saturation;
      patch.bw = currentSettings.bw;
    }

    if (categories.toneCurve) {
      patch.curvePoints = JSON.parse(JSON.stringify(currentSettings.curvePoints));
    }

    if (categories.hsl) {
      patch.hsl = JSON.parse(JSON.stringify(currentSettings.hsl));
    }

    if (categories.detail) {
      patch.sharpen = currentSettings.sharpen;
      patch.blur = currentSettings.blur;
    }

    if (categories.effects) {
      patch.vignette = currentSettings.vignette;
      patch.grain = currentSettings.grain;
      patch.matte = currentSettings.matte;
    }

    if (categories.geometry) {
      patch.geometry = JSON.parse(JSON.stringify(currentSettings.geometry));
    }

    if (categories.masks) {
      patch.masks = JSON.parse(JSON.stringify(currentSettings.masks));
    }

    // Apply and persist to all target photos
    for (const pid of targetIds) {
      const existing = await getPhotoSettings(pid) || {};
      const merged = { ...existing, ...patch };
      await savePhotoSettings(pid, merged, 'Sincronizar ajustes');
    }

    onClose();
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0,0,0,0.7)',
        backdropFilter: 'blur(4px)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <div
        style={{
          width: '420px',
          backgroundColor: '#18181b',
          border: '1px solid #3f3f46',
          borderRadius: '8px',
          boxShadow: '0 20px 40px rgba(0,0,0,0.8)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '12px 16px',
            backgroundColor: '#202024',
            borderBottom: '1px solid #27272a',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <span style={{ fontWeight: 600, fontSize: '13px', color: '#fff' }}>
            Sincronizar ajustes
          </span>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: '#a1a1aa',
              fontSize: '13px',
              cursor: 'pointer',
            }}
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <div style={{ fontSize: '11px', color: '#a1a1aa', marginBottom: '4px' }}>
            Sincronizar ajustes de la foto activa con {targetIds.length} foto(s) seleccionada(s):
          </div>

          {[
            { key: 'basic', label: 'Básico (Exposición, Contraste, Blancos/Negros, Temp, Sat)' },
            { key: 'toneCurve', label: 'Curva de tonos' },
            { key: 'hsl', label: 'Color / HSL (8 bandas)' },
            { key: 'detail', label: 'Detalle (Enfoque, Desenfoque)' },
            { key: 'effects', label: 'Efectos (Viñeta, Grano, Mate)' },
            { key: 'geometry', label: 'Geometría y Recorte' },
            { key: 'masks', label: 'Máscaras locales (Radiales y Lineales)' },
          ].map(({ key, label }) => (
            <label
              key={key}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                fontSize: '12px',
                color: '#e4e4e7',
                cursor: 'pointer',
              }}
            >
              <input
                type="checkbox"
                checked={categories[key as keyof typeof categories]}
                onChange={() => toggleCategory(key as keyof typeof categories)}
                style={{ accentColor: '#3b82f6', width: '15px', height: '15px' }}
              />
              <span>{label}</span>
            </label>
          ))}
        </div>

        {/* Actions */}
        <div
          style={{
            padding: '10px 16px',
            backgroundColor: '#1b1b1f',
            borderTop: '1px solid #27272a',
            display: 'flex',
            justifyContent: 'flex-end',
            gap: '8px',
          }}
        >
          <button
            onClick={onClose}
            style={{
              backgroundColor: 'transparent',
              border: '1px solid #3f3f46',
              borderRadius: '4px',
              color: '#d4d4d8',
              padding: '6px 14px',
              fontSize: '11px',
              cursor: 'pointer',
            }}
          >
            Cancelar
          </button>
          <button
            onClick={handleSync}
            disabled={targetIds.length === 0}
            style={{
              backgroundColor: '#3b82f6',
              border: 'none',
              borderRadius: '4px',
              color: '#fff',
              padding: '6px 16px',
              fontSize: '11px',
              fontWeight: 600,
              cursor: targetIds.length === 0 ? 'not-allowed' : 'pointer',
              opacity: targetIds.length === 0 ? 0.5 : 1,
            }}
          >
            Sincronizar ({targetIds.length} fotos)
          </button>
        </div>
      </div>
    </div>
  );
}

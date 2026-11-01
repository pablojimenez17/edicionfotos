import { useState, useEffect } from 'react';
import { useCatalogStore } from '../../stores/catalog';
import { useDevelopStore } from '../../stores/develop';
import { useUiStore } from '../../stores/ui';
import { BUILT_IN_PRESETS } from '../../types';
import { getUserPresets, saveUserPreset, deleteUserPreset } from '../../services/catalog';

export function DevelopLeftPanel() {
  const leftPanelWidth = useUiStore((s) => s.leftPanelWidth);
  const activePhotoId = useCatalogStore((s) => s.activePhotoId);
  const photos = useCatalogStore((s) => s.photos);
  const activePhoto = photos.find((p) => p.id === activePhotoId) || null;

  const history = useDevelopStore((s) => s.history);
  const historyIndex = useDevelopStore((s) => s.historyIndex);
  const jumpToHistory = useDevelopStore((s) => s.jumpToHistory);

  const snapshots = useDevelopStore((s) => s.snapshots);
  const createSnapshot = useDevelopStore((s) => s.createSnapshot);

  const currentSettings = useDevelopStore((s) => s.settings);
  const updateSettings = useDevelopStore((s) => s.updateSettings);

  const [snapshotName, setSnapshotName] = useState('');
  const [showSnapshotInput, setShowSnapshotInput] = useState(false);

  // User Presets state
  const [userPresets, setUserPresets] = useState<any[]>([]);
  const [showPresetModal, setShowPresetModal] = useState(false);
  const [newPresetName, setNewPresetName] = useState('');
  const [newPresetGroup, setNewPresetGroup] = useState('Mis Ajustes');

  const loadPresets = async () => {
    const list = await getUserPresets();
    setUserPresets(list);
  };

  useEffect(() => {
    loadPresets();
  }, []);

  const handleApplyPreset = (presetName: string) => {
    const preset = BUILT_IN_PRESETS[presetName];
    if (preset) {
      updateSettings(preset, `Ajuste: ${presetName}`);
    }
  };

  const handleApplyUserPreset = (p: any) => {
    try {
      const parsed = typeof p.settings === 'string' ? JSON.parse(p.settings) : p.settings;
      updateSettings(parsed, `Preset: ${p.name}`);
    } catch (err) {
      console.error('Failed to parse user preset:', err);
    }
  };

  const handleSavePreset = async () => {
    if (!newPresetName.trim()) return;
    // Extract current settings without transient properties
    const toSave: any = {
      exposure: currentSettings.exposure,
      contrast: currentSettings.contrast,
      highlights: currentSettings.highlights,
      shadows: currentSettings.shadows,
      whites: currentSettings.whites,
      blacks: currentSettings.blacks,
      temperature: currentSettings.temperature,
      tint: currentSettings.tint,
      vibrance: currentSettings.vibrance,
      saturation: currentSettings.saturation,
      curvePoints: currentSettings.curvePoints,
      hsl: currentSettings.hsl,
      sharpen: currentSettings.sharpen,
      blur: currentSettings.blur,
      vignette: currentSettings.vignette,
      grain: currentSettings.grain,
      matte: currentSettings.matte,
      bw: currentSettings.bw,
    };
    await saveUserPreset(newPresetName.trim(), newPresetGroup.trim() || 'Mis Ajustes', toSave);
    setNewPresetName('');
    setShowPresetModal(false);
    await loadPresets();
  };

  const handleDeleteUserPreset = async (e: React.MouseEvent, id: number) => {
    e.stopPropagation();
    await deleteUserPreset(id);
    await loadPresets();
  };

  const handleCreateSnapshot = () => {
    if (!snapshotName.trim()) return;
    createSnapshot(snapshotName.trim());
    setSnapshotName('');
    setShowSnapshotInput(false);
  };

  return (
    <div className="panel panel--left" style={{ width: `${leftPanelWidth}px`, overflowY: 'auto', flexShrink: 0 }}>
      {/* Navigator Thumbnail */}
      <div className="panel-header">Navegador</div>
      <div style={{ padding: '8px 12px', display: 'flex', justifyContent: 'center' }}>
        <div
          style={{
            width: '100%',
            height: '110px',
            backgroundColor: '#18181b',
            borderRadius: '4px',
            overflow: 'hidden',
            border: '1px solid #27272a',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {activePhoto?.thumbnailUrl ? (
            <img
              src={activePhoto.thumbnailUrl}
              alt={activePhoto.filename}
              style={{ width: '100%', height: '100%', objectFit: 'contain' }}
            />
          ) : (
            <span style={{ fontSize: '11px', color: '#52525b' }}>Sin imagen activa</span>
          )}
        </div>
      </div>

      {/* Presets Header with "+ Guardar" */}
      <div
        className="panel-header"
        style={{
          marginTop: '6px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <span>Ajustes preestablecidos</span>
        <button
          onClick={() => setShowPresetModal(true)}
          style={{
            background: 'none',
            border: 'none',
            color: '#3b82f6',
            cursor: 'pointer',
            fontSize: '11px',
            fontWeight: 600,
          }}
          title="Guardar ajuste actual como nuevo preset"
        >
          + Guardar
        </button>
      </div>

      {/* User Presets List */}
      {userPresets.length > 0 && (
        <div style={{ padding: '4px 8px', borderBottom: '1px solid #27272a' }}>
          <div style={{ fontSize: '10px', color: '#3b82f6', fontWeight: 600, marginBottom: '4px' }}>
            DE USUARIO
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
            {userPresets.map((p) => (
              <div
                key={p.id}
                onClick={() => handleApplyUserPreset(p)}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  backgroundColor: '#1e293b',
                  border: '1px solid #334155',
                  borderRadius: '3px',
                  padding: '4px 8px',
                  color: '#93c5fd',
                  fontSize: '11px',
                  cursor: 'pointer',
                }}
              >
                <span>⭐ {p.name}</span>
                <button
                  onClick={(e) => handleDeleteUserPreset(e, p.id)}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#64748b',
                    cursor: 'pointer',
                    fontSize: '10px',
                  }}
                  title="Eliminar preset"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Built-in Presets */}
      <div style={{ padding: '6px 8px', display: 'flex', flexDirection: 'column', gap: '3px' }}>
        <div style={{ fontSize: '10px', color: 'var(--color-lumen-muted)', fontWeight: 600, marginBottom: '2px', textTransform: 'uppercase' }}>
          Integrados
        </div>
        {Object.keys(BUILT_IN_PRESETS).map((presetName) => (
          <PresetItem
            key={presetName}
            presetName={presetName}
            onApply={() => handleApplyPreset(presetName)}
          />
        ))}
      </div>

      {/* Snapshots */}
      <div
        className="panel-header"
        style={{
          marginTop: '10px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <span>Instantáneas</span>
        <button
          onClick={() => setShowSnapshotInput((v) => !v)}
          style={{
            background: 'none',
            border: 'none',
            color: '#3b82f6',
            cursor: 'pointer',
            fontSize: '13px',
            lineHeight: 1,
          }}
          title="Crear nueva instantánea"
        >
          +
        </button>
      </div>

      {showSnapshotInput && (
        <div style={{ padding: '4px 8px', display: 'flex', gap: '4px' }}>
          <input
            type="text"
            placeholder="Nombre…"
            value={snapshotName}
            onChange={(e) => setSnapshotName(e.target.value)}
            style={{
              flex: 1,
              backgroundColor: '#18181b',
              border: '1px solid #3f3f46',
              borderRadius: '3px',
              padding: '3px 6px',
              color: '#e4e4e7',
              fontSize: '11px',
            }}
            onKeyDown={(e) => e.key === 'Enter' && handleCreateSnapshot()}
            autoFocus
          />
          <button
            onClick={handleCreateSnapshot}
            style={{
              backgroundColor: '#3b82f6',
              border: 'none',
              borderRadius: '3px',
              padding: '3px 8px',
              color: '#fff',
              fontSize: '10px',
              cursor: 'pointer',
            }}
          >
            OK
          </button>
        </div>
      )}

      <div style={{ padding: '6px 8px', display: 'flex', flexDirection: 'column', gap: '2px' }}>
        {snapshots.length === 0 ? (
          <div style={{ fontSize: '11px', color: '#52525b', fontStyle: 'italic', padding: '4px' }}>
            Sin instantáneas
          </div>
        ) : (
          snapshots.map((s) => (
            <div
              key={s.id}
              onClick={() => updateSettings(s.settings, `Instantánea: ${s.name}`)}
              style={{
                padding: '4px 8px',
                borderRadius: '3px',
                fontSize: '11px',
                color: '#e4e4e7',
                cursor: 'pointer',
                backgroundColor: '#18181b',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#27272a')}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#18181b')}
            >
              📷 {s.name}
            </div>
          ))
        )}
      </div>

      {/* History */}
      <div className="panel-header" style={{ marginTop: '10px' }}>
        Historial ({history.length})
      </div>
      <div
        style={{
          padding: '6px 8px',
          display: 'flex',
          flexDirection: 'column-reverse',
          gap: '2px',
          maxHeight: '200px',
          overflowY: 'auto',
        }}
      >
        {history.map((step, idx) => {
          const isCurrent = idx === historyIndex;
          const isFuture = idx > historyIndex;

          return (
            <div
              key={idx}
              onClick={() => jumpToHistory(idx)}
              style={{
                padding: '3px 8px',
                borderRadius: '3px',
                fontSize: '11px',
                cursor: 'pointer',
                backgroundColor: isCurrent ? '#1e3a5f' : 'transparent',
                color: isCurrent ? '#93c5fd' : isFuture ? '#52525b' : '#a1a1aa',
                fontWeight: isCurrent ? 600 : 400,
              }}
              onMouseEnter={(e) => {
                if (!isCurrent) e.currentTarget.style.backgroundColor = '#27272a';
              }}
              onMouseLeave={(e) => {
                if (!isCurrent) e.currentTarget.style.backgroundColor = 'transparent';
              }}
            >
              {step.label}
            </div>
          );
        })}
      </div>

      {/* Modal: Guardar Preset */}
      {showPresetModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0,0,0,0.65)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
          }}
        >
          <div
            style={{
              backgroundColor: '#18181b',
              border: '1px solid #3f3f46',
              borderRadius: '8px',
              padding: '16px',
              width: '300px',
              color: '#f4f4f5',
            }}
          >
            <h4 style={{ margin: '0 0 12px 0', fontSize: '13px', color: '#3b82f6' }}>
              Guardar Ajuste Preestablecido
            </h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '11px' }}>
              <div>
                <label style={{ display: 'block', color: '#a1a1aa', marginBottom: '4px' }}>Nombre</label>
                <input
                  type="text"
                  value={newPresetName}
                  onChange={(e) => setNewPresetName(e.target.value)}
                  placeholder="Ej: Retrato Cálido"
                  style={{
                    width: '100%',
                    backgroundColor: '#27272a',
                    border: '1px solid #3f3f46',
                    borderRadius: '4px',
                    padding: '4px 8px',
                    color: '#fff',
                    fontSize: '11px',
                  }}
                  autoFocus
                />
              </div>

              <div>
                <label style={{ display: 'block', color: '#a1a1aa', marginBottom: '4px' }}>Grupo</label>
                <input
                  type="text"
                  value={newPresetGroup}
                  onChange={(e) => setNewPresetGroup(e.target.value)}
                  placeholder="Mis Ajustes"
                  style={{
                    width: '100%',
                    backgroundColor: '#27272a',
                    border: '1px solid #3f3f46',
                    borderRadius: '4px',
                    padding: '4px 8px',
                    color: '#fff',
                    fontSize: '11px',
                  }}
                />
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '16px' }}>
              <button
                onClick={() => setShowPresetModal(false)}
                style={{
                  backgroundColor: 'transparent',
                  border: '1px solid #3f3f46',
                  color: '#a1a1aa',
                  borderRadius: '4px',
                  padding: '4px 10px',
                  fontSize: '11px',
                  cursor: 'pointer',
                }}
              >
                Cancelar
              </button>
              <button
                onClick={handleSavePreset}
                style={{
                  backgroundColor: '#3b82f6',
                  border: 'none',
                  color: '#fff',
                  borderRadius: '4px',
                  padding: '4px 12px',
                  fontSize: '11px',
                  cursor: 'pointer',
                  fontWeight: 600,
                }}
              >
                Guardar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const PRESET_INFO: Record<string, { desc: string; bestFor: string; bgGradient: string }> = {
  Original: {
    desc: 'Restablece todos los parámetros a la captura inicial sin procesar.',
    bestFor: 'Punto de partida neutro.',
    bgGradient: 'linear-gradient(135deg, #3f3f46, #18181b)',
  },
  Vivo: {
    desc: 'Aumento balanceado de saturación, contraste medio y micro-enfoque.',
    bestFor: 'Paisajes de naturaleza, flores y fotografía de viajes.',
    bgGradient: 'linear-gradient(135deg, #059669, #0284c7)',
  },
  Cálido: {
    desc: 'Aporte de temperatura dorada (+0.35), matiz ámbar y viñeta suave.',
    bestFor: 'Atardeceres, sesiones de hora dorada y retratos cálidos.',
    bgGradient: 'linear-gradient(135deg, #d97706, #b45309)',
  },
  Frío: {
    desc: 'Tonalidad fría (-0.35), contraste limpio y saturación controlada.',
    bestFor: 'Paisajes de nieve, arquitectura moderna y fotos urbanas nocturnas.',
    bgGradient: 'linear-gradient(135deg, #0284c7, #1e3a8a)',
  },
  'B/N': {
    desc: 'Conversión monocroma de alto contraste con grano fino y viñeta sutil.',
    bestFor: 'Fotografía callejera, arquitectura y retratos expresivos.',
    bgGradient: 'linear-gradient(135deg, #52525b, #09090b)',
  },
  Vintage: {
    desc: 'Negros desvanecidos estilo mate, grano analógico y calidez de película 35mm.',
    bestFor: 'Fotografía lifestyle, moda retro y sesiones con luz suave.',
    bgGradient: 'linear-gradient(135deg, #78350f, #3f3f46)',
  },
  Cine: {
    desc: 'Gradación estilo cine con sombras azul-petróleo y luces suaves.',
    bestFor: 'Fotografía narrativa, retratos nocturnos e iluminación de ciudad.',
    bgGradient: 'linear-gradient(135deg, #0f766e, #1c1917)',
  },
  Mate: {
    desc: 'Curva tonal con sombras levantadas y contraste reducido.',
    bestFor: 'Bodas, fotografía editorial y retratos suaves.',
    bgGradient: 'linear-gradient(135deg, #4b5563, #374151)',
  },
  Dramático: {
    desc: 'Contraste acentuado, sombras profundas, micro-contraste y textura intensa.',
    bestFor: 'Retratos de carácter, tormentas y fotografía deportiva.',
    bgGradient: 'linear-gradient(135deg, #18181b, #b91c1c)',
  },
};

function PresetItem({ presetName, onApply }: { presetName: string; onApply: () => void }) {
  const [hovered, setHovered] = useState(false);
  const info = PRESET_INFO[presetName];

  return (
    <div style={{ position: 'relative' }}>
      <button
        onClick={onApply}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{
          width: '100%',
          textAlign: 'left',
          backgroundColor: hovered ? 'var(--color-lumen-surface)' : 'var(--color-lumen-card)',
          border: '1px solid var(--color-lumen-border)',
          borderRadius: 'var(--radius-xs)',
          padding: '5px 8px',
          color: 'var(--color-lumen-text)',
          fontSize: '11px',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          transition: 'background-color 120ms ease',
        }}
      >
        <span
          style={{
            width: '10px',
            height: '10px',
            borderRadius: '2px',
            background: info?.bgGradient || 'var(--color-lumen-accent)',
            flexShrink: 0,
            display: 'inline-block',
          }}
        />
        <span style={{ fontWeight: 500 }}>{presetName}</span>
      </button>

      {hovered && info && (
        <div
          role="tooltip"
          style={{
            position: 'absolute',
            left: 'calc(100% + 8px)',
            top: '-10px',
            width: '210px',
            backgroundColor: 'var(--color-lumen-card)',
            border: '1px solid var(--color-lumen-border)',
            borderRadius: 'var(--radius-sm)',
            boxShadow: 'var(--shadow-md)',
            padding: '10px',
            zIndex: 1000,
            pointerEvents: 'none',
            animation: 'fadeIn 100ms ease',
          }}
        >
          {/* Swatch thumbnail */}
          <div
            style={{
              height: '46px',
              borderRadius: 'var(--radius-xs)',
              background: info.bgGradient,
              marginBottom: '6px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#fff',
              fontWeight: 600,
              fontSize: '10px',
              letterSpacing: '0.05em',
              textShadow: '0 1px 3px rgba(0,0,0,0.8)',
            }}
          >
            Vista Previa · {presetName}
          </div>
          <div style={{ fontSize: '11px', color: 'var(--color-lumen-text)', lineHeight: 1.4, marginBottom: '6px' }}>
            {info.desc}
          </div>
          <div style={{ fontSize: '10px', color: 'var(--color-lumen-accent)', lineHeight: 1.3 }}>
            <strong>Ideal para:</strong> {info.bestFor}
          </div>
        </div>
      )}
    </div>
  );
}

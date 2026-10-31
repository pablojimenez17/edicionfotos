import { useDevelopStore } from '../../stores/develop';

import type { RadialMask, LinearMask, MaskDefinition } from '../../types';

export function MaskPanel({
  activeMaskIndex,
  onSelectMask,
  showOverlay,
  onToggleOverlay,
}: {
  activeMaskIndex: number;
  onSelectMask: (index: number) => void;
  showOverlay: boolean;
  onToggleOverlay: () => void;
}) {
  const settings = useDevelopStore((s) => s.settings);
  const updateSetting = useDevelopStore((s) => s.updateSetting);

  const masks = settings.masks || [];
  const currentMask = masks[activeMaskIndex] as MaskDefinition | undefined;

  const handleAddRadial = () => {
    const newMask: RadialMask = {
      type: 'radial',
      x: 0.5,
      y: 0.5,
      radius: 0.35,
      feather: 0.5,
      invert: false,
      adjustments: {
        exposure: 0.5,
        contrast: 0.1,
        saturation: 0.0,
        temperature: 0.0,
      },
    };
    const nextMasks = [...masks, newMask];
    updateSetting('masks', nextMasks, 'Añadir máscara radial');
    onSelectMask(nextMasks.length - 1);
  };

  const handleAddLinear = () => {
    const newMask: LinearMask = {
      type: 'linear',
      x: 0.5,
      y: 0.3,
      angle: 0.0,
      feather: 0.4,
      invert: false,
      adjustments: {
        exposure: -0.7,
        contrast: 0.1,
        saturation: 0.0,
        temperature: 0.0,
      },
    };
    const nextMasks = [...masks, newMask];
    updateSetting('masks', nextMasks, 'Añadir filtro graduado lineal');
    onSelectMask(nextMasks.length - 1);
  };

  const handleAddBrush = () => {
    const newMask: MaskDefinition = {
      type: 'brush',
      strokes: [],
      size: 40,
      flow: 100,
      density: 100,
      erase: false,
      invert: false,
      adjustments: {
        exposure: 0.4,
        contrast: 0.1,
        saturation: 0.0,
        temperature: 0.0,
      },
    };
    const nextMasks = [...masks, newMask];
    updateSetting('masks', nextMasks, 'Añadir máscara de pincel');
    onSelectMask(nextMasks.length - 1);
  };

  const handleAddLuminance = () => {
    const newMask: MaskDefinition = {
      type: 'luminance-range',
      rangeMin: 0.6,
      rangeMax: 1.0,
      feather: 0.2,
      invert: false,
      adjustments: {
        exposure: -0.5,
        contrast: 0.1,
        saturation: 0.0,
        temperature: 0.0,
      },
    };
    const nextMasks = [...masks, newMask];
    updateSetting('masks', nextMasks, 'Añadir máscara de rango de luminancia');
    onSelectMask(nextMasks.length - 1);
  };

  const handleAddColor = () => {
    const newMask: MaskDefinition = {
      type: 'color-range',
      targetHue: 0.1,
      targetSat: 0.8,
      range: 0.15,
      feather: 0.2,
      invert: false,
      adjustments: {
        exposure: 0.0,
        contrast: 0.0,
        saturation: 0.4,
        temperature: 0.0,
      },
    };
    const nextMasks = [...masks, newMask];
    updateSetting('masks', nextMasks, 'Añadir máscara de rango de color');
    onSelectMask(nextMasks.length - 1);
  };

  const handleRemoveMask = (index: number) => {
    const nextMasks = masks.filter((_, i) => i !== index);
    updateSetting('masks', nextMasks, 'Eliminar máscara');
    onSelectMask(Math.max(0, index - 1));
  };

  const handleUpdateCurrent = (patch: Partial<MaskDefinition>) => {
    if (!currentMask) return;
    const nextMasks = masks.map((m, idx) => (idx === activeMaskIndex ? { ...m, ...patch } : m));
    updateSetting('masks', nextMasks as MaskDefinition[]);
  };

  const handleUpdateAdjustments = (key: keyof MaskDefinition['adjustments'], val: number) => {
    if (!currentMask) return;
    const nextAdjustments = { ...currentMask.adjustments, [key]: val };
    handleUpdateCurrent({ adjustments: nextAdjustments });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      {/* Mask creation buttons */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '4px' }}>
        <button
          onClick={handleAddRadial}
          style={{
            backgroundColor: '#27272a',
            border: '1px solid #3f3f46',
            borderRadius: '4px',
            color: '#fff',
            padding: '5px 2px',
            fontSize: '10px',
            cursor: 'pointer',
          }}
          title="Máscara radial (○)"
        >
          ○ Radial
        </button>
        <button
          onClick={handleAddLinear}
          style={{
            backgroundColor: '#27272a',
            border: '1px solid #3f3f46',
            borderRadius: '4px',
            color: '#fff',
            padding: '5px 2px',
            fontSize: '10px',
            cursor: 'pointer',
          }}
          title="Filtro graduado lineal (▤)"
        >
          ▤ Lineal
        </button>
        <button
          onClick={handleAddBrush}
          style={{
            backgroundColor: '#27272a',
            border: '1px solid #3f3f46',
            borderRadius: '4px',
            color: '#fff',
            padding: '5px 2px',
            fontSize: '10px',
            cursor: 'pointer',
          }}
          title="Máscara de pincel (🖌)"
        >
          🖌 Pincel
        </button>
        <button
          onClick={handleAddLuminance}
          style={{
            backgroundColor: '#27272a',
            border: '1px solid #3f3f46',
            borderRadius: '4px',
            color: '#fff',
            padding: '5px 2px',
            fontSize: '10px',
            cursor: 'pointer',
          }}
          title="Rango de luminancia (◐)"
        >
          ◐ Lum
        </button>
        <button
          onClick={handleAddColor}
          style={{
            backgroundColor: '#27272a',
            border: '1px solid #3f3f46',
            borderRadius: '4px',
            color: '#fff',
            padding: '5px 2px',
            fontSize: '10px',
            cursor: 'pointer',
          }}
          title="Rango de color (🎨)"
        >
          🎨 Color
        </button>
      </div>

      {/* Mask list selector */}
      {masks.length > 0 && (
        <div style={{ display: 'flex', gap: '4px', overflowX: 'auto', padding: '2px 0' }}>
          {masks.map((m, i) => (
            <button
              key={i}
              onClick={() => onSelectMask(i)}
              style={{
                backgroundColor: activeMaskIndex === i ? '#3b82f6' : '#27272a',
                color: '#fff',
                border: 'none',
                borderRadius: '3px',
                padding: '3px 8px',
                fontSize: '10px',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
              }}
            >
              {m.type === 'radial'
                ? `○ Radial ${i + 1}`
                : m.type === 'linear'
                ? `▤ Lineal ${i + 1}`
                : m.type === 'brush'
                ? `🖌 Pincel ${i + 1}`
                : m.type === 'luminance-range'
                ? `◐ Lum ${i + 1}`
                : `🎨 Color ${i + 1}`}
            </button>
          ))}
        </div>
      )}

      {currentMask && (
        <div style={{ backgroundColor: '#18181b', padding: '8px', borderRadius: '4px', border: '1px solid #27272a' }}>
          {/* Controls header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: '#e4e4e7', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={currentMask.invert}
                onChange={(e) => handleUpdateCurrent({ invert: e.target.checked })}
                style={{ accentColor: '#3b82f6' }}
              />
              Invertir
            </label>

            <button
              onClick={onToggleOverlay}
              style={{
                backgroundColor: showOverlay ? '#ef4444' : '#27272a',
                border: 'none',
                borderRadius: '3px',
                color: '#fff',
                fontSize: '10px',
                padding: '2px 6px',
                cursor: 'pointer',
              }}
              title="Mostrar superposición en rojo (tecla O)"
            >
              {showOverlay ? 'Overlay (O): ON' : 'Overlay (O): OFF'}
            </button>

            <button
              onClick={() => handleRemoveMask(activeMaskIndex)}
              style={{
                background: 'none',
                border: 'none',
                color: '#ef4444',
                fontSize: '11px',
                cursor: 'pointer',
              }}
              title="Eliminar esta máscara"
            >
              🗑 Borrar
            </button>
          </div>

          {/* Mask shape sliders */}
          {currentMask.type === 'radial' && (
            <div style={{ marginBottom: '8px' }}>
              <MaskSliderRow
                label="Radio"
                min={0.05}
                max={1.0}
                step={0.02}
                value={currentMask.radius}
                displayValue={Math.round(currentMask.radius * 100)}
                onChange={(v) => handleUpdateCurrent({ radius: v })}
              />
              <MaskSliderRow
                label="Calado"
                min={0.0}
                max={1.0}
                step={0.02}
                value={currentMask.feather}
                displayValue={Math.round(currentMask.feather * 100)}
                onChange={(v) => handleUpdateCurrent({ feather: v })}
              />
            </div>
          )}

          {currentMask.type === 'linear' && (
            <div style={{ marginBottom: '8px' }}>
              <MaskSliderRow
                label="Ángulo"
                min={-Math.PI}
                max={Math.PI}
                step={0.05}
                value={currentMask.angle}
                displayValue={`${Math.round((currentMask.angle * 180) / Math.PI)}°`}
                onChange={(v) => handleUpdateCurrent({ angle: v })}
              />
              <MaskSliderRow
                label="Calado"
                min={0.05}
                max={1.0}
                step={0.02}
                value={currentMask.feather}
                displayValue={Math.round(currentMask.feather * 100)}
                onChange={(v) => handleUpdateCurrent({ feather: v })}
              />
            </div>
          )}

          {currentMask.type === 'brush' && (
            <div style={{ marginBottom: '8px' }}>
              <MaskSliderRow
                label="Tamaño"
                min={5}
                max={200}
                step={1}
                value={currentMask.size}
                displayValue={currentMask.size}
                onChange={(v) => handleUpdateCurrent({ size: v })}
              />
              <MaskSliderRow
                label="Flujo"
                min={1}
                max={100}
                step={1}
                value={currentMask.flow}
                displayValue={`${currentMask.flow}%`}
                onChange={(v) => handleUpdateCurrent({ flow: v })}
              />
              <MaskSliderRow
                label="Densidad"
                min={1}
                max={100}
                step={1}
                value={currentMask.density}
                displayValue={`${currentMask.density}%`}
                onChange={(v) => handleUpdateCurrent({ density: v })}
              />
              <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '10px', color: '#e4e4e7', cursor: 'pointer', marginTop: '4px' }}>
                <input
                  type="checkbox"
                  checked={currentMask.erase}
                  onChange={(e) => handleUpdateCurrent({ erase: e.target.checked })}
                  style={{ accentColor: '#ef4444' }}
                />
                Modo Borrador
              </label>
            </div>
          )}

          {currentMask.type === 'luminance-range' && (
            <div style={{ marginBottom: '8px' }}>
              <MaskSliderRow
                label="Rango mín."
                min={0}
                max={1}
                step={0.01}
                value={currentMask.rangeMin}
                displayValue={Math.round(currentMask.rangeMin * 100)}
                onChange={(v) => handleUpdateCurrent({ rangeMin: v })}
              />
              <MaskSliderRow
                label="Rango máx."
                min={0}
                max={1}
                step={0.01}
                value={currentMask.rangeMax}
                displayValue={Math.round(currentMask.rangeMax * 100)}
                onChange={(v) => handleUpdateCurrent({ rangeMax: v })}
              />
              <MaskSliderRow
                label="Calado"
                min={0}
                max={0.5}
                step={0.01}
                value={currentMask.feather}
                displayValue={Math.round(currentMask.feather * 100)}
                onChange={(v) => handleUpdateCurrent({ feather: v })}
              />
            </div>
          )}

          {currentMask.type === 'color-range' && (
            <div style={{ marginBottom: '8px' }}>
              <MaskSliderRow
                label="Tono obj."
                min={0}
                max={1}
                step={0.01}
                value={currentMask.targetHue}
                displayValue={`${Math.round(currentMask.targetHue * 360)}°`}
                onChange={(v) => handleUpdateCurrent({ targetHue: v })}
                gradient="linear-gradient(to right, #ff0000, #ffff00, #00ff00, #00ffff, #0000ff, #ff00ff, #ff0000)"
              />
              <MaskSliderRow
                label="Tolerancia"
                min={0.02}
                max={0.5}
                step={0.01}
                value={currentMask.range}
                displayValue={Math.round(currentMask.range * 100)}
                onChange={(v) => handleUpdateCurrent({ range: v })}
              />
              <MaskSliderRow
                label="Calado"
                min={0}
                max={0.5}
                step={0.01}
                value={currentMask.feather}
                displayValue={Math.round(currentMask.feather * 100)}
                onChange={(v) => handleUpdateCurrent({ feather: v })}
              />
            </div>
          )}

          {/* Local adjustments */}
          <div style={{ fontSize: '10px', fontWeight: 600, color: '#a1a1aa', margin: '6px 0 4px' }}>
            AJUSTES LOCALES DE LA MÁSCARA
          </div>

          <MaskSliderRow
            label="Exposición"
            min={-3}
            max={3}
            step={0.05}
            value={currentMask.adjustments.exposure}
            displayValue={`${currentMask.adjustments.exposure > 0 ? '+' : ''}${currentMask.adjustments.exposure.toFixed(2)}`}
            onChange={(v) => handleUpdateAdjustments('exposure', v)}
          />

          <MaskSliderRow
            label="Contraste"
            min={-1}
            max={1}
            step={0.02}
            value={currentMask.adjustments.contrast}
            displayValue={Math.round(currentMask.adjustments.contrast * 100)}
            onChange={(v) => handleUpdateAdjustments('contrast', v)}
          />

          <MaskSliderRow
            label="Saturación"
            min={-1}
            max={1}
            step={0.02}
            value={currentMask.adjustments.saturation}
            displayValue={Math.round(currentMask.adjustments.saturation * 100)}
            onChange={(v) => handleUpdateAdjustments('saturation', v)}
          />

          <MaskSliderRow
            label="Temperatura"
            min={-1}
            max={1}
            step={0.02}
            value={currentMask.adjustments.temperature}
            displayValue={Math.round(currentMask.adjustments.temperature * 100)}
            onChange={(v) => handleUpdateAdjustments('temperature', v)}
          />
        </div>
      )}
    </div>
  );
}

function MaskSliderRow({
  label,
  min,
  max,
  step,
  value,
  displayValue,
  onChange,
  gradient,
}: {
  label: string;
  min: number;
  max: number;
  step: number;
  value: number;
  displayValue: string | number;
  onChange: (v: number) => void;
  gradient?: string;
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px', fontSize: '11px' }}>
      <span style={{ width: '70px', color: '#a1a1aa' }}>{label}</span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        style={{ flex: 1, margin: '0 6px', accentColor: '#3b82f6', height: '4px', background: gradient || '#27272a' }}
      />
      <span style={{ width: '32px', textAlign: 'right', color: '#d4d4d8', fontVariantNumeric: 'tabular-nums' }}>
        {displayValue}
      </span>
    </div>
  );
}

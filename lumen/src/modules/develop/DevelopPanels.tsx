import { useState, useRef, useEffect } from 'react';
import { useDevelopStore } from '../../stores/develop';
import { useUiStore } from '../../stores/ui';
import { HSL_BAND_NAMES, CROP_RATIOS } from '../../types';
import { MaskPanel } from './MaskPanel';
import { AccessibleSlider } from '../../components/AccessibleSlider';
import { DevelopHelpBar } from './DevelopHelpBar';
import { Histogram } from '../../components/Histogram';
import { useHelpStore } from '../../help/helpStore';


export function DevelopPanels({
  activeMaskIndex,
  onSelectMask,
  showMaskOverlay,
  onToggleMaskOverlay,
}: {
  activeMaskIndex?: number;
  onSelectMask?: (idx: number) => void;
  showMaskOverlay?: boolean;
  onToggleMaskOverlay?: () => void;
}) {
  const settings = useDevelopStore((s) => s.settings);
  const updateSetting = useDevelopStore((s) => s.updateSetting);

  const [localActiveMaskIndex, setLocalActiveMaskIndex] = useState(0);
  const [localShowOverlay, setLocalShowOverlay] = useState(false);

  const maskIdx = activeMaskIndex ?? localActiveMaskIndex;
  const setMaskIdx = onSelectMask ?? setLocalActiveMaskIndex;
  const overlayOn = showMaskOverlay ?? localShowOverlay;
  const toggleOverlay = onToggleMaskOverlay ?? (() => setLocalShowOverlay((v) => !v));

  // Accordion sections state
  const [openSections, setOpenSections] = useState({
    masks: true,
    basic: true,
    curve: false,
    hsl: false,
    colorGrading: false,
    detail: false,
    lens: false,
    transform: false,
    effects: false,
    geometry: false,
    calibration: false,
  });

  const toggleSection = (key: keyof typeof openSections) => {
    setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const rightPanelWidth = useUiStore((s) => s.rightPanelWidth);

  return (
    <div
      className="panel panel--right"
      style={{
        width: `${rightPanelWidth}px`,
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        overflow: 'hidden',
        flexShrink: 0,
        backgroundColor: 'var(--color-lumen-panel)',
        borderLeft: '1px solid var(--color-lumen-border)',
      }}
    >
      <div style={{ flex: 1, overflowY: 'auto' }}>
        <Histogram />

      {/* ─── 0. MÁSCARAS ───────────────────────────────────────────── */}
      <PanelAccordion
        title={`Máscaras (${settings.masks?.length || 0})`}
        isOpen={openSections.masks}
        onToggle={() => toggleSection('masks')}
        helpKey="mask_panel"
      >
        <MaskPanel
          activeMaskIndex={maskIdx}
          onSelectMask={setMaskIdx}
          showOverlay={overlayOn}
          onToggleOverlay={toggleOverlay}
        />
      </PanelAccordion>

      {/* ─── 1. BÁSICO ────────────────────────────────────────────── */}
      <PanelAccordion
        title="Básico"
        isOpen={openSections.basic}
        onToggle={() => toggleSection('basic')}
        helpKey="exposure"
      >

        {/* White Balance */}
        <div style={{ marginBottom: '12px' }}>
          <div style={{ fontSize: '11px', color: '#71717a', marginBottom: '6px', fontWeight: 600 }}>
            EQUILIBRIO DE BLANCOS
          </div>
          <SliderRow
            label="Temp"
            min={-1}
            max={1}
            step={0.01}
            value={settings.temperature}
            displayValue={Math.round(settings.temperature * 100)}
            onChange={(v) => updateSetting('temperature', v)}
            onReset={() => updateSetting('temperature', 0, 'Reset Temp')}
            gradient="linear-gradient(to right, #38bdf8, #71717a, #f59e0b)"
            helpKey="temperature"
          />
          <SliderRow
            label="Matiz"
            min={-1}
            max={1}
            step={0.01}
            value={settings.tint}
            displayValue={Math.round(settings.tint * 100)}
            onChange={(v) => updateSetting('tint', v)}
            onReset={() => updateSetting('tint', 0, 'Reset Matiz')}
            gradient="linear-gradient(to right, #22c55e, #71717a, #ec4899)"
            helpKey="tint"
          />
        </div>

        {/* Tone */}
        <div style={{ marginBottom: '12px' }}>
          <div style={{ fontSize: '11px', color: '#71717a', marginBottom: '6px', fontWeight: 600 }}>
            TONO
          </div>
          <SliderRow
            label="Exposición"
            min={-5}
            max={5}
            step={0.05}
            value={settings.exposure}
            displayValue={(settings.exposure > 0 ? '+' : '') + settings.exposure.toFixed(2)}
            onChange={(v) => updateSetting('exposure', v)}
            onReset={() => updateSetting('exposure', 0, 'Reset Exposición')}
            helpKey="exposure"
          />
          <SliderRow
            label="Contraste"
            min={-1}
            max={1}
            step={0.01}
            value={settings.contrast}
            displayValue={Math.round(settings.contrast * 100)}
            onChange={(v) => updateSetting('contrast', v)}
            onReset={() => updateSetting('contrast', 0, 'Reset Contraste')}
            helpKey="contrast"
          />
          <SliderRow
            label="Altas luces"
            min={-1}
            max={1}
            step={0.01}
            value={settings.highlights}
            displayValue={Math.round(settings.highlights * 100)}
            onChange={(v) => updateSetting('highlights', v)}
            onReset={() => updateSetting('highlights', 0, 'Reset Altas luces')}
            helpKey="highlights"
          />
          <SliderRow
            label="Sombras"
            min={-1}
            max={1}
            step={0.01}
            value={settings.shadows}
            displayValue={Math.round(settings.shadows * 100)}
            onChange={(v) => updateSetting('shadows', v)}
            onReset={() => updateSetting('shadows', 0, 'Reset Sombras')}
            helpKey="shadows"
          />
          <SliderRow
            label="Blancos"
            min={-1}
            max={1}
            step={0.01}
            value={settings.whites}
            displayValue={Math.round(settings.whites * 100)}
            onChange={(v) => updateSetting('whites', v)}
            onReset={() => updateSetting('whites', 0, 'Reset Blancos')}
            helpKey="whites"
          />
          <SliderRow
            label="Negros"
            min={-1}
            max={1}
            step={0.01}
            value={settings.blacks}
            displayValue={Math.round(settings.blacks * 100)}
            onChange={(v) => updateSetting('blacks', v)}
            onReset={() => updateSetting('blacks', 0, 'Reset Negros')}
            helpKey="blacks"
          />
        </div>

        {/* Presence */}
        <div>
          <div style={{ fontSize: '11px', color: '#71717a', marginBottom: '6px', fontWeight: 600 }}>
            PRESENCIA
          </div>
          <SliderRow
            label="Textura"
            min={-1}
            max={1}
            step={0.01}
            value={settings.texture}
            displayValue={Math.round(settings.texture * 100)}
            onChange={(v) => updateSetting('texture', v)}
            onReset={() => updateSetting('texture', 0, 'Reset Textura')}
            helpKey="texture"
          />
          <SliderRow
            label="Claridad"
            min={-1}
            max={1}
            step={0.01}
            value={settings.clarity}
            displayValue={Math.round(settings.clarity * 100)}
            onChange={(v) => updateSetting('clarity', v)}
            onReset={() => updateSetting('clarity', 0, 'Reset Claridad')}
            helpKey="clarity"
          />
          <SliderRow
            label="Borrar neblina"
            min={-1}
            max={1}
            step={0.01}
            value={settings.dehaze}
            displayValue={Math.round(settings.dehaze * 100)}
            onChange={(v) => updateSetting('dehaze', v)}
            onReset={() => updateSetting('dehaze', 0, 'Reset Borrar neblina')}
            helpKey="dehaze"
          />
          <SliderRow
            label="Intensidad"
            min={-1}
            max={1}
            step={0.01}
            value={settings.vibrance}
            displayValue={Math.round(settings.vibrance * 100)}
            onChange={(v) => updateSetting('vibrance', v)}
            onReset={() => updateSetting('vibrance', 0, 'Reset Intensidad')}
            helpKey="vibrance"
          />
          <SliderRow
            label="Saturación"
            min={-1}
            max={1}
            step={0.01}
            value={settings.saturation}
            displayValue={Math.round(settings.saturation * 100)}
            onChange={(v) => updateSetting('saturation', v)}
            onReset={() => updateSetting('saturation', 0, 'Reset Saturación')}
            helpKey="saturation"
          />
        </div>
      </PanelAccordion>

      {/* ─── 2. CURVA DE TONOS ────────────────────────────────────── */}
      <PanelAccordion
        title="Curva de tonos"
        isOpen={openSections.curve}
        onToggle={() => toggleSection('curve')}
        helpKey="tone_curve"
      >
        <ToneCurveEditor />
      </PanelAccordion>

      {/* ─── 3. HSL / COLOR ────────────────────────────────────────── */}
      <PanelAccordion
        title="HSL / Color"
        isOpen={openSections.hsl}
        onToggle={() => toggleSection('hsl')}
        helpKey="hsl_panel"
      >
        <HslEditor />
      </PanelAccordion>

      {/* ─── 4. GRADACIÓN DE COLOR (3-WAY WHEELS) ──────────────────── */}
      <PanelAccordion
        title="Gradación de color"
        isOpen={openSections.colorGrading}
        onToggle={() => toggleSection('colorGrading')}
        helpKey="color_grading"
      >
        <ColorGradingEditor />
      </PanelAccordion>

      {/* ─── 5. DETALLE (ENFOQUE & REDUCCIÓN DE RUIDO) ──────────────── */}
      <PanelAccordion
        title="Detalle"
        isOpen={openSections.detail}
        onToggle={() => toggleSection('detail')}
        helpKey="sharpening"
      >
        <DetailEditor />
      </PanelAccordion>

      {/* ─── 6. CORRECCIONES DE LENTE ─────────────────────────────────── */}
      <PanelAccordion
        title="Correcciones de lente"
        isOpen={openSections.lens}
        onToggle={() => toggleSection('lens')}
        helpKey="lens_corrections"
      >
        <LensCorrectionsEditor />
      </PanelAccordion>

      {/* ─── 7. TRANSFORMAR (UPRIGHT) ─────────────────────────────────── */}
      <PanelAccordion
        title="Transformar"
        isOpen={openSections.transform}
        onToggle={() => toggleSection('transform')}
        helpKey="tool_crop"
      >
        <TransformEditor />
      </PanelAccordion>

      {/* ─── 8. EFECTOS (VIÑETA POST-RECORTE, GRANO, MATE) ──────────── */}
      <PanelAccordion
        title="Efectos"
        isOpen={openSections.effects}
        onToggle={() => toggleSection('effects')}
        helpKey="vignette"
      >
        <div style={{ fontSize: '11px', color: '#71717a', marginBottom: '6px', fontWeight: 600 }}>
          VIÑETA POST-RECORTE
        </div>
        <SliderRow
          label="Cantidad"
          min={-1}
          max={1}
          step={0.02}
          value={settings.vignette}
          displayValue={Math.round(settings.vignette * 100)}
          onChange={(v) => updateSetting('vignette', v)}
          onReset={() => updateSetting('vignette', 0, 'Reset Viñeta')}
        />
        <SliderRow
          label="Punto medio"
          min={0}
          max={100}
          step={1}
          value={settings.vignetteMidpoint ?? 50}
          displayValue={settings.vignetteMidpoint ?? 50}
          onChange={(v) => updateSetting('vignetteMidpoint', v)}
          onReset={() => updateSetting('vignetteMidpoint', 50)}
        />
        <SliderRow
          label="Redondez"
          min={-100}
          max={100}
          step={1}
          value={settings.vignetteRoundness ?? 0}
          displayValue={settings.vignetteRoundness ?? 0}
          onChange={(v) => updateSetting('vignetteRoundness', v)}
          onReset={() => updateSetting('vignetteRoundness', 0)}
        />
        <SliderRow
          label="Desvanecer"
          min={0}
          max={100}
          step={1}
          value={settings.vignetteFeather ?? 50}
          displayValue={settings.vignetteFeather ?? 50}
          onChange={(v) => updateSetting('vignetteFeather', v)}
          onReset={() => updateSetting('vignetteFeather', 50)}
        />

        <div style={{ fontSize: '11px', color: '#71717a', margin: '10px 0 6px 0', fontWeight: 600 }}>
          GRANO
        </div>
        <SliderRow
          label="Cantidad"
          min={0}
          max={1}
          step={0.02}
          value={settings.grain}
          displayValue={Math.round(settings.grain * 100)}
          onChange={(v) => updateSetting('grain', v)}
          onReset={() => updateSetting('grain', 0, 'Reset Grano')}
        />
        <SliderRow
          label="Tamaño"
          min={1}
          max={100}
          step={1}
          value={settings.grainSize ?? 25}
          displayValue={settings.grainSize ?? 25}
          onChange={(v) => updateSetting('grainSize', v)}
          onReset={() => updateSetting('grainSize', 25)}
        />
        <SliderRow
          label="Rugosidad"
          min={0}
          max={100}
          step={1}
          value={settings.grainRoughness ?? 50}
          displayValue={settings.grainRoughness ?? 50}
          onChange={(v) => updateSetting('grainRoughness', v)}
          onReset={() => updateSetting('grainRoughness', 50)}
        />

        <div style={{ fontSize: '11px', color: '#71717a', margin: '10px 0 6px 0', fontWeight: 600 }}>
          MATE
        </div>
        <SliderRow
          label="Mate"
          min={0}
          max={1}
          step={0.02}
          value={settings.matte}
          displayValue={Math.round(settings.matte * 100)}
          onChange={(v) => updateSetting('matte', v)}
          onReset={() => updateSetting('matte', 0, 'Reset Mate')}
        />
      </PanelAccordion>

      {/* ─── 9. CALIBRACIÓN ───────────────────────────────────────────── */}
      <PanelAccordion
        title="Calibración"
        isOpen={openSections.calibration}
        onToggle={() => toggleSection('calibration')}
      >
        <CalibrationEditor />
      </PanelAccordion>

      {/* ─── 6. GEOMETRÍA Y RECORTE ─────────────────────────────────── */}
      <PanelAccordion
        title="Geometría y Recorte"
        isOpen={openSections.geometry}
        onToggle={() => toggleSection('geometry')}
      >
        <div style={{ display: 'flex', gap: '6px', marginBottom: '12px' }}>
          <button
            onClick={() => {
              const current = settings.geometry.rotation;
              const next = ((current + 1) % 4) as 0 | 1 | 2 | 3;
              updateSetting('geometry', { ...settings.geometry, rotation: next }, 'Rotar 90°');
            }}
            style={{
              flex: 1,
              backgroundColor: '#27272a',
              border: '1px solid #3f3f46',
              borderRadius: '4px',
              color: '#e4e4e7',
              padding: '6px',
              fontSize: '11px',
              cursor: 'pointer',
            }}
          >
            ↻ Rotar 90°
          </button>
          <button
            onClick={() =>
              updateSetting(
                'geometry',
                { ...settings.geometry, flipH: !settings.geometry.flipH },
                'Voltear H',
              )
            }
            style={{
              flex: 1,
              backgroundColor: settings.geometry.flipH ? '#3b82f6' : '#27272a',
              border: '1px solid #3f3f46',
              borderRadius: '4px',
              color: '#e4e4e7',
              padding: '6px',
              fontSize: '11px',
              cursor: 'pointer',
            }}
          >
            ⇄ Voltear H
          </button>
          <button
            onClick={() =>
              updateSetting(
                'geometry',
                { ...settings.geometry, flipV: !settings.geometry.flipV },
                'Voltear V',
              )
            }
            style={{
              flex: 1,
              backgroundColor: settings.geometry.flipV ? '#3b82f6' : '#27272a',
              border: '1px solid #3f3f46',
              borderRadius: '4px',
              color: '#e4e4e7',
              padding: '6px',
              fontSize: '11px',
              cursor: 'pointer',
            }}
          >
            ⇅ Voltear V
          </button>
        </div>

        <SliderRow
          label="Enderezar"
          min={-15}
          max={15}
          step={0.1}
          value={settings.geometry.straighten}
          displayValue={`${settings.geometry.straighten > 0 ? '+' : ''}${settings.geometry.straighten.toFixed(1)}°`}
          onChange={(v) =>
            updateSetting('geometry', { ...settings.geometry, straighten: v })
          }
          onReset={() =>
            updateSetting('geometry', { ...settings.geometry, straighten: 0 }, 'Reset Enderezar')
          }
        />

        <div style={{ marginTop: '10px' }}>
          <div style={{ fontSize: '11px', color: '#71717a', marginBottom: '6px' }}>Proporción:</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '4px' }}>
            {CROP_RATIOS.map(([name, ratio]) => (
              <button
                key={name}
                onClick={() =>
                  updateSetting(
                    'geometry',
                    { ...settings.geometry, cropRatio: ratio },
                    `Recorte ${name}`,
                  )
                }
                style={{
                  backgroundColor:
                    settings.geometry.cropRatio === ratio ? '#3b82f6' : '#27272a',
                  border: '1px solid #3f3f46',
                  borderRadius: '3px',
                  color: '#e4e4e7',
                  padding: '4px 2px',
                  fontSize: '10px',
                  cursor: 'pointer',
                }}
              >
                {name}
              </button>
            ))}
          </div>
        </div>
      </PanelAccordion>
      </div>
      <DevelopHelpBar />
    </div>
  );
}

// ─── Tone Curve Editor Canvas ──────────────────────────────────────────
function ToneCurveEditor() {
  const settings = useDevelopStore((s) => s.settings);
  const updateSetting = useDevelopStore((s) => s.updateSetting);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const points = settings.curvePoints || [[0, 0], [1, 1]];

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = 240;
    const h = 200;
    canvas.width = w;
    canvas.height = h;

    // Background & Grid
    ctx.fillStyle = '#18181b';
    ctx.fillRect(0, 0, w, h);

    ctx.strokeStyle = '#27272a';
    ctx.lineWidth = 1;
    for (let i = 1; i < 4; i++) {
      ctx.beginPath();
      ctx.moveTo((w / 4) * i, 0);
      ctx.lineTo((w / 4) * i, h);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(0, (h / 4) * i);
      ctx.lineTo(w, (h / 4) * i);
      ctx.stroke();
    }

    // Diagonal reference
    ctx.strokeStyle = '#3f3f46';
    ctx.setLineDash([2, 4]);
    ctx.beginPath();
    ctx.moveTo(0, h);
    ctx.lineTo(w, 0);
    ctx.stroke();
    ctx.setLineDash([]);

    // Draw curve
    ctx.strokeStyle = '#e4e4e7';
    ctx.lineWidth = 2;
    ctx.beginPath();
    const sorted = [...points].sort((a, b) => a[0] - b[0]);
    for (let px = 0; px <= w; px++) {
      const x = px / w;
      let y = x;
      if (x <= sorted[0][0]) y = sorted[0][1];
      else if (x >= sorted[sorted.length - 1][0]) y = sorted[sorted.length - 1][1];
      else {
        for (let j = 0; j < sorted.length - 1; j++) {
          if (x >= sorted[j][0] && x <= sorted[j + 1][0]) {
            const t = (x - sorted[j][0]) / (sorted[j + 1][0] - sorted[j][0]);
            const smoothT = t * t * (3 - 2 * t);
            y = sorted[j][1] + (sorted[j + 1][1] - sorted[j][1]) * smoothT;
            break;
          }
        }
      }
      const py = h - y * h;
      if (px === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.stroke();

    // Draw control points
    for (const pt of points) {
      const cx = pt[0] * w;
      const cy = h - pt[1] * h;
      ctx.fillStyle = '#3b82f6';
      ctx.beginPath();
      ctx.arc(cx, cy, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
  }, [points]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <canvas
        ref={canvasRef}
        style={{
          borderRadius: '4px',
          border: '1px solid #27272a',
          cursor: 'crosshair',
        }}
        onClick={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          const x = (e.clientX - rect.left) / rect.width;
          const y = 1 - (e.clientY - rect.top) / rect.height;
          // Add point
          const next = [...points, [x, y] as [number, number]];
          updateSetting('curvePoints', next, 'Añadir punto a la curva');
        }}
      />
      <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', marginTop: '8px' }}>
        <button
          onClick={() => updateSetting('curvePoints', [[0, 0], [1, 1]], 'Reset Curva')}
          style={{
            background: 'none',
            border: 'none',
            color: '#a1a1aa',
            fontSize: '11px',
            cursor: 'pointer',
          }}
        >
          ↺ Restablecer curva
        </button>
      </div>
    </div>
  );
}

// ─── HSL Editor ────────────────────────────────────────────────────────
function HslEditor() {
  const settings = useDevelopStore((s) => s.settings);
  const updateSetting = useDevelopStore((s) => s.updateSetting);
  const [activeTab, setActiveTab] = useState<0 | 1 | 2>(0); // 0=Tono, 1=Saturación, 2=Luminancia

  const handleBandChange = (index: number, channel: 'hue' | 'saturation' | 'luminance', val: number) => {
    const nextHsl = settings.hsl.map((band, idx) => {
      if (idx === index) {
        return { ...band, [channel]: val };
      }
      return band;
    });
    updateSetting('hsl', nextHsl);
  };

  return (
    <div>
      <div style={{ display: 'flex', gap: '4px', marginBottom: '10px' }}>
        {(['Tono', 'Saturación', 'Luminancia'] as const).map((tab, idx) => (
          <button
            key={tab}
            onClick={() => setActiveTab(idx as 0 | 1 | 2)}
            style={{
              flex: 1,
              backgroundColor: activeTab === idx ? '#3b82f6' : '#27272a',
              color: '#fff',
              border: 'none',
              borderRadius: '3px',
              padding: '4px',
              fontSize: '11px',
              cursor: 'pointer',
            }}
          >
            {tab}
          </button>
        ))}
      </div>

      {HSL_BAND_NAMES.map((name, i) => {
        const band = settings.hsl[i] || { hue: 0, saturation: 0, luminance: 0 };
        const channelKey = activeTab === 0 ? 'hue' : activeTab === 1 ? 'saturation' : 'luminance';
        const val = band[channelKey];

        return (
          <SliderRow
            key={name}
            label={name}
            min={-1}
            max={1}
            step={0.02}
            value={val}
            displayValue={Math.round(val * 100)}
            onChange={(v) => handleBandChange(i, channelKey, v)}
            onReset={() => handleBandChange(i, channelKey, 0)}
          />
        );
      })}
    </div>
  );
}

// ─── Accordion Section Component ───────────────────────────────────────
function PanelAccordion({
  title,
  isOpen,
  onToggle,
  children,
  helpKey,
}: {
  title: string;
  isOpen: boolean;
  onToggle: () => void;
  children: React.ReactNode;
  helpKey?: string;
}) {
  const openHelp = useHelpStore((s) => s.openPanelHelp);

  return (
    <div style={{ borderBottom: '1px solid var(--color-lumen-border)' }}>
      <div
        onClick={onToggle}
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '8px 12px',
          backgroundColor: 'var(--color-lumen-panel-header)',
          cursor: 'pointer',
          userSelect: 'none',
          fontSize: '12px',
          fontWeight: 600,
          color: 'var(--color-lumen-text)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span>{title}</span>
          {helpKey && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                openHelp(helpKey);
              }}
              title="Ayuda sobre este panel y control (?)"
              style={{
                background: 'var(--color-lumen-surface)',
                border: '1px solid var(--color-lumen-border)',
                borderRadius: '50%',
                width: '16px',
                height: '16px',
                fontSize: '10px',
                lineHeight: '14px',
                textAlign: 'center',
                color: 'var(--color-lumen-muted)',
                cursor: 'pointer',
              }}
            >
              ?
            </button>
          )}
        </div>
        <span style={{ fontSize: '10px', color: 'var(--color-lumen-muted)' }}>{isOpen ? '▼' : '▶'}</span>
      </div>
      {isOpen && <div style={{ padding: '10px 12px' }}>{children}</div>}
    </div>
  );
}

// ─── Slider Row Component ──────────────────────────────────────────────
function SliderRow({
  label,
  min,
  max,
  step,
  value,
  displayValue,
  onChange,
  onReset,
  gradient,
  helpKey,
}: {
  label: string;
  min: number;
  max: number;
  step: number;
  value: number;
  displayValue: string | number;
  onChange: (v: number) => void;
  onReset: () => void;
  gradient?: string;
  helpKey?: string;
}) {
  return (
    <AccessibleSlider
      label={label}
      min={min}
      max={max}
      step={step}
      value={value}
      displayValue={displayValue}
      onChange={onChange}
      onReset={onReset}
      gradient={gradient}
      helpId={helpKey}
    />
  );
}

// ─── Color Grading 3-Way Wheels Editor ─────────────────────────────────
function ColorGradingEditor() {
  const settings = useDevelopStore((s) => s.settings);
  const updateSetting = useDevelopStore((s) => s.updateSetting);
  const [activeWheel, setActiveWheel] = useState<'shadows' | 'midtones' | 'highlights'>('shadows');

  const cg = settings.colorGrading || {
    shadows: { hue: 0, sat: 0, lum: 0 },
    midtones: { hue: 0, sat: 0, lum: 0 },
    highlights: { hue: 0, sat: 0, lum: 0 },
    blending: 50,
    balance: 0,
  };

  const currentWheel = cg[activeWheel];

  const updateWheel = (patch: Partial<typeof currentWheel>) => {
    const updated = {
      ...cg,
      [activeWheel]: { ...currentWheel, ...patch },
    };
    updateSetting('colorGrading', updated, `Gradación ${activeWheel}`);
  };

  return (
    <div>
      <div style={{ display: 'flex', gap: '4px', marginBottom: '12px' }}>
        {(['shadows', 'midtones', 'highlights'] as const).map((w) => (
          <button
            key={w}
            onClick={() => setActiveWheel(w)}
            style={{
              flex: 1,
              backgroundColor: activeWheel === w ? '#3b82f6' : '#27272a',
              border: '1px solid #3f3f46',
              borderRadius: '4px',
              color: '#fff',
              padding: '4px 6px',
              fontSize: '10px',
              cursor: 'pointer',
              textTransform: 'capitalize',
            }}
          >
            {w === 'shadows' ? 'Sombras' : w === 'midtones' ? 'Medios' : 'Luces'}
          </button>
        ))}
      </div>

      <SliderRow
        label="Tono"
        min={0}
        max={360}
        step={1}
        value={currentWheel.hue}
        displayValue={`${currentWheel.hue}°`}
        onChange={(v) => updateWheel({ hue: v })}
        onReset={() => updateWheel({ hue: 0 })}
        gradient="linear-gradient(to right, #ff0000, #ffff00, #00ff00, #00ffff, #0000ff, #ff00ff, #ff0000)"
      />
      <SliderRow
        label="Saturación"
        min={0}
        max={100}
        step={1}
        value={currentWheel.sat}
        displayValue={currentWheel.sat}
        onChange={(v) => updateWheel({ sat: v })}
        onReset={() => updateWheel({ sat: 0 })}
      />
      <SliderRow
        label="Luminancia"
        min={-100}
        max={100}
        step={1}
        value={currentWheel.lum}
        displayValue={currentWheel.lum}
        onChange={(v) => updateWheel({ lum: v })}
        onReset={() => updateWheel({ lum: 0 })}
      />

      <div style={{ borderTop: '1px solid #27272a', marginTop: '10px', paddingTop: '10px' }}>
        <SliderRow
          label="Fusión"
          min={0}
          max={100}
          step={1}
          value={cg.blending ?? 50}
          displayValue={cg.blending ?? 50}
          onChange={(v) => updateSetting('colorGrading', { ...cg, blending: v })}
          onReset={() => updateSetting('colorGrading', { ...cg, blending: 50 })}
        />
        <SliderRow
          label="Equilibrio"
          min={-100}
          max={100}
          step={1}
          value={cg.balance ?? 0}
          displayValue={cg.balance ?? 0}
          onChange={(v) => updateSetting('colorGrading', { ...cg, balance: v })}
          onReset={() => updateSetting('colorGrading', { ...cg, balance: 0 })}
        />
      </div>
    </div>
  );
}

// ─── Detail Editor (Sharpening & Noise Reduction) ───────────────────────
function DetailEditor() {
  const settings = useDevelopStore((s) => s.settings);
  const updateSetting = useDevelopStore((s) => s.updateSetting);

  return (
    <div>
      <div style={{ fontSize: '11px', color: '#71717a', marginBottom: '6px', fontWeight: 600 }}>
        ENFOQUE
      </div>
      <SliderRow
        label="Cantidad"
        min={0}
        max={1.5}
        step={0.05}
        value={settings.sharpen}
        displayValue={Math.round(settings.sharpen * 100)}
        onChange={(v) => updateSetting('sharpen', v)}
        onReset={() => updateSetting('sharpen', 0, 'Reset Enfoque')}
      />
      <SliderRow
        label="Radio"
        min={0.5}
        max={3.0}
        step={0.1}
        value={settings.sharpenRadius ?? 1.0}
        displayValue={(settings.sharpenRadius ?? 1.0).toFixed(1)}
        onChange={(v) => updateSetting('sharpenRadius', v)}
        onReset={() => updateSetting('sharpenRadius', 1.0)}
      />
      <SliderRow
        label="Detalle"
        min={0}
        max={100}
        step={1}
        value={settings.sharpenDetail ?? 25}
        displayValue={settings.sharpenDetail ?? 25}
        onChange={(v) => updateSetting('sharpenDetail', v)}
        onReset={() => updateSetting('sharpenDetail', 25)}
      />
      <SliderRow
        label="Máscara"
        min={0}
        max={100}
        step={1}
        value={settings.sharpenMasking ?? 0}
        displayValue={settings.sharpenMasking ?? 0}
        onChange={(v) => updateSetting('sharpenMasking', v)}
        onReset={() => updateSetting('sharpenMasking', 0)}
      />

      <div style={{ fontSize: '11px', color: '#71717a', margin: '12px 0 6px 0', fontWeight: 600 }}>
        REDUCCIÓN DE RUIDO
      </div>
      <SliderRow
        label="Luminancia"
        min={0}
        max={100}
        step={1}
        value={settings.nrLum ?? 0}
        displayValue={settings.nrLum ?? 0}
        onChange={(v) => updateSetting('nrLum', v)}
        onReset={() => updateSetting('nrLum', 0)}
      />
      <SliderRow
        label="Detalle lum."
        min={0}
        max={100}
        step={1}
        value={settings.nrLumDetail ?? 50}
        displayValue={settings.nrLumDetail ?? 50}
        onChange={(v) => updateSetting('nrLumDetail', v)}
        onReset={() => updateSetting('nrLumDetail', 50)}
      />
      <SliderRow
        label="Color"
        min={0}
        max={100}
        step={1}
        value={settings.nrColor ?? 25}
        displayValue={settings.nrColor ?? 25}
        onChange={(v) => updateSetting('nrColor', v)}
        onReset={() => updateSetting('nrColor', 25)}
      />
    </div>
  );
}

// ─── Lens Corrections Editor ───────────────────────────────────────────
function LensCorrectionsEditor() {
  const settings = useDevelopStore((s) => s.settings);
  const updateSetting = useDevelopStore((s) => s.updateSetting);

  const lc = settings.lensCorrections || {
    removeChromaticAberration: false,
    distortion: 0,
    lensVignette: 0,
  };

  const update = (patch: Partial<typeof lc>) => {
    updateSetting('lensCorrections', { ...lc, ...patch }, 'Correcciones de lente');
  };

  const handleProfileSelect = (preset: string) => {
    if (preset === 'sony2470') {
      update({ distortion: 31, removeChromaticAberration: true, lensVignette: 20 });
    } else if (preset === 'sony1635') {
      update({ distortion: 48, removeChromaticAberration: true, lensVignette: 35 });
    } else if (preset === 'canon2470') {
      update({ distortion: 30, removeChromaticAberration: true, lensVignette: 18 });
    } else if (preset === 'nikon2470') {
      update({ distortion: 28, removeChromaticAberration: true, lensVignette: 15 });
    } else if (preset === 'sigma2470') {
      update({ distortion: 34, removeChromaticAberration: true, lensVignette: 22 });
    } else {
      update({ distortion: 0, lensVignette: 0 });
    }
  };

  return (
    <div>
      <div style={{ marginBottom: '10px' }}>
        <label style={{ fontSize: '11px', color: '#a1a1aa', display: 'block', marginBottom: '4px' }}>
          Perfil de lente calibrado (Lensfun)
        </label>
        <select
          aria-label="Perfil de lente calibrado"
          style={{
            width: '100%',
            background: '#27272a',
            border: '1px solid #3f3f46',
            borderRadius: '4px',
            color: '#e4e4e7',
            fontSize: '11px',
            padding: '4px 6px',
            outline: 'none',
          }}
          onChange={(e) => handleProfileSelect(e.target.value)}
          defaultValue="manual"
        >
          <option value="manual">Manual / Sin perfil</option>
          <option value="sony2470">Sony FE 24-70mm F2.8 GM II @ 24mm</option>
          <option value="sony1635">Sony FE 16-35mm F2.8 GM @ 16mm</option>
          <option value="canon2470">Canon RF 24-70mm F2.8L IS USM @ 24mm</option>
          <option value="nikon2470">Nikon NIKKOR Z 24-70mm f/2.8 S @ 24mm</option>
          <option value="sigma2470">Sigma 24-70mm F2.8 DG DN Art @ 24mm</option>
        </select>
      </div>

      <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: '#e4e4e7', cursor: 'pointer', marginBottom: '10px' }}>
        <input
          type="checkbox"
          checked={lc.removeChromaticAberration}
          onChange={(e) => update({ removeChromaticAberration: e.target.checked })}
          style={{ accentColor: '#3b82f6' }}
        />
        Quitar aberración cromática
      </label>

      <SliderRow
        label="Distorsión"
        min={-100}
        max={100}
        step={1}
        value={lc.distortion}
        displayValue={lc.distortion}
        onChange={(v) => update({ distortion: v })}
        onReset={() => update({ distortion: 0 })}
      />
      <SliderRow
        label="Viñeteado"
        min={-100}
        max={100}
        step={1}
        value={lc.lensVignette}
        displayValue={lc.lensVignette}
        onChange={(v) => update({ lensVignette: v })}
        onReset={() => update({ lensVignette: 0 })}
      />

      <div style={{ marginTop: '10px', padding: '6px 8px', background: '#18181b', border: '1px solid #27272a', borderRadius: '4px', fontSize: '9px', color: '#71717a', lineHeight: 1.4 }}>
        ℹ️ Perfiles de corrección óptica basados en la base de datos <strong>Lensfun</strong> (Licencia <em>CC-BY-SA 3.0 / LGPL v3</em>).
      </div>
    </div>
  );
}

// ─── Transform / Upright Editor ────────────────────────────────────────
function TransformEditor() {
  const settings = useDevelopStore((s) => s.settings);
  const updateSetting = useDevelopStore((s) => s.updateSetting);

  const tr = settings.transform || {
    vertical: 0,
    horizontal: 0,
    rotate: 0,
    scale: 100,
    aspect: 0,
  };

  const update = (patch: Partial<typeof tr>) => {
    updateSetting('transform', { ...tr, ...patch }, 'Transformar');
  };

  return (
    <div>
      <SliderRow
        label="Vertical"
        min={-100}
        max={100}
        step={1}
        value={tr.vertical}
        displayValue={tr.vertical}
        onChange={(v) => update({ vertical: v })}
        onReset={() => update({ vertical: 0 })}
      />
      <SliderRow
        label="Horizontal"
        min={-100}
        max={100}
        step={1}
        value={tr.horizontal}
        displayValue={tr.horizontal}
        onChange={(v) => update({ horizontal: v })}
        onReset={() => update({ horizontal: 0 })}
      />
      <SliderRow
        label="Rotar"
        min={-10}
        max={10}
        step={0.1}
        value={tr.rotate}
        displayValue={`${tr.rotate}°`}
        onChange={(v) => update({ rotate: v })}
        onReset={() => update({ rotate: 0 })}
      />
      <SliderRow
        label="Escala"
        min={50}
        max={150}
        step={1}
        value={tr.scale}
        displayValue={`${tr.scale}%`}
        onChange={(v) => update({ scale: v })}
        onReset={() => update({ scale: 100 })}
      />
      <SliderRow
        label="Aspecto"
        min={-100}
        max={100}
        step={1}
        value={tr.aspect}
        displayValue={tr.aspect}
        onChange={(v) => update({ aspect: v })}
        onReset={() => update({ aspect: 0 })}
      />
    </div>
  );
}

// ─── Camera Calibration Editor ─────────────────────────────────────────
function CalibrationEditor() {
  const settings = useDevelopStore((s) => s.settings);
  const updateSetting = useDevelopStore((s) => s.updateSetting);

  const cal = settings.calibration || {
    profile: 'Adobe Color',
    shadowTint: 0,
    redPrimary: { hue: 0, saturation: 0 },
    greenPrimary: { hue: 0, saturation: 0 },
    bluePrimary: { hue: 0, saturation: 0 },
  };

  const update = (patch: Partial<typeof cal>) => {
    updateSetting('calibration', { ...cal, ...patch }, 'Calibración');
  };

  const profiles = [
    'Cámara estándar',
    'Neutro',
    'Plano',
    'Adobe Color',
    'Adobe Standard',
    'Adobe Retrato',
    'Adobe Paisaje',
    'Adobe Neutro',
    'Adobe Fiel',
    'Adobe Vívido',
    'Adobe Monocromo',
  ];

  return (
    <div>
      <div style={{ marginBottom: '10px' }}>
        <div style={{ fontSize: '11px', color: '#71717a', marginBottom: '4px' }}>Perfil de cámara</div>
        <select
          value={cal.profile}
          onChange={(e) => update({ profile: e.target.value })}
          style={{
            width: '100%',
            backgroundColor: '#27272a',
            border: '1px solid #3f3f46',
            borderRadius: '4px',
            color: '#fff',
            padding: '5px 8px',
            fontSize: '11px',
          }}
        >
          {profiles.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
      </div>

      <SliderRow
        label="Sombras Matiz"
        min={-100}
        max={100}
        step={1}
        value={cal.shadowTint}
        displayValue={cal.shadowTint}
        onChange={(v) => update({ shadowTint: v })}
        onReset={() => update({ shadowTint: 0 })}
        gradient="linear-gradient(to right, #22c55e, #71717a, #ec4899)"
      />

      <div style={{ fontSize: '11px', color: '#ef4444', margin: '8px 0 4px 0', fontWeight: 600 }}>
        PRIMARIO ROJO
      </div>
      <SliderRow
        label="Tono"
        min={-100}
        max={100}
        step={1}
        value={cal.redPrimary?.hue ?? 0}
        displayValue={cal.redPrimary?.hue ?? 0}
        onChange={(v) => update({ redPrimary: { ...cal.redPrimary, hue: v } })}
        onReset={() => update({ redPrimary: { ...cal.redPrimary, hue: 0 } })}
      />
      <SliderRow
        label="Saturación"
        min={-100}
        max={100}
        step={1}
        value={cal.redPrimary?.saturation ?? 0}
        displayValue={cal.redPrimary?.saturation ?? 0}
        onChange={(v) => update({ redPrimary: { ...cal.redPrimary, saturation: v } })}
        onReset={() => update({ redPrimary: { ...cal.redPrimary, saturation: 0 } })}
      />

      <div style={{ fontSize: '11px', color: '#22c55e', margin: '8px 0 4px 0', fontWeight: 600 }}>
        PRIMARIO VERDE
      </div>
      <SliderRow
        label="Tono"
        min={-100}
        max={100}
        step={1}
        value={cal.greenPrimary?.hue ?? 0}
        displayValue={cal.greenPrimary?.hue ?? 0}
        onChange={(v) => update({ greenPrimary: { ...cal.greenPrimary, hue: v } })}
        onReset={() => update({ greenPrimary: { ...cal.greenPrimary, hue: 0 } })}
      />
      <SliderRow
        label="Saturación"
        min={-100}
        max={100}
        step={1}
        value={cal.greenPrimary?.saturation ?? 0}
        displayValue={cal.greenPrimary?.saturation ?? 0}
        onChange={(v) => update({ greenPrimary: { ...cal.greenPrimary, saturation: v } })}
        onReset={() => update({ greenPrimary: { ...cal.greenPrimary, saturation: 0 } })}
      />

      <div style={{ fontSize: '11px', color: '#3b82f6', margin: '8px 0 4px 0', fontWeight: 600 }}>
        PRIMARIO AZUL
      </div>
      <SliderRow
        label="Tono"
        min={-100}
        max={100}
        step={1}
        value={cal.bluePrimary?.hue ?? 0}
        displayValue={cal.bluePrimary?.hue ?? 0}
        onChange={(v) => update({ bluePrimary: { ...cal.bluePrimary, hue: v } })}
        onReset={() => update({ bluePrimary: { ...cal.bluePrimary, hue: 0 } })}
      />
      <SliderRow
        label="Saturación"
        min={-100}
        max={100}
        step={1}
        value={cal.bluePrimary?.saturation ?? 0}
        displayValue={cal.bluePrimary?.saturation ?? 0}
        onChange={(v) => update({ bluePrimary: { ...cal.bluePrimary, saturation: v } })}
        onReset={() => update({ bluePrimary: { ...cal.bluePrimary, saturation: 0 } })}
      />
    </div>
  );
}

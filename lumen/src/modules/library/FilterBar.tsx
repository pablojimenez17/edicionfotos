import { useMemo } from 'react';

import { useCatalogStore } from '../../stores/catalog';

export function FilterBar() {
  const photos = useCatalogStore((s) => s.photos);
  const filterCamera = useCatalogStore((s) => s.filterCamera);
  const filterLens = useCatalogStore((s) => s.filterLens);
  const filterDate = useCatalogStore((s) => s.filterDate);
  const setFilterCamera = useCatalogStore((s) => s.setFilterCamera);
  const setFilterLens = useCatalogStore((s) => s.setFilterLens);
  const setFilterDate = useCatalogStore((s) => s.setFilterDate);

  // Extract distinct cameras
  const cameras = useMemo(() => {
    const set = new Set<string>();
    for (const p of photos) {
      const name = `${p.camera_make || ''} ${p.camera_model || ''}`.trim();
      if (name) set.add(name);
    }
    return Array.from(set).sort();
  }, [photos]);

  // Extract distinct lenses
  const lenses = useMemo(() => {
    const set = new Set<string>();
    for (const p of photos) {
      if (p.lens) set.add(p.lens.trim());
    }
    return Array.from(set).sort();
  }, [photos]);

  // Extract distinct dates (YYYY-MM)
  const dates = useMemo(() => {
    const set = new Set<string>();
    for (const p of photos) {
      if (p.date_taken && p.date_taken.length >= 7) {
        set.add(p.date_taken.substring(0, 7)); // YYYY-MM
      }
    }
    return Array.from(set).sort().reverse();
  }, [photos]);

  const hasAnyFilter = Boolean(filterCamera || filterLens || filterDate);

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        padding: '6px 14px',
        backgroundColor: 'var(--color-lumen-bg-deep)',
        borderBottom: '1px solid var(--color-lumen-border)',
        fontSize: '11px',
        color: 'var(--color-lumen-text-dim)',
      }}
    >
      <span style={{ fontWeight: 600, color: 'var(--color-lumen-text)' }}>Filtros de metadatos:</span>

      {/* Camera filter */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
        <span>Cámara:</span>
        <select
          aria-label="Filtrar por modelo de cámara"
          value={filterCamera || ''}
          onChange={(e) => setFilterCamera(e.target.value || null)}
          style={{
            backgroundColor: 'var(--color-lumen-surface)',
            border: '1px solid var(--color-lumen-border)',
            borderRadius: 'var(--radius-xs)',
            color: 'var(--color-lumen-text)',
            fontSize: '11px',
            padding: '2px 6px',
            outline: 'none',
          }}
        >
          <option value="">Todas</option>
          {cameras.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>

      {/* Lens filter */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
        <span>Objetivo:</span>
        <select
          aria-label="Filtrar por objetivo o lente"
          value={filterLens || ''}
          onChange={(e) => setFilterLens(e.target.value || null)}
          style={{
            backgroundColor: 'var(--color-lumen-surface)',
            border: '1px solid var(--color-lumen-border)',
            borderRadius: 'var(--radius-xs)',
            color: 'var(--color-lumen-text)',
            fontSize: '11px',
            padding: '2px 6px',
            outline: 'none',
          }}
        >
          <option value="">Todos</option>
          {lenses.map((l) => (
            <option key={l} value={l}>
              {l}
            </option>
          ))}
        </select>
      </div>

      {/* Date filter */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
        <span>Fecha:</span>
        <select
          aria-label="Filtrar por fecha de captura"
          value={filterDate || ''}
          onChange={(e) => setFilterDate(e.target.value || null)}
          style={{
            backgroundColor: 'var(--color-lumen-surface)',
            border: '1px solid var(--color-lumen-border)',
            borderRadius: 'var(--radius-xs)',
            color: 'var(--color-lumen-text)',
            fontSize: '11px',
            padding: '2px 6px',
            outline: 'none',
          }}
        >
          <option value="">Todas las fechas</option>
          {dates.map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </select>
      </div>

      {/* Clear all filters */}
      {hasAnyFilter && (
        <button
          onClick={() => {
            setFilterCamera(null);
            setFilterLens(null);
            setFilterDate(null);
          }}
          style={{
            background: 'none',
            border: 'none',
            color: '#ef4444',
            cursor: 'pointer',
            fontSize: '11px',
            textDecoration: 'underline',
          }}
        >
          Restablecer filtros
        </button>
      )}
    </div>
  );
}

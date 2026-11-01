import { useState, useEffect } from 'react';
import { useCatalogStore } from '../../stores/catalog';
import {
  getCollections,
  createCollection,
  addPhotosToCollection,
  getCollectionPhotoIds,
  getSmartCollections,
  createSmartCollection,
  deleteSmartCollection,
  type SmartCollectionRule,
} from '../../services/catalog';
import type { Collection } from '../../types';

export function CollectionsPanel() {
  const selectedPhotoIds = useCatalogStore((s) => s.selectedPhotoIds);
  const activePhotoId = useCatalogStore((s) => s.activePhotoId);
  const activeCollectionId = useCatalogStore((s) => s.activeCollectionId);
  const setActiveCollectionId = useCatalogStore((s) => s.setActiveCollectionId);
  const setCollectionPhotoMap = useCatalogStore((s) => s.setCollectionPhotoMap);
  const quickCollectionPhotoIds = useCatalogStore((s) => s.quickCollectionPhotoIds);
  const toggleQuickCollection = useCatalogStore((s) => s.toggleQuickCollection);

  // Filter modifiers for smart collections
  const setFilterRating = useCatalogStore((s) => s.setFilterRating);
  const setFilterFlag = useCatalogStore((s) => s.setFilterFlag);
  const setFilterColor = useCatalogStore((s) => s.setFilterColor);

  const [collections, setCollections] = useState<Collection[]>([]);
  const [smartCollections, setSmartCollections] = useState<any[]>([]);
  const [activeSmartId, setActiveSmartId] = useState<number | null>(null);

  const [newCollectionName, setNewCollectionName] = useState('');
  const [showInput, setShowInput] = useState(false);

  // Smart collection modal
  const [showSmartModal, setShowSmartModal] = useState(false);
  const [smartName, setSmartName] = useState('');
  const [smartMinRating, setSmartMinRating] = useState<number>(3);
  const [smartFlag, setSmartFlag] = useState<string>('any');
  const [smartColor, setSmartColor] = useState<string>('any');

  const loadData = async () => {
    const list = await getCollections();
    setCollections(list);

    const smartList = await getSmartCollections();
    setSmartCollections(smartList);

    // Cache photo IDs for all manual collections
    const map: Record<number, number[]> = {};
    for (const c of list) {
      map[c.id] = await getCollectionPhotoIds(c.id);
    }
    setCollectionPhotoMap(map);
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCreate = async () => {
    if (!newCollectionName.trim()) return;
    await createCollection(newCollectionName.trim());
    setNewCollectionName('');
    setShowInput(false);
    await loadData();
  };

  const handleCreateSmart = async () => {
    if (!smartName.trim()) return;
    const rules: SmartCollectionRule = {
      ratingOp: '>=',
      rating: smartMinRating > 0 ? smartMinRating : undefined,
      flag: smartFlag !== 'any' ? smartFlag : undefined,
      color: smartColor !== 'any' ? smartColor : undefined,
    };
    await createSmartCollection(smartName.trim(), rules);
    setSmartName('');
    setShowSmartModal(false);
    await loadData();
  };

  const handleSelectSmart = (sc: any) => {
    if (activeSmartId === sc.id) {
      setActiveSmartId(null);
      setFilterRating(0);
      setFilterFlag(null);
      setFilterColor(null);
    } else {
      setActiveSmartId(sc.id);
      setActiveCollectionId(null);
      const rules = typeof sc.rules === 'string' ? JSON.parse(sc.rules) : sc.rules;
      if (rules.rating !== undefined) setFilterRating(rules.rating);
      if (rules.flag !== undefined) setFilterFlag(rules.flag as any);
      if (rules.color !== undefined) setFilterColor(rules.color as any);
    }
  };

  const handleDeleteSmart = async (e: React.MouseEvent, id: number) => {
    e.stopPropagation();
    await deleteSmartCollection(id);
    if (activeSmartId === id) {
      setActiveSmartId(null);
      setFilterRating(0);
      setFilterFlag(null);
      setFilterColor(null);
    }
    await loadData();
  };

  const handleAddSelection = async (collectionId: number) => {
    const ids = selectedPhotoIds.size > 0
      ? Array.from(selectedPhotoIds)
      : activePhotoId ? [activePhotoId] : [];
    if (ids.length === 0) return;

    if (collectionId === -1) {
      ids.forEach((id) => toggleQuickCollection(id));
    } else {
      await addPhotosToCollection(collectionId, ids);
      await loadData();
    }
  };

  const [isOpen, setIsOpen] = useState(true);

  return (
    <div style={{ borderBottom: '1px solid var(--color-lumen-border)' }}>
      <div
        className="panel__header"
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          cursor: 'pointer',
          userSelect: 'none',
        }}
        onClick={() => setIsOpen(!isOpen)}
      >
        <span>{isOpen ? '▾' : '▸'} COLECCIONES</span>
        <div style={{ display: 'flex', gap: '6px' }} onClick={(e) => e.stopPropagation()}>
          <button
            onClick={() => setShowSmartModal(true)}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--color-lumen-success)',
              cursor: 'pointer',
              fontSize: '10px',
              fontWeight: 600,
            }}
            title="Nueva colección inteligente"
          >
            + Smart
          </button>
          <button
            onClick={() => {
              setIsOpen(true);
              setShowInput((v) => !v);
            }}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--color-lumen-accent)',
              cursor: 'pointer',
              fontSize: '13px',
              fontWeight: 600,
            }}
            title="Crear nueva colección manual"
          >
            +
          </button>
        </div>
      </div>

      {isOpen && (
        <div style={{ padding: '8px 12px' }}>

      {showInput && (
        <div style={{ display: 'flex', gap: '4px', marginBottom: '8px' }}>
          <input
            type="text"
            value={newCollectionName}
            onChange={(e) => setNewCollectionName(e.target.value)}
            placeholder="Nombre de la colección…"
            style={{
              flex: 1,
              backgroundColor: '#18181b',
              border: '1px solid #3f3f46',
              borderRadius: '3px',
              padding: '2px 6px',
              fontSize: '11px',
              color: '#f4f4f5',
            }}
            onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
            autoFocus
          />
          <button
            onClick={handleCreate}
            style={{
              backgroundColor: '#3b82f6',
              border: 'none',
              borderRadius: '3px',
              padding: '2px 8px',
              fontSize: '10px',
              color: '#fff',
              cursor: 'pointer',
            }}
          >
            OK
          </button>
        </div>
      )}

      {/* Quick Collection (B) */}
      <div style={{ marginBottom: '6px' }}>
        <div
          onClick={() => {
            setActiveSmartId(null);
            setActiveCollectionId(activeCollectionId === -1 ? null : -1);
          }}
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '4px 6px',
            borderRadius: '3px',
            backgroundColor: activeCollectionId === -1 ? '#1e3a5f' : 'transparent',
            color: activeCollectionId === -1 ? '#93c5fd' : '#e4e4e7',
            fontSize: '11px',
            cursor: 'pointer',
          }}
        >
          <span>⭐ Colección Rápida (B)</span>
          <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
            <span style={{ fontSize: '10px', color: '#71717a' }}>{quickCollectionPhotoIds.size}</span>
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleAddSelection(-1);
              }}
              style={{
                background: 'none',
                border: 'none',
                color: '#3b82f6',
                cursor: 'pointer',
                fontSize: '10px',
              }}
              title="Añadir selección a Colección Rápida"
            >
              +Sel
            </button>
          </div>
        </div>
      </div>

      {/* Smart Collections Section */}
      {smartCollections.length > 0 && (
        <div style={{ marginBottom: '8px', borderTop: '1px solid #18181b', paddingTop: '4px' }}>
          <div style={{ fontSize: '10px', color: '#10b981', fontWeight: 600, marginBottom: '2px', paddingLeft: '4px' }}>
            INTELIGENTES
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
            {smartCollections.map((sc) => {
              const isActive = activeSmartId === sc.id;
              return (
                <div
                  key={sc.id}
                  onClick={() => handleSelectSmart(sc)}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '3px 6px',
                    borderRadius: '3px',
                    backgroundColor: isActive ? '#064e3b' : 'transparent',
                    color: isActive ? '#6ee7b7' : '#e4e4e7',
                    fontSize: '11px',
                    cursor: 'pointer',
                  }}
                >
                  <span>⚡ {sc.name}</span>
                  <button
                    onClick={(e) => handleDeleteSmart(e, sc.id)}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#71717a',
                      cursor: 'pointer',
                      fontSize: '10px',
                    }}
                    title="Eliminar colección inteligente"
                  >
                    ✕
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Manual collections list */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
        {collections.map((c) => {
          const isActive = activeCollectionId === c.id;
          return (
            <div
              key={c.id}
              onClick={() => {
                setActiveSmartId(null);
                setActiveCollectionId(isActive ? null : c.id);
              }}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '4px 6px',
                borderRadius: '3px',
                backgroundColor: isActive ? '#1e3a5f' : 'transparent',
                color: isActive ? '#93c5fd' : '#e4e4e7',
                fontSize: '11px',
                cursor: 'pointer',
              }}
            >
              <span>📁 {c.name}</span>
              <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                <span style={{ fontSize: '10px', color: '#71717a' }}>{c.photo_count || 0}</span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleAddSelection(c.id);
                  }}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#3b82f6',
                    cursor: 'pointer',
                    fontSize: '10px',
                  }}
                  title="Añadir selección a esta colección"
                >
                  +Sel
                </button>
              </div>
            </div>
          );
        })}
        </div>
        </div>
      )}

      {/* Modal: Crear Colección Inteligente */}
      {showSmartModal && (
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
              width: '320px',
              color: '#f4f4f5',
            }}
          >
            <h4 style={{ margin: '0 0 12px 0', fontSize: '13px', color: '#10b981' }}>
              Nueva Colección Inteligente
            </h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '11px' }}>
              <div>
                <label style={{ display: 'block', color: '#a1a1aa', marginBottom: '4px' }}>Nombre</label>
                <input
                  type="text"
                  value={smartName}
                  onChange={(e) => setSmartName(e.target.value)}
                  placeholder="Ej: Mejores Paisajes (4★+)"
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
                <label style={{ display: 'block', color: '#a1a1aa', marginBottom: '4px' }}>Puntuación Mínima</label>
                <select
                  value={smartMinRating}
                  onChange={(e) => setSmartMinRating(Number(e.target.value))}
                  style={{
                    width: '100%',
                    backgroundColor: '#27272a',
                    border: '1px solid #3f3f46',
                    borderRadius: '4px',
                    padding: '4px 8px',
                    color: '#fff',
                    fontSize: '11px',
                  }}
                >
                  <option value={0}>Cualquiera</option>
                  <option value={1}>★☆☆☆☆ o superior</option>
                  <option value={2}>★★☆☆☆ o superior</option>
                  <option value={3}>★★★☆☆ o superior</option>
                  <option value={4}>★★★★☆ o superior</option>
                  <option value={5}>★★★★★ (Solo 5 estrellas)</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', color: '#a1a1aa', marginBottom: '4px' }}>Estado / Flag</label>
                <select
                  value={smartFlag}
                  onChange={(e) => setSmartFlag(e.target.value)}
                  style={{
                    width: '100%',
                    backgroundColor: '#27272a',
                    border: '1px solid #3f3f46',
                    borderRadius: '4px',
                    padding: '4px 8px',
                    color: '#fff',
                    fontSize: '11px',
                  }}
                >
                  <option value="any">Cualquiera</option>
                  <option value="pick">Solo Seleccionadas (Pick 🏳)</option>
                  <option value="reject">Rechazadas (Reject)</option>
                  <option value="none">Sin bandera</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', color: '#a1a1aa', marginBottom: '4px' }}>Etiqueta de Color</label>
                <select
                  value={smartColor}
                  onChange={(e) => setSmartColor(e.target.value)}
                  style={{
                    width: '100%',
                    backgroundColor: '#27272a',
                    border: '1px solid #3f3f46',
                    borderRadius: '4px',
                    padding: '4px 8px',
                    color: '#fff',
                    fontSize: '11px',
                  }}
                >
                  <option value="any">Cualquiera</option>
                  <option value="red">Rojo</option>
                  <option value="yellow">Amarillo</option>
                  <option value="green">Verde</option>
                  <option value="blue">Azul</option>
                  <option value="purple">Púrpura</option>
                </select>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '16px' }}>
              <button
                onClick={() => setShowSmartModal(false)}
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
                onClick={handleCreateSmart}
                style={{
                  backgroundColor: '#10b981',
                  border: 'none',
                  color: '#fff',
                  borderRadius: '4px',
                  padding: '4px 12px',
                  fontSize: '11px',
                  cursor: 'pointer',
                  fontWeight: 600,
                }}
              >
                Crear Colección
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

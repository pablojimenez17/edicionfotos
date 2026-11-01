import { useState, useEffect } from 'react';

import { useCatalogStore } from '../../stores/catalog';
import {
  getKeywordsTree,
  createKeyword,
  assignKeywordToPhotos,
  removeKeywordFromPhotos,
  getPhotoKeywordIds,
} from '../../services/catalog';
import type { Keyword } from '../../types';

export function KeywordsPanel() {
  const selectedPhotoIds = useCatalogStore((s) => s.selectedPhotoIds);
  const activePhotoId = useCatalogStore((s) => s.activePhotoId);
  const activeKeywordId = useCatalogStore((s) => s.activeKeywordId);
  const setActiveKeywordId = useCatalogStore((s) => s.setActiveKeywordId);
  const setPhotoKeywordMap = useCatalogStore((s) => s.setPhotoKeywordMap);

  const [keywords, setKeywords] = useState<Keyword[]>([]);
  const [newKeywordName, setNewKeywordName] = useState('');
  const [selectedParentId, setSelectedParentId] = useState<number | null>(null);
  const [activePhotoKeywords, setActivePhotoKeywords] = useState<number[]>([]);

  const loadData = async () => {
    const tree = await getKeywordsTree();
    setKeywords(tree);

    if (activePhotoId) {
      const kwIds = await getPhotoKeywordIds(activePhotoId);
      setActivePhotoKeywords(kwIds);
      setPhotoKeywordMap({ [activePhotoId]: kwIds });
    }
  };

  useEffect(() => {
    loadData();
  }, [activePhotoId]);

  const handleCreate = async () => {
    if (!newKeywordName.trim()) return;
    await createKeyword(newKeywordName.trim(), selectedParentId);
    setNewKeywordName('');
    setSelectedParentId(null);
    await loadData();
  };

  const handleToggleAssign = async (keywordId: number) => {
    const targetIds = selectedPhotoIds.size > 0
      ? Array.from(selectedPhotoIds)
      : activePhotoId ? [activePhotoId] : [];

    if (targetIds.length === 0) return;

    const isAssigned = activePhotoKeywords.includes(keywordId);
    if (isAssigned) {
      await removeKeywordFromPhotos(keywordId, targetIds);
    } else {
      await assignKeywordToPhotos(keywordId, targetIds);
    }
    await loadData();
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
        <span>{isOpen ? '▾' : '▸'} PALABRAS CLAVE</span>
        {activeKeywordId !== null && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              setActiveKeywordId(null);
            }}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--color-lumen-accent)',
              cursor: 'pointer',
              fontSize: '10px',
              fontWeight: 500,
            }}
          >
            Limpiar filtro
          </button>
        )}
      </div>

      {isOpen && (
        <div style={{ padding: '8px 12px' }}>

      {/* Creation form */}
      <div style={{ display: 'flex', gap: '4px', marginBottom: '8px' }}>
        <input
          type="text"
          value={newKeywordName}
          onChange={(e) => setNewKeywordName(e.target.value)}
          placeholder="Nueva palabra clave…"
          style={{
            flex: 1,
            backgroundColor: '#18181b',
            border: '1px solid #3f3f46',
            borderRadius: '3px',
            color: '#fff',
            fontSize: '11px',
            padding: '3px 6px',
          }}
          onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
        />
        <button
          onClick={handleCreate}
          style={{
            backgroundColor: '#27272a',
            border: '1px solid #3f3f46',
            borderRadius: '3px',
            color: '#e4e4e7',
            padding: '3px 8px',
            fontSize: '11px',
            cursor: 'pointer',
          }}
        >
          +
        </button>
      </div>

      {/* Keyword hierarchy tree */}
      <div style={{ maxHeight: '180px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '2px' }}>
        {keywords.length === 0 ? (
          <div style={{ color: '#52525b', fontSize: '11px' }}>Sin palabras clave</div>
        ) : (
          keywords.map((kw) => (
            <KeywordItem
              key={kw.id}
              keyword={kw}
              depth={0}
              activeKeywordId={activeKeywordId}
              isAssigned={activePhotoKeywords.includes(kw.id)}
              onSelectFilter={() => setActiveKeywordId(activeKeywordId === kw.id ? null : kw.id)}
              onToggleAssign={() => handleToggleAssign(kw.id)}
              onAddChild={() => setSelectedParentId(kw.id)}
            />
          ))
        )}
        </div>
        </div>
      )}
    </div>
  );
}

function KeywordItem({
  keyword,
  depth,
  activeKeywordId,
  isAssigned,
  onSelectFilter,
  onToggleAssign,
  onAddChild,
}: {
  keyword: Keyword;
  depth: number;
  activeKeywordId: number | null;
  isAssigned: boolean;
  onSelectFilter: () => void;
  onToggleAssign: () => void;
  onAddChild: () => void;
}) {
  const isFiltered = activeKeywordId === keyword.id;

  return (
    <div>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '2px 4px',
          paddingLeft: `${depth * 14 + 4}px`,
          backgroundColor: isFiltered ? '#1e3a5f' : 'transparent',
          borderRadius: '3px',
          fontSize: '11px',
          color: isFiltered ? '#93c5fd' : '#e4e4e7',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flex: 1 }}>
          <input
            type="checkbox"
            checked={isAssigned}
            onChange={onToggleAssign}
            title="Asignar / quitar de la selección"
            style={{ cursor: 'pointer', accentColor: '#3b82f6' }}
          />
          <span
            onClick={onSelectFilter}
            style={{ cursor: 'pointer', userSelect: 'none' }}
            title="Clic para filtrar por esta palabra clave"
          >
            {keyword.name} {keyword.photo_count ? `(${keyword.photo_count})` : ''}
          </span>
        </div>
        <button
          onClick={onAddChild}
          title="Añadir sub-etiqueta hija"
          style={{
            background: 'none',
            border: 'none',
            color: '#71717a',
            cursor: 'pointer',
            fontSize: '10px',
          }}
        >
          +
        </button>
      </div>

      {keyword.children && keyword.children.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
          {keyword.children.map((child) => (
            <KeywordItem
              key={child.id}
              keyword={child}
              depth={depth + 1}
              activeKeywordId={activeKeywordId}
              isAssigned={isAssigned}
              onSelectFilter={onSelectFilter}
              onToggleAssign={onToggleAssign}
              onAddChild={onAddChild}
            />
          ))}
        </div>
      )}
    </div>
  );
}

import { useUiStore } from '../../stores/ui';
import { FolderPanel } from './FolderPanel';
import { GridView } from './GridView';
import { LoupeView } from './LoupeView';
import { CompareView } from './CompareView';
import { SurveyView } from './SurveyView';
import { FilterBar } from './FilterBar';
import { MetadataPanel } from './MetadataPanel';
import { Filmstrip } from '../../components/Filmstrip';

export function LibraryModule() {
  const leftPanelOpen = useUiStore((s) => s.leftPanelOpen);
  const rightPanelOpen = useUiStore((s) => s.rightPanelOpen);
  const libraryView = useUiStore((s) => s.libraryView);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', width: '100%' }}>
      <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
        {leftPanelOpen && <FolderPanel />}
        <div className="content-area" style={{ display: 'flex', flexDirection: 'column', flex: 1, position: 'relative', overflow: 'hidden' }}>
          {libraryView === 'grid' && <FilterBar />}
          <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
            {libraryView === 'grid' && <GridView />}
            {libraryView === 'loupe' && <LoupeView />}
            {libraryView === 'compare' && <CompareView />}
            {libraryView === 'survey' && <SurveyView />}
          </div>
        </div>
        {rightPanelOpen && <MetadataPanel />}
      </div>
      {(libraryView === 'loupe' || libraryView === 'compare' || libraryView === 'survey') && <Filmstrip />}
    </div>
  );
}


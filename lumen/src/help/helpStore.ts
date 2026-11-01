import { create } from 'zustand';
import { HELP_ES, type HelpEntry } from './help.es';

interface HelpState {
  activeHelpId: string | null;
  panelModalHelp: HelpEntry | null;
  setActiveHelpId: (id: string | null) => void;
  openPanelHelp: (id: string) => void;
  closePanelHelp: () => void;
  getEntry: (id: string) => HelpEntry | undefined;
}

export const useHelpStore = create<HelpState>((set) => ({
  activeHelpId: null,
  panelModalHelp: null,

  setActiveHelpId: (id) => set({ activeHelpId: id }),
  openPanelHelp: (id) => {
    const entry = HELP_ES[id];
    if (entry) {
      set({ panelModalHelp: entry });
    }
  },
  closePanelHelp: () => set({ panelModalHelp: null }),
  getEntry: (id) => HELP_ES[id],
}));

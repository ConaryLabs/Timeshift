import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface UIState {
  sidebarOpen: boolean
  selectedTeamId: string | null
  selectedPeriodId: string | null
  collapsedSections: Record<string, boolean>
  toggleSidebar: () => void
  setSidebarOpen: (open: boolean) => void
  setSelectedTeamId: (id: string | null) => void
  setSelectedPeriodId: (id: string | null) => void
  toggleSection: (key: string) => void
  isSectionCollapsed: (key: string) => boolean
}

export const useUIStore = create<UIState>()(
  persist(
    (set, get) => ({
      sidebarOpen: true,
      selectedTeamId: null,
      selectedPeriodId: null,
      collapsedSections: {},
      toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
      setSidebarOpen: (open) => set({ sidebarOpen: open }),
      setSelectedTeamId: (id) => set({ selectedTeamId: id }),
      setSelectedPeriodId: (id) => set({ selectedPeriodId: id }),
      toggleSection: (key) =>
        set((s) => ({
          collapsedSections: {
            ...s.collapsedSections,
            [key]: !s.collapsedSections[key],
          },
        })),
      isSectionCollapsed: (key) => !!get().collapsedSections[key],
    }),
    {
      name: 'timeshift-ui',
      version: 2,
      migrate: (persistedState, version) => {
        const state = persistedState as UIState
        if (version < 2) {
          return { ...state, collapsedSections: {} }
        }
        return state
      },
    },
  ),
)

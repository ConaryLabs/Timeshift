// frontend/src/store/ui.ts
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
  /** Reset org-specific selections (call on logout) */
  reset: () => void
}

export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
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
      reset: () => set({ selectedTeamId: null, selectedPeriodId: null }),
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

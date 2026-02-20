import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface UIState {
  sidebarOpen: boolean
  selectedTeamId: string | null
  selectedPeriodId: string | null
  toggleSidebar: () => void
  setSidebarOpen: (open: boolean) => void
  setSelectedTeamId: (id: string | null) => void
  setSelectedPeriodId: (id: string | null) => void
}

export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      sidebarOpen: true,
      selectedTeamId: null,
      selectedPeriodId: null,
      toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
      setSidebarOpen: (open) => set({ sidebarOpen: open }),
      setSelectedTeamId: (id) => set({ selectedTeamId: id }),
      setSelectedPeriodId: (id) => set({ selectedPeriodId: id }),
    }),
    {
      name: 'timeshift-ui',
      version: 1,
      migrate: (persistedState) => {
        return persistedState as UIState
      },
    },
  ),
)

// frontend/src/pages/schedule/DailyView.tsx
import { useState } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { usePermissions } from '@/hooks/usePermissions'
import { useUIStore } from '@/store/ui'
import { toLocalDateStr } from '@/lib/format'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import StaffingBlockGrid from './StaffingBlockGrid'
import { ShiftList } from './ShiftList'
import DutyBoardTab from './DutyBoardTab'
import ActionPanel from './ActionPanel'
import { MyShiftsCard } from './MyShiftsCard'
import type { SelectedBlock } from './types'

interface DailyViewProps {
  date: Date
  teamId?: string | null
}

export function DailyView({ date }: DailyViewProps) {
  const { isManager } = usePermissions()
  const collapsedSections = useUIStore((s) => s.collapsedSections)
  const toggleSection = useUIStore((s) => s.toggleSection)
  const [selectedBlock, setSelectedBlock] = useState<SelectedBlock | null>(null)
  const [managerTab, setManagerTab] = useState('schedule')
  const [employeeTab, setEmployeeTab] = useState('schedule')

  const dateStr = toLocalDateStr(date)

  const teamSectionCollapsed = collapsedSections['unified-team-schedule'] ?? true
  const blockGridCollapsed = collapsedSections['unified-block-grid'] ?? false

  if (isManager) {
    return (
      <div className="space-y-4">
        <StaffingBlockGrid
          date={dateStr}
          onBlockClick={(block) => setSelectedBlock(block)}
        />

        <Tabs value={managerTab} onValueChange={setManagerTab}>
          <TabsList>
            <TabsTrigger value="schedule">Schedule</TabsTrigger>
            <TabsTrigger value="duty-board">Duty Board</TabsTrigger>
          </TabsList>
          <TabsContent value="schedule">
            <ShiftList date={dateStr} />
          </TabsContent>
          <TabsContent value="duty-board">
            <DutyBoardTab date={dateStr} />
          </TabsContent>
        </Tabs>

        <ActionPanel
          date={dateStr}
          block={selectedBlock}
          onClose={() => setSelectedBlock(null)}
        />
      </div>
    )
  }

  // Employee layout
  return (
    <div className="space-y-4">
      <MyShiftsCard date={date} />

      <div className="rounded-lg border bg-card">
        <button
          className="flex w-full items-center gap-2 px-4 py-3 text-sm font-medium hover:bg-muted/50 transition-colors"
          onClick={() => toggleSection('unified-team-schedule')}
        >
          {teamSectionCollapsed ? (
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          )}
          Team Schedule
        </button>

        {!teamSectionCollapsed && (
          <div className="px-4 pb-4 space-y-4">
            <div className="rounded-lg border">
              <button
                className="flex w-full items-center gap-2 px-4 py-3 text-sm font-medium hover:bg-muted/50 transition-colors"
                onClick={() => toggleSection('unified-block-grid')}
              >
                {blockGridCollapsed ? (
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                )}
                Coverage Overview
              </button>
              {!blockGridCollapsed && (
                <div className="px-4 pb-4">
                  <StaffingBlockGrid date={dateStr} readonly />
                </div>
              )}
            </div>

            <Tabs value={employeeTab} onValueChange={setEmployeeTab}>
              <TabsList>
                <TabsTrigger value="schedule">Schedule</TabsTrigger>
                <TabsTrigger value="duty-board">Duty Board</TabsTrigger>
              </TabsList>
              <TabsContent value="schedule">
                <ShiftList date={dateStr} />
              </TabsContent>
              <TabsContent value="duty-board">
                <DutyBoardTab date={dateStr} />
              </TabsContent>
            </Tabs>
          </div>
        )}
      </div>
    </div>
  )
}

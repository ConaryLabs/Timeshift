import * as React from "react"
import { cn } from "@/lib/utils"

interface TabsContextValue {
  value: string
  onValueChange: (value: string) => void
  id: string
}

const TabsContext = React.createContext<TabsContextValue | null>(null)

function useTabs() {
  const ctx = React.useContext(TabsContext)
  if (!ctx) throw new Error("useTabs must be used within Tabs")
  return ctx
}

let tabsCounter = 0

interface TabsProps {
  value: string
  onValueChange: (value: string) => void
  children: React.ReactNode
  className?: string
}

export function Tabs({ value, onValueChange, children, className }: TabsProps) {
  const id = React.useMemo(() => `tabs-${++tabsCounter}`, [])
  return (
    <TabsContext.Provider value={{ value, onValueChange, id }}>
      <div className={className}>{children}</div>
    </TabsContext.Provider>
  )
}

export function TabsList({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      role="tablist"
      className={cn(
        "inline-flex h-9 items-center justify-center rounded-lg bg-muted p-1 text-muted-foreground",
        className,
      )}
    >
      {children}
    </div>
  )
}

interface TabsTriggerProps {
  value: string
  children: React.ReactNode
  className?: string
}

export function TabsTrigger({ value, children, className }: TabsTriggerProps) {
  const { value: selected, onValueChange, id: tabsId } = useTabs()
  const isSelected = selected === value
  return (
    <button
      type="button"
      role="tab"
      id={`${tabsId}-trigger-${value}`}
      aria-selected={isSelected}
      aria-controls={`${tabsId}-content-${value}`}
      tabIndex={isSelected ? 0 : -1}
      onClick={() => onValueChange(value)}
      className={cn(
        "inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-1 text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        isSelected
          ? "bg-background text-foreground shadow"
          : "hover:bg-background/50 hover:text-foreground",
        className,
      )}
    >
      {children}
    </button>
  )
}

interface TabsContentProps {
  value: string
  children: React.ReactNode
  className?: string
}

export function TabsContent({ value, children, className }: TabsContentProps) {
  const { value: selected, id: tabsId } = useTabs()
  if (selected !== value) return null
  return (
    <div
      role="tabpanel"
      id={`${tabsId}-content-${value}`}
      aria-labelledby={`${tabsId}-trigger-${value}`}
      tabIndex={0}
      className={cn("mt-4", className)}
    >
      {children}
    </div>
  )
}

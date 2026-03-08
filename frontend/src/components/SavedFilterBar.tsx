// components/SavedFilterBar.tsx
import { useState, useEffect, useLayoutEffect, useRef, useMemo } from 'react'
import { toast } from 'sonner'
import { Save, Star, StarOff, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { FormField } from '@/components/ui/form-field'
import { useSavedFilters, useCreateSavedFilter, useDeleteSavedFilter, useSetSavedFilterDefault } from '@/hooks/queries'
import type { SavedFilter } from '@/api/savedFilters'
import { cn } from '@/lib/utils'

interface SavedFilterBarProps {
  page: string
  currentFilters: Record<string, unknown>
  onApplyFilter: (filters: Record<string, unknown>) => void
  className?: string
}

export function SavedFilterBar({ page, currentFilters, onApplyFilter, className }: SavedFilterBarProps) {
  const { data: filters } = useSavedFilters(page)
  const createMut = useCreateSavedFilter()
  const deleteMut = useDeleteSavedFilter()
  const setDefaultMut = useSetSavedFilterDefault()
  const [saveDialogOpen, setSaveDialogOpen] = useState(false)
  const [filterName, setFilterName] = useState('')
  // Track the user's explicit selection; null means "no explicit choice yet"
  const [userSelectedId, setUserSelectedId] = useState<string | null>(null)
  const defaultAppliedRef = useRef(false)
  const onApplyFilterRef = useRef(onApplyFilter)
  useLayoutEffect(() => { onApplyFilterRef.current = onApplyFilter })

  // Derive the default filter ID from data (pure derivation, no side effects)
  const defaultFilterId = useMemo(() => {
    if (!filters) return null
    const def = filters.find((f) => f.is_default)
    return def?.id ?? null
  }, [filters])

  // The effective selected ID: user's explicit choice takes precedence,
  // otherwise fall back to default filter (once data loads), otherwise 'none'
  const effectiveSelectedId = userSelectedId ?? defaultFilterId ?? 'none'

  // Apply default filter on initial data load.
  // Only the parent callback (onApplyFilter) runs here -- no setState.
  // The ref is only accessed inside this effect, not during render.
  // Using onApplyFilterRef to avoid re-running when the parent doesn't stabilize the callback.
  useEffect(() => {
    if (filters && !defaultAppliedRef.current) {
      defaultAppliedRef.current = true
      const defaultFilter = filters.find((f) => f.is_default)
      if (defaultFilter) {
        onApplyFilterRef.current(defaultFilter.filters)
      }
    }
  }, [filters])

  function handleApply(filterId: string) {
    if (filterId === 'none') {
      setUserSelectedId('none')
      return
    }
    const filter = filters?.find((f) => f.id === filterId)
    if (filter) {
      onApplyFilter(filter.filters)
      setUserSelectedId(filterId)
    }
  }

  function handleSave() {
    if (!filterName.trim()) return
    createMut.mutate(
      { name: filterName.trim(), page, filters: currentFilters },
      {
        onSuccess: () => {
          toast.success('Filter saved')
          setSaveDialogOpen(false)
          setFilterName('')
        },
        onError: () => toast.error('Failed to save filter'),
      },
    )
  }

  function handleDelete(id: string) {
    deleteMut.mutate(id, {
      onSuccess: () => {
        toast.success('Filter deleted')
        if (effectiveSelectedId === id) setUserSelectedId('none')
      },
      onError: () => toast.error('Failed to delete filter'),
    })
  }

  function handleToggleDefault(filter: SavedFilter) {
    setDefaultMut.mutate(
      { id: filter.id, is_default: !filter.is_default },
      {
        onSuccess: () => toast.success(filter.is_default ? 'Default removed' : 'Set as default'),
        onError: () => toast.error('Failed to update default'),
      },
    )
  }

  const selectedFilter = effectiveSelectedId !== 'none' && filters
    ? filters.find((x) => x.id === effectiveSelectedId) ?? null
    : null

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <Select value={effectiveSelectedId} onValueChange={handleApply}>
        <SelectTrigger className="w-[180px] h-8 text-sm">
          <SelectValue placeholder="Saved Filters" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="none">No filter</SelectItem>
          {filters?.map((f) => (
            <SelectItem key={f.id} value={f.id}>
              {f.is_default ? '* ' : ''}{f.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Button variant="outline" size="sm" onClick={() => setSaveDialogOpen(true)} className="gap-1">
        <Save className="h-3.5 w-3.5" />
        Save
      </Button>

      {selectedFilter && (
        <>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleToggleDefault(selectedFilter)}
            title={selectedFilter.is_default ? 'Remove as default' : 'Set as default'}
            aria-label={selectedFilter.is_default ? 'Remove as default' : 'Set as default'}
          >
            {selectedFilter.is_default ? <StarOff className="h-3.5 w-3.5 text-amber-500" /> : <Star className="h-3.5 w-3.5" />}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleDelete(selectedFilter.id)}
            className="text-destructive hover:text-destructive"
            title="Delete filter"
            aria-label="Delete filter"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </>
      )}

      <Dialog open={saveDialogOpen} onOpenChange={setSaveDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Save Current Filters</DialogTitle>
          </DialogHeader>
          <FormField label="Filter Name" htmlFor="filter-name" required>
            <Input
              id="filter-name"
              value={filterName}
              onChange={(e) => setFilterName(e.target.value)}
              placeholder="e.g. My Team View"
              onKeyDown={(e) => e.key === 'Enter' && handleSave()}
            />
          </FormField>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSaveDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={!filterName.trim() || createMut.isPending}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

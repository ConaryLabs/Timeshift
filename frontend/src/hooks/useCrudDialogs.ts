// frontend/src/hooks/useCrudDialogs.ts
import { useState, useCallback } from 'react'

export interface CrudDialogState<T> {
  isCreateOpen: boolean
  editItem: T | null
  deleteItem: T | null
  openCreate: () => void
  closeCreate: () => void
  openEdit: (item: T) => void
  closeEdit: () => void
  openDelete: (item: T) => void
  closeDelete: () => void
}

/**
 * Manages the three standard CRUD dialog states:
 *   - create (boolean open/close)
 *   - edit (holds the item being edited, null = closed)
 *   - delete (holds the item pending deletion, null = closed)
 *
 * Usage:
 *   const dialogs = useCrudDialogs<MyEntity>()
 *   // dialogs.isCreateOpen, dialogs.editItem, dialogs.deleteItem
 *   // dialogs.openCreate(), dialogs.closeCreate()
 *   // dialogs.openEdit(item), dialogs.closeEdit()
 *   // dialogs.openDelete(item), dialogs.closeDelete()
 */
export function useCrudDialogs<T>(): CrudDialogState<T> {
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [editItem, setEditItem] = useState<T | null>(null)
  const [deleteItem, setDeleteItem] = useState<T | null>(null)

  return {
    isCreateOpen,
    editItem,
    deleteItem,
    openCreate: useCallback(() => setIsCreateOpen(true), []),
    closeCreate: useCallback(() => setIsCreateOpen(false), []),
    openEdit: useCallback((item: T) => setEditItem(item), []),
    closeEdit: useCallback(() => setEditItem(null), []),
    openDelete: useCallback((item: T) => setDeleteItem(item), []),
    closeDelete: useCallback(() => setDeleteItem(null), []),
  }
}

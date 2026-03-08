// frontend/src/hooks/useConfirmClose.tsx
import { useState } from 'react'
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'

/**
 * Intercepts dialog close when a form is dirty.
 *
 * Usage:
 *   const { confirmClose, confirmDialog } = useConfirmClose()
 *
 *   <Dialog open={open} onOpenChange={(o) => { if (!o) confirmClose(isDirty, () => setOpen(false)) }}>
 *     ...
 *   </Dialog>
 *   {confirmDialog}
 */
export function useConfirmClose() {
  const [pendingClose, setPendingClose] = useState<(() => void) | null>(null)

  function confirmClose(isDirty: boolean, onClose: () => void) {
    if (!isDirty) {
      onClose()
    } else {
      setPendingClose(() => onClose)
    }
  }

  const confirmDialog = (
    <AlertDialog
      open={!!pendingClose}
      onOpenChange={(open) => { if (!open) setPendingClose(null) }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Discard changes?</AlertDialogTitle>
          <AlertDialogDescription>
            You have unsaved changes. Close without saving?
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <Button variant="outline" onClick={() => setPendingClose(null)}>
            Keep editing
          </Button>
          <Button
            variant="destructive"
            onClick={() => {
              pendingClose?.()
              setPendingClose(null)
            }}
          >
            Discard
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )

  return { confirmClose, confirmDialog }
}

// components/ConflictDialog.tsx
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'

interface ConflictDialogProps {
  open: boolean
  onReload: () => void
  onForceSave: () => void
  onCancel: () => void
}

export function ConflictDialog({ open, onReload, onForceSave, onCancel }: ConflictDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={(o) => { if (!o) onCancel() }}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="text-amber-700">Edit Conflict</AlertDialogTitle>
          <AlertDialogDescription>
            This record has been modified by another user since you last loaded it.
            You can reload the latest data (your changes will be lost), save anyway
            to overwrite, or cancel to keep editing.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button
            variant="outline"
            className="border-amber-300 text-amber-700 hover:bg-amber-50"
            onClick={onForceSave}
          >
            Save Anyway
          </Button>
          <Button onClick={onReload}>
            Reload
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

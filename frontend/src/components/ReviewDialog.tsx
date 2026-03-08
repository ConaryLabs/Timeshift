// frontend/src/components/ReviewDialog.tsx
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { FormField } from '@/components/ui/form-field'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog'

export type ReviewTarget = { id: string; action: 'approved' | 'denied' }

interface ReviewDialogProps {
  target: ReviewTarget | null
  onClose: () => void
  onConfirm: (id: string, action: 'approved' | 'denied', notes?: string) => void
  isPending: boolean
  entityLabel?: string
}

export function ReviewDialog({ target, onClose, onConfirm, isPending, entityLabel = 'Request' }: ReviewDialogProps) {
  const [notes, setNotes] = useState('')

  function handleOpenChange(open: boolean) {
    if (!open) {
      onClose()
      setNotes('')
    }
  }

  function handleConfirm() {
    if (!target) return
    onConfirm(target.id, target.action, notes || undefined)
    setNotes('')
  }

  return (
    <Dialog open={!!target} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {target?.action === 'approved' ? `Approve ${entityLabel}` : `Deny ${entityLabel}`}
          </DialogTitle>
          <DialogDescription>Optionally add notes for the employee.</DialogDescription>
        </DialogHeader>
        <FormField label="Reviewer Notes" htmlFor="review-notes">
          <Textarea
            id="review-notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Optional notes..."
            rows={3}
          />
        </FormField>
        <DialogFooter>
          <Button variant="outline" onClick={() => { onClose(); setNotes('') }}>Cancel</Button>
          <Button
            variant={target?.action === 'approved' ? 'default' : 'destructive'}
            onClick={handleConfirm}
            disabled={isPending}
          >
            {target?.action === 'approved' ? 'Approve' : 'Deny'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

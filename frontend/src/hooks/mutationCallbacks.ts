// frontend/src/hooks/mutationCallbacks.ts
import { toast } from 'sonner'
import { extractApiError } from '@/lib/format'

/**
 * Returns standard onSuccess/onError mutation callbacks that show a sonner toast.
 *
 * Usage:
 *   createMut.mutate(data, mutationCallbacks('Created successfully', () => dialogs.closeCreate()))
 *   deleteMut.mutate(id,   mutationCallbacks('Deleted', () => dialogs.closeDelete(), 'Delete failed'))
 *
 * @param successMessage  Toast message shown on success.
 * @param onSuccessExtra  Optional callback to run after the success toast (e.g. close a dialog).
 * @param errorFallback   Fallback message passed to extractApiError on failure.
 *                        Defaults to 'An error occurred'.
 */
export function mutationCallbacks(
  successMessage: string,
  onSuccessExtra?: () => void,
  errorFallback = 'An error occurred',
): {
  onSuccess: () => void
  onError: (err: unknown) => void
} {
  return {
    onSuccess: () => {
      toast.success(successMessage)
      onSuccessExtra?.()
    },
    onError: (err: unknown) => {
      toast.error(extractApiError(err, errorFallback))
    },
  }
}

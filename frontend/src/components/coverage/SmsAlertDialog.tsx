import { useState } from 'react'
import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Megaphone } from 'lucide-react'
import { useSendSmsAlert } from '@/hooks/queries'
import type { ClassificationGap } from '@/api/coveragePlans'

interface Props {
  date: string
  gaps: ClassificationGap[]
  open: boolean
  onOpenChange: (open: boolean) => void
}

export default function SmsAlertDialog({ date, gaps, open, onOpenChange }: Props) {
  const sendSms = useSendSmsAlert()
  const [result, setResult] = useState<{ sent: number; failed: number } | null>(null)

  // Build message preview
  const gapSummary = gaps.length > 0
    ? gaps.map((g) => `${g.classification_abbreviation}: ${g.actual}/${g.target}`).join(', ')
    : 'OT is available today.'

  const messagePreview = `OT Available - ${date}\nGaps: ${gapSummary}\nReply STOP to opt out.`

  async function handleSend() {
    try {
      const res = await sendSms.mutateAsync({ date })
      setResult(res)
      if (res.sent > 0) {
        toast.success(`SMS alert sent to ${res.sent} employee${res.sent !== 1 ? 's' : ''}`)
      }
      if (res.failed > 0) {
        toast.error(`${res.failed} SMS failed to send`)
      }
      if (res.sent === 0 && res.failed === 0) {
        toast.info('No employees opted in to SMS notifications')
      }
    } catch {
      toast.error('Failed to send SMS alert')
    }
  }

  function handleClose() {
    setResult(null)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Megaphone className="h-4 w-4" />
            Send OT Alert SMS
          </DialogTitle>
          <DialogDescription>
            Send a text message to all employees who have opted in to SMS notifications.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Message Preview */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Message Preview</label>
            <div className="rounded-lg border bg-muted/50 p-3 text-sm whitespace-pre-wrap font-mono text-xs">
              {messagePreview}
            </div>
          </div>

          {/* Gap Summary */}
          {gaps.length > 0 && (
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Current Gaps</label>
              <div className="flex flex-wrap gap-1.5">
                {gaps.map((g) => (
                  <span
                    key={`${g.classification_id}-${g.shift_template_id}`}
                    className="inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs"
                  >
                    <span
                      className="h-1.5 w-1.5 rounded-full"
                      style={{ backgroundColor: g.shift_color }}
                    />
                    {g.classification_abbreviation}
                    <span className="text-destructive font-medium">-{g.shortage}</span>
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Result */}
          {result && (
            <div className="rounded-lg border p-3 space-y-1 text-sm">
              <p className="font-medium">Results</p>
              <div className="flex gap-4">
                <span className="text-green-600 dark:text-green-400">
                  {result.sent} sent
                </span>
                {result.failed > 0 && (
                  <span className="text-destructive">
                    {result.failed} failed
                  </span>
                )}
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            {result ? 'Close' : 'Cancel'}
          </Button>
          {!result && (
            <Button onClick={handleSend} disabled={sendSms.isPending}>
              {sendSms.isPending ? 'Sending...' : 'Send Alert'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

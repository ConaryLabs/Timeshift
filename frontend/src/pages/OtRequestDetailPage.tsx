import { useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { toast } from 'sonner'
import { ChevronLeft, UserPlus, X, Clock, MapPin, FileText, User } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { StatusBadge } from '@/components/ui/status-badge'
import { LoadingState } from '@/components/ui/loading-state'
import { EmptyState } from '@/components/ui/empty-state'
import { FormField } from '@/components/ui/form-field'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  useOtRequest,
  useAssignOtRequest,
  useCancelOtRequest,
  useCancelOtAssignment,
  useUpdateOtRequest,
} from '@/hooks/queries'
import { usePermissions } from '@/hooks/usePermissions'
import { formatTime, formatDate, extractApiError } from '@/lib/format'
import type { OtRequestVolunteer, OtRequestAssignment, OtType } from '@/api/otRequests'

function formatDateTime(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

function otTypeLabel(ot: OtType): string {
  switch (ot) {
    case 'voluntary':
      return 'Voluntary'
    case 'mandatory':
      return 'Mandatory'
    case 'fixed_coverage':
      return 'Fixed Coverage'
    default:
      return ot
  }
}

export default function OtRequestDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { isManager } = usePermissions()

  const { data: request, isLoading, isError, refetch } = useOtRequest(id ?? '')
  const assignMut = useAssignOtRequest()
  const cancelMut = useCancelOtRequest()
  const cancelAssignmentMut = useCancelOtAssignment()
  const updateMut = useUpdateOtRequest()

  const [assigningVolunteer, setAssigningVolunteer] = useState<OtRequestVolunteer | null>(null)
  const [assignOtType, setAssignOtType] = useState<OtType>('voluntary')
  const [cancellingAssignment, setCancellingAssignment] = useState<OtRequestAssignment | null>(null)
  const [showCancelRequest, setShowCancelRequest] = useState(false)
  const [showEditDialog, setShowEditDialog] = useState(false)
  const [editNotes, setEditNotes] = useState('')
  const [editLocation, setEditLocation] = useState('')

  if (isLoading) {
    return <LoadingState />
  }

  if (isError || !request) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" asChild>
          <Link to="/available-ot">
            <ChevronLeft className="h-4 w-4 mr-1" />
            Back to Available OT
          </Link>
        </Button>
        <EmptyState
          title="OT request not found"
          description="The overtime request could not be loaded."
          action={
            <Button size="sm" variant="outline" onClick={() => refetch()}>
              Retry
            </Button>
          }
        />
      </div>
    )
  }

  const isOpen = request.status === 'open' || request.status === 'partially_filled'
  const activeVolunteers = request.volunteers.filter((v) => !v.withdrawn_at)
  const withdrawnVolunteers = request.volunteers.filter((v) => v.withdrawn_at)
  const activeAssignments = request.assignments.filter((a) => !a.cancelled_at)
  const cancelledAssignments = request.assignments.filter((a) => a.cancelled_at)

  function handleAssign() {
    if (!assigningVolunteer || !id) return
    assignMut.mutate(
      { id, user_id: assigningVolunteer.user_id, ot_type: assignOtType },
      {
        onSuccess: () => {
          toast.success(`Assigned ${assigningVolunteer.user_name}`)
          setAssigningVolunteer(null)
        },
        onError: (err: unknown) => {
          toast.error(extractApiError(err, 'Failed to assign'))
        },
      },
    )
  }

  function handleCancelAssignment() {
    if (!cancellingAssignment || !id) return
    cancelAssignmentMut.mutate(
      { id, userId: cancellingAssignment.user_id },
      {
        onSuccess: () => {
          toast.success(`Assignment cancelled for ${cancellingAssignment.user_name}`)
          setCancellingAssignment(null)
        },
        onError: (err: unknown) => {
          toast.error(extractApiError(err, 'Failed to cancel assignment'))
        },
      },
    )
  }

  function handleCancelRequest() {
    if (!id) return
    cancelMut.mutate(id, {
      onSuccess: () => {
        toast.success('OT request cancelled')
        setShowCancelRequest(false)
      },
      onError: (err: unknown) => {
        toast.error(extractApiError(err, 'Failed to cancel OT request'))
      },
    })
  }

  function openEditDialog() {
    if (!request) return
    setEditNotes(request.notes ?? '')
    setEditLocation(request.location ?? '')
    setShowEditDialog(true)
  }

  function handleSaveEdit() {
    if (!id) return
    updateMut.mutate(
      { id, notes: editNotes || undefined, location: editLocation || undefined },
      {
        onSuccess: () => {
          toast.success('OT request updated')
          setShowEditDialog(false)
        },
        onError: (err: unknown) => {
          toast.error(extractApiError(err, 'Failed to update'))
        },
      },
    )
  }

  return (
    <div className="space-y-6">
      {/* Back navigation + title */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate('/available-ot')}>
            <ChevronLeft className="h-4 w-4 mr-1" />
            Back
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-semibold tracking-tight">OT Request</h1>
              <StatusBadge status={request.status} />
            </div>
            <p className="text-sm text-muted-foreground mt-0.5">
              {formatDate(request.date)} &middot; {formatTime(request.start_time)} - {formatTime(request.end_time)}
            </p>
          </div>
        </div>
        {isManager && isOpen && (
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={openEditDialog}>
              Edit
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="text-red-700 hover:bg-red-50"
              onClick={() => setShowCancelRequest(true)}
            >
              Cancel Request
            </Button>
          </div>
        )}
      </div>

      {/* Details card */}
      <Card>
        <CardHeader>
          <CardTitle>Details</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
            <div className="flex items-start gap-2">
              <Clock className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
              <div>
                <dt className="text-muted-foreground">Time</dt>
                <dd className="font-medium">
                  {formatTime(request.start_time)} - {formatTime(request.end_time)} ({request.hours.toFixed(1)}h)
                </dd>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <User className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
              <div>
                <dt className="text-muted-foreground">Classification</dt>
                <dd className="font-medium">{request.classification_name ?? 'Any'}</dd>
              </div>
            </div>
            {request.ot_reason_name && (
              <div className="flex items-start gap-2">
                <FileText className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                <div>
                  <dt className="text-muted-foreground">Reason</dt>
                  <dd className="font-medium">{request.ot_reason_name}</dd>
                </div>
              </div>
            )}
            {request.location && (
              <div className="flex items-start gap-2">
                <MapPin className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                <div>
                  <dt className="text-muted-foreground">Location</dt>
                  <dd className="font-medium">{request.location}</dd>
                </div>
              </div>
            )}
            <div>
              <dt className="text-muted-foreground">Fixed Coverage</dt>
              <dd className="font-medium">{request.is_fixed_coverage ? 'Yes' : 'No'}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Created by</dt>
              <dd className="font-medium">{request.created_by_name}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Created</dt>
              <dd className="font-medium">{formatDateTime(request.created_at)}</dd>
            </div>
          </dl>
          {request.notes && (
            <div className="mt-4 pt-4 border-t">
              <p className="text-sm text-muted-foreground mb-1">Notes</p>
              <p className="text-sm whitespace-pre-wrap">{request.notes}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Assignments section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            Assignments
            <Badge variant="outline" className="ml-1 tabular-nums">
              {activeAssignments.length}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {activeAssignments.length === 0 && cancelledAssignments.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              No assignments yet.
            </p>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Employee</TableHead>
                    <TableHead>OT Type</TableHead>
                    <TableHead>Assigned By</TableHead>
                    <TableHead>Assigned At</TableHead>
                    <TableHead>Status</TableHead>
                    {isManager && <TableHead className="w-[100px]">Actions</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {activeAssignments.map((a) => (
                    <TableRow key={a.id}>
                      <TableCell className="font-medium">{a.user_name}</TableCell>
                      <TableCell>{otTypeLabel(a.ot_type)}</TableCell>
                      <TableCell>{a.assigned_by_name}</TableCell>
                      <TableCell>{formatDateTime(a.assigned_at)}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="bg-green-100 text-green-800 border-green-200 text-xs">
                          Active
                        </Badge>
                      </TableCell>
                      {isManager && (
                        <TableCell>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-red-700 hover:bg-red-50 h-7 px-2"
                            onClick={() => setCancellingAssignment(a)}
                            disabled={cancelAssignmentMut.isPending}
                          >
                            <X className="h-3.5 w-3.5 mr-1" />
                            Cancel
                          </Button>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                  {cancelledAssignments.map((a) => (
                    <TableRow key={a.id} className="opacity-50">
                      <TableCell className="font-medium">{a.user_name}</TableCell>
                      <TableCell>{otTypeLabel(a.ot_type)}</TableCell>
                      <TableCell>{a.assigned_by_name}</TableCell>
                      <TableCell>{formatDateTime(a.assigned_at)}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="bg-slate-100 text-slate-600 border-slate-200 text-xs">
                          Cancelled
                        </Badge>
                      </TableCell>
                      {isManager && <TableCell />}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Volunteers section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            Volunteers
            <Badge variant="outline" className="ml-1 tabular-nums">
              {activeVolunteers.length}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {activeVolunteers.length === 0 && withdrawnVolunteers.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              No volunteers yet.
            </p>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Employee</TableHead>
                    <TableHead>Classification</TableHead>
                    <TableHead>Volunteered At</TableHead>
                    <TableHead>Status</TableHead>
                    {isManager && isOpen && <TableHead className="w-[100px]">Actions</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {activeVolunteers.map((v) => (
                    <TableRow key={v.id}>
                      <TableCell className="font-medium">{v.user_name}</TableCell>
                      <TableCell>{v.classification_name}</TableCell>
                      <TableCell>{formatDateTime(v.volunteered_at)}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="bg-green-100 text-green-800 border-green-200 text-xs">
                          Active
                        </Badge>
                      </TableCell>
                      {isManager && isOpen && (
                        <TableCell>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 px-2"
                            onClick={() => {
                              setAssignOtType('voluntary')
                              setAssigningVolunteer(v)
                            }}
                            disabled={assignMut.isPending}
                          >
                            <UserPlus className="h-3.5 w-3.5 mr-1" />
                            Assign
                          </Button>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                  {withdrawnVolunteers.map((v) => (
                    <TableRow key={v.id} className="opacity-50">
                      <TableCell className="font-medium">{v.user_name}</TableCell>
                      <TableCell>{v.classification_name}</TableCell>
                      <TableCell>{formatDateTime(v.volunteered_at)}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="bg-slate-100 text-slate-600 border-slate-200 text-xs">
                          Withdrawn
                        </Badge>
                      </TableCell>
                      {isManager && isOpen && <TableCell />}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Assign confirmation dialog */}
      <Dialog open={!!assigningVolunteer} onOpenChange={(open) => { if (!open) setAssigningVolunteer(null) }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Assign Employee</DialogTitle>
            <DialogDescription>
              Assign {assigningVolunteer?.user_name} to this OT request.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <FormField label="OT Type" htmlFor="assign-ot-type">
              <select
                id="assign-ot-type"
                className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                value={assignOtType}
                onChange={(e) => setAssignOtType(e.target.value as OtType)}
              >
                <option value="voluntary">Voluntary</option>
                <option value="mandatory">Mandatory</option>
                <option value="fixed_coverage">Fixed Coverage</option>
              </select>
            </FormField>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAssigningVolunteer(null)}>
              Cancel
            </Button>
            <Button onClick={handleAssign} disabled={assignMut.isPending}>
              Assign
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Cancel assignment confirmation */}
      <AlertDialog open={!!cancellingAssignment} onOpenChange={(open) => { if (!open) setCancellingAssignment(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel Assignment</AlertDialogTitle>
            <AlertDialogDescription>
              Remove {cancellingAssignment?.user_name} from this OT request? This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <Button variant="outline" onClick={() => setCancellingAssignment(null)}>
              Keep
            </Button>
            <Button
              variant="destructive"
              onClick={handleCancelAssignment}
              disabled={cancelAssignmentMut.isPending}
            >
              Cancel Assignment
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Cancel request confirmation */}
      <AlertDialog open={showCancelRequest} onOpenChange={setShowCancelRequest}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel OT Request</AlertDialogTitle>
            <AlertDialogDescription>
              Cancel this entire OT request for {formatDate(request.date)}? All assignments will be removed. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <Button variant="outline" onClick={() => setShowCancelRequest(false)}>
              Keep
            </Button>
            <Button
              variant="destructive"
              onClick={handleCancelRequest}
              disabled={cancelMut.isPending}
            >
              Cancel Request
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Edit dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit OT Request</DialogTitle>
            <DialogDescription>Update notes and location for this OT request.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <FormField label="Location" htmlFor="edit-location">
              <Input
                id="edit-location"
                value={editLocation}
                onChange={(e) => setEditLocation(e.target.value)}
                placeholder="Optional location..."
              />
            </FormField>
            <FormField label="Notes" htmlFor="edit-notes">
              <Textarea
                id="edit-notes"
                value={editNotes}
                onChange={(e) => setEditNotes(e.target.value)}
                placeholder="Optional notes..."
                rows={3}
              />
            </FormField>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveEdit} disabled={updateMut.isPending}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

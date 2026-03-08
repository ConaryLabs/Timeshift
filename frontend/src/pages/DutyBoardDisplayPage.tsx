// frontend/src/pages/DutyBoardDisplayPage.tsx
import { useMemo, useEffect, useState } from 'react'
import { format } from 'date-fns'
import { useDutyBoard } from '@/hooks/useDutyBoard'
import { BLOCK_LABELS, getCurrentBlockIndex, buildAssignmentMap } from '@/lib/dutyBoard'

/** Map position name to its row label color from the original seating chart */
function getPositionColor(name: string): { bg: string; text: string } {
  const upper = name.toUpperCase()
  if (upper.startsWith('FIRE'))
    return { bg: '#C00000', text: '#ffffff' }
  if (['DATA', 'AUBURN', 'FED WAY', 'KENT', 'RENTON'].includes(upper))
    return { bg: '#2F75B5', text: '#ffffff' }
  if (upper.includes('BREAK'))
    return { bg: '#548235', text: '#ffffff' }
  if (upper === 'ACCESS')
    return { bg: '#F4B084', text: '#000000' }
  if (upper.startsWith('CR'))
    return { bg: '#F4B084', text: '#000000' }
  // Default fallback
  return { bg: '#2F75B5', text: '#ffffff' }
}

export default function DutyBoardDisplayPage() {
  const [now, setNow] = useState(new Date())
  const dateStr = format(now, 'yyyy-MM-dd')
  const currentBlock = getCurrentBlockIndex(now)

  // Update clock every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 30_000)
    return () => clearInterval(interval)
  }, [])

  // Fetch board with 30s auto-refresh
  const { data: board, isLoading: boardLoading, isError: boardError, refetch } = useDutyBoard(dateStr, { refetchInterval: 30_000 })

  const assignmentMap = useMemo(() => buildAssignmentMap(board?.assignments), [board?.assignments])

  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#ffffff',
        color: '#000000',
        fontFamily: 'Tahoma, "Segoe UI", Arial, sans-serif',
        padding: '12px 16px',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Header */}
      <div style={{ textAlign: 'center', marginBottom: '8px' }}>
        <h1
          style={{
            fontSize: '22px',
            fontWeight: 700,
            letterSpacing: '1px',
            textTransform: 'uppercase',
            margin: 0,
          }}
        >
          Daily Dispatch Seating Assignments
        </h1>
        <div style={{ fontSize: '18px', fontWeight: 600, marginTop: '2px' }}>
          {format(now, 'EEEE, MMMM d, yyyy')}
          <span style={{ marginLeft: '16px', color: '#666666' }}>
            {format(now, 'HH:mm')}
          </span>
        </div>
      </div>

      {/* Grid */}
      {board?.positions.length ? (
        <div style={{ flex: 1, overflow: 'auto' }}>
          <table
            style={{
              width: '100%',
              borderCollapse: 'collapse',
              tableLayout: 'fixed',
            }}
          >
            <thead>
              <tr>
                {/* CONSOLE header cell */}
                <th
                  style={{
                    background: '#000000',
                    color: '#ffffff',
                    fontSize: '17px',
                    fontWeight: 700,
                    padding: '6px 10px',
                    border: '1px solid #000000',
                    textAlign: 'center',
                    width: '120px',
                    minWidth: '120px',
                  }}
                >
                  CONSOLE
                </th>
                {BLOCK_LABELS.map((label, i) => (
                  <th
                    key={i}
                    style={{
                      background: i === currentBlock ? '#5B9BD5' : '#9BC2E6',
                      color: '#000000',
                      fontSize: '15px',
                      fontWeight: 700,
                      padding: '6px 4px',
                      border: '1px solid #ffffff',
                      textAlign: 'center',
                    }}
                  >
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {board.positions.map((position) => {
                const posColor = getPositionColor(position.name)
                return (
                  <tr key={position.id}>
                    {/* Position label */}
                    <td
                      style={{
                        background: posColor.bg,
                        color: posColor.text,
                        fontSize: '17px',
                        fontWeight: 700,
                        padding: '4px 8px',
                        border: '1px solid #333333',
                        textAlign: 'center',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {position.name}
                    </td>
                    {Array.from({ length: 12 }, (_, blockIndex) => {
                      const assignment = assignmentMap.get(
                        `${position.id}:${blockIndex}`
                      )
                      const isOpen = position.open_blocks[blockIndex]
                      const isCurrent = blockIndex === currentBlock

                      // Closed block
                      if (!isOpen) {
                        return (
                          <td
                            key={blockIndex}
                            style={{
                              background: '#D9D9D9',
                              color: '#888888',
                              fontSize: '14px',
                              fontWeight: 700,
                              textAlign: 'center',
                              padding: '4px 2px',
                              border: '1px solid #aaaaaa',
                              ...(isCurrent
                                ? { boxShadow: 'inset 0 0 0 2px #5B9BD5' }
                                : {}),
                            }}
                          >
                            X
                          </td>
                        )
                      }

                      // OT needed
                      if (assignment?.status === 'ot_needed') {
                        return (
                          <td
                            key={blockIndex}
                            style={{
                              background: '#FFC000',
                              color: '#000000',
                              fontSize: '16px',
                              fontWeight: 700,
                              textAlign: 'center',
                              padding: '4px 2px',
                              border: '1px solid #333333',
                              ...(isCurrent
                                ? { boxShadow: 'inset 0 0 0 2px #5B9BD5' }
                                : {}),
                            }}
                          >
                            OT
                          </td>
                        )
                      }

                      // Assigned person
                      if (
                        assignment?.status === 'assigned' &&
                        assignment.user_first_name
                      ) {
                        return (
                          <td
                            key={blockIndex}
                            style={{
                              background: '#ffffff',
                              color: '#000000',
                              fontSize: '16px',
                              fontWeight: 700,
                              textAlign: 'center',
                              padding: '4px 2px',
                              border: '1px solid #333333',
                              ...(isCurrent
                                ? { boxShadow: 'inset 0 0 0 2px #5B9BD5' }
                                : {}),
                            }}
                            title={`${assignment.user_first_name} ${assignment.user_last_name}`}
                          >
                            {assignment.user_first_name}
                          </td>
                        )
                      }

                      // Empty open cell
                      return (
                        <td
                          key={blockIndex}
                          style={{
                            background: '#ffffff',
                            color: '#000000',
                            fontSize: '16px',
                            fontWeight: 700,
                            textAlign: 'center',
                            padding: '4px 2px',
                            border: '1px solid #cccccc',
                            ...(isCurrent
                              ? { boxShadow: 'inset 0 0 0 2px #5B9BD5' }
                              : {}),
                          }}
                        >
                          &nbsp;
                        </td>
                      )
                    })}
                  </tr>
                )
              })}
            </tbody>
            {/* Bottom header row (mirror of top, like original) */}
            <tfoot>
              <tr>
                <td
                  style={{
                    background: '#000000',
                    color: '#ffffff',
                    fontSize: '17px',
                    fontWeight: 700,
                    padding: '6px 10px',
                    border: '1px solid #000000',
                    textAlign: 'center',
                  }}
                >
                  CONSOLE
                </td>
                {BLOCK_LABELS.map((label, i) => (
                  <td
                    key={i}
                    style={{
                      background: i === currentBlock ? '#5B9BD5' : '#9BC2E6',
                      color: '#000000',
                      fontSize: '15px',
                      fontWeight: 700,
                      padding: '6px 4px',
                      border: '1px solid #ffffff',
                      textAlign: 'center',
                    }}
                  >
                    {label}
                  </td>
                ))}
              </tr>
            </tfoot>
          </table>
        </div>
      ) : boardError ? (
        <div
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '12px',
          }}
        >
          <div
            style={{
              color: '#C00000',
              fontSize: '24px',
              fontWeight: 700,
            }}
          >
            Failed to load duty board
          </div>
          <div style={{ color: '#666666', fontSize: '16px' }}>
            Auto-retry in 30 seconds
          </div>
          <button
            type="button"
            onClick={() => refetch()}
            style={{
              padding: '8px 24px',
              fontSize: '16px',
              fontWeight: 600,
              background: '#2F75B5',
              color: '#ffffff',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
            }}
          >
            Retry Now
          </button>
        </div>
      ) : (
        <div
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#888888',
            fontSize: '20px',
          }}
        >
          {boardLoading ? 'Loading duty board...' : 'No duty positions configured'}
        </div>
      )}
    </div>
  )
}

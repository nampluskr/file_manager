import { useEffect, useState } from 'react'
import type { ReactElement } from 'react'

type PingStatus =
  | { kind: 'pending' }
  | { kind: 'success'; message: string }
  | { kind: 'error'; message: string }

export function App(): ReactElement {
  const [pingStatus, setPingStatus] = useState<PingStatus>({ kind: 'pending' })

  useEffect(() => {
    window.fileManager
      .ping()
      .then((result) => setPingStatus({ kind: 'success', message: result.message }))
      .catch((error: unknown) => {
        const message = error instanceof Error ? error.message : 'Unknown IPC error.'
        setPingStatus({ kind: 'error', message })
      })
  }, [])

  return (
    <div className="app-shell">
      <h1>Personal File Manager</h1>
      <p>Phase 0: project scaffolding.</p>
      <p>IPC round trip: {pingStatus.kind === 'pending' ? 'checking...' : pingStatus.message}</p>
    </div>
  )
}

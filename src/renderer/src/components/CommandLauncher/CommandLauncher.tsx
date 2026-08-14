import { useCallback, useEffect, useRef, useState } from 'react'
import type { FocusEvent, KeyboardEvent, ReactElement } from 'react'
import type { PresetId } from '../../../../shared/ipc'

const PRESETS: readonly { key: string; id: PresetId; label: string }[] = [
  { key: '1', id: 'cmd', label: 'cmd' },
  { key: '2', id: 'claude', label: 'claude' },
  { key: '3', id: 'codex', label: 'codex' },
  { key: '4', id: 'agy', label: 'agy' },
  { key: '5', id: 'code', label: 'code .' }
]

type CommandLauncherProps = {
  cwd: string
  focused: boolean
  onBlur: () => void
}

export function CommandLauncher({ cwd, focused, onBlur }: CommandLauncherProps): ReactElement {
  const [error, setError] = useState<string | null>(null)
  const launcherRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (focused) launcherRef.current?.focus()
  }, [focused])

  const launch = useCallback(
    (preset: PresetId) => {
      setError(null)
      void window.fileManager.launch(preset, cwd).then((result) => {
        if (!result.ok) setError(result.failed[0]?.message ?? 'Failed to start the command.')
      }).catch((reason: unknown) => {
        setError(reason instanceof Error ? reason.message : 'Failed to start the command.')
      })
    },
    [cwd]
  )

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    const preset = PRESETS.find((item) => item.key === event.key)
    if (!preset) return
    event.preventDefault()
    launch(preset.id)
  }

  const handleBlur = (event: FocusEvent<HTMLDivElement>): void => {
    if (!event.currentTarget.contains(event.relatedTarget)) onBlur()
  }

  return (
    <div
      ref={launcherRef}
      className={`command-launcher${focused ? ' command-launcher-focused' : ''}`}
      tabIndex={focused ? 0 : -1}
      onKeyDown={handleKeyDown}
      onBlur={handleBlur}
    >
      <div className="command-launcher-buttons">
        {PRESETS.map((preset) => (
          <button key={preset.id} type="button" onClick={() => launch(preset.id)}>
            <kbd>{preset.key}</kbd> {preset.label}
          </button>
        ))}
      </div>
      {error ? <div className="command-launcher-error">{error}</div> : null}
    </div>
  )
}

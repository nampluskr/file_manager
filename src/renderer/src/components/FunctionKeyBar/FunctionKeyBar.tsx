import type { ReactElement } from 'react'

// SPEC.md §3.1/§3.7, §16.4: static hint bar for the file-operation keys.
const HINTS: readonly [key: string, label: string][] = [
  ['F2', 'Rename'],
  ['F3', 'View'],
  ['F4', 'Edit'],
  ['F5', 'Copy'],
  ['F6', 'Move'],
  ['F7', 'New'],
  ['F8', 'Delete']
]

export function FunctionKeyBar(): ReactElement {
  return (
    <div className="function-key-bar">
      {HINTS.map(([key, label]) => (
        <span className="function-key-hint" key={key}>
          <kbd>{key}</kbd> {label}
        </span>
      ))}
    </div>
  )
}

import type { ReactElement } from 'react'
import { formatCapacity } from '../../state/format'

// SPEC.md §3.2: "D: [109.3 G / 236.7 G]". Capacity is left blank until it
// arrives -- never a stale value from a previous drive (§10.3).
type DriveBarProps = {
  letter: string
  usage: { free: number; total: number } | null
}

export function DriveBar({ letter, usage }: DriveBarProps): ReactElement {
  const capacity = usage ? `[${formatCapacity(usage.free)} / ${formatCapacity(usage.total)}]` : ''
  return (
    <div className="drive-bar">
      {letter ? `${letter}:` : ''} {capacity}
    </div>
  )
}

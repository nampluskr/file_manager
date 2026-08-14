// Pure focus-restoration rules (SPEC.md §4.4).

import type { FileEntry } from '../../../shared/types'

export type FocusIntent =
  | { mode: 'first' } // entering a new path: focus the first item after "[..]"
  | { mode: 'parentOf'; name: string } // came up via Backspace/[..]: focus the folder just left
  | { mode: 'byName'; name: string; previousIndex: number } // refresh: match by name, else same index, else last

export function resolveFocusIndex(entries: FileEntry[], intent: FocusIntent): number {
  if (entries.length === 0) return 0

  if (intent.mode === 'first') {
    const firstNonParent = entries.findIndex((entry) => !entry.isParent)
    return firstNonParent >= 0 ? firstNonParent : 0
  }

  const target = intent.name.toLowerCase()
  const matchIndex = entries.findIndex((entry) => entry.name.toLowerCase() === target)
  if (matchIndex >= 0) return matchIndex

  if (intent.mode === 'byName') {
    return Math.min(intent.previousIndex, entries.length - 1)
  }

  return 0
}

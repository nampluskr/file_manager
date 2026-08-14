// Pure entry sorting (SPEC.md §4.5). Directories and files are sorted
// independently, then directories are placed before files -- the "[..]"
// pseudo-entry is handled separately by the caller (see paneReducer.ts),
// since it is always pinned first regardless of sort key.

import type { FileEntry, SortKey } from '../../../shared/types'

function tokenize(value: string): (string | number)[] {
  const tokens: (string | number)[] = []
  const pattern = /(\d+)|(\D+)/g
  let match: RegExpExecArray | null
  while ((match = pattern.exec(value)) !== null) {
    tokens.push(match[1] !== undefined ? Number(match[1]) : match[2])
  }
  return tokens
}

// Case-insensitive natural comparator: "file2" sorts before "file10".
export function naturalCompare(a: string, b: string): number {
  const left = tokenize(a.toLowerCase())
  const right = tokenize(b.toLowerCase())
  const length = Math.min(left.length, right.length)

  for (let i = 0; i < length; i++) {
    const leftToken = left[i]
    const rightToken = right[i]
    if (typeof leftToken === 'number' && typeof rightToken === 'number') {
      if (leftToken !== rightToken) return leftToken - rightToken
    } else {
      const leftText = String(leftToken)
      const rightText = String(rightToken)
      if (leftText !== rightText) return leftText < rightText ? -1 : 1
    }
  }

  return left.length - right.length
}

function compareByKey(a: FileEntry, b: FileEntry, sortKey: SortKey): number {
  switch (sortKey) {
    case 'name':
      return naturalCompare(a.name, b.name)
    case 'ext': {
      const extResult = naturalCompare(a.ext, b.ext)
      return extResult !== 0 ? extResult : naturalCompare(a.name, b.name)
    }
    case 'size':
      return a.size - b.size
    case 'mtime':
      return a.mtime - b.mtime
  }
}

export function sortEntries(entries: FileEntry[], sortKey: SortKey, sortAsc: boolean): FileEntry[] {
  const direction = sortAsc ? 1 : -1
  const comparator = (a: FileEntry, b: FileEntry): number => compareByKey(a, b, sortKey) * direction

  const directories = entries.filter((entry) => entry.isDirectory).sort(comparator)
  const files = entries.filter((entry) => !entry.isDirectory).sort(comparator)

  return [...directories, ...files]
}

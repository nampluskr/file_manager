// Pure entry sorting (SPEC.md §4.5). Directories and files are sorted
// independently, then directories are placed before files -- the "[..]"
// pseudo-entry is handled separately by the caller (see paneReducer.ts),
// since it is always pinned first regardless of sort key.

import type { FileEntry, SortKey } from '../../../shared/types'

type Token = { kind: 'digits'; raw: string } | { kind: 'text'; raw: string }

function tokenize(value: string): Token[] {
  const tokens: Token[] = []
  const pattern = /(\d+)|(\D+)/g
  let match: RegExpExecArray | null
  while ((match = pattern.exec(value)) !== null) {
    tokens.push(match[1] !== undefined ? { kind: 'digits', raw: match[1] } : { kind: 'text', raw: match[2] })
  }
  return tokens
}

// Compares digit runs as arbitrary-precision magnitudes (string length,
// then lexicographically) instead of `Number()`, which loses precision
// past Number.MAX_SAFE_INTEGER and would treat distinct long numeric
// names as equal.
function compareDigits(a: string, b: string): number {
  const trimmedA = a.replace(/^0+(?=\d)/, '')
  const trimmedB = b.replace(/^0+(?=\d)/, '')
  if (trimmedA.length !== trimmedB.length) return trimmedA.length - trimmedB.length
  if (trimmedA !== trimmedB) return trimmedA < trimmedB ? -1 : 1
  return a.length - b.length // fewer leading zeros sorts first as a tiebreak
}

// Case-insensitive natural comparator: "file2" sorts before "file10".
export function naturalCompare(a: string, b: string): number {
  const left = tokenize(a.toLowerCase())
  const right = tokenize(b.toLowerCase())
  const length = Math.min(left.length, right.length)

  for (let i = 0; i < length; i++) {
    const leftToken = left[i]
    const rightToken = right[i]
    if (leftToken.kind === 'digits' && rightToken.kind === 'digits') {
      const result = compareDigits(leftToken.raw, rightToken.raw)
      if (result !== 0) return result
    } else if (leftToken.raw !== rightToken.raw) {
      return leftToken.raw < rightToken.raw ? -1 : 1
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

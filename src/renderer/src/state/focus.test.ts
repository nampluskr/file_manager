import { describe, expect, it } from 'vitest'
import type { FileEntry } from '../../../shared/types'
import { resolveFocusIndex } from './focus'

function makeEntry(name: string, isParent = false): FileEntry {
  return { name, ext: '', size: 0, mtime: 0, isDirectory: true, isSymlink: false, isParent }
}

describe('resolveFocusIndex', () => {
  it('returns 0 for an empty entry list', () => {
    expect(resolveFocusIndex([], { mode: 'first' })).toBe(0)
  })

  it('"first" skips the "[..]" pseudo-entry', () => {
    const entries = [makeEntry('..', true), makeEntry('a'), makeEntry('b')]
    expect(resolveFocusIndex(entries, { mode: 'first' })).toBe(1)
  })

  it('"first" with no parent entry focuses index 0', () => {
    const entries = [makeEntry('a'), makeEntry('b')]
    expect(resolveFocusIndex(entries, { mode: 'first' })).toBe(0)
  })

  it('"parentOf" focuses the entry matching the folder just left, case-insensitively', () => {
    const entries = [makeEntry('..', true), makeEntry('Docs'), makeEntry('src')]
    expect(resolveFocusIndex(entries, { mode: 'parentOf', name: 'docs' })).toBe(1)
  })

  it('"parentOf" falls back to the first item when the folder no longer exists', () => {
    const entries = [makeEntry('..', true), makeEntry('src')]
    expect(resolveFocusIndex(entries, { mode: 'parentOf', name: 'gone' })).toBe(0)
  })

  it('"byName" matches by name when present', () => {
    const entries = [makeEntry('a'), makeEntry('b'), makeEntry('c')]
    expect(resolveFocusIndex(entries, { mode: 'byName', name: 'b', previousIndex: 0 })).toBe(1)
  })

  it('"byName" falls back to the same index when the name is gone', () => {
    const entries = [makeEntry('a'), makeEntry('b'), makeEntry('c')]
    expect(resolveFocusIndex(entries, { mode: 'byName', name: 'deleted', previousIndex: 1 })).toBe(1)
  })

  it('"byName" clamps to the last item when the previous index is now out of range', () => {
    const entries = [makeEntry('a')]
    expect(resolveFocusIndex(entries, { mode: 'byName', name: 'deleted', previousIndex: 5 })).toBe(0)
  })
})

import { describe, expect, it } from 'vitest'
import type { FileEntry } from '../../../shared/types'
import { naturalCompare, sortEntries } from './sortEntries'

function makeEntry(overrides: Partial<FileEntry>): FileEntry {
  return {
    name: 'name',
    ext: '',
    size: 0,
    mtime: 0,
    isDirectory: false,
    isSymlink: false,
    isParent: false,
    ...overrides
  }
}

describe('naturalCompare', () => {
  it('orders numeric suffixes numerically, not lexically', () => {
    expect(naturalCompare('file2.txt', 'file10.txt')).toBeLessThan(0)
  })

  it('is case-insensitive', () => {
    expect(naturalCompare('README.md', 'readme.md')).toBe(0)
  })

  it('compares names that are entirely numeric', () => {
    expect(naturalCompare('20', '100')).toBeLessThan(0)
  })

  it('compares dotfiles without special-casing the leading dot', () => {
    expect(naturalCompare('.gitignore', 'app.ts')).toBeLessThan(0)
  })

  it('treats a shorter prefix as smaller when tokens otherwise match', () => {
    expect(naturalCompare('file', 'file2')).toBeLessThan(0)
  })
})

describe('sortEntries', () => {
  it('always places directories before files regardless of sort key', () => {
    const entries = [
      makeEntry({ name: 'z-file.txt', isDirectory: false, size: 1 }),
      makeEntry({ name: 'a-dir', isDirectory: true, size: 0 })
    ]
    const sorted = sortEntries(entries, 'size', true)
    expect(sorted.map((entry) => entry.name)).toEqual(['a-dir', 'z-file.txt'])
  })

  it('sorts by name using natural order within each group', () => {
    const entries = [
      makeEntry({ name: 'file10.txt' }),
      makeEntry({ name: 'file2.txt' }),
      makeEntry({ name: 'File1.txt' })
    ]
    const sorted = sortEntries(entries, 'name', true)
    expect(sorted.map((entry) => entry.name)).toEqual(['File1.txt', 'file2.txt', 'file10.txt'])
  })

  it('reverses order when sortAsc is false', () => {
    const entries = [makeEntry({ name: 'a' }), makeEntry({ name: 'b' })]
    const sorted = sortEntries(entries, 'name', false)
    expect(sorted.map((entry) => entry.name)).toEqual(['b', 'a'])
  })

  it('breaks extension ties by name', () => {
    const entries = [
      makeEntry({ name: 'b.txt', ext: 'txt' }),
      makeEntry({ name: 'a.txt', ext: 'txt' })
    ]
    const sorted = sortEntries(entries, 'ext', true)
    expect(sorted.map((entry) => entry.name)).toEqual(['a.txt', 'b.txt'])
  })
})

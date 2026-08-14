import { describe, expect, it } from 'vitest'
import type { FileEntry } from '../../../shared/types'
import { computeStatusSummary } from './statusSummary'

function makeFile(name: string, size: number): FileEntry {
  return { name, ext: '', size, mtime: 0, isDirectory: false, isSymlink: false, isParent: false }
}
function makeDir(name: string): FileEntry {
  return { name, ext: '', size: 0, mtime: 0, isDirectory: true, isSymlink: false, isParent: false }
}
const PARENT: FileEntry = { name: '..', ext: '', size: 0, mtime: 0, isDirectory: true, isSymlink: false, isParent: true }

describe('computeStatusSummary', () => {
  it('sums selected/total size and counts, excluding folders from size and "[..]" from everything', () => {
    const entries = [PARENT, makeDir('docs'), makeFile('a.txt', 100), makeFile('b.txt', 200)]
    const summary = computeStatusSummary(entries, new Set(['a.txt']))
    expect(summary).toEqual({
      selectedSize: 100,
      totalSize: 300,
      selectedFileCount: 1,
      totalFileCount: 2,
      selectedFolderCount: 0,
      totalFolderCount: 1
    })
  })

  it('counts selected folders without adding to size totals', () => {
    const entries = [makeDir('docs'), makeDir('src')]
    const summary = computeStatusSummary(entries, new Set(['docs']))
    expect(summary.selectedFolderCount).toBe(1)
    expect(summary.selectedSize).toBe(0)
  })

  it('returns all zeros for an empty directory', () => {
    const summary = computeStatusSummary([], new Set())
    expect(summary.totalFileCount).toBe(0)
    expect(summary.totalFolderCount).toBe(0)
  })
})

import { describe, expect, it } from 'vitest'
import type { FileEntry } from '../../../shared/types'
import { createInitialPaneState, paneReducer } from './paneReducer'

function makeFile(name: string, overrides: Partial<FileEntry> = {}): FileEntry {
  return { name, ext: '', size: 0, mtime: 0, isDirectory: false, isSymlink: false, isParent: false, ...overrides }
}

function makeDir(name: string, overrides: Partial<FileEntry> = {}): FileEntry {
  return { ...makeFile(name, overrides), isDirectory: true }
}

describe('paneReducer', () => {
  it('starts loading with no entries', () => {
    const state = createInitialPaneState('C:\\Users\\nampl')
    expect(state.isLoading).toBe(true)
    expect(state.entries).toEqual([])
  })

  it('loadSuccess prepends "[..]" when the path is not a drive root', () => {
    const state = createInitialPaneState('C:\\Users\\nampl')
    const next = paneReducer(state, {
      type: 'loadSuccess',
      path: 'C:\\Users\\nampl',
      rawEntries: [makeDir('docs'), makeFile('a.txt')],
      focus: { mode: 'first' }
    })
    expect(next.entries[0]).toMatchObject({ name: '..', isParent: true })
    expect(next.focusedIndex).toBe(1) // "first" skips "[..]"
    expect(next.isLoading).toBe(false)
  })

  it('loadSuccess omits "[..]" at a drive root', () => {
    const state = createInitialPaneState('C:\\')
    const next = paneReducer(state, {
      type: 'loadSuccess',
      path: 'C:\\',
      rawEntries: [makeDir('Users')],
      focus: { mode: 'first' }
    })
    expect(next.entries.some((entry) => entry.isParent)).toBe(false)
    expect(next.focusedIndex).toBe(0)
  })

  it('loadSuccess with parentOf focuses the folder just left', () => {
    const state = createInitialPaneState('C:\\Users\\nampl\\docs')
    const next = paneReducer(state, {
      type: 'loadSuccess',
      path: 'C:\\Users\\nampl',
      rawEntries: [makeDir('docs'), makeDir('src')],
      focus: { mode: 'parentOf', name: 'docs' }
    })
    expect(next.entries[next.focusedIndex]).toMatchObject({ name: 'docs' })
  })

  it('loadError keeps previous entries but records the message', () => {
    let state = createInitialPaneState('C:\\Users\\nampl')
    state = paneReducer(state, {
      type: 'loadSuccess',
      path: 'C:\\Users\\nampl',
      rawEntries: [makeDir('docs')],
      focus: { mode: 'first' }
    })
    const next = paneReducer(state, { type: 'loadError', message: '접근이 거부되었습니다' })
    expect(next.error).toBe('접근이 거부되었습니다')
    expect(next.isLoading).toBe(false)
    expect(next.entries).toBe(state.entries)
  })

  it('preserves the current view state when a swapped pane refreshes', () => {
    let state = createInitialPaneState('C:\\')
    state = paneReducer(state, {
      type: 'loadSuccess',
      path: 'C:\\',
      rawEntries: [makeDir('a'), makeDir('b')],
      focus: { mode: 'first' }
    })
    state = { ...state, selectedNames: new Set(['b']), scrollTop: 22 }

    const refreshed = paneReducer(state, {
      type: 'loadSuccess',
      path: 'C:\\',
      rawEntries: [makeDir('a'), makeDir('b')],
      focus: { mode: 'byName', name: 'b', previousIndex: 1 },
      preserveView: true
    })

    expect(refreshed.selectedNames).toEqual(new Set(['b']))
    expect(refreshed.scrollTop).toBe(22)
    expect(refreshed.entries[refreshed.focusedIndex]).toMatchObject({ name: 'b' })
  })

  it('moveFocus clamps at the list boundaries without wrapping', () => {
    let state = createInitialPaneState('C:\\')
    state = paneReducer(state, {
      type: 'loadSuccess',
      path: 'C:\\',
      rawEntries: [makeDir('a'), makeDir('b')],
      focus: { mode: 'first' }
    })
    const belowStart = paneReducer(state, { type: 'moveFocus', delta: -5 })
    expect(belowStart.focusedIndex).toBe(0)
    const pastEnd = paneReducer(state, { type: 'moveFocus', delta: 5 })
    expect(pastEnd.focusedIndex).toBe(1)
  })

  it('setSort toggles direction on the same key and resets to ascending on a new key', () => {
    let state = createInitialPaneState('C:\\');
    state = paneReducer(state, {
      type: 'loadSuccess',
      path: 'C:\\',
      rawEntries: [makeDir('b'), makeDir('a')],
      focus: { mode: 'first' }
    })
    expect(state.entries.map((entry) => entry.name)).toEqual(['a', 'b'])

    const toggled = paneReducer(state, { type: 'setSort', key: 'name' })
    expect(toggled.sortAsc).toBe(false)
    expect(toggled.entries.map((entry) => entry.name)).toEqual(['b', 'a'])

    const newKey = paneReducer(toggled, { type: 'setSort', key: 'size' })
    expect(newKey.sortAsc).toBe(true)
  })

  it('setSort keeps focus on the same entry by name after re-sorting', () => {
    let state = createInitialPaneState('C:\\')
    state = paneReducer(state, {
      type: 'loadSuccess',
      path: 'C:\\',
      rawEntries: [makeDir('a'), makeDir('b'), makeDir('c')],
      focus: { mode: 'first' }
    })
    const focusedOnB = paneReducer(state, { type: 'setFocusedIndex', index: 1 })
    expect(focusedOnB.entries[focusedOnB.focusedIndex].name).toBe('b')

    const resorted = paneReducer(focusedOnB, { type: 'setSort', key: 'name' }) // now descending: c, b, a
    expect(resorted.entries[resorted.focusedIndex].name).toBe('b')
  })
})

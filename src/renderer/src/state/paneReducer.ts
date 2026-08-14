import type { FileEntry, PaneState, SortKey } from '../../../shared/types'
import type { FocusIntent } from './focus'
import { resolveFocusIndex } from './focus'
import { getParentPath } from './pathHelpers'
import { sortEntries } from './sortEntries'

export type PaneAction =
  | { type: 'loadStart' }
  | { type: 'loadSuccess'; path: string; rawEntries: FileEntry[]; focus: FocusIntent }
  | { type: 'loadError'; message: string }
  | { type: 'setFocusedIndex'; index: number }
  | { type: 'moveFocus'; delta: number }
  | { type: 'moveFocusToEdge'; edge: 'home' | 'end' }
  | { type: 'setSort'; key: SortKey }
  | { type: 'setScrollTop'; value: number }

// "[..]" is a synthetic entry, not something listDirectory returns -- see
// SPEC.md §4.2 (always pinned first) and §7.1 (isParent flag).
const PARENT_ENTRY: FileEntry = {
  name: '..',
  ext: '',
  size: 0,
  mtime: 0,
  isDirectory: true,
  isSymlink: false,
  isParent: true
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

function buildDisplayEntries(rawEntries: FileEntry[], path: string, sortKey: SortKey, sortAsc: boolean): FileEntry[] {
  const sorted = sortEntries(rawEntries, sortKey, sortAsc)
  return getParentPath(path) === null ? sorted : [PARENT_ENTRY, ...sorted]
}

export function createInitialPaneState(path: string): PaneState {
  return {
    currentPath: path,
    entries: [],
    focusedIndex: 0,
    selectedNames: new Set(),
    scrollTop: 0,
    sortKey: 'name',
    sortAsc: true,
    isLoading: true,
    error: null
  }
}

export function paneReducer(state: PaneState, action: PaneAction): PaneState {
  switch (action.type) {
    case 'loadStart':
      return { ...state, isLoading: true, error: null }

    case 'loadSuccess': {
      const entries = buildDisplayEntries(action.rawEntries, action.path, state.sortKey, state.sortAsc)
      return {
        ...state,
        currentPath: action.path,
        entries,
        isLoading: false,
        error: null,
        selectedNames: new Set(),
        scrollTop: 0,
        focusedIndex: resolveFocusIndex(entries, action.focus)
      }
    }

    case 'loadError':
      return { ...state, isLoading: false, error: action.message }

    case 'setFocusedIndex':
      return { ...state, focusedIndex: clamp(action.index, 0, Math.max(state.entries.length - 1, 0)) }

    case 'moveFocus': {
      if (state.entries.length === 0) return state
      return { ...state, focusedIndex: clamp(state.focusedIndex + action.delta, 0, state.entries.length - 1) }
    }

    case 'moveFocusToEdge': {
      if (state.entries.length === 0) return state
      return { ...state, focusedIndex: action.edge === 'home' ? 0 : state.entries.length - 1 }
    }

    case 'setSort': {
      const sortAsc = state.sortKey === action.key ? !state.sortAsc : true
      const rawEntries = state.entries.filter((entry) => !entry.isParent)
      const entries = buildDisplayEntries(rawEntries, state.currentPath, action.key, sortAsc)
      const focusedName = state.entries[state.focusedIndex]?.name
      const focus: FocusIntent = focusedName
        ? { mode: 'byName', name: focusedName, previousIndex: state.focusedIndex }
        : { mode: 'first' }
      return {
        ...state,
        sortKey: action.key,
        sortAsc,
        entries,
        focusedIndex: resolveFocusIndex(entries, focus)
      }
    }

    case 'setScrollTop':
      return { ...state, scrollTop: action.value }
  }
}

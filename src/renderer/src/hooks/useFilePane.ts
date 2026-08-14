import { useCallback, useEffect, useReducer, useRef } from 'react'
import type { SortKey } from '../../../shared/types'
import type { FocusIntent } from '../state/focus'
import { createInitialPaneState, paneReducer } from '../state/paneReducer'
import { getParentPath, joinPath, lastSegment } from '../state/pathHelpers'

const TYPE_AHEAD_RESET_MS = 1000

export function useFilePane(initialPath: string) {
  const [state, dispatch] = useReducer(paneReducer, initialPath, createInitialPaneState)
  const typeAheadBufferRef = useRef('')
  const typeAheadTimerRef = useRef<number | null>(null)

  const navigate = useCallback((path: string, focus: FocusIntent) => {
    dispatch({ type: 'loadStart' })
    window.fileManager
      .listDirectory(path)
      .then((result) => dispatch({ type: 'loadSuccess', path: result.path, rawEntries: result.entries, focus }))
      .catch((error: unknown) => {
        const message = error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다'
        dispatch({ type: 'loadError', message })
      })
  }, [])

  useEffect(() => {
    navigate(initialPath, { mode: 'first' })
    // Only run once on mount; `navigate` and `initialPath` are stable for the pane's lifetime.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const goToParent = useCallback(() => {
    const parent = getParentPath(state.currentPath)
    if (!parent) return
    navigate(parent, { mode: 'parentOf', name: lastSegment(state.currentPath) })
  }, [state.currentPath, navigate])

  const activateFocused = useCallback(() => {
    const focused = state.entries[state.focusedIndex]
    if (!focused) return

    if (focused.isParent) {
      goToParent()
      return
    }
    if (focused.isDirectory) {
      navigate(joinPath(state.currentPath, focused.name), { mode: 'first' })
      return
    }
    void window.fileManager.openPath(joinPath(state.currentPath, focused.name))
  }, [state.entries, state.focusedIndex, state.currentPath, navigate, goToParent])

  const moveFocus = useCallback((delta: number) => dispatch({ type: 'moveFocus', delta }), [])
  const moveFocusToEdge = useCallback((edge: 'home' | 'end') => dispatch({ type: 'moveFocusToEdge', edge }), [])
  const setSort = useCallback((key: SortKey) => dispatch({ type: 'setSort', key }), [])
  const setScrollTop = useCallback((value: number) => dispatch({ type: 'setScrollTop', value }), [])

  const typeAhead = useCallback(
    (char: string) => {
      if (typeAheadTimerRef.current !== null) window.clearTimeout(typeAheadTimerRef.current)

      const candidateBuffer = typeAheadBufferRef.current + char.toLowerCase()
      const matchIndex = state.entries.findIndex(
        (entry) => !entry.isParent && entry.name.toLowerCase().startsWith(candidateBuffer)
      )

      if (matchIndex >= 0) {
        typeAheadBufferRef.current = candidateBuffer
        dispatch({ type: 'setFocusedIndex', index: matchIndex })
      }
      // No match: buffer is left unchanged (SPEC.md §4.6 -- do not accumulate on a miss).

      typeAheadTimerRef.current = window.setTimeout(() => {
        typeAheadBufferRef.current = ''
      }, TYPE_AHEAD_RESET_MS)
    },
    [state.entries]
  )

  return { state, moveFocus, moveFocusToEdge, activateFocused, goToParent, setSort, setScrollTop, typeAhead }
}

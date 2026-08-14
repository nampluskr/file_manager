import { useEffect, useRef, useState } from 'react'
import type { KeyboardEvent, ReactElement } from 'react'
import type { PaneState, SortKey } from '../../../../shared/types'
import { useFilePane } from '../../hooks/useFilePane'
import { FileList } from '../FileList/FileList'
import { PathBar } from '../PathBar/PathBar'
import { CommandLauncher } from '../CommandLauncher/CommandLauncher'
import { joinPath } from '../../state/pathHelpers'

const PRINTABLE_KEY_PATTERN = /^[\p{L}\p{N}]$/u

const SORT_KEY_BY_FUNCTION_KEY: Record<string, 'name' | 'ext' | 'mtime' | 'size'> = {
  F3: 'name',
  F4: 'ext',
  F5: 'mtime',
  F6: 'size'
}

type FilePaneProps = {
  initialPath: string
  initialSortKey: SortKey
  initialSortAsc: boolean
  overlayOpen: boolean
  onView: (path: string) => void
  onEdit: (path: string) => void
  onStateChange: (state: PaneState) => void
  favorites: { key: number; label: string; path: string }[]
}

export function FilePane({ initialPath, initialSortKey, initialSortAsc, overlayOpen, onView, onEdit, onStateChange, favorites }: FilePaneProps): ReactElement {
  const { state, moveFocus, moveFocusToEdge, activateFocused, goToParent, goToPath, setSort, setScrollTop, typeAhead, refresh } =
    useFilePane(initialPath, initialSortKey, initialSortAsc)
  const [pageSize, setPageSize] = useState(10)
  const [launcherFocused, setLauncherFocused] = useState(false)
  const [favoritesOpen, setFavoritesOpen] = useState(false)
  const [favoriteIndex, setFavoriteIndex] = useState(0)
  const paneRef = useRef<HTMLDivElement>(null)

  // Without this, Arrow/Enter/Backspace do nothing until the user clicks
  // the pane or tabs into it (SPEC.md §4.3 expects them to work immediately).
  useEffect(() => {
    paneRef.current?.focus()
  }, [])

  useEffect(() => onStateChange(state), [onStateChange, state])

  useEffect(() => {
    const refreshOnFocus = (): void => refresh()
    window.addEventListener('focus', refreshOnFocus)
    return () => window.removeEventListener('focus', refreshOnFocus)
  }, [refresh])

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    if (overlayOpen) return
    if (favoritesOpen) {
      event.preventDefault()
      if (event.key === 'Escape') {
        setFavoritesOpen(false)
      } else if (event.key === 'ArrowDown' && favorites.length > 0) {
        setFavoriteIndex((index) => Math.min(index + 1, favorites.length - 1))
      } else if (event.key === 'ArrowUp' && favorites.length > 0) {
        setFavoriteIndex((index) => Math.max(index - 1, 0))
      } else if (event.key === 'Enter') {
        const favorite = favorites[favoriteIndex]
        if (favorite) {
          goToPath(favorite.path)
          setFavoritesOpen(false)
        }
      }
      return
    }
    if (event.ctrlKey) {
      if (event.key.toLowerCase() === 'l') {
        event.preventDefault()
        setLauncherFocused(true)
        return
      }
      if (event.key.toLowerCase() === 't') {
        event.preventDefault()
        void window.fileManager.launch('cmd', state.currentPath)
        return
      }
      if (event.key.toLowerCase() === 'e') {
        event.preventDefault()
        void window.fileManager.launch('code', state.currentPath)
        return
      }
      if (event.key.toLowerCase() === 'r') {
        event.preventDefault()
        refresh()
        return
      }
      if (event.key.toLowerCase() === 'd') {
        event.preventDefault()
        setFavoriteIndex(0)
        setFavoritesOpen(true)
        return
      }
      const favoriteKey = Number(event.key)
      if (favoriteKey >= 1 && favoriteKey <= 9) {
        event.preventDefault()
        const favorite = favorites.find((item) => item.key === favoriteKey)
        if (favorite) goToPath(favorite.path)
        return
      }
      const sortKey = SORT_KEY_BY_FUNCTION_KEY[event.key]
      if (sortKey) {
        event.preventDefault()
        setSort(sortKey)
      }
      return
    }

    if (launcherFocused) return

    switch (event.key) {
      case 'F3': {
        const focused = state.entries[state.focusedIndex]
        if (!focused || focused.isDirectory || focused.isParent) return
        event.preventDefault()
        onView(joinPath(state.currentPath, focused.name))
        return
      }
      case 'F4': {
        const focused = state.entries[state.focusedIndex]
        if (!focused || focused.isDirectory || focused.isParent) return
        event.preventDefault()
        onEdit(joinPath(state.currentPath, focused.name))
        return
      }
      case 'ArrowDown':
        event.preventDefault()
        moveFocus(1)
        return
      case 'ArrowUp':
        event.preventDefault()
        moveFocus(-1)
        return
      case 'PageDown':
        event.preventDefault()
        moveFocus(pageSize)
        return
      case 'PageUp':
        event.preventDefault()
        moveFocus(-pageSize)
        return
      case 'Home':
        event.preventDefault()
        moveFocusToEdge('home')
        return
      case 'End':
        event.preventDefault()
        moveFocusToEdge('end')
        return
      case 'Enter':
        event.preventDefault()
        activateFocused()
        return
      case 'Backspace':
        event.preventDefault()
        goToParent()
        return
      default:
        if (event.key.length === 1 && PRINTABLE_KEY_PATTERN.test(event.key)) {
          typeAhead(event.key)
        }
    }
  }


  return (
    <div
      ref={paneRef}
      className="file-pane"
      tabIndex={0}
      onKeyDown={handleKeyDown}
      onFocus={(event) => {
        if (event.target === event.currentTarget) setLauncherFocused(false)
      }}
    >
      <PathBar path={state.currentPath} />
      <div className="file-list-header">
        <span className="file-row-cell file-row-name">이름</span>
        <span className="file-row-cell file-row-ext">확장자</span>
        <span className="file-row-cell file-row-size">크기</span>
        <span className="file-row-cell file-row-date">날짜</span>
      </div>
      {state.error ? <div className="file-pane-error">{state.error}</div> : null}
      <FileList
        entries={state.entries}
        focusedIndex={state.focusedIndex}
        scrollTop={state.scrollTop}
        onScrollTopChange={setScrollTop}
        onVisibleRowCountChange={setPageSize}
      />
      <CommandLauncher cwd={state.currentPath} focused={launcherFocused} onBlur={() => setLauncherFocused(false)} />
      {favoritesOpen ? (
        <div className="favorites-overlay">
          <div className="favorites-dialog" role="dialog" aria-modal="true" aria-label="Favorites">
            <div className="favorites-title">Favorites</div>
            {favorites.length === 0 ? <div className="favorites-empty">No favorites are configured.</div> : favorites.map((favorite, index) => (
              <button className={index === favoriteIndex ? 'favorites-focused' : ''} key={favorite.key} type="button" onClick={() => { goToPath(favorite.path); setFavoritesOpen(false) }}>
                <kbd>Ctrl+{favorite.key}</kbd> {favorite.label} — {favorite.path}
              </button>
            ))}
            <button type="button" onClick={() => setFavoritesOpen(false)}>Close</button>
          </div>
        </div>
      ) : null}
    </div>
  )
}

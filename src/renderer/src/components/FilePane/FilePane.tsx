import { useEffect, useRef, useState } from 'react'
import type { KeyboardEvent, ReactElement } from 'react'
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

type FilePaneProps = { initialPath: string; overlayOpen: boolean; onView: (path: string) => void }

export function FilePane({ initialPath, overlayOpen, onView }: FilePaneProps): ReactElement {
  const { state, moveFocus, moveFocusToEdge, activateFocused, goToParent, setSort, setScrollTop, typeAhead } =
    useFilePane(initialPath)
  const [pageSize, setPageSize] = useState(10)
  const [launcherFocused, setLauncherFocused] = useState(false)
  const paneRef = useRef<HTMLDivElement>(null)

  // Without this, Arrow/Enter/Backspace do nothing until the user clicks
  // the pane or tabs into it (SPEC.md §4.3 expects them to work immediately).
  useEffect(() => {
    paneRef.current?.focus()
  }, [])

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    if (overlayOpen) return
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
    </div>
  )
}

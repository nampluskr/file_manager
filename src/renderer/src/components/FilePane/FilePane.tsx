import { useState } from 'react'
import type { KeyboardEvent, ReactElement } from 'react'
import { useFilePane } from '../../hooks/useFilePane'
import { FileList } from '../FileList/FileList'
import { PathBar } from '../PathBar/PathBar'

const PRINTABLE_KEY_PATTERN = /^[\p{L}\p{N}]$/u

const SORT_KEY_BY_FUNCTION_KEY: Record<string, 'name' | 'ext' | 'mtime' | 'size'> = {
  F3: 'name',
  F4: 'ext',
  F5: 'mtime',
  F6: 'size'
}

type FilePaneProps = { initialPath: string }

export function FilePane({ initialPath }: FilePaneProps): ReactElement {
  const { state, moveFocus, moveFocusToEdge, activateFocused, goToParent, setSort, setScrollTop, typeAhead } =
    useFilePane(initialPath)
  const [pageSize, setPageSize] = useState(10)

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    if (event.ctrlKey) {
      const sortKey = SORT_KEY_BY_FUNCTION_KEY[event.key]
      if (sortKey) {
        event.preventDefault()
        setSort(sortKey)
      }
      return
    }

    switch (event.key) {
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
    <div className="file-pane" tabIndex={0} onKeyDown={handleKeyDown}>
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
    </div>
  )
}

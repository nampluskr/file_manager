import { useEffect, useReducer, useRef, useState } from 'react'
import type { MouseEvent, ReactElement } from 'react'
import type { FileEntry } from '../../../../shared/types'
import { formatDate, formatSize } from '../../state/format'
import { computeVisibleRange } from '../../state/windowing'
import { ensureIconLoaded, getCachedIcon } from '../../state/iconCache'
import { FileRow } from '../FileRow/FileRow'

export const ROW_HEIGHT = 22
const OVERSCAN = 4

type FileListProps = {
  entries: FileEntry[]
  focusedIndex: number
  selectedNames: Set<string>
  scrollTop: number
  onScrollTopChange: (value: number) => void
  onVisibleRowCountChange: (count: number) => void
  onRowClick: (index: number, ctrlKey: boolean, shiftKey: boolean) => void
  onRowDoubleClick: (index: number) => void
}

// Reads the row index a mouse event landed on via event delegation on the
// scroll container -- FileRow itself carries no click handler so per-row
// memoization (SPEC.md §10.2) is not defeated by a fresh closure every render.
function rowIndexFromEvent(event: MouseEvent<HTMLDivElement>): number | null {
  const rowElement = (event.target as HTMLElement).closest<HTMLElement>('.file-row')
  if (!rowElement) return null
  const index = Number(rowElement.dataset.index)
  return Number.isNaN(index) ? null : index
}

export function FileList({
  entries,
  focusedIndex,
  selectedNames,
  scrollTop,
  onScrollTopChange,
  onVisibleRowCountChange,
  onRowClick,
  onRowDoubleClick
}: FileListProps): ReactElement {
  const containerRef = useRef<HTMLDivElement>(null)
  const [containerHeight, setContainerHeight] = useState(0)
  const [, forceIconRerender] = useReducer((tick: number) => tick + 1, 0)

  useEffect(() => {
    const element = containerRef.current
    if (!element) return

    const observer = new ResizeObserver((observerEntries) => {
      const height = observerEntries[0]?.contentRect.height ?? 0
      setContainerHeight(height)
      onVisibleRowCountChange(Math.max(1, Math.floor(height / ROW_HEIGHT)))
    })
    observer.observe(element)
    return () => observer.disconnect()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Keep the focused row within the visible window (SPEC.md §9.2).
  useEffect(() => {
    if (containerHeight === 0) return
    const focusTop = focusedIndex * ROW_HEIGHT
    const focusBottom = focusTop + ROW_HEIGHT
    if (focusTop < scrollTop) {
      onScrollTopChange(focusTop)
    } else if (focusBottom > scrollTop + containerHeight) {
      onScrollTopChange(focusBottom - containerHeight)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusedIndex, containerHeight])

  // Sync the real scrollable element with the controlled scrollTop value.
  useEffect(() => {
    const element = containerRef.current
    if (element && element.scrollTop !== scrollTop) element.scrollTop = scrollTop
  }, [scrollTop])

  const { startIndex, endIndex, totalHeight } = computeVisibleRange(
    entries.length,
    ROW_HEIGHT,
    scrollTop,
    containerHeight,
    OVERSCAN
  )
  const visibleEntries = entries.slice(startIndex, endIndex)

  return (
    <div
      ref={containerRef}
      className="file-list"
      onScroll={(event) => onScrollTopChange(event.currentTarget.scrollTop)}
      onClick={(event) => {
        const index = rowIndexFromEvent(event)
        if (index !== null) onRowClick(index, event.ctrlKey, event.shiftKey)
      }}
      onDoubleClick={(event) => {
        const index = rowIndexFromEvent(event)
        if (index !== null) onRowDoubleClick(index)
      }}
    >
      <div className="file-list-spacer" style={{ height: totalHeight }}>
        {visibleEntries.map((entry, offset) => {
          const index = startIndex + offset
          if (!entry.isDirectory && !entry.isParent && getCachedIcon(entry.ext) === null) {
            ensureIconLoaded(entry.ext, forceIconRerender)
          }
          return (
            <FileRow
              key={entry.name}
              index={index}
              top={index * ROW_HEIGHT}
              name={entry.isParent ? '[..]' : entry.name}
              ext={entry.ext}
              sizeLabel={formatSize(entry.size, entry.isDirectory)}
              dateLabel={formatDate(entry.mtime)}
              isDirectory={entry.isDirectory}
              isFocused={index === focusedIndex}
              isSelected={!entry.isParent && selectedNames.has(entry.name.toLowerCase())}
              iconUrl={entry.isDirectory ? null : getCachedIcon(entry.ext)}
            />
          )
        })}
      </div>
    </div>
  )
}
